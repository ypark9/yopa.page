# MCP Apps: what the cheap local experiment actually settles

Companion to `content/blog/2026-09-21-should-your-service-render-inside-the-ai-host.md`.

**Run on** 2026-09-23. **Stack:** MCP Inspector 2.8.0 (host stand-in), Chrome 153,
`@modelcontextprotocol/server` 2.1.0, `@modelcontextprotocol/ext-apps` 2.0.0, zod 4.6.5,
Node v23.10.0, stdio transport, macOS — all captured in
[`14-environment.txt`](transcripts/14-environment.txt). **Spec:** SEP-1865, Stable
(2026-01-26), extension id `io.modelcontextprotocol/ui`.

No AWS account, no deployment, no third-party AI host, no paid calls. Raw evidence in
[`transcripts/`](transcripts/README.md), which documents how each file was produced and the
two places where a capture was edited.

---

## 1. The positive result: the pattern works locally, end to end

**Discovery.** `tools/list` ([`01`](transcripts/01-tools-list.json)) carries the linkage, and
the SDK helper writes the resource URI *twice*:

```json
"_meta": {
  "ui": { "resourceUri": "ui://fleet-experiment/card-default" },
  "ui/resourceUri": "ui://fleet-experiment/card-default"
}
```

The nested form is the spec's preferred shape; the flat key is a deprecated back-compat alias
the helper emits for older hosts (`ext-apps/dist/src/server/index.d.ts`). Worth knowing if you
ever hand-roll the metadata.

`resources/list` ([`02`](transcripts/02-resources-list.json)) exposes `_meta.ui.csp` at
listing time, before any read — so a host can review a widget's requested network reach at
connection time rather than at render time.

**Resolution.** `resources/read` ([`03`](transcripts/03-read-default.json),
[`04`](transcripts/04-read-permissive.json)) returns the HTML under
`mimeType: "text/html;profile=mcp-app"`. `--app-info` walks the whole chain in one command
([`07`](transcripts/07-app-info-browse.json)):

```json
{"hasApp":true,"toolName":"browse_fleet","resourceUri":"ui://fleet-experiment/card-default",
 "prefersBorder":true,"resourceMimeType":"text/html;profile=mcp-app"}
```

**Delivery.** The widget received `ui/notifications/host-context-changed` →
`ui/notifications/tool-input` → `ui/notifications/tool-result`, with `structuredContent`
intact ([`11`](transcripts/11-probe-default-csp.json)).

**The design rule is enforced by metadata, not discipline.** Three tools were registered; only
the two carrying `_meta.ui.resourceUri` appeared in the inspector's "MCP Apps (2)" panel.
`fleet_status` was correctly excluded.

**Capability negotiation is exercised, not just observed.** The server branches on
`getUiCapability()` in `oninitialized` and logs which branch it took. Both branches were run:

- with the inspector, which advertises the extension
  ([`08`](transcripts/08-wire-cli.jsonl) shows
  `"io.modelcontextprotocol/ui": {"mimeTypes":["text/html;profile=mcp-app"]}`) →
  `[capability-branch] … -> registering WIDGET variant`, and `tools/list` carries the UI
  metadata ([`01`](transcripts/01-tools-list.json));
- with a raw stdio client advertising no extensions →
  `[capability-branch] … advertised=false … -> registering TEXT-ONLY variant`, and the same
  tool appears with no `_meta.ui` at all
  ([`13`](transcripts/13-tools-list-no-ui-capability.json)).

So the graceful-degradation path is testable before you have a host. The article did not
credit the cheap step with that.

**The `ui/initialize` handshake round-trips**, and its result is a substantial object: host
capabilities (`openLinks`, `downloadFile`, `serverTools`, `serverResources`, `logging`,
`sandbox.csp`), `hostInfo`, and a `hostContext` carrying theme, display mode, container
dimensions, and 26 CSS custom properties for theming. Notably `sandbox.csp` echoes back the
policy the host derived from your metadata — `{}` for the default resource, and the declared
domains for the permissive one. A widget can therefore discover its own sandbox terms at
runtime, locally.

---

## 2. The three "needs a real host" claims, tested rather than assumed

Two hold. One is wrong as written.

