# Portfolio — Revanth Jupelly

Static, zero-build portfolio based on [dev-portfolio-template](https://github.com/pavanjoshi914/dev-portfolio-template) (MIT, see `LICENSE`).

- Edit your info in `portfolio.config.json`, then run `node scripts/build-data.mjs`.
- Preview: `python3 serve.py` → http://localhost:8767/ (intro) and http://localhost:8767/site/ (editor).
- Deploy this folder as-is to GitHub Pages, Vercel, Netlify or Cloudflare Pages (no build command).

`github-snapshot.json`, `site/months.json`, `site/stack.json` and `wall.json` were generated from the git
history and source of the public repos (weyro, Project-decode). To use your full GitHub stats instead, run
`node scripts/build-data.mjs --fetch-github` with an authenticated `gh` CLI.
