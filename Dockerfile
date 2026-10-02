# Multi-stage Dockerfile optimizado para Google Cloud Run
# Soporta Node 22, compilación de Vite y servidor Express en dist/server.cjs

FROM node:22-alpine AS builder

WORKDIR /app

# Instalar dependencias completas para la compilación (incluye Vite y esbuild)
COPY package*.json ./
RUN npm install

# Copiar el código fuente y compilar frontend (dist/) y backend (dist/server.cjs)
COPY . .
RUN npm run build

# Etapa 2: Imagen final de producción (liviana y segura)
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Instalar únicamente dependencias requeridas en tiempo de ejecución
COPY package*.json ./
RUN npm install --omit=dev

# Copiar artefactos compilados desde la etapa builder
COPY --from=builder /app/dist ./dist

# Cloud Run escucha por defecto en el puerto 8080 (inyectado en $PORT)
EXPOSE 8080

CMD ["node", "dist/server.cjs"]