### Claim 1 — host caching of resource listings: **CONFIRMED out of reach** (but the local behaviour is instructive)

Tested, not asserted. The server registers a new tool 15 s into a live connection, which makes
the SDK emit `notifications/tools/list_changed`
([`10`](transcripts/10-wire-listing-staleness.jsonl)):

```
19:26:32.078  [host->server] tools/list                     ← once, at connect
19:26:47.025  [server->host] notifications/tools/list_changed
19:28:46.671  [host->server] tools/list                     ← only after a human clicked "Refresh"
```

The inspector's behaviour is more interesting than "ignores it". On receiving the
notification it showed a **"List updated"** badge next to a **Refresh** button, and then did
nothing for 2 minutes. `tools/list` was re-issued only when the button was clicked, at which
point `late_arrival` appeared. So this host's refresh policy is *human-in-the-loop*: it knows
the list is stale, tells the operator, and waits.

**Why this still cannot answer the production question.** There is one caching behaviour
available and no knob to vary it: no TTL, no CDN in front of the listing, no cross-session or
cross-user cache, no second client to observe a shared one. More fundamentally, over stdio the
server is a *subprocess of the host*, so server lifetime equals connection lifetime — the
production scenario of a long-lived host connection to a remote server that redeploys
underneath it has no local analogue, because here a deploy **is** a reconnect.

What it does establish: a widget's **HTML** change ships on the next invocation (§3 row 2),
but a **tool listing** change reaches the user only if the host chooses to act on the
notification — and at least one host makes that a manual step. This was tested for tools only;
no resource was added mid-connection, so `resources/list_changed` behaviour is untested here.

### Claim 2 — sandboxed iframe behaviour with asset loading: **WRONG as written, needs narrowing**

The CSP mechanism is substantially testable locally, and testing it produced a result worth
having.

Two resources with **byte-identical HTML** (sha256 prefix `24df09b6cd62cdcd`, 17,576 bytes in
both [`03`](transcripts/03-read-default.json) and
[`04`](transcripts/04-read-permissive.json)), differing only in `_meta.ui.csp`. The browser
reported the enforced policy itself, via `SecurityPolicyViolationEvent.originalPolicy` —
preserved in full on every violation record in
[`11`](transcripts/11-probe-default-csp.json) and
[`12`](transcripts/12-probe-permissive-csp.json).

No `ui.csp` declared:

```
default-src 'none'; connect-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';
img-src 'none'; font-src 'none'; media-src 'none'; frame-src 'none'; base-uri 'self';
form-action 'none'; object-src 'none'; worker-src 'none'
```

`ui.csp` declaring `connectDomains: [api.github.com]`, `resourceDomains: [cdn.jsdelivr.net]`:

```
default-src 'none'; connect-src https://api.github.com;
script-src 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'unsafe-inline' https://cdn.jsdelivr.net;
img-src https://cdn.jsdelivr.net; font-src https://cdn.jsdelivr.net; media-src https://cdn.jsdelivr.net;
frame-src 'none'; base-uri 'self'; form-action 'none'; object-src 'none'; worker-src 'none'
```

| Probe | No `ui.csp` | `ui.csp` declared |
|---|---|---|
| inline `data:` image | **blocked** (`img-src`) | **blocked** (`img-src`) |
| image from `cdn.jsdelivr.net` | blocked | **loaded** |
| stylesheet from `fonts.googleapis.com` | blocked (`style-src-elem`) | blocked (`style-src-elem`) |
| `fetch()` `api.github.com` | blocked (`connect-src`) | **loaded** — real round trip, body `"Encourage flow."` |
| `fetch()` `example.com` | blocked (`connect-src`) | blocked (`connect-src`) |
| nested `<iframe>` | blocked (`frame-src`) | blocked (`frame-src`) |

Undeclared origins stay blocked even once other origins are declared: "no loosening" is
enforced, not merely specified.

**Two things you would want to know before shipping, both found locally.**

