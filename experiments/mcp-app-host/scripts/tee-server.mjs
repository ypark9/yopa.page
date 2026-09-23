/**
 * Transparent stdio proxy that logs every JSON-RPC frame in both directions.
 *
 * The inspector's CLI prints only the RESULT of the method you asked for. That
 * hides the part of the exchange this experiment most needs to see: what the
 * host advertises in `initialize`. Specifically, whether the host declares the
 * MCP Apps extension capability `io.modelcontextprotocol/ui`, which under
 * SEP-1865 is what a server is supposed to branch on before registering
 * UI-enabled tools.
 *
 * Usage:
 *   MCP_WIRE_LOG=transcripts/wire-cli.jsonl node scripts/tee-server.mjs
 *
 * Point the inspector at THIS instead of src/server.js.
 */

import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const logPath = process.env.MCP_WIRE_LOG || join(HERE, "..", "transcripts", "wire.jsonl");
const log = createWriteStream(logPath, { flags: "w" });

// Which server entry point to wrap. Passed as an argument rather than an env
// var on purpose: the inspector does NOT forward the launching shell's
// environment to the server process it spawns, so `FOO=1 npx inspector ...`
// silently fails to configure the server. Arguments do get through.
const target = process.argv[2] || join(HERE, "..", "src", "server.js");

const child = spawn(process.execPath, [target], {
  stdio: ["pipe", "pipe", "inherit"],
});

function record(direction, chunk) {
  for (const line of chunk.toString("utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      parsed = { unparsed: trimmed };
    }
    log.write(JSON.stringify({ t: new Date().toISOString(), direction, frame: parsed }) + "\n");
  }
}

process.stdin.on("data", (c) => {
  record("host->server", c);
  child.stdin.write(c);
});
child.stdout.on("data", (c) => {
  record("server->host", c);
  process.stdout.write(c);
});

process.stdin.on("end", () => child.stdin.end());
child.on("exit", (code) => {
  log.end();
  process.exit(code ?? 0);
});
