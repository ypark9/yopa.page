/**
 * Drives the server as a host that does NOT advertise the MCP Apps extension,
 * to exercise the graceful-degradation branch in src/server.js.
 *
 * Deliberately hand-rolled JSON-RPC rather than an SDK client: the point is to
 * control exactly what appears in `capabilities`, and an SDK may add its own.
 *
 * Writes transcripts/13-tools-list-no-ui-capability.{json,stderr}.
 */

import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const out = join(HERE, "..", "transcripts", "13-tools-list-no-ui-capability.json");
const err = join(HERE, "..", "transcripts", "13-tools-list-no-ui-capability.stderr");

const child = spawn(process.execPath, [join(HERE, "..", "src", "server.js")], {
  stdio: ["pipe", "pipe", "pipe"],
});

child.stdout.pipe(createWriteStream(out));
child.stderr.pipe(createWriteStream(err));

const send = (o) => child.stdin.write(JSON.stringify(o) + "\n");

send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-11-25",
    capabilities: {}, // <- the whole point: no `extensions` key at all
    clientInfo: { name: "no-ui-client", version: "1.0.0" },
  },
});
send({ jsonrpc: "2.0", method: "notifications/initialized" });

setTimeout(() => send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }), 400);
setTimeout(() => {
  child.stdin.end();
  console.log(`wrote ${out}`);
  console.log(`wrote ${err}`);
}, 1000);
