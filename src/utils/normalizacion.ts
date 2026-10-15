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

export interface PartesNombre {
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
}

/**
 * Descompone un nombre completo en sus 4 componentes oficiales:
 * Primer Nombre, Segundo Nombre (opcional), Primer Apellido, Segundo Apellido (opcional).
 * En la convención colombiana/latinoamericana:
 * - 4 palabras (ej: "JUAN CARLOS PEREZ GOMEZ"):
 *   primerNombre: JUAN, segundoNombre: CARLOS, primerApellido: PEREZ, segundoApellido: GOMEZ
 * - 3 palabras (ej: "MARTA ROJAS GOMEZ"):
 *   primerNombre: MARTA, segundoNombre: "", primerApellido: ROJAS, segundoApellido: GOMEZ
 * - 2 palabras (ej: "CARLOS MENDOZA"):
 *   primerNombre: CARLOS, segundoNombre: "", primerApellido: MENDOZA, segundoApellido: ""
 * - 1 palabra (ej: "CARLOS"):
 *   primerNombre: CARLOS, segundoNombre: "", primerApellido: "", segundoApellido: ""
 */
export function descomponerNombreCompleto(nombreCompleto?: string | null): PartesNombre {
  if (!nombreCompleto || !nombreCompleto.trim()) {
    return { primerNombre: "", segundoNombre: "", primerApellido: "", segundoApellido: "" };
  }

  const palabras = normalizarTextoNombre(nombreCompleto).split(" ").filter(Boolean);

  if (palabras.length === 0) {
    return { primerNombre: "", segundoNombre: "", primerApellido: "", segundoApellido: "" };
  }
  if (palabras.length === 1) {
    return { primerNombre: palabras[0], segundoNombre: "", primerApellido: "", segundoApellido: "" };
  }
  if (palabras.length === 2) {
    return { primerNombre: palabras[0], segundoNombre: "", primerApellido: palabras[1], segundoApellido: "" };
  }
  if (palabras.length === 3) {
    // 1 nombre + 2 apellidos (estándar común en identificación colombiana)
    return { primerNombre: palabras[0], segundoNombre: "", primerApellido: palabras[1], segundoApellido: palabras[2] };
  }
  if (palabras.length === 4) {
    // 2 nombres + 2 apellidos
    return { primerNombre: palabras[0], segundoNombre: palabras[1], primerApellido: palabras[2], segundoApellido: palabras[3] };
  }

  // 5 o más palabras (nombres o apellidos compuestos)
  return {
    primerNombre: palabras[0],
    segundoNombre: palabras.slice(1, palabras.length - 2).join(" "),
    primerApellido: palabras[palabras.length - 2],
    segundoApellido: palabras[palabras.length - 1]
  };
}
