name: Deploy BENBOMB to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Configure Pages
        uses: actions/configure-pages@v5
        with:
          enablement: true
      - name: Stamp deployed Git commit ID
        shell: bash
        run: |
          python3 - <<'PY'
          import os
          from pathlib import Path
          page = Path("index.html")
          html = page.read_text(encoding="utf-8")
          placeholder = "COMMIT —"
          if html.count(placeholder) != 1:
              raise SystemExit("Expected exactly one COMMIT placeholder")
          page.write_text(html.replace(placeholder, f"COMMIT {os.environ['GITHUB_SHA'][:7]}"), encoding="utf-8")
          PY
      - name: Upload static site
        uses: actions/upload-pages-artifact@v3
        with:
          path: .
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
