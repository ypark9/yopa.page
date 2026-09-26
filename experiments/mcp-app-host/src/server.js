/**
 * MCP Apps (SEP-1865) cheap-experiment server.
 *
 * Purpose: exercise the MCP Apps pattern locally, with the MCP Inspector as a
 * host stand-in, to test the claims made in
 * content/blog/2026-09-21-should-your-service-render-inside-the-ai-host.en.md
 *
 * Deliberate design choices, each mapping to a claim under test:
 *
 *  1. THREE tools, not one. `browse_fleet` and `browse_fleet_permissive` carry
 *     `_meta.ui.resourceUri`; `fleet_status` does not. The article's rule is
 *     "not every response gets a widget" — the text-only tool is the control
 *     case that shows what a no-widget tool looks like in `tools/list`.
 *
 *  2. TWO ui:// resources that differ ONLY in their `_meta.ui.csp` block.
 *     - ui://fleet-experiment/card-default    declares NO csp
 *     - ui://fleet-experiment/card-permissive declares connectDomains +
 *                                             resourceDomains
 *     Per SEP-1865, a host MUST apply a restrictive default CSP when `ui.csp`
 *     is omitted (default-src 'none'; img-src 'self' data:; connect-src 'none'
 *     ...). So the default resource's external asset probes MUST fail on a
 *     spec-compliant host. If they succeed, the host under test is more
 *     forgiving than the spec requires — which is exactly the "stand-in is
 *     more forgiving than production" trap.
 *
 *  3. The widget is byte-identical between the two resources. Any difference
 *     in observed behaviour is attributable to the CSP metadata alone.
 *
 * Transport is stdio: the inspector launches this as a subprocess.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import {
  RESOURCE_MIME_TYPE,
  getUiCapability,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";

const HERE = dirname(fileURLToPath(import.meta.url));
const WIDGET_HTML = readFileSync(join(HERE, "widget.html"), "utf8");

const URI_DEFAULT = "ui://fleet-experiment/card-default";
const URI_PERMISSIVE = "ui://fleet-experiment/card-permissive";

/**
 * The origins the permissive resource declares. These are real, reachable
 * origins so that "blocked by CSP" and "network is down" can be told apart:
 * if a probe fails under the DEFAULT resource but succeeds under the
 * PERMISSIVE one, the cause was the policy, not the network.
 */
const DECLARED_RESOURCE_DOMAINS = ["https://cdn.jsdelivr.net"];
const DECLARED_CONNECT_DOMAINS = ["https://api.github.com"];

// ---------------------------------------------------------------------------
// Business data. Deliberately trivial and in-process: the article's point is
// that the MCP layer should be a thin protocol adapter, so there is nothing
// here a real deployment would not put behind the server.
// ---------------------------------------------------------------------------

const FLEET = [
  { id: "u-001", name: "Aurora", size: "large", hourlyRate: 120, available: true },
  { id: "u-002", name: "Bramble", size: "small", hourlyRate: 60, available: true },
  { id: "u-003", name: "Cinder", size: "medium", hourlyRate: 85, available: false },
];

function browseResult(available_only) {
  const rows = available_only ? FLEET.filter((u) => u.available) : FLEET;
  return {
    // `content` is what a text-only host and the model see.
    content: [
      {
        type: "text",
        text: rows
          .map(
            (u) =>
              `${u.name} (${u.id}) — ${u.size}, $${u.hourlyRate}/h, ${
                u.available ? "available" : "booked"
              }`,
          )
          .join("\n"),
      },
    ],
    // `structuredContent` is what the widget renders. Per SEP-1865 this is
    // delivered to the view via a `ui/notifications/tool-result` notification
    // and is NOT added to model context.
    structuredContent: {
      generatedAt: new Date().toISOString(),
      query: { available_only },
      unicorns: rows,
    },
  };
}

const server = new McpServer({
  name: "mcp-app-host-experiment",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// UI resources
// ---------------------------------------------------------------------------

registerAppResource(
  server,
  "Fleet card (default CSP)",
  URI_DEFAULT,
  {
    description:
      "Fleet comparison card. Declares NO ui.csp, so a spec-compliant host must apply the restrictive default policy.",
    mimeType: RESOURCE_MIME_TYPE,
  },
  (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: RESOURCE_MIME_TYPE,
        text: WIDGET_HTML,
        _meta: {
          ui: {
            // csp deliberately omitted — this is the whole point of this resource.
            prefersBorder: true,
          },
        },
      },
    ],
  }),
);

