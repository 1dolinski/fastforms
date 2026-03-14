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
  deletePersonaFile,
  listPersonaFiles,
  loadDefaults,
  saveDefaults,
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

function resolveDir() {
  const dirArg = flag("--dir");
  return dirArg || findFastformsDir() || join(process.cwd(), ".fastforms");
}

function help() {
  console.log(`
  fastforms — Fill any form fast, with multiple personas.

  Usage:
    fastforms init                  Create your first user + business persona
    fastforms add user              Add another user persona
    fastforms add business          Add another business persona
    fastforms list                  List all personas
    fastforms edit                  Edit an existing persona
    fastforms remove                Remove a persona
    fastforms fill <url>            Fill a form (pick personas interactively)
    fastforms personas              Open web persona manager in Chrome
    fastforms                       Show this help

  Options:
    --web               Use web app personas instead of local .fastforms/
    --dir <path>        Path to .fastforms/ directory (default: auto-detect)
    --user <hint>       User persona name/hint to pre-select
    --business <hint>   Business persona name/hint to pre-select
    --port <port>       Chrome debug port (auto-detected by default)

  Quick start:
    1. npx @1dolinski/fastforms init
    2. npx @1dolinski/fastforms add user          # add more personas
    3. Enable remote debugging: chrome://inspect/#remote-debugging
    4. npx @1dolinski/fastforms fill https://example.com/apply
`);
}

// ---------------------------------------------------------------------------
// Shared persona builder prompts
// ---------------------------------------------------------------------------

async function promptUser(existing) {
  const ep = existing?.profile || {};
  const u = userTemplate();

  const show = (val) => val ? ` [${String(val).slice(0, 40)}]` : "";

  u.name = await ask(`  Name (identifier)${show(existing?.name)}: `, existing?.name || "");
  u.fullName = await ask(`  Full name${show(ep.fullName)}: `, ep.fullName || "");
  u.email = await ask(`  Email${show(ep.email)}: `, ep.email || "");
  u.role = await ask(`  Role / title${show(ep.currentRole)}: `, ep.currentRole || "");
  u.location = await ask(`  Location${show(ep.location)}: `, ep.location || "");
  u.linkedIn = await ask(`  LinkedIn${show(ep.linkedIn)}: `, ep.linkedIn || "");
  u.github = await ask(`  GitHub${show(ep.github)}: `, ep.github || "");
  u.bio = await ask(`  Short bio${show(ep.bio)}: `, ep.bio || "");

  const existingFacts = {};
  for (const f of (existing?.customFacts || [])) {
    if (f.enabled !== false && f.key) existingFacts[f.key] = f.value;
  }
  u.facts = { ...existingFacts };

  if (Object.keys(u.facts).length) {
    console.log("\n  Current facts:");
    for (const [k, v] of Object.entries(u.facts)) console.log(`    ${k} = ${v}`);
  }
  console.log("\n  Add custom facts (key = value). Press Enter to finish.\n");
  while (true) {
    const raw = await ask("  fact: ");
    if (!raw) break;
    const eq = raw.indexOf("=");
    if (eq === -1) { console.log("    Use format: key = value"); continue; }
    u.facts[raw.slice(0, eq).trim()] = raw.slice(eq + 1).trim();
  }

  return u;
}

async function promptBusiness(existing) {
  const bp = existing?.profile || {};
  const b = businessTemplate();

  const show = (val) => val ? ` [${String(val).slice(0, 40)}]` : "";

  b.name = await ask(`  Company / project name${show(existing?.name)}: `, existing?.name || "");
  b.oneLiner = await ask(`  One-liner${show(bp.oneLiner)}: `, bp.oneLiner || "");
  b.website = await ask(`  Website${show(bp.website)}: `, bp.website || "");
  b.category = await ask(`  Category${show(bp.category)}: `, bp.category || "");
  b.location = await ask(`  Location${show(bp.location)}: `, bp.location || "");
  b.problem = await ask(`  Problem you're solving${show(bp.problem)}: `, bp.problem || "");
  b.solution = await ask(`  Your solution${show(bp.solution)}: `, bp.solution || "");
  b.targetUsers = await ask(`  Target users${show(bp.targetUsers)}: `, bp.targetUsers || "");
  b.traction = await ask(`  Traction${show(bp.traction)}: `, bp.traction || "");
  b.businessModel = await ask(`  Business model${show(bp.businessModel)}: `, bp.businessModel || "");
  b.differentiators = await ask(`  Differentiators${show(bp.differentiators)}: `, bp.differentiators || "");

  const existingFacts = {};
  for (const f of (existing?.customFacts || [])) {
    if (f.enabled !== false && f.key) existingFacts[f.key] = f.value;
  }
  b.facts = { ...existingFacts };

  if (Object.keys(b.facts).length) {
    console.log("\n  Current facts:");
    for (const [k, v] of Object.entries(b.facts)) console.log(`    ${k} = ${v}`);
  }
  console.log("\n  Add business facts (key = value). Press Enter to finish.\n");
  while (true) {
    const raw = await ask("  fact: ");
    if (!raw) break;
    const eq = raw.indexOf("=");
    if (eq === -1) { console.log("    Use format: key = value"); continue; }
    b.facts[raw.slice(0, eq).trim()] = raw.slice(eq + 1).trim();
  }

  return b;
}

