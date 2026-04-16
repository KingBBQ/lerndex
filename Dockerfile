FROM node:22-alpine AS deps
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --omit=dev

FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache libstdc++

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
