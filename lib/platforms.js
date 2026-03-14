import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { execFileSync } from "child_process";

const HOME = homedir();

const PLATFORMS = {
  darwin: {
    chromePaths: [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      `${HOME}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
    ],
    dataDir: join(HOME, "Library", "Application Support", "Google", "Chrome"),
  },
  linux: {
    chromePaths: [
      "/usr/bin/google-chrome-stable",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
      "/snap/bin/chromium",
    ],
    dataDir: join(HOME, ".config", "google-chrome"),
  },
  win32: {
    chromePaths: [
      join(process.env.PROGRAMFILES || "", "Google", "Chrome", "Application", "chrome.exe"),
      join(process.env["PROGRAMFILES(X86)"] || "", "Google", "Chrome", "Application", "chrome.exe"),
      join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
    ],
    dataDir: join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "User Data"),
  },
};

export function getPlatformConfig() {
  const cfg = PLATFORMS[process.platform];
  if (!cfg) throw new Error(`Unsupported platform: ${process.platform}`);
  return cfg;
}

export function findChrome() {
  const { chromePaths } = getPlatformConfig();
  for (const p of chromePaths) {
    if (existsSync(p)) return p;
  }
  return null;
}

export function getChromeVersion(chromePath) {
  try {
    const raw = execFileSync(chromePath, ["--version"], {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    const match = raw.match(/(\d+)\.\d+\.\d+\.\d+/);
    return match ? { full: match[0], major: Number(match[1]) } : null;
  } catch {
    return null;
  }
}

export function getDataDir() {
  return getPlatformConfig().dataDir;
}
