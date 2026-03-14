# fastforms

Fill any form fast using your personas.

## Triggers

Use this skill when the user says any of:
- "fill a form", "fill out this form", "fill out this application"
- "apply to X", "submit my info to X"
- "autofill form", "autofill with my persona"
- "fill this form with my persona"
- "use fastforms", "fastforms fill"
- "set up my personas", "init fastforms"

## What it does

`fastforms` is a CLI tool that:

1. Manages personas locally in a `.fastforms/` directory (simple JSON files)
2. Connects to Chrome via the DevTools Protocol
3. Fills any form using label-matching — never submits

## Quick start

```bash
# 1. Create your personas interactively
npx fastforms init

# 2. Enable remote debugging in Chrome
#    Open chrome://inspect/#remote-debugging

# 3. Fill any form
npx fastforms fill https://example.com/apply
```

## Commands

### `npx fastforms init`

Conversational persona builder. Walks through user + business persona fields, saves to `.fastforms/user.json` and `.fastforms/business.json`.

### `npx fastforms fill <url>`

Fills any form. Reads personas from local `.fastforms/` directory by default.

Options:
- `--web` — use web app personas (https://293-fastforms.vercel.app) instead of local files
- `--dir <path>` — custom path to persona directory
- `--port <port>` — Chrome debug port (auto-detected by default)

### `npx fastforms edit`

Re-run the persona builder with current values pre-filled.

### `npx fastforms personas`

Opens the web persona manager in Chrome.

## Persona sources

1. **Local `.fastforms/` directory** (default) — simple JSON files, no web app needed
2. **Web app** (`--web` flag) — https://293-fastforms.vercel.app/persona manages personas in localStorage, CLI reads via CDP

## How it works

1. Reads personas from `.fastforms/user.json` and `.fastforms/business.json`
2. Auto-discovers Chrome's debug port from `DevToolsActivePort`
3. Opens (or reuses) the target form URL tab
4. Fills using label-matching heuristics. Has site-specific mappings for known forms.
5. Shows what was filled, what was skipped. **Never submits.**

## Agent instructions

When the user asks you to fill a form:

1. Check if `.fastforms/` exists. If not, run `npx fastforms init`
2. Run `npx fastforms fill <the-url>`
3. If Chrome debugging isn't enabled, tell the user to open `chrome://inspect/#remote-debugging`
4. After filling, tell the user to review in Chrome and submit manually
