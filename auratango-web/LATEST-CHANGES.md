# Latest website changes — deployment notes

The website now includes the reviewed layout changes, separate Anna/Rick finder cards, hidden AuraTouch discovery, booking choice resets without full-form reloads, inline private/event calendars, top Back controls, clearer payment cards/totals, private checkout countdowns, guest/sign-in choice after checkout, and profile photo uploads.

## Checks

19 regression scripts and `scripts/check.mjs` passed before this push. See `scripts/*-test.mjs` for individual coverage. Payment screens remain previews; no payment provider has been added.

## Live setup still required

- **Email sign-in:** the new `api/member.mjs` endpoint uses the existing Supabase environment variables and separate customer cookies. Configure real SMTP delivery and both signup/magic-link email templates with `{{ .Token }}` before offering public verification codes. Full instructions are in `MEMBER-SIGNIN.md`. No live email settings were changed by this work.
- **Single-use/private discounts:** these were tested through the isolated local preview service in `scripts/shared-login-preview.mjs` and `scripts/discount-preview-engine.mjs`. Live Supabase discount scope constraints and redemption functions have not been migrated. Live checkout cannot complete a code redemption until the backend is implemented; it fails with an explicit configuration error instead of treating a reusable code as single-use. Tie redemption to verified payment success in the eventual payment integration, with atomic use limits and retry idempotency. Do not expose the local fixture endpoint as a production payment service.
- **Customer records:** purchases/history and resized profile photos remain browser-based previews. Email sign-in does not add server-side customer purchase or photo storage.

## Local review

Run `node scripts/shared-login-preview.mjs` from this directory and visit http://127.0.0.1:4189/.
Staff fixture: staff@example.invalid / demo-only. Customer test verification code: 123456. No email or real payment is sent by the fixture. Local discount test records are saved under `tmp/`, which is deliberately excluded from this commit.
