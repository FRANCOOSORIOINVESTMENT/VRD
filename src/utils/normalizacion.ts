// CRM VRD — FRANCO OSORIO INVESTMENT S.A.S.
// Utilidades de normalización de nombres y búsqueda (Cambio 4 y Cambio 6)

/**
 * Normaliza cualquier texto de nombre a mayúscula sostenida y sin tildes ni acentos diacríticos.
 * Ejemplo: "Jorge Enrique Cárdenas" -> "JORGE ENRIQUE CARDENAS"
 * Ejemplo: "Andrés Osorio" -> "ANDRES OSORIO"
 */
export function normalizarTextoNombre(texto: string | null | undefined): string {
  if (!texto) return "";
  return texto
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Elimina acentos/tildes
    .toUpperCase()
    .replace(/\s+/g, " ");
}

/**
 * Construye y normaliza el nombre completo a partir de los 4 campos independientes (Cambio 6):
 * Primer Nombre (obligatorio), Segundo Nombre (opcional), Primer Apellido (obligatorio), Segundo Apellido (opcional).
 * Devuelve la concatenación en mayúscula sostenida sin tildes.
 */
export function construirNombreCompleto(
  primerNombre?: string,
  segundoNombre?: string,
  primerApellido?: string,
  segundoApellido?: string
): string {
  const partes = [primerNombre, segundoNombre, primerApellido, segundoApellido]
    .map((p) => (p ? normalizarTextoNombre(p) : ""))
    .filter((p) => p.length > 0);
  return partes.join(" ");
}

/**
 * Comparación para búsquedas que ignora tildes, mayúsculas y minúsculas de forma simétrica.
 */
export function coincideBusquedaTexto(textoOriginal: string | null | undefined, terminoBusqueda: string): boolean {
  if (!terminoBusqueda) return true;
  if (!textoOriginal) return false;
  return normalizarTextoNombre(textoOriginal).includes(normalizarTextoNombre(terminoBusqueda));
}
