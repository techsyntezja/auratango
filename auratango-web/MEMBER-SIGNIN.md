# Customer sign-in (local changes, not deployed)

The account icon opens an email-code sign-in form. Requesting a code creates an account when needed; verifying the code confirms email ownership and opens the member area. Member and staff sessions use separate HttpOnly cookies. The member API cannot read CRM records.

## Local preview

Run `node scripts/shared-login-preview.mjs`, then open http://127.0.0.1:4189/#/login. Enter an example email and use the clearly labelled test code **123456**. This server simulates Auth in memory and sends no email. Restarting it clears test sessions. The simulation is not used by the deployed API.

## Before enabling real email delivery

1. Configure Supabase Email Auth and a production SMTP sender. Do not use the default testing mail sender for public registrations.
2. In both the **Confirm signup** and **Magic Link** email templates, include `{{ .Token }}` so first-time and returning users receive a code. Suggested body: `<h2>Your AuraTango sign-in code</h2><p>{{ .Token }}</p><p>Enter this code on the AuraTango sign-in page. If you did not request it, ignore this email.</p>`.
3. Set a short OTP expiry (for example 10 minutes) and retain Supabase request/verification rate limits. The UI waits 60 seconds between resends; provider limits are enforced on the server.
4. Deploy `api/member.mjs` alongside the website with existing `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` environment variables. No service-role key is needed.
5. Verify real delivery, wrong/expired/reused codes, refresh, sign-out, and the staff access restrictions with a dedicated test address before release.

No hosted Supabase settings or database schema were changed for this local feature. Purchases, requests, passes and bookings remain browser-based preview records, filtered by verified email when displayed; this does not add cross-device customer storage or real payments.

Reference: https://supabase.com/docs/guides/auth/auth-email-passwordless
