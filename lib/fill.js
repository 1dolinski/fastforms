import { getCustomFact } from "./personas.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Look up a value from the form persona's facts first, then fall back.
 * Form persona facts override everything — they're form-specific answers.
 */
function formFact(form, key) {
  return getCustomFact(form, key);
}

export async function fillByLabel(page, label, value, opts = {}) {
  if (!value) return false;
  return page.evaluate((lbl, val, ta) => {
    const norm = (s) => s?.toLowerCase().replace(/[*\s]+/g, " ").trim() || "";
    for (const el of document.querySelectorAll("label, h3, h4, p, span, div")) {
      if (!norm(el.textContent).includes(norm(lbl))) continue;
      const parent = el.closest("div[class], section, fieldset") || el.parentElement;
      if (!parent) continue;
      const input = parent.querySelector(
        ta ? "textarea" : 'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea'
      );
      if (!input) continue;
      input.focus();
      const setter = Object.getOwnPropertyDescriptor(
        input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value"
      )?.set;
      if (setter) setter.call(input, val); else input.value = val;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }, label, value, opts.textarea ?? false);
}

export async function clickRadio(page, sectionHint, value) {
  return page.evaluate((hint, val) => {
    for (const el of document.querySelectorAll("label, [role='radio'], button")) {
      if (el.textContent?.trim().toLowerCase() !== val.toLowerCase()) continue;
      const sec = el.closest("section, fieldset, div");
      const heading = sec?.querySelector("h2, h3, h4, label, p");
      if (!heading || heading.textContent?.toLowerCase().includes(hint.toLowerCase())) {
        el.click();
        return true;
      }
    }
    return false;
  }, sectionHint, value);
}

export async function clickCheckbox(page, textHint) {
  return page.evaluate((hint) => {
    for (const el of document.querySelectorAll("label, [role='checkbox'], span, div")) {
      if (el.textContent?.trim().toLowerCase().includes(hint.toLowerCase())) {
        const cb = el.querySelector('input[type="checkbox"]') || el;
        cb.click();
        return true;
      }
    }
    return false;
  }, textHint);
}

export function buildNitroData(user, biz, form) {
  const u = user?.profile || {};
  const b = biz?.profile || {};
  const fact = (p, k) => getCustomFact(p, k);
  const ff = (k) => formFact(form, k);

  return {
    fields: [
      { label: "Company / Project name", value: ff("company") || b.productName || b.companyName || b.name || "" },
      { label: "Email", value: ff("email") || u.email || "" },
      { label: "One-line description", value: ff("one-line") || b.oneLiner || "" },
      { label: "What are you building", value: ff("building") || b.solution || [b.problem, b.solution].filter(Boolean).join("\n\n"), textarea: true },
      { label: "Full Name", value: ff("full name") || u.fullName || "" },
      { label: "Role in the company", value: ff("role") || u.currentRole || "" },
      { label: "X Handle", value: ff("x handle") || fact(user, "x handle") || fact(user, "twitter") || "" },
      { label: "LinkedIn username", value: ff("linkedin") || u.linkedIn || "" },
      { label: "Telegram", value: ff("telegram") || fact(user, "telegram") || "" },
      { label: "GitHub username", value: ff("github") || u.github || "" },
      { label: "Why are you the right founder", value: ff("right founder") || [u.bio, u.keySkills ? `Key skills: ${u.keySkills}` : "", u.favoriteProjects ? `Notable projects: ${u.favoriteProjects}` : ""].filter(Boolean).join("\n\n"), textarea: true },
      { label: "video content or long form writing", value: ff("video") || ff("writing") || u.portfolio || "", textarea: true },
      { label: "How did the founders meet", value: ff("founders meet") || ff("founders met") || fact(user, "founders met") || fact(biz, "founders") || `I'm a solo founder building ${b.productName || b.companyName || "this project"} full-time.`, textarea: true },
      { label: "Current location of founders", value: ff("location") || u.location || b.location || "" },
      { label: "how do you plan to spend", value: ff("spend") || ff("500k") || fact(biz, "spend") || fact(biz, "500k") || "", textarea: true },
      { label: "What problem are you solving", value: ff("problem") || b.problem || "", textarea: true },
      { label: "closest comparables", value: ff("comparables") || ff("competitors") || b.differentiators || "", textarea: true },
      { label: "Product Link", value: ff("product link") || b.website || "" },
      { label: "What changed in the tech or market", value: ff("timing") || ff("why now") || fact(biz, "timing") || fact(biz, "why now") || b.rawFacts || "", textarea: true },
      { label: "Dune Dashboard", value: ff("dune") || "" },
      { label: "Google Analytics", value: ff("analytics") || "", textarea: true },
      { label: "target segment", value: ff("target") || b.targetUsers || "", textarea: true },
      { label: "wedge into the market", value: ff("wedge") || ff("market") || b.businessModel || b.differentiators || "", textarea: true },
      { label: "traction have you achieved", value: ff("traction") || b.traction || "", textarea: true },
      { label: "Runway at current burn", value: ff("runway") || "12" },
      { label: "What attracts you the most about Nitro", value: ff("attracts") || ff("nitro") || fact(biz, "nitro") || fact(biz, "accelerator") || `The density of high-signal founders and the NYC residency. ${b.productName || "Our product"} is at a stage where concentrated feedback from experienced operators would dramatically accelerate our trajectory.`, textarea: true },
      { label: "Pick one of the mentors", value: ff("mentor") || fact(biz, "mentor") || "", textarea: true },
      { label: "What did you get done last week", value: ff("last week") || fact(biz, "last week") || fact(user, "last week") || "", textarea: true },
    ],
    radios: [
      { section: "committed full-time", value: ff("full-time") || "yes" },
      { section: "raised funding before", value: ff("raised funding") || "no" },
      { section: "currently fundraising", value: ff("fundraising") || "yes" },
      { section: "exclusively in Nitro", value: ff("exclusively") || "yes" },
      { section: "attend the full 1-month NYC", value: ff("attend") || "yes" },
    ],
    checkboxes: ["MVP / demo exists"],
  };
}

export async function genericFill(page, user, biz, form) {
  const u = user?.profile || {};
  const b = biz?.profile || {};
  const fact = (p, k) => getCustomFact(p, k);
  const ff = (k) => formFact(form, k);

  const fieldMap = [
    { hints: ["company", "project name", "organization"], value: ff("company") || b.productName || b.companyName || b.name || "" },
    { hints: ["email"], value: ff("email") || u.email || "" },
    { hints: ["full name", "your name", "first name"], value: ff("full name") || u.fullName || "" },
    { hints: ["one-line", "one liner", "tagline", "short description"], value: ff("one-liner") || b.oneLiner || "" },
    { hints: ["what are you building", "describe your product", "about your project"], value: ff("building") || b.solution || "", textarea: true },
    { hints: ["role", "title", "position"], value: ff("role") || u.currentRole || "" },
    { hints: ["x handle", "twitter"], value: ff("x handle") || fact(user, "x handle") || fact(user, "twitter") || "" },
    { hints: ["linkedin"], value: ff("linkedin") || u.linkedIn || "" },
    { hints: ["telegram"], value: ff("telegram") || fact(user, "telegram") || "" },
    { hints: ["github"], value: ff("github") || u.github || "" },
    { hints: ["website", "url", "product link"], value: ff("website") || b.website || u.portfolio || "" },
    { hints: ["phone", "tel"], value: ff("phone") || u.phone || "" },
    { hints: ["location", "city", "where are you based"], value: ff("location") || u.location || b.location || "" },
    { hints: ["bio", "about yourself", "tell us about you"], value: ff("bio") || u.bio || "", textarea: true },
    { hints: ["problem", "what problem"], value: ff("problem") || b.problem || "", textarea: true },
    { hints: ["solution", "how does it work"], value: ff("solution") || b.solution || "", textarea: true },
    { hints: ["traction", "progress", "metrics"], value: ff("traction") || b.traction || "", textarea: true },
    { hints: ["target", "customer", "user"], value: ff("target") || b.targetUsers || "", textarea: true },
    { hints: ["business model", "revenue", "monetiz"], value: ff("business model") || b.businessModel || "", textarea: true },
    { hints: ["differentiator", "competitive", "unique"], value: ff("differentiator") || b.differentiators || "", textarea: true },
    { hints: ["why you", "right founder", "why are you"], value: ff("right founder") || u.bio || "", textarea: true },
  ];

  // Append any form persona facts that don't already map to standard fields
  if (form?.customFacts?.length) {
    const usedKeys = new Set(fieldMap.flatMap((f) => f.hints));
    for (const cf of form.customFacts) {
      if (!cf.enabled || !cf.value) continue;
      const keyLower = cf.key.toLowerCase();
      if ([...usedKeys].some((h) => keyLower.includes(h) || h.includes(keyLower))) continue;
      fieldMap.push({ hints: [cf.key], value: cf.value, textarea: cf.value.length > 100 });
    }
  }

  let filled = 0, skipped = 0;
  for (const f of fieldMap) {
    if (!f.value) { skipped++; continue; }
    for (const hint of f.hints) {
      const ok = await fillByLabel(page, hint, f.value, { textarea: f.textarea });
      if (ok) {
        console.log(`  + "${hint}" = "${f.value.slice(0, 60)}${f.value.length > 60 ? "..." : ""}"`);
        filled++;
        break;
      }
    }
  }
  return { filled, skipped };
}

export async function fillForm(page, formUrl, user, biz, form) {
  console.log(`\n  Filling form...\n`);
  if (form) {
    const fp = form.profile || {};
    if (fp.organization) console.log(`  Form: ${fp.organization}${fp.purpose ? ` — ${fp.purpose}` : ""}`);
  }
  await sleep(2000);

  if (formUrl.includes("nitroacc.xyz")) {
    const data = buildNitroData(user, biz, form);
    let filled = 0, skipped = 0;

    for (const f of data.fields) {
      if (!f.value) { skipped++; continue; }
      const ok = await fillByLabel(page, f.label, f.value, { textarea: f.textarea });
      if (ok) {
        console.log(`  + "${f.label}" = "${f.value.slice(0, 60)}${f.value.length > 60 ? "..." : ""}"`);
        filled++;
      } else {
        console.log(`  x "${f.label}" — no matching input found`);
      }
      await sleep(150);
    }

    for (const r of data.radios) {
      const ok = await clickRadio(page, r.section, r.value);
      console.log(`  ${ok ? "+" : "x"} radio: "${r.section}" = ${r.value}`);
      await sleep(200);
    }

    for (const c of data.checkboxes) {
      const ok = await clickCheckbox(page, c);
      console.log(`  ${ok ? "+" : "x"} checkbox: "${c}"`);
      await sleep(150);
    }

    console.log(`\n  Filled ${filled}, skipped ${skipped} (empty persona fields).`);
  } else {
    const { filled, skipped } = await genericFill(page, user, biz, form);
    console.log(`\n  Filled ${filled}, skipped ${skipped} (empty or no match).`);
  }

  console.log(`\n  FORM NOT SUBMITTED — review in Chrome and submit manually.\n`);
}
