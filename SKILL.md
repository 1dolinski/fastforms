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
- "add a persona", "add another persona"

## What it does

`fastforms` is a CLI tool that:

1. Manages multiple personas locally in `.fastforms/users/` and `.fastforms/businesses/` directories
2. Connects to Chrome via the DevTools Protocol
3. Lets you pick which user + business persona to use at fill time
4. Fills any form using label-matching — never submits

## Quick start

```bash
# 1. Create your first user + business persona
npx @1dolinski/fastforms init

# 2. Add more personas
npx @1dolinski/fastforms add user
npx @1dolinski/fastforms add business

# 3. Enable remote debugging in Chrome
#    Open chrome://inspect/#remote-debugging

# 4. Fill any form — pick from your personas
npx @1dolinski/fastforms fill https://example.com/apply
```

## Commands

### `npx @1dolinski/fastforms init`

Walks through creating a user + business persona. Saves to `.fastforms/users/<name>.json` and `.fastforms/businesses/<name>.json`.

### `npx @1dolinski/fastforms add user|business`

Add another user or business persona. Run as many times as you want.

### `npx @1dolinski/fastforms list`

Show all saved personas.

### `npx @1dolinski/fastforms fill <url>`

Fills any form. If you have multiple personas, prompts you to pick which ones to use.

Options:
- `--user <hint>` — pre-select a user persona by name
- `--business <hint>` — pre-select a business persona by name
- `--web` — use web app personas (https://293-fastforms.vercel.app) instead of local files
- `--dir <path>` — custom path to persona directory
- `--port <port>` — Chrome debug port (auto-detected by default)

### `npx @1dolinski/fastforms edit`

Pick a persona to edit interactively.

### `npx @1dolinski/fastforms remove`

Pick a persona to delete.

### `npx @1dolinski/fastforms personas`

Opens the web persona manager in Chrome.

## Persona sources

1. **Local `.fastforms/` directory** (default) — simple JSON files, no web app needed
2. **Web app** (`--web` flag) — https://293-fastforms.vercel.app/persona manages personas in localStorage, CLI reads via CDP

## How it works

1. Reads all personas from `.fastforms/users/` and `.fastforms/businesses/`
2. If multiple, prompts you to pick which user + business persona to use
3. Auto-discovers Chrome's debug port from `DevToolsActivePort`
4. Opens (or reuses) the target form URL tab
5. Fills using label-matching heuristics. Has site-specific mappings for known forms.
6. Shows what was filled, what was skipped. **Never submits.**

## Agent instructions

When the user asks you to fill a form:

1. Check if `.fastforms/` exists. If not, run `npx @1dolinski/fastforms init`
2. Run `npx @1dolinski/fastforms fill <the-url>`
3. If Chrome debugging isn't enabled, tell the user to open `chrome://inspect/#remote-debugging`
4. After filling, tell the user to review in Chrome and submit manually

When the user wants to add a persona:

1. Run `npx @1dolinski/fastforms add user` or `npx @1dolinski/fastforms add business`

When the user wants to see their personas:

1. Run `npx @1dolinski/fastforms list`
