Overview — Partnership / Billboard flow

This document lists the DB changes, policies, and frontend integration steps to make the `Billboards` page behave like the Shopr "partnership" flow.

Goals:
- Allow partner users to create and manage billboard listings (Create button shows only for partners).
- Maintain public safety: listings should be approved before visible publicly (configurable).
- Use RLS policies so only partners can create billboards and only owners or admins can update listings.

Migration file:
- supabase/sql/2025-12-01_add_partnership_and_rls.sql — adds `partnership_enabled`, `partnership_verified` to `profiles`; ensures `billboards`, `billboard_photos`, `billboard_bookings`, `billboard_requests` tables exist; and installs example RLS policies.

How to apply (Supabase dashboard):
1) Open your Supabase project → SQL editor.
2) Create a new query and paste the contents of `supabase/sql/2025-12-01_add_partnership_and_rls.sql` and run it.
3) Check that columns were added to `profiles` and indexes/tables/policies were created.

Frontend checks (what we changed):
- `app/(tabs)/Billboards.tsx` — now queries `profiles` for `partnership_enabled` and `partnership_verified` and shows a "Create listing" CTA in the Partner Shortcut when enabled. The CTA navigates the user to `/partners` where the partner desk form already exists.

Optional / recommended next improvements (you can ask me to implement any of these):
- Auto-approve listings for verified partners in `app/partners/index.tsx` (set `is_approved = true` on insert when `partnership_verified` is true).
- Add a dedicated `partner_settings` table or admin interface so partnership flags can be controlled off-platform (manual verification, invoices, KYC, etc.).
- Add cloud functions or Postgres triggers to generate audit logs and notify partnerships team when new listings are submitted.
- Add more granular RLS rules (for service role, admin roles or explicit group membership checks).

Security note:
- The RLS policy examples check `public.profiles.partnership_enabled` or `role` contains `Partnership` — adapt to your auth claims if you use custom JWT claims for roles.

Testing checklist (simple):
- Non-partner user should NOT see Create listing button.
- Partner user (set `partnership_enabled = true` in DB) should see Create listing button and be able to submit a listing via `/partners`.
- Verify row-level policies by trying to insert a billboard with a non-partner user's JWT (it should fail).

If you'd like, I can:
- Wire `is_approved` auto-approval for verified partners.
- Add an admin/partnership management UI under `/partners/manage` to approve partners and listings.
- Add more UI polish to `app/(tabs)/Billboards.tsx` to show a partner's own listings inline on the page.

Tell me which next step you want me to take and I will implement it.
