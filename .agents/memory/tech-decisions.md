---
type: project
created: 2026-07-18
updated: 2026-07-18
---

# Technical Decisions

- Component metadata uses SemVer (X.Y.Z) while toolkit releases use CalVer (YYYY.MM.DD).
- **Arquitetura de Deploy:** Static SPA no Vercel (`public/index.html`) com entrega global via CDN e persistência Offline-First em `localStorage`.
- **Backend Local:** Servidor Node.js em `server/dev-server.js` com `node:sqlite` em modo WAL na porta 3000.
- **Repositório GitHub:** `heberfer-collab/avaliacao-alunos-senai` na branch `main`.
- `manifest.json` and `manifest.lock.json` must remain synchronized with component frontmatter.
