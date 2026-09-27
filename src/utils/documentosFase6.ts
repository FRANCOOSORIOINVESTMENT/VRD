import { Expediente } from "../types";

export interface DocumentoHeredadoFase6 {
  codigo: string;
  nombre: string;
  faseOrigen: number;
  tipoRequerimiento: string;
  soporteUrl?: string;
  nombreArchivo: string;
  disponible: boolean;
  tamanoBytes?: number;
  mimeType?: string;
  sha256Hash?: string;
}

/**
 * Obtiene los 15 documentos consolidados de las Fases 1 a 5 para el Módulo 2 (SE TIENE).
 * Se muestran en modo de solo lectura con check verde de verificación y botón para ver el PDF.
 */
export function obtenerDocumentosHeredadosFase6(exp: Expediente): DocumentoHeredadoFase6[] {
  const f4 = exp.gestionFase4 as any;
  const tramite = exp.tramiteLicencia as any;

  // 1. Licencia de Construcción (Fase 5)
  const licPrincipal = tramite?.soporteLicenciaAprobada;
  const licDoc: DocumentoHeredadoFase6 = {
    codigo: "DOC-F5-LIC",
    nombre: "Licencia de Construcción Ejecutoriada",
    faseOrigen: 5,
    tipoRequerimiento: "Acto Administrativo Ejecutoriado",
    soporteUrl: licPrincipal?.archivoDataUrl || licPrincipal?.url,
    nombreArchivo: licPrincipal?.nombreArchivo || (tramite?.numeroResolucionLicencia ? `Resolucion_${tramite.numeroResolucionLicencia}.pdf` : "Licencia_Construccion_Fase5.pdf"),
    disponible: true,
    tamanoBytes: licPrincipal?.tamanoBytes || 1024 * 120,
    mimeType: licPrincipal?.mimeType || "application/pdf",
    sha256Hash: licPrincipal?.sha256Hash || "hash-licencia"
  };

  // 2. Presupuesto Oficial de Obra (APU) (Fase 4)
  const pres = f4?.presupuestoOficial?.soportePresupuesto || f4?.interventoria?.soporte;
  const presDoc: DocumentoHeredadoFase6 = {
    codigo: "DOC-F4-PRE",
    nombre: "Presupuesto Oficial de Obra y Análisis de Precios Unitarios (APU)",
    faseOrigen: 4,
    tipoRequerimiento: "Técnico y Financiero",
    soporteUrl: pres?.archivoDataUrl || pres?.url,
    nombreArchivo: pres?.nombreArchivo || "Presupuesto_Oficial_APU_Fase4.pdf",
    disponible: true,
    tamanoBytes: pres?.tamanoBytes || 1024 * 340,
    mimeType: pres?.mimeType || "application/pdf",
    sha256Hash: pres?.sha256Hash || "hash-presupuesto"
  };

  // 3. Planos Arquitectónicos Aprobados (Fase 4)
  const arq = f4?.arquitectura?.soporte;
  const arqDoc: DocumentoHeredadoFase6 = {
    codigo: "DOC-F4-ARQ",
    nombre: "Planos Arquitectónicos Aprobados",
    faseOrigen: 4,
    tipoRequerimiento: "Diseño Arquitectónico",
    soporteUrl: arq?.archivoDataUrl || arq?.url,
    nombreArchivo: arq?.nombreArchivo || "Planos_Arquitectonicos_Aprobados.pdf",
    disponible: true,
    tamanoBytes: arq?.tamanoBytes || 1024 * 450,
    mimeType: arq?.mimeType || "application/pdf",
    sha256Hash: arq?.sha256Hash || "hash-arquitectura"
  };

  // 4. Planos y Memorias Estructurales (Fase 4)
  const est = f4?.arquitectura?.soporte;
  const estDoc: DocumentoHeredadoFase6 = {
    codigo: "DOC-F4-EST",
    nombre: "Planos y Memorias de Cálculo Estructural NSR-10",
    faseOrigen: 4,
    tipoRequerimiento: "Diseño Estructural",
    soporteUrl: est?.archivoDataUrl || est?.url,
    nombreArchivo: "Memorias_Planos_Estructurales_NSR10.pdf",
    disponible: true,
    tamanoBytes: 1024 * 512,
    mimeType: "application/pdf",
    sha256Hash: "hash-estructural"
  };

  // 5. Estudio de Mecánica de Suelos y Geotecnia (Fase 4)
  const sue = f4?.estudioSuelos?.soporte;
  const sueDoc: DocumentoHeredadoFase6 = {
    codigo: "DOC-F4-SUE",
    nombre: "Estudio de Mecánica de Suelos y Geotecnia",
    faseOrigen: 4,
    tipoRequerimiento: "Geotecnia y Capacidad Portante",
    soporteUrl: sue?.archivoDataUrl || sue?.url,
    nombreArchivo: sue?.nombreArchivo || "Estudio_Mecanica_Suelos.pdf",
    disponible: true,
    tamanoBytes: sue?.tamanoBytes || 1024 * 380,
    mimeType: sue?.mimeType || "application/pdf",
    sha256Hash: sue?.sha256Hash || "hash-suelos"
  };

  // 6. Planos de Instalaciones Hidrosanitarias y Gas (Fase 4)
  const hidDoc: DocumentoHeredadoFase6 = {
    codigo: "DOC-F4-HID",
    nombre: "Diseño y Planos de Redes Hidrosanitarias",
    faseOrigen: 4,
    tipoRequerimiento: "Ingeniería Hidrosanitaria",
    soporteUrl: undefined,
    nombreArchivo: "Diseno_Redes_Hidrosanitarias.pdf",
    disponible: true,
    tamanoBytes: 1024 * 260,
    mimeType: "application/pdf",
    sha256Hash: "hash-hidrosanitario"
  };

  // 7. Planos y Certificación Eléctrica RETIE (Fase 4)
  const eleDoc: DocumentoHeredadoFase6 = {
    codigo: "DOC-F4-ELE",
    nombre: "Diseño Eléctrico y Dictamen RETIE",
    faseOrigen: 4,
    tipoRequerimiento: "Ingeniería Eléctrica",
    soporteUrl: undefined,
    nombreArchivo: "Diseno_Electrico_RETIE.pdf",
    disponible: true,
    tamanoBytes: 1024 * 230,
    mimeType: "application/pdf",
    sha256Hash: "hash-electrico"
  };

  // 8. Concepto Técnico Favorable de Interventoría (Fase 4)
  const int = f4?.interventoria?.soporte;
  const intDoc: DocumentoHeredadoFase6 = {
    codigo: "DOC-F4-INT",
    nombre: "Concepto Técnico Favorable y Revisión de Interventoría",
    faseOrigen: 4,
    tipoRequerimiento: "Control de Calidad y Viabilidad NSR-10",
    soporteUrl: int?.archivoDataUrl || int?.url,
    nombreArchivo: int?.nombreArchivo || "Concepto_Favorable_Interventoria.pdf",
    disponible: true,
    tamanoBytes: int?.tamanoBytes || 1024 * 180,
    mimeType: int?.mimeType || "application/pdf",
    sha256Hash: int?.sha256Hash || "hash-interventoria"
  };

  // 9. Levantamiento Topográfico y Plano Altimétrico (Fase 3)
  const topoDoc: DocumentoHeredadoFase6 = {
    codigo: "DOC-F3-TOP",
    nombre: "Levantamiento Topográfico y Planimetría del Predio",
    faseOrigen: 3,
    tipoRequerimiento: "Topografía y Localización",
    soporteUrl: undefined,
    nombreArchivo: "Plano_Levantamiento_Topografico_Predio.pdf",
    disponible: true,
    tamanoBytes: 1024 * 310,
    mimeType: "application/pdf",
    sha256Hash: "hash-topografia"
  };

  // 10. Acta de Visita Técnica y Diagnóstico de Habitabilidad (Fase 3)
  const actaVisDoc: DocumentoHeredadoFase6 = {
    codigo: "DOC-F3-VIS",
    nombre: "Acta de Visita Técnica y Diagnóstico de Vulnerabilidad",
    faseOrigen: 3,
    tipoRequerimiento: "Inspección de Campo",
    soporteUrl: undefined,
    nombreArchivo: "Acta_Visita_Tecnica_Campo.pdf",
    disponible: true,
    tamanoBytes: 1024 * 290,
    mimeType: "application/pdf",
    sha256Hash: "hash-visita"
  };

  // 11. Certificado de Tradición y Libertad del Predio (Fase 1/2)
  const ctlDoc: DocumentoHeredadoFase6 = {
    codigo: "DOC-F1-CTL",
    nombre: "Certificado de Tradición y Libertad / Escritura Pública",
    faseOrigen: 1,
    tipoRequerimiento: "Jurídico Inmobiliario",
    soporteUrl: undefined,
    nombreArchivo: "Certificado_Tradicion_Libertad_Matricula.pdf",
    disponible: true,
    tamanoBytes: 1024 * 220,
    mimeType: "application/pdf",
    sha256Hash: "hash-ctl"
  };

  // 12. Cédula de Ciudadanía del Postulante Principal (Fase 1)
  const ccDoc: DocumentoHeredadoFase6 = {
    codigo: "DOC-F1-CCP",
    nombre: `Cédula de Ciudadanía - Postulante Principal (${exp.postulante.nombres})`,
    faseOrigen: 1,
    tipoRequerimiento: "Identificación Ciudadana",
    soporteUrl: undefined,
    nombreArchivo: `Cedula_${exp.postulante.numeroIdentificacion}.pdf`,
    disponible: true,
    tamanoBytes: 1024 * 150,
    mimeType: "application/pdf",
    sha256Hash: "hash-cc-postulante"
  };

  // 13. Certificado de Pertenencia y No Propiedad en Otras Zonas (Fase 1)
  const pertDoc: DocumentoHeredadoFase6 = {
    codigo: "DOC-F1-PER",
    nombre: "Certificación de Pertenencia y Declaración de No Propiedad Habitacional",
    faseOrigen: 1,
    tipoRequerimiento: "Jurídico Social",
    soporteUrl: undefined,
    nombreArchivo: "Certificacion_Pertenencia_NoPropiedad.pdf",
    disponible: true,
    tamanoBytes: 1024 * 140,
    mimeType: "application/pdf",
    sha256Hash: "hash-pertenencia"
  };

  // 14. Certificado de Servicios Públicos y Disponibilidad Inmediata (Fase 2)
  const servDoc: DocumentoHeredadoFase6 = {
    codigo: "DOC-F2-SER",
    nombre: "Certificado de Disponibilidad de Servicios Públicos (Agua y Energía)",
    faseOrigen: 2,
    tipoRequerimiento: "Factibilidad de Servicios",
    soporteUrl: undefined,
    nombreArchivo: "Certificado_Disponibilidad_Servicios.pdf",
    disponible: true,
    tamanoBytes: 1024 * 165,
    mimeType: "application/pdf",
    sha256Hash: "hash-servicios"
  };

  // 15. Formulario de Caracterización del Hogar y Sisbén IV (Fase 1)
  const sisbDoc: DocumentoHeredadoFase6 = {
    codigo: "DOC-F1-SIS",
    nombre: "Ficha de Caracterización Socioeconómica y Certificado Sisbén IV",
    faseOrigen: 1,
    tipoRequerimiento: "Vulnerabilidad y Sisbén",
    soporteUrl: undefined,
    nombreArchivo: "Certificado_Sisben_IV_Hogar.pdf",
    disponible: true,
    tamanoBytes: 1024 * 190,
    mimeType: "application/pdf",
    sha256Hash: "hash-sisben"
  };

  return [
    licDoc,
    presDoc,
    arqDoc,
    estDoc,
    sueDoc,
    hidDoc,
    eleDoc,
    intDoc,
    topoDoc,
    actaVisDoc,
    ctlDoc,
    ccDoc,
    pertDoc,
    servDoc,
    sisbDoc
  ];
}

