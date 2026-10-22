# StreamCloud AI Listing — সেটআপ গাইড

## আগে যা লাগবে
- একটি Supabase project
- Google Gemini API key
- OMDb API key (IMDb rating/movie metadata যাচাইয়ের জন্য)

## ১) Public config
`listings-config.js` খুলে:
- `url`: `https://YOUR-PROJECT-REF.supabase.co`-এর জায়গায় তোমার Supabase Project URL বসাও।
- `anonKey`: `এপিয়াই`-এর জায়গায় Supabase-এর anon/publishable API key বসাও।

## ২) Supabase server secrets
`SUPABASE_SETUP.md`-এর command চালানোর আগে:
- `GEMINI_API_KEY='এপিয়াই'`-এ তোমার Gemini API key বসাও।
- `OMDB_API_KEY='এপিয়াই'`-এ তোমার OMDb API key বসাও।
- Optional: GitHub Releases থেকে APK detection-এর authenticated limit বাড়াতে `GITHUB_TOKEN='এপিয়াই'` যোগ করতে পারো; সাধারণ ব্যবহারে এটি বাধ্যতামূলক নয়।
- `ADMIN_PIN='replace-with-your-private-pin'`-এর জায়গায় তোমার নিজের PIN বসাও (ডিফল্ট PIN চাইলে Supabase secret-এ সেট করো; source code-এ নয়)।
- `ADMIN_SESSION_SECRET`-এর random value command নিজেই generate করে।

**গুরুত্বপূর্ণ:** Gemini ও OMDb key শুধু Supabase server-side secrets-এ বসাবে। এগুলো `index.html`, `listings-config.js`, GitHub বা public JavaScript-এ বসাবে না।

## ৩) Database ও Edge Functions
`SUPABASE_SETUP.md` অনুযায়ী migration ও তিনটি function deploy করো:
`admin-login`, `admin-detect`, `admin-listings`.

## API কোথায় বসবে (direct links)
- Supabase URL ও publishable key: [listings-config.js](https://github.com/mahimahfud-ui/StreamCloud/blob/main/listings-config.js)
- Gemini ও OMDb server-side keys এবং deploy command: [SUPABASE_SETUP.md](https://github.com/mahimahfud-ui/StreamCloud/blob/main/SUPABASE_SETUP.md)
- Secret বসানোর dashboard: https://supabase.com/dashboard/project/husydmiujigyonlxbuuj/functions/secrets

`এপিয়াই` লেখা থাকলে সেটি placeholder—বাস্তব key বসানো না পর্যন্ত সংশ্লিষ্ট detection কাজ করবে না। Supabase service-role/secret key, Admin PIN, Gemini ও OMDb key কখনো public JavaScript-এ দেবে না।

## ৪) পরীক্ষা
GitHub Pages site refresh করে ডানদিকের নিচের `+` চাপো। Supabase URL/key ও server secrets ঠিকমতো বসানো না থাকলে login/detection কাজ করবে না।
