# Secure AI auto-listing: setup

Everything secret lives in Supabase. The static site only holds the public URL and anon key.

## 1. Database setup

The existing StreamCloud production database already has the listings and admin-control tables. **Do not rerun the migrations on that production project.**

For a **new** Supabase project, open SQL Editor and run these repository files in order:
1. `supabase/migrations/20261022000000_listings.sql`
2. `supabase/migrations/20261022170000_streamcloud_admin_control.sql`

The existing production database's migration history was created through a managed/dashboard workflow and is not fully mirrored by the repository's CLI migration filenames. Avoid running `supabase db push` against that production project until its migration history is reconciled.

## 2. Set server-side API secrets (never commit these)

Set only the provider keys you actually use. These remain in Supabase Edge Function secrets; no provider secret belongs in public JavaScript.
```bash
supabase secrets set \
  GEMINI_API_KEY='YOUR_PRIVATE_GEMINI_KEY' \
  OPENAI_API_KEY='YOUR_PRIVATE_OPENAI_API_KEY' \
  OPENAI_MODEL='gpt-4.1-mini' \
  GROQ_API_KEY='YOUR_PRIVATE_GROQ_KEY' \
  GROQ_MODEL='openai/gpt-oss-120b' \
  OMDB_API_KEY='YOUR_PRIVATE_OMDB_KEY' \
  ALLOWED_ORIGINS='https://mahimahfud-ui.github.io,https://streamcloud.ai.studio,https://streamcloud-527d.onrender.com'
# Optional if you need authenticated GitHub release lookups:
# GITHUB_TOKEN='YOUR_PRIVATE_GITHUB_TOKEN'
# Optional model override:
# GEMINI_MODEL='gemini-2.5-flash'
```

## 3. Initialize the admin PIN privately

The PIN is stored only as a bcrypt hash in the private Supabase database. Do not put the PIN or a PIN hash in GitHub.
If setting up a fresh database, run this once in the Supabase SQL Editor and replace the placeholder privately:
```sql
select public.admin_update_pin('YOUR_PRIVATE_PIN');
```
The existing project database already has the requested initial PIN. Login returns a random, revocable eight-hour session token; the browser keeps it in sessionStorage and every admin request is checked server-side against its token hash. Login attempts are rate-limited server-side.

## 4. AI Studio and deployment

The Admin Dashboard's **AI Studio** looks up Movie / Web Series metadata by exact title (optional release year) using `OMDB_API_KEY`. The AI provider is selected automatically by task: title/movie/series summaries try Gemini first, while website/app/music page extraction tries Groq first. If a key is missing or a request fails (including rate limits), the router tries the next configured provider; OpenAI is last because it may incur API charges. `OPENAI_MODEL` defaults to `gpt-4.1-mini`; `GROQ_MODEL` defaults to `openai/gpt-oss-120b`. Users do not manually select providers. Ratings, posters, years, seasons and episode counts are never fabricated by title lookup. AI Studio only fills the Add item form; an administrator must review the destination URL and publish manually.

OpenAI API usage is billed separately from ChatGPT subscriptions. GroqCloud has a free API tier with per-model rate limits. Keep `OPENAI_API_KEY` and `GROQ_API_KEY` only in Supabase Edge Function Secrets; never add them to `admin-listings.js`, `listings-config.js`, or another public file. Get a Groq key at https://console.groq.com/keys.

The existing Add item URL detector still uses Gemini for page extraction, with OMDb/IMDb verification for movie and series metadata.

Deploy the functions after changing them:
```bash
for fn in admin-login admin-detect admin-listings; do supabase functions deploy "$fn"; done
```
`supabase/config.toml` turns off platform JWT verification because the functions authenticate the `x-admin-token` header against the private `admin_sessions` table.

## 5. Point the site at your project
The repository's `listings-config.js` is already configured with the project's public publishable key. That key is designed to be visible in frontend code; its access is limited by database RLS. Never place the Supabase secret/service-role key in this file. Only change this configuration if you deliberately move the app to another Supabase project.

## How it is protected
- The PIN is verified server-side against a bcrypt hash in the private `admin_credentials` table; no PIN or PIN hash belongs in the repository.
- 5 wrong PINs from one IP, or 30 across all IPs, lock logins for 15 minutes.
- Login issues a random eight-hour session token. The browser stores it only in sessionStorage (not localStorage or a cookie); admin endpoints validate its opaque token hash against the private `admin_sessions` table. Logout revokes that session, and PIN changes revoke every active session.
- `listings` has row-level security: the public can only `select` published rows; there is no
  insert/update/delete policy, so writes only happen through the functions (service role).
- Site settings are publicly readable but only writable through the authenticated admin function. Activity and session tables have no public access policy.
- URLs must be public `https://` addresses (private/internal hosts are blocked), pages are fetched with
  size/time limits, and APK links are only marked verified when the file really starts with the APK/ZIP signature.

## Notes
- A 4-digit PIN is weak by nature. Change it to a longer private PIN from the dashboard's Change PIN tab. The global lock means repeated guessing attempts can temporarily lock logins for everyone.
- Ad level, popularity, smoothness and language scores are editorial: new listings use 70/70/70 and an
  ad level you choose in the form.
- Static catalog entries remain in the repository; new admin-managed listings and public layout settings are stored persistently in Supabase.

## Tests
```bash
cd supabase/functions && cp -r . /tmp/fn && cd /tmp/fn && deno test --allow-env tests   # unit tests
npm run lint                                                                              # repo checks
```
