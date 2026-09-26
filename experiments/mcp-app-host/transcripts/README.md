# Evidence, and exactly how each file was produced

Provenance matters more than tidiness here, so each file says what it is and what was done
to it. All captures are from one session on 2026-09-23 (UTC times in the files).

| File | How it was produced | Modified after capture? |
|---|---|---|
| `01-tools-list.json` … `07-app-info-browse.json` | stdout of `npx @modelcontextprotocol/inspector@2.8.0 --cli node src/server.js --method …`, redirected to the file | No |
| `01-tools-list.stderr` … `*.stderr` | stderr of the same commands. `01-tools-list.stderr` carries the server's own `[capability-branch]` line | No |
| `08-wire-cli.jsonl` | Every JSON-RPC frame of a CLI `tools/list` run, logged by `scripts/tee-server.mjs`. Shows the host's `initialize` params, including the advertised extensions | No |
| `09-wire-ui-render.jsonl` | Same logger, but for the **inspector UI** session in which the two widgets were rendered. This is the file behind the "`resources/read` is re-issued on every invocation" claim | No |
| `10-wire-listing-staleness.jsonl` | Same logger, for a session against `src/server-mutating.js`. Shows `notifications/tools/list_changed` at 19:26:47 and the host's `tools/list` only at 19:28:46, after a human clicked Refresh | No |
| `11-probe-default-csp.json` | The widget's own `__MCPAPP_PROBE__` report for `ui://fleet-experiment/card-default`, read out of the Chrome DevTools console | **Yes, two changes**, below |
| `12-probe-permissive-csp.json` | Same, for `ui://fleet-experiment/card-permissive` | **Yes, two changes**, below |
| `13-tools-list-no-ui-capability.json` / `.stderr` | Raw JSON-RPC piped into `node src/server.js` from a client that advertises **no** extensions. Shows the graceful-degradation branch | No |
| `14-environment.txt` | Shell transcript: versions, and `lsof` showing the server process owns no sockets | No |
| `15-spec-csp-default.txt` | Lines 276–291 of the SEP-1865 spec, fetched from the URL named in the file | No |
| `render-permissive.png` | Viewport screenshot of the inspector rendering `browse_fleet_permissive` | No |

## The two modifications to files 11 and 12

1. **The `__MCPAPP_PROBE__ ` prefix was stripped and the JSON pretty-printed.** Lossless.
2. **`lifecycle[].result.hostContext.styles.variables` was replaced with a placeholder
   string.** The host sends 26 CSS custom properties (`--color-*`, `--font-*`,
   `--border-radius-*`, `--shadow-*`) for theming; the block is long, identical between the
   two runs, and load-bearing for nothing claimed in FINDINGS.md. Everything else — every
   probe result with its timestamp, every CSP violation with its full `originalPolicy`, the
   complete lifecycle including both `ui/initialize` attempts, and the full tool result — is
   as logged.

Nothing else was added, removed, reworded, or reordered. In particular the `ok: true` values
on the two probes that were actually blocked (`nestedIframe`, `externalStylesheetUndeclared`)
are left exactly as the widget reported them, because those false positives are one of the
findings.

## Reading the probe files

`probes[*].ok` is what the widget's own load/error handlers concluded. It is **wrong twice**
per run. `cspViolations[*]` is what the browser reported, and it is authoritative. Where they
disagree, the violation record wins. See the methodological warning in `../FINDINGS.md`.
