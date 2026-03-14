import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";

export function findFastformsDir() {
  const local = join(process.cwd(), ".fastforms");
  if (existsSync(local)) return local;

  const global = join(homedir(), ".fastforms");
  if (existsSync(global)) return global;

  return null;
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, "utf-8")); } catch { return null; }
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "default";
}

// ---------------------------------------------------------------------------
// Normalize flat local format → shape fill.js expects:
//   { name, profile: { ...fields }, customFacts: [...] }
// ---------------------------------------------------------------------------

function normalizeUser(raw) {
  if (!raw) return null;
  const { name, facts, ...rest } = raw;
  return {
    name: name || "default",
    profile: {
      fullName: rest.fullName || "",
      email: rest.email || "",
      phone: rest.phone || "",
      location: rest.location || "",
      linkedIn: rest.linkedIn || "",
      github: rest.github || "",
      portfolio: rest.portfolio || "",
      currentRole: rest.role || rest.currentRole || "",
      bio: rest.bio || "",
      keySkills: rest.keySkills || "",
      favoriteProjects: rest.favoriteProjects || "",
      rawFacts: rest.rawFacts || "",
    },
    customFacts: factsToArray(facts),
    customPreferences: [],
    dumps: [],
  };
}

function normalizeBusiness(raw) {
  if (!raw) return null;
  const { name, facts, ...rest } = raw;
  return {
    name: name || "default business",
    profile: {
      name: name || "",
      companyName: rest.companyName || rest.company || name || "",
      productName: rest.productName || rest.product || name || "",
      website: rest.website || "",
      category: rest.category || "",
      location: rest.location || "",
      oneLiner: rest.oneLiner || "",
      targetUsers: rest.targetUsers || "",
      problem: rest.problem || "",
      solution: rest.solution || "",
      traction: rest.traction || "",
      businessModel: rest.businessModel || "",
      differentiators: rest.differentiators || "",
      value: rest.value || "",
      rawFacts: rest.rawFacts || "",
    },
    customFacts: factsToArray(facts),
    customPreferences: [],
    dumps: [],
  };
}

function factsToArray(facts) {
  if (!facts || typeof facts !== "object") return [];
  return Object.entries(facts).map(([key, value], i) => ({
    id: `fact-${i}`,
    key,
    value: String(value),
    enabled: true,
  }));
}

// ---------------------------------------------------------------------------
// Multi-persona loading: reads users/ and businesses/ subdirs.
// Falls back to legacy user.json / business.json for backward compat.
// ---------------------------------------------------------------------------

function loadDir(dir, normalizer) {
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  return files.map((f) => normalizer(readJson(join(dir, f)))).filter(Boolean);
}

export function loadLocalPersonas(dir) {
  const usersDir = join(dir, "users");
  const bizDir = join(dir, "businesses");

  let personas = loadDir(usersDir, normalizeUser);
  let businessPersonas = loadDir(bizDir, normalizeBusiness);

  // Backward compat: if subdirs are empty, check legacy single files
  if (!personas.length) {
    const legacy = readJson(join(dir, "user.json"));
    if (legacy) personas = [normalizeUser(legacy)];
  }
  if (!businessPersonas.length) {
    const legacy = readJson(join(dir, "business.json"));
    if (legacy) businessPersonas = [normalizeBusiness(legacy)];
  }

  return { personas, businessPersonas };
}

// ---------------------------------------------------------------------------
// Save personas into named files under users/ or businesses/
// ---------------------------------------------------------------------------

export function saveUserPersona(dir, data) {
  const subdir = ensureDir(join(dir, "users"));
  const slug = slugify(data.name || "default");
  writeJson(join(subdir, `${slug}.json`), data);
  return slug;
}

export function saveBusinessPersona(dir, data) {
  const subdir = ensureDir(join(dir, "businesses"));
  const slug = slugify(data.name || "default");
  writeJson(join(subdir, `${slug}.json`), data);
  return slug;
}

export function deletePersonaFile(dir, type, slug) {
  const subdir = type === "user" ? "users" : "businesses";
  const path = join(dir, subdir, `${slug}.json`);
  if (existsSync(path)) unlinkSync(path);
}

// ---------------------------------------------------------------------------
// List raw persona files (for edit/delete commands)
// ---------------------------------------------------------------------------

export function listPersonaFiles(dir, type) {
  const subdir = join(dir, type === "user" ? "users" : "businesses");
  if (!existsSync(subdir)) return [];
  return readdirSync(subdir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const data = readJson(join(subdir, f));
      return { slug: basename(f, ".json"), file: f, data };
    });
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export function loadDefaults(dir) {
  return readJson(join(dir, "defaults.json")) || {};
}

export function saveDefaults(dir, patch) {
  const current = loadDefaults(dir);
  writeJson(join(dir, "defaults.json"), { ...current, ...patch });
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export function userTemplate() {
  return {
    name: "",
    fullName: "",
    email: "",
    role: "",
    location: "",
    linkedIn: "",
    github: "",
    bio: "",
    facts: {},
  };
}

export function businessTemplate() {
  return {
    name: "",
    oneLiner: "",
    website: "",
    category: "",
    location: "",
    problem: "",
    solution: "",
    targetUsers: "",
    traction: "",
    businessModel: "",
    differentiators: "",
    facts: {},
  };
}
