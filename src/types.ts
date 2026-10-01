// CRM VRD — FRANCO OSORIO INVESTMENT S.A.S.
// Tipos e Interfaces TypeScript del Dominio de Negocio

export type RolUsuario = 'administrador' | 'supervisor' | 'comercial' | 'asistente' | 'ingenieria';

export type TipoIdentificacion = 'CC' | 'CE' | 'TI' | 'RC' | 'PAS';

export type EstadoExpediente = 'captacion' | 'en_tramite' | 'en_pausa_aporte' | 'salida_definitiva' | 'construccion_iniciada' | 'cerrado_entregado' | 'subsidio_desembolsado';

export type EstadoRequisito = 'pendiente_carga' | 'recibido_revision' | 'con_observaciones' | 'aceptado';

export type ResultadoRevision = 'ACEPTADO' | 'OBSERVADO';

export type EstadoCarta = 'pendiente_elaborar' | 'pendiente_enviar' | 'enviada';

export interface PerfilUsuario {
  id: string;
  username: string;
  email: string;
  nombreCompleto: string;
  rol: RolUsuario;
  activo: boolean;
  creadoEn: string;
  // Seguridad y autenticación real con bcrypt
  password_hash?: string;
  requiere_cambio_password?: boolean;
  passwordHash?: string;
  requiereCambioPassword?: boolean;
}

export interface ContactoApoyo {
  id: string;
  interesadoId?: string;
  expedienteId?: string;
  nombreCompleto: string;
  relacion: string;
  telefono: string;
  tieneWhatsapp: boolean;
  correo?: string;
  preferenciaContacto?: string;
  creadoEn: string;
}

export interface DocumentoInteresado {
  id: string;
  nombreArchivo: string;
  tipo?: string;
  subidoEn: string;
  tamanoBytes?: number;
}

export const OPCIONES_ORIGEN_CAPTACION: string[] = [
  "Llamada",
  "Visita de Campo",
  "Reunión Comunitaria",
  "Redes Sociales",
  "Referido (General)",
  "Presidentes de Juntas de Acción Comunal (JAC)",
  "Líderes veredales",
  "Cooperativas agrícolas",
  "Asociaciones de productores",
  "Iglesias y organizaciones comunitarias",
  "Alcaldes",
  "Concejales",
  "Funcionarios o enlaces municipales",
  "Propietarios de tiendas, ferreterías y negocios rurales",
  "Técnicos agropecuarios y trabajadores del sector"
];

export interface Interesado {
  id: string;
  primerNombre?: string;
  segundoNombre?: string;
  primerApellido?: string;
  segundoApellido?: string;
  nombreContacto: string; // Nombre completo normalizado en mayúscula sin tildes
  telefono: string;
  tieneWhatsapp: boolean;
  correo?: string;
  departamentoCodigo?: string;
  municipioCodigo?: string;
  vereda?: string;
  origenContacto: string;
  resumenNecesidad?: string;
  comercialAsignadoId: string;
  estadoComercial: string;
  convertidoAExpedienteId?: string;
  creadoEn: string;
  contactosApoyo?: ContactoApoyo[];
  documentosAdjuntos?: DocumentoInteresado[];
  diasExtension?: number;
  fechaCaducidad?: string;
  descartado?: boolean;
  ultimoContactoFecha?: string;
}

export interface Persona {
  id: string;
  tipoIdentificacion: TipoIdentificacion;
  numeroIdentificacion: string;
  primerNombre?: string; // Cambio 6: Primer Nombre (Obligatorio)
  segundoNombre?: string; // Cambio 6: Segundo Nombre (Opcional)
  primerApellido: string; // Cambio 6: Primer Apellido (Obligatorio)
  segundoApellido?: string; // Cambio 6: Segundo Apellido (Opcional)
  nombres: string; // Nombre completo concatenado (ej: "MARTA HELENA FRANCO")
  telefonoPrincipal?: string;
  correo?: string;
}

export interface IntegranteHogar {
  id: string;
  hogarId: string;
  persona: Persona;
  parentesco: string;
  esPostulantePrincipal: boolean;
  // Cambio 2: Gestión de solicitudes de retiro
  retiroPendiente?: boolean;
  solicitudRetiroId?: string;
  motivoRetiroPendiente?: string;
  ultimoRechazoRetiro?: string;
}

export interface SolicitudRetiroCedula {
  id: string;
  expedienteId: string;
  expedienteCodigoVisible: string;
  integranteId: string;
  personaId: string;
  personaNombreCompleto: string;
  numeroIdentificacion: string;
  tipoIdentificacion: TipoIdentificacion;
  parentesco: string;
  solicitadoPorId: string;
  solicitadoPorNombre: string;
  solicitadoPorRol: RolUsuario;
  motivoSolicitud: string;
  fechaSolicitud: string;
  estado: 'pendiente' | 'autorizada' | 'rechazada';
  resueltoPorId?: string;
  resueltoPorNombre?: string;
  fechaResolucion?: string;
  motivoRechazo?: string;
}

