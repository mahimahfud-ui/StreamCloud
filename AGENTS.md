# Repository instructions for coding agents

This repository is public: https://github.com/mahimahfud-ui/StreamCloud

## If GitHub web browsing is blocked

Avoid relying on `/tree/main` and `/blob/main` pages. Read source files via:

- Raw file: `https://raw.githubusercontent.com/mahimahfud-ui/StreamCloud/main/<path>`
- Directory listing: `https://api.github.com/repos/mahimahfud-ui/StreamCloud/contents/<path>?ref=main`
- Full file map: `https://api.github.com/repos/mahimahfud-ui/StreamCloud/git/trees/main?recursive=1`

An automated-access denial on the GitHub HTML page alone does not establish that the repository is private or that raw/API access is unavailable. Test a direct endpoint before reporting a blocker.

## Project safety

- Main site: `index.html`; animation modules are in `cinema/`.
- Preserve the existing dark cinematic design and current catalog data.
- Keep root-relative/relative asset paths compatible with GitHub Pages.
- Make the smallest change that fulfils the request; do not remove unrelated files.
- Do not report unperformed tests or unverified deployments as successful.
- Do not invent link status or ratings; label estimates as estimates.
- Never commit credentials, tokens, private user data or secrets.
- Leave minified third-party code under `vendor/` untouched unless essential.
