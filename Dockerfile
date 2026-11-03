# =============================================================================
# DOCKERFILE - SISTEMA DE AVALIAÇÃO SENAI (MSEP)
# =============================================================================

FROM node:20-alpine

# Criação do diretório de trabalho
WORKDIR /app

# Instalação de dependências
COPY package*.json ./
RUN npm install --omit=dev

# Cópia do código-fonte da aplicação
COPY . .

# Variáveis padrão de ambiente
ENV NODE_ENV=production
ENV PORT=3000

# Porta exposta
EXPOSE 3000

# Health check nativo via endpoint /api/health
HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Inicialização
CMD ["npm", "start"]

