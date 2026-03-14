#!/usr/bin/env node

import { createInterface } from "readline";
import { join } from "path";
import { homedir } from "os";
import { existsSync } from "fs";

import { ensureChromeReady } from "../lib/chrome.js";
import {
  connectToChrome,
  pullPersonas,
  selectPersonas,
  showPersonaDetails,
  offerSetDefaults,
  offerOpenPersonaManager,
} from "../lib/personas.js";
import { fillForm } from "../lib/fill.js";
import {
  findFastformsDir,
  ensureDir,
  loadLocalPersonas,
  saveUserPersona,
  saveBusinessPersona,
  userTemplate,
  businessTemplate,
} from "../lib/local.js";

const args = process.argv.slice(2);
const command = args[0];

function flag(name) {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : "";
}

function hasFlag(name) {
  return args.includes(name);
}

const explicitPort = flag("--port") ? Number(flag("--port")) : null;

let _rl = null;
function getRL() {
  if (!_rl) _rl = createInterface({ input: process.stdin, output: process.stdout });
  return _rl;
}
function closeRL() {
  if (_rl) { _rl.close(); _rl = null; }
}

function ask(prompt, fallback = "") {
  return new Promise((r) => getRL().question(prompt, (a) => r(a.trim() || fallback)));
}

function help() {
  console.log(`
  fastforms — Fill any form fast.

  Usage:
    fastforms init                  Set up your personas interactively
    fastforms fill <url>            Fill a form with your personas
    fastforms edit                  Edit your existing personas
    fastforms personas              Open web persona manager in Chrome
    fastforms                       Show this help

  Options:
    --web               Use web app personas instead of local .fastforms/
    --dir <path>        Path to .fastforms/ directory (default: auto-detect)
    --user <hint>       User persona name/hint (web mode)
    --business <hint>   Business persona name/hint (web mode)
    --port <port>       Chrome debug port (auto-detected by default)

  Quick start:
    1. npx fastforms init
    2. Enable remote debugging: chrome://inspect/#remote-debugging
    3. npx fastforms fill https://example.com/apply
`);
}

// ---------------------------------------------------------------------------
// init — conversational persona builder
// ---------------------------------------------------------------------------

async function init() {
  const dirArg = flag("--dir");
  const dir = dirArg || join(process.cwd(), ".fastforms");

  console.log("\n  fastforms — Let's set up your personas.\n");

  if (existsSync(join(dir, "user.json"))) {
    const ans = await ask("  .fastforms/ already exists. Overwrite? [y/N]: ");
    if (ans.toLowerCase() !== "y") {
      console.log("  Use 'fastforms edit' to update existing personas.\n");
      return;
    }
  }

  // --- User persona ---
  console.log("  --- User persona ---\n");
  const user = userTemplate();

  user.name = await ask("  Name (identifier): ");
  user.fullName = await ask("  Full name: ");
  user.email = await ask("  Email: ");
  user.role = await ask("  Role / title: ");
  user.location = await ask("  Location: ");
  user.linkedIn = await ask("  LinkedIn (optional): ");
  user.github = await ask("  GitHub (optional): ");
  user.bio = await ask("  Short bio (optional): ");

  // Custom facts
  console.log("\n  Add custom facts (e.g. 'x handle = @1dolinski'). Press Enter to skip.\n");
  while (true) {
    const raw = await ask("  fact: ");
    if (!raw) break;
    const eq = raw.indexOf("=");
    if (eq === -1) {
      console.log("    Use format: key = value");
      continue;
    }
    const key = raw.slice(0, eq).trim();
    const value = raw.slice(eq + 1).trim();
    if (key) user.facts[key] = value;
  }

  // --- Business persona ---
  console.log("\n  --- Business persona ---\n");
  const biz = businessTemplate();

  biz.name = await ask("  Company / project name: ");
  biz.oneLiner = await ask("  One-liner: ");
  biz.website = await ask("  Website (optional): ");
  biz.category = await ask("  Category (optional): ");
  biz.location = await ask("  Location (optional): ");
  biz.problem = await ask("  Problem you're solving (optional): ");
  biz.solution = await ask("  Your solution (optional): ");
  biz.targetUsers = await ask("  Target users (optional): ");
  biz.traction = await ask("  Traction (optional): ");
  biz.businessModel = await ask("  Business model (optional): ");
  biz.differentiators = await ask("  Differentiators (optional): ");

  console.log("\n  Add business facts. Press Enter to skip.\n");
  while (true) {
    const raw = await ask("  fact: ");
    if (!raw) break;
    const eq = raw.indexOf("=");
    if (eq === -1) {
      console.log("    Use format: key = value");
      continue;
    }
    const key = raw.slice(0, eq).trim();
    const value = raw.slice(eq + 1).trim();
    if (key) biz.facts[key] = value;
  }

  // Save
  ensureDir(dir);
  saveUserPersona(dir, user);
  saveBusinessPersona(dir, biz);

  console.log(`\n  Saved to ${dir}/`);
  console.log("    user.json");
  console.log("    business.json");
  console.log("\n  Next: npx fastforms fill <url>\n");
  closeRL();
}

