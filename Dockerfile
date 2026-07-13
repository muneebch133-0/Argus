FROM node:24.14.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24.14.0-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S argus && adduser -S argus -G argus
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=argus:argus /app/dist ./dist
USER argus
EXPOSE 8787
CMD ["node", "dist/server/server/index.js"]
