# fastforms

Fill any form fast. Manage personas locally, fill forms from your terminal.

## Quick start

```bash
# 1. Create your personas
npx fastforms init

# 2. Enable remote debugging in Chrome
#    Open chrome://inspect/#remote-debugging and toggle it on

# 3. Fill any form (never submits)
npx fastforms fill https://example.com/apply
```

## How it works

1. **`fastforms init`** walks you through creating user + business personas interactively
2. Personas are saved as simple JSON in `.fastforms/user.json` and `.fastforms/business.json`
3. **`fastforms fill <url>`** connects to Chrome, opens the form, fills it by label matching
4. **Review and submit manually** in Chrome

## Requirements

- Chrome >= 144
- Node.js >= 18

## Commands

| Command | Description |
|---|---|
| `fastforms init` | Create personas interactively |
| `fastforms fill <url>` | Fill any form |
| `fastforms edit` | Update existing personas |
| `fastforms personas` | Open web persona manager in Chrome |

### Fill options

| Option | Description |
|---|---|
| `--web` | Use web app personas instead of local files |
| `--dir <path>` | Custom persona directory path |
| `--port <port>` | Chrome debug port (auto-detected) |
| `--user <hint>` | User persona hint (web mode) |
| `--business <hint>` | Business persona hint (web mode) |

## `.fastforms/` directory

```
.fastforms/
  user.json           # Your user persona
  business.json       # Your business persona
  dumps/              # Optional: raw text context files
```

`user.json` — just fill in what you have:

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

`business.json`:

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
