FROM node:22-slim AS deps
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

FROM node:22-slim
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
