# Login, credentials, and cross-device sync

> **Currently off in the app:** `SUPABASE_INTEGRATION_DISABLED = true` in `src/lib/cloud/cloudConfig.ts`, and cloud wiring is commented in `main.tsx` / `App.tsx` (search `SUPABASE`). The product uses **localStorage only** until you flip those back.

Fety stores financial data in the browser (`localStorage`) by default. To use the **same budget on phone, tablet, and desktop**, enable **Supabase Auth** and the `fety_user_stores` table.

## What ships in the app

| Layer | Location |
|--------|----------|
| Auth UI | Splash **Log in** / **Create account & set up** |
| Session | `@supabase/supabase-js` (persisted refresh token in the browser) |
| Sync | `useCloudStoreSync` — pull on login, debounced push after edits |
| Data shape | Full `FetyStore` JSON (version 1), same migrations as local |

Without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, login forms explain that only **local setup** is available.

## Setup (about 15 minutes)

1. Create a [Supabase](https://supabase.com) project.
2. **Authentication → Providers → Email** — enable email/password (and confirm email if you want).
3. **SQL Editor** — run `supabase/schema.sql` from this repo (table + RLS).
4. **Project Settings → API** — copy Project URL and **anon public** key.
5. In the repo root, create `.env.local`:

```bash
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```

6. Restart the dev server and rebuild for production so Vite picks up `VITE_*` vars.

## User flows

- **New user:** Splash → Create account (email/password) → onboarding → data pushes to cloud after setup completes.
- **Returning user:** Log in → cloud store downloads → dashboard (skips splash if already onboarded).
- **Local only:** “Set up locally (no account)” — unchanged behavior.

## Security notes

- The **anon key** is public in the client; **RLS** restricts each user to their own `fety_user_stores` row.
- Do **not** put service-role keys in the frontend.
- Passwords are handled by Supabase Auth (hashed server-side).
- Sync sends the full store JSON over HTTPS — treat Supabase as your data processor and enable MFA on the Supabase org for production.

## Limitations (v1)

- **Last-write-wins** per device (no merge冲突 UI yet).
- **No offline queue** beyond localStorage; edits sync when online.
- Chat messages and planner state sync with the blob if present in `FetyStore`.
- Email confirmation depends on your Supabase auth settings.

## Next steps (backlog)

- Conflict resolution UI when `updated_at` diverges
- Encrypt sensitive fields client-side (optional)
- OAuth (Apple / Google)
- Per-device names and session management
- Migrate from JSON blob to normalized tables if you outgrow single-blob sync