export interface Hogar {
  id: string;
  integrantes: IntegranteHogar[];
  observaciones?: string;
}

export interface Predio {
  id: string;
  departamentoCodigo: string;
  municipioCodigo: string; // 5 dígitos
  vereda?: string;
  nombreODireccion: string;
  matriculaInmobiliaria?: string;
  referenciaCatastral?: string;
  esPredioViviendaPrincipal: boolean;
}

export interface InfoRevisionFase {
  estado: 'en_preparacion' | 'en_revision_supervisor' | 'devuelto' | 'aprobado';
  observacionesDevolucion?: string;
  fechaEnvioRevision?: string;
  fechaDecisionSupervisor?: string;
  supervisorId?: string;
  supervisorNombre?: string;
}

export interface Expediente {
  id: string; // UUID Inmutable
  interesadoOrigenId?: string;
  postulante: Persona;
  hogar: Hogar;
  predioVivienda: Predio;
  codigoVisible?: string; // DPMPP-CEDULA-APELLIDO
  estadoGeneral: EstadoExpediente;
  comercialOrigenId: string;
  comercialOrigenNombre?: string;
  responsableGeneralId: string;
  responsableGeneralNombre?: string;
  responsableGeneralRol?: RolUsuario;
  asistenteAsignadoId?: string;
  responsablePrevioRevisionId?: string;
  responsablePrevioRevisionNombre?: string;
  responsablePrevioRevisionRol?: RolUsuario;
  subsanacionFase3Activa?: boolean;
  subsanacionFase3Estado?: "en_correccion_gestor" | "revision_analista" | "aprobado_analista" | "enviado_ingenieria";
  subsanacionFase3DocumentosModificados?: string[];
  subsanacionFase3ObservacionAnalista?: string;
  tieneObservaciones?: boolean;
  fechaPrimerContacto: string;
  fechaIngresoFase1: string;
  faseActual: number; // 1 a 7
  creadoEn: string;
  actualizadoEn: string;
  diasTranscurridos?: number;
  diasEnPausa?: number;
  bloqueadoPorRevision?: boolean; // Cambio 5: Bloqueo genérico por fase
  faseEnRevision?: number; // Fase actualmente en revisión de Supervisor
  motivoDevolucionFase?: string; // Última observación de devolución
  revisionFases?: { [fase: number]: InfoRevisionFase }; // Módulo reutilizable de revisión por fase (Cambio 5)
  estadoFase1?: 'en_preparacion' | 'en_revision_supervisor' | 'devuelto' | 'aprobado';
  fechaEnvioRevisionFase1?: string;
  estadoFase2?: 'en_preparacion' | 'en_revision_supervisor' | 'devuelto' | 'aprobado';
  observacionDevolucionFase2?: string;
  fechaEnvioRevisionFase2?: string;
  fechaDecisionSupervisorFase2?: string;
  // Fase 3: En Validación Inicial Compensar
  validacionCompensar?: EstadoValidacionCompensar;
  // Fase 4: En Recolección de Documentos Técnicos (3 Frentes en Paralelo + Presupuesto Oficial)
  gestionFase4?: GestionFase4;
  // Fase 5: En Trámite de Licencia de Construcción (Seguimiento ante Entidad Municipal / Curaduría)
  tramiteLicencia?: TramiteLicenciaConstruccion;
  // Fase 6: En Postulación (Postulación formal a Compensar e Indicación a Obra)
  postulacionSubsidio?: PostulacionSubsidio;
  // Fase 7: En Construcción y Cobro Subsidio (Hitos de Obra, Documentos de Cierre y Desembolso)
  gestionFase7?: GestionFase7;
  // Solicitudes de rechazo transversal (Cambio 6)
  solicitudRechazo?: SolicitudRechazoHogar;
  historialSolicitudesRechazo?: SolicitudRechazoHogar[];
}

export interface DocumentoEnvioCompensar {
  requisitoCodigo: string;
  requisitoNombre: string;
  documentoId: string;
  versionNumero: number;
  nombreArchivo: string;
  tamanoBytes: number;
  sha256Hash: string;
}

export interface RespuestaCompensar {
  id: string;
  envioId: string;
  fechaRespuesta: string;
  usuarioRegistroId: string;
  usuarioRegistroNombre: string;
  resultado: "aprobado" | "observaciones" | "rechazo_definitivo";
  radicadoOConcepto?: string;
  observacionesDetalladas: string;
  archivoConceptoUrl?: string;
  archivoConceptoNombre?: string;
  documentosConObservacion?: string[]; // Códigos de requisitos observados (ej: ["F2-04", "F2-11"])
}

