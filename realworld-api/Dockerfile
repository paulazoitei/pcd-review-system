FROM node:18-bullseye-slim

ENV HOST=0.0.0.0
ENV PORT=3000

WORKDIR /app

RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

RUN groupadd --system api && useradd --system --gid api api

COPY dist/api api
COPY src/prisma/schema.prisma api/src/prisma/schema.prisma

RUN chown -R api:api /app

WORKDIR /app/api

RUN npm install --force

RUN npx prisma@4.16.2 generate --schema=src/prisma/schema.prisma

USER api

CMD [ "node", "main.js" ]