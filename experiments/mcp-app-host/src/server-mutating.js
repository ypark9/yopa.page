/**
 * Same server, but its tool inventory changes 15 seconds after start.
 *
 * Exists because the inspector does not forward the launching shell's
 * environment to the server subprocess, so MCP_MUTATE_AFTER_MS cannot be set
 * from outside. This entry point sets it before importing the server.
 *
 * Used to answer: once a host has listed tools, does it ever look again?
 */

process.env.MCP_MUTATE_AFTER_MS = process.env.MCP_MUTATE_AFTER_MS || "15000";

await import("./server.js");
