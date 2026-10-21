# StreamCloud AI Listing — সেটআপ গাইড

## আগে যা লাগবে
- একটি Supabase project
- Google Gemini API key
- OMDb API key (IMDb rating/movie metadata যাচাইয়ের জন্য)

## ১) Public config
`listings-config.js` খুলে:
- `url`: `https://YOUR-PROJECT-REF.supabase.co`-এর জায়গায় তোমার Supabase Project URL বসাও।
- `anonKey`: `এপিআই`-এর জায়গায় Supabase-এর anon/publishable API key বসাও।

## ২) Supabase server secrets
`SUPABASE_SETUP.md`-এর command চালানোর আগে:
- `GEMINI_API_KEY='এপিআই'`-এ তোমার Gemini API key বসাও।
- `OMDB_API_KEY='এপিআই'`-এ তোমার OMDb API key বসাও।
- `ADMIN_PIN='replace-with-your-private-pin'`-এর জায়গায় তোমার নিজের PIN বসাও (ডিফল্ট PIN চাইলে Supabase secret-এ সেট করো; source code-এ নয়)।
- `ADMIN_SESSION_SECRET`-এর random value command নিজেই generate করে।

**গুরুত্বপূর্ণ:** Gemini ও OMDb key শুধু Supabase server-side secrets-এ বসাবে। এগুলো `index.html`, `listings-config.js`, GitHub বা public JavaScript-এ বসাবে না।

## ৩) Database ও Edge Functions
`SUPABASE_SETUP.md` অনুযায়ী migration ও তিনটি function deploy করো:
`admin-login`, `admin-detect`, `admin-listings`.

## ৪) পরীক্ষা
GitHub Pages site refresh করে ডানদিকের নিচের `+` চাপো। Supabase URL/key ও server secrets ঠিকমতো বসানো না থাকলে login/detection কাজ করবে না।
