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
    id: "757ef367-c0bd-480a-b294-d5fef041f39c",
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
    id: "f00564c8-adb3-46d2-b154-837b9e7386aa",
    username: "supervisor.franco",
    email: "supervisor.prueba@franco.co",
    nombreCompleto: "Dra. Helena Ramírez (Supervisor)",
    rol: "supervisor",
    activo: true,
    creadoEn: "2026-09-01T08:00:00Z",
    passwordHash: HASH_DEFECTO_BCRYPT,
    password_hash: HASH_DEFECTO_BCRYPT,
    requiereCambioPassword: false,
    requiere_cambio_password: false
  },
  {
    id: "ee12d5e6-34cf-4de5-b11a-f256ddde4be2",
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
    id: "73e7181a-02ea-49a9-afaa-7c58e7097a24",
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
    id: "a49c95b6-75da-48cb-a827-0cf4957e8c3b",
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
          nombre: "Certificado de Tradición y Libertad",
          descripcion: "Certificado de matrícula inmobiliaria expedido por la ORIP con vigencia no mayor a 90 días calendario respecto a la revisión. Debe registrar el folio de matrícula.",
          fase: 1,
          esObligatorio: true,
          activo: true,
          orden: 1,
          orientacionTecnica: "Verificar que el predio no cuente con embargos, hipotecas activas ni gravámenes que limiten la titulación."
        },
        {
          id: "req-m-f1-02",
          codigo: "F1-02",
          nombre: "Escritura Pública",
          descripcion: "Copia de la escritura pública del predio, resolución administrativa de adjudicación o título de sana posesión debidamente protocolizado con número y fecha correspondiente.",
          fase: 1,
          esObligatorio: true,
          activo: true,
          orden: 2,
          orientacionTecnica: "Debe estar completamente separado del Certificado de Tradición y Libertad. Verificar número de escritura, notaría y fecha."
        },
        {
          id: "req-m-f1-03",
          codigo: "F1-03",
          nombre: "Cédula de Ciudadanía del Postulante",
          descripcion: "Fotocopia legible por ambas caras al 150% del documento de identidad del postulante titular.",
          fase: 1,
          esObligatorio: true,
          activo: true,
          orden: 3,
          orientacionTecnica: "Verificar plena coincidencia con las bases de datos de Registraduría."
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
        {
          id: "req-m-f2-09",
          codigo: "F2-09",
          nombre: "Certificado de Disponibilidad de Agua",
          descripcion: "Certificación o factura de disponibilidad del servicio público de acueducto o agua veredal con vigencia no superior a 90 días.",
          fase: 2,
          esObligatorio: true,
          activo: true,
          orden: 9,
          orientacionTecnica: "Completamente separado del recibo de energía. Vigencia máxima 90 días."
        },
        {
          id: "req-m-f2-10",
          codigo: "F2-10",
          nombre: "Certificado de Disponibilidad de Energía",
          descripcion: "Constancia de disponibilidad de servicio de energía eléctrica o factura reciente del operador de red con vigencia no superior a 90 días.",
          fase: 2,
          esObligatorio: true,
          activo: true,
          orden: 10,
          orientacionTecnica: "Completamente separado del recibo de agua. Vigencia máxima 90 días."
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
          descripcion: "Juego técnico integral de planos del proyecto. NOTA OBLIGATORIA: El paquete se conforma obligatoriamente de: 1. Planos estructurales, 2. Planos arquitectónicos, 3. Plano de implantación, 4. Planos eléctricos y 5. Planos hidrosanitarios.",
          fase: 4,
          esObligatorio: true,
          activo: true,
          orden: 3,
          orientacionTecnica: "Se debe validar la inclusión de los 5 tipos de planos técnicos: estructurales, arquitectónicos, implantación, eléctricos e hidrosanitarios."
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
        // Fase 6 (Catálogo Oficial de 28 Documentos en Orden Estricto)
        {
          id: "req-m-f6-01",
          codigo: "F6-01",
          nombre: "Datos del proyecto ANEXO DOC",
          descripcion: "Ficha y anexo técnico con los datos consolidados del proyecto de vivienda rural.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 1,
          orientacionTecnica: "Documento inicial oficial del proyecto."
        },
        {
          id: "req-m-f6-02",
          codigo: "F6-02",
          nombre: "Formulario de postulación diligenciado",
          descripcion: "Formulario oficial de postulación al subsidio familiar suscrito por el hogar con firma y huella.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 2,
          orientacionTecnica: "Verificar firmas y huellas de todos los integrantes mayores de edad."
        },
        {
          id: "req-m-f6-03",
          codigo: "F6-03",
          nombre: "Documentos de identidad del grupo familiar",
          descripcion: "Cédulas de ciudadanía al 150%, tarjetas de identidad y registros civiles de los integrantes del hogar.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 3,
          orientacionTecnica: "Legibilidad al 100% por ambas caras."
        },
        {
          id: "req-m-f6-04",
          codigo: "F6-04",
          nombre: "Certificado de ingresos o certificado laboral",
          descripcion: "Certificación laboral vigente (no mayor a 30 días) o colillas de nómina para asalariados.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 4,
          orientacionTecnica: "Indica cargo, salario, antigüedad y tipo de vinculación."
        },
        {
          id: "req-m-f6-05",
          codigo: "F6-05",
          nombre: "Paquete Contador (independientes: antecedentes, cédula y tarjeta profesional)",
          descripcion: "Certificación de ingresos suscrita por contador público con antecedentes vigentes y tarjeta profesional.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 5,
          orientacionTecnica: "Para independientes. Certificado de la JCC vigente."
        },
        {
          id: "req-m-f6-06",
          codigo: "F6-06",
          nombre: "Constancia de independientes",
          descripcion: "Declaración formal o extrajuicio de la actividad comercial o agropecuaria independiente.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 6,
          orientacionTecnica: "Acredita actividad económica lícita."
        },
        {
          id: "req-m-f6-07",
          codigo: "F6-07",
          nombre: "Certificado de ahorro (cesantías, preaprobado, aprobado, CDT, subsidios complementarios, cuenta bancaria con saldo)",
          descripcion: "Certificación bancaria que acredite disponibilidad del recurso de cierre financiero y aporte del hogar.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 7,
          orientacionTecnica: "Cuenta inmovilizada o saldo disponible."
        },
        {
          id: "req-m-f6-08",
          codigo: "F6-08",
          nombre: "Documento civil (registro civil matrimonio, extrajuicio)",
          descripcion: "Acreditación del estado civil del hogar (registro civil de matrimonio o unión marital de hecho).",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 8,
          orientacionTecnica: "Acredita conformación del hogar."
        },
        {
          id: "req-m-f6-09",
          codigo: "F6-09",
          nombre: "Certificado de tradición y libertad (con número de matrícula)",
          descripcion: "Certificado de tradición y libertad con número de matrícula inmobiliaria expedido dentro de los 90 días.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 9,
          orientacionTecnica: "Vigencia menor a 90 días. Matrícula visible."
        },
        {
          id: "req-m-f6-10",
          codigo: "F6-10",
          nombre: "Escritura, Resolución o sana posesión (con número o fecha correspondiente)",
          descripcion: "Título de propiedad, escritura pública, resolución de adjudicación o sana posesión. SEPARADO DE TRADICIÓN.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 10,
          orientacionTecnica: "Debe quedar en archivo separado de tradición y libertad."
        },
        {
          id: "req-m-f6-11",
          codigo: "F6-11",
          nombre: "Impuesto predial (año en curso)",
          descripcion: "Comprobante de pago o paz y salvo del impuesto predial unificado de la vigencia del año en curso.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 11,
          orientacionTecnica: "Vigencia obligatoria del año en curso."
        },
        {
          id: "req-m-f6-12",
          codigo: "F6-12",
          nombre: "Presupuesto (PDF firmado)",
          descripcion: "Presupuesto consolidado oficial de obra firmado en PDF por el profesional competente.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 12,
          orientacionTecnica: "Verificar firma y matrícula profesional."
        },
        {
          id: "req-m-f6-13",
          codigo: "F6-13",
          nombre: "Memoria de cantidades",
          descripcion: "Desglose detallado de cantidades de obra y cómputos métricos por capítulos constructivos.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 13,
          orientacionTecnica: "Cálculo de materiales y unidades."
        },
        {
          id: "req-m-f6-14",
          codigo: "F6-14",
          nombre: "Especificaciones técnicas",
          descripcion: "Manual de especificaciones constructivas y calidades de materiales según NSR-10.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 14,
          orientacionTecnica: "Detalle constructivo de acabados y estructura."
        },
        {
          id: "req-m-f6-15",
          codigo: "F6-15",
          nombre: "Acta y registro fotográfico",
          descripcion: "Registro fotográfico nítido y acta técnica de inspección del terreno y linderos del predio.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 15,
          orientacionTecnica: "Fotografías a color de entorno y lote."
        },
        {
          id: "req-m-f6-16",
          codigo: "F6-16",
          nombre: "Planos de intervención (Sellados)",
          descripcion: "Planos de intervención en predio debidamente sellados por la autoridad municipal o curaduría.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 16,
          orientacionTecnica: "Sellos oficiales legibles."
        },
        {
          id: "req-m-f6-17",
          codigo: "F6-17",
          nombre: "Licencia de construcción (con número de resolución)",
          descripcion: "Acto administrativo de otorgamiento de la licencia urbanística con número de resolución y constancia de ejecutoria.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 17,
          orientacionTecnica: "Resolución municipal ejecutoriada."
        },
        {
          id: "req-m-f6-18",
          codigo: "F6-18",
          nombre: "Planos aprobados",
          descripcion: "Juego de planos aprobados. NOTA OBLIGATORIA: Deben incluir: estructurales, arquitectónicos, implantación, eléctricos e hidrosanitarios.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 18,
          orientacionTecnica: "Paquete de 5 especialidades de planos."
        },
        {
          id: "req-m-f6-19",
          codigo: "F6-19",
          nombre: "Nomenclatura (vigencia año en curso)",
          descripcion: "Certificado oficial de nomenclatura expedido por la alcaldía municipal con vigencia del año en curso.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 19,
          orientacionTecnica: "Vigencia año en curso."
        },
        {
          id: "req-m-f6-20",
          codigo: "F6-20",
          nombre: "Certificado de uso de suelo individual (vigencia año en curso)",
          descripcion: "Concepto de uso del suelo expedido por planeación municipal con vigencia del año en curso.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 20,
          orientacionTecnica: "Vigencia año en curso."
        },
        {
          id: "req-m-f6-21",
          codigo: "F6-21",
          nombre: "Certificado de riesgo individual (vigencia año en curso)",
          descripcion: "Certificación de no riesgo ni amenaza no mitigable expedida en el año en curso.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 21,
          orientacionTecnica: "Vigencia año en curso."
        },
        {
          id: "req-m-f6-22",
          codigo: "F6-22",
          nombre: "Certificado de No habitabilidad o demolición objeto de postulación (Si aplica)",
          descripcion: "Dictamen técnico de inhabitabilidad de la vivienda actual o autorización de demolición (si aplica).",
          fase: 6,
          esObligatorio: false,
          activo: true,
          orden: 22,
          orientacionTecnica: "Aplica para sustitución o predio en riesgo."
        },
        {
          id: "req-m-f6-23",
          codigo: "F6-23",
          nombre: "Formato de transporte (expedido por nuestra interventoría)",
          descripcion: "Certificación oficial de transporte y acarreo de materiales expedida por nuestra interventoría.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 23,
          orientacionTecnica: "Firma de la interventoría técnica."
        },
        {
          id: "req-m-f6-24",
          codigo: "F6-24",
          nombre: "Contrato",
          descripcion: "Contrato de obra o mandato suscrito entre el hogar postulante y el constructor / operador.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 24,
          orientacionTecnica: "Firmado por las partes."
        },
        {
          id: "req-m-f6-25",
          codigo: "F6-25",
          nombre: "Servicios públicos (vigencia no superior a 90 días)",
          descripcion: "Disponibilidad de agua y energía con vigencia no superior a 90 días (archivos separados).",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 25,
          orientacionTecnica: "Vigencia no superior a 90 días. Agua y Energía separados."
        },
        {
          id: "req-m-f6-26",
          codigo: "F6-26",
          nombre: "Arraigo (si lo requiere)",
          descripcion: "Certificado de arraigo y permanencia en el territorio rural (si es requerido por el municipio).",
          fase: 6,
          esObligatorio: false,
          activo: true,
          orden: 26,
          orientacionTecnica: "Expedido por alcaldía o junta comunal."
        },
        {
          id: "req-m-f6-27",
          codigo: "F6-27",
          nombre: "Excel presupuesto",
          descripcion: "Archivo en formato de hoja de cálculo Excel (.xlsx) con el presupuesto detallado y análisis de precios unitarios.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 27,
          orientacionTecnica: "Archivo nativo en Excel con fórmulas."
        },
        {
          id: "req-m-f6-28",
          codigo: "F6-28",
          nombre: "Anexo (CONSTANCIA)",
          descripcion: "Constancia final institucional y anexo de cierre documental para entrega ante Compensar.",
          fase: 6,
          esObligatorio: true,
          activo: true,
          orden: 28,
          orientacionTecnica: "Constancia de radicación formal."
        },
        // Fase 7: Formatos Oficiales de Compensar y Cierre Técnico
        {
          id: "req-m-f7-01",
          codigo: "F7-01",
          nombre: "Acta de Inicio de Contrato (Compensar)",
          descripcion: "Formato oficial de Compensar para el acta de inicio de contrato del subsidio de vivienda.",
          fase: 7,
          esObligatorio: true,
          activo: true,
          orden: 1
        },
        {
          id: "req-m-f7-02",
          codigo: "F7-02",
          nombre: "Acta de Inicio de Obra (Compensar)",
          descripcion: "Formato oficial de Compensar que certifica el inicio formal de las obras civiles en terreno.",
          fase: 7,
          esObligatorio: true,
          activo: true,
          orden: 2
        },
        {
          id: "req-m-f7-03",
          codigo: "F7-03",
          nombre: "Acta de Entrega (Compensar)",
          descripcion: "Formato oficial de Compensar para el acta de entrega y cierre técnico entre las partes.",
          fase: 7,
          esObligatorio: true,
          activo: true,
          orden: 3
        },
        {
          id: "req-m-f7-04",
          codigo: "F7-04",
          nombre: "Certificado de Habitabilidad y Servicios",
          descripcion: "Constancia técnica de servicios públicos domiciliarios activos y plenas condiciones higiénico-sanitarias.",
          fase: 7,
          esObligatorio: true,
          activo: true,
          orden: 4
        },
        {
          id: "req-m-f7-05",
          codigo: "F7-05",
          nombre: "Registro Fotográfico de Entrega",
          descripcion: "Evidencia fotográfica en alta resolución y/o reporte consolidado de la vivienda terminada y entrega de llaves.",
          fase: 7,
          esObligatorio: true,
          activo: true,
          orden: 5
        },
        {
          id: "req-m-f7-06",
          codigo: "F7-06",
          nombre: "Acta de Recibo a Satisfacción de Vivienda",
          descripcion: "Firma formal de recepción de la vivienda terminada al 100% por el beneficiario y la supervisión técnica.",
          fase: 7,
          esObligatorio: true,
          activo: true,
          orden: 6
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
