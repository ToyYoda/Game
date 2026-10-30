# Arena-Server als Container (für Hoster ohne Node-Laufzeit, z. B. Fly.io, Railway, eigener Server)
FROM node:22-alpine
WORKDIR /app
COPY server/package.json server/package-lock.json server/
RUN cd server && npm ci --omit=dev
COPY src/sim.js src/sim.js
COPY index.html index.html
COPY music music
COPY server/server.js server/server.js
ENV PORT=8787 MAX_PLAYERS=200
EXPOSE 8787
USER node
CMD ["node", "server/server.js"]