export interface EnvioCompensar {
  id: string;
  expedienteId: string;
  numeroEnvio: number; // 1, 2, 3...
  fechaEnvio: string; // ISO string
  usuarioEnvioId: string;
  usuarioEnvioNombre: string;
  correoDestinatario: string;
  asunto: string;
  cuerpoMensaje: string;
  documentosIncluidos: DocumentoEnvioCompensar[];
  radicadoOReferencia?: string;
  notasEnvio?: string;
  evidenciaUrl?: string;
  evidenciaNombre?: string;
  evidenciaHash?: string;
  evidenciaMimeType?: string;
  evidenciaTamanoBytes?: number;
  respuesta?: RespuestaCompensar;
}

export interface EstadoValidacionCompensar {
  estadoActual: "sin_enviar" | "pendiente_respuesta" | "con_observaciones" | "aprobado" | "rechazado_definitivo";
  ultimoEnvioId?: string;
  envios: EnvioCompensar[];
  fechaAprobacionFinal?: string;
  radicadoAprobacionFinal?: string;
  archivoConceptoFinalUrl?: string;
  observacionesFinales?: string;
}

// -------------------------------------------------------------
// FASE 4: 3 FRENTES DE TRABAJO EN PARALELO + HISTORIAL DE GESTIÓN
// -------------------------------------------------------------
export type EstadoFrenteFase4 = "pendiente" | "en_gestion" | "solicitado" | "en_proceso" | "completado";

export interface SoporteFrenteFase4 {
  id?: string;
  nombreArchivo: string;
  url?: string;
  archivoDataUrl?: string;
  mimeType?: string;
  tamanoBytes?: number;
  sha256?: string;
  sha256Hash?: string;
  subidoPor?: string;
  subidoEn?: string;
}

export interface RegistroHistorialFrenteFase4 {
  id: string;
  fecha: string;
  usuarioId: string;
  usuarioNombre: string;
  usuarioRol: string;
  accion: string; // ej: "Cambio de estado", "Carga de documento de soporte", "Visita realizada", "Nota de campo"
  estadoAnterior?: EstadoFrenteFase4;
  nuevoEstado?: EstadoFrenteFase4;
  observaciones?: string;
}

export interface FrenteInterventoria {
  estado: EstadoFrenteFase4;
  fechaSolicitud?: string;
  fechaEstimada?: string;
  fechaVisitaRealizada?: string;
  resultadoConcepto?: "aprobado" | "con_observaciones" | "no_favorable" | string;
  observaciones?: string;
  soporte?: SoporteFrenteFase4;
  historial: RegistroHistorialFrenteFase4[];
}

export interface FrenteArquitectura {
  estado: EstadoFrenteFase4;
  fechaSolicitud?: string;
  porcentajeAvance?: number; // 0 a 100
  fechaEntregaEstimada?: string;
  fechaEntregaReal?: string;
  observaciones?: string;
  soporte?: SoporteFrenteFase4;
  historial: RegistroHistorialFrenteFase4[];
}

export interface FrenteEstudioSuelos {
  estado: EstadoFrenteFase4;
  fechaSolicitud?: string;
  fechaRealizacion?: string;
  fechaEntregaEstimada?: string;
  fechaEntregaReal?: string;
  resultadoConcepto?: "viable" | "con_observaciones" | "no_viable" | string;
  observaciones?: string;
  soporte?: SoporteFrenteFase4;
  historial: RegistroHistorialFrenteFase4[];
}

export interface GestionFase4 {
  interventoria: FrenteInterventoria;
  arquitectura: FrenteArquitectura;
  estudioSuelos: FrenteEstudioSuelos;
  actualizadoEn?: string;
}

// -------------------------------------------------------------
// FASE 5: SEGUIMIENTO DE TRÁMITE DE LICENCIA DE CONSTRUCCIÓN
// -------------------------------------------------------------
export type EstadoTramiteLicencia =
  | "sin_radicar"
  | "radicado_en_revision"
  | "con_observaciones"
  | "aprobada"
  | "desistida_rechazada";

export interface SoporteDocumentoLicencia {
  id?: string;
  nombreArchivo: string;
  url?: string;
  archivoDataUrl?: string;
  mimeType?: string;
  tamanoBytes?: number;
  sha256?: string;
  sha256Hash?: string;
  subidoPor?: string;
  subidoEn?: string;
}

export interface RegistroHistorialLicencia {
  id: string;
  fecha: string;
  usuarioId: string;
  usuarioNombre: string;
  usuarioRol: string;
  tipoEvento:
    | "radicacion_inicial"
    | "observaciones_entidad"
    | "radicacion_subsanacion"
    | "aprobacion_licencia"
    | "desistimiento"
    | "nota_gestion";
  titulo: string;
  descripcion?: string;
  numeroRadicado?: string;
  entidadMunicipal?: string;
  soporte?: SoporteDocumentoLicencia;
  estadoResultante: EstadoTramiteLicencia;
}

