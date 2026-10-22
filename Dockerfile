# Starter production image for laundry-api. Build in CI/hosting; it is not
# built in the development sandbox (no container runtime / base-image access).

FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm build && pnpm prune --prod

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
EXPOSE 3000
# Configuration (incl. MONGODB_URI) is supplied via the environment.
CMD ["node", "dist/server.js"]
