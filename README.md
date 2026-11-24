# Artifact Atlas

A public exhibition of Marquise de la Fressange’s books, artwork, film, and research. The workbench uses the T23 cube geometry. Select a main cube for the inspector or explore a companion for audio, method, theme, or publication links.

## Run locally

From the repository root, run `python3 -m http.server 8000 --directory site` and open [localhost:8000](http://localhost:8000). Run `node --test checks/release.test.mjs` to check the catalogue, lattice slots, initial inspector state, and media response behavior.

The Vercel project builds the repository’s `site/` as a static site. The Cloudflare Worker in `worker/` serves the versioned MP3 manifest over R2. `site/assets/catalogue.js` contains the public catalogue and media origin. Each artifact ID has a main recording and four theme recordings. The tour plays the briefing, then one main recording and a randomly selected theme per artifact before reshuffling.

Validate public descriptions, publication URLs and the exact media payload before adding each record. Use a new media version for changed bytes because release URLs are immutable.
