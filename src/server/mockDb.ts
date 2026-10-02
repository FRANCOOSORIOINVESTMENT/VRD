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

// BANCO DE CUENTAS CORPORATIVAS CON CIFRADO BCRYPT ($2b$10$... hash de "crm2026*")
const HASH_DEFECTO_BCRYPT = "$2b$10$R7Ln7bHfwo31wfJtcsos4uhsG/41vfYkftg1GdnBpFku/Uht74jNO";

export const CUENTAS_FICTICIAS: (PerfilUsuario & {
  passwordHash: string;
  password_hash: string;
  requiereCambioPassword: boolean;
  requiere_cambio_password: boolean;
})[] = [
  {
    id: "usr-comercial-01",
    username: "comercial.franco",
    email: "comercial.prueba@franco.co",
    nombreCompleto: "Carlos Mendoza (Gestor Rural)",
    rol: "comercial",
    activo: true,
    creadoEn: "2026-09-01T08:00:00Z",
    passwordHash: HASH_DEFECTO_BCRYPT,
    password_hash: HASH_DEFECTO_BCRYPT,
    requiereCambioPassword: false,
    requiere_cambio_password: false
  },
  {
    id: "usr-supervisor-01",
    username: "supervisor.franco",
    email: "supervisor.prueba@franco.co",
    nombreCompleto: "Dra. Helena Ramírez (Analista Documental)",
    rol: "supervisor",
    activo: true,
    creadoEn: "2026-09-01T08:00:00Z",
    passwordHash: HASH_DEFECTO_BCRYPT,
    password_hash: HASH_DEFECTO_BCRYPT,
    requiereCambioPassword: false,
    requiere_cambio_password: false
  },
  {
    id: "usr-asistente-01",
    username: "asistente.franco",
    email: "asistente.prueba@franco.co",
    nombreCompleto: "Laura Castillo (Gestor Documental)",
    rol: "asistente",
    activo: true,
    creadoEn: "2026-09-01T08:00:00Z",
    passwordHash: HASH_DEFECTO_BCRYPT,
    password_hash: HASH_DEFECTO_BCRYPT,
    requiereCambioPassword: false,
    requiere_cambio_password: false
  },
  {
    id: "usr-ingenieria-01",
    username: "ingenieria.franco",
    email: "ingenieria.prueba@franco.co",
    nombreCompleto: "Ing. Roberto Salazar (Coordinador Técnico)",
    rol: "ingenieria",
    activo: true,
    creadoEn: "2026-09-01T08:00:00Z",
    passwordHash: HASH_DEFECTO_BCRYPT,
    password_hash: HASH_DEFECTO_BCRYPT,
    requiereCambioPassword: false,
    requiere_cambio_password: false
  },
  {
    id: "usr-admin-01",
    username: "admin.franco",
    email: "admin.prueba@franco.co",
    nombreCompleto: "Administrador de Sistemas",
    rol: "administrador",
    activo: true,
    creadoEn: "2026-09-01T08:00:00Z",
    passwordHash: HASH_DEFECTO_BCRYPT,
    password_hash: HASH_DEFECTO_BCRYPT,
    requiereCambioPassword: false,
    requiere_cambio_password: false
  }
];

class MockDatabase {
  perfiles: (PerfilUsuario & {
    passwordHash: string;
    password_hash?: string;
    requiereCambioPassword?: boolean;
    requiere_cambio_password?: boolean;
  })[] = [...CUENTAS_FICTICIAS];
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
    // Inicialización limpia: Sin expedientes ni interesados de prueba
    this.interesados = [];
    this.expedientes = [];
    this.requisitosCaso = [];
    this.documentos = [];
    this.versiones = [];
    this.revisiones = [];
    this.notas = [];
    this.tareas = [];
    this.eventosSalida = [];
    this.cartasSalida = [];
    this.solicitudesRetiro = [];
    this.auditoriaAdmin = [];

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
