# AuraTango website and content studio

Run `npm run dev` from this folder. Website: http://127.0.0.1:4173. Dashboard: http://127.0.0.1:4173/admin.html. No dependency installation is required. `npm run check` validates JavaScript syntax.

## Supabase activation

Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in `.env.local`. The local preview server generates `/config.js` from these two values. For static hosting, generate the same browser configuration from the host's environment during deployment.

The CMS schema and media bucket have been applied to the connected project. Do not rerun the setup SQL on this project.

1. Open `/admin.html` and expand **First-time administrator setup**.
2. Use the reserved email `tech.auratango@gmail.com` and choose a password of at least 12 characters.
3. Submit the form, confirm your email using the Supabase email, then return to the dashboard and sign in. The confirmation may redirect to the default localhost address until production Auth redirect URLs are configured; return to the dashboard after confirmation.
4. The protected database trigger grants administrator access only after that reserved email is confirmed. Other registrations do not receive CMS access.

For a fresh project only, `schema.sql` and `admin-setup.sql` record the applied setup. The admin reservation is consumed after activation. The private reservation table intentionally has no client-facing RLS policies or grants. `node scripts/check-supabase.mjs` verifies public content reads and anonymous access denial for drafts and administrator records.

Drafts use a separate table with administrator-only row-level security. Public visitors read only the published document. Media uploads require administrator membership. Sessions are held in memory; sign in again when expired. Uploaded website images are public.

## Editing

Choose a page and language. Click text, an image or a link to edit it. Hold Alt while clicking to navigate the preview. Brand colours apply site-wide. Revert individual edits or restore published content to your draft. Export a JSON backup from Saved changes. Local preview is temporary and cannot publish.

## Current scope and remaining work

This is the original supplied prototype plus a CMS integration, pending database activation. Text, image URLs/uploads, links, and colours can be edited; page structure and business rules still require code. Edits are keyed to page, language and DOM position; revisit edits after structural code changes. Editing a displayed price does not update a booking tariff.

The prototype's member, studio, booking, payment, contact, attendance, community, inventory and CRM operations remain demonstrations backed by browser state. No money is collected and no enquiry is delivered by these original flows. Prototype labels and noindex are retained. A production launch needs structured business tables, server-authoritative availability and pricing, real member accounts and permissions, payment webhooks, enquiry delivery, and indexable routes. The existing `/studio` preview is distinct from the secure `/admin.html` CMS.

## Source and hosting

User repository: https://github.com/techauratango-tech/auratango.git. A clone was attempted; inspect the existing repository before merging or pushing. This working folder is separate to preserve unknown repository contents. Static hosts can serve `dist/` over HTTPS. Preserve the source and Supabase schema in Git as well as deployed assets.
