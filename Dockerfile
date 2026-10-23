FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY src ./src
RUN mkdir -p /app/.data && chown -R node:node /app
USER node
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node", "src/server.mjs"]
