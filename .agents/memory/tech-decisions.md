---
type: project
created: 2026-07-18
updated: 2026-07-18
---

# Technical Decisions

- Component metadata uses SemVer (X.Y.Z) while toolkit releases use CalVer (YYYY.MM.DD).
- **Arquitetura de Deploy:** VPS própria com Docker Compose (Node.js + MySQL 8.0), Nginx como proxy reverso com SSL/Let's Encrypt, e persistência híbrida via `server/db.js` (`DB_TYPE=mysql` com fallback para `sqlite` local).
- **Backend & Banco de Dados:** Node.js HTTP REST API em `server/server.js` conectando ao MySQL com pool de conexões (`mysql2/promise`), migração automatizada via `scripts/migrate-to-mysql.js` e schema em `server/schema-mysql.sql`.
- **Repositório GitHub:** `heberfer-collab/avaliacao-alunos-senai` na branch `main`.
- `manifest.json` and `manifest.lock.json` must remain synchronized with component frontmatter.
