import { SupabaseClient } from "@supabase/supabase-js";
import {
  Expediente,
  RequisitoCaso,
  Documento,
  DocVersion,
  NotaConversacion,
  Tarea,
  Persona,
  Predio,
  Hogar,
  IntegranteHogar,
  EstadoValidacionCompensar,
  GestionFase4,
  TramiteLicenciaConstruccion,
  PostulacionSubsidio,
  GestionFase7
} from "../types";
import { CATALOGO_MUNICIPIOS } from "../data/municipios";

// IDs fijos de usuarios del sistema
const COMERCIAL_ID = "757ef367-c0bd-480a-b294-d5fef041f39c"; // Carlos Mendoza
const ASISTENTE_ID = "ee12d5e6-34cf-4de5-b11a-f256ddde4be2"; // Laura Castillo
const INGENIERIA_ID = "73e7181a-02ea-49a9-afaa-7c58e7097a24"; // Ing. Roberto Salazar
const SUPERVISOR_ID = "f00564c8-adb3-46d2-b154-837b9e7386aa"; // Dra. Helena Ramírez
const ADMIN_ID = "a49c95b6-75da-48cb-a827-0cf4957e8c3b"; // Administrador

export interface ResultadoGeneracionCasos {
  success: boolean;
  totalCasos: number;
  casosCreados: {
    fase: number;
    codigoVisible: string;
    titular: string;
    municipio: string;
    estadoGeneral: string;
  }[];
  mensaje: string;
}

/**
 * Genera y sincroniza un caso de ejemplo realista para cada una de las 7 fases del programa.
 */
