# fastforms

Fill any form fast. Manage multiple personas locally, pick the right one at fill time.

## Quick start

```bash
# 1. Create your first user + business persona
npx @1dolinski/fastforms init

# 2. Add more personas
npx @1dolinski/fastforms add user
npx @1dolinski/fastforms add business

# 3. Enable remote debugging in Chrome
#    Open chrome://inspect/#remote-debugging and toggle it on

# 4. Fill any form — select which personas to use
npx @1dolinski/fastforms fill https://example.com/apply
```

## How it works

1. **`fastforms init`** walks you through creating user + business personas interactively
2. Personas are saved as individual JSON files in `.fastforms/users/` and `.fastforms/businesses/`
3. **`fastforms fill <url>`** connects to Chrome, lets you pick personas, fills by label matching
4. **Review and submit manually** in Chrome

## Requirements

- Chrome >= 144
- Node.js >= 18

## Commands

| Command | Description |
|---|---|
| `fastforms init` | Create your first user + business persona |
| `fastforms add user` | Add another user persona |
| `fastforms add business` | Add another business persona |
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
| `--web` | Use web app personas instead of local files |
| `--dir <path>` | Custom persona directory path |
| `--port <port>` | Chrome debug port (auto-detected) |

## `.fastforms/` directory

```
.fastforms/
  users/
    chris.json          # A user persona
    work-chris.json     # Another user persona
  businesses/
    apinow.json         # A business persona
    sideproject.json    # Another business persona
  defaults.json         # Remembers your last selection
```

Each user JSON file — just fill in what you have:

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

Each business JSON file:

```json
{
  "name": "APINow.fun",
  "oneLiner": "x402 everything",
  "website": "apinow.fun",
  "problem": "Payments are broken",
  "solution": "Fix them with x402"
}
```

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

1. Add a `buildXxxData(user, biz)` function in `lib/fill.js`
2. Add a URL check in `fillForm()`
3. Test with `node bin/fastforms.js fill <url>`

## License

MIT
