# Etapa 1: Builder
FROM node:22-alpine AS builder

WORKDIR /app

# Copiar manifiestos de paquetes
COPY package*.json ./

# Instalar dependencias completas
RUN npm install

# Copiar todo el código fuente del proyecto
COPY . .

# Compilar frontend (dist/) y empaquetar backend (dist/server.cjs)
RUN npm run build

# Etapa 2: Runner final de producción
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copiar dependencias y artefactos compilados directamente desde el builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Puerto esperado por Google Cloud Run
EXPOSE 8080

# Iniciar servidor Express de producción
CMD ["node", "dist/server.cjs"]
