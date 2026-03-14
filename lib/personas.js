import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { createInterface } from "readline";
import { connectChrome } from "./cdp.js";

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
  return connectChrome(port);
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

export function showPersonaDetails(user, biz, form) {
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
  if (form) {
    console.log(`\n  Form persona: ${form.name}`);
    const fp = form.profile || {};
    if (fp.organization) console.log(`    Organization: ${fp.organization}`);
    if (fp.purpose) console.log(`    Purpose: ${fp.purpose}`);
    if (fp.deadline) console.log(`    Deadline: ${fp.deadline}`);
    if (fp.notes) console.log(`    Notes: ${String(fp.notes).slice(0, 80)}${String(fp.notes).length > 80 ? "..." : ""}`);
    const facts = (form.customFacts || []).filter((f) => f.enabled !== false && f.value);
    if (facts.length) console.log(`    Form-specific answers: ${facts.length}`);
  }
}

// ---------------------------------------------------------------------------
// Interactive persona selection
// ---------------------------------------------------------------------------

async function pickFromList(label, list, hint, keys, defaultName) {
  if (!list?.length) return null;
  if (list.length === 1) return list[0];

  if (hint) {
    const match = pickPersona(list, hint, keys);
    if (match) return match;
  }

  if (defaultName) {
    const match = list.find((p) => p.name === defaultName);
    if (match) return match;
  }

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

export function matchFormByUrl(formPersonas, targetUrl) {
  if (!formPersonas?.length || !targetUrl) return null;
  const lower = targetUrl.toLowerCase();
  for (const fp of formPersonas) {
    for (const u of (fp.urls || [])) {
      if (u && lower.includes(u.toLowerCase())) return fp;
    }
    const orgSlug = (fp.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (orgSlug && lower.includes(orgSlug)) return fp;
  }
  return null;
}

export async function selectFormPersona(formPersonas, targetUrl) {
  if (!formPersonas?.length) return null;

  const autoMatch = matchFormByUrl(formPersonas, targetUrl);
  if (autoMatch) {
    console.log(`  Auto-matched form persona: ${autoMatch.name}`);
    return autoMatch;
  }

  if (formPersonas.length === 1) return formPersonas[0];

  console.log(`\n  Form personas:\n`);
  formPersonas.forEach((f, i) => {
    const org = f.profile?.organization || "";
    console.log(`    ${i + 1}. ${f.name}${org ? ` (${org})` : ""}`);
  });
  console.log(`    ${formPersonas.length + 1}. (none — skip form persona)`);
  const ans = await ask(`\n  Pick form persona [1-${formPersonas.length + 1}]: `);
  const idx = Number(ans) - 1;
  if (idx >= 0 && idx < formPersonas.length) return formPersonas[idx];
  return null;
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
