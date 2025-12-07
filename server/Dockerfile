FROM node:20-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY tsconfig.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY src ./src

# Compilar TypeScript
RUN npm run build

# Puerto por defecto
ENV PORT=4000
EXPOSE 4000

# Comando de inicio
CMD ["npm", "start"]
