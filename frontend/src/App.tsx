// Única pantalla de la aplicación: cabecera de sesión + formulario + resultado.
import { useState, type FormEvent } from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useAuth,
} from "@clerk/clerk-react";
import { generarPreguntas } from "./api";

// Deben coincidir con los límites del backend (api/index.py)
const MIN_TEXTO = 20;
const MAX_TEXTO = 4000;

export default function App() {
  // getToken() pide a Clerk el token de sesión actual (se renueva solo)
  const { getToken } = useAuth();

  // --- Estado de la pantalla ---
  const [texto, setTexto] = useState("");
  const [numPreguntas, setNumPreguntas] = useState(5);
  const [preguntas, setPreguntas] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  // Validación básica en el navegador (el backend vuelve a validar siempre)
  const textoValido = texto.trim().length >= MIN_TEXTO;

  async function enviar(e: FormEvent) {
    e.preventDefault(); // evita que el navegador recargue la página
    setError("");
    setPreguntas([]);

    if (!textoValido) {
      setError(`Escribe al menos ${MIN_TEXTO} caracteres.`);
      return;
    }

    setCargando(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Debes iniciar sesión para generar preguntas.");
      }
      setPreguntas(await generarPreguntas(texto, numPreguntas, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCargando(false); // se ejecuta tanto si va bien como si falla
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      {/* Cabecera: título a la izquierda y control de sesión a la derecha */}
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold">Generador de preguntas</h1>
          <p className="text-gray-600">
            Pega un texto y la IA creará preguntas de repaso.
          </p>
        </div>

        {/* Solo se ve si NO hay sesión: botón que abre el inicio de sesión de Clerk */}
        <SignedOut>
          <SignInButton mode="modal">
            <button className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
              Iniciar sesión
            </button>
          </SignInButton>
        </SignedOut>

        {/* Solo se ve si hay sesión: avatar con menú para cerrar sesión */}
        <SignedIn>
          <UserButton />
        </SignedIn>
      </header>

      {/* Sin sesión no se muestra el formulario. Ojo: esto es solo comodidad;
          la protección real está en el backend, que rechaza con 401. */}
      <SignedOut>
        <p className="rounded bg-gray-100 p-4 text-gray-700">
          Inicia sesión para usar el generador de preguntas.
        </p>
      </SignedOut>

      <SignedIn>
        <form onSubmit={enviar} className="space-y-4">
          <div>
            <label htmlFor="texto" className="mb-1 block font-medium">
              Texto
            </label>
            <textarea
              id="texto"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={MAX_TEXTO}
              rows={8}
              className="w-full rounded border border-gray-300 p-2"
              placeholder="Pega aquí el texto que quieres repasar..."
            />
            <p className="text-sm text-gray-500">
              {texto.length}/{MAX_TEXTO} caracteres
            </p>
          </div>

          <div>
            <label htmlFor="num" className="mb-1 block font-medium">
              Número de preguntas
            </label>
            <input
              id="num"
              type="number"
              min={1}
              max={10}
              value={numPreguntas}
              onChange={(e) => setNumPreguntas(Number(e.target.value))}
              className="w-24 rounded border border-gray-300 p-2"
            />
          </div>

          <button
            type="submit"
            disabled={cargando || !textoValido}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cargando ? "Generando..." : "Generar preguntas"}
          </button>
        </form>

        {/* Mensaje de error comprensible */}
        {error && (
          <p role="alert" className="mt-6 rounded bg-red-100 p-3 text-red-800">
            {error}
          </p>
        )}

        {/* Resultado */}
        {preguntas.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-lg font-semibold">Preguntas de repaso</h2>
            <ol className="list-decimal space-y-2 pl-6">
              {preguntas.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          </section>
        )}
      </SignedIn>
    </main>
  );
}
