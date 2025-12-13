# How to apply SQL migrations (Supabase)

You have SQL migration files in `supabase/sql/` (for example `2025-11-28_create_payments_table.sql`). To apply these you can:

Option 1 — Use the Supabase Dashboard (easy)
1. Open your Supabase project.
2. Go to the SQL editor.
3. Copy the contents of the SQL file and run it. This is safe because the SQL in this repo is idempotent (uses IF NOT EXISTS).

Option 2 — Use the Supabase CLI
1. Ensure supabase CLI is installed and you're logged in.
2. Run the SQL file using the CLI (example):

```powershell
# Run from the repo root
supabase db query --project-ref <PROJECT_REF> --file supabase/sql/2025-11-28_create_payments_table.sql
```

Note: CLI syntax can vary across versions — if your CLI doesn't support `db query` you can paste into the SQL editor instead or use `psql` connected to your database.

Option 3 — psql (advanced)
1. Get a connection string or host/port from the Supabase dashboard.
2. Use `psql` to apply the file:

```powershell
psql "postgresql://<user>:<pass>@<host>:5432/<db>?sslmode=require" -f supabase/sql/2025-11-28_create_payments_table.sql
```

After running migrations, validate the `payments` table exists:
```sql
SELECT * FROM public.payments LIMIT 5;
```
