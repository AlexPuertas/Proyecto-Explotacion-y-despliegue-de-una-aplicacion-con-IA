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

// Fecha de hoy escrita como en un diario ("martes, 3 de noviembre de 2026")
const HOY = new Date().toLocaleDateString("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

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
    <div className="mesa">
    <main className="hoja">
      <p className="fecha">{HOY}</p>

      {/* Cabecera: título a la izquierda y control de sesión a la derecha */}
      <header className="cabecera">
        <div>
          <h1 className="titulo">Estud-IA</h1>
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
        <p className="aviso">Inicia sesión para usar Estud-IA.</p>
      </SignedOut>

      <SignedIn>
        <form onSubmit={enviar} className="formulario">
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
              className="campo-texto"
              placeholder="Pega aquí el texto que quieres repasar..."
            />
            <p className="contador">
              {texto.length}/{MAX_TEXTO} caracteres
            </p>
          </div>

          <label htmlFor="num" className="etiqueta">
            Quiero
            <input
              id="num"
              type="number"
              min={1}
              max={10}
              value={numPreguntas}
              onChange={(e) => setNumPreguntas(Number(e.target.value))}
              className="campo-numero"
            />
            preguntas
          </label>

          <div className="acciones">
            <button type="submit" disabled={cargando || !textoValido} className="boton">
              {cargando ? "Generando..." : "Generar preguntas"}
            </button>
          </div>
        </form>

        {/* Mensaje de error comprensible */}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}

        {/* Resultado */}
        {preguntas.length > 0 && (
          <section className="resultado">
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
    </div>
  );
}