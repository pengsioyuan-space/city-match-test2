FROM node:18-alpine

WORKDIR /app

COPY package.json ./
COPY index.html app.js styles.css account.css favicon.svg ./
COPY assets ./assets
COPY server ./server

ENV NODE_ENV=production
ENV PORT=8787

EXPOSE 8787

CMD ["node", "server/server.js"]