// ---------------------------------------------------------------------------
// edit — re-run init with pre-filled values
// ---------------------------------------------------------------------------

async function edit() {
  const dirArg = flag("--dir");
  const dir = dirArg || findFastformsDir();

  if (!dir) {
    console.error("  No .fastforms/ directory found. Run 'fastforms init' first.\n");
    process.exit(1);
  }

  const dump = loadLocalPersonas(dir);
  const existing = dump.personas[0];
  const existingBiz = dump.businessPersonas[0];

  console.log("\n  fastforms — Edit your personas. Press Enter to keep current value.\n");

  // --- User ---
  console.log("  --- User persona ---\n");
  const ep = existing?.profile || {};
  const user = userTemplate();

  user.name = await ask(`  Name [${existing?.name || ""}]: `, existing?.name || "");
  user.fullName = await ask(`  Full name [${ep.fullName || ""}]: `, ep.fullName || "");
  user.email = await ask(`  Email [${ep.email || ""}]: `, ep.email || "");
  user.role = await ask(`  Role [${ep.currentRole || ""}]: `, ep.currentRole || "");
  user.location = await ask(`  Location [${ep.location || ""}]: `, ep.location || "");
  user.linkedIn = await ask(`  LinkedIn [${ep.linkedIn || ""}]: `, ep.linkedIn || "");
  user.github = await ask(`  GitHub [${ep.github || ""}]: `, ep.github || "");
  user.bio = await ask(`  Bio [${ep.bio ? ep.bio.slice(0, 40) + "..." : ""}]: `, ep.bio || "");

  // Carry over existing facts
  const existingFacts = {};
  for (const f of (existing?.customFacts || [])) {
    if (f.enabled !== false) existingFacts[f.key] = f.value;
  }
  user.facts = { ...existingFacts };

  if (Object.keys(user.facts).length) {
    console.log("\n  Current facts:");
    for (const [k, v] of Object.entries(user.facts)) {
      console.log(`    ${k} = ${v}`);
    }
  }
  console.log("\n  Add/update facts (Enter to finish):\n");
  while (true) {
    const raw = await ask("  fact: ");
    if (!raw) break;
    const eq = raw.indexOf("=");
    if (eq === -1) { console.log("    Use format: key = value"); continue; }
    user.facts[raw.slice(0, eq).trim()] = raw.slice(eq + 1).trim();
  }

  // --- Business ---
  console.log("\n  --- Business persona ---\n");
  const bp = existingBiz?.profile || {};
  const biz = businessTemplate();

  biz.name = await ask(`  Company [${existingBiz?.name || ""}]: `, existingBiz?.name || "");
  biz.oneLiner = await ask(`  One-liner [${bp.oneLiner || ""}]: `, bp.oneLiner || "");
  biz.website = await ask(`  Website [${bp.website || ""}]: `, bp.website || "");
  biz.category = await ask(`  Category [${bp.category || ""}]: `, bp.category || "");
  biz.location = await ask(`  Location [${bp.location || ""}]: `, bp.location || "");
  biz.problem = await ask(`  Problem [${bp.problem ? bp.problem.slice(0, 40) + "..." : ""}]: `, bp.problem || "");
  biz.solution = await ask(`  Solution [${bp.solution ? bp.solution.slice(0, 40) + "..." : ""}]: `, bp.solution || "");
  biz.targetUsers = await ask(`  Target users [${bp.targetUsers ? bp.targetUsers.slice(0, 40) + "..." : ""}]: `, bp.targetUsers || "");
  biz.traction = await ask(`  Traction [${bp.traction ? bp.traction.slice(0, 40) + "..." : ""}]: `, bp.traction || "");
  biz.businessModel = await ask(`  Business model [${bp.businessModel ? bp.businessModel.slice(0, 40) + "..." : ""}]: `, bp.businessModel || "");
  biz.differentiators = await ask(`  Differentiators [${bp.differentiators ? bp.differentiators.slice(0, 40) + "..." : ""}]: `, bp.differentiators || "");

  const existingBizFacts = {};
  for (const f of (existingBiz?.customFacts || [])) {
    if (f.enabled !== false) existingBizFacts[f.key] = f.value;
  }
  biz.facts = { ...existingBizFacts };

  if (Object.keys(biz.facts).length) {
    console.log("\n  Current facts:");
    for (const [k, v] of Object.entries(biz.facts)) {
      console.log(`    ${k} = ${v}`);
    }
  }
  console.log("\n  Add/update facts (Enter to finish):\n");
  while (true) {
    const raw = await ask("  fact: ");
    if (!raw) break;
    const eq = raw.indexOf("=");
    if (eq === -1) { console.log("    Use format: key = value"); continue; }
    biz.facts[raw.slice(0, eq).trim()] = raw.slice(eq + 1).trim();
  }

  saveUserPersona(dir, user);
  saveBusinessPersona(dir, biz);
  console.log(`\n  Updated ${dir}/\n`);
  closeRL();
}

