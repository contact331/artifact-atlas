# Full Atlas — Git migration candidate

**Not yet production-approved.** This is the locally tested T29 reconstruction from the original T23 handover and later UI overlays, not a byte-for-byte copy of the live T29 Vercel functions. The existing production deployment remains unchanged.

The least-risk production path remains the exact T29 Vercel source-hash overlay in the T44 release package. This source tree is the independent Git migration candidate. No archive, audio, private PDF, dossier or credential bytes are committed.

- `public/index.html`: original T23 application shell with the locally reproduced T29 controls.
- `public/assets/app.js`: existing application controller, not a rewrite.
- `public/assets/quickpad.js`, `quickpad.css`: independent Quickpad component.
- `public/assets/audio.js`, `publication.js`, `reconciliation.js`, `supplement.js`: original T23 modules, copied byte for byte.
- `api/atlas.mjs`: original T23 media/data proxy, copied byte for byte.
- `vercel.json`: static source delivery plus same-origin archive/media rewrites. No change to security headers.

## Deployment gate

Use the existing full Vercel project only after review. The original T23 proxy requires the provider-configured `ATLAS_PRIVATE_ORIGIN` credential; check that it remains valid in the intended preview environment. The exact deployed T29 proxy may differ; confirm all existing live archive and media behavior before switching. Do not change R2, origin access, project protection, DNS, or production aliases during source migration. Do not deploy the older public exhibition over the full Atlas. Use project root `full-atlas` for a Git preview (or deploy from this subdirectory). Confirm all 71/46/1181/23 counts, 54 Quickpad destinations, existing PDF/audio/download routes including HTTP Range, links and native inspector functionality.

## T44 addition

`public/assets/living.js` and `living.css` provide the shared renderer and chamber styles. `public/assets/living/v1/` contains all 71 immutable GLBs, matching the accepted T44 release hashes. The existing controller has only the previously tested T43 directory modifications; model rendering remains separate. The local T44 tests cover 71 inspector routes, catalogue and Quickpad controls, mobile interaction and 38,340 projected centering cases. Remote media delivery and hardware GPU remain unverified.

Run `node --test qa/proxy.test.mjs` and `node --check public/assets/app.js` before preview. The original T44 QA JSONs document the local in-memory test harness; no live test is implied.

## Import into existing Git repository

Keep `main` and the public exhibition untouched. In a clean clone, switch to the existing `full-atlas-t29-baseline` migration branch. Fetch the provided bundle into a temporary local branch, then cherry-pick the two commits in chronological order. They add the `full-atlas/` subtree only. Review the diff and run the local QA commands before pushing the migration branch. The bundle is independent of the GitHub history by design. Do not force-push or publish any of the T23 private ZIP payload.

```sh
git switch full-atlas-t29-baseline
git fetch /path/to/Atlas_T46_Git_Recovery_Candidate.bundle t46-recovery:refs/heads/t46-import
git cherry-pick $(git rev-list --reverse t46-import)
cd full-atlas
node --test qa/proxy.test.mjs
node qa/check_center.cjs
```

The centering check is deterministic; it must report 71 models, 38,340 cases, and no failures. A real preview test is still required. The original T44 exact-source-hash overlay is a separate production-safe route candidate, not part of this reconstructed Git tree.
