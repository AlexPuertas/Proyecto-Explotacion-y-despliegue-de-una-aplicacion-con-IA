# Etapa 1: Construcción del frontend
FROM node:20-alpine AS build-frontend
WORKDIR /app

# Copiar configuración e instalar dependencias
COPY package.json package-lock.json ./
RUN npm ci

# Copiar el código fuente del frontend y compilar
COPY index.html tsconfig.json vite.config.ts ./
COPY src/ ./src/
RUN npm run build

# Etapa 2: Entorno de producción con FastAPI
FROM python:3.11-slim
WORKDIR /app

# Instalar dependencias del backend
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir uvicorn

# Copiar el código del backend
COPY api/ ./api/

# Copiar el frontend compilado desde la Etapa 1
COPY --from=build-frontend /app/dist ./dist

# Exponer el puerto (ajustable)
EXPOSE 8000

# Ejecutar la aplicación con Uvicorn
CMD ["uvicorn", "api.index:app", "--host", "0.0.0.0", "--port", "8000"]