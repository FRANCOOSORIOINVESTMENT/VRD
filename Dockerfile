FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copiar manifiestos e instalar dependencias
COPY package*.json ./
RUN npm install

# Copiar el código fuente completo y compilar frontend y backend
COPY . .
RUN npm run build

# Cloud Run escucha en el puerto 8080
EXPOSE 8080

CMD ["node", "dist/server.cjs"]