// ---------------------------------------------------------------------------
// init — first-time setup: one user + one business
// ---------------------------------------------------------------------------

async function init() {
  const dir = resolveDir();

  console.log("\n  fastforms — Let's set up your personas.\n");

  const existingUsers = existsSync(join(dir, "users")) ? listPersonaFiles(dir, "user") : [];
  if (existingUsers.length) {
    const ans = await ask(`  ${existingUsers.length} persona(s) already exist. Add another? [Y/n]: `);
    if (ans.toLowerCase() === "n") {
      console.log("  Use 'fastforms add user' or 'fastforms add business' to add more.\n");
      closeRL();
      return;
    }
  }

  console.log("  --- User persona ---\n");
  const user = await promptUser();
  ensureDir(dir);
  const userSlug = saveUserPersona(dir, user);
  console.log(`\n  Saved users/${userSlug}.json`);

  console.log("\n  --- Business persona ---\n");
  const biz = await promptBusiness();
  const bizSlug = saveBusinessPersona(dir, biz);
  console.log(`\n  Saved businesses/${bizSlug}.json`);

  console.log(`\n  Personas saved to ${dir}/`);
  console.log("  Next: npx @1dolinski/fastforms fill <url>\n");
  closeRL();
}

// ---------------------------------------------------------------------------
// add — add a single persona
// ---------------------------------------------------------------------------

async function addPersona() {
  const type = args[1];
  if (type !== "user" && type !== "business") {
    console.error("  Usage: fastforms add user|business\n");
    process.exit(1);
  }

  const dir = resolveDir();
  ensureDir(dir);

  if (type === "user") {
    console.log("\n  --- New user persona ---\n");
    const user = await promptUser();
    const slug = saveUserPersona(dir, user);
    console.log(`\n  Saved users/${slug}.json to ${dir}/\n`);
  } else {
    console.log("\n  --- New business persona ---\n");
    const biz = await promptBusiness();
    const slug = saveBusinessPersona(dir, biz);
    console.log(`\n  Saved businesses/${slug}.json to ${dir}/\n`);
  }
  closeRL();
}

// ---------------------------------------------------------------------------
// list — show all personas
// ---------------------------------------------------------------------------

function listAll() {
  const dir = findFastformsDir();
  if (!dir) {
    console.error("  No .fastforms/ directory found. Run 'fastforms init' first.\n");
    process.exit(1);
  }

  const defaults = loadDefaults(dir);

  const users = listPersonaFiles(dir, "user");
  const businesses = listPersonaFiles(dir, "business");

  console.log(`\n  Personas in ${dir}/\n`);

  if (users.length) {
    console.log("  User personas:");
    for (const u of users) {
      const def = defaults.defaultUser === (u.data?.name || u.slug) ? " (default)" : "";
      console.log(`    ${u.slug}${def} — ${u.data?.fullName || u.data?.name || "?"} <${u.data?.email || "?"}>`);
    }
  } else {
    console.log("  No user personas. Run: fastforms add user");
  }

  console.log();

  if (businesses.length) {
    console.log("  Business personas:");
    for (const b of businesses) {
      const def = defaults.defaultBusiness === (b.data?.name || b.slug) ? " (default)" : "";
      console.log(`    ${b.slug}${def} — ${b.data?.name || "?"}: ${b.data?.oneLiner || ""}`);
    }
  } else {
    console.log("  No business personas. Run: fastforms add business");
  }

  console.log();
}

// ---------------------------------------------------------------------------
// edit — pick a persona and edit it
// ---------------------------------------------------------------------------

