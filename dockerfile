# Build stage
FROM node:20-bookworm-slim
WORKDIR /app

# Allow Vite/SvelteKit to read backend URL at build time
ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}

COPY package.json yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile

COPY . .
RUN yarn cache clean
RUN yarn run build

EXPOSE 4173
# Bind to all interfaces so the container is reachable from the host
CMD ["yarn", "preview", "--host", "0.0.0.0", "--port", "4173"]