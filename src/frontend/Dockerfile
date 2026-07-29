FROM node:24-alpine AS dependencies
WORKDIR /app
RUN corepack enable
COPY src/frontend/package.json src/frontend/pnpm-lock.yaml src/frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY src/frontend/ ./
RUN pnpm build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
