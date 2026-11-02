// Comunicación con el backend. Toda la lógica de red está aquí para que
// el componente App solo se ocupe de la interfaz.

/** Respuesta correcta de POST /api/generar. */
export interface GenerarResponse {
  preguntas: string[];
}

/**
 * Envía el texto al backend y devuelve las preguntas generadas.
 * Si algo falla lanza un Error con un mensaje legible para el usuario.
 */
export async function generarPreguntas(
  texto: string,
  numPreguntas: number,
): Promise<string[]> {
  let respuesta: Response;
  try {
    respuesta = await fetch("/api/generar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto, num_preguntas: numPreguntas }),
    });
  } catch {
    // fetch solo lanza excepción si no hay conexión con el servidor
    throw new Error("No se pudo conectar con el servidor");
  }

  if (!respuesta.ok) {
    throw new Error(await leerMensajeDeError(respuesta));
  }

  const datos: GenerarResponse = await respuesta.json();
  return datos.preguntas;
}

/**
 * Extrae un mensaje de error comprensible de una respuesta fallida de FastAPI.
 * - Errores controlados (502, 504...): { "detail": "mensaje" }
 * - Errores de validación (422):      { "detail": [ { "msg": "..." } ] }
 */
async function leerMensajeDeError(respuesta: Response): Promise<string> {
  try {
    const cuerpo = await respuesta.json();
    if (typeof cuerpo.detail === "string") return cuerpo.detail;
    if (Array.isArray(cuerpo.detail) && cuerpo.detail[0]?.msg) {
      return cuerpo.detail[0].msg;
    }
  } catch {
    // el cuerpo no era JSON: usamos el mensaje genérico de abajo
  }
  return `Error inesperado (código ${respuesta.status})`;
}
