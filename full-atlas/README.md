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
