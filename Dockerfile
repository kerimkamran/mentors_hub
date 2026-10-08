# Production image: web server + background worker in one container (see scripts/start-hosted.ts).
FROM node:22-bookworm-slim
LABEL org.opencontainers.image.source="https://github.com/kerimkamran/mentors_hub"
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Build-time values only satisfy the build; real values are supplied when the container starts.
RUN npm run build
RUN chown -R node:node /app
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
USER node
CMD ["npm", "run", "start:hosted"]
