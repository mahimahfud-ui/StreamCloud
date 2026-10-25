# Secure AI auto-listing: setup

Everything secret lives in Supabase. The static site only holds the public URL and anon key.

## 1. Database setup

The existing StreamCloud production database already has the listings and admin-control tables. **Do not rerun the migrations on that production project.**

For a **new** Supabase project, open SQL Editor and run these repository files in order:
1. `supabase/migrations/20261022000000_listings.sql`
2. `supabase/migrations/20261022170000_streamcloud_admin_control.sql`

The existing production database's migration history was created through a managed/dashboard workflow and is not fully mirrored by the repository's CLI migration filenames. Avoid running `supabase db push` against that production project until its migration history is reconciled.

## 2. Set server-side API secrets (never commit these)

These are the provider secret names read by the active StreamCloud `admin-detect` router. The router automatically tries the next configured provider if a request fails; OpenAI is last because it can require paid API credits. Keep all provider keys in Supabase Edge Function Secrets, never in public JavaScript.

```bash
supabase secrets set \
  GEMINI_API_KEY='YOUR_PRIVATE_GEMINI_KEY' \
  OMDB_API_KEY='YOUR_PRIVATE_OMDB_KEY' \
  GROQ_API_KEY='YOUR_PRIVATE_GROQ_KEY' \
  GROQ_MODEL='openai/gpt-oss-120b' \
  OPENROUTER_API_KEY='YOUR_PRIVATE_OPENROUTER_KEY' \
  OPENAI_API_KEY='YOUR_PRIVATE_OPENAI_API_KEY' \
  OPENAI_MODEL='gpt-4.1-mini' \
  DEEPSEEK_API_KEY='YOUR_PRIVATE_DEEPSEEK_KEY' \
  ALLOWED_ORIGINS='https://mahimahfud-ui.github.io,https://streamcloud.ai.studio,https://streamcloud-527d.onrender.com'
# Optional model overrides (otherwise OpenRouter uses its free-model router):
# GEMINI_MODEL='gemini-2.5-flash'
# OPENROUTER_MODEL='openrouter/free'
# DEEPSEEK_MODEL='deepseek-flash'
# Optional: enable potentially billable DeepSeek/OpenAI fallback only if you accept API charges.
# ENABLE_PAID_FALLBACK='true'
# Optional if you need authenticated GitHub release lookups:
# GITHUB_TOKEN='YOUR_PRIVATE_GITHUB_TOKEN'
```

The existing Edge Function also recognises the legacy secret name `DeepSeek` if `DEEPSEEK_API_KEY` is not set. Use one valid DeepSeek key name, not two different values.

The current login implementation stores a bcrypt PIN hash in `public.admin_credentials` and random session-token hashes in `public.admin_sessions`. `ADMIN_PIN` and `ADMIN_SESSION_SECRET` are not read by the active StreamCloud functions; keeping them in Secrets does not activate them. Do not put the PIN itself or its hash in GitHub.

## 3. Initialize the admin PIN privately

The PIN is stored only as a bcrypt hash in the private Supabase database. Do not put the PIN or a PIN hash in GitHub.
If setting up a fresh database, run this once in the Supabase SQL Editor and replace the placeholder privately:
```sql
select public.admin_update_pin('YOUR_PRIVATE_PIN');
```
The existing project database already has the requested initial PIN. Login returns a random, revocable eight-hour session token; the browser keeps it in sessionStorage and every admin request is checked server-side against its token hash. Login attempts are rate-limited server-side.

## 4. AI Studio and deployment

The Admin Dashboard's **AI Studio** looks up Movie / Web Series metadata by exact title (optional release year) using `OMDB_API_KEY`. The AI provider is selected automatically by task: summaries try Gemini first, structured Movie / Web Series metadata tries Groq first, and website/app/music extraction tries Groq first with OpenRouter and other configured providers as fallbacks. OpenRouter defaults to `openrouter/free`, which selects an available free model compatible with the request instead of pinning a model ID. Gemini discovers models enabled for the key and retries a bounded list; Groq retries compatible models on availability/rate-limit failures. Invalid keys, quota errors and temporary provider failures trigger bounded cooldowns before later requests try the same provider again. DeepSeek and OpenAI are skipped unless `ENABLE_PAID_FALLBACK=true` because their API use may incur charges; OpenRouter non-free model overrides are also skipped unless that flag is enabled. `OPENAI_MODEL` defaults to `gpt-4.1-mini`; `GROQ_MODEL` defaults to `openai/gpt-oss-120b`. Users do not manually select providers. Ratings, posters, years, seasons and episode counts are never fabricated by title lookup. AI Studio only fills the Add item form; an administrator must review the destination URL and publish manually.

OpenAI API usage is billed separately from ChatGPT subscriptions. GroqCloud has a free API tier with per-model rate limits. Keep `OPENAI_API_KEY` and `GROQ_API_KEY` only in Supabase Edge Function Secrets; never add them to `admin-listings.js`, `listings-config.js`, or another public file. Get a Groq key at https://console.groq.com/keys.

The existing Add item URL detector uses task-based routing for page extraction, with OMDb/IMDb verification for movie and series metadata. Potentially paid DeepSeek/OpenAI fallbacks require `ENABLE_PAID_FALLBACK=true`; leaving it unset keeps them out of automatic routing.

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


## Listing AI provider fallback

The Admin Listing detector uses server-side Supabase Edge Function secrets only. Never place provider keys in HTML, JavaScript, repository files, or browser storage.

| Provider | Secret(s) | Optional model override |
| --- | --- | --- |
| Gemini | `GEMINI_API_KEY` | `GEMINI_MODEL` |
| Groq | `GROQ_API_KEY` | `GROQ_MODEL` |
| OpenRouter | `OPENROUTER_API_KEY` | `OPENROUTER_MODEL` |
| Venice | `VENICE_API_KEY` | `VENICE_MODEL` |
| Cloudflare Workers AI | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | `CLOUDFLARE_MODEL` |
| Shannon AI | `SHANNON_API_KEY` | `SHANNON_MODEL` |
| Anthropic | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL` |
| DeepSeek | `DEEPSEEK_API_KEY` | `DEEPSEEK_MODEL` |
| OpenAI | `OPENAI_API_KEY` | `OPENAI_MODEL` |
| IMDb metadata | `OMDB_API_KEY` | — |

Cloudflare also accepts the legacy `Cloudflare` secret when it contains a JSON object with token and account ID fields. If only that legacy secret is used, keep its token and account ID server-side.

The optional `ENABLE_PAID_FALLBACK=true` setting enables automatic Cloudflare Workers AI, Venice, Shannon AI, Anthropic, DeepSeek, and OpenAI fallback. It is off by default to avoid unexpected usage-based or paid API calls. Without it, Gemini, Groq, and OpenRouter are attempted in a free-first sequence (subject to each account plan and quota), and a failing provider does not stop the remaining eligible providers from being tried.

Default model choices are deliberately overridable with the model secrets above. Confirm model access and account quota for each provider in its own dashboard; a secret's presence does not prove that the key is valid or has usable quota.

After updating this code, redeploy the `admin-detect` Edge Function from the reviewed branch/main commit before expecting the new adapters to run in production. The tests mock provider HTTP responses and verify response parsing and fallback order; they do not validate live provider credentials.