// ---------------------------------------------------------------------------
// fill — the main event
// ---------------------------------------------------------------------------

async function fill() {
  const formUrl = args.find((a) => a.startsWith("http"));
  if (!formUrl) {
    console.error("  Usage: fastforms fill <url>\n");
    process.exit(1);
  }

  console.log(`\n  fastforms fill — NO SUBMIT\n`);
  console.log(`  Target: ${formUrl}\n`);

  const port = await ensureChromeReady(explicitPort);
  console.log(`  Connected to Chrome on port ${port}.`);

  let dump;
  let browser;

  if (hasFlag("--web")) {
    // Web app mode
    console.log("  Pulling personas from web app...");
    browser = await connectToChrome(port);
    dump = await pullPersonas(browser);
  } else {
    // Local mode (default)
    const dirArg = flag("--dir");
    const dir = dirArg || findFastformsDir();

    if (!dir) {
      console.error("  No .fastforms/ directory found.");
      console.error("  Run 'fastforms init' to create one, or use --web for web app mode.\n");
      process.exit(1);
    }

    console.log(`  Loading personas from ${dir}/`);
    dump = loadLocalPersonas(dir);
    browser = await connectToChrome(port);
  }

  const personas = dump.personas || [];
  const bizPersonas = dump.businessPersonas || [];
  console.log(`  Found ${personas.length} user persona(s), ${bizPersonas.length} business persona(s).`);

  if (!personas.length && !bizPersonas.length) {
    console.error("\n  No personas found.");
    if (hasFlag("--web")) {
      await offerOpenPersonaManager(browser);
    } else {
      console.error("  Run 'fastforms init' to create personas.\n");
    }
    browser.disconnect();
    process.exit(1);
  }

  const userHint = flag("--user");
  const bizHint = flag("--business");
  const { user, biz } = await selectPersonas(dump, userHint, bizHint);

  if (!user && !biz) {
    console.error("\n  No matching personas.");
    browser.disconnect();
    process.exit(1);
  }

  showPersonaDetails(user, biz);

  const pages = await browser.pages();
  const host = new URL(formUrl).host;
  let page = pages.find((p) => p.url().includes(host));

  if (page) {
    console.log(`\n  Using existing tab for ${host}`);
    await page.bringToFront();
  } else {
    page = await browser.newPage();
    await page.goto(formUrl, { waitUntil: "networkidle2", timeout: 45_000 });
    console.log(`\n  Opened ${formUrl}`);
  }

  await fillForm(page, formUrl, user, biz);

  if (hasFlag("--web")) {
    await offerSetDefaults(user, biz);
  }

  browser.disconnect();
}

// ---------------------------------------------------------------------------
// personas — open web manager
// ---------------------------------------------------------------------------

async function openPersonas() {
  const port = await ensureChromeReady(explicitPort);
  const browser = await connectToChrome(port);
  const pages = await browser.pages();
  const existing = pages.find((p) => p.url().includes("293-fastforms.vercel.app/persona"));
  if (existing) {
    await existing.bringToFront();
    console.log("  Focused existing persona manager tab.");
  } else {
    const tab = await browser.newPage();
    await tab.goto("https://293-fastforms.vercel.app/persona", { waitUntil: "networkidle2", timeout: 30_000 });
    console.log("  Opened https://293-fastforms.vercel.app/persona");
  }
  browser.disconnect();
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

switch (command) {
  case "init":
    init().catch((e) => { console.error(e.message); process.exit(1); });
    break;
  case "edit":
    edit().catch((e) => { console.error(e.message); process.exit(1); });
    break;
  case "fill":
    fill().catch((e) => { console.error(e.message); process.exit(1); });
    break;
  case "personas":
    openPersonas().catch((e) => { console.error(e.message); process.exit(1); });
    break;
  default:
    help();
}
