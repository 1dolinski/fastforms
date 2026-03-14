# fastforms

Fill any form fast. Manage multiple personas locally, pick the right ones at fill time.

## Quick start

```bash
# 1. Create your first user + business persona
npx @1dolinski/fastforms init

# 2. Or import from Twitter (requires PRIVATE_KEY for x402 payment)
npx @1dolinski/fastforms import twitter <your-handle>

# 3. Enable remote debugging in Chrome
#    Open chrome://inspect/#remote-debugging and toggle it on

# 4. Fill any form — select which personas to use
npx @1dolinski/fastforms fill https://example.com/apply
```

## How it works

1. **`fastforms init`** walks you through creating user + business personas interactively
2. **`fastforms import twitter`** pulls your profile from Twitter via x402 micropayment
3. **`fastforms add form`** captures the form's org, purpose, and form-specific answers
4. Personas are saved as individual JSON files in `.fastforms/`
5. **`fastforms fill <url>`** connects to Chrome, picks personas, fills by label matching
6. **Review and submit manually** in Chrome

## Requirements

- Chrome >= 144
- Node.js >= 18
- (Optional) `PRIVATE_KEY` env var for Twitter import — Base network wallet with USDC

## Persona types

| Type | What it captures | Example |
|---|---|---|
| **User** | Who you are | Name, email, role, GitHub, bio |
| **Business** | What you're building | Company, product, traction, one-liner |
| **Form** | Who's asking & why | Org, purpose, form-specific answers |

Form persona facts **override** user/business data. Form-specific questions like "why this accelerator" belong on the form persona, not your user persona.

## Commands

| Command | Description |
|---|---|
| `fastforms init` | Create your first user + business persona |
| `fastforms import twitter <handle>` | Import user persona from Twitter via x402 |
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
    jane.json
    work-jane.json
  businesses/
    acme-labs.json
    side-project.json
  forms/
    yc-application.json
    grant-proposal.json
  defaults.json
```

### User persona (`users/jane.json`)

```json
{
  "name": "jane",
  "fullName": "Jane Smith",
  "email": "jane@example.com",
  "role": "Founder & CEO",
  "location": "San Francisco, CA",
  "linkedIn": "linkedin.com/in/janesmith",
  "github": "github.com/janesmith",
  "bio": "Building developer tools. Previously at Stripe.",
  "facts": {
    "x handle": "@janesmith",
    "telegram": "@jane"
  }
}
```

### Business persona (`businesses/acme-labs.json`)

```json
{
  "name": "Acme Labs",
  "oneLiner": "AI-powered form automation",
  "website": "acmelabs.dev",
  "problem": "Filling out repetitive applications wastes hours",
  "solution": "Smart persona-based form filling"
}
```

### Form persona (`forms/yc-application.json`)

```json
{
  "name": "YC Application",
  "urls": ["apply.ycombinator.com"],
  "organization": "Y Combinator",
  "purpose": "Startup accelerator application",
  "notes": "3-month program in SF, $500k investment",
  "deadline": "2026-04-01",
  "facts": {
    "why this accelerator": "The alumni network and partner expertise in developer tools",
    "spend": "Engineering hires and go-to-market",
    "last week": "Launched beta, onboarded 50 users, 30% week-over-week growth"
  }
}
```

The `facts` on a form persona are form-specific answers keyed by label hints. They override user/business data when a form field matches.

## Twitter import (x402)

Pull your Twitter profile into a user persona with a single command. Uses the [x402 protocol](https://x402.org/) for pay-per-call access ($0.01 USDC on Base).

```bash
# Set your Base wallet private key
export PRIVATE_KEY=0x...

# Import your Twitter profile
npx @1dolinski/fastforms import twitter janesmith
```

This creates `users/janesmith.json` pre-filled with your name, bio, location, and handle from Twitter. You can then `fastforms edit` to add more details.

Requires a Base network wallet with USDC. Powered by [APINow.fun](https://apinow.fun).

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