export interface RondaSubsanacionLicencia {
  id: string;
  numeroRonda: number;
  fechaObservaciones: string;
  numeroActaObservaciones?: string;
  detalleObservaciones: string;
  fechaLimiteSubsanacion?: string;
  soporteObservaciones?: SoporteDocumentoLicencia;
  // Subsanación presentada
  fechaRadicacionSubsanacion?: string;
  numeroRadicadoSubsanacion?: string;
  detalleRespuestaSubsanacion?: string;
  soporteSubsanacion?: SoporteDocumentoLicencia;
  registradoPorId?: string;
  registradoPorNombre?: string;
}

export interface TramiteLicenciaConstruccion {
  estadoActual: EstadoTramiteLicencia;
  entidadMunicipal: string;
  numeroRadicadoInicial?: string;
  fechaRadicacionInicial?: string;
  soporteRadicacionInicial?: SoporteDocumentoLicencia;
  rondasSubsanacion: RondaSubsanacionLicencia[];
  numeroResolucionLicencia?: string;
  fechaExpedicionLicencia?: string;
  fechaEjecutoriaLicencia?: string;
  vigenciaMeses?: number;
  soporteLicenciaAprobada?: SoporteDocumentoLicencia;
  soporteLicenciaAprobadaDocs?: SoporteDocumentoLicencia[];
  observacionesFinales?: string;
  historial: RegistroHistorialLicencia[];
  actualizadoEn?: string;
}

export interface SolicitudRechazoHogar {
  id: string;
  expedienteId: string;
  solicitadoPorId: string;
  solicitadoPorNombre: string;
  solicitadoPorRol: RolUsuario;
  fechaSolicitud: string;
  fase: number;
  motivo: string;
  justificacion: string;
  evidenciaUrl?: string;
  evidenciaNombre?: string;
  estado: "pendiente" | "aprobada" | "desestimada";
  decididoPorId?: string;
  decididoPorNombre?: string;
  fechaDecision?: string;
  observacionDecision?: string;
}

export interface FotoRegistro {
  id: string;
  nombre: string;
  url: string;
  tamanoBytes: number;
  categoria?: string;
  subidoEn: string;
  descripcion?: string;
}

export interface DocVersion {
  id: string;
  documentoId: string;
  versionNumero: number;
  storagePath: string;
  nombreArchivoOriginal: string;
  mimeType: string;
  tamanoBytes: number;
  sha256Hash: string;
  subidoPorId: string;
  subidoPorNombre?: string;
  subidoEn: string;
  urlFirmadaTemporal?: string;
  archivoDataUrl?: string;
  fotos?: FotoRegistro[];
}

export interface Documento {
  id: string;
  expedienteId: string;
  titulo: string;
  personaId?: string;
  predioId?: string;
  versiones: DocVersion[];
  versionActual?: DocVersion;
}

export interface RequisitoCaso {
  id: string;
  expedienteId: string;
  codigoRequisito: string; // F1-01, F1-02, F1-03
  nombre: string;
  descripcion?: string;
  fase: number;
  personaId?: string;
  personaNombre?: string;
  predioId?: string;
  estado: EstadoRequisito;
  esObligatorio: boolean;
  esAdicional: boolean;
  origenFase1?: boolean;
  alertaVigencia?: string;
  documentoAsociado?: Documento;
  ultimaRevision?: RevisionHumana;
}

export interface RevisionHumana {
  id: string;
  requisitoCasoId: string;
  versionDocumentoId: string;
  supervisorId: string;
  supervisorNombre?: string;
  cicloRevision: number;
  resultado: ResultadoRevision;
  observacion?: string;
  fechaRevision: string;
}

export interface NotaConversacion {
  id: string;
  expedienteId?: string;
  interesadoId?: string;
  autorId: string;
  autorNombre?: string;
  personaContactada?: string;
  canal?: string;
  contenido: string;
  fechaGestion?: string;
  creadoEn: string;
  tipo?: string;
}

export interface Tarea {
  id: string;
  expedienteId: string;
  descripcion: string;
  asignadoAId: string;
  asignadoANombre?: string;
  creadoPorId?: string;
  fechaCompromiso?: string;
  estado?: 'pendiente' | 'realizada' | 'cancelada';
  resultado?: string;
  creadoEn: string;
  tipo?: string;
  prioridad?: string;
  titulo?: string;
  completada?: boolean;
}

export interface CartaSalida {
  id: string;
  eventoSalidaId: string;
  comercialId: string;
  comercialNombre?: string;
  estadoCarta: EstadoCarta;
  versionCartaDocId?: string;
  fechaEnvio?: string;
  canalEnvio?: string;
  constanciaEnvioUrl?: string;
  creadoEn: string;
}

export interface EventoSalida {
  id: string;
  expedienteId: string;
  motivo: string;
  fundamento: string;
  decididoPorId: string;
  fechaSalida: string;
  faseAlcanzada: number;
  carta?: CartaSalida;
}

