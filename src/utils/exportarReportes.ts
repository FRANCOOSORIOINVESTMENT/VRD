import * as XLSX from "xlsx";
import { Expediente } from "../types";
import { CATALOGO_MUNICIPIOS } from "../data/municipios";

/**
 * Nombres oficiales de las 7 fases del Programa Vivienda Rural Digna (VRD)
 */
export const NOMBRES_FASES: Record<number, string> = {
  1: "Fase 1: Filtro y Documentos Prediales Iniciales",
  2: "Fase 2: Aporte del 10% y Documentos del Hogar",
  3: "Fase 3: Visita de Campo y Validación Inicial Compensar",
  4: "Fase 4: Gestión Técnica (Arquitectura, Suelos, Interventoría)",
  5: "Fase 5: Trámite de Licencia de Construcción (Curaduría)",
  6: "Fase 6: Postulación Formal al Subsidio",
  7: "Fase 7: Ejecución de Obra y Desembolso del Subsidio"
};

/**
 * Mapeo de estados generales del expediente a etiquetas legibles
 */
export const ETIQUETAS_ESTADOS: Record<string, string> = {
  en_tramite: "En Trámite Activo",
  en_pausa_aporte: "En Pausa por Ahorro (10%)",
  subsidio_desembolsado: "Subsidio Desembolsado y Cerrado",
  salida_definitiva: "Salida Definitiva (Rechazado)"
};

/**
 * Obtiene el nombre del municipio a partir del código DANE de 5 dígitos
 */
export function resolverNombreMunicipio(codigoDANE?: string): string {
  if (!codigoDANE) return "No registrado";
  const mun = CATALOGO_MUNICIPIOS.find(
    (m) => m.codigoCompleto === codigoDANE || m.municipioCodigo === codigoDANE
  );
  return mun ? mun.municipioNombre : `Municipio (${codigoDANE})`;
}

/**
 * Mapea un array de expedientes a filas estructuradas y normalizadas para exportación.
 */
export function mapearExpedientesParaExportacion(expedientes: Expediente[]): Record<string, any>[] {
  const ahora = Date.now();
  const msPorDia = 1000 * 60 * 60 * 24;

  return expedientes.map((exp, index) => {
    const post = exp.postulante || ({} as any);
    const pred = exp.predioVivienda || ({} as any);

    const nombreCompleto =
      post.nombres ||
      `${post.primerNombre || ""} ${post.segundoNombre || ""} ${post.primerApellido || ""} ${post.segundoApellido || ""}`.trim() ||
      "Sin Nombre";

    const fechaIngreso = exp.fechaIngresoFase1
      ? new Date(exp.fechaIngresoFase1).toLocaleDateString("es-CO")
      : "N/A";

    const fechaInicioMs = exp.fechaIngresoFase1 ? new Date(exp.fechaIngresoFase1).getTime() : ahora;
    const diasCalculados = exp.diasTranscurridos ?? Math.max(0, Math.floor((ahora - fechaInicioMs) / msPorDia));

    return {
      "ÍTEM": index + 1,
      "CÓDIGO EXPEDIENTE": exp.codigoVisible || exp.id,
      "POSTULANTE PRINCIPAL": nombreCompleto,
      "TIPO IDENTIFICACIÓN": post.tipoIdentificacion || "CC",
      "NÚMERO IDENTIFICACIÓN": post.numeroIdentificacion || "N/A",
      "TELÉFONO": post.telefonoPrincipal || "Sin teléfono",
      "CORREO ELECTRÓNICO": post.correo || "No registrado",
      "DEPARTAMENTO": "CUNDINAMARCA",
      "MUNICIPIO": resolverNombreMunicipio(pred.municipioCodigo),
      "CÓDIGO DANE": pred.municipioCodigo || "25899",
      "VEREDA": pred.vereda || "Rural",
      "PREDIO / DIRECCIÓN": pred.nombreODireccion || "Lote rural",
      "MATRÍCULA INMOBILIARIA": pred.matriculaInmobiliaria || "En verificación",
      "CÉDULA CATASTRAL": pred.referenciaCatastral || "En verificación",
      "FASE ACTUAL": NOMBRES_FASES[exp.faseActual] || `Fase ${exp.faseActual}`,
      "NÚMERO DE FASE": exp.faseActual,
      "ESTADO GENERAL": ETIQUETAS_ESTADOS[exp.estadoGeneral] || exp.estadoGeneral,
      "TIENE OBSERVACIONES": exp.tieneObservaciones ? "SÍ" : "NO",
      "GESTOR COMERCIAL": exp.comercialOrigenNombre || "Gestor Asignado",
      "RESPONSABLE GENERAL": exp.responsableGeneralNombre || "Responsable VRD",
      "FECHA INGRESO FASE 1": fechaIngreso,
      "DÍAS EN TRÁMITE": diasCalculados,
      "CANTIDAD INTEGRANTES HOGAR": exp.hogar?.integrantes?.length || 1,
      "ID INTERNO": exp.id
    };
  });
}

