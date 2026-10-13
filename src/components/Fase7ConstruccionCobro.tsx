import React, { useState } from "react";
import {
  Building2,
  HardHat,
  FileCheck2,
  Landmark,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Upload,
  Eye,
  Camera,
  DollarSign,
  Send,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Calendar,
  Layers,
  ChevronRight,
  MessageSquareText,
  Plus,
  Trash2,
  X,
  Lock,
  Download,
  Receipt,
  UserCheck,
  Info
} from "lucide-react";
import {
  Expediente,
  PerfilUsuario,
  GestionFase7,
  HitoConstruccion,
  DocumentoCierreCobro,
  FotoRegistro,
  SoporteFase7,
  RondaSubsanacionDesembolso,
  SeguimientoDesembolsoCompensar
} from "../types";
import { formatearNombreUsuario } from "../utils/formatoRoles";

interface Fase7ConstruccionCobroProps {
  expediente: Expediente;
  currentUser: PerfilUsuario;
  onAbrirVisor: (datos: {
    titulo: string;
    nombreArchivo: string;
    mimeType: string;
    sha256Hash?: string;
    tamanoBytes?: number;
    archivoDataUrl?: string;
    fotos?: FotoRegistro[];
  }) => void;
  onActualizarExpediente: () => Promise<void>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

// 4 hitos constructivos oficiales
const HITOS_DEFAULT_CONFIG = [
  {
    codigo: "hito_1_cimentacion" as const,
    numero: 1,
    nombre: "Cimentación completada",
    descripcion: "Adecuación del terreno, vigas de cimentación, ciclópeo y losa de contrapiso estructural."
  },
  {
    codigo: "hito_2_mamposteria" as const,
    numero: 2,
    nombre: "Mampostería y cubiertas (cuchillas) completadas",
    descripcion: "Levantamiento de muros estructurales, columnetas de confinamiento, vigas de corona y cuchillas/culatas."
  },
  {
    codigo: "hito_3_cubierta" as const,
    numero: 3,
    nombre: "Cubierta completada",
    descripcion: "Estructura portante de cubierta, cerchas/correas, tejas termoacústicas y caballetes impermeabilizantes."
  },
  {
    codigo: "hito_4_acabados" as const,
    numero: 4,
    nombre: "Finalización total de la vivienda con todos los acabados",
    descripcion: "Instalaciones hidrosanitarias, eléctricas, carpintería metálica/madera, pisos, pintura y habitabilidad 100%."
  }
];

// 6 documentos oficiales de Fase 7 (3 Formatos de Compensar + 3 Formatos de Cierre Técnico)
const DOCUMENTOS_DEFAULT_CONFIG = [
  // 1. INCORPORACIÓN DE FORMATOS DE COMPENSAR
  {
    codigo: "F7-01",
    nombre: "Acta de inicio de contrato",
    descripcion: "Formato oficial de Compensar para el acta de inicio de contrato del subsidio de vivienda rural.",
    seccion: "formatos_compensar" as const,
    tiposPermitidos: ".pdf,application/pdf"
  },
  {
    codigo: "F7-02",
    nombre: "Acta de inicio de obra",
    descripcion: "Formato oficial de Compensar que certifica el inicio formal de las obras civiles en el predio.",
    seccion: "formatos_compensar" as const,
    tiposPermitidos: ".pdf,application/pdf"
  },
  {
    codigo: "F7-03",
    nombre: "Acta de entrega",
    descripcion: "Formato oficial de Compensar para el acta de entrega y cierre técnico entre las partes.",
    seccion: "formatos_compensar" as const,
    tiposPermitidos: ".pdf,application/pdf"
  },
  // 2. CONSERVACIÓN DE FORMATOS EXISTENTES
  {
    codigo: "F7-04",
    nombre: "Certificado de habitabilidad y servicios",
    descripcion: "Constancia técnica de servicios públicos domiciliarios activos y plenas condiciones higiénico-sanitarias.",
    seccion: "formatos_cierre_existentes" as const,
    tiposPermitidos: ".pdf,image/*,application/pdf,image/jpeg,image/png"
  },
  {
    codigo: "F7-05",
    nombre: "Registro fotográfico de entrega",
    descripcion: "Evidencia fotográfica en alta resolución y/o reporte consolidado de la vivienda terminada y entrega de llaves.",
    seccion: "formatos_cierre_existentes" as const,
    tiposPermitidos: ".pdf,image/*,application/pdf,image/jpeg,image/png"
  },
  {
    codigo: "F7-06",
    nombre: "Acta de recibo a satisfacción de vivienda",
    descripcion: "Firma formal de recepción de la vivienda terminada al 100% por el beneficiario y la supervisión técnica.",
    seccion: "formatos_cierre_existentes" as const,
    tiposPermitidos: ".pdf,image/*,application/pdf,image/jpeg,image/png"
  }
];

export const Fase7ConstruccionCobro: React.FC<Fase7ConstruccionCobroProps> = ({
  expediente,
  currentUser,
  onAbrirVisor,
  onActualizarExpediente,
  authFetch
}) => {
  // Inicialización de estructura defensiva
  const gestionFase7: GestionFase7 = expediente.gestionFase7 || {
    id: `f7-${expediente.id}`,
    expedienteId: expediente.id,
    estadoGeneralFase7: "en_construccion",
    hitosConstruccion: HITOS_DEFAULT_CONFIG.map((cfg) => ({
      codigo: cfg.codigo,
      numero: cfg.numero,
      nombre: cfg.nombre,
      descripcion: cfg.descripcion,
      completado: false,
      fotos: []
    })),
    obraFinalizada: false,
    documentosCierre: DOCUMENTOS_DEFAULT_CONFIG.map((cfg) => ({
      id: `f7-doc-${cfg.codigo.toLowerCase()}-${expediente.id}`,
      codigo: cfg.codigo,
      nombre: cfg.nombre,
      descripcion: cfg.descripcion,
      seccion: cfg.seccion,
      tiposPermitidos: cfg.tiposPermitidos,
      estado: "pendiente"
    })),
    documentosCierreCompletos: false,
    formatosDocumentales: {},
    desembolso: {
      estadoActual: "pendiente_documentos",
      entidad: "Compensar (Caja de Compensación Familiar)",
      documentosIncluidos: ["F7-01", "F7-02", "F7-03", "F7-04", "F7-05", "F7-06"],
      rondasSubsanacion: []
    },
    historial: [],
    creadoEn: new Date().toISOString(),
    actualizadoEn: new Date().toISOString()
  };

  // Roles y permisos
  const esSupervisor = currentUser.rol === "supervisor";
  const esIngenieria = currentUser.rol === "ingenieria";
  const esAdmin = currentUser.rol === "administrador";
  const puedeOperarHitos = esSupervisor || esAdmin;
  const puedeOperarDesembolso = esIngenieria || esAdmin;
  const puedeGestionarDocumentos = esSupervisor || esIngenieria || esAdmin;

  // Estados locales para modales
  const [modalHito, setModalHito] = useState<HitoConstruccion | null>(null);
  const [formFechaHito, setFormFechaHito] = useState<string>("");
  const [formObservacionesHito, setFormObservacionesHito] = useState<string>("");
  const [formFotosHito, setFormFotosHito] = useState<FotoRegistro[]>([]);
  const [descripcionFotoActual, setDescripcionFotoActual] = useState<{ [fotoId: string]: string }>({});

  const [modalDoc, setModalDoc] = useState<DocumentoCierreCobro | null>(null);
  const [modalConfirmarEliminarDoc, setModalConfirmarEliminarDoc] = useState<DocumentoCierreCobro | null>(null);
  const [docArchivoTemp, setDocArchivoTemp] = useState<{
    nombreArchivo: string;
    archivoDataUrl: string;
    mimeType: string;
    tamanoBytes: number;
    sha256Hash: string;
  } | null>(null);

  const [modalSolicitarDesembolso, setModalSolicitarDesembolso] = useState(false);
  const [formRadicadoSolicitud, setFormRadicadoSolicitud] = useState("");
  const [formFechaSolicitud, setFormFechaSolicitud] = useState(new Date().toISOString().split("T")[0]);
  const [formNotasSolicitud, setFormNotasSolicitud] = useState("");
  const [soporteSolicitudTemp, setSoporteSolicitudTemp] = useState<SoporteFase7 | null>(null);

  const [modalObservacionDesembolso, setModalObservacionDesembolso] = useState(false);
  const [formRadicadoObs, setFormRadicadoObs] = useState("");
  const [formDetalleObs, setFormDetalleObs] = useState("");
  const [soporteObsTemp, setSoporteObsTemp] = useState<SoporteFase7 | null>(null);

  const [modalSubsanarDesembolso, setModalSubsanarDesembolso] = useState<RondaSubsanacionDesembolso | null>(null);
  const [formRadicadoSubsanacion, setFormRadicadoSubsanacion] = useState("");
  const [formDetalleSubsanacion, setFormDetalleSubsanacion] = useState("");
  const [soporteSubsanacionTemp, setSoporteSubsanacionTemp] = useState<SoporteFase7 | null>(null);

  const [modalConfirmarDesembolso, setModalConfirmarDesembolso] = useState(false);
  const [formFechaDesembolso, setFormFechaDesembolso] = useState(new Date().toISOString().split("T")[0]);
  const [formMontoDesembolsado, setFormMontoDesembolsado] = useState<string>("45000000");
  const [formNumeroComprobante, setFormNumeroComprobante] = useState("");
  const [formNotasCierre, setFormNotasCierre] = useState("");
  const [soportePagoTemp, setSoportePagoTemp] = useState<SoporteFase7 | null>(null);

  const [modalNota, setModalNota] = useState(false);
  const [formTextoNota, setFormTextoNota] = useState("");

  const [cargandoAccion, setCargandoAccion] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Verificaciones de estado del flujo
  const hitos = gestionFase7.hitosConstruccion || [];
  const hitosCompletadosCount = hitos.filter((h) => h.completado).length;
  const hito4 = hitos.find((h) => h.numero === 4);
  const obraTotalmenteFinalizada = !!(hito4 && hito4.completado);

  // Reconciliación de los 6 documentos oficiales (Formatos Compensar + Formatos de Cierre Técnico)
  const documentosCierre: DocumentoCierreCobro[] = DOCUMENTOS_DEFAULT_CONFIG.map((cfg) => {
    const docExistente = (gestionFase7.documentosCierre || []).find((d) => d.codigo === cfg.codigo);
    if (docExistente) {
      return {
        ...cfg,
        ...docExistente,
        id: docExistente.id || `f7-doc-${cfg.codigo.toLowerCase()}-${expediente.id}`,
        seccion: cfg.seccion,
        tiposPermitidos: cfg.tiposPermitidos
      };
    }
    return {
      id: `f7-doc-${cfg.codigo.toLowerCase()}-${expediente.id}`,
      codigo: cfg.codigo,
      nombre: cfg.nombre,
      descripcion: cfg.descripcion,
      seccion: cfg.seccion,
      tiposPermitidos: cfg.tiposPermitidos,
      estado: "pendiente"
    };
  });

  const docsCompensar = documentosCierre.filter((d) => d.seccion === "formatos_compensar");
  const docsCierreTecnico = documentosCierre.filter((d) => d.seccion === "formatos_cierre_existentes");

  const docsCompletadosCount = documentosCierre.filter(
    (d) => d.estado === "aceptado" || d.estado === "cargado"
  ).length;
  const todosDocumentosCompletos =
    documentosCierre.length >= 6 &&
    documentosCierre.every((d) => d.estado === "aceptado" || d.estado === "cargado");

  const desembolso: SeguimientoDesembolsoCompensar = gestionFase7.desembolso || {
    estadoActual: "pendiente_documentos",
    entidad: "Compensar (Caja de Compensación Familiar)",
    documentosIncluidos: [],
    rondasSubsanacion: []
  };

  const estaDesembolsadoYCerrado =
    expediente.estadoGeneral === "subsidio_desembolsado" ||
    desembolso.estadoActual === "desembolsado_confirmado";

  // Helpers de badges de estado
  const getBadgeEstadoGeneral = () => {
    if (estaDesembolsadoYCerrado) {
      return {
        texto: "Subsidio Desembolsado y Cerrado",
        color: "bg-emerald-100 text-emerald-800 border-emerald-300",
        icono: CheckCircle2
      };
    }
    if (desembolso.estadoActual === "con_observaciones") {
      return {
        texto: "Desembolso: Con Observaciones Compensar",
        color: "bg-rose-100 text-rose-800 border-rose-300",
        icono: AlertTriangle
      };
    }
    if (desembolso.estadoActual === "solicitado_pendiente_respuesta") {
      return {
        texto: "Desembolso Solicitado — Pendiente Respuesta",
        color: "bg-amber-100 text-amber-800 border-amber-300",
        icono: Clock
      };
    }
    if (todosDocumentosCompletos) {
      return {
        texto: "Documentos Listos para Cobro",
        color: "bg-blue-100 text-blue-800 border-blue-300",
        icono: FileCheck2
      };
    }
    if (obraTotalmenteFinalizada) {
      return {
        texto: "Obra 100% Terminada — En Cierre Documental",
        color: "bg-teal-100 text-teal-800 border-teal-300",
        icono: CheckCircle2
      };
    }
    return {
      texto: `En Construcción (Hito ${hitosCompletadosCount + 1} de 4)`,
      color: "bg-indigo-100 text-indigo-800 border-indigo-300",
      icono: HardHat
    };
  };

  const badgeEstado = getBadgeEstadoGeneral();
  const IconoBadgeEstado = badgeEstado.icono;

  // -------------------------------------------------------------
  // ACCIÓN 1: Registrar / Modificar Hito de Construcción (Supervisor)
  // -------------------------------------------------------------
  const abrirModalHito = (hito: HitoConstruccion) => {
    setModalHito(hito);
    setFormFechaHito(hito.fechaCumplimiento || new Date().toISOString().split("T")[0]);
    setFormObservacionesHito(hito.observaciones || "");
    setFormFotosHito(hito.fotos ? [...hito.fotos] : []);
    const descMap: { [id: string]: string } = {};
    (hito.fotos || []).forEach((f) => {
      descMap[f.id] = f.descripcion || "";
    });
    setDescripcionFotoActual(descMap);
    setErrorAccion(null);
  };

  const handleSubirFotosHito = (archivos: FileList | null) => {
    if (!archivos || archivos.length === 0) return;
    const nuevasFotos: FotoRegistro[] = [];
    const cupoDisponible = 20 - formFotosHito.length;

    if (cupoDisponible <= 0) {
      setErrorAccion("Se ha alcanzado el tope máximo de 20 fotografías por hito.");
      return;
    }

    const archivosAProcesar = Array.from(archivos).slice(0, cupoDisponible);

    archivosAProcesar.forEach((archivo, i) => {
      const reader = new FileReader();
      reader.onload = () => {
        const id = `foto-hito-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`;
        nuevasFotos.push({
          id,
          nombre: archivo.name,
          url: reader.result as string,
          tamanoBytes: archivo.size,
          subidoEn: new Date().toISOString(),
          categoria: modalHito?.nombre || "Evidencia Obra",
          descripcion: ""
        });
        if (nuevasFotos.length === archivosAProcesar.length) {
          setFormFotosHito((prev) => [...prev, ...nuevasFotos]);
        }
      };
      reader.readAsDataURL(archivo);
    });
  };

  // Generador de fotos periciales de prueba rápidas
  const handleGenerarFotosMuestraHito = () => {
    if (!modalHito) return;
    const cupo = 20 - formFotosHito.length;
    if (cupo <= 0) {
      setErrorAccion("Ya cuenta con 20 fotografías preparadas.");
      return;
    }
    const cantidad = Math.min(4, cupo);
    const titulosMuestra = [
      `Vista General ${modalHito.nombre}`,
      `Detalle de Armado y Materiales`,
      `Verificación de Linderos y Escuadra`,
      `Control de Calidad en Campo`
    ];

    const fotosGeneradas: FotoRegistro[] = Array.from({ length: cantidad }).map((_, idx) => {
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 600;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = idx % 2 === 0 ? "#1e293b" : "#0f766e";
        ctx.fillRect(0, 0, 800, 600);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 28px sans-serif";
        ctx.fillText(`FRANCO OSORIO - SUPERVISIÓN DE OBRA`, 40, 80);
        ctx.font = "20px sans-serif";
        ctx.fillText(`Hito ${modalHito.numero}: ${modalHito.nombre}`, 40, 130);
        ctx.fillText(`Expediente: ${expediente.codigoVisible || expediente.id}`, 40, 170);
        ctx.fillText(`Registro Fotográfico ${idx + 1} de ${cantidad}`, 40, 210);
        ctx.font = "italic 16px sans-serif";
        ctx.fillText(`Fecha: ${new Date().toLocaleDateString("es-CO")}`, 40, 260);
      }
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

      return {
        id: `foto-gen-${Date.now()}-${idx}`,
        nombre: `Evidencia_Hito_${modalHito.numero}_${idx + 1}.jpg`,
        url: dataUrl,
        tamanoBytes: 120000,
        subidoEn: new Date().toISOString(),
        categoria: titulosMuestra[idx] || "Evidencia Obra",
        descripcion: `Inspección técnica pericial registrada en campo para ${modalHito.nombre}.`
      };
    });

    setFormFotosHito((prev) => [...prev, ...fotosGeneradas]);
    const nuevosMap = { ...descripcionFotoActual };
    fotosGeneradas.forEach((f) => {
      nuevosMap[f.id] = f.descripcion || "";
    });
    setDescripcionFotoActual(nuevosMap);
  };

