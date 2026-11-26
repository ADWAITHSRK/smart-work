FROM node:24-slim
RUN npm install -g pnpm@11.15.1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# NEXT_PUBLIC_* values are compiled into the client. The secret mount keeps .env.local itself out of the image.
RUN --mount=type=secret,id=env,target=/app/.env.local pnpm build
CMD ["node_modules/.bin/next", "start"]