async function edit() {
  const dir = findFastformsDir();
  if (!dir) {
    console.error("  No .fastforms/ directory found. Run 'fastforms init' first.\n");
    process.exit(1);
  }

  const users = listPersonaFiles(dir, "user");
  const businesses = listPersonaFiles(dir, "business");
  const all = [
    ...users.map((u) => ({ ...u, type: "user", label: `user: ${u.slug} (${u.data?.fullName || u.data?.name || "?"})` })),
    ...businesses.map((b) => ({ ...b, type: "business", label: `biz: ${b.slug} (${b.data?.name || "?"})` })),
  ];

  if (!all.length) {
    console.error("  No personas found. Run 'fastforms init' first.\n");
    process.exit(1);
  }

  console.log("\n  Which persona to edit?\n");
  all.forEach((p, i) => console.log(`    ${i + 1}. ${p.label}`));
  const ans = await ask(`\n  Pick [1-${all.length}]: `);
  const idx = Number(ans) - 1;
  if (idx < 0 || idx >= all.length) { console.log("  Invalid selection.\n"); closeRL(); return; }

  const picked = all[idx];
  const dump = loadLocalPersonas(dir);

  if (picked.type === "user") {
    const existing = dump.personas.find((p) => p.name === picked.data?.name) || null;
    console.log(`\n  --- Edit user: ${picked.slug} ---\n`);
    const updated = await promptUser(existing);
    if (updated.name !== picked.data?.name) deletePersonaFile(dir, "user", picked.slug);
    const slug = saveUserPersona(dir, updated);
    console.log(`\n  Updated users/${slug}.json\n`);
  } else {
    const existing = dump.businessPersonas.find((p) => p.name === picked.data?.name) || null;
    console.log(`\n  --- Edit business: ${picked.slug} ---\n`);
    const updated = await promptBusiness(existing);
    if (updated.name !== picked.data?.name) deletePersonaFile(dir, "business", picked.slug);
    const slug = saveBusinessPersona(dir, updated);
    console.log(`\n  Updated businesses/${slug}.json\n`);
  }
  closeRL();
}

// ---------------------------------------------------------------------------
// remove — delete a persona
// ---------------------------------------------------------------------------

async function remove() {
  const dir = findFastformsDir();
  if (!dir) {
    console.error("  No .fastforms/ directory found.\n");
    process.exit(1);
  }

  const users = listPersonaFiles(dir, "user");
  const businesses = listPersonaFiles(dir, "business");
  const all = [
    ...users.map((u) => ({ ...u, type: "user", label: `user: ${u.slug} (${u.data?.fullName || u.data?.name || "?"})` })),
    ...businesses.map((b) => ({ ...b, type: "business", label: `biz: ${b.slug} (${b.data?.name || "?"})` })),
  ];

  if (!all.length) {
    console.error("  No personas to remove.\n");
    process.exit(1);
  }

  console.log("\n  Which persona to remove?\n");
  all.forEach((p, i) => console.log(`    ${i + 1}. ${p.label}`));
  const ans = await ask(`\n  Pick [1-${all.length}]: `);
  const idx = Number(ans) - 1;
  if (idx < 0 || idx >= all.length) { console.log("  Invalid selection.\n"); closeRL(); return; }

  const picked = all[idx];
  const confirm = await ask(`  Delete ${picked.type}/${picked.slug}? [y/N]: `);
  if (confirm.toLowerCase() === "y") {
    deletePersonaFile(dir, picked.type, picked.slug);
    console.log(`  Removed ${picked.type}s/${picked.slug}.json\n`);
  } else {
    console.log("  Cancelled.\n");
  }
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
    console.log("  Pulling personas from web app...");
    browser = await connectToChrome(port);
    dump = await pullPersonas(browser);
  } else {
    const dir = findFastformsDir();

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
  } else {
    // Save defaults to local dir
    const dir = findFastformsDir();
    if (dir && user && biz) {
      saveDefaults(dir, { defaultUser: user.name, defaultBusiness: biz.name });
    }
  }

  browser.disconnect();
  closeRL();
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
  case "add":
    addPersona().catch((e) => { console.error(e.message); process.exit(1); });
    break;
  case "list":
    listAll();
    break;
  case "edit":
    edit().catch((e) => { console.error(e.message); process.exit(1); });
    break;
  case "remove":
    remove().catch((e) => { console.error(e.message); process.exit(1); });
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