export async function generarCasosEjemploParaCadaFase(
  supabaseAdmin: SupabaseClient | null,
  mockDb: any
): Promise<ResultadoGeneracionCasos> {
  const ahora = new Date();
  const fechaIso = ahora.toISOString();

  // Helper para generar fecha pasada
  const diasAtras = (dias: number) => {
    const d = new Date(ahora.getTime() - dias * 24 * 60 * 60 * 1000);
    return d.toISOString();
  };

  // =========================================================================
  // DEFINICIÓN DE LOS 7 CASOS DE EJEMPLO (UNO POR FASE)
  // =========================================================================

  // CASO 1: FASE 1 — COGUA (En Ingreso Hogar - 3 documentos)
  const c1PostulanteId = "11111111-f001-4111-a001-000000000001";
  const c1PredioId = "11111111-f001-4222-a001-000000000001";
  const c1HogarId = "11111111-f001-4333-a001-000000000001";
  const c1ExpId = "11111111-f001-4000-8000-000000000001";
  const c1Codigo = "25200-1014234567-RODRIGUEZ";

  // CASO 2: FASE 2 — ZIPAQUIRÁ (En Solicitud 8 Documentos - Conformación del Hogar)
  const c2PostulanteId = "22222222-f002-4111-a002-000000000002";
  const c2PredioId = "22222222-f002-4222-a002-000000000002";
  const c2HogarId = "22222222-f002-4333-a002-000000000002";
  const c2ExpId = "22222222-f002-4000-8000-000000000002";
  const c2Codigo = "25899-1023456789-CASTILLO";

  // CASO 3: FASE 3 — FACATATIVÁ (En Validación Inicial Compensar)
  const c3PostulanteId = "33333333-f003-4111-a003-000000000003";
  const c3PredioId = "33333333-f003-4222-a003-000000000003";
  const c3HogarId = "33333333-f003-4333-a003-000000000003";
  const c3ExpId = "33333333-f003-4000-8000-000000000003";
  const c3Codigo = "25269-1032456780-HERNANDEZ";

  // CASO 4: FASE 4 — CHOACHÍ (En Recolección de Documentos Técnicos - 3 Frentes)
  const c4PostulanteId = "44444444-f004-4111-a004-000000000004";
  const c4PredioId = "44444444-f004-4222-a004-000000000004";
  const c4HogarId = "44444444-f004-4333-a004-000000000004";
  const c4ExpId = "44444444-f004-4000-8000-000000000004";
  const c4Codigo = "25151-52345678-JIMENEZ";

  // CASO 5: FASE 5 — TABIO (En Trámite de Licencia de Construcción)
  const c5PostulanteId = "55555555-f005-4111-a005-000000000005";
  const c5PredioId = "55555555-f005-4222-a005-000000000005";
  const c5HogarId = "55555555-f005-4333-a005-000000000005";
  const c5ExpId = "55555555-f005-4000-8000-000000000005";
  const c5Codigo = "25785-79456789-VARGAS";

  // CASO 6: FASE 6 — TENJO (En Postulación de Subsidio ante Compensar)
  const c6PostulanteId = "66666666-f006-4111-a006-000000000006";
  const c6PredioId = "66666666-f006-4222-a006-000000000006";
  const c6HogarId = "66666666-f006-4333-a006-000000000006";
  const c6ExpId = "66666666-f006-4000-8000-000000000006";
  const c6Codigo = "25799-80123456-SANCHEZ";

  // CASO 7: FASE 7 — TOCANCIPÁ (En Construcción y Cobro Subsidio)
  const c7PostulanteId = "77777777-f007-4111-a007-000000000007";
  const c7PredioId = "77777777-f007-4222-a007-000000000007";
  const c7HogarId = "77777777-f007-4333-a007-000000000007";
  const c7ExpId = "77777777-f007-4000-8000-000000000007";
  const c7Codigo = "25817-19234567-GUZMAN";

  // Personas
  const personasData: Persona[] = [
    {
      id: c1PostulanteId,
      tipoIdentificacion: "CC",
      numeroIdentificacion: "1014234567",
      primerNombre: "PEDRO",
      segundoNombre: "ANTONIO",
      primerApellido: "RODRIGUEZ",
      segundoApellido: "MORA",
      nombres: "PEDRO ANTONIO",
      telefonoPrincipal: "3114567890",
      correo: "pedro.rodriguez@example.com"
    },
    {
      id: c2PostulanteId,
      tipoIdentificacion: "CC",
      numeroIdentificacion: "1023456789",
      primerNombre: "MARTHA",
      segundoNombre: "ELENA",
      primerApellido: "CASTILLO",
      segundoApellido: "MORALES",
      nombres: "MARTHA ELENA",
      telefonoPrincipal: "3123456789",
      correo: "martha.castillo@example.com"
    },
    {
      id: c3PostulanteId,
      tipoIdentificacion: "CC",
      numeroIdentificacion: "1032456780",
      primerNombre: "ROSA",
      segundoNombre: "INES",
      primerApellido: "HERNANDEZ",
      segundoApellido: "BELTRAN",
      nombres: "ROSA INES",
      telefonoPrincipal: "3145678901",
      correo: "rosa.hernandez@example.com"
    },
    {
      id: c4PostulanteId,
      tipoIdentificacion: "CC",
      numeroIdentificacion: "52345678",
      primerNombre: "HERNANDO",
      primerApellido: "JIMENEZ",
      segundoApellido: "PARDO",
      nombres: "HERNANDO",
      telefonoPrincipal: "3137890123",
      correo: "hernando.jimenez@example.com"
    },
    {
      id: c5PostulanteId,
      tipoIdentificacion: "CC",
      numeroIdentificacion: "79456789",
      primerNombre: "LUIS",
      segundoNombre: "FERNANDO",
      primerApellido: "VARGAS",
      segundoApellido: "SILVA",
      nombres: "LUIS FERNANDO",
      telefonoPrincipal: "3158901234",
      correo: "luis.vargas@example.com"
    },
    {
      id: c6PostulanteId,
      tipoIdentificacion: "CC",
      numeroIdentificacion: "80123456",
      primerNombre: "CARMEN",
      segundoNombre: "ALICIA",
      primerApellido: "SANCHEZ",
      segundoApellido: "PARRA",
      nombres: "CARMEN ALICIA",
      telefonoPrincipal: "3169012345",
      correo: "carmen.sanchez@example.com"
    },
    {
      id: c7PostulanteId,
      tipoIdentificacion: "CC",
      numeroIdentificacion: "19234567",
      primerNombre: "ALVARO",
      primerApellido: "GUZMAN",
      segundoApellido: "TORRES",
      nombres: "ALVARO",
      telefonoPrincipal: "3170123456",
      correo: "alvaro.guzman@example.com"
    }
  ];

  // Predios
  const prediosData: Predio[] = [
    {
      id: c1PredioId,
      departamentoCodigo: "25",
      municipioCodigo: "25200", // Cogua
      vereda: "El Mortiño",
      nombreODireccion: "Finca El Silencio - Lote 3B",
      matriculaInmobiliaria: "176-0034125",
      referenciaCatastral: "25200000100020003000",
      esPredioViviendaPrincipal: true
    },
    {
      id: c2PredioId,
      departamentoCodigo: "25",
      municipioCodigo: "25899", // Zipaquirá
      vereda: "San Jorge",
      nombreODireccion: "Parcela San Isidro - Sector Alto",
      matriculaInmobiliaria: "176-0045612",
      referenciaCatastral: "25899000200030004000",
      esPredioViviendaPrincipal: true
    },
    {
      id: c3PredioId,
      departamentoCodigo: "25",
      municipioCodigo: "25269", // Facatativá
      vereda: "Mancilla",
      nombreODireccion: "Predio El Paraíso - Vía veredal",
      matriculaInmobiliaria: "156-0078912",
      referenciaCatastral: "25269000100040005000",
      esPredioViviendaPrincipal: true
    },
    {
      id: c4PredioId,
      departamentoCodigo: "25",
      municipioCodigo: "25151", // Choachí
      vereda: "Mercadillo",
      nombreODireccion: "Finca La Cristalina",
      matriculaInmobiliaria: "160-0012845",
      referenciaCatastral: "25151000100050006000",
      esPredioViviendaPrincipal: true
    },
    {
      id: c5PredioId,
      departamentoCodigo: "25",
      municipioCodigo: "25785", // Tabio
      vereda: "Río Frío",
      nombreODireccion: "Lote San Antonio - Camino Real",
      matriculaInmobiliaria: "176-0089234",
      referenciaCatastral: "25785000100060007000",
      esPredioViviendaPrincipal: true
    },
    {
      id: c6PredioId,
      departamentoCodigo: "25",
      municipioCodigo: "25799", // Tenjo
      vereda: "Chincé",
      nombreODireccion: "Finca Bellavista - Sector Central",
      matriculaInmobiliaria: "176-0094567",
      referenciaCatastral: "25799000100070008000",
      esPredioViviendaPrincipal: true
    },
    {
      id: c7PredioId,
      departamentoCodigo: "25",
      municipioCodigo: "25817", // Tocancipá
      vereda: "Canavita",
      nombreODireccion: "Parcela El Mirador - Entrada Veredal",
      matriculaInmobiliaria: "176-0067890",
      referenciaCatastral: "25817000100080009000",
      esPredioViviendaPrincipal: true
    }
  ];

  // Hogares
  const hogaresData: Hogar[] = [
    {
      id: c1HogarId,
      observaciones: "Hogar conformado por 2 personas en Cogua. Postulación rural individual.",
      integrantes: [
        {
          id: `int-${c1ExpId}-1`,
          hogarId: c1HogarId,
          parentesco: "postulante_principal",
          esPostulantePrincipal: true,
          persona: personasData[0]
        }
      ]
    },
    {
      id: c2HogarId,
      observaciones: "Hogar conformado por 3 personas (pareja e hija menor) en Zipaquirá.",
      integrantes: [
        {
          id: `int-${c2ExpId}-1`,
          hogarId: c2HogarId,
          parentesco: "postulante_principal",
          esPostulantePrincipal: true,
          persona: personasData[1]
        }
      ]
    },
    {
      id: c3HogarId,
      observaciones: "Hogar monoparental en Facatativá. Expediente completo radicado ante Compensar.",
      integrantes: [
        {
          id: `int-${c3ExpId}-1`,
          hogarId: c3HogarId,
          parentesco: "postulante_principal",
          esPostulantePrincipal: true,
          persona: personasData[2]
        }
      ]
    },
    {
      id: c4HogarId,
      observaciones: "Hogar rural en Choachí. Concepto favorable de Compensar emitido; 3 frentes técnicos activos.",
      integrantes: [
        {
          id: `int-${c4ExpId}-1`,
          hogarId: c4HogarId,
          parentesco: "postulante_principal",
          esPostulantePrincipal: true,
          persona: personasData[3]
        }
      ]
    },
    {
      id: c5HogarId,
      observaciones: "Hogar en Tabio con diseños y estudios concluidos. Trámite de licencia radicado ante planeación.",
      integrantes: [
        {
          id: `int-${c5ExpId}-1`,
          hogarId: c5HogarId,
          parentesco: "postulante_principal",
          esPostulantePrincipal: true,
          persona: personasData[4]
        }
      ]
    },
    {
      id: c6HogarId,
      observaciones: "Hogar en Tenjo con licencia ejecutoriada. Postulación al subsidio familiar radicada ante Compensar.",
      integrantes: [
        {
          id: `int-${c6ExpId}-1`,
          hogarId: c6HogarId,
          parentesco: "postulante_principal",
          esPostulantePrincipal: true,
          persona: personasData[5]
        }
      ]
    },
    {
      id: c7HogarId,
      observaciones: "Hogar en Tocancipá con subsidio asignado. Vivienda rural en construcción y avance de obra.",
      integrantes: [
        {
          id: `int-${c7ExpId}-1`,
          hogarId: c7HogarId,
          parentesco: "postulante_principal",
          esPostulantePrincipal: true,
          persona: personasData[6]
        }
      ]
    }
  ];

  // =========================================================================
  // OBJETOS DE EXPEDIENTE COMPLETOS (FASES 1 A 7)
  // =========================================================================

  // Caso 1: FASE 1
  const exp1: Expediente = {
    id: c1ExpId,
    codigoVisible: c1Codigo,
    estadoGeneral: "en_tramite",
    faseActual: 1,
    comercialOrigenId: COMERCIAL_ID,
    comercialOrigenNombre: "Carlos Mendoza (Gestor Rural)",
    responsableGeneralId: COMERCIAL_ID,
    responsableGeneralNombre: "Carlos Mendoza (Gestor Rural)",
    responsableGeneralRol: "comercial",
    fechaPrimerContacto: diasAtras(12),
    fechaIngresoFase1: diasAtras(10),
    creadoEn: diasAtras(12),
    actualizadoEn: diasAtras(1),
    postulante: personasData[0],
    predioVivienda: prediosData[0],
    hogar: hogaresData[0],
    bloqueadoPorRevision: false,
    revisionFases: {},
    estadoFase1: "en_preparacion",
    estadoFase2: "en_preparacion",
    historialSolicitudesRechazo: [],
    subsanacionFase3Activa: false
  };

  // Caso 2: FASE 2
  const exp2: Expediente = {
    id: c2ExpId,
    codigoVisible: c2Codigo,
    estadoGeneral: "en_tramite",
    faseActual: 2,
    comercialOrigenId: COMERCIAL_ID,
    comercialOrigenNombre: "Carlos Mendoza (Gestor Rural)",
    responsableGeneralId: ASISTENTE_ID,
    responsableGeneralNombre: "Laura Castillo (Gestor Documental)",
    responsableGeneralRol: "asistente",
    fechaPrimerContacto: diasAtras(35),
    fechaIngresoFase1: diasAtras(30),
    creadoEn: diasAtras(35),
    actualizadoEn: diasAtras(2),
    postulante: personasData[1],
    predioVivienda: prediosData[1],
    hogar: hogaresData[1],
    bloqueadoPorRevision: false,
    revisionFases: {
      1: {
        estado: "aprobado",
        supervisorId: SUPERVISOR_ID,
        supervisorNombre: "Dra. Helena Ramírez (Supervisor)",
        fechaDecisionSupervisor: diasAtras(15)
      }
    },
    estadoFase1: "aprobado",
    estadoFase2: "en_preparacion",
    historialSolicitudesRechazo: [],
    subsanacionFase3Activa: false
  };

  // Caso 3: FASE 3
  const valCompensarC3: EstadoValidacionCompensar = {
    estadoActual: "pendiente_respuesta",
    ultimoEnvioId: `env-comp-${c3ExpId}-1`,
    envios: [
      {
        id: `env-comp-${c3ExpId}-1`,
        expedienteId: c3ExpId,
        numeroEnvio: 1,
        fechaEnvio: diasAtras(8),
        usuarioEnvioId: ASISTENTE_ID,
        usuarioEnvioNombre: "Laura Castillo (Gestor Documental)",
        correoDestinatario: "viviendarural.compensar@compensar.com",
        asunto: `Radicación de Viabilidad Inicial - Expediente ${c3Codigo} - Rosa Inés Hernández`,
        cuerpoMensaje:
          "Señores Compensar: Remitimos formalmente el paquete documental de 11 requisitos para el concepto técnico y jurídico inicial de viabilidad.",
        documentosIncluidos: [
          {
            requisitoCodigo: "F2-01",
            requisitoNombre: "Cédula",
            documentoId: `doc-f2-01-${c3ExpId}`,
            versionNumero: 1,
            nombreArchivo: "F2-01_Cedula_Titular.pdf",
            tamanoBytes: 520000,
            sha256Hash: `sha256-${c3ExpId.substring(0, 6)}-F2-01-ok`
          },
          {
            requisitoCodigo: "F2-02",
            requisitoNombre: "Arraigo",
            documentoId: `doc-f2-02-${c3ExpId}`,
            versionNumero: 1,
            nombreArchivo: "F2-02_Arraigo_Veredal.pdf",
            tamanoBytes: 610000,
            sha256Hash: `sha256-${c3ExpId.substring(0, 6)}-F2-02-ok`
          },
          {
            requisitoCodigo: "F2-03",
            requisitoNombre: "Escritura pública",
            documentoId: `doc-f2-03-${c3ExpId}`,
            versionNumero: 1,
            nombreArchivo: "F2-03_Escritura_Notaria2.pdf",
            tamanoBytes: 850000,
            sha256Hash: `sha256-${c3ExpId.substring(0, 6)}-F2-03-ok`
          },
          {
            requisitoCodigo: "F2-04",
            requisitoNombre: "Certificado de tradición y libertad",
            documentoId: `doc-f2-04-${c3ExpId}`,
            versionNumero: 1,
            nombreArchivo: "F2-04_Tradicion_Libertad.pdf",
            tamanoBytes: 740000,
            sha256Hash: `sha256-${c3ExpId.substring(0, 6)}-F2-04-ok`
          },
          {
            requisitoCodigo: "F2-05",
            requisitoNombre: "Impuesto predial",
            documentoId: `doc-f2-05-${c3ExpId}`,
            versionNumero: 1,
            nombreArchivo: "F2-05_Impuesto_Predial_2026.pdf",
            tamanoBytes: 430000,
            sha256Hash: `sha256-${c3ExpId.substring(0, 6)}-F2-05-ok`
          },
          {
            requisitoCodigo: "F2-06",
            requisitoNombre: "Uso del suelo",
            documentoId: `doc-f2-06-${c3ExpId}`,
            versionNumero: 1,
            nombreArchivo: "F2-06_Uso_Suelo_Planeacion.pdf",
            tamanoBytes: 590000,
            sha256Hash: `sha256-${c3ExpId.substring(0, 6)}-F2-06-ok`
          },
          {
            requisitoCodigo: "F2-07",
            requisitoNombre: "Certificado de no riesgo",
            documentoId: `doc-f2-07-${c3ExpId}`,
            versionNumero: 1,
            nombreArchivo: "F2-07_No_Riesgo_Municipal.pdf",
            tamanoBytes: 480000,
            sha256Hash: `sha256-${c3ExpId.substring(0, 6)}-F2-07-ok`
          },
          {
            requisitoCodigo: "F2-08",
            requisitoNombre: "Certificado de nomenclatura",
            documentoId: `doc-f2-08-${c3ExpId}`,
            versionNumero: 1,
            nombreArchivo: "F2-08_Nomenclatura_Rural.pdf",
            tamanoBytes: 410000,
            sha256Hash: `sha256-${c3ExpId.substring(0, 6)}-F2-08-ok`
          },
          {
            requisitoCodigo: "F2-09",
            requisitoNombre: "Disponibilidad de agua",
            documentoId: `doc-f2-09-${c3ExpId}`,
            versionNumero: 1,
            nombreArchivo: "F2-09_Certificado_Agua_Acueducto.pdf",
            tamanoBytes: 670000,
            sha256Hash: `sha256-${c3ExpId.substring(0, 6)}-F2-09-ok`
          },
          {
            requisitoCodigo: "F2-10",
            requisitoNombre: "Disponibilidad de energía",
            documentoId: `doc-f2-10-${c3ExpId}`,
            versionNumero: 1,
            nombreArchivo: "F2-10_Factura_Energia_Enel.pdf",
            tamanoBytes: 640000,
            sha256Hash: `sha256-${c3ExpId.substring(0, 6)}-F2-10-ok`
          },
          {
            requisitoCodigo: "F2-11",
            requisitoNombre: "Registro fotográfico del predio",
            documentoId: `doc-f2-11-${c3ExpId}`,
            versionNumero: 1,
            nombreArchivo: "F2-11_Registro_Fotografico_3Fotos.jpg",
            tamanoBytes: 980000,
            sha256Hash: `sha256-${c3ExpId.substring(0, 6)}-F2-11-ok`
          }
        ],
        radicadoOReferencia: "RAD-CMP-2026-08942",
        notasEnvio: "Expediente con 11 documentos consolidados y validados por Supervisión."
      }
    ]
  };

  const exp3: Expediente = {
    id: c3ExpId,
    codigoVisible: c3Codigo,
    estadoGeneral: "en_tramite",
    faseActual: 3,
    comercialOrigenId: COMERCIAL_ID,
    comercialOrigenNombre: "Carlos Mendoza (Gestor Rural)",
    responsableGeneralId: ASISTENTE_ID,
    responsableGeneralNombre: "Laura Castillo (Gestor Documental)",
    responsableGeneralRol: "asistente",
    fechaPrimerContacto: diasAtras(60),
    fechaIngresoFase1: diasAtras(55),
    creadoEn: diasAtras(60),
    actualizadoEn: diasAtras(3),
    postulante: personasData[2],
    predioVivienda: prediosData[2],
    hogar: hogaresData[2],
    bloqueadoPorRevision: false,
    revisionFases: {
      1: {
        estado: "aprobado",
        supervisorId: SUPERVISOR_ID,
        supervisorNombre: "Dra. Helena Ramírez",
        fechaDecisionSupervisor: diasAtras(45)
      },
      2: {
        estado: "aprobado",
        supervisorId: SUPERVISOR_ID,
        supervisorNombre: "Dra. Helena Ramírez",
        fechaDecisionSupervisor: diasAtras(10)
      }
    },
    estadoFase1: "aprobado",
    estadoFase2: "aprobado",
    validacionCompensar: valCompensarC3,
    historialSolicitudesRechazo: [],
    subsanacionFase3Activa: false
  };

  // Caso 4: FASE 4 (Ingeniería - 3 Frentes Técnicos)
  const gestionFase4C4: GestionFase4 = {
    arquitectura: {
      estado: "en_proceso",
      porcentajeAvance: 65,
      fechaSolicitud: diasAtras(20),
      fechaEntregaEstimada: diasAtras(-10),
      observaciones:
        "Levantamiento topográfico y propuesta arquitectónica de vivienda bioclimática rural en mampostería confinada con 2 habitaciones, baño, cocina y sala-comedor.",
      soporte: {
        nombreArchivo: "Planos_Arquitectonicos_Preliminares_Choachi.pdf",
        tamanoBytes: 1850000,
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(5)
      },
      historial: [
        {
          id: `hist-arq-1-${c4ExpId}`,
          fecha: diasAtras(20),
          usuarioId: INGENIERIA_ID,
          usuarioNombre: "Ing. Roberto Salazar",
          usuarioRol: "ingenieria",
          accion: "Habilitación de frente arquitectónico",
          nuevoEstado: "solicitado",
          observaciones: "Encargo de diseño al taller de arquitectura rural."
        },
        {
          id: `hist-arq-2-${c4ExpId}`,
          fecha: diasAtras(5),
          usuarioId: INGENIERIA_ID,
          usuarioNombre: "Ing. Roberto Salazar",
          usuarioRol: "ingenieria",
          accion: "Avance del 65% y carga de anteproyecto",
          nuevoEstado: "en_proceso",
          observaciones: "Planos de distribución y cortes aprobados por el titular."
        }
      ]
    },
    estudioSuelos: {
      estado: "completado",
      fechaSolicitud: diasAtras(25),
      fechaRealizacion: diasAtras(14),
      fechaEntregaReal: diasAtras(7),
      resultadoConcepto: "viable",
      observaciones:
        "Estudio geotécnico concluido. Capacidad portante admisible de 120 kPa a 1.20 m de profundidad. Cimentación recomendada: vigas de amarre y ciclópeo conforme a NSR-10 Título E.",
      soporte: {
        nombreArchivo: "Informe_Geotecnico_Suelos_NSR10.pdf",
        tamanoBytes: 2450000,
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(7)
      },
      historial: [
        {
          id: `hist-sue-1-${c4ExpId}`,
          fecha: diasAtras(25),
          usuarioId: INGENIERIA_ID,
          usuarioNombre: "Ing. Roberto Salazar",
          usuarioRol: "ingenieria",
          accion: "Contratación de sondeos geotécnicos",
          nuevoEstado: "en_proceso"
        },
        {
          id: `hist-sue-2-${c4ExpId}`,
          fecha: diasAtras(7),
          usuarioId: INGENIERIA_ID,
          usuarioNombre: "Ing. Roberto Salazar",
          usuarioRol: "ingenieria",
          accion: "Aprobación de informe final de suelos",
          nuevoEstado: "completado",
          observaciones: "Suelo firme con alta capacidad portante."
        }
      ]
    },
    interventoria: {
      estado: "solicitado",
      fechaSolicitud: diasAtras(10),
      fechaEstimada: diasAtras(-5),
      observaciones: "Visita de campo agendada con la firma interventora para verificación de linderos e implantación.",
      historial: [
        {
          id: `hist-int-1-${c4ExpId}`,
          fecha: diasAtras(10),
          usuarioId: INGENIERIA_ID,
          usuarioNombre: "Ing. Roberto Salazar",
          usuarioRol: "ingenieria",
          accion: "Solicitud formal de concepto a Interventoría",
          nuevoEstado: "solicitado"
        }
      ]
    },
    actualizadoEn: diasAtras(1)
  };

  const exp4: Expediente = {
    id: c4ExpId,
    codigoVisible: c4Codigo,
    estadoGeneral: "en_tramite",
    faseActual: 4,
    comercialOrigenId: COMERCIAL_ID,
    comercialOrigenNombre: "Carlos Mendoza (Gestor Rural)",
    responsableGeneralId: INGENIERIA_ID,
    responsableGeneralNombre: "Ing. Roberto Salazar (Coordinador Técnico)",
    responsableGeneralRol: "ingenieria",
    fechaPrimerContacto: diasAtras(90),
    fechaIngresoFase1: diasAtras(80),
    creadoEn: diasAtras(90),
    actualizadoEn: diasAtras(1),
    postulante: personasData[3],
    predioVivienda: prediosData[3],
    hogar: hogaresData[3],
    bloqueadoPorRevision: false,
    revisionFases: {
      1: { estado: "aprobado", supervisorId: SUPERVISOR_ID, supervisorNombre: "Dra. Helena Ramírez", fechaDecisionSupervisor: diasAtras(70) },
      2: { estado: "aprobado", supervisorId: SUPERVISOR_ID, supervisorNombre: "Dra. Helena Ramírez", fechaDecisionSupervisor: diasAtras(40) }
    },
    estadoFase1: "aprobado",
    estadoFase2: "aprobado",
    validacionCompensar: {
      estadoActual: "aprobado",
      fechaAprobacionFinal: diasAtras(25),
      radicadoAprobacionFinal: "VAL-CMP-77401",
      observacionesFinales: "Concepto de viabilidad inicial favorable emitido por Compensar. Autorizada formulación técnica.",
      envios: []
    },
    gestionFase4: gestionFase4C4,
    historialSolicitudesRechazo: [],
    subsanacionFase3Activa: false
  };

  // Caso 5: FASE 5 (Trámite Licencia de Construcción)
  const tramiteLicenciaC5: TramiteLicenciaConstruccion = {
    estadoActual: "radicado_en_revision",
    entidadMunicipal: "Secretaría de Planeación y Obras Públicas - Alcaldía de Tabio",
    numeroRadicadoInicial: "LC-TAB-2026-00412",
    fechaRadicacionInicial: diasAtras(18),
    soporteRadicacionInicial: {
      nombreArchivo: "Acta_Radicacion_Licencia_Tabio.pdf",
      tamanoBytes: 890000,
      subidoPor: "Ing. Roberto Salazar",
      subidoEn: diasAtras(18)
    },
    rondasSubsanacion: [],
    historial: [
      {
        id: `hist-lic-1-${c5ExpId}`,
        fecha: diasAtras(20),
        usuarioId: INGENIERIA_ID,
        usuarioNombre: "Ing. Roberto Salazar",
        usuarioRol: "ingenieria",
        tipoEvento: "nota_gestion",
        titulo: "Consolidación de paquete técnico municipal",
        descripcion: "Presupuesto APU oficial ($52.400.000 COP), memorias de cálculo y planos listos para radicación.",
        estadoResultante: "sin_radicar"
      },
      {
        id: `hist-lic-2-${c5ExpId}`,
        fecha: diasAtras(18),
        usuarioId: INGENIERIA_ID,
        usuarioNombre: "Ing. Roberto Salazar",
        usuarioRol: "ingenieria",
        tipoEvento: "radicacion_inicial",
        titulo: "Radicación formal de Licencia Urbanística",
        descripcion: "Expediente radicado bajo el consecutivo LC-TAB-2026-00412. Valla informativa fijada en predio.",
        numeroRadicado: "LC-TAB-2026-00412",
        estadoResultante: "radicado_en_revision"
      }
    ],
    actualizadoEn: diasAtras(2)
  };

  const exp5: Expediente = {
    id: c5ExpId,
    codigoVisible: c5Codigo,
    estadoGeneral: "en_tramite",
    faseActual: 5,
    comercialOrigenId: COMERCIAL_ID,
    comercialOrigenNombre: "Carlos Mendoza (Gestor Rural)",
    responsableGeneralId: INGENIERIA_ID,
    responsableGeneralNombre: "Ing. Roberto Salazar (Coordinador Técnico)",
    responsableGeneralRol: "ingenieria",
    fechaPrimerContacto: diasAtras(130),
    fechaIngresoFase1: diasAtras(120),
    creadoEn: diasAtras(130),
    actualizadoEn: diasAtras(2),
    postulante: personasData[4],
    predioVivienda: prediosData[4],
    hogar: hogaresData[4],
    bloqueadoPorRevision: false,
    revisionFases: {
      1: { estado: "aprobado", supervisorId: SUPERVISOR_ID, supervisorNombre: "Dra. Helena Ramírez", fechaDecisionSupervisor: diasAtras(110) },
      2: { estado: "aprobado", supervisorId: SUPERVISOR_ID, supervisorNombre: "Dra. Helena Ramírez", fechaDecisionSupervisor: diasAtras(80) }
    },
    estadoFase1: "aprobado",
    estadoFase2: "aprobado",
    validacionCompensar: {
      estadoActual: "aprobado",
      fechaAprobacionFinal: diasAtras(60),
      radicadoAprobacionFinal: "VAL-CMP-81023",
      envios: []
    },
    gestionFase4: {
      arquitectura: { estado: "completado", porcentajeAvance: 100, historial: [] },
      estudioSuelos: { estado: "completado", historial: [] },
      interventoria: { estado: "completado", historial: [] }
    },
    tramiteLicencia: tramiteLicenciaC5,
    historialSolicitudesRechazo: [],
    subsanacionFase3Activa: false
  };

  // Caso 6: FASE 6 (Postulación formal a Compensar)
  const postulacionC6: PostulacionSubsidio = {
    id: `post-${c6ExpId}`,
    expedienteId: c6ExpId,
    estadoActual: "enviada",
    entidadPostulacion: "Compensar (Caja de Compensación Familiar)",
    fechaEnvio: diasAtras(14),
    radicadoEnvio: "POST-CMP-2026-1145",
    enviadoPorId: INGENIERIA_ID,
    enviadoPorNombre: "Ing. Roberto Salazar",
    documentosIncluidos: [
      {
        faseOrigen: 5,
        tipo: "licencia",
        nombre: "Licencia de Construcción Ejecutoriada (Resolución LC-2026-0982)",
        descripcion: "Licencia de obra nueva rural expedida por la Secretaría de Planeación de Tenjo.",
        identificador: "RES-LC-2026-0982",
        incluido: true
      },
      {
        faseOrigen: 4,
        tipo: "presupuesto",
        nombre: "Presupuesto Oficial de Obra y Análisis de Precios Unitarios (APU)",
        descripcion: "Presupuesto total de obra por $55.000.000 COP con cierre financiero.",
        identificador: "PRE-APU-TENJO",
        incluido: true
      },
      {
        faseOrigen: 4,
        tipo: "planos",
        nombre: "Planos Arquitectónicos y Estructurales NSR-10 Aprobados",
        descripcion: "Juego completo de planos sellados por la curaduría/planeación.",
        identificador: "PLN-ARQ-EST-NSR10",
        incluido: true
      },
      {
        faseOrigen: 4,
        tipo: "interventoria",
        nombre: "Concepto Favorable y Revisión Técnica de Interventoría",
        descripcion: "Concepto de viabilidad integral emitido por la interventoría técnica.",
        identificador: "CON-INT-FAVORABLE",
        incluido: true
      }
    ],
    observacionesEnvio:
      "Expediente técnico, jurídico y financiero completo radicado ante el Comité de Vivienda de Compensar para la emisión de la resolución de asignación del subsidio.",
    rondasSubsanacion: [],
    documentosCargaActiva: {
      "F6-01": {
        nombreArchivo: "01_Datos_del_proyecto_ANEXO_DOC.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/01_Datos_del_proyecto_ANEXO_DOC.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 180,
        sha256Hash: "sha256-f6-01-anexo-doc-ok",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-02": {
        nombreArchivo: "02_Formulario_de_postulacion_diligenciado.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/02_Formulario_de_postulacion_diligenciado.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 240,
        sha256Hash: "sha256-f6-02-formulario-firmas-ok",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-03": {
        nombreArchivo: "03_Documentos_de_identidad_del_grupo_familiar.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/03_Documentos_de_identidad_del_grupo_familiar.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 310,
        sha256Hash: "sha256-f6-03-cedulas-150-ok",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-04": {
        nombreArchivo: "04_Certificado_de_ingresos_o_certificado_laboral.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/04_Certificado_de_ingresos_o_certificado_laboral.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 190,
        sha256Hash: "sha256-f6-04-laboral-vigente-ok",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-05": {
        nombreArchivo: "05_Paquete_Contador_antecedentes_cedula_tarjeta.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/05_Paquete_Contador_antecedentes_cedula_tarjeta.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 260,
        sha256Hash: "sha256-f6-05-jcc-contador-vigente",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-06": {
        nombreArchivo: "06_Constancia_de_independientes.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/06_Constancia_de_independientes.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 140,
        sha256Hash: "sha256-f6-06-constancia-independiente-ok",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-07": {
        nombreArchivo: "07_Certificado_de_ahorro_programado_y_cesantias.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/07_Certificado_de_ahorro_programado_y_cesantias.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 175,
        sha256Hash: "sha256-f6-07-ahorro-inmovilizado-ok",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-08": {
        nombreArchivo: "08_Documento_civil_matrimonio_extrajuicio.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/08_Documento_civil_matrimonio_extrajuicio.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 160,
        sha256Hash: "sha256-f6-08-registro-civil-ok",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-09": {
        nombreArchivo: "09_Certificado_de_tradicion_y_libertad_Matricula_257_992341.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/09_Certificado_de_tradicion_y_libertad_Matricula_257_992341.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 220,
        sha256Hash: "sha256-f6-09-ctl-tenjo-vigente",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-10": {
        nombreArchivo: "10_Escritura_Publica_No_1842_Notaria_Tenjo.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/10_Escritura_Publica_No_1842_Notaria_Tenjo.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 380,
        sha256Hash: "sha256-f6-10-escritura-separada-ok",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-11": {
        nombreArchivo: "11_Impuesto_predial_vigencia_2026.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/11_Impuesto_predial_vigencia_2026.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 150,
        sha256Hash: "sha256-f6-11-predial-2026-pago",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-12": {
        nombreArchivo: "12_Presupuesto_Oficial_PDF_firmado_Mat_25202_114.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/12_Presupuesto_Oficial_PDF_firmado_Mat_25202_114.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 410,
        sha256Hash: "sha256-f6-12-presupuesto-firmado-ok",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-13": {
        nombreArchivo: "13_Memoria_de_cantidades_de_obra.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/13_Memoria_de_cantidades_de_obra.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 320,
        sha256Hash: "sha256-f6-13-memoria-cantidades-ok",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-14": {
        nombreArchivo: "14_Especificaciones_tecnicas_constructivas_NSR10.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/14_Especificaciones_tecnicas_constructivas_NSR10.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 350,
        sha256Hash: "sha256-f6-14-especificaciones-ok",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-15": {
        nombreArchivo: "15_Acta_y_registro_fotografico_predio.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/15_Acta_y_registro_fotografico_predio.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 650,
        sha256Hash: "sha256-f6-15-fotos-acta-terreno-ok",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-16": {
        nombreArchivo: "16_Planos_de_intervencion_sellados_Curaduria.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/16_Planos_de_intervencion_sellados_Curaduria.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 580,
        sha256Hash: "sha256-f6-16-planos-sellados-ok",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-17": {
        nombreArchivo: "17_Licencia_de_construccion_Resolucion_LC_2026_0982.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/17_Licencia_de_construccion_Resolucion_LC_2026_0982.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 280,
        sha256Hash: "sha256-f6-17-licencia-resolucion-0982",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-18": {
        nombreArchivo: "18_Planos_aprobados_Estructural_Arquitectonico_Implantacion_Electrico_Hidro.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/18_Planos_aprobados_Estructural_Arquitectonico_Implantacion_Electrico_Hidro.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 920,
        sha256Hash: "sha256-f6-18-planos-5-especialidades-aprobados",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-19": {
        nombreArchivo: "19_Nomenclatura_Alcaldia_Tenjo_2026.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/19_Nomenclatura_Alcaldia_Tenjo_2026.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 160,
        sha256Hash: "sha256-f6-19-nomenclatura-2026-ok",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-20": {
        nombreArchivo: "20_Certificado_de_uso_de_suelo_individual_Tenjo_2026.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/20_Certificado_de_uso_de_suelo_individual_Tenjo_2026.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 175,
        sha256Hash: "sha256-f6-20-uso-suelo-2026-ok",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-21": {
        nombreArchivo: "21_Certificado_de_riesgo_individual_Tenjo_2026.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/21_Certificado_de_riesgo_individual_Tenjo_2026.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 165,
        sha256Hash: "sha256-f6-21-riesgo-mitigable-2026-ok",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-23": {
        nombreArchivo: "23_Formato_de_transporte_interventoria_VRD.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/23_Formato_de_transporte_interventoria_VRD.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 190,
        sha256Hash: "sha256-f6-23-transporte-interventoria-ok",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-24": {
        nombreArchivo: "24_Contrato_de_obra_y_mandato_postulacion.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/24_Contrato_de_obra_y_mandato_postulacion.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 310,
        sha256Hash: "sha256-f6-24-contrato-mandato-firmas-ok",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-25": {
        nombreArchivo: "25_Servicios_publicos_Agua_y_Energia_separados.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/25_Servicios_publicos_Agua_y_Energia_separados.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 280,
        sha256Hash: "sha256-f6-25-servicios-separados-vigencia-30dias",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-26": {
        nombreArchivo: "26_Certificado_de_arraigo_rural_JAC.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/26_Certificado_de_arraigo_rural_JAC.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 140,
        sha256Hash: "sha256-f6-26-arraigo-tenjo-ok",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-27": {
        nombreArchivo: "27_Excel_presupuesto_oficial_APU_Tenjo.xlsx",
        url: "expedientes/66666666-f006-4000-8000-000000000006/27_Excel_presupuesto_oficial_APU_Tenjo.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        tamanoBytes: 1024 * 115,
        sha256Hash: "sha256-f6-27-excel-presupuesto-formulas-ok",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      },
      "F6-28": {
        nombreArchivo: "28_Anexo_CONSTANCIA_radicacion_Compensar.pdf",
        url: "expedientes/66666666-f006-4000-8000-000000000006/28_Anexo_CONSTANCIA_radicacion_Compensar.pdf",
        mimeType: "application/pdf",
        tamanoBytes: 1024 * 195,
        sha256Hash: "sha256-f6-28-constancia-institucional-ok",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: diasAtras(16)
      }
    },
    historial: [
      {
        id: `hist-post-1-${c6ExpId}`,
        fecha: diasAtras(14),
        tipo: "envio",
        titulo: "Radicación formal de postulación al subsidio",
        descripcion: "Paquete completo radicado bajo el número POST-CMP-2026-1145 ante Compensar.",
        autorId: INGENIERIA_ID,
        autorNombre: "Ing. Roberto Salazar",
        autorRol: "ingenieria"
      }
    ],
    creadoEn: diasAtras(20),
    actualizadoEn: diasAtras(2)
  };

  const exp6: Expediente = {
    id: c6ExpId,
    codigoVisible: c6Codigo,
    estadoGeneral: "en_tramite",
    faseActual: 6,
    comercialOrigenId: COMERCIAL_ID,
    comercialOrigenNombre: "Carlos Mendoza (Gestor Rural)",
    responsableGeneralId: INGENIERIA_ID,
    responsableGeneralNombre: "Ing. Roberto Salazar (Coordinador Técnico)",
    responsableGeneralRol: "ingenieria",
    fechaPrimerContacto: diasAtras(170),
    fechaIngresoFase1: diasAtras(160),
    creadoEn: diasAtras(170),
    actualizadoEn: diasAtras(2),
    postulante: personasData[5],
    predioVivienda: prediosData[5],
    hogar: hogaresData[5],
    bloqueadoPorRevision: false,
    revisionFases: {
      1: { estado: "aprobado", supervisorId: SUPERVISOR_ID, supervisorNombre: "Dra. Helena Ramírez", fechaDecisionSupervisor: diasAtras(150) },
      2: { estado: "aprobado", supervisorId: SUPERVISOR_ID, supervisorNombre: "Dra. Helena Ramírez", fechaDecisionSupervisor: diasAtras(120) }
    },
    estadoFase1: "aprobado",
    estadoFase2: "aprobado",
    validacionCompensar: {
      estadoActual: "aprobado",
      fechaAprobacionFinal: diasAtras(100),
      radicadoAprobacionFinal: "VAL-CMP-92314",
      envios: []
    },
    gestionFase4: {
      arquitectura: { estado: "completado", porcentajeAvance: 100, historial: [] },
      estudioSuelos: { estado: "completado", historial: [] },
      interventoria: { estado: "completado", historial: [] }
    },
    tramiteLicencia: {
      estadoActual: "aprobada",
      entidadMunicipal: "Secretaría de Planeación - Alcaldía de Tenjo",
      numeroResolucionLicencia: "LC-2026-0982",
      fechaExpedicionLicencia: diasAtras(35),
      fechaEjecutoriaLicencia: diasAtras(25),
      rondasSubsanacion: [],
      historial: []
    },
    postulacionSubsidio: postulacionC6,
    historialSolicitudesRechazo: [],
    subsanacionFase3Activa: false
  };

  // Caso 7: FASE 7 (En Construcción y Cobro Subsidio)
  const gestionFase7C7: GestionFase7 = {
    id: `f7-${c7ExpId}`,
    expedienteId: c7ExpId,
    estadoGeneralFase7: "en_construccion",
    obraFinalizada: false,
    hitosConstruccion: [
      {
        codigo: "hito_1_cimentacion",
        numero: 1,
        nombre: "Cimentación completada",
        descripcion: "Adecuación del terreno, vigas de cimentación, ciclópeo y losa de contrapiso estructural.",
        completado: true,
        fechaCumplimiento: diasAtras(30),
        observaciones:
          "Excavaciones y amarre de vigas en ciclópeo 1:3:6 verificados según planos de cálculo estructural NSR-10. Contrapiso fundido.",
        registradoPorId: SUPERVISOR_ID,
        registradoPorNombre: "Dra. Helena Ramírez (Supervisor)",
        registradoPorRol: "supervisor",
        fotos: [
          {
            id: `foto-h1-1-${c7ExpId}`,
            nombre: "Cimentacion_Losa_Piso.jpg",
            url: "https://images.unsplash.com/photo-1541888946425-d0fbb186156a?w=800&auto=format&fit=crop&q=80",
            tamanoBytes: 245000,
            subidoEn: diasAtras(30),
            categoria: "Cimentación",
            descripcion: "Vaciado de vigas de amarre y contrapiso reforzado con malla electrosoldada."
          }
        ]
      },
      {
        codigo: "hito_2_mamposteria",
        numero: 2,
        nombre: "Mampostería y cubiertas (cuchillas) completadas",
        descripcion: "Levantamiento de muros estructurales, columnetas de confinamiento, vigas de corona y cuchillas/culatas.",
        completado: true,
        fechaCumplimiento: diasAtras(12),
        observaciones:
          "Levantamiento de muros en tolete confinado, columnetas fundidas y culatas de remate a nivel. Obra lista para estructura de techo.",
        registradoPorId: SUPERVISOR_ID,
        registradoPorNombre: "Dra. Helena Ramírez (Supervisor)",
        registradoPorRol: "supervisor",
        fotos: [
          {
            id: `foto-h2-1-${c7ExpId}`,
            nombre: "Mamposteria_Cuchillas.jpg",
            url: "https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?w=800&auto=format&fit=crop&q=80",
            tamanoBytes: 310000,
            subidoEn: diasAtras(12),
            categoria: "Mampostería",
            descripcion: "Muros confinados en tolete con aparejo en soga y vigas de corona fundidas."
          }
        ]
      },
      {
        codigo: "hito_3_cubierta",
        numero: 3,
        nombre: "Cubierta completada",
        descripcion: "Estructura portante de cubierta, cerchas/correas, tejas termoacústicas y caballetes impermeabilizantes.",
        completado: false,
        observaciones: "Montaje de estructura metálica en ejecución actualmente en terreno veredal de Tocancipá.",
        fotos: []
      },
      {
        codigo: "hito_4_acabados",
        numero: 4,
        nombre: "Finalización total de la vivienda con todos los acabados",
        descripcion: "Instalaciones hidrosanitarias, eléctricas, carpintería metálica/madera, pisos, pintura y habitabilidad 100%.",
        completado: false,
        fotos: []
      }
    ],
    documentosCierre: [
      {
        id: `f7-doc-f7-01-${c7ExpId}`,
        codigo: "F7-01",
        nombre: "Acta de Inicio de Contrato (Compensar)",
        descripcion: "Formato oficial de Compensar para el acta de inicio de contrato del subsidio de vivienda.",
        seccion: "formatos_compensar",
        tiposPermitidos: ".pdf,application/pdf",
        estado: "pendiente"
      },
      {
        id: `f7-doc-f7-02-${c7ExpId}`,
        codigo: "F7-02",
        nombre: "Acta de Inicio de Obra (Compensar)",
        descripcion: "Formato oficial de Compensar que certifica el inicio formal de las obras civiles en terreno.",
        seccion: "formatos_compensar",
        tiposPermitidos: ".pdf,application/pdf",
        estado: "pendiente"
      },
      {
        id: `f7-doc-f7-03-${c7ExpId}`,
        codigo: "F7-03",
        nombre: "Acta de Entrega (Compensar)",
        descripcion: "Formato oficial de Compensar para el acta de entrega y cierre técnico entre las partes.",
        seccion: "formatos_compensar",
        tiposPermitidos: ".pdf,application/pdf",
        estado: "pendiente"
      },
      {
        id: `f7-doc-f7-04-${c7ExpId}`,
        codigo: "F7-04",
        nombre: "Certificado de Habitabilidad y Servicios",
        descripcion: "Constancia técnica de servicios públicos domiciliarios activos y plenas condiciones higiénico-sanitarias.",
        seccion: "formatos_cierre_existentes",
        tiposPermitidos: ".pdf,image/*,application/pdf,image/jpeg,image/png",
        estado: "pendiente"
      },
      {
        id: `f7-doc-f7-05-${c7ExpId}`,
        codigo: "F7-05",
        nombre: "Registro Fotográfico de Entrega",
        descripcion: "Evidencia fotográfica en alta resolución y/o reporte consolidado de la vivienda terminada y entrega de llaves.",
        seccion: "formatos_cierre_existentes",
        tiposPermitidos: ".pdf,image/*,application/pdf,image/jpeg,image/png",
        estado: "pendiente"
      },
      {
        id: `f7-doc-f7-06-${c7ExpId}`,
        codigo: "F7-06",
        nombre: "Acta de Recibo a Satisfacción de Vivienda",
        descripcion: "Firma formal de recepción de la vivienda terminada al 100% por el beneficiario y la supervisión técnica.",
        seccion: "formatos_cierre_existentes",
        tiposPermitidos: ".pdf,image/*,application/pdf,image/jpeg,image/png",
        estado: "pendiente"
      }
    ],
    documentosCierreCompletos: false,
    formatosDocumentales: {},
    desembolso: {
      estadoActual: "pendiente_documentos",
      entidad: "Compensar (Caja de Compensación Familiar)",
      documentosIncluidos: ["F7-01", "F7-02", "F7-03", "F7-04", "F7-05", "F7-06"],
      rondasSubsanacion: []
    },
    historial: [
      {
        id: `hist-f7-1-${c7ExpId}`,
        fecha: diasAtras(45),
        tipo: "hito_obra",
        titulo: "Inicio de obra constructiva en campo",
        descripcion: "Replanteo y excavaciones iniciadas en el predio rural de Tocancipá.",
        autorId: SUPERVISOR_ID,
        autorNombre: "Dra. Helena Ramírez",
        autorRol: "supervisor"
      },
      {
        id: `hist-f7-2-${c7ExpId}`,
        fecha: diasAtras(30),
        tipo: "hito_obra",
        titulo: "Hito 1 Aprobado: Cimentación completada",
        descripcion: "Supervisión técnica avala la fundición de vigas y losa de piso.",
        autorId: SUPERVISOR_ID,
        autorNombre: "Dra. Helena Ramírez",
        autorRol: "supervisor"
      },
      {
        id: `hist-f7-3-${c7ExpId}`,
        fecha: diasAtras(12),
        tipo: "hito_obra",
        titulo: "Hito 2 Aprobado: Mampostería completada",
        descripcion: "Supervisión técnica certifica levantamiento de muros y vigas de amarre superior.",
        autorId: SUPERVISOR_ID,
        autorNombre: "Dra. Helena Ramírez",
        autorRol: "supervisor"
      }
    ],
    creadoEn: diasAtras(50),
    actualizadoEn: diasAtras(2)
  };

  const exp7: Expediente = {
    id: c7ExpId,
    codigoVisible: c7Codigo,
    estadoGeneral: "en_tramite",
    faseActual: 7,
    comercialOrigenId: COMERCIAL_ID,
    comercialOrigenNombre: "Carlos Mendoza (Gestor Rural)",
    responsableGeneralId: SUPERVISOR_ID,
    responsableGeneralNombre: "Dra. Helena Ramírez (Supervisor)",
    responsableGeneralRol: "supervisor",
    fechaPrimerContacto: diasAtras(220),
    fechaIngresoFase1: diasAtras(210),
    creadoEn: diasAtras(220),
    actualizadoEn: diasAtras(2),
    postulante: personasData[6],
    predioVivienda: prediosData[6],
    hogar: hogaresData[6],
    bloqueadoPorRevision: false,
    revisionFases: {
      1: { estado: "aprobado", supervisorId: SUPERVISOR_ID, supervisorNombre: "Dra. Helena Ramírez", fechaDecisionSupervisor: diasAtras(190) },
      2: { estado: "aprobado", supervisorId: SUPERVISOR_ID, supervisorNombre: "Dra. Helena Ramírez", fechaDecisionSupervisor: diasAtras(160) }
    },
    estadoFase1: "aprobado",
    estadoFase2: "aprobado",
    validacionCompensar: {
      estadoActual: "aprobado",
      fechaAprobacionFinal: diasAtras(140),
      radicadoAprobacionFinal: "VAL-CMP-66512",
      envios: []
    },
    gestionFase4: {
      arquitectura: { estado: "completado", porcentajeAvance: 100, historial: [] },
      estudioSuelos: { estado: "completado", historial: [] },
      interventoria: { estado: "completado", historial: [] }
    },
    tramiteLicencia: {
      estadoActual: "aprobada",
      entidadMunicipal: "Secretaría de Planeación - Alcaldía de Tocancipá",
      numeroResolucionLicencia: "LC-2026-0419",
      fechaExpedicionLicencia: diasAtras(90),
      fechaEjecutoriaLicencia: diasAtras(80),
      rondasSubsanacion: [],
      historial: []
    },
    postulacionSubsidio: {
      id: `post-${c7ExpId}`,
      expedienteId: c7ExpId,
      estadoActual: "aprobada",
      entidadPostulacion: "Compensar (Caja de Compensación Familiar)",
      numeroResolucionAsignacion: "RES-CMP-2026-4402",
      resultadoRespuesta: "aprobada",
      detalleRespuesta: "Subsidio Familiar de Vivienda Rural asignado por valor de $45.000.000 COP.",
      fechaRespuesta: diasAtras(50),
      documentosIncluidos: [],
      rondasSubsanacion: [],
      historial: [],
      creadoEn: diasAtras(70),
      actualizadoEn: diasAtras(50)
    },
    gestionFase7: gestionFase7C7,
    historialSolicitudesRechazo: [],
    subsanacionFase3Activa: false
  };

  const listaNuevosExpedientes: Expediente[] = [exp1, exp2, exp3, exp4, exp5, exp6, exp7];

  // =========================================================================
  // REQUISITOS Y DOCUMENTOS PARA LOS CASOS
  // =========================================================================
  const nuevosRequisitos: RequisitoCaso[] = [];
  const nuevosDocumentos: Documento[] = [];
  const nuevasVersiones: DocVersion[] = [];

  // Helper para crear documento y versión
  const crearDocYVersion = (
    expId: string,
    reqCodigo: string,
    reqNombre: string,
    esFoto = false
  ) => {
    const docId = `doc-${reqCodigo.toLowerCase()}-${expId}`;
    const verId = `ver-${reqCodigo.toLowerCase()}-${expId}`;
    const ext = esFoto ? "jpg" : "pdf";
    const ver: DocVersion = {
      id: verId,
      documentoId: docId,
      versionNumero: 1,
      storagePath: `expedientes/${expId}/${reqCodigo}_v1.${ext}`,
      nombreArchivoOriginal: `${reqCodigo}_Soporte_Oficial.${ext}`,
      mimeType: esFoto ? "image/jpeg" : "application/pdf",
      tamanoBytes: 420000 + Math.floor(Math.random() * 200000),
      sha256Hash: `sha256-${expId.substring(0, 6)}-${reqCodigo}-verified-v1`,
      subidoPorId: ASISTENTE_ID,
      subidoPorNombre: "Laura Castillo (Gestor Documental)",
      subidoEn: diasAtras(10),
      fotos: esFoto
        ? [
            {
              id: `foto-${expId}-1`,
              nombre: "Fachada_Principal_Lote.jpg",
              url: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=900&auto=format&fit=crop&q=80",
              tamanoBytes: 450000,
              categoria: "Fachada y Lote",
              subidoEn: diasAtras(10)
            },
            {
              id: `foto-${expId}-2`,
              nombre: "Linderos_Zona_Posterior.jpg",
              url: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=900&auto=format&fit=crop&q=80",
              tamanoBytes: 490000,
              categoria: "Linderos",
              subidoEn: diasAtras(10)
            },
            {
              id: `foto-${expId}-3`,
              nombre: "Acceso_Veredal.jpg",
              url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&auto=format&fit=crop&q=80",
              tamanoBytes: 520000,
              categoria: "Acceso vial",
              subidoEn: diasAtras(10)
            }
          ]
        : undefined
    };

    const doc: Documento = {
      id: docId,
      expedienteId: expId,
      titulo: `${reqNombre} - Soporte`,
      versiones: [ver],
      versionActual: ver
    };

    nuevosDocumentos.push(doc);
    nuevasVersiones.push(ver);
    return doc;
  };

  // Requisitos Caso 1 (Fase 1: 3 documentos)
  const req1_1: RequisitoCaso = {
    id: `req-f1-01-${c1ExpId}`,
    expedienteId: c1ExpId,
    codigoRequisito: "F1-01",
    nombre: "Certificado de Tradición y Libertad",
    descripcion: "Antigüedad máxima de 90 días calendario respecto a la revisión.",
    fase: 1,
    predioId: c1PredioId,
    estado: "aceptado",
    esObligatorio: true,
    esAdicional: false,
    documentoAsociado: crearDocYVersion(c1ExpId, "F1-01", "Certificado de Tradición y Libertad")
  };
  const req1_2: RequisitoCaso = {
    id: `req-f1-02-${c1ExpId}`,
    expedienteId: c1ExpId,
    codigoRequisito: "F1-02",
    nombre: "Impuesto Predial Unificado",
    descripcion: "Vigencia del año en curso. Aceptado pagado o sin pagar.",
    fase: 1,
    predioId: c1PredioId,
    estado: "aceptado",
    esObligatorio: true,
    esAdicional: false,
    documentoAsociado: crearDocYVersion(c1ExpId, "F1-02", "Impuesto Predial Unificado")
  };
  const req1_3: RequisitoCaso = {
    id: `req-f1-03-${c1ExpId}`,
    expedienteId: c1ExpId,
    codigoRequisito: "F1-03",
    nombre: "Cédula del Postulante: PEDRO ANTONIO RODRIGUEZ",
    descripcion: "Documento de identidad legible del postulante principal.",
    fase: 1,
    personaId: c1PostulanteId,
    personaNombre: "PEDRO ANTONIO RODRIGUEZ",
    estado: "aceptado",
    esObligatorio: true,
    esAdicional: false,
    documentoAsociado: crearDocYVersion(c1ExpId, "F1-03", "Cédula del Postulante")
  };
  nuevosRequisitos.push(req1_1, req1_2, req1_3);

  // Requisitos para Casos 2 a 7 (Fase 2: F2-01 a F2-11)
  const codigosF2 = [
    { codigo: "F2-01", nombre: "Cédula" },
    { codigo: "F2-02", nombre: "Arraigo" },
    { codigo: "F2-03", nombre: "Escritura pública" },
    { codigo: "F2-04", nombre: "Certificado de tradición y libertad" },
    { codigo: "F2-05", nombre: "Impuesto predial" },
    { codigo: "F2-06", nombre: "Uso del suelo" },
    { codigo: "F2-07", nombre: "Certificado de no riesgo" },
    { codigo: "F2-08", nombre: "Certificado de nomenclatura" },
    { codigo: "F2-09", nombre: "Disponibilidad del servicio público de agua" },
    { codigo: "F2-10", nombre: "Disponibilidad del servicio público de energía" },
    { codigo: "F2-11", nombre: "Registro fotográfico del predio" }
  ];

  [exp2, exp3, exp4, exp5, exp6, exp7].forEach((exp) => {
    // También incluir los de Fase 1 para el caso
    nuevosRequisitos.push(
      {
        id: `req-f1-01-${exp.id}`,
        expedienteId: exp.id,
        codigoRequisito: "F1-01",
        nombre: "Certificado de Tradición y Libertad",
        descripcion: "Antigüedad máxima de 90 días.",
        fase: 1,
        predioId: exp.predioVivienda.id,
        estado: "aceptado",
        esObligatorio: true,
        esAdicional: false,
        documentoAsociado: crearDocYVersion(exp.id, "F1-01", "Certificado de Tradición y Libertad")
      },
      {
        id: `req-f1-02-${exp.id}`,
        expedienteId: exp.id,
        codigoRequisito: "F1-02",
        nombre: "Impuesto Predial Unificado",
        descripcion: "Vigencia del año en curso.",
        fase: 1,
        predioId: exp.predioVivienda.id,
        estado: "aceptado",
        esObligatorio: true,
        esAdicional: false,
        documentoAsociado: crearDocYVersion(exp.id, "F1-02", "Impuesto Predial")
      },
      {
        id: `req-f1-03-${exp.id}`,
        expedienteId: exp.id,
        codigoRequisito: "F1-03",
        nombre: `Cédula del Postulante: ${exp.postulante.nombres} ${exp.postulante.primerApellido}`,
        descripcion: "Documento de identidad legible.",
        fase: 1,
        personaId: exp.postulante.id,
        personaNombre: `${exp.postulante.nombres} ${exp.postulante.primerApellido}`,
        estado: "aceptado",
        esObligatorio: true,
        esAdicional: false,
        documentoAsociado: crearDocYVersion(exp.id, "F1-03", "Cédula")
      }
    );

    // Requisitos de Fase 2
    codigosF2.forEach((cfg) => {
      const esFoto = cfg.codigo === "F2-11";
      const docAsociado = crearDocYVersion(exp.id, cfg.codigo, cfg.nombre, esFoto);
      nuevosRequisitos.push({
        id: `req-${cfg.codigo.toLowerCase()}-${exp.id}`,
        expedienteId: exp.id,
        codigoRequisito: cfg.codigo,
        nombre: cfg.nombre,
        descripcion: `Documento oficial requerido de Fase 2: ${cfg.nombre}`,
        fase: 2,
        predioId: exp.predioVivienda.id,
        personaId: cfg.codigo === "F2-01" ? exp.postulante.id : undefined,
        personaNombre: cfg.codigo === "F2-01" ? `${exp.postulante.nombres} ${exp.postulante.primerApellido}` : undefined,
        estado: "aceptado",
        esObligatorio: true,
        esAdicional: false,
        documentoAsociado: docAsociado
      });
    });

    // Requisitos Fase 5 (F5-01) si fase >= 5
    if (exp.faseActual >= 5) {
      nuevosRequisitos.push({
        id: `req-f5-01-${exp.id}`,
        expedienteId: exp.id,
        codigoRequisito: "F5-01",
        nombre: "Presupuesto Oficial y APU Detallado",
        descripcion: "Análisis de Precios Unitarios regionalizado Cundinamarca y presupuesto oficial de obra.",
        fase: 5,
        predioId: exp.predioVivienda.id,
        estado: "aceptado",
        esObligatorio: true,
        esAdicional: false,
        documentoAsociado: crearDocYVersion(exp.id, "F5-01", "Presupuesto Oficial y APU Detallado")
      });
    }

    // Requisitos Fase 7 (F7-01 a F7-06) si fase >= 7
    if (exp.faseActual >= 7) {
      const reqsF7 = [
        { cod: "F7-01", nom: "Acta de Inicio de Contrato (Compensar)" },
        { cod: "F7-02", nom: "Acta de Inicio de Obra (Compensar)" },
        { cod: "F7-03", nom: "Acta de Entrega (Compensar)" },
        { cod: "F7-04", nom: "Certificado de Habitabilidad y Servicios" },
        { cod: "F7-05", nom: "Registro Fotográfico de Entrega" },
        { cod: "F7-06", nom: "Acta de Recibo a Satisfacción de Vivienda" }
      ];
      reqsF7.forEach((rf7) => {
        nuevosRequisitos.push({
          id: `req-${rf7.cod.toLowerCase()}-${exp.id}`,
          expedienteId: exp.id,
          codigoRequisito: rf7.cod,
          nombre: rf7.nom,
          descripcion: `Documento de cierre y liquidación de Fase 7: ${rf7.nom}`,
          fase: 7,
          predioId: exp.predioVivienda.id,
          estado: "pendiente_carga",
          esObligatorio: true,
          esAdicional: false
        });
      });
    }
  });

  // Tareas y Notas de ejemplo para enriquecer los casos
  const nuevasNotas: NotaConversacion[] = [
    {
      id: `not-c1-${Date.now()}`,
      expedienteId: c1ExpId,
      autorId: COMERCIAL_ID,
      autorNombre: "Carlos Mendoza (Gestor Rural)",
      tipo: "llamada",
      contenido: "Contacto inicial con Don Pedro Antonio. Se confirmó titularidad del predio y se cargaron los primeros 3 documentos.",
      creadoEn: diasAtras(10)
    },
    {
      id: `not-c2-${Date.now()}`,
      expedienteId: c2ExpId,
      autorId: ASISTENTE_ID,
      autorNombre: "Laura Castillo (Gestor Documental)",
      tipo: "gestion",
      contenido: "Recolección de los 11 documentos de Fase 2 en Zipaquirá. Registro fotográfico del predio completado.",
      creadoEn: diasAtras(5)
    },
    {
      id: `not-c3-${Date.now()}`,
      expedienteId: c3ExpId,
      autorId: ASISTENTE_ID,
      autorNombre: "Laura Castillo (Gestor Documental)",
      tipo: "hito",
      contenido: "Paquete de 11 documentos radicado ante Compensar (RAD-CMP-2026-08942) para concepto de viabilidad inicial.",
      creadoEn: diasAtras(8)
    },
    {
      id: `not-c4-${Date.now()}`,
      expedienteId: c4ExpId,
      autorId: INGENIERIA_ID,
      autorNombre: "Ing. Roberto Salazar",
      tipo: "hito",
      contenido: "Estudio geotécnico concluido y aprobado. Planos arquitectónicos con avance del 65%. Interventoría programada.",
      creadoEn: diasAtras(4)
    },
    {
      id: `not-c5-${Date.now()}`,
      expedienteId: c5ExpId,
      autorId: INGENIERIA_ID,
      autorNombre: "Ing. Roberto Salazar",
      tipo: "hito",
      contenido: "Licencia de construcción radicada formalmente ante la Secretaría de Planeación de Tabio (LC-TAB-2026-00412).",
      creadoEn: diasAtras(18)
    },
    {
      id: `not-c6-${Date.now()}`,
      expedienteId: c6ExpId,
      autorId: INGENIERIA_ID,
      autorNombre: "Ing. Roberto Salazar",
      tipo: "hito",
      contenido: "Postulación formal radicada ante Compensar (POST-CMP-2026-1145) con licencia de construcción ejecutoriada y APU.",
      creadoEn: diasAtras(14)
    },
    {
      id: `not-c7-${Date.now()}`,
      expedienteId: c7ExpId,
      autorId: SUPERVISOR_ID,
      autorNombre: "Dra. Helena Ramírez",
      tipo: "hito",
      contenido: "Subsidio asignado por Compensar (RES-CMP-2026-4402). Hitos 1 (Cimentación) y 2 (Mampostería) concluidos con evidencia en obra.",
      creadoEn: diasAtras(12)
    }
  ];

  const nuevasTareas: Tarea[] = [
    {
      id: `tar-c1-${Date.now()}`,
      expedienteId: c1ExpId,
      descripcion: "Revisar legibilidad de cédula y certificado de tradición para remitir a Supervisor.",
      asignadoAId: COMERCIAL_ID,
      asignadoANombre: "Carlos Mendoza (Gestor Rural)",
      creadoPorId: COMERCIAL_ID,
      estado: "pendiente",
      creadoEn: diasAtras(3)
    },
    {
      id: `tar-c2-${Date.now()}`,
      expedienteId: c2ExpId,
      descripcion: "Consolidar los 11 documentos de Fase 2 para someter a aprobación de Supervisor.",
      asignadoAId: ASISTENTE_ID,
      asignadoANombre: "Laura Castillo (Gestor Documental)",
      creadoPorId: ASISTENTE_ID,
      estado: "pendiente",
      creadoEn: diasAtras(2)
    },
    {
      id: `tar-c3-${Date.now()}`,
      expedienteId: c3ExpId,
      descripcion: "Hacer seguimiento telefónico al comité de vivienda de Compensar por radicado RAD-CMP-2026-08942.",
      asignadoAId: ASISTENTE_ID,
      asignadoANombre: "Laura Castillo (Gestor Documental)",
      creadoPorId: ASISTENTE_ID,
      estado: "pendiente",
      creadoEn: diasAtras(4)
    },
    {
      id: `tar-c4-${Date.now()}`,
      expedienteId: c4ExpId,
      descripcion: "Recibir planos finales de arquitectura y coordinar visita de interventoría en terreno.",
      asignadoAId: INGENIERIA_ID,
      asignadoANombre: "Ing. Roberto Salazar",
      creadoPorId: INGENIERIA_ID,
      estado: "pendiente",
      creadoEn: diasAtras(1)
    },
    {
      id: `tar-c5-${Date.now()}`,
      expedienteId: c5ExpId,
      descripcion: "Monitorear expedición de resolución de licencia ante Planeación de Tabio.",
      asignadoAId: INGENIERIA_ID,
      asignadoANombre: "Ing. Roberto Salazar",
      creadoPorId: INGENIERIA_ID,
      estado: "pendiente",
      creadoEn: diasAtras(2)
    },
    {
      id: `tar-c6-${Date.now()}`,
      expedienteId: c6ExpId,
      descripcion: "Verificar publicación de resolución de asignación de subsidio en Compensar.",
      asignadoAId: INGENIERIA_ID,
      asignadoANombre: "Ing. Roberto Salazar",
      creadoPorId: INGENIERIA_ID,
      estado: "pendiente",
      creadoEn: diasAtras(3)
    },
    {
      id: `tar-c7-${Date.now()}`,
      expedienteId: c7ExpId,
      descripcion: "Inspeccionar instalación de vigas de cubierta y fijación de tejas (Hito 3).",
      asignadoAId: SUPERVISOR_ID,
      asignadoANombre: "Dra. Helena Ramírez",
      creadoPorId: SUPERVISOR_ID,
      estado: "pendiente",
      creadoEn: diasAtras(1)
    }
  ];

  // =========================================================================
  // PERSISTENCIA EN SUPABASE POSTGRESQL (SI ESTÁ CONECTADO)
  // =========================================================================
  if (supabaseAdmin) {
    try {
      // 1. Personas
      const personasPayload = personasData.map((p) => ({
        id: p.id,
        tipo_identificacion: p.tipoIdentificacion,
        numero_identificacion: p.numeroIdentificacion,
        nombres: p.nombres,
        primer_apellido: p.primerApellido,
        segundo_apellido: p.segundoApellido || null,
        telefono_principal: p.telefonoPrincipal || null,
        correo: p.correo || null
      }));
      await supabaseAdmin.from("personas").upsert(personasPayload, { onConflict: "id" });

      // 2. Hogares
      const hogaresPayload = hogaresData.map((h) => ({
        id: h.id,
        observaciones: h.observaciones
      }));
      await supabaseAdmin.from("hogares").upsert(hogaresPayload, { onConflict: "id" });

      // 3. Integrantes hogar
      const integrantesPayload = hogaresData.map((h) => ({
        id: h.integrantes[0].id,
        hogar_id: h.id,
        persona_id: h.integrantes[0].persona.id,
        parentesco: h.integrantes[0].parentesco,
        es_postulante_principal: true
      }));
      await supabaseAdmin.from("integrantes_hogar").upsert(integrantesPayload, { onConflict: "id" });

      // 4. Predios
      const prediosPayload = prediosData.map((pr) => ({
        id: pr.id,
        departamento_codigo: pr.departamentoCodigo,
        municipio_codigo: pr.municipioCodigo,
        vereda: pr.vereda,
        nombre_o_direccion: pr.nombreODireccion,
        matricula_inmobiliaria: pr.matriculaInmobiliaria,
        referencia_catastral: pr.referenciaCatastral,
        es_predio_vivienda_principal: true
      }));
      await supabaseAdmin.from("predios").upsert(prediosPayload, { onConflict: "id" });

      // 5. Expedientes
      const expedientesPayload = listaNuevosExpedientes.map((exp) => ({
        id: exp.id,
        postulante_id: exp.postulante.id,
        hogar_id: exp.hogar.id,
        predio_vivienda_id: exp.predioVivienda.id,
        codigo_visible: exp.codigoVisible,
        estado_general: exp.estadoGeneral,
        comercial_origen_id: exp.comercialOrigenId,
        responsable_general_id: exp.responsableGeneralId,
        fase_actual: exp.faseActual,
        bloqueado_por_revision: exp.bloqueadoPorRevision || false,
        estado_fase1: exp.estadoFase1 || "en_preparacion",
        estado_fase2: exp.estadoFase2 || "en_preparacion",
        revision_fases: exp.revisionFases || {},
        validacion_compensar: exp.validacionCompensar || null,
        gestion_fase4: exp.gestionFase4 || null,
        tramite_licencia: exp.tramiteLicencia || null,
        postulacion_subsidio: exp.postulacionSubsidio || null,
        gestion_fase7: exp.gestionFase7 || null,
        fecha_primer_contacto: exp.fechaPrimerContacto,
        fecha_ingreso_fase1: exp.fechaIngresoFase1,
        creado_en: exp.creadoEn,
        actualizado_en: exp.actualizadoEn
      }));
      await supabaseAdmin.from("expedientes").upsert(expedientesPayload, { onConflict: "id" });

      console.log(`[SEED CASOS EJEMPLO]: 7 expedientes (Fases 1 a 7) sincronizados en Supabase con éxito.`);
    } catch (sbErr: any) {
      console.warn(`[SEED CASOS EJEMPLO SUPABASE WARNING]:`, sbErr?.message);
    }
  }

  // =========================================================================
  // PERSISTENCIA EN MEMORIA DEL SERVIDOR (MOCKDB)
  // =========================================================================
  if (mockDb) {
    // Reemplazar o insertar personas
    personasData.forEach((p) => {
      const idx = mockDb.interesados?.findIndex((i: any) => i.id === p.id);
      // Personas no tienen tabla dedicada en mockDb salvo en postulante de expediente
    });

    // Reemplazar o anteponer expedientes en mockDb.expedientes
    listaNuevosExpedientes.forEach((nuevoExp) => {
      const idx = mockDb.expedientes.findIndex((e: any) => e.id === nuevoExp.id || e.codigoVisible === nuevoExp.codigoVisible);
      if (idx !== -1) {
        mockDb.expedientes[idx] = nuevoExp;
      } else {
        mockDb.expedientes.unshift(nuevoExp);
      }
    });

    // Documentos y versiones
    nuevosDocumentos.forEach((d) => {
      const idx = mockDb.documentos.findIndex((doc: any) => doc.id === d.id);
      if (idx !== -1) mockDb.documentos[idx] = d;
      else mockDb.documentos.push(d);
    });

    nuevasVersiones.forEach((v) => {
      const idx = mockDb.versiones.findIndex((ver: any) => ver.id === v.id);
      if (idx !== -1) mockDb.versiones[idx] = v;
      else mockDb.versiones.push(v);
    });

    // Requisitos
    nuevosRequisitos.forEach((r) => {
      const idx = mockDb.requisitosCaso.findIndex((req: any) => req.id === r.id);
      if (idx !== -1) mockDb.requisitosCaso[idx] = r;
      else mockDb.requisitosCaso.push(r);
    });

    // Notas y Tareas
    mockDb.notas.push(...nuevasNotas);
    mockDb.tareas.push(...nuevasTareas);

    // Auditoría de administración
    if (Array.isArray(mockDb.auditoriaAdmin)) {
      mockDb.auditoriaAdmin.unshift({
        id: `aud-seed-${Date.now()}`,
        fecha: fechaIso,
        adminId: ADMIN_ID,
        adminNombre: "Administrador de Sistemas",
        accion: "GENERAR_CASOS_EJEMPLO_TODAS_LAS_FASES",
        detalle: "Se crearon 7 expedientes de ejemplo completos (Fase 1 a Fase 7) con datos realistas territoriales y documentales.",
        categoria: "sistema"
      });
    }
  }

  return {
    success: true,
    totalCasos: 7,
    casosCreados: [
      {
        fase: 1,
        codigoVisible: c1Codigo,
        titular: "Pedro Antonio Rodríguez Mora",
        municipio: "Cogua",
        estadoGeneral: "en_tramite"
      },
      {
        fase: 2,
        codigoVisible: c2Codigo,
        titular: "Martha Elena Castillo Morales",
        municipio: "Zipaquirá",
        estadoGeneral: "en_tramite"
      },
      {
        fase: 3,
        codigoVisible: c3Codigo,
        titular: "Rosa Inés Hernández Beltrán",
        municipio: "Facatativá",
        estadoGeneral: "en_tramite"
      },
      {
        fase: 4,
        codigoVisible: c4Codigo,
        titular: "Hernando Jiménez Pardo",
        municipio: "Choachí",
        estadoGeneral: "en_tramite"
      },
      {
        fase: 5,
        codigoVisible: c5Codigo,
        titular: "Luis Fernando Vargas Silva",
        municipio: "Tabio",
        estadoGeneral: "en_tramite"
      },
      {
        fase: 6,
        codigoVisible: c6Codigo,
        titular: "Carmen Alicia Sánchez Parra",
        municipio: "Tenjo",
        estadoGeneral: "en_tramite"
      },
      {
        fase: 7,
        codigoVisible: c7Codigo,
        titular: "Álvaro Guzmán Torres",
        municipio: "Tocancipá",
        estadoGeneral: "en_tramite"
      }
    ],
    mensaje: "Se han generado y sincronizado con éxito los 7 casos de ejemplo (uno para cada fase operativa)."
  };
}
