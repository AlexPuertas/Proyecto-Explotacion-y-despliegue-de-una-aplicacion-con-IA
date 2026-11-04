# =============================================================================
# Imagen ÚNICA con la aplicación completa (frontend React compilado + FastAPI)
# =============================================================================
# Construcción por etapas: la etapa 1 compila el frontend y se descarta; la
# imagen final solo contiene Python, el backend y el frontend ya compilado.
# Sigue siendo UN solo contenedor al ejecutarse.

# ---------------------------------------------------------------------------
# Etapa 1: compilar el frontend (Node)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS build-frontend
WORKDIR /app

# IMPORTANTE: la clave PÚBLICA de Clerk se incrusta en el JavaScript al compilar
# (Vite solo lee las variables VITE_* durante "npm run build"). Por eso se pasa
# con --build-arg y no al ejecutar el contenedor. No es un secreto (pk_test_...).
# Si la cambias, hay que RECONSTRUIR la imagen.
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

# Primero solo los archivos de dependencias: así Docker reutiliza la caché
# si el código cambia pero las dependencias no.
COPY package.json package-lock.json ./
RUN npm ci

# Código del frontend y compilación (genera la carpeta /app/dist)
COPY index.html tsconfig.json vite.config.ts ./
COPY src/ ./src/
RUN npm run build

# ---------------------------------------------------------------------------
# Etapa 2: imagen final (Python + FastAPI)
# ---------------------------------------------------------------------------
FROM python:3.11-slim
WORKDIR /app

# Dependencias del backend (uvicorn ya está en requirements.txt)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Código del backend y frontend compilado (FastAPI sirve /dist si existe)
COPY api/ ./api/
COPY --from=build-frontend /app/dist ./dist

# Los SECRETOS (clave de IA, etc.) NO van aquí: se inyectan al ejecutar con
#   docker run --env-file <archivo privado> ...
EXPOSE 8000

# "docker ps" mostrará (healthy) si /api/health responde. Usamos Python porque
# la imagen slim no trae curl.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

# 0.0.0.0 = escuchar en todas las interfaces del contenedor (si no, el puerto
# publicado en el host no sería accesible).
CMD ["uvicorn", "api.index:app", "--host", "0.0.0.0", "--port", "8000"]
