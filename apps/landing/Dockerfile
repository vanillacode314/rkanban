FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm i -g pnpm
COPY . /app
WORKDIR /app


FROM base AS build
RUN --mount=type=cache,id=s/9231f356-4531-44ea-8938-f125232d568d-/pnpm/store,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build


FROM nginx:alpine
COPY ./nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
