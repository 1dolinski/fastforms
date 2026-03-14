#!/usr/bin/env node

import { createInterface } from "readline";
import { join } from "path";
import { homedir } from "os";
import { existsSync, readFileSync } from "fs";

import { ensureChromeReady } from "../lib/chrome.js";
import {
  connectToChrome,
  pullPersonas,
  selectPersonas,
  selectFormPersona,
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
  saveFormPersona,
  deletePersonaFile,
  listPersonaFiles,
  loadDefaults,
  saveDefaults,
  userTemplate,
  businessTemplate,
  formTemplate,
} from "../lib/local.js";

// Load .env files for PRIVATE_KEY (used by x402 twitter import)
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const match = line.match(/^\s*([\w]+)\s*=\s*(.+?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}
loadEnvFile(join(process.cwd(), ".fastforms", ".env"));
loadEnvFile(join(process.cwd(), ".env"));

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
    fastforms init                        Create your first user + business persona
    fastforms import twitter <handle>     Import user persona from Twitter (x402)
    fastforms add user|business|form      Add another persona
    fastforms list                        List all personas
    fastforms edit                        Edit an existing persona
    fastforms remove                      Remove a persona
    fastforms fill <url>                  Fill a form (pick personas interactively)
    fastforms personas                    Open web persona manager in Chrome

  Options:
    --web               Use web app personas instead of local .fastforms/
    --dir <path>        Path to .fastforms/ directory (default: auto-detect)
    --user <hint>       User persona name/hint to pre-select
    --business <hint>   Business persona name/hint to pre-select
    --form <hint>       Form persona name/hint to pre-select
    --port <port>       Chrome debug port (auto-detected by default)

  Persona types:
    user      — who you are (name, email, bio, skills)
    business  — what you're building (company, product, traction)
    form      — who's asking and why (org, purpose, form-specific answers)

  Twitter import:
    Requires PRIVATE_KEY env var (Base wallet with USDC, $0.01/call).
    Set in .env, .fastforms/.env, or export directly.

  Quick start:
    1. npx @1dolinski/fastforms init
    2. npx @1dolinski/fastforms add form
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

async function promptForm(existing) {
  const ep = existing?.profile || {};
  const f = formTemplate();

  const show = (val) => val ? ` [${String(val).slice(0, 40)}]` : "";

  f.name = await ask(`  Form name (e.g. "Nitro Accelerator")${show(existing?.name)}: `, existing?.name || "");
  f.organization = await ask(`  Organization${show(ep.organization)}: `, ep.organization || "");
  f.purpose = await ask(`  Purpose (e.g. "crypto accelerator application")${show(ep.purpose)}: `, ep.purpose || "");

  const existingUrls = existing?.urls || [];
  if (existingUrls.length) {
    console.log(`\n  Current URLs: ${existingUrls.join(", ")}`);
  }
  console.log("\n  Add URL patterns this form matches (press Enter to finish):\n");
  f.urls = [...existingUrls];
  while (true) {
    const url = await ask("  url: ");
    if (!url) break;
    if (!f.urls.includes(url)) f.urls.push(url);
  }

  f.notes = await ask(`  Notes / context${show(ep.notes)}: `, ep.notes || "");
  f.deadline = await ask(`  Deadline${show(ep.deadline)}: `, ep.deadline || "");
  f.requirements = await ask(`  Requirements${show(ep.requirements)}: `, ep.requirements || "");

  const existingFacts = {};
  for (const cf of (existing?.customFacts || [])) {
    if (cf.enabled !== false && cf.key) existingFacts[cf.key] = cf.value;
  }
  f.facts = { ...existingFacts };

  if (Object.keys(f.facts).length) {
    console.log("\n  Current form-specific answers:");
    for (const [k, v] of Object.entries(f.facts)) console.log(`    ${k} = ${v}`);
  }
  console.log("\n  Add form-specific answers (label hint = answer). Press Enter to finish.");
  console.log("  These override user/business data for matching fields.\n");
  while (true) {
    const raw = await ask("  answer: ");
    if (!raw) break;
    const eq = raw.indexOf("=");
    if (eq === -1) { console.log("    Use format: field hint = answer"); continue; }
    f.facts[raw.slice(0, eq).trim()] = raw.slice(eq + 1).trim();
  }

  return f;
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
      console.log("  Use 'fastforms add user|business|form' to add more.\n");
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

  const addForm = await ask("\n  Add a form persona now? (org + purpose + form-specific answers) [y/N]: ");
  if (addForm.toLowerCase() === "y") {
    console.log("\n  --- Form persona ---\n");
    const form = await promptForm();
    const formSlug = saveFormPersona(dir, form);
    console.log(`\n  Saved forms/${formSlug}.json`);
  }

  console.log(`\n  Personas saved to ${dir}/`);
  console.log("  Tip: add form-specific context with 'fastforms add form'");
  console.log("  Next: npx @1dolinski/fastforms fill <url>\n");
  closeRL();
}

// ---------------------------------------------------------------------------
// add — add a single persona
// ---------------------------------------------------------------------------

async function addPersona() {
  const type = args[1];
  if (type !== "user" && type !== "business" && type !== "form") {
    console.error("  Usage: fastforms add user|business|form\n");
    process.exit(1);
  }

  const dir = resolveDir();
  ensureDir(dir);

  if (type === "user") {
    console.log("\n  --- New user persona ---\n");
    const user = await promptUser();
    const slug = saveUserPersona(dir, user);
    console.log(`\n  Saved users/${slug}.json to ${dir}/\n`);
  } else if (type === "business") {
    console.log("\n  --- New business persona ---\n");
    const biz = await promptBusiness();
    const slug = saveBusinessPersona(dir, biz);
    console.log(`\n  Saved businesses/${slug}.json to ${dir}/\n`);
  } else {
    console.log("\n  --- New form persona ---\n");
    const form = await promptForm();
    const slug = saveFormPersona(dir, form);
    console.log(`\n  Saved forms/${slug}.json to ${dir}/\n`);
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
  const forms = listPersonaFiles(dir, "form");

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

  if (forms.length) {
    console.log("  Form personas:");
    for (const f of forms) {
      const urls = f.data?.urls?.length ? ` [${f.data.urls.join(", ")}]` : "";
      const purpose = f.data?.purpose ? ` — ${f.data.purpose}` : "";
      const facts = f.data?.facts ? Object.keys(f.data.facts).length : 0;
      console.log(`    ${f.slug}${urls}${purpose}${facts ? ` (${facts} answers)` : ""}`);
    }
  } else {
    console.log("  No form personas. Run: fastforms add form");
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
  const forms = listPersonaFiles(dir, "form");
  const all = [
    ...users.map((u) => ({ ...u, type: "user", label: `user: ${u.slug} (${u.data?.fullName || u.data?.name || "?"})` })),
    ...businesses.map((b) => ({ ...b, type: "business", label: `biz: ${b.slug} (${b.data?.name || "?"})` })),
    ...forms.map((f) => ({ ...f, type: "form", label: `form: ${f.slug} (${f.data?.organization || f.data?.name || "?"})` })),
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
  } else if (picked.type === "business") {
    const existing = dump.businessPersonas.find((p) => p.name === picked.data?.name) || null;
    console.log(`\n  --- Edit business: ${picked.slug} ---\n`);
    const updated = await promptBusiness(existing);
    if (updated.name !== picked.data?.name) deletePersonaFile(dir, "business", picked.slug);
    const slug = saveBusinessPersona(dir, updated);
    console.log(`\n  Updated businesses/${slug}.json\n`);
  } else {
    const existing = (dump.formPersonas || []).find((p) => p.name === picked.data?.name) || null;
    console.log(`\n  --- Edit form: ${picked.slug} ---\n`);
    const updated = await promptForm(existing);
    if (updated.name !== picked.data?.name) deletePersonaFile(dir, "form", picked.slug);
    const slug = saveFormPersona(dir, updated);
    console.log(`\n  Updated forms/${slug}.json\n`);
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
  const forms = listPersonaFiles(dir, "form");
  const all = [
    ...users.map((u) => ({ ...u, type: "user", label: `user: ${u.slug} (${u.data?.fullName || u.data?.name || "?"})` })),
    ...businesses.map((b) => ({ ...b, type: "business", label: `biz: ${b.slug} (${b.data?.name || "?"})` })),
    ...forms.map((f) => ({ ...f, type: "form", label: `form: ${f.slug} (${f.data?.name || "?"})` })),
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
    const dirName = picked.type === "user" ? "users" : picked.type === "business" ? "businesses" : "forms";
    console.log(`  Removed ${dirName}/${picked.slug}.json\n`);
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
  const formPersonas = dump.formPersonas || [];
  const counts = [
    `${personas.length} user`,
    `${bizPersonas.length} business`,
    `${formPersonas.length} form`,
  ].join(", ");
  console.log(`  Found ${counts} persona(s).`);

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
  const formHint = flag("--form");
  const { user, biz } = await selectPersonas(dump, userHint, bizHint);

  // Form persona: auto-match by URL, then hint, then interactive
  let form = null;
  if (formPersonas.length) {
    if (formHint) {
      form = formPersonas.find((f) =>
        f.name.toLowerCase().includes(formHint.toLowerCase())
      ) || null;
    }
    if (!form) {
      form = await selectFormPersona(formPersonas, formUrl);
    }
  }

  if (!user && !biz) {
    console.error("\n  No matching personas.");
    browser.disconnect();
    process.exit(1);
  }

  showPersonaDetails(user, biz, form);

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

  await fillForm(page, formUrl, user, biz, form);

  if (hasFlag("--web")) {
    await offerSetDefaults(user, biz);
  } else {
    const dir = findFastformsDir();
    if (dir) {
      const patch = {};
      if (user) patch.defaultUser = user.name;
      if (biz) patch.defaultBusiness = biz.name;
      if (form) patch.defaultForm = form.name;
      saveDefaults(dir, patch);
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
// import — pull persona from external source
// ---------------------------------------------------------------------------

async function importPersona() {
  const source = args[1];
  const handle = args[2];

  if (source !== "twitter" || !handle) {
    console.error("  Usage: fastforms import twitter <handle>\n");
    console.error("  Requires PRIVATE_KEY env var (Base wallet with USDC).");
    console.error("  Set in .env, .fastforms/.env, or: export PRIVATE_KEY=0x...\n");
    process.exit(1);
  }

  console.log(`\n  fastforms import — Twitter → user persona\n`);

  let fetchTwitterProfile, twitterToPersona;
  try {
    ({ fetchTwitterProfile, twitterToPersona } = await import("../lib/x402.js"));
  } catch (e) {
    console.error("  Failed to load x402 module:", e.message);
    console.error("\n  Make sure dependencies are installed:");
    console.error("    npm install viem @x402/fetch @x402/evm\n");
    process.exit(1);
  }

  const data = await fetchTwitterProfile(handle);
  const persona = twitterToPersona(data, handle);

  console.log(`\n  Twitter profile for @${handle}:`);
  if (persona.fullName) console.log(`    Name: ${persona.fullName}`);
  if (persona.bio) console.log(`    Bio: ${persona.bio.slice(0, 80)}${persona.bio.length > 80 ? "..." : ""}`);
  if (persona.location) console.log(`    Location: ${persona.location}`);
  if (persona.portfolio) console.log(`    Website: ${persona.portfolio}`);
  const factCount = Object.keys(persona.facts || {}).length;
  if (factCount) console.log(`    Facts: ${factCount}`);

  const dir = resolveDir();
  ensureDir(dir);
  const slug = saveUserPersona(dir, persona);
  console.log(`\n  Saved to ${dir}/users/${slug}.json`);
  console.log("  Run 'fastforms edit' to add email, role, and other details.\n");
  closeRL();
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

switch (command) {
  case "init":
    init().catch((e) => { console.error(e.message); process.exit(1); });
    break;
  case "import":
    importPersona().catch((e) => { console.error(e.message); process.exit(1); });
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
