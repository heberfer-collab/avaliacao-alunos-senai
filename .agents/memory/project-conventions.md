---
type: project
created: 2026-05-25
updated: 2026-07-12
---

# Project Conventions

## Regras Pedagógicas Oficiais SENAI
- **Composição de Pesos:** Formativa (50%), Avaliativa (30%), Participativa (15%), Pauta/Atitude (5%).
- **Nível Mínimo Esperado:** Nível 5 (Equivalente a 50 pontos SENAI).
- **Instrumento de Avaliação Formativa (Item C):** Matriz oficial relacionando Fundamentos Técnicos & Capacidades, Critérios de Avaliação e Tarefas Formativas (`T13`, `T16`, `T17`, `T18`, `T19`).
- **Autenticação Universal:** Aceita login por Nome Completo/Primeiro Nome, NIF do Funcionário, Matrícula do Aluno ou credencial master `admin`.
- **Cálculo de Senha Padrão:** Primeiro nome em minúsculo + 3 primeiros dígitos do NIF/Matrícula (ex: `heber108`, `rafael222`).

## Git Workflow
- Always create a new dedicated branch for major code changes.
- Branch name format should follow: `feature/[task-slug]` or `fix/[bug-slug]`.

## Supported AI platforms (AG Kit)
- AG Kit **only supports Gemini CLI and Google Antigravity**.
- Do not claim compatibility with Claude Code, Cursor, Copilot, Windsurf, or other assistants unless the user explicitly expands scope.
- Copy on the website, docs, FAQ, README, and marketing should describe AG Kit as a toolkit for Gemini CLI / Antigravity-style agent setups.
