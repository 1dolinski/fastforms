import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
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

/**
 * Normalize flat local format into the shape fill.js expects:
 *   { name, profile: { ...fields }, customFacts: [...] }
 */
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

export function loadLocalPersonas(dir) {
  const userPath = join(dir, "user.json");
  const bizPath = join(dir, "business.json");

  const rawUser = readJson(userPath);
  const rawBiz = readJson(bizPath);

  const personas = rawUser ? [normalizeUser(rawUser)] : [];
  const businessPersonas = rawBiz ? [normalizeBusiness(rawBiz)] : [];

  return { personas, businessPersonas };
}

export function saveUserPersona(dir, data) {
  ensureDir(dir);
  writeJson(join(dir, "user.json"), data);
}

export function saveBusinessPersona(dir, data) {
  ensureDir(dir);
  writeJson(join(dir, "business.json"), data);
}

export function loadDefaults(dir) {
  return readJson(join(dir, "defaults.json")) || {};
}

export function saveDefaults(dir, patch) {
  const current = loadDefaults(dir);
  writeJson(join(dir, "defaults.json"), { ...current, ...patch });
}

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
