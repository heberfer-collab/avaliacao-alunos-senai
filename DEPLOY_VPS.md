# Guia de Implantação no Ecossistema HRF (VPS)
## Sistema Integrado de Gestão e Avaliação SENAI (MSEP)

A auditoria da sua VPS revelou a configuração exata do seu ambiente:
- **Ecossistema:** `hrf-ecosystem`
- **Banco MySQL:** Já existe o container `mysql-db` rodando na porta `3307`!
- **Adminer:** Rodando em `http://5.78.181.218:8080`.
- **Portas já ocupadas:**
  - `3000`: portal-hrf
  - `3001`: hrffit-frontend
  - `3002`: hrf-financas
  - `3003`: hrfos-frontend
- **Porta Livre Escolhida:** **`3004`**

---

### Passo 1: Criar o Banco `avaliacao_senai` no `mysql-db` existente

Como você já tem o container `mysql-db` rodando, você economiza memória RAM criando a nova base dentro dele:

**Via Terminal SSH:**
```bash
docker exec -it mysql-db mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS avaliacao_senai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```
*(Digite a senha de root do seu MySQL quando solicitado)*

**OU via Adminer (`http://5.78.181.218:8080`):**
1. Sistema: `MySQL`
2. Servidor: `mysql-db` (ou `localhost:3306`)
3. Usuário: `root` + sua senha
4. Clique em "Criar nova base de dados" -> Nome: `avaliacao_senai` -> Collation: `utf8mb4_unicode_ci`.

---

### Passo 2: Clonar ou Transferir o Projeto para a VPS

Na sua VPS:
```bash
cd ~
mkdir -p avaliacao-senai
cd avaliacao-senai
# (Copie os arquivos do projeto para esta pasta)
```

Configure o `.env`:
```bash
cp .env.example .env
nano .env
```
Preencha a variável `DB_PASSWORD` com a senha de root do seu `mysql-db`.

---

### Passo 3: Iniciar a Aplicação

```bash
docker compose up -d --build
```
A aplicação iniciará na porta `3004` e se conectará ao seu `mysql-db`.

---

### Passo 4: Migrar os Dados Existentes

```bash
docker compose exec app npm run migrate:mysql
```

---

### Passo 5: Configurar no Nginx Proxy Manager

No painel do NPM (`http://5.78.181.218:81`):
1. Clique em **Add Proxy Host**.
2. **Details:**
   - **Domain Names:** `avaliacao.hrftec.com.br` (ou `senai.hrftec.com.br`)
   - **Scheme:** `http`
   - **Forward Hostname / IP:** `172.17.0.1`
   - **Forward Port:** `3004`
   - Ative: **Block Common Exploits** e **Websockets Support**
3. **SSL:**
   - Selecione **Request a new SSL Certificate**
   - Ative: **Force SSL**, **HTTP/2 Support**, **HSTS Enabled**
   - Aceite os termos do Let's Encrypt e clique em **Save**.