*The applied default is stricter than the spec's stated default.* SEP-1865 says that when
`ui.csp` is omitted the host MUST use `img-src 'self' data:` among others
([`15`](transcripts/15-spec-csp-default.txt)). The inspector applies `img-src 'none'`. That is
*permitted* — the same section says a host MAY further restrict — which is the point: **the
spec's restrictive default is a ceiling, not a guarantee.** An inline `data:` icon, the
obvious way to keep a widget self-contained, is blocked here. Declaring `resourceDomains` does
not bring `data:` back either. Whether it works on any given host is that host's choice, and
the only way to know is to try it there.

*`resourceDomains` is coarser than its name suggests.* Declaring `cdn.jsdelivr.net` to serve
an image also added it to `script-src` and `style-src`. One field turns an image CDN into an
allowed **script** origin. The spec documents this mapping, but it is easy to declare a domain
thinking "pictures" and get "executable code" — and no probe here tested loading an actual
script from that origin, so the exploitability of it is untested, only the policy grant.

**What genuinely still needs a real host:** the `ui.csp.domain` dedicated-origin field is
explicitly host-defined (Claude uses `{hash}.claudemcpcontent.com`, ChatGPT
`www-example-com.oaiusercontent.com`); the `permissions` → iframe `allow` mapping is a host
MAY; and each host's own deviation from the default — exactly the deviation found above — is
discoverable only on that host. The honest claim is not "you cannot test iframe asset
behaviour locally." It is: **test the mechanism locally, and treat the policy you observe as
this host's, not as portable.**

### Claim 3 — whether the no-auth inbound choice survives a threat model: **CONFIRMED out of reach**

There is no boundary here to threat-model. Verified, not assumed
([`14`](transcripts/14-environment.txt)): `lsof -nP -a -p <pid> -i` on the running server
returns nothing at all. No sockets, listening or otherwise. It reads stdin and writes stdout as
a child of the host.

Every element of the reference implementation's posture is therefore absent rather than
merely unconfigured: no gateway, no WAF, no IP allowlist, no rate limiting, no SigV4, no IAM
execution role, no resource policy, no tenant identity in the request. The only authentication
anywhere in the setup is the inspector's own `MCP_INSPECTOR_API_TOKEN`, printed in its startup
banner, which guards the inspector's web UI from other processes on the laptop and says
nothing about your server.

This is the sharpest of the three. The local step cannot pose the question, let alone answer
it — and it is the question the article says to spend the review on.

---

## 3. Where the inspector differs from a real host

A stand-in that is friendlier than production is a trap. Some of these cut the other way: the
inspector is *stricter*, which is its own trap, because it will reject a widget that ships
fine elsewhere.

| # | Inspector behaviour | Why a real host plausibly differs |
|---|---|---|
| 1 | **Re-lists only when a human clicks Refresh.** Shows a "List updated" badge on `tools/list_changed`, then waits | A headless host has no one to click. It might auto-refresh, defer to a TTL, or ignore the notification. None of those is observable here. |
| 2 | **Re-reads `resources/read` on every invocation** — no widget caching ([`09`](transcripts/09-wire-ui-render.jsonl)) | A host caching widget HTML per version or session is the article's stated pitfall. Here the widget is always fresh, so the stale-widget bug is structurally unreachable. |
| 3 | **`img-src 'none'` default**, stricter than the spec's `img-src 'self' data:` | Spec-permitted, but it means `data:` images are a per-host gamble. |
| 4 | **Server runs as a stdio subprocess** | Production is a remote HTTP server behind a gateway. Transport, auth, latency, failure modes and the whole network boundary differ. |
| 5 | **No tenant, user or session identity** anywhere in the exchange | A real host carries a user. Multi-tenant logic and per-user authorisation are unexercised. |
| 6 | **Rendered the widget even though the first `ui/initialize` was rejected** | Notably forgiving. A stricter host could refuse to render a view whose handshake failed. A widget that silently depends on the handshake succeeding passes here and fails there. |
| 7 | **Does not forward the launching shell's environment** to the spawned server | Config that works when you run the server by hand vanishes under the inspector. Cost a detour in this run; hence `src/server-mutating.js` instead of an env var. |
| 8 | **Base protocol negotiated at `2025-11-25`**, while `ui/initialize` returns `protocolVersion: "2026-01-26"` | Two version numbers in one session. Pin both deliberately. |
| 9 | **`hostInfo.version` reports `2.0.0`** while the installed package is 2.8.0 | Do not use `hostInfo.version` to gate behaviour without checking what a given host actually puts there. |
| 10 | **Advertises three extensions** (`ui`, `tasks`, `skills`) | A real host advertises its own set. Branch on the capability, never on "the inspector had it." |

