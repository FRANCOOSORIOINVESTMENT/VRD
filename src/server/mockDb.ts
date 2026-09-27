import {
  PerfilUsuario,
  Interesado,
  Expediente,
  RequisitoCaso,
  Documento,
  DocVersion,
  RevisionHumana,
  NotaConversacion,
  Tarea,
  EventoSalida,
  CartaSalida,
  calcularCodigoVisible,
  PLANTILLAS_FASE_2,
  EstadoRequisito,
  SolicitudRetiroCedula,
  RolUsuario,
  ConfiguracionSistema,
  RegistroAuditoriaAdmin,
  FaseConfiguracion,
  RequisitoMaestroConfig,
  PlantillasFasesConfig
} from "../types";
import { CATALOGO_MUNICIPIOS, DEPARTAMENTOS_CONFIG } from "../data/municipios";
import { normalizarTextoNombre, construirNombreCompleto } from "../utils/normalizacion";

// BANCO DE CUENTAS FICTICIAS OBLIGATORIAS PARA LOS 5 ROLES DEFINIDOS
export const CUENTAS_FICTICIAS: (PerfilUsuario & { passwordHash: string })[] = [
  {
    id: "usr-comercial-01",
    username: "comercial.franco",
    email: "comercial.prueba@franco.co",
    nombreCompleto: "Carlos Mendoza (Gestor Rural)",
    rol: "comercial",
    activo: true,
    creadoEn: "2026-09-01T08:00:00Z",
    passwordHash: "crm2026*"
  },
  {
    id: "usr-supervisor-01",
    username: "supervisor.franco",
    email: "supervisor.prueba@franco.co",
    nombreCompleto: "Dra. Helena Ramírez (Analista Documental)",
    rol: "supervisor",
    activo: true,
    creadoEn: "2026-09-01T08:00:00Z",
    passwordHash: "crm2026*"
  },
  {
    id: "usr-asistente-01",
    username: "asistente.franco",
    email: "asistente.prueba@franco.co",
    nombreCompleto: "Laura Castillo (Gestor Documental)",
    rol: "asistente",
    activo: true,
    creadoEn: "2026-09-01T08:00:00Z",
    passwordHash: "crm2026*"
  },
  {
    id: "usr-asistente-02",
    username: "asistente.andres",
    email: "asistente.andres@franco.co",
    nombreCompleto: "Andrés Gil (Gestor Documental II)",
    rol: "asistente",
    activo: true,
    creadoEn: "2026-09-01T08:00:00Z",
    passwordHash: "crm2026*"
  },
  {
    id: "usr-ingenieria-01",
    username: "ingenieria.franco",
    email: "ingenieria.prueba@franco.co",
    nombreCompleto: "Ing. Roberto Salazar (Coordinador Técnico)",
    rol: "ingenieria",
    activo: true,
    creadoEn: "2026-09-01T08:00:00Z",
    passwordHash: "crm2026*"
  },
  {
    id: "usr-admin-01",
    username: "admin.franco",
    email: "admin.prueba@franco.co",
    nombreCompleto: "Administrador de Sistemas",
    rol: "administrador",
    activo: true,
    creadoEn: "2026-09-01T08:00:00Z",
    passwordHash: "crm2026*"
  }
];

class MockDatabase {
  perfiles: (PerfilUsuario & { passwordHash: string })[] = [...CUENTAS_FICTICIAS];
  interesados: Interesado[] = [];
  expedientes: Expediente[] = [];
  requisitosCaso: RequisitoCaso[] = [];
  documentos: Documento[] = [];
  versiones: DocVersion[] = [];
  revisiones: RevisionHumana[] = [];
  notas: NotaConversacion[] = [];
  tareas: Tarea[] = [];
  eventosSalida: EventoSalida[] = [];
  cartasSalida: CartaSalida[] = [];
  solicitudesRetiro: SolicitudRetiroCedula[] = [];
  configuracionSistema!: ConfiguracionSistema;
  auditoriaAdmin: RegistroAuditoriaAdmin[] = [];

  constructor() {
    this.seedInitialData();
  }

