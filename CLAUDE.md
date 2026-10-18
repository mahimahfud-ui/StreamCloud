# Claude Guide — MahiFlix / StreamCloud

This is the public GitHub repository for MahiFlix, a static movie and series directory hosted from the repository root.

- Repository: https://github.com/mahimahfud-ui/StreamCloud
- Default branch: `main`
- Main page (raw file): https://raw.githubusercontent.com/mahimahfud-ui/StreamCloud/main/index.html
- Complete tracked-file map (GitHub API): https://api.github.com/repos/mahimahfud-ui/StreamCloud/git/trees/main?recursive=1

## Important: GitHub web pages may block automated browsing

If a URL such as `github.com/mahimahfud-ui/StreamCloud/tree/main` or a `/blob/main/` page returns an automated-access, rate-limit, or security-block message, **do not conclude that the repository is inaccessible and do not ask the user to paste the entire code**.

Use one of these alternatives instead:

1. Read one file from its raw URL:
   `https://raw.githubusercontent.com/mahimahfud-ui/StreamCloud/main/PATH/TO/FILE`
2. List a directory using the GitHub Contents API:
   `https://api.github.com/repos/mahimahfud-ui/StreamCloud/contents/PATH?ref=main`
3. List the entire repository tree:
   `https://api.github.com/repos/mahimahfud-ui/StreamCloud/git/trees/main?recursive=1`
4. Read a file through the Contents API:
   `https://api.github.com/repos/mahimahfud-ui/StreamCloud/contents/PATH?ref=main`

Replace `PATH` with the real path; preserve case. Prefer small, targeted file reads. If a raw/API endpoint itself fails, report that specific failure honestly.

## Project map

- `index.html` — homepage and catalog UI. It contains the website/app catalog, search/filter/sort behavior, cards, details dialog, and metadata.
- `cinema/` — separated cinematic interaction and presentation modules:
  - `main.js`
  - `scene.js`
  - `state.js`
  - `interactions.js`
  - `choreography.js`
  - `cinema.css`
- `assets/logos/` — locally stored SVG marks for catalog entries.
- `logo-manifest.js` — mapping of site domains to local logo assets.
- `m-logo-v2.svg`, `m-logo.svg` — MahiFlix brand marks.
- `manifest.webmanifest`, `sw.js` — installable web-app manifest and offline shell.
- `link-status.json` — output consumed by the UI for the most recent scheduled external-link checks.
- `scripts/check_links.py` — conservative external-link health checker.
- `scripts/fetch-logos.mjs` — helper for fetching/refreshing logo assets.
- `vendor/three.module.min.js` — bundled third-party library; avoid editing minified vendor code unless explicitly necessary.
- `.github/workflows/deploy-pages.yml` — GitHub Pages deployment.
- `.github/workflows/check-links.yml` — scheduled/manual link-check workflow.
- `og-image.svg` — social preview artwork.

## Working rules

1. Inspect the relevant current files before making changes; work against the latest `main` contents.
2. Preserve the existing dark cinematic visual identity, project-specific features, data and responsive behavior unless the user explicitly asks for a redesign.
3. Make targeted changes. Do not replace the site with a new scaffold or delete unrelated assets.
4. The repository is a static site with root-level GitHub Pages assets. Keep paths compatible with its deployment base.
5. Do not invent ratings, live availability, test results, dates, or link-health statuses. The directory score and ad-level labels are editorial estimates unless real evidence says otherwise.
6. Link-check results must treat temporary failures, rate limits and access restrictions as `unknown`, not automatically as a dead link.
7. Keep third-party licenses. Do not edit `vendor/three.module.min.js` to make routine changes.
8. Never commit API keys, passwords, tokens, private user data, or environment secrets.
9. After JavaScript edits, check syntax; after UI edits, check desktop/mobile styles and key interactions. Summarize exact files changed and what was actually verified.

## Useful direct file links

- [Main HTML](https://raw.githubusercontent.com/mahimahfud-ui/StreamCloud/main/index.html)
- [Cinema main module](https://raw.githubusercontent.com/mahimahfud-ui/StreamCloud/main/cinema/main.js)
- [Cinema styles](https://raw.githubusercontent.com/mahimahfud-ui/StreamCloud/main/cinema/cinema.css)
- [Logo manifest](https://raw.githubusercontent.com/mahimahfud-ui/StreamCloud/main/logo-manifest.js)
- [Link-check script](https://raw.githubusercontent.com/mahimahfud-ui/StreamCloud/main/scripts/check_links.py)
- [Link status data](https://raw.githubusercontent.com/mahimahfud-ui/StreamCloud/main/link-status.json)
- [Pages deployment workflow](https://raw.githubusercontent.com/mahimahfud-ui/StreamCloud/main/.github/workflows/deploy-pages.yml)