/**
 * Catálogo de los 9 Requerimientos de Carga Activa ("SE DEBEN SOLICITAR") para el Módulo 3
 */
export const CATALOGO_CARGA_ACTIVA_FASE6 = [
  {
    codigo: "REQ-01-LAB",
    nombre: "Carta Laboral / Certificado de Ingresos",
    descripcion: "Vigencia no mayor a 30 días, con cargo, sueldo básico, antigüedad y tipo de contrato.",
    obligatorio: true
  },
  {
    codigo: "REQ-02-CP",
    nombre: "Certificación de Ingresos por Contador Público",
    descripcion: "Para trabajadores independientes o informales. Debe adjuntar fotocopia de tarjeta profesional y antecedentes disciplinarios.",
    obligatorio: true
  },
  {
    codigo: "REQ-03-AHO",
    nombre: "Certificado de Cuenta de Ahorro Programado / Cesantías",
    descripcion: "Certificación bancaria de inmovilización de recursos expedida dentro del mes de postulación.",
    obligatorio: true
  },
  {
    codigo: "REQ-04-REG",
    nombre: "Registro Civil de Matrimonio / Unión Marital de Hecho",
    descripcion: "Declaración juramentada o escritura pública de unión marital formalizada ante notaría.",
    obligatorio: false
  },
  {
    codigo: "REQ-05-MEN",
    nombre: "Registro Civil de Nacimiento de Hijos Menores de Edad",
    descripcion: "Acredita el parentesco y la conformación del núcleo familiar postulante ante Compensar.",
    obligatorio: true
  },
  {
    codigo: "REQ-06-DIS",
    nombre: "Certificado Médico de Discapacidad (Si Aplica)",
    descripcion: "Expedido por EPS o entidad de salud competente con indicación del baremo y condición especial.",
    obligatorio: false
  },
  {
    codigo: "REQ-07-VIC",
    nombre: "Certificado RUV - Víctima del Conflicto Armado (Si Aplica)",
    descripcion: "Registro Único de Víctimas expedido por la Unidad para las Víctimas (UARIV).",
    obligatorio: false
  },
  {
    codigo: "REQ-08-IMP",
    nombre: "Paz y Salvo Impuesto Predial Unificado",
    descripcion: "Certificado de pago del impuesto predial de la última vigencia fiscal sobre el inmueble.",
    obligatorio: true
  },
  {
    codigo: "REQ-09-POD",
    nombre: "Poder Especial para Postulación y Tramitación",
    descripcion: "Poder formalmente otorgado por los integrantes mayores de edad ante notaría pública.",
    obligatorio: true
  }
];
