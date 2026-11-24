# AuraTango website and content studio

Run `npm run dev` from this folder. Website: http://127.0.0.1:4173. Dashboard: http://127.0.0.1:4173/backstage. No dependency installation is required. `npm run check` validates JavaScript syntax.

## Supabase activation

Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in `.env.local`. The local preview server generates `/config.js` from these two values. For static hosting, generate the same browser configuration from the host's environment during deployment.

The CMS schema and media bucket have been applied to the connected project. Do not rerun the setup SQL on this project.

1. Open `/backstage` and expand **First-time administrator setup**.
2. Use the reserved email `tech.auratango@gmail.com` and choose a password of at least 12 characters.
3. Submit the form, confirm your email using the Supabase email, then return to the dashboard and sign in. The confirmation may redirect to the default localhost address until production Auth redirect URLs are configured; return to the dashboard after confirmation.
4. The protected database trigger grants administrator access only after that reserved email is confirmed. Other registrations do not receive CMS access.

For a fresh project only, `schema.sql` and `admin-setup.sql` record the applied setup. The admin reservation is consumed after activation. The private reservation table intentionally has no client-facing RLS policies or grants. `node scripts/check-supabase.mjs` verifies public content reads and anonymous access denial for drafts and administrator records.

Drafts use a separate table with administrator-only row-level security. Public visitors read only the published document. Media uploads require administrator membership. Sessions are held in memory; sign in again when expired. Uploaded website images are public.

## Editing

Choose a page and language. Click text, an image or a link to edit it. Hold Alt while clicking to navigate the preview. Brand colours apply site-wide. Revert individual edits or restore published content to your draft. Export a JSON backup from Saved changes. Local preview is temporary and cannot publish.

## Current scope and remaining work

This is the original supplied prototype plus a CMS integration, pending database activation. Text, image URLs/uploads, links, and colours can be edited; page structure and business rules still require code. Edits are keyed to page, language and DOM position; revisit edits after structural code changes. Editing a displayed price does not update a booking tariff.

The prototype's member, studio, booking, payment, contact, attendance, community, inventory and CRM operations remain demonstrations backed by browser state. No money is collected and no enquiry is delivered by these original flows. Prototype labels and noindex are retained. A production launch needs structured business tables, server-authoritative availability and pricing, real member accounts and permissions, payment webhooks, enquiry delivery, and indexable routes. The legacy hash-route previews are distinct from the authenticated `/backstage` CMS and `/dashboard` CRM.

## Source and hosting

Repository: https://github.com/techsyntezja/auratango.git. Static hosts can serve `dist/` over HTTPS. Preserve the source and Supabase schema in Git as well as deployed assets.

## Future discount codes

`dist/discounts.js` configures local package-checkout promotions. All examples are disabled. Rules support percentage or fixed PLN amounts, ISO start/expiry timestamps, class/package/party restrictions, and minimum totals. One code applies per checkout, without stacking; codes are checked again before demo confirmation. This browser-only configuration is for the preview. Production discounts, eligibility and redemption limits must be validated by the payment backend.

## Vercel deployment

Import the repository with Root Directory left at the repository root. The root vercel.json builds and publishes auratango-web/dist. Optional Vercel environment variables SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY connect the CMS; without them the public prototype still loads and the admin shows setup required. Never use a secret/service-role key.

## Staff CRM

- CRM: /dashboard (Backstage was occupied). CMS is at /backstage. /admin and /studio redirect to /backstage.
- Existing Supabase users and cms_admins membership are reused. Teachers retain their CMS access but do not receive CRM access. The CRM server verifies the user and administrator membership on every request; database RPCs independently recheck membership.
- The Vercel function api/crm.mjs holds access and refresh tokens in HttpOnly, SameSite=Strict cookies and rejects cross-origin mutations. No service-role key is used. Dashboard HTML is a sign-in shell; records are returned only after server authorization.
- Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in Vercel (already configured for this project). Local development uses .env.local and node scripts/serve.mjs.
- Database: supabase/crm.sql is the complete fresh-install schema. It has been applied to the connected project. crm-attendance.sql and crm-contact-validation.sql record follow-up upgrades for the existing installation; do not reapply the original create-table script to a populated installation.
- school_crm is a private schema with RLS and no browser table privileges. crm_staff is administrator-only; crm_trial_inquiry is an intentionally public insert-only RPC with input validation, a honeypot, per-contact daily limits, and submission idempotency. Public submission returns only a success flag, never records. Add provider-level bot protection if anonymous spam becomes an issue.
- Submitting the public trial details now creates a real New lead. Preferred dates remain requests: staff book an actual class in CRM. Customer payment screens remain demonstrations; membership purchases are recorded manually and do not charge anyone. No automated email is sent.
- Schedule uses individual dated classes in Warsaw time. No fabricated production classes are seeded. Capacity counts people, not couples; add one roster record per attendee. Class editing, booking, rescheduling, cancellation and attendance are transactional.
- Students are deduplicated by normalized email or phone on conversion. History stays linked through the lead and student. Attendance debits an active membership once; reversing attendance restores that credit. Trial attendance recorded before conversion does not consume a newly purchased membership.
- Verification: node scripts/check.mjs; node scripts/crm-api-test.mjs; node scripts/crm-browser-test.mjs (Windows Edge, isolated mock staff API). Optional --real-intake submits a synthetic inquiry to the configured database; remove that exact test submission after verification. supabase/crm-workflow-test.sql runs database workflow and permission assertions in a rollback transaction.
- Security advisor warnings for definer RPC entry points are intentional: the public endpoint only accepts inquiries; the staff endpoint explicitly checks auth.uid() against cms_admins. Private tables intentionally have no direct-access policies. Existing leaked-password protection is disabled in Supabase Auth; the owner can enable it in Auth settings.

## CRM analytics

/dashboard#analytics uses only the existing administrator-authorised CRM snapshot. Date ranges are inclusive in Warsaw time. Lead conversion and milestone/source figures follow the cohort of inquiries created within the range, measured as of today; stages can be skipped. Trial counts and weighted occupancy follow the class date and exclude cancellations. Attendance/no-show percentages include only recorded outcomes in completed classes; pending outcomes are shown separately. Current membership health is explicitly as of today, independent of the range. Membership records are not revenue. No additional visitor tracking or database permissions are introduced. Test calculations with node scripts/crm-analytics-test.mjs.

## Shared staff sign-in

/dashboard is the single staff login. /backstage automatically reuses the same HttpOnly session; when signed out it redirects to /dashboard?next=backstage and returns to the editor after login. Administrators can switch between CRM and editor; assigned teachers are sent to their editor settings and cannot load CRM records or edit site content. Sign-out clears the shared session. Editor reads/saves go through the role-checked server proxy; image uploads use a signed, single-object upload URL without exposing the staff access token. No password or access token is stored in browser storage. For isolated manual testing run node scripts/shared-login-preview.mjs and use the disposable fixture credentials documented in that script; it never accesses real accounts.
