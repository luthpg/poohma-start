# --- ステージ1: ビルド ---
FROM node:20-slim AS builder
WORKDIR /app

# Prisma のバイナリ用に必要なライブラリをインストール
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

# Prisma Client の生成
RUN npx prisma generate

# TanStack Start / Vinxi のビルド
RUN npm run build

# --- ステージ2: 実行 ---
FROM node:20-slim AS runner
WORKDIR /app

# 実行時にも openssl が必要
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
# Cloud Run のデフォルトポートは 8080
ENV PORT=8080

# ビルド成果物と必要なファイルだけをコピー
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

# 実行
EXPOSE 8080
CMD ["npm", "start"]
