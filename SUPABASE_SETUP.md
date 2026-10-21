# Secure AI auto-listing: setup

Everything secret lives in Supabase. The static site only holds the public URL and anon key.

## 1. Create the database objects
```bash
npm i -g supabase            # or: brew install supabase/tap/supabase
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
supabase db push             # runs supabase/migrations/20261022000000_listings.sql
```
(or paste that SQL file into Supabase -> SQL Editor).

## 2. Set the server-side secrets (never commit these)
```bash
supabase secrets set \
  ADMIN_PIN='replace-with-your-private-pin' \
  ADMIN_SESSION_SECRET="$(openssl rand -hex 32)" \
  GEMINI_API_KEY=<from https://aistudio.google.com/apikey> \
  OMDB_API_KEY=<from https://www.omdbapi.com/apikey.aspx> \
  ALLOWED_ORIGINS=https://mahimahfud-ui.github.io
# optional: GEMINI_MODEL (default gemini-2.5-flash), GITHUB_TOKEN (higher GitHub API limit)
```
Add `http://localhost:8080` to `ALLOWED_ORIGINS` (comma separated) only for local testing.

## 3. Deploy the functions
```bash
for fn in admin-login admin-detect admin-listings; do supabase functions deploy "$fn"; done
```
`supabase/config.toml` turns off the platform JWT check because the functions verify their own
short-lived admin token.

## 4. Point the site at your project
Edit `listings-config.js` (public values only):
```js
window.STREAMCLOUD_SUPABASE = { url: "https://<ref>.supabase.co", anonKey: "<anon/publishable key>" };
```
Commit and push. The `+` button then works on GitHub Pages.

## How it is protected
- PIN is compared on the server against `ADMIN_PIN`; it is not in any file in this repo.
- 5 wrong PINs from one IP, or 30 across all IPs, lock logins for 15 minutes.
- Login returns a 30-minute HMAC-signed token; every create/update/delete/detect call checks it.
- `listings` has row-level security: the public can only `select` published rows; there is no
  insert/update/delete policy, so writes only happen through the functions (service role).
- URLs must be public `https://` addresses (private/internal hosts are blocked), pages are fetched with
  size/time limits, and APK links are only marked verified when the file really starts with the APK/ZIP signature.

## Notes
- A 4-digit PIN is weak by nature. Rate limiting makes guessing slow, but a longer PIN is safer
  (`supabase secrets set ADMIN_PIN=...`; the field accepts any text). The global lock also means someone
  who keeps guessing can temporarily lock you out.
- Ad level, popularity, smoothness and language scores are editorial: new listings use 70/70/70 and an
  ad level you choose in the form.
- Music Websites appear in Music Apps; Movies and Web Series appear in Movies & Series.

## Tests
```bash
cd supabase/functions && cp -r . /tmp/fn && cd /tmp/fn && deno test --allow-env tests   # unit tests
npm run lint                                                                              # repo checks
```