registerAppResource(
  server,
  "Fleet card (declared CSP)",
  URI_PERMISSIVE,
  {
    description:
      "Byte-identical widget, but declares connectDomains and resourceDomains so the host should widen the policy to exactly those origins.",
    mimeType: RESOURCE_MIME_TYPE,
    _meta: {
      ui: {
        csp: {
          connectDomains: DECLARED_CONNECT_DOMAINS,
          resourceDomains: DECLARED_RESOURCE_DOMAINS,
        },
      },
    },
  },
  (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: RESOURCE_MIME_TYPE,
        text: WIDGET_HTML,
        _meta: {
          ui: {
            csp: {
              connectDomains: DECLARED_CONNECT_DOMAINS,
              resourceDomains: DECLARED_RESOURCE_DOMAINS,
            },
            prefersBorder: true,
          },
        },
      },
    ],
  }),
);

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

/**
 * Registration is deferred to `oninitialized` so the server can actually
 * branch on what the host said it supports, which is what SEP-1865 tells
 * servers to do. A host that does not advertise
 * `io.modelcontextprotocol/ui` gets the same two tools WITHOUT
 * `_meta.ui.resourceUri` — the graceful-degradation path — and this is
 * observable by connecting any client that omits the extension.
 *
 * The detection result is written to stderr so a run leaves a record of which
 * branch it took.
 */
function registerBrowseTools(uiSupported) {
  const browseSchema = z.object({
    available_only: z
      .boolean()
      .default(true)
      .describe("Only return unicorns that are currently available."),
  });

  if (!uiSupported) {
    server.registerTool(
      "browse_fleet",
      {
        title: "Browse fleet (text only)",
        description: "Host did not advertise MCP Apps support, so no widget is offered.",
        inputSchema: browseSchema,
      },
      async ({ available_only }) => browseResult(available_only),
    );
    return;
  }

  registerAppTool(
    server,
    "browse_fleet",
    {
      title: "Browse fleet (widget, default CSP)",
      description:
        "List unicorns. Comparison shape, so it renders a card. Uses the resource that declares no CSP.",
      inputSchema: browseSchema,
      _meta: { ui: { resourceUri: URI_DEFAULT } },
    },
    async ({ available_only }) => browseResult(available_only),
  );

  registerAppTool(
    server,
    "browse_fleet_permissive",
    {
      title: "Browse fleet (widget, declared CSP)",
      description:
        "Identical to browse_fleet, but points at the resource that declares connectDomains and resourceDomains.",
      inputSchema: z.object({ available_only: z.boolean().default(true) }),
      _meta: { ui: { resourceUri: URI_PERMISSIVE } },
    },
    async ({ available_only }) => browseResult(available_only),
  );
}

server.server.oninitialized = () => {
  const caps = server.server.getClientCapabilities();
  const uiCap = getUiCapability(caps);
  const uiSupported = !!uiCap?.mimeTypes?.includes(RESOURCE_MIME_TYPE);
  process.stderr.write(
    `[capability-branch] io.modelcontextprotocol/ui advertised=${!!uiCap} ` +
      `mimeTypes=${JSON.stringify(uiCap?.mimeTypes ?? null)} ` +
      `-> registering ${uiSupported ? "WIDGET" : "TEXT-ONLY"} variant\n`,
  );
  registerBrowseTools(uiSupported);
};

// Control case: a plain tool with no UI metadata at all, registered
// unconditionally. There is no widget to link, so the base SDK method is used.
server.registerTool(
  "fleet_status",
  {
    title: "Fleet status (text only)",
    description:
      "Single-value answer. Per the article's rule, a status is a sentence, not a card — so this tool carries no _meta.ui.",
    inputSchema: z.object({}),
  },
  async () => ({
    content: [
      {
        type: "text",
        text: `${FLEET.filter((u) => u.available).length} of ${FLEET.length} unicorns available.`,
      },
    ],
  }),
);

await server.connect(new StdioServerTransport());

// ---------------------------------------------------------------------------
// Listing-staleness probe.
//
// The article's pitfall is "assuming a widget update ships instantly", because
// hosts may cache tool and resource listings. Locally that is hard to observe:
// the inspector spawns this process over stdio, so server lifetime equals
// connection lifetime and there is no window in which a deployed change can
// sit behind a cached listing.
//
// This timer manufactures the one case that IS observable: the server's
// inventory changes mid-connection. The SDK emits
// `notifications/tools/list_changed` on registration, so watching whether the
// host then re-issues `tools/list` separates "the host refreshes when told"
// from "the host re-polls on its own" — and nothing here can measure the
// third case, a host that ignores or delays the refresh, which is the one
// that actually bites in production.
//
// Enable with MCP_MUTATE_AFTER_MS=15000.
// ---------------------------------------------------------------------------
const mutateAfterMs = Number(process.env.MCP_MUTATE_AFTER_MS || 0);
if (mutateAfterMs > 0) {
  setTimeout(() => {
    server.registerTool(
      "late_arrival",
      {
        title: "Registered after the host already listed tools",
        description:
          "Did not exist when this connection was established. If the host's tool list never shows it, the host is serving a cached listing.",
        inputSchema: z.object({}),
      },
      async () => ({ content: [{ type: "text", text: "late arrival responding" }] }),
    );
  }, mutateAfterMs);
}
