import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { getDataDir } from "./platforms.js";

/**
 * Reads the DevToolsActivePort file from Chrome's user data directory.
 * Chrome writes this file when remote debugging is enabled (via
 * chrome://inspect/#remote-debugging or --remote-debugging-port).
 * Returns { port, wsPath } or null.
 */
export function readDevToolsActivePort() {
  const filePath = join(getDataDir(), "DevToolsActivePort");
  if (!existsSync(filePath)) return null;

  try {
    const lines = readFileSync(filePath, "utf-8").trim().split("\n");
    if (lines.length < 2) return null;
    const port = Number(lines[0]);
    if (!port || isNaN(port)) return null;
    return { port, wsPath: lines[1] };
  } catch {
    return null;
  }
}

export async function isCdpReady(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function ensureChromeReady(explicitPort) {
  // If user passed --port, try that directly
  if (explicitPort) {
    if (await isCdpReady(explicitPort)) return explicitPort;

    console.error(`\n  Cannot connect to Chrome on port ${explicitPort}.\n`);
    console.error("  Enable remote debugging in Chrome:");
    console.error("  1. Open chrome://inspect/#remote-debugging");
    console.error("  2. Toggle 'Allow remote debugging' on");
    console.error("  3. Re-run this command\n");
    process.exit(1);
  }

  // Auto-discover from DevToolsActivePort
  const active = readDevToolsActivePort();
  if (active && await isCdpReady(active.port)) return active.port;

  // Fallback: try common port
  if (await isCdpReady(9222)) return 9222;

  console.error("\n  Chrome remote debugging is not enabled.\n");
  console.error("  To enable it:");
  console.error("  1. Open chrome://inspect/#remote-debugging in Chrome");
  console.error("  2. Toggle 'Allow remote debugging' on");
  console.error("  3. Re-run this command\n");

  if (active) {
    console.error(`  (Found stale DevToolsActivePort for port ${active.port} — restart Chrome if needed)\n`);
  }

  process.exit(1);
}
