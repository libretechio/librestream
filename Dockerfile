FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY web ./web
COPY vite.config.js ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=80
COPY --from=build /app/build ./build
COPY server.mjs ./
COPY addons.json ./
EXPOSE 80
CMD ["node", "server.mjs"]
