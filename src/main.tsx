// Punto de entrada: monta la aplicación React dentro del <div id="root"> de index.html.
// ClerkProvider da a toda la aplicación acceso a la sesión del usuario.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";
import "./index.css";

// Clave PÚBLICA de Clerk (empieza por "pk_test_"). Se define en el .env como
// VITE_CLERK_PUBLISHABLE_KEY. No es un secreto: va dentro del código del navegador.
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const raiz = createRoot(document.getElementById("root")!);

if (!clerkKey) {
  // Mensaje claro en pantalla si falta la configuración
  raiz.render(
    <p className="p-6 text-red-700">
      Falta VITE_CLERK_PUBLISHABLE_KEY en el archivo .env. Añádela y reinicia{" "}
      <code>npm run dev</code>.
    </p>,
  );
} else {
  raiz.render(
    <StrictMode>
      <ClerkProvider publishableKey={clerkKey} afterSignOutUrl="/">
        <App />
      </ClerkProvider>
    </StrictMode>,
  );
}
