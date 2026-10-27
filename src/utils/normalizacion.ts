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
 * Genera el nombre estandarizado de archivo para la cédula de un integrante del hogar.
 * Formato oficial: `cedula_integrante_[nombre]_[identificacion].pdf`
 * Ejemplo: `cedula_integrante_andres_franco_1018945678.pdf`
 */
export function generarNombreArchivoCedulaEstandar(
  nombrePersona: string,
  numeroIdentificacion: string,
  extension: string = "pdf"
): string {
  const nombreLimpio = normalizarTextoNombre(nombrePersona)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const idLimpia = String(numeroIdentificacion || "")
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "");
  const extLimpia = (extension || "pdf").replace(/^\.+/, "").toLowerCase();
  return `cedula_integrante_${nombreLimpio || "integrante"}_${idLimpia || "doc"}.${extLimpia}`;
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
  numeroIdentificacion?: string;
  tipoIdentificacion?: string;
  telefonoSecundario?: string;
}

const NOMBRES_COMUNES_SEGUNDO = new Set([
  "MARIA", "MARY", "JOSE", "JUAN", "LUZ", "ANA", "CARLOS", "LUIS", "PEDRO", "JORGE",
  "FERNANDO", "ROSA", "EMMA", "GLORIA", "SANDRA", "PATRICIA", "PAOLA", "DIANA",
  "CLAUDIA", "ANDRES", "MIGUEL", "JAVIER", "DIEGO", "ALEXANDER", "DAVID", "DANIEL",
  "CAMILO", "CRISTIAN", "FELIPE", "SEBASTIAN", "ALEJANDRO", "MANUEL", "VICTOR",
  "ANGELA", "LILIANA", "ADRIANA", "ESPERANZA", "BLANCA", "CECILIA", "MARLEN",
  "YOLANDA", "STELLA", "ELIZABETH", "CARMEN", "CONSUELO", "MERCEDES", "PILAR",
  "TERESA", "ALBA", "LUCIA", "ELENA", "ISABEL", "MARGARITA", "ROCIO", "BEATRIZ",
  "AURA", "NELSON", "EDGAR", "OSCAR", "EDWIN", "CESAR", "JAIME", "HECTOR",
  "GUSTAVO", "HUGO", "ORLANDO", "ALVARO", "GERMAN", "HERNAN", "FABIO", "RICARDO",
  "JULIO", "DARIO", "MARIO", "WILSON", "FREDY", "JHON", "YONNY", "JEFFERSON",
  "BRAYAN", "MAURICIO", "EDUARDO", "ALEXIS", "ALONSO", "ANTONIO", "ARTURO",
  "ESTEBAN", "GABRIEL", "GONZALO", "GUILLERMO", "IGNACIO", "IVAN", "JESUS",
  "LEONARDO", "MARTIN", "NICOLAS", "PABLO", "RAFAEL", "RAMIRO", "RAUL",
  "ROBERTO", "RODOLFO", "RODRIGO", "RUBEN", "SAMUEL", "SAUL", "SERGIO", "VICENTE"
]);

const APELLIDOS_COMUNES_COLOMBIA = new Set([
  "RODRIGUEZ", "GOMEZ", "GONZALEZ", "MARTINEZ", "GARCIA", "LOPEZ", "HERNANDEZ",
  "SANCHEZ", "RAMIREZ", "PEREZ", "DIAZ", "MUNOZ", "ROJAS", "MORENO", "JIMENEZ",
  "ORTIZ", "CASTRO", "VARGAS", "ALVAREZ", "TORRES", "RUIZ", "SUAREZ", "GUTIERREZ",
  "ROMERO", "VALENCIA", "QUINTERO", "RESTREPO", "VELASQUEZ", "CARVAJAL", "OSORIO",
  "MENDOZA", "GUZMAN", "CARDONA", "AGUDELO", "RIVERA", "HERRERA", "MEDINA",
  "CASTILLO", "FLOREZ", "MORALES", "VASQUEZ", "CORREA", "ZAPATA", "PARRA",
  "MONTOYA", "ARANGO", "CANO", "LONDONO", "SALAZAR", "SERRANO", "TRUJILLO",
  "VEGA", "PINZON", "DUQUE", "RICO", "ACOSTA", "AVILA", "BARON", "BERNAL",
  "BUITRAGO", "CALDERON", "CAMARGO", "CAMPO", "CARDENAS", "CHAPARRO", "CRUZ",
  "DELGADO", "DURAN", "ESPINOSA", "FAJARDO", "FORERO", "FRANCO", "FUENTES",
  "GALINDO", "GARZON", "GIRALDO", "GUERRERO", "LEON", "LOZANO", "MARIN",
  "MEJIA", "MOLINA", "MONROY", "MORA", "NINO", "OSPINA", "PADILLA", "PALACIOS",
  "PATINO", "PENA", "PINEDA", "POLANIA", "PRADA", "PUERTO", "REYES", "RINCON",
  "RIOS", "RIVAS", "ROA", "ROBLEDO", "SALGADO", "SANDOVAL", "SANABRIA",
  "SILVA", "SIERRA", "SOLER", "SOTO", "TOBON", "TRIANA", "URIBE", "VALDERRAMA",
  "VELASCO", "VERGARA", "VILLAMIZAR", "VILLALOBOS", "VILLEGAS", "YEPES", "ZAMBRANO"
]);