  seedInitialData() {
    // 1. Interesado comercial de ejemplo previo a fase 1 (Normalizado Cambio 4 y Cambio 6)
    const int1: Interesado = {
      id: "int-001-marta",
      primerNombre: "MARTA",
      segundoNombre: undefined,
      primerApellido: "ROJAS",
      segundoApellido: undefined,
      nombreContacto: "MARTA ROJAS",
      telefono: "3104567890",
      tieneWhatsapp: true,
      correo: "marta.rojas.ejemplo@gmail.com",
      departamentoCodigo: "25",
      municipioCodigo: "25151", // Cáqueza
      vereda: "Rincón Grande",
      origenContacto: "reunion_comunitaria",
      resumenNecesidad: "Interesada en subsidio rural para lote propio con escrituras en trámite.",
      comercialAsignadoId: "usr-comercial-01",
      estadoComercial: "convertido_a_expediente",
      convertidoAExpedienteId: "exp-001-franco",
      creadoEn: "2026-08-25T10:00:00Z",
      contactosApoyo: [
        {
          id: "cnt-001-andres",
          interesadoId: "int-001-marta",
          nombreCompleto: "ANDRES ROJAS",
          relacion: "hijo",
          telefono: "3119876543",
          tieneWhatsapp: true,
          correo: "andres.rojas.hijo@gmail.com",
          preferenciaContacto: "Hijo colabora recibiendo documentos digitales",
          creadoEn: "2026-08-25T10:30:00Z"
        }
      ]
    };

    // Interesados comerciales activos (en prospección)
    const msDia = 1000 * 60 * 60 * 24;
    const ahoraMs = Date.now();

    const int2: Interesado = {
      id: "int-002-samuel",
      primerNombre: "SAMUEL",
      primerApellido: "BARBOSA",
      nombreContacto: "SAMUEL BARBOSA",
      telefono: "3145678912",
      tieneWhatsapp: true,
      correo: "samuel.barbosa@ejemplo.com",
      departamentoCodigo: "25",
      municipioCodigo: "25181", // Choachí
      vereda: "La Chorrera",
      origenContacto: "Visita de Campo",
      resumenNecesidad: "Pequeño productor interesado en subsidio de mejoramiento y ampliación rural.",
      comercialAsignadoId: "usr-comercial-01",
      estadoComercial: "en_conversacion",
      creadoEn: new Date(ahoraMs - 8 * msDia).toISOString(), // 8 días (Rango 0 a 15 días)
      documentosAdjuntos: [
        {
          id: "doc-int-01",
          nombreArchivo: "Cedula_Samuel_Barbosa.pdf",
          tipo: "documento_identidad",
          subidoEn: new Date(ahoraMs - 5 * msDia).toISOString()
        },
        {
          id: "doc-int-02",
          nombreArchivo: "Certificado_Sana_Posesion_Choachi.pdf",
          tipo: "soporte_predio",
          subidoEn: new Date(ahoraMs - 2 * msDia).toISOString()
        }
      ]
    };

    const int3: Interesado = {
      id: "int-003-elvia",
      primerNombre: "ELVIA",
      primerApellido: "ROMERO",
      nombreContacto: "ELVIA ROMERO",
      telefono: "3189988776",
      tieneWhatsapp: true,
      correo: "elvia.romero@ejemplo.com",
      departamentoCodigo: "25",
      municipioCodigo: "25279", // Fómeque
      vereda: "Resguardo",
      origenContacto: "Referido (General)",
      resumenNecesidad: "Madre cabeza de hogar con lote propio con posesión mayor a 10 años.",
      comercialAsignadoId: "usr-comercial-01",
      estadoComercial: "documentacion_solicitada",
      creadoEn: new Date(ahoraMs - 22 * msDia).toISOString(), // 22 días (Rango 16 a 30 días)
      documentosAdjuntos: []
    };

    const int4: Interesado = {
      id: "int-004-pedro",
      primerNombre: "PEDRO",
      segundoNombre: "ANTONIO",
      primerApellido: "GUTIERREZ",
      nombreContacto: "PEDRO ANTONIO GUTIERREZ",
      telefono: "3128899001",
      tieneWhatsapp: true,
      correo: "pedro.antonio.gutierrez@ejemplo.com",
      departamentoCodigo: "25",
      municipioCodigo: "25151", // Cáqueza
      vereda: "Rincón Grande",
      origenContacto: "Presidentes de Juntas de Acción Comunal (JAC)",
      resumenNecesidad: "Hogar postulado a través del presidente de JAC vereda Rincón Grande.",
      comercialAsignadoId: "usr-comercial-01",
      estadoComercial: "en_verificacion",
      creadoEn: new Date(ahoraMs - 38 * msDia).toISOString(), // 38 días (Rango 31 a 45 días)
      documentosAdjuntos: [
        {
          id: "doc-int-03",
          nombreArchivo: "Copia_Cedula_Pedro_Gutierrez.pdf",
          tipo: "documento_identidad",
          subidoEn: new Date(ahoraMs - 30 * msDia).toISOString()
        }
      ]
    };

    const int5: Interesado = {
      id: "int-005-ezequiel",
      primerNombre: "EZEQUIEL",
      primerApellido: "FRANCO",
      segundoApellido: "VEGA",
      nombreContacto: "EZEQUIEL FRANCO VEGA",
      telefono: "3107766554",
      tieneWhatsapp: false,
      correo: "ezequiel.franco@ejemplo.com",
      departamentoCodigo: "25",
      municipioCodigo: "25841", // Ubaque
      vereda: "Cacique",
      origenContacto: "Líderes veredales",
      resumenNecesidad: "Contacto inicial en jornada veredal sin recepción de documentos.",
      comercialAsignadoId: "usr-comercial-01",
      estadoComercial: "nuevo_contacto",
      creadoEn: new Date(ahoraMs - 49 * msDia).toISOString(), // 49 días (> 45 días: Vencido para gestionar prórroga)
      documentosAdjuntos: []
    };

    this.interesados.push(int1, int2, int3, int4, int5);

    // Nota previa de conversación
    this.notas.push({
      id: "nota-001",
      interesadoId: "int-001-marta",
      autorId: "usr-comercial-01",
      personaContactada: "Andrés Rojas (Hijo)",
      canal: "whatsapp",
      contenido: "Se contactó con Andrés para solicitar fotos del predial y certificado de tradición de Cáqueza.",
      fechaGestion: "2026-08-26T14:00:00Z",
      creadoEn: "2026-08-26T14:05:00Z"
    });

    // 2. Expediente ya en Fase 1 para el ejemplo representativo del PRD
    const expId = "exp-001-franco";
    const postPersonaId = "per-001-marta";
    const predioId = "pre-001-caqueza";

    const exp1: Expediente = {
      id: expId,
      interesadoOrigenId: "int-001-marta",
      postulante: {
        id: postPersonaId,
        tipoIdentificacion: "CC",
        numeroIdentificacion: "75097530",
        primerNombre: "MARTA",
        segundoNombre: "HELENA",
        primerApellido: "FRANCO",
        segundoApellido: "OSORIO",
        nombres: "MARTA HELENA FRANCO OSORIO",
        telefonoPrincipal: "3104567890",
        correo: "marta.rojas.ejemplo@gmail.com"
      },
      hogar: {
        id: "hog-001",
        integrantes: [
          {
            id: "int-hog-01",
            hogarId: "hog-001",
            persona: {
              id: postPersonaId,
              tipoIdentificacion: "CC",
              numeroIdentificacion: "75097530",
              primerNombre: "MARTA",
              segundoNombre: "HELENA",
              primerApellido: "FRANCO",
              segundoApellido: "OSORIO",
              nombres: "MARTA HELENA FRANCO OSORIO"
            },
            parentesco: "postulante_principal",
            esPostulantePrincipal: true
          },
          {
            id: "int-hog-02",
            hogarId: "hog-001",
            persona: {
              id: "per-002-andres",
              tipoIdentificacion: "CC",
              numeroIdentificacion: "1018456789",
              primerNombre: "ANDRES",
              segundoNombre: "FELIPE",
              primerApellido: "FRANCO",
              segundoApellido: "ROJAS",
              nombres: "ANDRES FELIPE FRANCO ROJAS"
            },
            parentesco: "hijo",
            esPostulantePrincipal: false
          }
        ]
      },
      predioVivienda: {
        id: predioId,
        departamentoCodigo: "25",
        municipioCodigo: "25151",
        vereda: "Rincón Grande",
        nombreODireccion: "Finca El Porvenir Lote 2",
        matriculaInmobiliaria: "166-45892",
        referenciaCatastral: "25151000100020003000",
        esPredioViviendaPrincipal: true
      },
      codigoVisible: calcularCodigoVisible("25151", "75097530", "FRANCO"),
      estadoGeneral: "en_tramite",
      comercialOrigenId: "usr-comercial-01",
      responsableGeneralId: "usr-comercial-01",
      fechaPrimerContacto: "2026-08-25T10:00:00Z",
      fechaIngresoFase1: "2026-09-01T09:00:00Z",
      faseActual: 1,
      creadoEn: "2026-08-25T10:00:00Z",
      actualizadoEn: "2026-09-01T09:00:00Z"
    };
    this.expedientes.push(exp1);

    // Requisitos de Fase 1 para el expediente
    const req1: RequisitoCaso = {
      id: "req-f1-01",
      expedienteId: expId,
      codigoRequisito: "F1-01",
      nombre: "Certificado de Tradición y Libertad",
      descripcion: "Antigüedad máxima de 90 días calendario respecto a la revisión.",
      fase: 1,
      predioId: predioId,
      estado: "recibido_revision",
      esObligatorio: true,
      esAdicional: false
    };

    const req2: RequisitoCaso = {
      id: "req-f1-02",
      expedienteId: expId,
      codigoRequisito: "F1-02",
      nombre: "Impuesto Predial Unificado",
      descripcion: "Vigencia del año en curso. Aceptado pagado o sin pagar.",
      fase: 1,
      predioId: predioId,
      estado: "recibido_revision",
      esObligatorio: true,
      esAdicional: false
    };

    const req3_postulante: RequisitoCaso = {
      id: "req-f1-03-postulante",
      expedienteId: expId,
      codigoRequisito: "F1-03",
      nombre: "Cédula del Postulante Principal",
      descripcion: "Documento de identidad legible del postulante Marta Helena Franco.",
      fase: 1,
      personaId: postPersonaId,
      personaNombre: "Marta Helena Franco",
      estado: "aceptado",
      esObligatorio: true,
      esAdicional: false
    };

    const req3_hijo: RequisitoCaso = {
      id: "req-f1-03-hijo",
      expedienteId: expId,
      codigoRequisito: "F1-03",
      nombre: "Cédula de Integrante del Hogar",
      descripcion: "Documento de identidad legible de Andrés Franco.",
      fase: 1,
      personaId: "per-002-andres",
      personaNombre: "Andrés Franco (Hijo)",
      estado: "recibido_revision",
      esObligatorio: true,
      esAdicional: false
    };

    this.requisitosCaso.push(req1, req2, req3_postulante, req3_hijo);

    // Documentos y versiones simuladas con rutas seguras en Storage
    const docTradicion: Documento = {
      id: "doc-tradicion-01",
      expedienteId: expId,
      titulo: "Certificado de Tradición y Libertad - Cáqueza Matrícula 166-45892",
      predioId: predioId,
      versiones: [
        {
          id: "ver-trad-01",
          documentoId: "doc-tradicion-01",
          versionNumero: 1,
          storagePath: `expedientes/${expId}/tradicion_libertad_v1.pdf`,
          nombreArchivoOriginal: "Certificado_Tradicion_25151_Ago2026.pdf",
          mimeType: "application/pdf",
          tamanoBytes: 1254300,
          sha256Hash: "8f4b235e197c369e8f4b235e197c369e8f4b235e197c369e8f4b235e197c369e",
          subidoPorId: "usr-comercial-01",
          subidoPorNombre: "Carlos Mendoza (Gestor Rural)",
          subidoEn: "2026-09-01T09:10:00Z"
        }
      ]
    };
    docTradicion.versionActual = docTradicion.versiones[0];
    req1.documentoAsociado = docTradicion;

    const docPredial: Documento = {
      id: "doc-predial-01",
      expedienteId: expId,
      titulo: "Impuesto Predial 2026 - Finca El Porvenir",
      predioId: predioId,
      versiones: [
        {
          id: "ver-pred-01",
          documentoId: "doc-predial-01",
          versionNumero: 1,
          storagePath: `expedientes/${expId}/predial_2026_v1.pdf`,
          nombreArchivoOriginal: "Recibo_Predial_Caqueza_2026.pdf",
          mimeType: "application/pdf",
          tamanoBytes: 845200,
          sha256Hash: "4a7b139c8e2d458f4a7b139c8e2d458f4a7b139c8e2d458f4a7b139c8e2d458f",
          subidoPorId: "usr-comercial-01",
          subidoPorNombre: "Carlos Mendoza (Gestor Rural)",
          subidoEn: "2026-09-01T09:15:00Z"
        }
      ]
    };
    docPredial.versionActual = docPredial.versiones[0];
    req2.documentoAsociado = docPredial;

    const docCedulaPost: Documento = {
      id: "doc-ced-post-01",
      expedienteId: expId,
      titulo: "Cédula de Ciudadanía - Marta Helena Franco",
      personaId: postPersonaId,
      versiones: [
        {
          id: "ver-cedpost-01",
          documentoId: "doc-ced-post-01",
          versionNumero: 1,
          storagePath: `expedientes/${expId}/cedula_marta_franco_v1.pdf`,
          nombreArchivoOriginal: "Cedula_Marta_Franco_75097530.pdf",
          mimeType: "application/pdf",
          tamanoBytes: 450100,
          sha256Hash: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          subidoPorId: "usr-comercial-01",
          subidoPorNombre: "Carlos Mendoza (Gestor Rural)",
          subidoEn: "2026-09-01T09:00:00Z"
        }
      ]
    };
    docCedulaPost.versionActual = docCedulaPost.versiones[0];
    req3_postulante.documentoAsociado = docCedulaPost;

    const docCedulaHijo: Documento = {
      id: "doc-ced-hijo-01",
      expedienteId: expId,
      titulo: "Cédula de Ciudadanía - Andrés Franco (Hijo)",
      personaId: "per-002-andres",
      versiones: [
        {
          id: "ver-cedhijo-01",
          documentoId: "doc-ced-hijo-01",
          versionNumero: 1,
          storagePath: `expedientes/${expId}/cedula_andres_franco_v1.pdf`,
          nombreArchivoOriginal: "Cedula_Andres_Franco_1018456789.pdf",
          mimeType: "application/pdf",
          tamanoBytes: 420800,
          sha256Hash: "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
          subidoPorId: "usr-comercial-01",
          subidoPorNombre: "Carlos Mendoza (Gestor Rural)",
          subidoEn: "2026-09-01T09:20:00Z"
        }
      ]
    };
    docCedulaHijo.versionActual = docCedulaHijo.versiones[0];
    req3_hijo.documentoAsociado = docCedulaHijo;

    this.documentos.push(docTradicion, docPredial, docCedulaPost, docCedulaHijo);

    // Revisión previa de la cédula del postulante
    this.revisiones.push({
      id: "rev-001",
      requisitoCasoId: req3_postulante.id,
      versionDocumentoId: "ver-cedpost-01",
      supervisorId: "usr-supervisor-01",
      supervisorNombre: "Dra. Helena Ramírez",
      cicloRevision: 1,
      resultado: "ACEPTADO",
      observacion: "Documento legible por anverso y reverso.",
      fechaRevision: "2026-09-02T11:00:00Z"
    });

    // 3. Expediente de ejemplo en Fase 2 (Conformación del Hogar) asignado a Asistente Administrativo
    const exp2Id = "exp-002-cardenas";
    const post2Id = "per-003-jorge";
    const predio2Id = "pre-002-caqueza";

    const exp2: Expediente = {
      id: exp2Id,
      interesadoOrigenId: "int-002-jorge",
      postulante: {
        id: post2Id,
        tipoIdentificacion: "CC",
        numeroIdentificacion: "19456782",
        primerNombre: "JORGE",
        segundoNombre: "ENRIQUE",
        primerApellido: "CARDENAS",
        segundoApellido: "GOMEZ",
        nombres: "JORGE ENRIQUE CARDENAS GOMEZ",
        telefonoPrincipal: "3123456789",
        correo: "jorge.cardenas@ejemplo.com"
      },
      hogar: {
        id: "hog-002",
        integrantes: [
          {
            id: "int-hog-03",
            hogarId: "hog-002",
            persona: {
              id: post2Id,
              tipoIdentificacion: "CC",
              numeroIdentificacion: "19456782",
              primerNombre: "JORGE",
              segundoNombre: "ENRIQUE",
              primerApellido: "CARDENAS",
              segundoApellido: "GOMEZ",
              nombres: "JORGE ENRIQUE CARDENAS GOMEZ"
            },
            parentesco: "postulante_principal",
            esPostulantePrincipal: true
          },
          {
            id: "int-hog-04",
            hogarId: "hog-002",
            persona: {
              id: "per-004-lucia",
              tipoIdentificacion: "CC",
              numeroIdentificacion: "52489631",
              primerNombre: "LUCIA",
              primerApellido: "GOMEZ",
              segundoApellido: "PEREZ",
              nombres: "LUCIA GOMEZ PEREZ"
            },
            parentesco: "conyuge",
            esPostulantePrincipal: false,
            retiroPendiente: true,
            solicitudRetiroId: "sol-ret-001",
            motivoRetiroPendiente: "La integrante se trasladó a residir permanentemente a otro municipio por motivos laborales y no formará parte de la unidad habitacional a subsidiar."
          }
        ]
      },
      predioVivienda: {
        id: predio2Id,
        departamentoCodigo: "25",
        municipioCodigo: "25151",
        vereda: "Monteredondo",
        nombreODireccion: "Finca Santa Inés Sector Los Pinos",
        matriculaInmobiliaria: "166-78901",
        referenciaCatastral: "25151000200030004000",
        esPredioViviendaPrincipal: true
      },
      codigoVisible: calcularCodigoVisible("25151", "19456782", "CARDENAS"),
      estadoGeneral: "en_tramite",
      comercialOrigenId: "usr-comercial-01",
      responsableGeneralId: "usr-asistente-01", // Laura Castillo (Gestor Documental)
      fechaPrimerContacto: "2026-08-20T10:00:00Z",
      fechaIngresoFase1: "2026-08-22T09:00:00Z",
      faseActual: 2,
      creadoEn: "2026-08-20T10:00:00Z",
      actualizadoEn: "2026-09-03T16:00:00Z"
    };
    this.expedientes.push(exp2);

    // Solicitud de retiro de cédula de prueba precargada (Cambio 2)
    this.solicitudesRetiro.push({
      id: "sol-ret-001",
      expedienteId: exp2Id,
      expedienteCodigoVisible: exp2.codigoVisible || "25151-19456782-CARDENAS",
      integranteId: "int-hog-04",
      personaId: "per-004-lucia",
      personaNombreCompleto: "LUCIA GOMEZ PEREZ",
      numeroIdentificacion: "52489631",
      tipoIdentificacion: "CC",
      parentesco: "conyuge",
      solicitadoPorId: "usr-asistente-01",
      solicitadoPorNombre: "Laura Castillo (Gestor Documental)",
      solicitadoPorRol: "asistente",
      motivoSolicitud: "La integrante se trasladó a residir permanentemente a otro municipio por motivos laborales y no formará parte de la unidad habitacional a subsidiar.",
      fechaSolicitud: "2026-09-04T10:30:00Z",
      estado: "pendiente"
    });

    // Documentos base para exp-002
    const docCedula2: Documento = {
      id: "doc-ced-02",
      expedienteId: exp2Id,
      titulo: "Cédula de Ciudadanía - Jorge Enrique Cárdenas",
      personaId: post2Id,
      versiones: [
        {
          id: "ver-ced-02",
          documentoId: "doc-ced-02",
          versionNumero: 1,
          storagePath: `expedientes/${exp2Id}/cedula_jorge_cardenas.pdf`,
          nombreArchivoOriginal: "Cedula_Jorge_Cardenas_19456782.pdf",
          mimeType: "application/pdf",
          tamanoBytes: 412000,
          sha256Hash: "a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890",
          subidoPorId: "usr-comercial-01",
          subidoPorNombre: "Carlos Mendoza (Gestor Rural)",
          subidoEn: "2026-08-22T09:15:00Z"
        }
      ]
    };
    docCedula2.versionActual = docCedula2.versiones[0];

    const docTradicion2: Documento = {
      id: "doc-trad-02",
      expedienteId: exp2Id,
      titulo: "Certificado de Tradición y Libertad - Matrícula 166-78901",
      predioId: predio2Id,
      versiones: [
        {
          id: "ver-trad-02",
          documentoId: "doc-trad-02",
          versionNumero: 1,
          storagePath: `expedientes/${exp2Id}/tradicion_libertad_166-78901.pdf`,
          nombreArchivoOriginal: "Certificado_Tradicion_166-78901.pdf",
          mimeType: "application/pdf",
          tamanoBytes: 1100000,
          sha256Hash: "b2c3d4e5f6a17890b2c3d4e5f6a17890b2c3d4e5f6a17890b2c3d4e5f6a17890",
          subidoPorId: "usr-comercial-01",
          subidoPorNombre: "Carlos Mendoza (Gestor Rural)",
          subidoEn: "2026-08-22T09:30:00Z"
        }
      ]
    };
    docTradicion2.versionActual = docTradicion2.versiones[0];

    const docPredial2: Documento = {
      id: "doc-pred-02",
      expedienteId: exp2Id,
      titulo: "Impuesto Predial Unificado 2026 - Santa Inés",
      predioId: predio2Id,
      versiones: [
        {
          id: "ver-pred-02",
          documentoId: "doc-pred-02",
          versionNumero: 1,
          storagePath: `expedientes/${exp2Id}/impuesto_predial_2026.pdf`,
          nombreArchivoOriginal: "Impuesto_Predial_Vigencia_2026.pdf",
          mimeType: "application/pdf",
          tamanoBytes: 950000,
          sha256Hash: "c3d4e5f6a1b27890c3d4e5f6a1b27890c3d4e5f6a1b27890c3d4e5f6a1b27890",
          subidoPorId: "usr-comercial-01",
          subidoPorNombre: "Carlos Mendoza (Gestor Rural)",
          subidoEn: "2026-08-22T09:45:00Z"
        }
      ]
    };
    docPredial2.versionActual = docPredial2.versiones[0];

    const docArraigo2: Documento = {
      id: "doc-arr-02",
      expedienteId: exp2Id,
      titulo: "Certificado de Arraigo Comunitario - Vereda Monteredondo",
      personaId: post2Id,
      versiones: [
        {
          id: "ver-arr-02",
          documentoId: "doc-arr-02",
          versionNumero: 1,
          storagePath: `expedientes/${exp2Id}/certificado_arraigo_jorge.pdf`,
          nombreArchivoOriginal: "Certificado_Arraigo_Junta_Accion_Comunal.pdf",
          mimeType: "application/pdf",
          tamanoBytes: 780000,
          sha256Hash: "d4e5f6a1b2c37890d4e5f6a1b2c37890d4e5f6a1b2c37890d4e5f6a1b2c37890",
          subidoPorId: "usr-asistente-01",
          subidoPorNombre: "Laura Castillo (Gestor Documental)",
          subidoEn: "2026-09-03T14:30:00Z"
        }
      ]
    };
    docArraigo2.versionActual = docArraigo2.versiones[0];

    this.documentos.push(docCedula2, docTradicion2, docPredial2, docArraigo2);

    // 11 requisitos de Fase 2 para exp2
    PLANTILLAS_FASE_2.forEach((plantilla) => {
      let estado: any = "pendiente_carga";
      let docAsociado = undefined;

      if (plantilla.codigoRequisito === "F2-01") {
        docAsociado = docCedula2;
        estado = "aceptado";
      } else if (plantilla.codigoRequisito === "F2-04") {
        docAsociado = docTradicion2;
        estado = "aceptado";
      } else if (plantilla.codigoRequisito === "F2-05") {
        docAsociado = docPredial2;
        estado = "aceptado";
      } else if (plantilla.codigoRequisito === "F2-02") {
        docAsociado = docArraigo2;
        estado = "recibido_revision";
      }

      this.requisitosCaso.push({
        id: `req-${plantilla.codigoRequisito.toLowerCase()}-${exp2Id}`,
        expedienteId: exp2Id,
        codigoRequisito: plantilla.codigoRequisito,
        nombre: plantilla.nombre,
        descripcion: plantilla.descripcion,
        fase: 2,
        predioId: predio2Id,
        personaId: plantilla.codigoRequisito === "F2-01" ? post2Id : undefined,
        personaNombre: plantilla.codigoRequisito === "F2-01" ? "Jorge Enrique Cárdenas" : undefined,
        estado,
        esObligatorio: plantilla.esObligatorio,
        esAdicional: false,
        origenFase1: plantilla.origenFase1,
        alertaVigencia: plantilla.alertaVigencia,
        documentoAsociado: docAsociado
      });
    });

    // Cédula de integrante cónyuge para exp-002 (Cambio 2)
    this.requisitosCaso.push({
      id: `req-f2-01-conyuge-${exp2Id}`,
      expedienteId: exp2Id,
      codigoRequisito: "F2-01",
      nombre: "Cédula de Integrante del Hogar",
      descripcion: "Documento de identidad legible de Lucía Gómez (Cónyuge).",
      fase: 2,
      predioId: predio2Id,
      personaId: "per-004-lucia",
      personaNombre: "Lucía Gómez (Cónyuge)",
      estado: "recibido_revision",
      esObligatorio: true,
      esAdicional: false
    });

    // Tarea operativa asignada a Laura Castillo
    this.tareas.push({
      id: "tar-f2-002",
      expedienteId: exp2Id,
      descripcion: "Recolectar y cargar la documentación oficial de Fase 2 para el hogar de Jorge Enrique Cárdenas",
      asignadoAId: "usr-asistente-01",
      asignadoANombre: "Laura Castillo (Gestor Documental)",
      creadoPorId: "usr-supervisor-01",
      estado: "pendiente",
      creadoEn: "2026-09-03T16:05:00Z"
    });

    // 4. Expediente en Fase 3: Diagnóstico Técnico (32 días - Fómeque)
    const exp3Id = "exp-003-rodriguez";
    const post3Id = "per-004-pedro";
    const predio3Id = "pre-003-fomeque";
    const exp3: Expediente = {
      id: exp3Id,
      postulante: {
        id: post3Id,
        tipoIdentificacion: "CC",
        numeroIdentificacion: "79342118",
        primerNombre: "PEDRO",
        segundoNombre: "ANTONIO",
        primerApellido: "RODRIGUEZ",
        segundoApellido: "MORA",
        nombres: "PEDRO ANTONIO RODRIGUEZ MORA",
        telefonoPrincipal: "3134567812",
        correo: "pedro.rodriguez@ejemplo.com"
      },
      hogar: {
        id: "hog-003",
        integrantes: [
          {
            id: "int-hog-04",
            hogarId: "hog-003",
            persona: {
              id: post3Id,
              tipoIdentificacion: "CC",
              numeroIdentificacion: "79342118",
              primerNombre: "PEDRO",
              segundoNombre: "ANTONIO",
              primerApellido: "RODRIGUEZ",
              segundoApellido: "MORA",
              nombres: "PEDRO ANTONIO RODRIGUEZ MORA"
            },
            parentesco: "postulante_principal",
            esPostulantePrincipal: true
          }
        ]
      },
      predioVivienda: {
        id: predio3Id,
        departamentoCodigo: "25",
        municipioCodigo: "25279", // Fómeque
        vereda: "El Salitre",
        nombreODireccion: "Finca La Esperanza - Sector Los Arrayanes",
        matriculaInmobiliaria: "166-45210",
        referenciaCatastral: "25279000100020003000",
        esPredioViviendaPrincipal: true
      },
      codigoVisible: calcularCodigoVisible("25279", "79342118", "RODRIGUEZ"),
      estadoGeneral: "en_tramite",
      comercialOrigenId: "usr-comercial-01",
      responsableGeneralId: "usr-ingenieria-01", // Ing. Roberto Salazar
      fechaPrimerContacto: "2026-08-04T09:00:00Z",
      fechaIngresoFase1: "2026-08-06T10:00:00Z",
      faseActual: 3,
      creadoEn: "2026-08-04T09:00:00Z",
      actualizadoEn: "2026-09-02T11:00:00Z"
    };
    this.expedientes.push(exp3);

    // Requisitos Fase 3
    const reqsF3 = [
      { codigo: "F3-01", nombre: "Formato de Visita Técnica y Habitabilidad", desc: "Inspección ocular y diagnóstico de la vivienda rural.", est: "aceptado" },
      { codigo: "F3-02", nombre: "Levantamiento Topográfico y Planimetría", desc: "Plano altimétrico y coordenadas del polígono del predio.", est: "recibido_revision" },
      { codigo: "F3-03", nombre: "Concepto de Amenaza y Gestión del Riesgo", desc: "Certificado municipal de no afectación por remoción en masa.", est: "aceptado" },
      { codigo: "F3-04", nombre: "Disponibilidad de Agua Potable y Energía", desc: "Constancia de acueducto veredal y Enel Colombia.", est: "pendiente_carga" }
    ];
    reqsF3.forEach((r) => {
      this.requisitosCaso.push({
        id: `req-${r.codigo.toLowerCase()}-${exp3Id}`,
        expedienteId: exp3Id,
        codigoRequisito: r.codigo,
        nombre: r.nombre,
        descripcion: r.desc,
        fase: 3,
        predioId: predio3Id,
        estado: r.est as EstadoRequisito,
        esObligatorio: true,
        esAdicional: false
      });
    });

    // 5. Expediente en Fase 4: Formulación y Presupuesto (58 días - Choachí)
    const exp4Id = "exp-004-morales";
    const post4Id = "per-005-gloria";
    const predio4Id = "pre-004-choachi";
    const exp4: Expediente = {
      id: exp4Id,
      postulante: {
        id: post4Id,
        tipoIdentificacion: "CC",
        numeroIdentificacion: "51876432",
        primerNombre: "GLORIA",
        segundoNombre: "INES",
        primerApellido: "MORALES",
        segundoApellido: "PENA",
        nombres: "GLORIA INES MORALES PENA",
        telefonoPrincipal: "3156789023",
        correo: "gloria.morales@ejemplo.com"
      },
      hogar: {
        id: "hog-004",
        integrantes: [
          {
            id: "int-hog-05",
            hogarId: "hog-004",
            persona: {
              id: post4Id,
              tipoIdentificacion: "CC",
              numeroIdentificacion: "51876432",
              primerNombre: "GLORIA",
              segundoNombre: "INES",
              primerApellido: "MORALES",
              segundoApellido: "PENA",
              nombres: "GLORIA INES MORALES PENA"
            },
            parentesco: "postulante_principal",
            esPostulantePrincipal: true
          }
        ]
      },
      predioVivienda: {
        id: predio4Id,
        departamentoCodigo: "25",
        municipioCodigo: "25181", // Choachí
        vereda: "El Hato",
        nombreODireccion: "Lote El Mirador - Vereda El Hato",
        matriculaInmobiliaria: "166-33981",
        referenciaCatastral: "25181000300040005000",
        esPredioViviendaPrincipal: true
      },
      codigoVisible: calcularCodigoVisible("25181", "51876432", "MORALES"),
      estadoGeneral: "en_tramite",
      comercialOrigenId: "usr-comercial-01",
      responsableGeneralId: "usr-ingenieria-01",
      fechaPrimerContacto: "2026-07-09T08:00:00Z",
      fechaIngresoFase1: "2026-07-12T10:00:00Z",
      faseActual: 4,
      creadoEn: "2026-07-09T08:00:00Z",
      actualizadoEn: "2026-08-30T15:00:00Z",
      gestionFase4: {
        interventoria: {
          estado: "completado",
          fechaSolicitud: "2026-07-20",
          fechaEstimada: "2026-07-25",
          fechaVisitaRealizada: "2026-07-28",
          resultadoConcepto: "aprobado",
          observaciones: "Visita técnica de interventoría realizada sin objeciones en predio rural. Cumple parámetros de implantación y acceso vial.",
          soporte: {
            nombreArchivo: "Acta_Visita_Interventoria_VRD_Choachi.pdf",
            mimeType: "application/pdf",
            tamanoBytes: 1845000,
            sha256Hash: "d41d8cd98f00b204e9800998ecf8427e02938471928374615243123456789abc",
            subidoPor: "Ing. Roberto Salazar",
            subidoEn: "2026-07-29T14:30:00Z"
          },
          historial: [
            {
              id: "hist-f4-int-1",
              fecha: "2026-07-20T10:00:00Z",
              usuarioId: "usr-ingenieria-01",
              usuarioNombre: "Ing. Roberto Salazar",
              usuarioRol: "ingenieria",
              accion: "Solicitud enviada a la Interventoría",
              nuevoEstado: "solicitado",
              observaciones: "Se remite paquete técnico y coordenadas GPS para agendamiento de visita en Choachí."
            },
            {
              id: "hist-f4-int-2",
              fecha: "2026-07-28T16:00:00Z",
              usuarioId: "usr-ingenieria-01",
              usuarioNombre: "Ing. Roberto Salazar",
              usuarioRol: "ingenieria",
              accion: "Visita de inspección realizada en sitio",
              nuevoEstado: "en_proceso",
              observaciones: "Acompañamiento en terreno con el ingeniero interventor y el beneficiario."
            },
            {
              id: "hist-f4-int-3",
              fecha: "2026-07-29T15:00:00Z",
              usuarioId: "usr-ingenieria-01",
              usuarioNombre: "Ing. Roberto Salazar",
              usuarioRol: "ingenieria",
              accion: "Carga de soporte y concepto favorable",
              nuevoEstado: "completado",
              observaciones: "Concepto técnico emitido favorablemente. Se adjunta acta firmada."
            }
          ]
        },
        arquitectura: {
          estado: "completado",
          fechaSolicitud: "2026-07-16",
          porcentajeAvance: 100,
          fechaEntregaEstimada: "2026-08-05",
          fechaEntregaReal: "2026-08-08",
          observaciones: "Juego completo de planos arquitectónicos ajustados a la topografía del lote (55m² habitables modulares).",
          soporte: {
            nombreArchivo: "Planos_Arquitectonicos_Licencia_VRD_Choachi.pdf",
            mimeType: "application/pdf",
            tamanoBytes: 4250000,
            sha256Hash: "fa391029384812304918239019238471928374615243123456789abcdef01234",
            subidoPor: "Ing. Roberto Salazar",
            subidoEn: "2026-08-08T18:20:00Z"
          },
          historial: [
            {
              id: "hist-f4-arq-1",
              fecha: "2026-07-16T11:00:00Z",
              usuarioId: "usr-ingenieria-01",
              usuarioNombre: "Ing. Roberto Salazar",
              usuarioRol: "ingenieria",
              accion: "Solicitud radicada a taller de Arquitectura",
              nuevoEstado: "solicitado",
              observaciones: "Asignación de diseño bioclimático adaptado a pendiente suave."
            },
            {
              id: "hist-f4-arq-2",
              fecha: "2026-08-01T09:30:00Z",
              usuarioId: "usr-ingenieria-01",
              usuarioNombre: "Ing. Roberto Salazar",
              usuarioRol: "ingenieria",
              accion: "Revisión de anteproyecto al 80%",
              nuevoEstado: "en_proceso",
              observaciones: "Ajuste de cubierta y distribución hidrosanitaria rural."
            },
            {
              id: "hist-f4-arq-3",
              fecha: "2026-08-08T18:30:00Z",
              usuarioId: "usr-ingenieria-01",
              usuarioNombre: "Ing. Roberto Salazar",
              usuarioRol: "ingenieria",
              accion: "Entrega de planos definitivos para licencia",
              nuevoEstado: "completado",
              observaciones: "Planos entregados y validados para radicación municipal."
            }
          ]
        },
        estudioSuelos: {
          estado: "en_proceso",
          fechaSolicitud: "2026-07-22",
          fechaRealizacion: "2026-08-14",
          resultadoConcepto: "viable",
          observaciones: "Sondeos ejecutados a 4.5m de profundidad. En espera de los ensayos de compresión inconfinada del laboratorio.",
          historial: [
            {
              id: "hist-f4-sue-1",
              fecha: "2026-07-22T08:00:00Z",
              usuarioId: "usr-ingenieria-01",
              usuarioNombre: "Ing. Roberto Salazar",
              usuarioRol: "ingenieria",
              accion: "Orden de servicio emitida al laboratorio geotécnico",
              nuevoEstado: "solicitado",
              observaciones: "Cotización aprobada y coordinación de fecha con brigada de perforación."
            },
            {
              id: "hist-f4-sue-2",
              fecha: "2026-08-14T17:00:00Z",
              usuarioId: "usr-ingenieria-01",
              usuarioNombre: "Ing. Roberto Salazar",
              usuarioRol: "ingenieria",
              accion: "Perforación y sondeos en campo realizados",
              nuevoEstado: "en_proceso",
              observaciones: "Muestras de suelo tomadas y remitidas a laboratorio de geotecnia."
            }
          ]
        },
        actualizadoEn: "2026-08-30T15:00:00Z"
      }
    };
    this.expedientes.push(exp4);

    // En Fase 4 solo se mantiene F4-03 Presupuesto Oficial y APU Detallado como elemento independiente
    const reqsF4 = [
      { codigo: "F4-03", nombre: "Presupuesto Oficial y APU Detallado", desc: "Análisis de Precios Unitarios regionalizado Cundinamarca y presupuesto oficial de obra.", est: "aceptado" }
    ];
    reqsF4.forEach((r) => {
      this.requisitosCaso.push({
        id: `req-${r.codigo.toLowerCase()}-${exp4Id}`,
        expedienteId: exp4Id,
        codigoRequisito: r.codigo,
        nombre: r.nombre,
        descripcion: r.desc,
        fase: 4,
        predioId: predio4Id,
        estado: r.est as EstadoRequisito,
        esObligatorio: true,
        esAdicional: false,
        documentoAsociado: {
          id: `doc-f4-03-${exp4Id}`,
          expedienteId: exp4Id,
          titulo: "Presupuesto Oficial y APU Detallado",
          versiones: [],
          versionActual: {
            id: `ver-f4-03-${exp4Id}`,
            documentoId: `doc-f4-03-${exp4Id}`,
            versionNumero: 1,
            storagePath: `expedientes/${exp4Id}/Presupuesto_Oficial_APU_Detallado_Choachi.pdf`,
            nombreArchivoOriginal: "Presupuesto_Oficial_APU_Detallado_Choachi.pdf",
            mimeType: "application/pdf",
            tamanoBytes: 2150000,
            sha256Hash: "b839218392019485729103948571928475819203948571928475819203948571",
            subidoPorId: "usr-ingenieria-01",
            subidoPorNombre: "Ing. Roberto Salazar",
            subidoEn: "2026-08-25T11:00:00Z"
          }
        }
      });
    });

    // 6. Expediente en Fase 5: Asignación de Subsidio y Licencia (75 días - Fosca)
    const exp5Id = "exp-005-hernandez";
    const post5Id = "per-006-luis";
    const predio5Id = "pre-005-fosca";
    const exp5: Expediente = {
      id: exp5Id,
      postulante: {
        id: post5Id,
        tipoIdentificacion: "CC",
        numeroIdentificacion: "19283746",
        primerNombre: "LUIS",
        segundoNombre: "ALBERTO",
        primerApellido: "HERNANDEZ",
        segundoApellido: "CASTRO",
        nombres: "LUIS ALBERTO HERNANDEZ CASTRO",
        telefonoPrincipal: "3112233445",
        correo: "luis.hernandez@ejemplo.com"
      },
      hogar: {
        id: "hog-005",
        integrantes: [
          {
            id: "int-hog-06",
            hogarId: "hog-005",
            persona: {
              id: post5Id,
              tipoIdentificacion: "CC",
              numeroIdentificacion: "19283746",
              primerNombre: "LUIS",
              segundoNombre: "ALBERTO",
              primerApellido: "HERNANDEZ",
              segundoApellido: "CASTRO",
              nombres: "LUIS ALBERTO HERNANDEZ CASTRO"
            },
            parentesco: "postulante_principal",
            esPostulantePrincipal: true
          }
        ]
      },
      predioVivienda: {
        id: predio5Id,
        departamentoCodigo: "25",
        municipioCodigo: "25281", // Fosca
        vereda: "San Antonio",
        nombreODireccion: "Finca El Paraíso - Vereda San Antonio",
        matriculaInmobiliaria: "166-55441",
        referenciaCatastral: "25281000100020003000",
        esPredioViviendaPrincipal: true
      },
      codigoVisible: calcularCodigoVisible("25281", "19283746", "HERNANDEZ"),
      estadoGeneral: "en_tramite",
      comercialOrigenId: "usr-comercial-01",
      responsableGeneralId: "usr-supervisor-01", // Dra. Helena Ramírez
      fechaPrimerContacto: "2026-06-22T08:00:00Z",
      fechaIngresoFase1: "2026-06-25T11:00:00Z",
      faseActual: 5,
      creadoEn: "2026-06-22T08:00:00Z",
      actualizadoEn: "2026-09-01T10:00:00Z"
    };
    this.expedientes.push(exp5);

    exp5.tramiteLicencia = {
      estadoActual: "con_observaciones",
      entidadMunicipal: "Secretaría de Planeación y Obras Públicas - Alcaldía Municipal de Fosca",
      numeroRadicadoInicial: "RAD-2026-FOS-0482",
      fechaRadicacionInicial: "2026-08-10T09:30:00Z",
      soporteRadicacionInicial: {
        id: "sop-rad-exp5",
        nombreArchivo: "Formulario_Unico_Nacional_Radicado_Fosca_0482.pdf",
        tamanoBytes: 1850000,
        mimeType: "application/pdf",
        sha256Hash: "d1829f8a8472910c283748291028475829102938475618293847562819203948",
        subidoPor: "Ing. Roberto Salazar",
        subidoEn: "2026-08-10T09:35:00Z"
      },
      rondasSubsanacion: [
        {
          id: "ronda-1-exp5",
          numeroRonda: 1,
          fechaObservaciones: "2026-08-22T14:15:00Z",
          numeroActaObservaciones: "ACTA-OBS-2026-019",
          detalleObservaciones: "Se requiere ajustar el plano de implantación modular VRD para garantizar el retiro mínimo de 6.0 metros al eje de la vía terciaria veredal, conforme al PBOT de Fosca.",
          fechaLimiteSubsanacion: "2026-09-22T17:00:00Z",
          soporteObservaciones: {
            id: "sop-obs-1-exp5",
            nombreArchivo: "Acta_Observaciones_Planeacion_Fosca_019.pdf",
            tamanoBytes: 945000,
            mimeType: "application/pdf",
            sha256Hash: "e492817291028374658192039485719284758192039485719284758192039485",
            subidoPor: "Ing. Roberto Salazar",
            subidoEn: "2026-08-22T15:00:00Z"
          },
          fechaRadicacionSubsanacion: "2026-08-28T11:00:00Z",
          numeroRadicadoSubsanacion: "SUB-2026-FOS-0112",
          detalleRespuestaSubsanacion: "Se radicaron planos arquitectónicos corregidos y memoria técnica de implantación con retiro verificado de 6.20 metros al eje vial.",
          soporteSubsanacion: {
            id: "sop-sub-1-exp5",
            nombreArchivo: "Radicado_Subsanacion_Planos_Corregidos_Fosca.pdf",
            tamanoBytes: 2400000,
            mimeType: "application/pdf",
            sha256Hash: "f928374619283746581920394857192847581920394857192847581920394857",
            subidoPor: "Ing. Roberto Salazar",
            subidoEn: "2026-08-28T11:10:00Z"
          },
          registradoPorId: "usr-ingenieria-01",
          registradoPorNombre: "Ing. Roberto Salazar"
        }
      ],
      historial: [
        {
          id: "hist-lic-1",
          fecha: "2026-08-10T09:30:00Z",
          usuarioId: "usr-ingenieria-01",
          usuarioNombre: "Ing. Roberto Salazar",
          usuarioRol: "ingenieria",
          tipoEvento: "radicacion_inicial",
          titulo: "Radicación Inicial de Licencia",
          descripcion: "Radicación de solicitud de Licencia de Construcción en modalidad Obra Nueva - Vivienda Rural Digna.",
          numeroRadicado: "RAD-2026-FOS-0482",
          entidadMunicipal: "Secretaría de Planeación y Obras Públicas - Fosca",
          soporte: {
            id: "sop-rad-exp5",
            nombreArchivo: "Formulario_Unico_Nacional_Radicado_Fosca_0482.pdf",
            tamanoBytes: 1850000,
            mimeType: "application/pdf",
            sha256Hash: "d1829f8a8472910c283748291028475829102938475618293847562819203948"
          },
          estadoResultante: "radicado_en_revision"
        },
        {
          id: "hist-lic-2",
          fecha: "2026-08-22T14:15:00Z",
          usuarioId: "usr-ingenieria-01",
          usuarioNombre: "Ing. Roberto Salazar",
          usuarioRol: "ingenieria",
          tipoEvento: "observaciones_entidad",
          titulo: "Acta de Observaciones Recibida (Ronda 1)",
          descripcion: "Planeación solicita aclaración de retiros viales conforme al PBOT municipal.",
          numeroRadicado: "ACTA-OBS-2026-019",
          soporte: {
            id: "sop-obs-1-exp5",
            nombreArchivo: "Acta_Observaciones_Planeacion_Fosca_019.pdf",
            tamanoBytes: 945000,
            mimeType: "application/pdf",
            sha256Hash: "e492817291028374658192039485719284758192039485719284758192039485"
          },
          estadoResultante: "con_observaciones"
        },
        {
          id: "hist-lic-3",
          fecha: "2026-08-28T11:00:00Z",
          usuarioId: "usr-ingenieria-01",
          usuarioNombre: "Ing. Roberto Salazar",
          usuarioRol: "ingenieria",
          tipoEvento: "radicacion_subsanacion",
          titulo: "Radicación de Subsanaciones (Ronda 1)",
          descripcion: "Entrega de planos y memorias técnicas corregidas respondiendo al acta 019.",
          numeroRadicado: "SUB-2026-FOS-0112",
          soporte: {
            id: "sop-sub-1-exp5",
            nombreArchivo: "Radicado_Subsanacion_Planos_Corregidos_Fosca.pdf",
            tamanoBytes: 2400000,
            mimeType: "application/pdf",
            sha256Hash: "f928374619283746581920394857192847581920394857192847581920394857"
          },
          estadoResultante: "radicado_en_revision"
        }
      ],
      actualizadoEn: "2026-08-28T11:15:00Z"
    };

    const reqsF5 = [
      {
        codigo: "F5-01",
        nombre: "Presupuesto Oficial y APU Detallado",
        desc: "Análisis de Precios Unitarios regionalizado Cundinamarca y presupuesto oficial de obra.",
        est: "pendiente_carga"
      }
    ];
    reqsF5.forEach((r) => {
      this.requisitosCaso.push({
        id: `req-${r.codigo.toLowerCase()}-${exp5Id}`,
        expedienteId: exp5Id,
        codigoRequisito: r.codigo,
        nombre: r.nombre,
        descripcion: r.desc,
        fase: 5,
        predioId: predio5Id,
        estado: r.est as EstadoRequisito,
        esObligatorio: true,
        esAdicional: false
      });
    });

    // 7. Expediente en Fase 6: Ejecución de Obra (98 días - Chipaque)
    const exp6Id = "exp-006-velasquez";
    const post6Id = "per-007-carmen";
    const predio6Id = "pre-006-chipaque";
    const exp6: Expediente = {
      id: exp6Id,
      postulante: {
        id: post6Id,
        tipoIdentificacion: "CC",
        numeroIdentificacion: "39712345",
        primerNombre: "CARMEN",
        segundoNombre: "ROSA",
        primerApellido: "VELASQUEZ",
        segundoApellido: "SUAREZ",
        nombres: "CARMEN ROSA VELASQUEZ SUAREZ",
        telefonoPrincipal: "3187766554",
        correo: "carmen.velasquez@ejemplo.com"
      },
      hogar: {
        id: "hog-006",
        integrantes: [
          {
            id: "int-hog-07",
            hogarId: "hog-006",
            persona: {
              id: post6Id,
              tipoIdentificacion: "CC",
              numeroIdentificacion: "39712345",
              primerNombre: "CARMEN",
              segundoNombre: "ROSA",
              primerApellido: "VELASQUEZ",
              segundoApellido: "SUAREZ",
              nombres: "CARMEN ROSA VELASQUEZ SUAREZ"
            },
            parentesco: "postulante_principal",
            esPostulantePrincipal: true
          }
        ]
      },
      predioVivienda: {
        id: predio6Id,
        departamentoCodigo: "25",
        municipioCodigo: "25178", // Chipaque
        vereda: "Calderitas",
        nombreODireccion: "Finca Villa Carmen - Sector Calderitas",
        matriculaInmobiliaria: "166-99012",
        referenciaCatastral: "25178000200030004000",
        esPredioViviendaPrincipal: true
      },
      codigoVisible: calcularCodigoVisible("25178", "39712345", "VELASQUEZ"),
      estadoGeneral: "construccion_iniciada",
      comercialOrigenId: "usr-comercial-01",
      responsableGeneralId: "usr-ingenieria-01",
      fechaPrimerContacto: "2026-05-30T09:00:00Z",
      fechaIngresoFase1: "2026-06-03T10:00:00Z",
      faseActual: 6,
      creadoEn: "2026-05-30T09:00:00Z",
      actualizadoEn: "2026-09-02T16:00:00Z",
      postulacionSubsidio: {
        id: `post-${exp6Id}`,
        expedienteId: exp6Id,
        estadoActual: "enviada",
        entidadPostulacion: "Compensar (Caja de Compensación Familiar)",
        fechaEnvio: "2026-08-25T14:30:00Z",
        radicadoEnvio: "RAD-COMP-2026-VRD-9982",
        enviadoPorId: "usr-ingenieria-01",
        enviadoPorNombre: "Ing. Roberto Salazar",
        documentosIncluidos: [
          {
            faseOrigen: 5,
            tipo: "licencia",
            nombre: "Licencia de Construcción (Resolución 2026-042)",
            descripcion: "Acto administrativo formal ejecutoriado de la Secretaría de Planeación de Chipaque.",
            identificador: "RES-LC-2026-042",
            incluido: true
          },
          {
            faseOrigen: 4,
            tipo: "presupuesto",
            nombre: "Presupuesto Oficial de Obra y APU Detallado",
            descripcion: "Presupuesto consolidado por $75.400.000 COP con análisis de precios unitarios validado.",
            identificador: "PRE-OFIC-2026-01",
            incluido: true
          },
          {
            faseOrigen: 4,
            tipo: "planos",
            nombre: "Planos Arquitectónicos y Estructurales Aprobados",
            descripcion: "Juego completo de planos escala 1:50 firmados por arquitecto e ingeniero calculista.",
            identificador: "PLN-ARQ-EST-01",
            incluido: true
          },
          {
            faseOrigen: 4,
            tipo: "interventoria",
            nombre: "Concepto Favorable y Revisión Técnica de Interventoría",
            descripcion: "Dictamen favorable de viabilidad constructiva emitido por el frente de Interventoría.",
            identificador: "CON-INT-2026-08",
            incluido: true
          }
        ],
        observacionesEnvio: "Se radica paquete completo de postulación al subsidio de vivienda rural conforme a los requisitos técnicos y jurídicos exigidos por Compensar.",
        soporteEnvio: {
          nombreArchivo: "Radicado_Compensar_Postulacion_9982.pdf",
          mimeType: "application/pdf",
          tamanoBytes: 1845000,
          sha256Hash: "sha256-post-env-9982-demo",
          subidoPor: "Ing. Roberto Salazar",
          subidoEn: "2026-08-25T14:30:00Z"
        },
        rondasSubsanacion: [],
        historial: [
          {
            id: `hist-post-01`,
            fecha: "2026-08-25T14:30:00Z",
            tipo: "envio",
            titulo: "Postulación formal radicada ante Compensar",
            descripcion: "Ingeniería consolidó la Licencia de Construcción, Presupuesto Oficial, Planos y Concepto de Interventoría y radicó el paquete bajo número RAD-COMP-2026-VRD-9982.",
            autorId: "usr-ingenieria-01",
            autorNombre: "Ing. Roberto Salazar",
            autorRol: "ingenieria"
          }
        ],
        creadoEn: "2026-08-25T14:30:00Z",
        actualizadoEn: "2026-08-25T14:30:00Z"
      }
    };
    this.expedientes.push(exp6);

    // 8. Expediente en Fase 7: Entrega y Cierre (120 días - Ubaque)
    const exp7Id = "exp-007-quintero";
    const post7Id = "per-008-jose";
    const predio7Id = "pre-007-ubaque";
    const exp7: Expediente = {
      id: exp7Id,
      postulante: {
        id: post7Id,
        tipoIdentificacion: "CC",
        numeroIdentificacion: "79123890",
        primerNombre: "JOSE",
        segundoNombre: "IGNACIO",
        primerApellido: "QUINTERO",
        segundoApellido: "ROJAS",
        nombres: "JOSE IGNACIO QUINTERO ROJAS",
        telefonoPrincipal: "3129900112",
        correo: "jose.quintero@ejemplo.com"
      },
      hogar: {
        id: "hog-007",
        integrantes: [
          {
            id: "int-hog-08",
            hogarId: "hog-007",
            persona: {
              id: post7Id,
              tipoIdentificacion: "CC",
              numeroIdentificacion: "79123890",
              primerNombre: "JOSE",
              segundoNombre: "IGNACIO",
              primerApellido: "QUINTERO",
              segundoApellido: "ROJAS",
              nombres: "JOSE IGNACIO QUINTERO ROJAS"
            },
            parentesco: "postulante_principal",
            esPostulantePrincipal: true
          }
        ]
      },
      predioVivienda: {
        id: predio7Id,
        departamentoCodigo: "25",
        municipioCodigo: "25841", // Ubaque
        vereda: "Pueblo Viejo",
        nombreODireccion: "Finca Los Sauces - Vereda Pueblo Viejo",
        matriculaInmobiliaria: "166-12398",
        referenciaCatastral: "25841000100020003000",
        esPredioViviendaPrincipal: true
      },
      codigoVisible: calcularCodigoVisible("25841", "79123890", "QUINTERO"),
      estadoGeneral: "en_tramite",
      comercialOrigenId: "usr-comercial-01",
      responsableGeneralId: "usr-asistente-02", // Andrés Gil (Asistente Administrativo II)
      fechaPrimerContacto: "2026-05-08T09:00:00Z",
      fechaIngresoFase1: "2026-05-12T10:00:00Z",
      faseActual: 7,
      creadoEn: "2026-05-08T09:00:00Z",
      actualizadoEn: "2026-09-04T12:00:00Z"
    };
    this.expedientes.push(exp7);

    const reqsF7 = [
      { codigo: "F7-01", nombre: "Acta de Recibo a Satisfacción de Vivienda", desc: "Firma formal de recepción de la vivienda terminada al 100%.", est: "aceptado" },
      { codigo: "F7-02", nombre: "Certificación de Habitabilidad y Servicios", desc: "Constancia de servicios domiciliarios en pleno funcionamiento.", est: "aceptado" },
      { codigo: "F7-03", nombre: "Registro Fotográfico de Entrega de Llaves", desc: "Entrega solemne de llaves al beneficiario y su familia.", est: "aceptado" },
      { codigo: "F7-04", nombre: "Acta de Liquidación y Archivo Documental", desc: "Cierre financiero, paz y salvo final y archivo definitivo en expediente.", est: "recibido_revision" }
    ];
    reqsF7.forEach((r) => {
      this.requisitosCaso.push({
        id: `req-${r.codigo.toLowerCase()}-${exp7Id}`,
        expedienteId: exp7Id,
        codigoRequisito: r.codigo,
        nombre: r.nombre,
        descripcion: r.desc,
        fase: 7,
        predioId: predio7Id,
        estado: r.est as EstadoRequisito,
        esObligatorio: true,
        esAdicional: false
      });
    });

    // ==============================================================
    // INICIALIZACIÓN DE CONFIGURACIÓN MAESTRA DEL SISTEMA (ADMINISTRADOR)
    // ==============================================================
    this.configuracionSistema = {
      departamentos: DEPARTAMENTOS_CONFIG.map((d) => ({ ...d })),
      municipios: CATALOGO_MUNICIPIOS.map((m) => ({ ...m, activo: true })),
      fases: [
        {
          num: 1,
          codigo: "FASE_1",
          label: "Fase 1: En Ingreso Hogar (3 docs)",
          desc: "Verificación y carga de los 3 documentos iniciales de viabilidad jurídica y territorial",
          rolSugerido: "comercial",
          colorBadge: "blue",
          activo: true
        },
        {
          num: 2,
          codigo: "FASE_2",
          label: "Fase 2: En Solicitud 8 Documentos",
          desc: "Recolección y validación jurídica de los 8 documentos familiares complementarios",
          rolSugerido: "asistente",
          colorBadge: "indigo",
          activo: true
        },
        {
          num: 3,
          codigo: "FASE_3",
          label: "Fase 3: En Validación Inicial Compensar",
          desc: "Consolidación de los 11 documentos y remisión a Compensar para concepto inicial",
          rolSugerido: "asistente",
          colorBadge: "amber",
          activo: true
        },
        {
          num: 4,
          codigo: "FASE_4",
          label: "Fase 4: En Recolección de Documentos Técnicos",
          desc: "Levantamientos arquitectónicos, topográficos y de riesgo estructural (3 frentes técnicos)",
          rolSugerido: "ingenieria",
          colorBadge: "emerald",
          activo: true
        },
        {
          num: 5,
          codigo: "FASE_5",
          label: "Fase 5: En Trámite de Licencia de Construcción",
          desc: "Gestión de radicación de licencias urbanísticas y permisos municipales",
          rolSugerido: "ingenieria",
          colorBadge: "teal",
          activo: true
        },
        {
          num: 6,
          codigo: "FASE_6",
          label: "Fase 6: En Postulación",
          desc: "Postulación formal y resolución administrativa de asignación de subsidio",
          rolSugerido: "ingenieria",
          colorBadge: "purple",
          activo: true
        },
        {
          num: 7,
          codigo: "FASE_7",
          label: "Fase 7: En Construcción y Cobro Subsidio",
          desc: "Ejecución de obra constructiva (4 hitos), cierre documental y cobro del subsidio",
          rolSugerido: "supervisor",
          colorBadge: "cyan",
          activo: true
        }
      ],
      requisitosMaestros: [
        // Fase 1
        {
          id: "req-m-f1-01",
          codigo: "F1-01",
          nombre: "Cédula de Ciudadanía del Titular",
          descripcion: "Fotocopia legible por ambas caras al 150% del documento de identidad del postulante titular.",
          fase: 1,
          esObligatorio: true,
          activo: true,
          orden: 1,
          orientacionTecnica: "Verificar vigencia y concordancia con bases de datos de Registraduría."
        },
        {
          id: "req-m-f1-02",
          codigo: "F1-02",
          nombre: "Certificado de Tradición y Libertad / Escritura",
          descripcion: "Certificado de matrícula inmobiliaria con expedición no mayor a 30 días o escritura pública que demuestre posesión o propiedad del predio rural.",
          fase: 1,
          esObligatorio: true,
          activo: true,
          orden: 2,
          orientacionTecnica: "El predio no debe poseer embargos, hipotecas ni gravámenes que limiten la titulación."
        },
        {
          id: "req-m-f1-03",
          codigo: "F1-03",
          nombre: "Certificado de Afiliación a Compensar o Sisbén",
          descripcion: "Constancia de afiliación activa a la Caja de Compensación Compensar o ficha técnica de clasificación Sisbén IV.",
          fase: 1,
          esObligatorio: true,
          activo: true,
          orden: 3,
          orientacionTecnica: "Para caja de compensación se requiere encontrarse en estado activo cotizante o beneficiario."
        },
        // Fase 2
        {
          id: "req-m-f2-01",
          codigo: "F2-01",
          nombre: "Documentos de Identidad del Grupo Familiar",
          descripcion: "Cédulas de ciudadanía, tarjetas de identidad o registros civiles de todos los integrantes del hogar postulante.",
          fase: 2,
          esObligatorio: true,
          activo: true,
          orden: 1
        },
        {
          id: "req-m-f2-02",
          codigo: "F2-02",
          nombre: "Certificado de Ingresos del Hogar",
          descripcion: "Certificados laborales, colillas de pago o certificado de ingresos suscrito ante contador público para trabajadores independientes.",
          fase: 2,
          esObligatorio: true,
          activo: true,
          orden: 2
        },
        {
          id: "req-m-f2-03",
          codigo: "F2-03",
          nombre: "Registro Civil de Matrimonio o Declaración de Unión Marital",
          descripcion: "Acreditación del estado civil de la pareja postulante o declaración extrajuicio de convivencia.",
          fase: 2,
          esObligatorio: true,
          activo: true,
          orden: 3
        },
        {
          id: "req-m-f2-04",
          codigo: "F2-04",
          nombre: "Declaración Juramentada de No Posesión de Otra Vivienda",
          descripcion: "Manifestación formal bajo gravedad de juramento de no ser propietarios de ningún otro inmueble en el territorio nacional.",
          fase: 2,
          esObligatorio: true,
          activo: true,
          orden: 4
        },
        {
          id: "req-m-f2-05",
          codigo: "F2-05",
          nombre: "Certificado de Discapacidad (si aplica)",
          descripcion: "Dictamen médico o certificación RLCPD emitida por EPS o Secretaría de Salud para integrantes con discapacidad.",
          fase: 2,
          esObligatorio: false,
          activo: true,
          orden: 5
        },
        {
          id: "req-m-f2-06",
          codigo: "F2-06",
          nombre: "Certificación de Cuenta Bancaria / Ahorro Programado",
          descripcion: "Certificación bancaria que acredite disponibilidad del aporte o recursos complementarios si fuere requerido.",
          fase: 2,
          esObligatorio: true,
          activo: true,
          orden: 6
        },
        {
          id: "req-m-f2-07",
          codigo: "F2-07",
          nombre: "Certificado de Residencia Rural Municipal",
          descripcion: "Constancia de arraigo y permanencia en la zona rural expedida por la alcaldía municipal o inspección de policía.",
          fase: 2,
          esObligatorio: true,
          activo: true,
          orden: 7
        },
        {
          id: "req-m-f2-08",
          codigo: "F2-08",
          nombre: "Formato de Consentimiento Informado y Habeas Data",
          descripcion: "Autorización expresa para consulta en centrales de riesgo, verificación de bases de datos y tratamiento de información personal.",
          fase: 2,
          esObligatorio: true,
          activo: true,
          orden: 8
        },
        // Fase 3
        {
          id: "req-m-f3-01",
          codigo: "F3-01",
          nombre: "Oficio Remisorio para Concepto de Viabilidad Inicial",
          descripcion: "Carta formal de presentación y remisión del expediente suscrita por Franco Osorio Investment S.A.S. ante Compensar.",
          fase: 3,
          esObligatorio: true,
          activo: true,
          orden: 1
        },
        {
          id: "req-m-f3-02",
          codigo: "F3-02",
          nombre: "Formulario Único Radicado Compensar",
          descripcion: "Formulario con sello oficial de radicación y número de expediente asignado por la Caja de Compensación.",
          fase: 3,
          esObligatorio: true,
          activo: true,
          orden: 2
        },
        {
          id: "req-m-f3-03",
          codigo: "F3-03",
          nombre: "Concepto Técnico y Jurídico Favorable Compensar",
          descripcion: "Oficio de aprobación inicial emitido por el comité técnico de vivienda de Compensar que autoriza formular proyectos.",
          fase: 3,
          esObligatorio: true,
          activo: true,
          orden: 3
        },
        // Fase 4
        {
          id: "req-m-f4-01",
          codigo: "F4-01",
          nombre: "Levantamiento Topográfico y Planimetría Predial",
          descripcion: "Plano georreferenciado con coordenadas MAGNA-SIRGAS, curvas de nivel y polígono del lote.",
          fase: 4,
          esObligatorio: true,
          activo: true,
          orden: 1
        },
        {
          id: "req-m-f4-02",
          codigo: "F4-02",
          nombre: "Estudio Geotécnico y Mecánica de Suelos",
          descripcion: "Informe geotécnico con sondeos, capacidad portante y recomendaciones de cimentación según NSR-10.",
          fase: 4,
          esObligatorio: true,
          activo: true,
          orden: 2
        },
        {
          id: "req-m-f4-03",
          codigo: "F4-03",
          nombre: "Planos Arquitectónicos y Distribución Espacial",
          descripcion: "Plantas, cortes, fachadas y detalles constructivos firmados por arquitecto con matrícula profesional vigente.",
          fase: 4,
          esObligatorio: true,
          activo: true,
          orden: 3
        },
        {
          id: "req-m-f4-04",
          codigo: "F4-04",
          nombre: "Cálculo Estructural y Memorias NSR-10",
          descripcion: "Memorias de cálculo sismorresistente con especificaciones de refuerzo y concreto bajo normativa colombiana NSR-10.",
          fase: 4,
          esObligatorio: true,
          activo: true,
          orden: 4
        },
        {
          id: "req-m-f4-05",
          codigo: "F4-05",
          nombre: "Planos Hidrosanitarios y Sistema Séptico",
          descripcion: "Diseño de redes de suministro de agua potable, desagües y pozo séptico rural con campo de infiltración.",
          fase: 4,
          esObligatorio: true,
          activo: true,
          orden: 5
        },
        {
          id: "req-m-f4-06",
          codigo: "F4-06",
          nombre: "Diseño Eléctrico RETIE y Cuadro de Cargas",
          descripcion: "Planos eléctricos de iluminación, tomacorrientes y sistema de puesta a tierra certificado por ingeniero electricista.",
          fase: 4,
          esObligatorio: true,
          activo: true,
          orden: 6
        },
        // Fase 5
        {
          id: "req-m-f5-01",
          codigo: "F5-01",
          nombre: "Formulario Único Nacional para Solicitud de Licencia",
          descripcion: "Formulario debidamente diligenciado y radicado ante la secretaría de planeación o curaduría urbana.",
          fase: 5,
          esObligatorio: true,
          activo: true,
          orden: 1
        },
        {
          id: "req-m-f5-02",
          codigo: "F5-02",
          nombre: "Radicado Oficial ante Planeación Municipal o Curaduría",
          descripcion: "Acta formal de radicación con número consecutivo de expediente municipal.",
          fase: 5,
          esObligatorio: true,
          activo: true,
          orden: 2
        },
        {
          id: "req-m-f5-03",
          codigo: "F5-03",
          nombre: "Valla de Trámite o Notificación Vecinal",
          descripcion: "Constancia fotográfica de fijación de la valla informativa del trámite de licencia en el predio.",
          fase: 5,
          esObligatorio: true,
          activo: true,
          orden: 3
        },
        {
          id: "req-m-f5-04",
          codigo: "F5-04",
          nombre: "Acto Administrativo de Licencia de Construcción Ejecutoriada",
          descripcion: "Resolución de otorgamiento de la licencia de construcción en modalidad obra nueva rural con constancia de ejecutoria.",
          fase: 5,
          esObligatorio: true,
          activo: true,
          orden: 4
        },
        // Fase 6
        {
          id: "req-m-f6-01",
          codigo: "F6-01",
          nombre: "Formulario de Postulación al Subsidio Familiar de Vivienda Rural",
          descripcion: "Formulario oficial de postulación suscrito por los miembros del hogar con firma y huella.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 1
        },
        {
          id: "req-m-f6-02",
          codigo: "F6-02",
          nombre: "Certificación de Cierre Financiero y Aporte del 10%",
          descripcion: "Documento que acredita la conformación de los recursos totales (subsidio + aporte propio o municipal).",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 2
        },
        {
          id: "req-m-f6-03",
          codigo: "F6-03",
          nombre: "Certificado de Elegibilidad Emitido por Entidad Evaluadora",
          descripcion: "Certificación de cumplimiento integral de los requisitos normativos del programa de vivienda rural.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 3
        },
        {
          id: "req-m-f6-04",
          codigo: "F6-04",
          nombre: "Carta de Asignación y Resolución de Subsidio Compensar",
          descripcion: "Resolución formal de asignación de recursos del subsidio expedida por el Consejo Directivo de Compensar.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 4
        },
        // Fase 7
        {
          id: "req-m-f7-01",
          codigo: "F7-01",
          nombre: "Acta de Recibo a Satisfacción de Vivienda",
          descripcion: "Firma formal de recepción de la vivienda terminada al 100% por el beneficiario y la supervisión técnica.",
          fase: 7,
          esObligatorio: true,
          activo: true,
          orden: 1
        },
        {
          id: "req-m-f7-02",
          codigo: "F7-02",
          nombre: "Certificación de Habitabilidad y Servicios",
          descripcion: "Constancia técnica de servicios públicos domiciliarios activos y plenas condiciones higiénico-sanitarias.",
          fase: 7,
          esObligatorio: true,
          activo: true,
          orden: 2
        },
        {
          id: "req-m-f7-03",
          codigo: "F7-03",
          nombre: "Registro Fotográfico de Entrega de Llaves",
          descripcion: "Acto solemne de entrega de llaves al hogar beneficiario con evidencia fotográfica en alta resolución.",
          fase: 7,
          esObligatorio: true,
          activo: true,
          orden: 3
        },
        {
          id: "req-m-f7-04",
          codigo: "F7-04",
          nombre: "Acta de Liquidación y Archivo Documental",
          descripcion: "Liquidación contractual y financiera de la obra, paz y salvo final y consolidación documental definitiva.",
          fase: 7,
          esObligatorio: true,
          activo: true,
          orden: 4
        }
      ],
      plantillasFases: {
        fase4: {
          titulo: "Fase 4: Recolección de Documentos Técnicos e Ingeniería",
          descripcion: "Desarrollo y coordinación técnica integral de los 3 frentes de ingeniería y arquitectura requeridos para el licenciamiento urbanístico rural.",
          frente1Titulo: "Frente 1: Arquitectura y Urbanismo",
          frente1Desc: "Levantamientos topográficos georreferenciados, implantación en terreno rural y diseño arquitectónico bioclimático.",
          frente2Titulo: "Frente 2: Ingeniería Estructural NSR-10 y Geotecnia",
          frente2Desc: "Estudio de suelos con perfil estratigráfico y cálculo estructural de vivienda de mampostería confinada según NSR-10.",
          frente3Titulo: "Frente 3: Redes Hidrosanitarias, Eléctricas y Manejo Ambiental",
          frente3Desc: "Diseño hidrosanitario con tratamiento de aguas residuales mediante pozo séptico y diseño eléctrico bajo norma RETIE."
        },
        fase5: {
          titulo: "Fase 5: Trámite de Licencia de Construcción",
          descripcion: "Acompañamiento, radicación y seguimiento expedito ante las Curadurías Urbanas o Secretarías de Planeación Municipal.",
          orientacionCuraduria: "Verificar previamente los requisitos específicos de cada municipio de Cundinamarca respecto al POT/EOT vigente."
        },
        fase6: {
          titulo: "Fase 6: Postulación al Subsidio Familiar",
          descripcion: "Radicación del expediente completo y cierre financiero ante Compensar para la emisión de la resolución de asignación de subsidio.",
          instruccionesCompensar: "Comprobar que todas las firmas y huellas coincidan exactamente con la cédula de ciudadanía del titular y cónyuge."
        },
        fase7: {
          titulo: "Fase 7: En Construcción y Cobro Subsidio",
          descripcion: "Control de obra en campo, cumplimiento de los 4 hitos constructivos, cierre de expediente y radicación de cobro del subsidio.",
          instruccionesObra: "Cada hito requiere registro fotográfico detallado y certificación firmada por el arquitecto supervisor asignado."
        }
      }
    };

    this.auditoriaAdmin = [
      {
        id: "aud-001",
        fecha: "2026-09-01T09:00:00Z",
        adminId: "usr-admin-01",
        adminNombre: "Administrador de Sistemas",
        accion: "INICIALIZACION_SISTEMA",
        detalle: "Configuración inicial del sistema: 116 municipios de Cundinamarca, 7 fases operativas y catálogo maestro de requisitos.",
        categoria: "sistema"
      },
      {
        id: "aud-002",
        fecha: "2026-09-02T14:30:00Z",
        adminId: "usr-admin-01",
        adminNombre: "Administrador de Sistemas",
        accion: "AUDITORIA_ROLES",
        detalle: "Verificación de perfiles activos: 1 Comercial, 1 Supervisor, 2 Asistentes, 1 Ingeniería y 1 Administrador.",
        categoria: "usuarios"
      }
    ];
  }
}

export const mockDb = new MockDatabase();