// Función pura de normalización determinista del código visible según regla aprobada:
// DPMPP-CEDULA-PRIMER_APELLIDO_NORMALIZADO
// Retira tildes, convierte Ñ a N, quita espacios en apellidos compuestos (DE LA ROSA -> DELAROSA)
export function calcularCodigoVisible(
  municipioCodigo5Digitos: string,
  numeroIdentificacion: string,
  primerApellido: string
): string | undefined {
  if (!municipioCodigo5Digitos || !numeroIdentificacion || !primerApellido) {
    return undefined;
  }

  const codMun = municipioCodigo5Digitos.trim();
  const cedula = numeroIdentificacion.trim().replace(/\D/g, "");

  // Normalizar apellido: remover acentos diacríticos
  let apellidoNorm = primerApellido
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  // Reemplazar Ñ por N
  apellidoNorm = apellidoNorm.replace(/Ñ/g, "N");

  // Retirar espacios para apellidos compuestos (ej: DE LA ROSA -> DELAROSA)
  apellidoNorm = apellidoNorm.replace(/\s+/g, "");

  if (!codMun || !cedula || !apellidoNorm) {
    return undefined;
  }

  return `${codMun}-${cedula}-${apellidoNorm}`;
}

export interface PlantillaRequisito {
  codigoRequisito: string;
  nombre: string;
  descripcion: string;
  fase: number;
  esObligatorio: boolean;
  esAdicional?: boolean;
  origenFase1?: boolean;
  alertaVigencia?: string;
}

// Plantillas de requisitos oficiales para Fase 1
export const PLANTILLAS_FASE_1: PlantillaRequisito[] = [
  {
    codigoRequisito: "F1-01",
    nombre: "Certificado de tradición y libertad",
    descripcion: "Certificado expedido por la ORIP con vigencia no mayor a 90 días calendario.",
    fase: 1,
    esObligatorio: true
  },
  {
    codigoRequisito: "F1-02",
    nombre: "Impuesto predial",
    descripcion: "Último recibo o paz y salvo del impuesto predial unificado.",
    fase: 1,
    esObligatorio: true
  },
  {
    codigoRequisito: "F1-03",
    nombre: "Cédula de ciudadanía del postulante",
    descripcion: "Copia legible de la cédula de ciudadanía del titular postulante.",
    fase: 1,
    esObligatorio: true
  }
];

// Plantillas de requisitos oficiales para Fase 2 (11 documentos requeridos por el programa)
export const PLANTILLAS_FASE_2: PlantillaRequisito[] = [
  {
    codigoRequisito: "F2-01",
    nombre: "Cédula",
    descripcion: "Documento de identidad legible del postulante y/o integrantes del hogar. Proveniente de Fase 1.",
    fase: 2,
    esObligatorio: true,
    origenFase1: true
  },
  {
    codigoRequisito: "F2-02",
    nombre: "Arraigo",
    descripcion: "Certificado o constancia de arraigo y permanencia en el territorio emitida por autoridad comunitaria o municipal.",
    fase: 2,
    esObligatorio: true,
    origenFase1: false
  },
  {
    codigoRequisito: "F2-03",
    nombre: "Escritura pública",
    descripcion: "Copia de la escritura pública del predio debidamente protocolizada ante notaría y oficina de registro.",
    fase: 2,
    esObligatorio: true,
    origenFase1: false
  },
  {
    codigoRequisito: "F2-04",
    nombre: "Certificado de tradición y libertad",
    descripcion: "Proveniente de Fase 1. Solo si tiene más de 90 días calendario de expedición se debe reemplazar.",
    fase: 2,
    esObligatorio: true,
    origenFase1: true,
    alertaVigencia: "Reemplazar únicamente si tiene más de 90 días"
  },
  {
    codigoRequisito: "F2-05",
    nombre: "Impuesto predial",
    descripcion: "Proveniente de Fase 1. Solo si hubo cambio de año fiscal se debe actualizar con el del año en curso.",
    fase: 2,
    esObligatorio: true,
    origenFase1: true,
    alertaVigencia: "Actualizar únicamente si hubo cambio de año"
  },
  {
    codigoRequisito: "F2-06",
    nombre: "Uso del suelo",
    descripcion: "Certificado o concepto favorable de uso del suelo expedido por la Secretaría de Planeación Municipal.",
    fase: 2,
    esObligatorio: true,
    origenFase1: false
  },
  {
    codigoRequisito: "F2-07",
    nombre: "Certificado de no riesgo",
    descripcion: "Constancia de que el predio no se encuentra ubicado en zona de alto riesgo o amenaza no mitigable.",
    fase: 2,
    esObligatorio: true,
    origenFase1: false
  },
  {
    codigoRequisito: "F2-08",
    nombre: "Certificado de nomenclatura",
    descripcion: "Certificado oficial de nomenclatura urbana o rural emitido por la alcaldía municipal.",
    fase: 2,
    esObligatorio: true,
    origenFase1: false
  },
  {
    codigoRequisito: "F2-09",
    nombre: "Disponibilidad del servicio público de agua",
    descripcion: "Certificación o factura de disponibilidad del servicio público de acueducto o agua veredal.",
    fase: 2,
    esObligatorio: true,
    origenFase1: false
  },
  {
    codigoRequisito: "F2-10",
    nombre: "Disponibilidad del servicio público de energía",
    descripcion: "Constancia de disponibilidad de servicio de energía eléctrica o factura reciente del operador de red.",
    fase: 2,
    esObligatorio: true,
    origenFase1: false
  },
  {
    codigoRequisito: "F2-11",
    nombre: "Registro fotográfico del predio",
    descripcion: "Registro fotográfico nítido y completo de la vivienda actual, lote, linderos y entorno del predio.",
    fase: 2,
    esObligatorio: true,
    origenFase1: false
  }
];

