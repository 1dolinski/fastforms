# fastforms

Fill any form fast. Manage multiple personas locally, pick the right ones at fill time.

## Quick start

```bash
# 1. Create your first user + business persona
npx @1dolinski/fastforms init

# 2. Add a form persona (org context + form-specific answers)
npx @1dolinski/fastforms add form

# 3. Enable remote debugging in Chrome
#    Open chrome://inspect/#remote-debugging and toggle it on

# 4. Fill any form — select which personas to use
npx @1dolinski/fastforms fill https://example.com/apply
```

## How it works

1. **`fastforms init`** walks you through creating user + business personas interactively
2. **`fastforms add form`** captures the form's org, purpose, and form-specific answers
3. Personas are saved as individual JSON files in `.fastforms/`
4. **`fastforms fill <url>`** connects to Chrome, picks personas, fills by label matching
5. Form personas auto-match by URL — no need to specify which one
6. **Review and submit manually** in Chrome

## Requirements

- Chrome >= 144
- Node.js >= 18

## Persona types

| Type | What it captures | Example |
|---|---|---|
| **User** | Who you are | Name, email, role, GitHub, bio |
| **Business** | What you're building | Company, product, traction, one-liner |
| **Form** | Who's asking & why | Org, purpose, form-specific answers |

Form persona facts **override** user/business data. "What attracts you to Nitro" belongs on the Nitro form persona, not on your user persona.

## Commands

| Command | Description |
|---|---|
| `fastforms init` | Create your first user + business persona |
| `fastforms add user` | Add another user persona |
| `fastforms add business` | Add another business persona |
| `fastforms add form` | Add a form persona (org + answers) |
| `fastforms list` | Show all saved personas |
| `fastforms fill <url>` | Fill any form (pick from personas) |
| `fastforms edit` | Edit an existing persona |
| `fastforms remove` | Remove a persona |
| `fastforms personas` | Open web persona manager in Chrome |

### Fill options

| Option | Description |
|---|---|
| `--user <hint>` | Pre-select user persona by name |
| `--business <hint>` | Pre-select business persona by name |
| `--form <hint>` | Pre-select form persona by name |
| `--web` | Use web app personas instead of local files |
| `--dir <path>` | Custom persona directory path |
| `--port <port>` | Chrome debug port (auto-detected) |

## `.fastforms/` directory

```
.fastforms/
  users/
    chris.json
    work-chris.json
  businesses/
    apinow.json
    sideproject.json
  forms/
    nitro-accelerator.json
    yc-application.json
  defaults.json
```

### User persona (`users/chris.json`)

```json
{
  "name": "chris",
  "fullName": "Chris Dolinski",
  "email": "chris@example.com",
  "role": "Founder",
  "location": "Toronto, ON",
  "linkedIn": "linkedin.com/in/1dolinski",
  "github": "github.com/1dolinski",
  "bio": "Serial entrepreneur",
  "facts": {
    "x handle": "@1dolinski",
    "telegram": "@chris"
  }
}
```

### Business persona (`businesses/apinow.json`)

```json
{
  "name": "APINow.fun",
  "oneLiner": "x402 everything",
  "website": "apinow.fun",
  "problem": "Payments are broken",
  "solution": "Fix them with x402"
}
```

### Form persona (`forms/nitro-accelerator.json`)

```json
{
  "name": "Nitro Accelerator",
  "urls": ["nitroacc.xyz"],
  "organization": "Nitro",
  "purpose": "Crypto accelerator application for early-stage founders",
  "notes": "NYC-based, 1-month residency",
  "deadline": "2026-04-01",
  "facts": {
    "attracts": "The density of high-signal founders and the NYC residency",
    "mentor": "Vitalik — his work on public goods aligns with our mission",
    "spend": "Engineering hires and infrastructure for mainnet launch",
    "last week": "Shipped v2 of the API, onboarded 3 beta customers"
  }
}
```

The `facts` on a form persona are form-specific answers keyed by label hints. They override user/business data when a form field matches.

## Web app (optional)

You can also manage personas in the web UI at [293-fastforms.vercel.app/persona](https://293-fastforms.vercel.app/persona) and use `--web` flag to pull from there. The web app has an "Export for CLI" button to download your personas as local JSON files.

## Contributing

PRs welcome. To develop locally:

```bash
git clone https://github.com/1dolinski/fastforms.git
cd fastforms
npm install
node bin/fastforms.js init
node bin/fastforms.js fill https://example.com/apply
```

### Adding a new form mapping

1. Add a `buildXxxData(user, biz, form)` function in `lib/fill.js`
2. Add a URL check in `fillForm()`
3. Test with `node bin/fastforms.js fill <url>`

## License

MIT
