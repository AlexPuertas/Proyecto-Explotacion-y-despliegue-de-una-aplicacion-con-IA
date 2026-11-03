// Única pantalla de la aplicación: cabecera de sesión + formulario + resultado.
// Los estilos viven en index.css (clases .pagina, .tarjeta, .boton...).
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
    <main className="pagina">
      {/* Cabecera: título a la izquierda y control de sesión a la derecha */}
      <header className="cabecera">
        <div>
          <h1 className="titulo">Generador de preguntas</h1>
          <p className="subtitulo">
            Pega un texto y la IA creará preguntas de repaso.
          </p>
        </div>

        {/* Solo se ve si NO hay sesión: botón que abre el inicio de sesión de Clerk */}
        <SignedOut>
          <SignInButton mode="modal">
            <button className="boton">Iniciar sesión</button>
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
        <p className="aviso">Inicia sesión para usar el generador de preguntas.</p>
      </SignedOut>

      <SignedIn>
        <form onSubmit={enviar} className="tarjeta formulario">
          <div>
            <label htmlFor="texto" className="etiqueta">
              Texto
            </label>
            <textarea
              id="texto"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={MAX_TEXTO}
              rows={8}
              className="campo"
              placeholder="Pega aquí el texto que quieres repasar..."
            />
            <p className="contador">
              {texto.length}/{MAX_TEXTO} caracteres
            </p>
          </div>

          <div>
            <label htmlFor="num" className="etiqueta">
              Número de preguntas
            </label>
            <input
              id="num"
              type="number"
              min={1}
              max={10}
              value={numPreguntas}
              onChange={(e) => setNumPreguntas(Number(e.target.value))}
              className="campo campo-numero"
            />
          </div>

          <button type="submit" disabled={cargando || !textoValido} className="boton">
            {cargando ? "Generando..." : "Generar preguntas"}
          </button>
        </form>

        {/* Mensaje de error comprensible */}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}

        {/* Resultado */}
        {preguntas.length > 0 && (
          <section className="tarjeta resultado">
            <h2 className="resultado-titulo">Preguntas de repaso</h2>
            <ol className="lista-preguntas">
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