// ==========================================
// FASE 6: EN POSTULACIÓN (POSTULACIÓN FORMAL A COMPENSAR E INDICACIÓN A OBRA)
// ==========================================
export type EstadoPostulacion =
  | "borrador"                 // Preparando insumos del paquete de postulación
  | "enviada"                  // Enviada a Compensar, en espera de respuesta
  | "observaciones"            // Compensar emitió observaciones / subsanación requerida
  | "aprobada"                 // Respuesta positiva / Subsidio formalmente asignado
  | "indicacion_obra_enviada"; // Indicación de inicio de construcción enviada formalmente al Supervisor

export interface SoporteDocumentoPostulacion {
  nombreArchivo: string;
  url?: string;
  archivoDataUrl?: string;
  mimeType?: string;
  tamanoBytes?: number;
  sha256?: string;
  sha256Hash?: string;
  subidoPor?: string;
  subidoEn?: string;
}

export interface RondaSubsanacionPostulacion {
  id: string;
  numeroRonda: number;
  fechaObservacion: string;
  radicadoObservacion?: string;
  detalleObservaciones: string;
  soporteObservaciones?: SoporteDocumentoPostulacion;
  registradoPorId: string;
  registradoPorNombre: string;
  // Respuesta y subsanación radicada por Ingeniería
  subsanada: boolean;
  fechaSubsanacion?: string;
  radicadoSubsanacion?: string;
  detalleRespuesta?: string;
  soporteSubsanacion?: SoporteDocumentoPostulacion;
  subsanadaPorId?: string;
  subsanadaPorNombre?: string;
}

export interface IndicacionInicioObra {
  id: string;
  fechaIndicacion: string;
  indicadaPorId: string;
  indicadaPorNombre: string;
  indicadaPorRol: string;
  notificadoAId: string;
  notificadoANombre: string;
  notificadoARol: string;
  instruccionesObra: string;
  fechaEstimadaInicioCampo?: string;
  contratistaAsignado?: string;
}

export interface DocumentoReferenciadoPostulacion {
  faseOrigen: number;
  tipo: "licencia" | "presupuesto" | "planos" | "interventoria" | "otro";
  nombre: string;
  descripcion: string;
  identificador: string;
  incluido: boolean;
  soporteUrl?: string;
}

export interface EventoHistorialPostulacion {
  id: string;
  fecha: string;
  tipo: "envio" | "observaciones" | "subsanacion" | "aprobacion" | "indicacion_obra" | "nota";
  titulo: string;
  descripcion: string;
  autorId: string;
  autorNombre: string;
  autorRol: string;
  soporte?: SoporteDocumentoPostulacion;
}

export interface DocumentoCargaActivaFase6 {
  codigo: string;
  nombre: string;
  descripcion: string;
  obligatorio: boolean;
  soporte?: SoporteDocumentoPostulacion;
}

export interface AnexoLibreFase6 {
  id: string;
  titulo: string;
  soporte: SoporteDocumentoPostulacion;
  creadoEn: string;
  creadoPorNombre: string;
}

export interface SoporteMultipredioFase6 {
  id: string;
  matriculaInmobiliariaAdicional?: string;
  observaciones?: string;
  soporte: SoporteDocumentoPostulacion;
  registradoEn: string;
  registradoPorNombre: string;
}

export interface PostulacionSubsidio {
  id: string;
  expedienteId: string;
  estadoActual: EstadoPostulacion;
  entidadPostulacion: string; // "Compensar (Caja de Compensación Familiar)"

  // Paso 1: Envío de Postulación
  fechaEnvio?: string;
  radicadoEnvio?: string;
  enviadoPorId?: string;
  enviadoPorNombre?: string;
  documentosIncluidos: DocumentoReferenciadoPostulacion[];
  observacionesEnvio?: string;
  soporteEnvio?: SoporteDocumentoPostulacion;

