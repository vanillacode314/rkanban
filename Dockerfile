FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN pnpm dlx giget@latest gh:vanillacode314/rkanban /app
WORKDIR /app


FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build
ARG PUBLIC_SOCKET_URL
ARG PUBLIC_PUBLISH_URL
ARG TURSO_AUTH_TOKEN
ARG TURSO_CONNECTION_URL
ARG AUTH_SECRET
ARG RESEND_API_KEY
ARG NOTIFICATIONS_EMAIL_ADDRESS
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm turbo build --filter app

FROM base
ARG TURSO_AUTH_TOKEN
ARG TURSO_CONNECTION_URL
ARG AUTH_SECRET
ARG RESEND_API_KEY
ARG NOTIFICATIONS_EMAIL_ADDRESS

ENV TURSO_AUTH_TOKEN $TURSO_AUTH_TOKEN
ENV TURSO_CONNECTION_URL $TURSO_CONNECTION_URL
ENV AUTH_SECRET $AUTH_SECRET
ENV RESEND_API_KEY $RESEND_API_KEY
ENV NOTIFICATIONS_EMAIL_ADDRESS $NOTIFICATIONS_EMAIL_ADDRESS

COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/apps/app/.output /app/.output
CMD [ "node", "/app/.output/server/index.mjs" ]
