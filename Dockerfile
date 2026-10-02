# Etapa 1: Builder
FROM node:22-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar todas las dependencias necesarias para la compilación
RUN npm install

# Copiar el código fuente completo
COPY . .

# Compilar el frontend (en dist/) y empaquetar el backend (dist/server.cjs)
RUN npm run build

# Etapa 2: Runner (Entorno final de ejecución para Render)
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000

# Copiar directamente las dependencias, configuración y compilados desde el builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Puerto expuesto por defecto en Render
EXPOSE 10000

# Iniciar servidor Express de producción
CMD ["node", "dist/server.cjs"]
