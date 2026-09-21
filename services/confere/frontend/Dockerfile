# ── Estágio 1: dependências ──────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# A versão do pnpm vem do campo `packageManager` do package.json. Sem ela o
# corepack baixa a última publicada — hoje a 11, que exige o builtin
# `node:sqlite`, ausente no Node 20, e quebra a instalação. Sem o prompt de
# download não há build não-interativo.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable pnpm

# pnpm-workspace.yaml traz a lista de dependências autorizadas a rodar script de
# build. Sem ele a instalação falha, e é assim que deve ser: script de build não
# aprovado é código arbitrário rodando na imagem.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ── Estágio 2: build ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# NEXT_PUBLIC_API_URL é embutida no pacote do cliente em tempo de build, e quem
# a consome é o **navegador** — não o container. Por isso o valor precisa ser o
# endereço que o navegador enxerga (http://localhost:8000), e nunca o nome do
# serviço na rede do compose (http://backend:8000), que só resolve entre
# containers.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN corepack enable pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ── Estágio 3: execução ──────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Saída standalone: o server.js já vem com as dependências que usa embutidas.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# A saída standalone não inclui `public/`. Sem esta linha o logo sai 404 no
# container — e só no container, o que esconderia a falha no desenvolvimento.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