  const handleGuardarHito = async () => {
    if (!modalHito) return;
    if (!formFechaHito) {
      setErrorAccion("Debe indicar la fecha de cumplimiento del hito.");
      return;
    }
    if (formFotosHito.length === 0) {
      setErrorAccion("Debe adjuntar al menos una fotografía como evidencia pericial del hito.");
      return;
    }

    try {
      setCargandoAccion(true);
      setErrorAccion(null);

      // Combinar descripciones
      const fotosFinales: FotoRegistro[] = formFotosHito.map((f) => ({
        ...f,
        descripcion: descripcionFotoActual[f.id] || f.descripcion || ""
      }));

      const payload = {
        codigoHito: modalHito.codigo,
        numero: modalHito.numero,
        fechaCumplimiento: formFechaHito,
        observaciones: formObservacionesHito,
        fotos: fotosFinales
      };

      const res = await authFetch(`/api/expedientes/${expediente.id}/fase7/registrar-hito`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar hito de construcción.");

      setMensajeExito(`Hito ${modalHito.numero} (${modalHito.nombre}) guardado exitosamente.`);
      setModalHito(null);
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error de comunicación con el servidor.");
    } finally {
      setCargandoAccion(false);
    }
  };

  // -------------------------------------------------------------
  // ACCIÓN 2: Cargar Documento de Cierre (F7-01 a F7-04)
  // -------------------------------------------------------------
  const abrirModalDocumento = (doc: DocumentoCierreCobro) => {
    setModalDoc(doc);
    setDocArchivoTemp(null);
    setErrorAccion(null);
  };

  const handleSeleccionarArchivoDoc = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setDocArchivoTemp({
        nombreArchivo: file.name,
        archivoDataUrl: reader.result as string,
        mimeType: file.type || "application/pdf",
        tamanoBytes: file.size,
        sha256Hash: `sha256-doc7-${Date.now()}`
      });
    };
    reader.readAsDataURL(file);
  };

  const handleGuardarDocumentoCierre = async () => {
    if (!modalDoc || !docArchivoTemp) {
      setErrorAccion("Debe seleccionar un archivo para el documento de cierre.");
      return;
    }

    try {
      setCargandoAccion(true);
      setErrorAccion(null);

      const payload = {
        idDoc: modalDoc.id || `f7-doc-${modalDoc.codigo.toLowerCase()}-${expediente.id}`,
        codigoDoc: modalDoc.codigo,
        nombreArchivo: docArchivoTemp.nombreArchivo,
        archivoDataUrl: docArchivoTemp.archivoDataUrl,
        mimeType: docArchivoTemp.mimeType,
        tamanoBytes: docArchivoTemp.tamanoBytes,
        sha256Hash: docArchivoTemp.sha256Hash
      };

      const res = await authFetch(`/api/expedientes/${expediente.id}/fase7/cargar-documento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar documento de cierre.");

      setMensajeExito(`Documento ${modalDoc.codigo} (${modalDoc.nombre}) cargado y validado exitosamente.`);
      setModalDoc(null);
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al procesar documento.");
    } finally {
      setCargandoAccion(false);
    }
  };

  // -------------------------------------------------------------
  // ACCIÓN 2.1: Desvincular / Eliminar Documento de Cierre
  // -------------------------------------------------------------
  const handleEliminarDocCierre = async () => {
    if (!modalConfirmarEliminarDoc) return;
    try {
      setCargandoAccion(true);
      setErrorAccion(null);
      const res = await authFetch(
        `/api/expedientes/${expediente.id}/fase7/documento-cierre/${modalConfirmarEliminarDoc.codigo}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al desvincular el documento de cierre.");

      setMensajeExito(`Documento ${modalConfirmarEliminarDoc.codigo} desvinculado exitosamente.`);
      setModalConfirmarEliminarDoc(null);
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al desvincular el documento.");
    } finally {
      setCargandoAccion(false);
    }
  };

  // -------------------------------------------------------------
  // ACCIÓN 3: Radicar Solicitud de Desembolso ante Compensar
  // -------------------------------------------------------------
  const handleRadicarSolicitudDesembolso = async () => {
    if (!formRadicadoSolicitud.trim()) {
      setErrorAccion("Debe indicar el número de radicado oficial de la solicitud ante Compensar.");
      return;
    }

    try {
      setCargandoAccion(true);
      setErrorAccion(null);

      const payload = {
        fechaSolicitud: formFechaSolicitud,
        radicadoSolicitud: formRadicadoSolicitud.trim(),
        observacionesSolicitud: formNotasSolicitud.trim(),
        documentosIncluidos: ["F7-01", "F7-02", "F7-03", "F7-04", "F7-05", "F7-06"],
        soporte: soporteSolicitudTemp
      };

      const res = await authFetch(`/api/expedientes/${expediente.id}/fase7/solicitar-desembolso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al radicar solicitud de desembolso.");

      setMensajeExito("Solicitud de desembolso radicada ante Compensar. Estado: Pendiente Respuesta.");
      setModalSolicitarDesembolso(false);
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al conectar con el servidor.");
    } finally {
      setCargandoAccion(false);
    }
  };

  // -------------------------------------------------------------
  // ACCIÓN 4: Registrar Observaciones de Compensar sobre el Desembolso
  // -------------------------------------------------------------
  const handleRegistrarObservacionesDesembolso = async () => {
    if (!formDetalleObs.trim()) {
      setErrorAccion("Debe detallar las observaciones o requerimientos formulados por Compensar.");
      return;
    }

    try {
      setCargandoAccion(true);
      setErrorAccion(null);

      const payload = {
        radicadoRequerimiento: formRadicadoObs.trim(),
        detalleObservaciones: formDetalleObs.trim(),
        soporte: soporteObsTemp
      };

      const res = await authFetch(
        `/api/expedientes/${expediente.id}/fase7/registrar-observacion-desembolso`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar observaciones de Compensar.");

      setMensajeExito("Observaciones de Compensar registradas. Se activó ronda de subsanación.");
      setModalObservacionDesembolso(false);
      setFormRadicadoObs("");
      setFormDetalleObs("");
      setSoporteObsTemp(null);
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al registrar requerimientos.");
    } finally {
      setCargandoAccion(false);
    }
  };

  // -------------------------------------------------------------
  // ACCIÓN 5: Radicar Subsanación de Desembolso
  // -------------------------------------------------------------
  const handleRadicarSubsanacionDesembolso = async () => {
    if (!modalSubsanarDesembolso || !formDetalleSubsanacion.trim()) {
      setErrorAccion("Debe describir las aclaraciones o documentos de subsanación radicados.");
      return;
    }

    try {
      setCargandoAccion(true);
      setErrorAccion(null);

      const payload = {
        rondaId: modalSubsanarDesembolso.id,
        radicadoSubsanacion: formRadicadoSubsanacion.trim(),
        detalleSubsanacion: formDetalleSubsanacion.trim(),
        soporte: soporteSubsanacionTemp
      };

      const res = await authFetch(
        `/api/expedientes/${expediente.id}/fase7/subsanar-desembolso`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar subsanación.");

      setMensajeExito("Subsanación radicada ante Compensar. Esperando respuesta final.");
      setModalSubsanarDesembolso(null);
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al radicar subsanación.");
    } finally {
      setCargandoAccion(false);
    }
  };

  // -------------------------------------------------------------
  // ACCIÓN 6: Confirmar Desembolso y Cerrar Expediente (Éxito)
  // -------------------------------------------------------------
  const handleConfirmarDesembolsoYCierre = async () => {
    const valorNumerico = parseFloat(formMontoDesembolsado.replace(/[^0-9.]/g, ""));
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      setErrorAccion("Debe ingresar un monto numérico válido para el desembolso.");
      return;
    }
    if (!formNumeroComprobante.trim()) {
      setErrorAccion("Debe indicar el número de comprobante o referencia bancaria del pago.");
      return;
    }

    try {
      setCargandoAccion(true);
      setErrorAccion(null);

      const payload = {
        fechaDesembolso: formFechaDesembolso,
        montoDesembolsado: valorNumerico,
        numeroComprobante: formNumeroComprobante.trim(),
        notasCierre: formNotasCierre.trim(),
        soportePago: soportePagoTemp
      };

      const res = await authFetch(
        `/api/expedientes/${expediente.id}/fase7/confirmar-desembolso`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al confirmar desembolso.");

      setMensajeExito(
        "¡Expediente Cerrado con Éxito! El subsidio ha sido desembolsado y archivado formalmente."
      );
      setModalConfirmarDesembolso(false);
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al confirmar desembolso.");
    } finally {
      setCargandoAccion(false);
    }
  };

  // -------------------------------------------------------------
  // ACCIÓN 7: Agregar Nota en la Bitácora de Fase 7
  // -------------------------------------------------------------
  const handleGuardarNota = async () => {
    if (!formTextoNota.trim()) return;

    try {
      setCargandoAccion(true);
      setErrorAccion(null);

      const res = await authFetch(`/api/expedientes/${expediente.id}/fase7/agregar-nota`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenido: formTextoNota.trim() })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar nota.");

      setModalNota(false);
      setFormTextoNota("");
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al guardar nota.");
    } finally {
      setCargandoAccion(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* MENSAJES DE ALERTA Y CONFIRMACIÓN */}
      {errorAccion && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorAccion}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorAccion(null)}
            className="text-rose-500 hover:text-rose-700 font-bold ml-3 text-sm cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {mensajeExito && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{mensajeExito}</span>
          </div>
          <button
            type="button"
            onClick={() => setMensajeExito(null)}
            className="text-emerald-500 hover:text-emerald-700 font-bold ml-3 text-sm cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* BANNER CELEBRATORIO SI ESTÁ DESEMBOLSADO Y CERRADO */}
      {estaDesembolsadoYCerrado && (
        <div className="p-6 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white/20 backdrop-blur-xs rounded-full text-xs font-bold uppercase tracking-wider text-emerald-100">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Proceso Completado con Éxito</span>
            </div>
            <h3 className="text-xl font-extrabold tracking-tight">
              Subsidio Desembolsado y Expediente Cerrado
            </h3>
            <p className="text-xs text-emerald-100 max-w-2xl leading-relaxed">
              La vivienda rural ha sido construida al 100%, entregada a satisfacción a la familia beneficiaria, y Compensar ha generado el desembolso total del subsidio. Este expediente concluyó exitosamente su ciclo de gestión diaria y queda archivado para consulta histórica.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xs p-4 rounded-xl border border-white/20 text-right shrink-0">
            <div className="text-[11px] text-emerald-200 font-medium">Monto Desembolsado:</div>
            <div className="text-2xl font-black text-white">
              ${(desembolso.montoDesembolsado || 45000000).toLocaleString("es-CO")} COP
            </div>
            {desembolso.fechaDesembolso && (
              <div className="text-[10px] text-emerald-200 mt-0.5">
                Fecha de Giro: {new Date(desembolso.fechaDesembolso).toLocaleDateString("es-CO")}
              </div>
            )}
            {desembolso.numeroComprobante && (
              <div className="text-[10px] text-emerald-200">
                Comprobante: {desembolso.numeroComprobante}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ENCABEZADO PRINCIPAL DE LA FASE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
                Fase 7 (Final)
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Construcción en Campo y Cierre Financiero
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 flex items-center space-x-2.5">
              <HardHat className="w-6 h-6 text-indigo-600" />
              <span>En Construcción y Cobro Subsidio</span>
            </h3>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Supervisión certifica los 4 hitos secuenciales de avance de obra en campo con registro fotográfico. Una vez finalizada la vivienda, se completan los 4 documentos de recibo y habitabilidad para que Ingeniería gestione el cobro y desembolso del subsidio ante Compensar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* BADGE DE ESTADO ACTUAL */}
            <div
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border flex items-center space-x-1.5 ${badgeEstado.color}`}
            >
              <IconoBadgeEstado className="w-4 h-4 shrink-0" />
              <span>{badgeEstado.texto}</span>
            </div>

            {/* BOTÓN BITÁCORA NOTAS */}
            <button
              type="button"
              onClick={() => setModalNota(true)}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <MessageSquareText className="w-3.5 h-3.5 text-slate-600" />
              <span>Añadir Nota</span>
            </button>
          </div>
        </div>

        {/* INDICADOR SECUENCIAL DE LOS 3 BLOQUES */}
        <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* PASO 1 */}
          <div
            className={`p-3 rounded-xl border flex items-center space-x-3 ${
              obraTotalmenteFinalizada
                ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                : "bg-indigo-50/70 border-indigo-200 text-indigo-900"
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                obraTotalmenteFinalizada
                  ? "bg-emerald-600 text-white"
                  : "bg-indigo-600 text-white"
              }`}
            >
              {obraTotalmenteFinalizada ? <CheckCircle2 className="w-4 h-4" /> : "1"}
            </div>
            <div>
              <div className="text-xs font-bold">Bloque 1: Hitos de Obra</div>
              <div className="text-[11px] text-slate-500">
                {obraTotalmenteFinalizada
                  ? "4 de 4 Hitos Completados (100%)"
                  : `${hitosCompletadosCount} de 4 Hitos Certificados`}
              </div>
            </div>
          </div>

          {/* PASO 2 */}
          <div
            className={`p-3 rounded-xl border flex items-center space-x-3 ${
              todosDocumentosCompletos
                ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                : obraTotalmenteFinalizada
                ? "bg-blue-50/70 border-blue-200 text-blue-900"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                todosDocumentosCompletos
                  ? "bg-emerald-600 text-white"
                  : obraTotalmenteFinalizada
                  ? "bg-blue-600 text-white"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              {todosDocumentosCompletos ? <CheckCircle2 className="w-4 h-4" /> : "2"}
            </div>
            <div>
              <div className="text-xs font-bold">Bloque 2: Formatos de Cobro</div>
              <div className="text-[11px] text-slate-500">
                {todosDocumentosCompletos
                  ? `${documentosCierre.length} de ${documentosCierre.length} Documentos Consolidados`
                  : obraTotalmenteFinalizada
                  ? `${docsCompletadosCount} de ${documentosCierre.length} Documentos Cargados`
                  : "Bloqueado (Requiere Hito 4)"}
              </div>
            </div>
          </div>

          {/* PASO 3 */}
          <div
            className={`p-3 rounded-xl border flex items-center space-x-3 ${
              estaDesembolsadoYCerrado
                ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                : todosDocumentosCompletos
                ? "bg-amber-50/70 border-amber-200 text-amber-900"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                estaDesembolsadoYCerrado
                  ? "bg-emerald-600 text-white"
                  : todosDocumentosCompletos
                  ? "bg-amber-600 text-white"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              {estaDesembolsadoYCerrado ? <CheckCircle2 className="w-4 h-4" /> : "3"}
            </div>
            <div>
              <div className="text-xs font-bold">Bloque 3: Desembolso Compensar</div>
              <div className="text-[11px] text-slate-500">
                {estaDesembolsadoYCerrado
                  ? "Desembolso Exitoso y Expediente Cerrado"
                  : todosDocumentosCompletos
                  ? "En Trámite de Giro ante Compensar"
                  : "Bloqueado (Requiere Documentos F7)"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* BLOQUE 1: SEGUIMIENTO DE HITOS DE CONSTRUCCIÓN (SUPERVISOR) */}
      {/* ========================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 mb-5 gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                1
              </span>
              <h4 className="font-bold text-base text-slate-900">
                Seguimiento de Hitos de Construcción en Campo
              </h4>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Certificación progresiva de obra por parte de Supervisión con evidencia fotográfica (máximo 20 fotos JPG por hito).
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs font-bold">
            <span className="text-slate-500">Avance de Obra:</span>
            <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg">
              {hitosCompletadosCount * 25}% (Hito {hitosCompletadosCount} de 4)
            </span>
          </div>
        </div>

        {/* LISTA SECUENCIAL DE LOS 4 HITOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {hitos.map((hito, idx) => {
            const hitoAnterior = idx > 0 ? hitos[idx - 1] : null;
            const habilitadoParaRegistro = idx === 0 || !!hitoAnterior?.completado;
            const esUltimoHito = hito.numero === 4;

            return (
              <div
                key={hito.codigo}
                className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                  hito.completado
                    ? "bg-emerald-50/50 border-emerald-200 shadow-2xs"
                    : habilitadoParaRegistro
                    ? "bg-white border-indigo-200 shadow-xs ring-1 ring-indigo-50"
                    : "bg-slate-50 border-slate-200 opacity-70"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                          hito.completado
                            ? "bg-emerald-600 text-white"
                            : habilitadoParaRegistro
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-300 text-slate-600"
                        }`}
                      >
                        {hito.numero}
                      </span>
                      <h5 className="font-bold text-xs text-slate-900 leading-snug">
                        {hito.nombre}
                      </h5>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        hito.completado
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : habilitadoParaRegistro
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                          : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}
                    >
                      {hito.completado
                        ? "Completado"
                        : habilitadoParaRegistro
                        ? "Habilitado"
                        : "Bloqueado"}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
                    {hito.descripcion}
                  </p>

                  {/* DETALLE SI ESTÁ COMPLETADO */}
                  {hito.completado ? (
                    <div className="space-y-2 mb-3 bg-white/80 p-2.5 rounded-lg border border-emerald-100 text-[11px]">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>
                          <strong>Fecha:</strong>{" "}
                          {hito.fechaCumplimiento
                            ? new Date(hito.fechaCumplimiento).toLocaleDateString("es-CO")
                            : "Certificada"}
                        </span>
                        <span>
                          <strong>Por:</strong> {formatearNombreUsuario(hito.registradoPorNombre) || "Analista Documental"}
                        </span>
                      </div>

                      {hito.observaciones && (
                        <div className="text-slate-700 italic text-[11px] bg-emerald-50/50 p-2 rounded border border-emerald-100">
                          "{hito.observaciones}"
                        </div>
                      )}

                      {/* GALERÍA DE FOTOS EN MINIATURA (PATRÓN CAMBIO 7) */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-slate-700 font-bold mb-1.5">
                          <span className="flex items-center space-x-1">
                            <Camera className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Evidencia Fotográfica ({hito.fotos?.length || 0} fotos):</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            Clic para ampliar en visor
                          </span>
                        </div>

                        {hito.fotos && hito.fotos.length > 0 ? (
                          <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
                            {hito.fotos.slice(0, 10).map((foto, fIdx) => (
                              <button
                                key={foto.id}
                                type="button"
                                onClick={() =>
                                  onAbrirVisor({
                                    titulo: `Evidencia Fotográfica: ${hito.nombre}`,
                                    nombreArchivo: foto.nombre,
                                    mimeType: "image/jpeg",
                                    archivoDataUrl: foto.url,
                                    fotos: hito.fotos
                                  })
                                }
                                className="group relative aspect-square rounded-md overflow-hidden border border-slate-200 bg-slate-100 hover:ring-2 hover:ring-emerald-500 cursor-pointer transition-all"
                                title={foto.descripcion || foto.nombre}
                              >
                                <img
                                  src={foto.url}
                                  alt={foto.nombre}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                  referrerPolicy="no-referrer"
                                />
                                <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] px-1 py-0.5 truncate text-center">
                                  {fIdx + 1}/{hito.fotos.length}
                                </span>
                              </button>
                            ))}
                            {hito.fotos.length > 10 && (
                              <button
                                type="button"
                                onClick={() =>
                                  onAbrirVisor({
                                    titulo: `Evidencia Fotográfica: ${hito.nombre}`,
                                    nombreArchivo: hito.fotos[0].nombre,
                                    mimeType: "image/jpeg",
                                    archivoDataUrl: hito.fotos[0].url,
                                    fotos: hito.fotos
                                  })
                                }
                                className="aspect-square rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-xs flex items-center justify-center cursor-pointer border border-emerald-300"
                              >
                                +{hito.fotos.length - 10}
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 italic">
                            Sin fotos registradas.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* BOTÓN DE ACCIÓN */}
                <div className="pt-2 border-t border-slate-100">
                  {hito.completado ? (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-emerald-700 font-semibold flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Hito verificado en campo</span>
                      </span>
                      {puedeOperarHitos && (
                        <button
                          type="button"
                          onClick={() => abrirModalHito(hito)}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                        >
                          Modificar / Agregar Fotos
                        </button>
                      )}
                    </div>
                  ) : habilitadoParaRegistro ? (
                    puedeOperarHitos ? (
                      <button
                        type="button"
                        onClick={() => abrirModalHito(hito)}
                        className={`w-full py-2 px-3 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer active:scale-98 ${
                          esUltimoHito
                            ? "bg-emerald-600 hover:bg-emerald-700 ring-1 ring-emerald-300"
                            : "bg-indigo-600 hover:bg-indigo-700"
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>
                          {esUltimoHito
                            ? "Certificar Finalización Total de Vivienda"
                            : `Certificar Cumplimiento Hito ${hito.numero}`}
                        </span>
                      </button>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic text-center py-1">
                        Pendiente de certificación por Analista Documental
                      </div>
                    )
                  ) : (
                    <div className="text-[10px] text-slate-400 flex items-center justify-center space-x-1 py-1">
                      <Lock className="w-3 h-3 text-slate-300" />
                      <span>Requiere cumplimiento de Hito {hito.numero - 1}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* BLOQUE 2: DOCUMENTOS PARA EL COBRO DEL SUBSIDIO (6 DOCS) */}
      {/* ========================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 mb-5 gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                2
              </span>
              <h4 className="font-bold text-base text-slate-900">
                Formatos Oficiales de Compensar y Cierre Técnico para Cobro del Subsidio
              </h4>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Se habilitan formalmente una vez la vivienda está 100% terminada (Hito 4 completado). Requisitos indispensables para radicación y desembolso ante Compensar.
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs font-bold">
            <span className="text-slate-500">Consolidación General:</span>
            <span className={`px-2.5 py-1 border rounded-lg font-bold ${
              todosDocumentosCompletos
                ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}>
              {docsCompletadosCount} de {documentosCierre.length} Documentos
            </span>
          </div>
        </div>

        {/* ALERTA SI EL BLOQUE 2 ESTÁ BLOQUEADO */}
        {!obraTotalmenteFinalizada ? (
          <div className="p-8 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
              <Lock className="w-6 h-6" />
            </div>
            <h5 className="font-bold text-sm text-slate-800">
              Documentos de Cierre Aún Bloqueados
            </h5>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Para habilitar la gestión documental de cobro del subsidio (Formatos Compensar F7-01 a F7-03 y Formatos de Cierre Técnico F7-04 a F7-06), el Analista Documental debe certificar previamente la finalización total de la vivienda en el Hito 4 de construcción.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* ---------------------------------------------------------------- */}
            {/* SECCIÓN 1: FORMATOS OFICIALES DE COMPENSAR                       */}
            {/* ---------------------------------------------------------------- */}
            <div className="border border-blue-100 bg-blue-50/20 rounded-2xl p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3.5 border-b border-blue-100 mb-4 gap-2">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <span>1. Formatos Oficiales de Compensar</span>
                      <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-300">
                        Compensar Oficial
                      </span>
                    </h5>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Formatos institucionales requeridos para perfeccionamiento del contrato, inicio y cierre de entrega.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-500 font-medium">Avance:</span>
                  <span className="px-2 py-0.5 text-xs font-bold rounded-lg bg-white border border-blue-200 text-blue-900 shadow-2xs">
                    {docsCompensar.filter((d) => d.estado === "aceptado" || d.estado === "cargado").length} de {docsCompensar.length}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {docsCompensar.map((doc) => {
                  const estaCargado = doc.estado === "aceptado" || doc.estado === "cargado";

                  return (
                    <div
                      key={doc.codigo}
                      className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                        estaCargado
                          ? "bg-emerald-50/50 border-emerald-300 shadow-2xs"
                          : "bg-white border-blue-200 hover:border-blue-400 shadow-2xs"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-blue-700 text-white rounded-md shadow-2xs">
                              {doc.codigo}
                            </span>
                            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              PDF Oficial
                            </span>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                              doc.estado === "aceptado"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : doc.estado === "cargado"
                                ? "bg-blue-100 text-blue-800 border border-blue-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {doc.estado === "aceptado"
                              ? "Aceptado"
                              : doc.estado === "cargado"
                              ? "Cargado"
                              : "Pendiente"}
                          </span>
                        </div>

                        <h6 className="font-bold text-xs text-slate-900 leading-snug mb-1">
                          {doc.nombre}
                        </h6>

                        <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                          {doc.descripcion}
                        </p>

                        {estaCargado && doc.nombreArchivo && (
                          <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1 mb-3 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[11px] font-medium text-slate-800 truncate max-w-[150px]" title={doc.nombreArchivo}>
                                {doc.nombreArchivo}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {doc.tamanoBytes ? `${Math.round(doc.tamanoBytes / 1024)} KB` : "PDF"}
                              </span>
                            </div>
                            {doc.id && (
                              <div className="text-[10px] font-mono text-slate-400 truncate" title={`ID: ${doc.id}`}>
                                ID: {doc.id}
                              </div>
                            )}
                            {doc.subidoPorNombre && (
                              <div className="text-[10px] text-slate-400">
                                Por: {doc.subidoPorNombre}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ACCIONES DEL DOCUMENTO COMPENSAR */}
                      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
                        {estaCargado ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                onAbrirVisor({
                                  titulo: `${doc.codigo}: ${doc.nombre}`,
                                  nombreArchivo: doc.nombreArchivo || `${doc.codigo}.pdf`,
                                  mimeType: doc.mimeType || "application/pdf",
                                  archivoDataUrl: doc.archivoDataUrl,
                                  tamanoBytes: doc.tamanoBytes,
                                  sha256Hash: doc.sha256Hash,
                                  subidoPor: doc.subidoPorNombre,
                                  subidoEn: doc.subidoEn,
                                  fotos: doc.fotos
                                })
                              }
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Previsualizar</span>
                            </button>

                            {puedeGestionarDocumentos && (
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() => abrirModalDocumento(doc)}
                                  className="text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
                                >
                                  Reemplazar
                                </button>
                                {(desembolso.estadoActual === "pendiente_documentos" || desembolso.estadoActual === "listo_para_solicitar") && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setErrorAccion(null);
                                      setModalConfirmarEliminarDoc(doc);
                                    }}
                                    className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer flex items-center space-x-0.5"
                                    title="Desvincular formato"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        ) : (
                          puedeGestionarDocumentos && (
                            <button
                              type="button"
                              onClick={() => abrirModalDocumento(doc)}
                              className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer active:scale-98"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Cargar {doc.codigo} (PDF)</span>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ---------------------------------------------------------------- */}
            {/* SECCIÓN 2: CONSERVACIÓN DE FORMATOS EXISTENTES                   */}
            {/* ---------------------------------------------------------------- */}
            <div className="border border-slate-200 bg-slate-50/40 rounded-2xl p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3.5 border-b border-slate-200 mb-4 gap-2">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <span>2. Conservación de Formatos Existentes (Cierre Técnico y Habitabilidad)</span>
                      <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Cierre Técnico
                      </span>
                    </h5>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Certificación de servicios públicos, registro fotográfico en alta resolución y recibo a satisfacción del beneficiario.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-500 font-medium">Avance:</span>
                  <span className="px-2 py-0.5 text-xs font-bold rounded-lg bg-white border border-slate-200 text-slate-800 shadow-2xs">
                    {docsCierreTecnico.filter((d) => d.estado === "aceptado" || d.estado === "cargado").length} de {docsCierreTecnico.length}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {docsCierreTecnico.map((doc) => {
                  const estaCargado = doc.estado === "aceptado" || doc.estado === "cargado";

                  return (
                    <div
                      key={doc.codigo}
                      className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                        estaCargado
                          ? "bg-emerald-50/50 border-emerald-300 shadow-2xs"
                          : "bg-white border-slate-200 hover:border-emerald-300 shadow-2xs"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-emerald-700 text-white rounded-md shadow-2xs">
                              {doc.codigo}
                            </span>
                            <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              PDF / Imagen
                            </span>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                              doc.estado === "aceptado"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : doc.estado === "cargado"
                                ? "bg-blue-100 text-blue-800 border border-blue-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {doc.estado === "aceptado"
                              ? "Aceptado"
                              : doc.estado === "cargado"
                              ? "Cargado"
                              : "Pendiente"}
                          </span>
                        </div>

                        <h6 className="font-bold text-xs text-slate-900 leading-snug mb-1">
                          {doc.nombre}
                        </h6>

                        <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                          {doc.descripcion}
                        </p>

                        {estaCargado && doc.nombreArchivo && (
                          <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1 mb-3 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[11px] font-medium text-slate-800 truncate max-w-[150px]" title={doc.nombreArchivo}>
                                {doc.nombreArchivo}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {doc.tamanoBytes ? `${Math.round(doc.tamanoBytes / 1024)} KB` : "PDF/IMG"}
                              </span>
                            </div>
                            {doc.id && (
                              <div className="text-[10px] font-mono text-slate-400 truncate" title={`ID: ${doc.id}`}>
                                ID: {doc.id}
                              </div>
                            )}
                            {doc.subidoPorNombre && (
                              <div className="text-[10px] text-slate-400">
                                Por: {doc.subidoPorNombre}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ACCIONES DEL DOCUMENTO DE CIERRE */}
                      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
                        {estaCargado ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                onAbrirVisor({
                                  titulo: `${doc.codigo}: ${doc.nombre}`,
                                  nombreArchivo: doc.nombreArchivo || `${doc.codigo}.pdf`,
                                  mimeType: doc.mimeType || "application/pdf",
                                  archivoDataUrl: doc.archivoDataUrl,
                                  tamanoBytes: doc.tamanoBytes,
                                  sha256Hash: doc.sha256Hash,
                                  subidoPor: doc.subidoPorNombre,
                                  subidoEn: doc.subidoEn,
                                  fotos: doc.fotos
                                })
                              }
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Previsualizar</span>
                            </button>

                            {puedeGestionarDocumentos && (
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() => abrirModalDocumento(doc)}
                                  className="text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
                                >
                                  Reemplazar
                                </button>
                                {(desembolso.estadoActual === "pendiente_documentos" || desembolso.estadoActual === "listo_para_solicitar") && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setErrorAccion(null);
                                      setModalConfirmarEliminarDoc(doc);
                                    }}
                                    className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer flex items-center space-x-0.5"
                                    title="Desvincular formato"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        ) : (
                          puedeGestionarDocumentos && (
                            <button
                              type="button"
                              onClick={() => abrirModalDocumento(doc)}
                              className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer active:scale-98"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Cargar {doc.codigo} (PDF/IMG)</span>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* BLOQUE 3: SEGUIMIENTO DEL DESEMBOLSO ANTE COMPENSAR */}
      {/* ========================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 mb-5 gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                3
              </span>
              <h4 className="font-bold text-base text-slate-900">
                Seguimiento del Desembolso ante Compensar
              </h4>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Gestión de radicación de cobro, atención a requerimientos/subsanaciones y confirmación financiera del desembolso del subsidio.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className={`px-3 py-1 rounded-xl text-xs font-bold border flex items-center space-x-1.5 ${
                estaDesembolsadoYCerrado
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : desembolso.estadoActual === "solicitado_pendiente_respuesta"
                  ? "bg-amber-100 text-amber-800 border-amber-300"
                  : desembolso.estadoActual === "con_observaciones"
                  ? "bg-rose-100 text-rose-800 border-rose-300"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              <Landmark className="w-3.5 h-3.5" />
              <span>
                {estaDesembolsadoYCerrado
                  ? "Subsidio Desembolsado"
                  : desembolso.estadoActual === "solicitado_pendiente_respuesta"
                  ? "Desembolso Solicitado"
                  : desembolso.estadoActual === "con_observaciones"
                  ? "Con Requerimientos"
                  : "Pendiente Radicación"}
              </span>
            </span>
          </div>
        </div>

        {/* CONTENIDO SEGÚN ESTADO DE COBRO */}
        {!todosDocumentosCompletos ? (
          <div className="p-8 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
              <Lock className="w-6 h-6" />
            </div>
            <h5 className="font-bold text-sm text-slate-800">
              Trámite de Desembolso Bloqueado
            </h5>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Para habilitar la solicitud y cobro del subsidio ante Compensar, se deben completar y cargar la totalidad de los 4 documentos de recibo, habitabilidad y liquidación (Bloque 2).
            </p>
          </div>
        ) : estaDesembolsadoYCerrado ? (
          /* ESTADO 1: DESEMBOLSADO Y CERRADO CON ÉXITO */
          <div className="space-y-4">
            <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
              <div className="flex items-center space-x-2 font-bold text-emerald-900 text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Desembolso Confirmado y Liquidación Concluida</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white p-3.5 rounded-xl border border-emerald-100">
                <div>
                  <div className="text-[11px] text-slate-400">Monto Girado:</div>
                  <div className="text-base font-extrabold text-emerald-800">
                    ${(desembolso.montoDesembolsado || 45000000).toLocaleString("es-CO")} COP
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Fecha de Consignación:</div>
                  <div className="text-sm font-bold text-slate-800">
                    {desembolso.fechaDesembolso
                      ? new Date(desembolso.fechaDesembolso).toLocaleDateString("es-CO")
                      : "Registrada"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Comprobante Bancario:</div>
                  <div className="text-sm font-bold text-slate-800">
                    {desembolso.numeroComprobante || "CMP-GIRO-2026"}
                  </div>
                </div>
              </div>

              {desembolso.soportePago && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      onAbrirVisor({
                        titulo: "Comprobante de Desembolso y Liquidación Final Compensar",
                        nombreArchivo: desembolso.soportePago!.nombreArchivo,
                        mimeType: desembolso.soportePago!.mimeType || "application/pdf",
                        archivoDataUrl: desembolso.soportePago!.archivoDataUrl
                      })
                    }
                    className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-2 transition-colors cursor-pointer shadow-xs"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Ver Soporte Oficial del Pago ({desembolso.soportePago.nombreArchivo})</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : desembolso.estadoActual === "con_observaciones" ? (
          /* ESTADO 2: CON OBSERVACIONES DE COMPENSAR */
          <div className="space-y-4">
            <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl space-y-3 text-rose-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 font-bold text-sm text-rose-800">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <span>Requerimientos / Objeciones de Compensar para el Desembolso</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                  Ronda #{desembolso.rondasSubsanacion?.length || 1}
                </span>
              </div>

              {desembolso.rondasSubsanacion && desembolso.rondasSubsanacion.length > 0 && (
                <p className="text-xs text-rose-800 leading-relaxed bg-white/60 p-3 rounded-xl border border-rose-200">
                  {desembolso.rondasSubsanacion[0].detalleObservaciones}
                </p>
              )}

              {puedeOperarDesembolso && (
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const rondaActiva = desembolso.rondasSubsanacion?.[0];
                      if (rondaActiva) {
                        setModalSubsanarDesembolso(rondaActiva);
                        setFormRadicadoSubsanacion("");
                        setFormDetalleSubsanacion("");
                        setSoporteSubsanacionTemp(null);
                      }
                    }}
                    className="py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer active:scale-98"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Radicar Subsanación a Compensar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalConfirmarDesembolso(true)}
                    className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer active:scale-98"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar Desembolso Generado</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : desembolso.estadoActual === "solicitado_pendiente_respuesta" ? (
          /* ESTADO 3: EN ESPERA DE RESPUESTA DE COMPENSAR */
          <div className="space-y-4">
            <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 font-bold text-amber-900 text-sm">
                  <Clock className="w-5 h-5 text-amber-600 animate-pulse" />
                  <span>Desembolso Solicitado — Pendiente Respuesta de Compensar</span>
                </div>
                <span className="text-xs text-amber-700 font-medium">
                  Radicado: <strong>{desembolso.radicadoSolicitud || "s/r"}</strong>
                </span>
              </div>

              <div className="text-xs text-amber-800 bg-white/80 p-3 rounded-xl border border-amber-200 leading-relaxed">
                La solicitud de cobro con los 4 documentos de recibo a satisfacción, habitabilidad, fotos de llaves y liquidación ha sido radicada formalmente ante Compensar. En espera de aprobación y confirmación del giro.
              </div>

              {puedeOperarDesembolso && (
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setModalConfirmarDesembolso(true)}
                    className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer active:scale-98"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>Confirmar Desembolso Generado (Cierre Exitoso)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalObservacionDesembolso(true)}
                    className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer active:scale-98"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Registrar Objeciones / Requerimientos</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ESTADO 4: PENDIENTE DE RADICAR SOLICITUD */
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <h5 className="font-bold text-sm text-slate-800">
                Documentación Completa — Listo para Radicar Cobro
              </h5>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                Los 4 requisitos de recibo, habitabilidad y liquidación están consolidados. Ingeniería puede radicar la solicitud formal de desembolso del subsidio ante Compensar.
              </p>
            </div>

            {puedeOperarDesembolso && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setModalSolicitarDesembolso(true)}
                  className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-2 mx-auto cursor-pointer active:scale-98"
                >
                  <Send className="w-4 h-4" />
                  <span>Radicar Solicitud de Desembolso ante Compensar</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* HISTORIAL Y BITÁCORA DE FASE 7 */}
      {/* ========================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center space-x-2">
            <MessageSquareText className="w-5 h-5 text-indigo-600" />
            <h4 className="font-bold text-base text-slate-900">
              Bitácora e Historial de Construcción y Cobro
            </h4>
          </div>
          <button
            type="button"
            onClick={() => setModalNota(true)}
            className="px-3 py-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
          >
            + Agregar Nota Técnica
          </button>
        </div>

        {gestionFase7.historial && gestionFase7.historial.length > 0 ? (
          <div className="space-y-3">
            {gestionFase7.historial.map((ev) => (
              <div
                key={ev.id}
                className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{ev.titulo}</span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(ev.fecha).toLocaleString("es-CO")}
                  </span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">{ev.descripcion}</p>
                <div className="text-[10px] text-slate-400 pt-1 flex items-center justify-between">
                  <span>
                    Por: {ev.autorNombre} ({ev.autorRol})
                  </span>
                  {ev.soporte && (
                    <button
                      type="button"
                      onClick={() =>
                        onAbrirVisor({
                          titulo: ev.titulo,
                          nombreArchivo: ev.soporte!.nombreArchivo,
                          mimeType: ev.soporte!.mimeType || "application/pdf",
                          archivoDataUrl: ev.soporte!.archivoDataUrl
                        })
                      }
                      className="text-indigo-600 hover:underline font-semibold flex items-center space-x-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Ver {ev.soporte.nombreArchivo}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-400 italic text-center py-6">
            Aún no se han registrado eventos en la bitácora de Fase 7.
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: REGISTRAR / MODIFICAR HITO DE CONSTRUCCIÓN */}
      {/* ========================================================= */}
      {modalHito && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                  {modalHito.numero}
                </span>
                <h4 className="font-bold text-base text-slate-900">
                  Certificar Hito {modalHito.numero}: {modalHito.nombre}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setModalHito(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 py-4 flex-1 pr-1">
              <p className="text-xs text-slate-600 leading-relaxed bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
                {modalHito.descripcion}
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fecha de Verificación / Cumplimiento en Campo *
                </label>
                <input
                  type="date"
                  value={formFechaHito}
                  onChange={(e) => setFormFechaHito(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observaciones Técnicas y Condiciones de Obra
                </label>
                <textarea
                  rows={3}
                  value={formObservacionesHito}
                  onChange={(e) => setFormObservacionesHito(e.target.value)}
                  placeholder="Detallar avances observados, dosificación de mezclas, plomos, estado de materiales o comentarios para el acta..."
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* SECCIÓN DE FOTOS (TOPE 20, FORMATO JPG, VISTA PREVIA MINIATURA) */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-800">
                      Evidencia Fotográfica de Obra ({formFotosHito.length} de 20 fotos) *
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Fotografías periciales de campo (JPG, PNG, máx 20 fotos).
                    </span>
                  </div>

                  {currentUser.rol === "administrador" && formFotosHito.length < 20 && (
                    <button
                      type="button"
                      onClick={handleGenerarFotosMuestraHito}
                      className="px-2.5 py-1 text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg cursor-pointer transition-colors"
                      title="Herramienta de prueba exclusiva para el Administrador del Sistema"
                    >
                      + Generar Fotos Muestra (Solo Admin)
                    </button>
                  )}
                </div>

                {/* DROPZONE DE FOTOS */}
                {formFotosHito.length < 20 && (
                  <label className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors text-center">
                    <Camera className="w-6 h-6 text-indigo-500 mb-1" />
                    <span className="text-xs font-bold text-indigo-900">
                      Haga clic para seleccionar fotos o arrástrelas aquí
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      Tope de hasta 20 fotos en alta resolución
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onClick={(e) => {
                        (e.target as HTMLInputElement).value = "";
                      }}
                      onChange={(e) => handleSubirFotosHito(e.target.files)}
                      className="hidden"
                    />
                  </label>
                )}

                {/* CUADRÍCULA DE MINIATURAS DE FOTOS PREPARADAS */}
                {formFotosHito.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                    {formFotosHito.map((foto, idx) => (
                      <div
                        key={foto.id}
                        className="flex items-center space-x-3 p-2 bg-white rounded-lg border border-slate-200"
                      >
                        <div className="w-12 h-12 rounded overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                          <img
                            src={foto.url}
                            alt={foto.nombre}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 truncate">
                              Foto #{idx + 1}: {foto.nombre}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {Math.round(foto.tamanoBytes / 1024)} KB
                            </span>
                          </div>
                          <input
                            type="text"
                            value={descripcionFotoActual[foto.id] || ""}
                            onChange={(e) =>
                              setDescripcionFotoActual({
                                ...descripcionFotoActual,
                                [foto.id]: e.target.value
                              })
                            }
                            placeholder="Descripción opcional (ej. vista fachada norte, amarre de vigas...)"
                            className="w-full mt-1 px-2 py-0.5 text-[11px] border border-slate-200 rounded outline-none focus:border-indigo-500"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setFormFotosHito(formFotosHito.filter((f) => f.id !== foto.id));
                            const updatedMap = { ...descripcionFotoActual };
                            delete updatedMap[foto.id];
                            setDescripcionFotoActual(updatedMap);
                          }}
                          className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer shrink-0"
                          title="Eliminar foto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setModalHito(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={cargandoAccion || formFotosHito.length === 0}
                onClick={handleGuardarHito}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs"
              >
                {cargandoAccion ? "Guardando..." : "Guardar Certificación del Hito"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: CARGAR / REEMPLAZAR DOCUMENTO DE CIERRE (6 DOCS) */}
      {/* ========================================================= */}
      {modalDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className={`p-2 rounded-xl text-white ${
                  modalDoc.seccion === "formatos_compensar" ? "bg-blue-600" : "bg-emerald-600"
                }`}>
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">
                    {modalDoc.nombreArchivo ? "Reemplazar Documento" : "Cargar Documento"}: {modalDoc.codigo}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">
                    {modalDoc.nombre}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalDoc(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3.5">
              <div className="flex items-center space-x-2">
                <span className={`text-2xs font-bold px-2 py-0.5 rounded-md ${
                  modalDoc.seccion === "formatos_compensar"
                    ? "bg-blue-50 text-blue-800 border border-blue-200"
                    : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                }`}>
                  {modalDoc.seccion === "formatos_compensar" ? "Formato Oficial Compensar" : "Cierre Técnico y Habitabilidad"}
                </span>
                <span className="text-[11px] text-slate-400">
                  {modalDoc.seccion === "formatos_compensar" ? "Formato oficial en PDF" : "Admite PDF e imágenes (JPG, PNG)"}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                {modalDoc.descripcion}
              </p>

              {!docArchivoTemp ? (
                <label className="border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/40 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-colors text-center">
                  <Upload className="w-7 h-7 text-blue-500 mb-1.5" />
                  <span className="text-xs font-bold text-blue-950">
                    Haga clic aquí para seleccionar el archivo oficial
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">
                    {modalDoc.seccion === "formatos_compensar"
                      ? "Formatos válidos: PDF oficial firmado (.pdf) hasta 20 MB"
                      : "Formatos admitidos: Documentos PDF (.pdf) o Imágenes (.jpg, .png) hasta 20 MB"}
                  </span>
                  <input
                    type="file"
                    accept={
                      modalDoc.seccion === "formatos_compensar"
                        ? "application/pdf,.pdf"
                        : "application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                    }
                    onClick={(e) => {
                      (e.target as HTMLInputElement).value = "";
                    }}
                    onChange={handleSeleccionarArchivoDoc}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2 text-xs text-emerald-950">
                    <div className="flex items-center justify-between">
                      <div className="truncate font-bold text-emerald-900 max-w-[280px]">
                        {docArchivoTemp.nombreArchivo}
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-700 shrink-0">
                        {(docArchivoTemp.tamanoBytes / 1024).toFixed(1)} KB
                      </span>
                    </div>

                    <div className="text-[10px] text-emerald-700 font-mono">
                      Tipo: {docArchivoTemp.mimeType}
                    </div>

                    {/* Previsualización directa en el modal si es imagen */}
                    {docArchivoTemp.mimeType?.startsWith("image/") && (
                      <div className="mt-2 pt-2 border-t border-emerald-200 text-center">
                        <span className="text-[10px] font-bold text-emerald-800 block mb-1">
                          Vista previa de la imagen cargada:
                        </span>
                        <img
                          src={docArchivoTemp.archivoDataUrl}
                          alt="Vista previa"
                          className="max-h-44 mx-auto rounded-lg border border-emerald-300 shadow-2xs object-contain"
                        />
                      </div>
                    )}

                    {/* Previsualización en visor si es PDF */}
                    {docArchivoTemp.mimeType === "application/pdf" && (
                      <div className="mt-2 pt-2 border-t border-emerald-200 flex items-center justify-between">
                        <span className="text-[11px] text-emerald-800 font-medium">
                          Documento PDF listo para vinculación
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onAbrirVisor({
                              titulo: `Previsualización: ${docArchivoTemp.nombreArchivo}`,
                              nombreArchivo: docArchivoTemp.nombreArchivo,
                              mimeType: docArchivoTemp.mimeType,
                              tamanoBytes: docArchivoTemp.tamanoBytes,
                              archivoDataUrl: docArchivoTemp.archivoDataUrl
                            })
                          }
                          className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Previsualizar PDF</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end space-x-2">
                    <label className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs">
                      Cambiar archivo
                      <input
                        type="file"
                        accept={
                          modalDoc.seccion === "formatos_compensar"
                            ? "application/pdf,.pdf"
                            : "application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                        }
                        onClick={(e) => {
                          (e.target as HTMLInputElement).value = "";
                        }}
                        onChange={handleSeleccionarArchivoDoc}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setDocArchivoTemp(null)}
                      className="px-3 py-1 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              )}

              {errorAccion && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                  {errorAccion}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setModalDoc(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={cargandoAccion || !docArchivoTemp}
                onClick={handleGuardarDocumentoCierre}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs flex items-center space-x-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{cargandoAccion ? "Guardando..." : "Confirmar Carga de Documento"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL CONFIRMAR ELIMINACIÓN DOCUMENTO DE CIERRE */}
      {/* ========================================================= */}
      {modalConfirmarEliminarDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">¿Desvincular documento?</h4>
                <p className="text-xs text-slate-500 font-mono font-semibold">{modalConfirmarEliminarDoc.codigo}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              El archivo <strong className="text-slate-800">{modalConfirmarEliminarDoc.nombreArchivo}</strong> correspondiente a <strong className="text-slate-800">{modalConfirmarEliminarDoc.nombre}</strong> será removido y el documento volverá a estado pendiente.
            </p>

            {errorAccion && (
              <div className="mb-3 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {errorAccion}
              </div>
            )}

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                disabled={cargandoAccion}
                onClick={() => {
                  setErrorAccion(null);
                  setModalConfirmarEliminarDoc(null);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={cargandoAccion}
                onClick={handleEliminarDocCierre}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center space-x-1"
              >
                {cargandoAccion ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Sí, Desvincular</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: RADICAR SOLICITUD DE DESEMBOLSO */}
      {/* ========================================================= */}
      {modalSolicitarDesembolso && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Landmark className="w-5 h-5 text-emerald-600" />
                <h4 className="font-bold text-base text-slate-900">
                  Radicar Solicitud de Desembolso ante Compensar
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setModalSolicitarDesembolso(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
                Se enviará el paquete de cobro consolidado con los 6 documentos requeridos: 3 Formatos Oficiales de Compensar (Acta de Inicio de Contrato, Acta de Inicio de Obra y Acta de Entrega) y 3 Formatos de Cierre Técnico (Certificado de Habitabilidad, Registro Fotográfico de Entrega y Acta de Recibo a Satisfacción).
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fecha de Radicación *
                </label>
                <input
                  type="date"
                  value={formFechaSolicitud}
                  onChange={(e) => setFormFechaSolicitud(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Número de Radicado Oficial ante Compensar *
                </label>
                <input
                  type="text"
                  value={formRadicadoSolicitud}
                  onChange={(e) => setFormRadicadoSolicitud(e.target.value)}
                  placeholder="Ej: RAD-COMP-DESEMB-2026-4401"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notas u Observaciones del Envío
                </label>
                <textarea
                  rows={2}
                  value={formNotasSolicitud}
                  onChange={(e) => setFormNotasSolicitud(e.target.value)}
                  placeholder="Aclaraciones sobre canales de radicación, ventanilla virtual o documentos adjuntos..."
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-emerald-500 resize-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setModalSolicitarDesembolso(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={cargandoAccion || !formRadicadoSolicitud.trim()}
                onClick={handleRadicarSolicitudDesembolso}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs"
              >
                {cargandoAccion ? "Radicando..." : "Confirmar Radicación de Cobro"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: REGISTRAR OBSERVACIONES DE COMPENSAR */}
      {/* ========================================================= */}
      {modalObservacionDesembolso && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h4 className="font-bold text-base text-slate-900">
                  Registrar Requerimientos / Objeciones de Compensar
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setModalObservacionDesembolso(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Número de Oficio o Radicado de Requerimiento (Opcional)
                </label>
                <input
                  type="text"
                  value={formRadicadoObs}
                  onChange={(e) => setFormRadicadoObs(e.target.value)}
                  placeholder="Ej: OF-COMP-OBS-9921"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Detalle de las Observaciones / Ajustes Solicitados *
                </label>
                <textarea
                  rows={4}
                  value={formDetalleObs}
                  onChange={(e) => setFormDetalleObs(e.target.value)}
                  placeholder="Describa puntualmente las observaciones formuladas por Compensar sobre las actas o soportes..."
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-rose-500 resize-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setModalObservacionDesembolso(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={cargandoAccion || !formDetalleObs.trim()}
                onClick={handleRegistrarObservacionesDesembolso}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs"
              >
                {cargandoAccion ? "Guardando..." : "Registrar Requerimiento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: SUBSANAR OBSERVACIONES DE DESEMBOLSO */}
      {/* ========================================================= */}
      {modalSubsanarDesembolso && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <RotateCcw className="w-5 h-5 text-amber-600" />
                <h4 className="font-bold text-base text-slate-900">
                  Radicar Subsanación a Compensar (Ronda #{modalSubsanarDesembolso.numeroRonda})
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setModalSubsanarDesembolso(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <strong>Requerimiento Original:</strong>
                <p className="mt-0.5 italic">{modalSubsanarDesembolso.detalleObservaciones}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Número de Radicado de Subsanación (Opcional)
                </label>
                <input
                  type="text"
                  value={formRadicadoSubsanacion}
                  onChange={(e) => setFormRadicadoSubsanacion(e.target.value)}
                  placeholder="Ej: RAD-SUBS-COMP-2026-88"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Explicación y Ajustes Realizados *
                </label>
                <textarea
                  rows={4}
                  value={formDetalleSubsanacion}
                  onChange={(e) => setFormDetalleSubsanacion(e.target.value)}
                  placeholder="Detallar los documentos corregidos, aclaraciones radicadas y justificaciones técnicas aportadas..."
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-amber-500 resize-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setModalSubsanarDesembolso(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={cargandoAccion || !formDetalleSubsanacion.trim()}
                onClick={handleRadicarSubsanacionDesembolso}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs"
              >
                {cargandoAccion ? "Guardando..." : "Radicar Subsanación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 6: CONFIRMAR DESEMBOLSO Y CIERRE DEL EXPEDIENTE */}
      {/* ========================================================= */}
      {modalConfirmarDesembolso && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h4 className="font-bold text-base text-slate-900">
                  Confirmar Desembolso y Cerrar Expediente
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setModalConfirmarDesembolso(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed">
                Al confirmar el desembolso, el expediente pasará al estado final <strong>"Subsidio Desembolsado y Cerrado"</strong>, saliendo del flujo activo de gestión diaria y quedando archivado con paz y salvo final.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Fecha del Desembolso / Giro *
                  </label>
                  <input
                    type="date"
                    value={formFechaDesembolso}
                    onChange={(e) => setFormFechaDesembolso(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Monto Desembolsado (COP) *
                  </label>
                  <input
                    type="number"
                    value={formMontoDesembolsado}
                    onChange={(e) => setFormMontoDesembolsado(e.target.value)}
                    placeholder="45000000"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Número de Comprobante / Referencia Bancaria *
                </label>
                <input
                  type="text"
                  value={formNumeroComprobante}
                  onChange={(e) => setFormNumeroComprobante(e.target.value)}
                  placeholder="Ej: TRANS-BCOL-COMP-2026-901"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notas de Cierre Financiero
                </label>
                <textarea
                  rows={2}
                  value={formNotasCierre}
                  onChange={(e) => setFormNotasCierre(e.target.value)}
                  placeholder="Paz y salvo generado, verificación contable y archivo definitivo..."
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-emerald-500 resize-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setModalConfirmarDesembolso(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={cargandoAccion || !formNumeroComprobante.trim()}
                onClick={handleConfirmarDesembolsoYCierre}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs"
              >
                {cargandoAccion ? "Cerrando..." : "Confirmar Cierre y Desembolso"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 7: AGREGAR NOTA TÉCNICA */}
      {/* ========================================================= */}
      {modalNota && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <MessageSquareText className="w-5 h-5 text-indigo-600" />
                <h4 className="font-bold text-sm text-slate-900">
                  Agregar Nota a la Bitácora de Fase 7
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setModalNota(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <textarea
                rows={4}
                value={formTextoNota}
                onChange={(e) => setFormTextoNota(e.target.value)}
                placeholder="Escriba la anotación técnica, coordinación con contratista o registro de visita..."
                className="w-full p-2.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setModalNota(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={cargandoAccion || !formTextoNota.trim()}
                onClick={handleGuardarNota}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs"
              >
                {cargandoAccion ? "Guardando..." : "Guardar Nota"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Fase7ConstruccionCobro;
