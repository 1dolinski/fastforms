import puppeteer from "puppeteer-core";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { createInterface } from "readline";

const FASTFORMS_URL = "https://293-fastforms.vercel.app/";
const PERSONA_URL = "https://293-fastforms.vercel.app/persona";
const CONFIG_PATH = join(homedir(), ".fastforms.json");

const STORAGE_KEYS = {
  personas: "fastforms.personas.v1",
  businessPersonas: "fastforms.businessPersonas.v1",
  applications: "fastforms.applications.v1",
};

function loadConfig() {
  try { return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")); } catch { return {}; }
}

function saveConfig(patch) {
  writeFileSync(CONFIG_PATH, JSON.stringify({ ...loadConfig(), ...patch }, null, 2));
}

function ask(prompt) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(prompt, (a) => { rl.close(); r(a.trim()); }));
}

export async function connectToChrome(port = 9222) {
  return puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
}

export async function pullPersonas(browser) {
  const pages = await browser.pages();
  let tab = pages.find((p) => p.url().includes("293-fastforms"));
  let opened = false;

  if (tab) {
    console.log("  Using existing FastForms tab.");
  } else {
    tab = await browser.newPage();
    await tab.goto(FASTFORMS_URL, { waitUntil: "networkidle2", timeout: 30_000 });
    console.log("  Opened FastForms tab.");
    opened = true;
  }

  const dump = await tab.evaluate((keys) => {
    const out = {};
    for (const [name, sk] of Object.entries(keys)) {
      const raw = localStorage.getItem(sk);
      if (raw) try { out[name] = JSON.parse(raw); } catch { out[name] = raw; }
    }
    return out;
  }, STORAGE_KEYS);

  if (opened) await tab.close();
  return dump;
}

export function pickPersona(list, hint, keys) {
  if (!list?.length) return null;
  if (!hint) return list[0];
  const h = hint.toLowerCase();
  for (const k of keys) {
    const match = list.find((p) => {
      const val = k.split(".").reduce((o, s) => o?.[s], p);
      return typeof val === "string" && val.toLowerCase().includes(h);
    });
    if (match) return match;
  }
  return list[0];
}

export function getCustomFact(persona, key) {
  if (!persona) return "";
  const h = key.toLowerCase();
  return (persona.customFacts || []).find(
    (f) => f.enabled !== false && f.key?.toLowerCase().includes(h)
  )?.value || "";
}

function printPersonaSummary(label, persona, profileKeys) {
  if (!persona) return;
  const p = persona.profile || {};
  console.log(`\n  ${label}: ${persona.name}`);
  for (const [key, display] of profileKeys) {
    const val = p[key];
    if (val) console.log(`    ${display}: ${String(val).slice(0, 80)}${String(val).length > 80 ? "..." : ""}`);
  }
  const facts = (persona.customFacts || []).filter((f) => f.enabled !== false && f.value);
  if (facts.length) console.log(`    Custom facts: ${facts.length}`);
}

export function showPersonaDetails(user, biz) {
  printPersonaSummary("User persona", user, [
    ["fullName", "Name"],
    ["email", "Email"],
    ["currentRole", "Role"],
    ["location", "Location"],
    ["linkedIn", "LinkedIn"],
    ["github", "GitHub"],
  ]);
  printPersonaSummary("Business persona", biz, [
    ["companyName", "Company"],
    ["productName", "Product"],
    ["oneLiner", "One-liner"],
    ["website", "Website"],
    ["category", "Category"],
  ]);
}

// ---------------------------------------------------------------------------
// Interactive persona selection — supports multiple personas from any source
// ---------------------------------------------------------------------------

async function pickFromList(label, list, hint, keys, defaultName) {
  if (!list?.length) return null;
  if (list.length === 1) return list[0];

  // Try hint-based match
  if (hint) {
    const match = pickPersona(list, hint, keys);
    if (match) return match;
  }

  // Try default
  if (defaultName) {
    const match = list.find((p) => p.name === defaultName);
    if (match) return match;
  }

  // Interactive selection
  console.log(`\n  ${label}:\n`);
  list.forEach((p, i) => {
    const detail = keys.map((k) => k.split(".").reduce((o, s) => o?.[s], p)).filter(Boolean)[0] || "";
    console.log(`    ${i + 1}. ${p.name}${detail ? ` (${detail})` : ""}`);
  });
  const ans = await ask(`\n  Pick ${label.toLowerCase()} [1-${list.length}]: `);
  const idx = Number(ans) - 1;
  if (idx >= 0 && idx < list.length) return list[idx];
  return list[0];
}

export async function selectPersonas(dump, userHint, bizHint) {
  const config = loadConfig();
  const personas = dump.personas || [];
  const bizPersonas = dump.businessPersonas || [];

  const effectiveUserHint = userHint || "";
  const effectiveBizHint = bizHint || "";
  const defaultUser = config.defaultUser || "";
  const defaultBiz = config.defaultBusiness || "";

  const user = await pickFromList(
    "User personas",
    personas,
    effectiveUserHint,
    ["name", "profile.fullName"],
    defaultUser,
  );

  const biz = await pickFromList(
    "Business personas",
    bizPersonas,
    effectiveBizHint,
    ["name", "profile.companyName", "profile.productName"],
    defaultBiz,
  );

  return { user, biz };
}

export async function offerSetDefaults(user, biz) {
  const config = loadConfig();
  const userChanged = user && config.defaultUser !== user.name;
  const bizChanged = biz && config.defaultBusiness !== biz.name;

  if (!userChanged && !bizChanged) return;

  const names = [user?.name, biz?.name].filter(Boolean).join(" + ");
  const ans = await ask(`\n  Save "${names}" as default personas? [y/N]: `);
  if (ans.toLowerCase() === "y") {
    const patch = {};
    if (user) patch.defaultUser = user.name;
    if (biz) patch.defaultBusiness = biz.name;
    saveConfig(patch);
    console.log("  Defaults saved to ~/.fastforms.json");
  }
}

export async function offerOpenPersonaManager(browser) {
  const ans = await ask("\n  Open persona manager in Chrome? [y/N]: ");
  if (ans.toLowerCase() === "y") {
    const pages = await browser.pages();
    const existing = pages.find((p) => p.url().includes("293-fastforms.vercel.app/persona"));
    if (existing) {
      await existing.bringToFront();
    } else {
      const tab = await browser.newPage();
      await tab.goto(PERSONA_URL, { waitUntil: "networkidle2", timeout: 30_000 });
    }
    console.log("  Opened: " + PERSONA_URL);
  }
}