/**
 * Codifica los 4 componentes de nombre, cédula y campos clave en una etiqueta de metadatos segura para persistir en texto.
 */
export function codificarNombresMetadata(partes: {
  primerNombre?: string;
  segundoNombre?: string;
  primerApellido?: string;
  segundoApellido?: string;
  numeroIdentificacion?: string;
  cedula?: string;
  tipoIdentificacion?: string;
  telefonoSecundario?: string;
}): string {
  const json = JSON.stringify({
    pn: partes.primerNombre || "",
    sn: partes.segundoNombre || "",
    pa: partes.primerApellido || "",
    sa: partes.segundoApellido || "",
    doc: (partes.numeroIdentificacion || partes.cedula || "").trim(),
    tdoc: (partes.tipoIdentificacion || "CC").trim(),
    tel2: (partes.telefonoSecundario || "").trim()
  });
  return `[META_NOMBRES:${json}]`;
}

/**
 * Decodifica la etiqueta de metadatos si está presente en el texto.
 */
export function decodificarNombresMetadata(texto?: string | null): PartesNombre | null {
  if (!texto) return null;
  const match = texto.match(/\[META_NOMBRES:(\{.*?\})\]/);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]);
    if (data.pn || data.pa || data.doc) {
      return {
        primerNombre: normalizarTextoNombre(data.pn),
        segundoNombre: normalizarTextoNombre(data.sn),
        primerApellido: normalizarTextoNombre(data.pa),
        segundoApellido: normalizarTextoNombre(data.sa),
        numeroIdentificacion: data.doc ? String(data.doc).trim() : undefined,
        tipoIdentificacion: data.tdoc ? String(data.tdoc).trim() : undefined,
        telefonoSecundario: data.tel2 ? String(data.tel2).trim() : undefined
      };
    }
  } catch {}
  return null;
}

/**
 * Remueve la etiqueta de metadatos de nombres del texto para visualización limpia al usuario.
 */
export function limpiarTextoMetadata(texto?: string | null): string {
  if (!texto) return "";
  return texto.replace(/\[META_NOMBRES:\{.*?\}\]/g, "").trim();
}

/**
 * Descompone un nombre completo en sus 4 componentes oficiales:
 * Primer Nombre, Segundo Nombre (opcional), Primer Apellido, Segundo Apellido (opcional).
 * En la convención colombiana/latinoamericana:
 * - 4 palabras (ej: "JUAN CARLOS PEREZ GOMEZ"):
 *   primerNombre: JUAN, segundoNombre: CARLOS, primerApellido: PEREZ, segundoApellido: GOMEZ
 * - 3 palabras:
 *   Distingue inteligentemente si la segunda palabra es un segundo nombre de pila (ej: "ROSA EMMA HERNANDEZ")
 *   o si es un primer apellido (ej: "PEDRO RODRIGUEZ MORA").
 * - 2 palabras (ej: "CARLOS MENDOZA"):
 *   primerNombre: CARLOS, segundoNombre: "", primerApellido: MENDOZA, segundoApellido: ""
 * - 1 palabra (ej: "CARLOS"):
 *   primerNombre: CARLOS, segundoNombre: "", primerApellido: "", segundoApellido: ""
 */
export function descomponerNombreCompleto(nombreCompleto?: string | null): PartesNombre {
  if (!nombreCompleto || !nombreCompleto.trim()) {
    return { primerNombre: "", segundoNombre: "", primerApellido: "", segundoApellido: "" };
  }

  // Si contiene metadata codificada, extraerla directamente con fidelidad 100%
  const decodificado = decodificarNombresMetadata(nombreCompleto);
  if (decodificado) return decodificado;

  const palabras = normalizarTextoNombre(limpiarTextoMetadata(nombreCompleto)).split(" ").filter(Boolean);

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
    const [p0, p1, p2] = palabras;
    // Si la segunda palabra es un nombre de pila común o la tercera es un apellido y la segunda no
    if (NOMBRES_COMUNES_SEGUNDO.has(p1) || (!APELLIDOS_COMUNES_COLOMBIA.has(p1) && APELLIDOS_COMUNES_COLOMBIA.has(p2))) {
      return { primerNombre: p0, segundoNombre: p1, primerApellido: p2, segundoApellido: "" };
    }
    // Si la segunda palabra es un apellido común, o por defecto 1 nombre + 2 apellidos
    return { primerNombre: p0, segundoNombre: "", primerApellido: p1, segundoApellido: p2 };
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
