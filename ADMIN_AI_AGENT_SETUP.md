# StreamCloud Admin AI Agent

The Admin Dashboard includes an additive **StreamCloud AI** tab. It uses the same PIN-authenticated admin session and the Supabase Edge Function admin-agent.

## What it can do

- Discuss StreamCloud changes in Bengali/Banglish.
- Use configured Supabase AI-provider secrets, with automatic fallback. Gemini, Groq and OpenRouter are considered free-first; providers that may require paid billing are used only when ENABLE_PAID_FALLBACK=true.
- Read the GitHub source tree and prepare a targeted patch proposal.
- Show affected files, before/after previews, suggested checks and risk level.
- Apply only after an admin presses **Apply changes**. High-risk changes require an additional typed confirmation.
- Push the approved commit to the configured GitHub branch.
- If the Management API secret is available, attempt to deploy touched Supabase Edge Functions and execute a newly added SQL migration.
- Store chat history, patch proposals and apply status in private Supabase tables protected by RLS and service-role access.

The agent does not put API secrets into browser code. It blocks file deletes, .env/secret files and workflow edits. It checks whether the branch and source files have changed since preview; stale proposals must be planned again.

## Required server-side configuration

Open **Supabase Dashboard → Edge Functions → Secrets** for project husydmiujigyonlxbuuj. Set secrets only in Supabase, never in listings-config.js.

1. **AI providers**: at least one configured provider key is required, e.g. GEMINI_API_KEY, GROQ_API_KEY or OPENROUTER_API_KEY. The agent tries configured providers in its server-side order. Paid providers are disabled unless ENABLE_PAID_FALLBACK=true.
2. **GitHub write access**: GITHUB_TOKEN must be a GitHub token scoped to mahimahfud-ui/StreamCloud with **Contents: Read and write**. The panel reports if GitHub connectivity or push permission is missing.
3. **Supabase automatic backend deployment**: create a project-scoped Supabase Personal Access Token with only the permissions required for this project: **Edge Functions: Read and write** and **Database: Read and write**. Store the value under the custom secret name SC_SUPABASE_MANAGEMENT_TOKEN (not a name starting with SUPABASE_). Optionally set SC_SUPABASE_PROJECT_REF=husydmiujigyonlxbuuj; otherwise this project ref is used by default.

The Management API token is necessary for the agent to deploy Edge Functions and run new SQL migrations itself. Without it, GitHub commits can still be made if the GitHub token has write permission, but the panel will report Supabase deployment/migration steps as skipped. Keep this token private and project-scoped.

Supabase references:
- https://supabase.com/docs/reference/api/v1-deploy-a-function
- https://supabase.com/docs/reference/api/v1-run-a-query
- https://supabase.com/docs/guides/functions/secrets

## Safe workflow

1. Open the existing admin panel and unlock with the admin PIN.
2. Choose **StreamCloud AI**.
3. Ask a question with **Send**, or request a change with **Plan changes**.
4. Inspect the files, before/after preview and risk. Planning does not change GitHub.
5. Press **Apply changes** only after reviewing the patch.
6. Check the returned commit link and per-function/migration status. A successful GitHub commit does not prove a frontend host's build has finished; the agent reports that limitation.

Frontend deployments depend on the repository's connected hosting workflow. The agent does not claim a frontend deployment is live until a separate deployment check confirms it.
