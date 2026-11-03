// Configuración de Vite (el servidor de desarrollo y el compilador del frontend).
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Lee el archivo .env de la raíz del proyecto (el mismo que usa el backend).
  // Al navegador SOLO llegan las variables que empiezan por VITE_ (las públicas).
  envDir: "..",
  server: {
    // En desarrollo, todo lo que empiece por /api se reenvía al backend FastAPI.
    // Así el frontend usa rutas relativas ("/api/generar") igual que en producción
    // y no hace falta configurar CORS.
       proxy: { "/api": "http://127.0.0.1:8000" },
  },
});