### Two traps this experiment fell into

**The spec's narrative example does not match the normative type.** SEP-1865's "you don't need
an SDK" snippet sends `clientInfo` — but that snippet is for the base `initialize` method. The
normative `McpUiInitializeRequest` requires `appInfo` and `appCapabilities`. Copying the
snippet into a `ui/initialize` call earns
`-32602 Invalid params for ui/initialize: appInfo: Invalid input`. The widget now sends the
wrong shape first and the right shape second, so both are on the record
([`11`](transcripts/11-probe-default-csp.json) `lifecycle`). The inspector was right and the
harness was wrong; what is worth keeping is that the widget still rendered after the failure.

**Do not infer CSP behaviour from load/error handlers.** Two of six DOM-level probes reported
the wrong answer every run: the blocked stylesheet still produced a non-null `link.sheet`, and
the blocked nested iframe still fired `load`. Any reasonable-looking feature check would have
recorded both as "loaded fine". Only the `securitypolicyviolation` records got it right. The
false positives are left in the transcripts unchanged.

---

## 4. Bottom line

**Settled locally, no host access needed:**

- the tool → `_meta.ui.resourceUri` → `resources/read` → render chain resolves;
- `structuredContent` arrives in the view via `ui/notifications/tool-result`, intact;
- the widget/no-widget split is enforced by metadata;
- capability negotiation and the text-only degradation branch, both directions;
- the `ui/initialize` handshake and the host context it returns, theming included;
- whether your assets load under a declared vs. default CSP, and that declared domains widen
  the policy to exactly those origins — including the over-broad `resourceDomains` mapping;
- that a tool listing change does not propagate mid-connection without host action.

**Still requires a real host:**

- listing cache TTL, cross-session cache, and edge caching;
- that host's actual CSP defaults, and its `ui.csp.domain` / `permissions` handling;
- anything about inbound authentication — there is no network boundary locally to reason about;
- how the host behaves when the `ui/initialize` handshake fails, since this one shrugged;
- multi-tenant identity and per-user authorisation.

The article's structural conclusion stands: the cheap step is genuinely cheap and genuinely
useful, and the expensive questions are the security and caching ones. The correction is that
iframe asset loading belongs in the *cheap* column — with the caveat that the policy you
observe locally is this host's, not every host's.

---

## Reproducing

```bash
cd experiments/mcp-app-host
npm install

# Payload capture (inspector CLI, non-interactive)
npx @modelcontextprotocol/inspector@2.8.0 --cli node src/server.js --method tools/list
npx @modelcontextprotocol/inspector@2.8.0 --cli node src/server.js --method resources/list
npx @modelcontextprotocol/inspector@2.8.0 --cli node src/server.js \
  --method resources/read --uri 'ui://fleet-experiment/card-default'
npx @modelcontextprotocol/inspector@2.8.0 --cli node src/server.js \
  --method tools/call --tool-name browse_fleet --tool-arg available_only=true --app-info

# Graceful degradation: a client that advertises no extensions
npm run capture:no-ui

# Render + CSP probes. Open the printed URL, connect, Apps tab, pick an app,
# Open App. Read the widget's probe panel, then the browser console for the
# enforced policy. Frames are logged to transcripts/wire.jsonl.
npx @modelcontextprotocol/inspector@2.8.0 node scripts/tee-server.mjs

# Listing staleness: server grows a tool 15s after connect
npx @modelcontextprotocol/inspector@2.8.0 node scripts/tee-server.mjs src/server-mutating.js
```

## Sources

- [SEP-1865: MCP Apps](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx) — Stable 2026-01-26; the CSP default excerpt is in [`15`](transcripts/15-spec-csp-default.txt)
- [MCP Apps announcement](https://blog.modelcontextprotocol.io/posts/2025-11-21-mcp-apps/)
- [aws-samples/sample-agentcore-mcp-apps](https://github.com/aws-samples/sample-agentcore-mcp-apps) — the reference implementation the article reads
