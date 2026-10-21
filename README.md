# MahiFlix

A curated movie and series directory by Mahi. This repository is public and the site is deployed from its root using GitHub Pages.

## Source and repository links

- [Open the live site](https://mahimahfud-ui.github.io/StreamCloud/)
- [GitHub repository](https://github.com/mahimahfud-ui/StreamCloud)
- [Main source HTML (direct/raw)](https://raw.githubusercontent.com/mahimahfud-ui/StreamCloud/main/index.html)
- [Full repository file map (GitHub API)](https://api.github.com/repos/mahimahfud-ui/StreamCloud/git/trees/main?recursive=1)
- [Claude-specific project guide](./CLAUDE.md)
- [General coding-agent guide](./AGENTS.md)

## Project structure

| Path | Purpose |
|---|---|
| `index.html` | Main site, catalog UI, search, filters, sorting and listing detail dialog |
| `cinema/` | Cinematic scene, state, interaction and choreography modules, plus the hero portal (`portal.js`) and preloader (`preloader.js`) |
| `assets/logos/` | Local SVG logos |
| `logo-manifest.js` | Domain-to-logo mapping |
| `manifest.webmanifest` | Installable web app metadata |
| `sw.js` | Offline catalog shell |
| `link-status.json` | Latest link-check snapshot consumed by the UI |
| `scripts/check_links.py` | Conservative external-link checker |
| `scripts/fetch-logos.mjs` | Logo helper |
| `vendor/` | Third-party library and license |
| `.github/workflows/` | GitHub Pages deployment and link-check workflows |
| `og-image.svg` | Social preview image |

## When a browser cannot open GitHub pages

Some automated browsing tools block GitHub's `tree/main` or `blob/main` HTML views. This alone does not mean the public repository is inaccessible. Use a direct raw source URL such as:

`https://raw.githubusercontent.com/mahimahfud-ui/StreamCloud/main/index.html`

For directories or the complete tree, use the GitHub API links above. Do not ask the user to paste source that is already present in this public repository unless direct raw/API access also fails.

## Development notes

Keep the existing dark cinematic design and data. Prefer targeted changes, verify JavaScript syntax after edits, preserve the vendor license, and avoid claiming a deployment or live link check is complete until it has been verified.

## Movies & Web Series recommendations

Edit `data/recommendations.json` and push to `main`; the deploy workflow fetches metadata from TMDB and publishes it.

- Each entry can be a title string or an object such as `{ "title": "Inception", "year": 2010, "tmdbId": 27205 }`. Use `tmdbId` to disambiguate similarly named titles.
- Add repository secrets under Settings → Secrets and variables → Actions: `TMDB_API_KEY` or `TMDB_READ_ACCESS_TOKEN` is required; `OMDB_API_KEY` is optional and enables IMDb ratings.
- Keys are only used in GitHub Actions. The public site loads generated `data/tmdb/*.json` files. If metadata fetching fails for a title, the previous generated entry is retained.