/**
 * Exporta el listado de expedientes directamente a un libro de Microsoft Excel (.xlsx)
 * con autoajuste de columnas y hoja de cálculo profesional.
 */
export function exportarExpedientesAExcel(
  expedientes: Expediente[],
  nombreArchivoPersonalizado?: string
): void {
  if (!expedientes || expedientes.length === 0) {
    throw new Error("No hay registros disponibles para exportar a Excel.");
  }

  const filas = mapearExpedientesParaExportacion(expedientes);
  const fechaHoy = new Date().toISOString().split("T")[0];
  const nombreArchivo =
    nombreArchivoPersonalizado || `Reporte_Expedientes_VRD_${fechaHoy}.xlsx`;

  // 1. Crear nuevo libro de trabajo XLSX
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(filas);

  // 2. Definir anchos de columnas sugeridos para legibilidad ejecutiva
  const colWidths = [
    { wch: 6 },  // ÍTEM
    { wch: 26 }, // CÓDIGO EXPEDIENTE
    { wch: 35 }, // POSTULANTE PRINCIPAL
    { wch: 10 }, // TIPO IDENTIFICACIÓN
    { wch: 18 }, // NÚMERO IDENTIFICACIÓN
    { wch: 16 }, // TELÉFONO
    { wch: 25 }, // CORREO ELECTRÓNICO
    { wch: 16 }, // DEPARTAMENTO
    { wch: 22 }, // MUNICIPIO
    { wch: 14 }, // CÓDIGO DANE
    { wch: 20 }, // VEREDA
    { wch: 30 }, // PREDIO / DIRECCIÓN
    { wch: 22 }, // MATRÍCULA INMOBILIARIA
    { wch: 22 }, // CÉDULA CATASTRAL
    { wch: 36 }, // FASE ACTUAL
    { wch: 8 },  // NÚMERO DE FASE
    { wch: 26 }, // ESTADO GENERAL
    { wch: 14 }, // TIENE OBSERVACIONES
    { wch: 26 }, // GESTOR COMERCIAL
    { wch: 26 }, // RESPONSABLE GENERAL
    { wch: 18 }, // FECHA INGRESO FASE 1
    { wch: 16 }, // DÍAS EN TRÁMITE
    { wch: 14 }, // CANTIDAD INTEGRANTES
    { wch: 38 }  // ID INTERNO
  ];
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, "Expedientes VRD");

  // 3. Escribir y descargar el archivo
  XLSX.writeFile(wb, nombreArchivo);
}

/**
 * Exporta el listado de expedientes a formato CSV (.csv) con BOM UTF-8 y delimitador estándar (;).
 * Compatible con Microsoft Excel en español (sin errores de tildes, eñes o caracteres especiales).
 */
export function exportarExpedientesACSV(
  expedientes: Expediente[],
  nombreArchivoPersonalizado?: string
): void {
  if (!expedientes || expedientes.length === 0) {
    throw new Error("No hay registros disponibles para exportar a CSV.");
  }

  const filas = mapearExpedientesParaExportacion(expedientes);
  const fechaHoy = new Date().toISOString().split("T")[0];
  const nombreArchivo =
    nombreArchivoPersonalizado || `Reporte_Expedientes_VRD_${fechaHoy}.csv`;

  const headers = Object.keys(filas[0]);

  // Escapado seguro para campos de texto en CSV
  const escapeCampoCSV = (valor: any): string => {
    if (valor === null || valor === undefined) return '""';
    const str = String(valor).replace(/"/g, '""');
    return `"${str}"`;
  };

  // Construcción de líneas con punto y coma (;) estándar para Windows/Excel hispanohablante
  const lineasCSV = [
    headers.map(escapeCampoCSV).join(";"),
    ...filas.map((f: any) => headers.map((h) => escapeCampoCSV(f[h])).join(";"))
  ];

  // Inyección del Byte Order Mark (\uFEFF) para forzar detección de codificación UTF-8 en Excel
  const contenidoCSV = "\uFEFF" + lineasCSV.join("\r\n");
  const blob = new Blob([contenidoCSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", nombreArchivo);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