  // Paso 2 & 3: Respuesta de Compensar
  fechaRespuesta?: string;
  radicadoRespuesta?: string;
  numeroResolucionAsignacion?: string;
  resultadoRespuesta?: "aprobada" | "observaciones";
  detalleRespuesta?: string;
  soporteRespuesta?: SoporteDocumentoPostulacion;
  registradoPorId?: string;
  registradoPorNombre?: string;

  // Rondas de subsanación si hubo observaciones
  rondasSubsanacion: RondaSubsanacionPostulacion[];

  // Paso Final: Indicación de Inicio de Construcción a Obra (dirigida al Supervisor)
  indicacionObra?: IndicacionInicioObra;

  // Módulos Fase 6 (Macro-especificación de Postulación)
  documentosCargaActiva?: { [codigo: string]: SoporteDocumentoPostulacion };
  soporteMultipredio?: SoporteMultipredioFase6;
  anexosLibres?: AnexoLibreFase6[];

  // Bitácora / Historial de eventos dentro de la fase
  historial: EventoHistorialPostulacion[];

  creadoEn: string;
  actualizadoEn: string;
}

// -------------------------------------------------------------
// FASE 7: EN CONSTRUCCIÓN Y COBRO SUBSIDIO (CAMBIO 13)
// -------------------------------------------------------------
export type CodigoHitoConstruccion =
  | "hito_1_cimentacion"
  | "hito_2_mamposteria"
  | "hito_3_cubierta"
  | "hito_4_acabados";

export interface HitoConstruccion {
  codigo: CodigoHitoConstruccion;
  numero: number; // 1, 2, 3, 4
  nombre: string;
  descripcion: string;
  completado: boolean;
  fechaCumplimiento?: string;
  observaciones?: string;
  registradoPorId?: string;
  registradoPorNombre?: string;
  registradoPorRol?: string;
  fotos: FotoRegistro[];
  actualizadoEn?: string;
}

export interface DocumentoCierreCobro {
  codigo: string; // "F7-01", "F7-02", "F7-03", "F7-04"
  nombre: string;
  descripcion: string;
  estado: "pendiente" | "cargado" | "aceptado";
  nombreArchivo?: string;
  archivoDataUrl?: string;
  mimeType?: string;
  tamanoBytes?: number;
  sha256Hash?: string;
  subidoPorId?: string;
  subidoPorNombre?: string;
  subidoEn?: string;
  fotos?: FotoRegistro[]; // especial para F7-03 (Registro Fotográfico de Entrega de Llaves)
}

export type EstadoDesembolsoCompensar =
  | "pendiente_documentos"
  | "listo_para_solicitar"
  | "solicitado_pendiente_respuesta"
  | "con_observaciones"
  | "desembolsado_confirmado";

export interface SoporteFase7 {
  nombreArchivo: string;
  archivoDataUrl?: string;
  url?: string;
  mimeType?: string;
  tamanoBytes?: number;
  sha256Hash?: string;
  subidoPor?: string;
  subidoEn?: string;
}

export interface RondaSubsanacionDesembolso {
  id: string;
  numeroRonda: number;
  fechaRequerimiento: string;
  radicadoRequerimiento?: string;
  detalleObservaciones: string;
  soporteRequerimiento?: SoporteFase7;
  fechaSubsanacion?: string;
  radicadoSubsanacion?: string;
  detalleSubsanacion?: string;
  subsanadaPorId?: string;
  subsanadaPorNombre?: string;
  soporteSubsanacion?: SoporteFase7;
  subsanada: boolean;
}

export interface SeguimientoDesembolsoCompensar {
  estadoActual: EstadoDesembolsoCompensar;
  entidad: string; // "Compensar (Caja de Compensación Familiar)"
  
  // Paso 1: Envío de Solicitud de Desembolso
  fechaSolicitud?: string;
  radicadoSolicitud?: string;
  solicitadoPorId?: string;
  solicitadoPorNombre?: string;
  documentosIncluidos: string[]; // ["F7-01", "F7-02", "F7-03", "F7-04", ...]
  observacionesSolicitud?: string;
  soporteSolicitud?: SoporteFase7;

  // Paso 2: Observaciones y Rondas de Subsanación
  rondasSubsanacion: RondaSubsanacionDesembolso[];

  // Paso 3: Confirmación del Desembolso
  fechaDesembolso?: string;
  montoDesembolsado?: number; // Campo numérico para reportes financieros
  numeroComprobante?: string;
  soportePago?: SoporteFase7;
  confirmadoPorId?: string;
  confirmadoPorNombre?: string;
  notasCierre?: string;
}

export interface EventoHistorialFase7 {
  id: string;
  fecha: string;
  tipo:
    | "hito_obra"
    | "documento"
    | "solicitud_desembolso"
    | "observaciones"
    | "subsanacion"
    | "desembolso_confirmado"
    | "cierre_expediente"
    | "nota";
  titulo: string;
  descripcion: string;
  autorId: string;
  autorNombre: string;
  autorRol: string;
  soporte?: SoporteFase7;
}

export interface GestionFase7 {
  id: string;
  expedienteId: string;
  estadoGeneralFase7:
    | "en_construccion"
    | "cierre_documental"
    | "tramite_desembolso"
    | "desembolsado_cerrado";

  // Bloque 1: Seguimiento de Hitos de Construcción (Supervisor)
  hitosConstruccion: HitoConstruccion[];
  obraFinalizada: boolean;
  fechaFinalizacionObra?: string;

  // Bloque 2: Documentos para el Cobro del Subsidio
  documentosCierre: DocumentoCierreCobro[];
  documentosCierreCompletos: boolean;

  // Bloque 3: Seguimiento del Desembolso ante Compensar
  desembolso: SeguimientoDesembolsoCompensar;

  // Historial / Bitácora
  historial: EventoHistorialFase7[];

  creadoEn: string;
  actualizadoEn: string;
}

// ==========================================
// TIPOS PARA EL ROL DE ADMINISTRADOR Y CONFIGURACIÓN MAESTRA
// ==========================================

export interface RegistroAuditoriaAdmin {
  id: string;
  fecha: string;
  adminId: string;
  adminNombre: string;
  accion: string;
  detalle: string;
  categoria: "usuarios" | "configuracion" | "reasignacion" | "rechazo" | "sistema";
  metadatos?: Record<string, any>;
}

export interface FaseConfiguracion {
  num: number;
  codigo: string;
  label: string;
  desc: string;
  rolSugerido: RolUsuario;
  colorBadge: string;
  activo: boolean;
}

export interface RequisitoMaestroConfig {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  fase: number;
  esObligatorio: boolean;
  activo: boolean;
  orden: number;
  orientacionTecnica?: string;
}

export interface PlantillasFasesConfig {
  fase4: {
    titulo: string;
    descripcion: string;
    frente1Titulo: string;
    frente1Desc: string;
    frente2Titulo: string;
    frente2Desc: string;
    frente3Titulo: string;
    frente3Desc: string;
  };
  fase5: {
    titulo: string;
    descripcion: string;
    orientacionCuraduria: string;
  };
  fase6: {
    titulo: string;
    descripcion: string;
    instruccionesCompensar: string;
  };
  fase7: {
    titulo: string;
    descripcion: string;
    instruccionesObra: string;
  };
}

export interface MunicipioConfig {
  codigoCompleto: string;
  departamentoCodigo: string;
  municipioCodigo: string;
  departamentoNombre: string;
  municipioNombre: string;
  activo: boolean;
}

export interface ConfiguracionSistema {
  departamentos: { codigo: string; nombre: string; activo: boolean }[];
  municipios: MunicipioConfig[];
  fases: FaseConfiguracion[];
  requisitosMaestros: RequisitoMaestroConfig[];
  plantillasFases: PlantillasFasesConfig;
}

export interface MetricaFaseAdmin {
  fase: number;
  label: string;
  cantidad: number;
  porcentaje: number;
}

export interface MetricaMunicipioAdmin {
  municipio: string;
  departamento: string;
  cantidad: number;
  desembolsados: number;
  totalMonto: number;
}

export interface MetricaResponsableAdmin {
  responsableId: string;
  nombre: string;
  rol: RolUsuario;
  totalAsignados: number;
  enTramite: number;
}

export interface MetricaCuelloBotella {
  fase: number;
  label: string;
  promedioDias: number;
  rezagadosCount: number;
}

export interface ExpedienteRezagadoAdmin {
  id: string;
  codigoVisible: string;
  titular: string;
  faseActual: number;
  diasEnFase: number;
  diasTotales: number;
  responsable: string;
  municipio: string;
  estadoGeneral: string;
}

export interface ReporteFinancieroItem {
  expedienteId: string;
  codigoVisible: string;
  titular: string;
  municipio: string;
  fechaDesembolso?: string;
  montoDesembolsado: number;
  numeroComprobante?: string;
  entidad: string;
}

export interface DashboardMetricasAdmin {
  totalExpedientes: number;
  activosEnTramite: number;
  enPausaAporte: number;
  bloqueadosRevision: number;
  subsidioDesembolsado: number;
  salidaDefinitiva: number;
  totalDesembolsadoCOP: number;
  promedioDesembolsadoCOP: number;
  tiempoPromedioTramiteDias: number;
  porFase: MetricaFaseAdmin[];
  porMunicipio: MetricaMunicipioAdmin[];
  porResponsable: MetricaResponsableAdmin[];
  cuellosDeBotella: MetricaCuelloBotella[];
  expedientesRezagados: ExpedienteRezagadoAdmin[];
  reporteFinanciero: ReporteFinancieroItem[];
}


