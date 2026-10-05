import React, { useState, useEffect } from "react";
import {
  Expediente,
  PerfilUsuario,
  TramiteLicenciaConstruccion,
  EstadoTramiteLicencia,
  RondaSubsanacionLicencia,
  RegistroHistorialLicencia,
  SoporteDocumentoLicencia,
  RequisitoCaso
} from "../types";
import {
  Building2,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  UploadCloud,
  Eye,
  RotateCcw,
  Calendar,
  Hash,
  User,
  Paperclip,
  Check,
  AlertCircle,
  Landmark,
  Plus,
  X,
  Lock,
  ChevronRight,
  FileSpreadsheet
} from "lucide-react";

interface Fase5SeguimientoLicenciaProps {
  expediente: Expediente;
  currentUser: PerfilUsuario;
  requisitoPresupuesto?: RequisitoCaso;
  onAbrirVisor: (data: {
    titulo: string;
    nombreArchivo: string;
    mimeType: string;
    sha256Hash: string;
    tamanoBytes: number;
    subidoPor?: string;
    subidoEn?: string;
    archivoDataUrl?: string;
  }) => void;
  onSubirDocPresupuesto?: (reqId: string) => void;
  onRevisarDocPresupuesto?: (req: RequisitoCaso) => void;
  onActualizarExpediente: (nuevaFase?: number) => Promise<void>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export const Fase5SeguimientoLicencia: React.FC<Fase5SeguimientoLicenciaProps> = ({
  expediente,
  currentUser,
  requisitoPresupuesto,
  onAbrirVisor,
  onSubirDocPresupuesto,
  onRevisarDocPresupuesto,
  onActualizarExpediente,
  authFetch
}) => {
  const tramite: TramiteLicenciaConstruccion = expediente.tramiteLicencia || {
    estadoActual: "sin_radicar",
    entidadMunicipal: `Secretaría de Planeación Municipal`,
    rondasSubsanacion: [],
    historial: []
  };

  const estado = tramite.estadoActual;

  // Estado de bloqueo si el expediente ya avanzó a Fase 6 o superior
  const estaBloqueadaPorFaseAvanzada = (expediente.faseActual || 1) > 5;

  // Permisos según el cambio solicitado:
  // - Ingeniería: responsable directo de la gestión y avance a Fase 6 una vez expedida la licencia.
  // - Supervisor y Administrador: supervisión, auditoría y avance a Fase 6.
  const puedeOperar = !estaBloqueadaPorFaseAvanzada && (currentUser.rol === "ingenieria" || currentUser.rol === "administrador");
  const puedeAvanzarFase =
    !estaBloqueadaPorFaseAvanzada &&
    (currentUser.rol === "ingenieria" ||
    currentUser.rol === "supervisor" ||
    currentUser.rol === "administrador");

  // Estados de modales
  const [modalRadicar, setModalRadicar] = useState(false);
  const [modalObservaciones, setModalObservaciones] = useState(false);
  const [modalSubsanar, setModalSubsanar] = useState<RondaSubsanacionLicencia | null>(null);
  const [modalAprobar, setModalAprobar] = useState(false);
  const [modalNota, setModalNota] = useState(false);
  const [modalConfirmarAvanzarF6, setModalConfirmarAvanzarF6] = useState(false);
  const [modalRequisitosPendientesF6, setModalRequisitosPendientesF6] = useState(false);

  // Safe Escape key handler for all modals in Fase 5
  useEffect(() => {
    const hayModalAbierto =
      modalRadicar ||
      modalObservaciones ||
      modalSubsanar !== null ||
      modalAprobar ||
      modalNota ||
      modalConfirmarAvanzarF6 ||
      modalRequisitosPendientesF6;

    if (!hayModalAbierto) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (modalConfirmarAvanzarF6) setModalConfirmarAvanzarF6(false);
        else if (modalRequisitosPendientesF6) setModalRequisitosPendientesF6(false);
        else if (modalRadicar) setModalRadicar(false);
        else if (modalObservaciones) setModalObservaciones(false);
        else if (modalSubsanar) setModalSubsanar(null);
        else if (modalAprobar) setModalAprobar(false);
        else if (modalNota) setModalNota(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    modalRadicar,
    modalObservaciones,
    modalSubsanar,
    modalAprobar,
    modalNota,
    modalConfirmarAvanzarF6,
    modalRequisitosPendientesF6
  ]);

  // Estados de formularios
  const [cargandoAccion, setCargandoAccion] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [exitoAccion, setExitoAccion] = useState<string | null>(null);

  // Form Radicar Inicial
  const [formEntidad, setFormEntidad] = useState(tramite.entidadMunicipal || "Secretaría de Planeación Municipal");
  const [formNumRadicado, setFormNumRadicado] = useState(tramite.numeroRadicadoInicial || "");
  const [formFechaRad, setFormFechaRad] = useState(
    tramite.fechaRadicacionInicial
      ? tramite.fechaRadicacionInicial.split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [formObsRad, setFormObsRad] = useState("");
  const [archivoRad, setArchivoRad] = useState<File | null>(null);

  // Form Observaciones
  const [formNumActaObs, setFormNumActaObs] = useState("");
  const [formFechaObs, setFormFechaObs] = useState(new Date().toISOString().split("T")[0]);
  const [formFechaLimite, setFormFechaLimite] = useState("");
  const [formDetalleObs, setFormDetalleObs] = useState("");
  const [archivoObs, setArchivoObs] = useState<File | null>(null);

  // Form Subsanar
  const [formNumRadSub, setFormNumRadSub] = useState("");
  const [formFechaRadSub, setFormFechaRadSub] = useState(new Date().toISOString().split("T")[0]);
  const [formDetalleSub, setFormDetalleSub] = useState("");
  const [archivoSub, setArchivoSub] = useState<File | null>(null);

  // Form Aprobar
  const [formNumResolucion, setFormNumResolucion] = useState(tramite.numeroResolucionLicencia || "");
  const [formFechaExpedicion, setFormFechaExpedicion] = useState(
    tramite.fechaExpedicionLicencia
      ? tramite.fechaExpedicionLicencia.split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [formFechaEjecutoria, setFormFechaEjecutoria] = useState(
    tramite.fechaEjecutoriaLicencia
      ? tramite.fechaEjecutoriaLicencia.split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [formVigenciaMeses, setFormVigenciaMeses] = useState(tramite.vigenciaMeses || 24);
  const [formObsFinales, setFormObsFinales] = useState(tramite.observacionesFinales || "");
  const [archivoAprobar, setArchivoAprobar] = useState<File | null>(null);
  const [archivosAprobar, setArchivosAprobar] = useState<File[]>([]); // CAMBIO 8: Carga múltiple de documentos de licencia

  // Form Nota Historial
  const [formTituloNota, setFormTituloNota] = useState("");
  const [formDescNota, setFormDescNota] = useState("");

  // Helper para convertir archivo a data URL y hash simulado
  const procesarArchivo = async (
    file: File
  ): Promise<{ dataUrl: string; sha256: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        // Hash determinístico simple para auditoría
        let hash = 0;
        for (let i = 0; i < dataUrl.length; i++) {
          hash = (hash << 5) - hash + dataUrl.charCodeAt(i);
          hash |= 0;
        }
        const sha256 = `sha256-${Math.abs(hash).toString(16).padStart(16, "0")}-${Date.now().toString(16)}`;
        resolve({ dataUrl, sha256 });
      };
      reader.readAsDataURL(file);
    });
  };

  // 1. Guardar Radicación Inicial
  const handleGuardarRadicacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNumRadicado.trim() || !formFechaRad) {
      setErrorAccion("El número de radicado y la fecha de radicación son obligatorios.");
      return;
    }

    setCargandoAccion(true);
    setErrorAccion(null);
    try {
      let archivoDataUrl: string | undefined = undefined;
      let sha256Hash: string | undefined = undefined;

      if (archivoRad) {
        const p = await procesarArchivo(archivoRad);
        archivoDataUrl = p.dataUrl;
        sha256Hash = p.sha256;
      }

      const res = await authFetch(`/api/expedientes/${expediente.id}/licencia/radicar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entidadMunicipal: formEntidad.trim(),
          numeroRadicado: formNumRadicado.trim(),
          fechaRadicacion: new Date(formFechaRad).toISOString(),
          observaciones: formObsRad.trim(),
          nombreArchivo: archivoRad ? archivoRad.name : undefined,
          mimeType: archivoRad ? archivoRad.type : undefined,
          tamanoBytes: archivoRad ? archivoRad.size : undefined,
          archivoDataUrl,
          sha256Hash
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar radicación");

      setExitoAccion("Radicación de licencia formalizada con éxito.");
      setModalRadicar(false);
      setArchivoRad(null);
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al procesar la solicitud.");
    } finally {
      setCargandoAccion(false);
    }
  };

  // 2. Guardar Acta de Observaciones
  const handleGuardarObservaciones = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDetalleObs.trim() || !formFechaObs) {
      setErrorAccion("La fecha y el detalle de las observaciones son obligatorios.");
      return;
    }

    setCargandoAccion(true);
    setErrorAccion(null);
    try {
      let archivoDataUrl: string | undefined = undefined;
      let sha256Hash: string | undefined = undefined;

      if (archivoObs) {
        const p = await procesarArchivo(archivoObs);
        archivoDataUrl = p.dataUrl;
        sha256Hash = p.sha256;
      }

      const res = await authFetch(`/api/expedientes/${expediente.id}/licencia/observaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numeroActaObservaciones: formNumActaObs.trim(),
          fechaObservaciones: new Date(formFechaObs).toISOString(),
          detalleObservaciones: formDetalleObs.trim(),
          fechaLimiteSubsanacion: formFechaLimite ? new Date(formFechaLimite).toISOString() : undefined,
          nombreArchivo: archivoObs ? archivoObs.name : undefined,
          mimeType: archivoObs ? archivoObs.type : undefined,
          tamanoBytes: archivoObs ? archivoObs.size : undefined,
          archivoDataUrl,
          sha256Hash
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar observaciones");

      setExitoAccion("Acta de observaciones registrada correctamente.");
      setModalObservaciones(false);
      setArchivoObs(null);
      setFormDetalleObs("");
      setFormNumActaObs("");
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al registrar observaciones.");
    } finally {
      setCargandoAccion(false);
    }
  };

  // 3. Guardar Subsanación
  const handleGuardarSubsanacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNumRadSub.trim() || !formFechaRadSub || !formDetalleSub.trim()) {
      setErrorAccion("El número de radicado, fecha y detalle de respuesta son obligatorios.");
      return;
    }

    setCargandoAccion(true);
    setErrorAccion(null);
    try {
      let archivoDataUrl: string | undefined = undefined;
      let sha256Hash: string | undefined = undefined;

      if (archivoSub) {
        const p = await procesarArchivo(archivoSub);
        archivoDataUrl = p.dataUrl;
        sha256Hash = p.sha256;
      }

      const res = await authFetch(`/api/expedientes/${expediente.id}/licencia/subsanar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rondaId: modalSubsanar?.id,
          numeroRadicadoSubsanacion: formNumRadSub.trim(),
          fechaRadicacionSubsanacion: new Date(formFechaRadSub).toISOString(),
          detalleRespuestaSubsanacion: formDetalleSub.trim(),
          nombreArchivo: archivoSub ? archivoSub.name : undefined,
          mimeType: archivoSub ? archivoSub.type : undefined,
          tamanoBytes: archivoSub ? archivoSub.size : undefined,
          archivoDataUrl,
          sha256Hash
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al radicar subsanación");

      setExitoAccion("Subsanación radicada con éxito ante la entidad municipal.");
      setModalSubsanar(null);
      setArchivoSub(null);
      setFormNumRadSub("");
      setFormDetalleSub("");
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al radicar subsanación.");
    } finally {
      setCargandoAccion(false);
    }
  };

  // 4. Guardar Aprobación de Licencia (CAMBIO 8: Soporte multi-documento)
  const handleGuardarAprobacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNumResolucion.trim() || !formFechaExpedicion) {
      setErrorAccion("El número de resolución/licencia y la fecha de expedición son obligatorios.");
      return;
    }

    const tieneDocsExistentes = (tramite.soporteLicenciaAprobadaDocs && tramite.soporteLicenciaAprobadaDocs.length > 0) || !!tramite.soporteLicenciaAprobada;
    if (archivosAprobar.length === 0 && !archivoAprobar && !tieneDocsExistentes) {
      setErrorAccion("Debe adjuntar al menos un documento oficial de soporte de la Licencia expedida.");
      return;
    }

    setCargandoAccion(true);
    setErrorAccion(null);
    try {
      const docsAProcesar = archivosAprobar.length > 0 ? archivosAprobar : (archivoAprobar ? [archivoAprobar] : []);
      let documentosSoporte: any[] = [];

      if (docsAProcesar.length > 0) {
        documentosSoporte = await Promise.all(
          docsAProcesar.map(async (f) => {
            const p = await procesarArchivo(f);
            return {
              nombreArchivo: f.name,
              mimeType: f.type || "application/pdf",
              tamanoBytes: f.size,
              archivoDataUrl: p.dataUrl,
              sha256Hash: p.sha256
            };
          })
        );
      }

      const res = await authFetch(`/api/expedientes/${expediente.id}/licencia/aprobar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numeroResolucionLicencia: formNumResolucion.trim(),
          fechaExpedicionLicencia: new Date(formFechaExpedicion).toISOString(),
          fechaEjecutoriaLicencia: formFechaEjecutoria ? new Date(formFechaEjecutoria).toISOString() : undefined,
          vigenciaMeses: Number(formVigenciaMeses),
          observacionesFinales: formObsFinales.trim(),
          documentosSoporte: documentosSoporte.length > 0 ? documentosSoporte : undefined,
          nombreArchivo: documentosSoporte[0]?.nombreArchivo || archivoAprobar?.name || tramite.soporteLicenciaAprobada?.nombreArchivo,
          mimeType: documentosSoporte[0]?.mimeType || archivoAprobar?.type || tramite.soporteLicenciaAprobada?.mimeType || "application/pdf",
          tamanoBytes: documentosSoporte[0]?.tamanoBytes || archivoAprobar?.size || tramite.soporteLicenciaAprobada?.tamanoBytes || 1500000,
          archivoDataUrl: documentosSoporte[0]?.archivoDataUrl || tramite.soporteLicenciaAprobada?.archivoDataUrl,
          sha256Hash: documentosSoporte[0]?.sha256Hash || tramite.soporteLicenciaAprobada?.sha256Hash
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar aprobación de la licencia");

      setExitoAccion("¡Licencia de Construcción registrada y aprobada formalmente!");
      setModalAprobar(false);
      setArchivoAprobar(null);
      setArchivosAprobar([]);
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al aprobar la licencia.");
    } finally {
      setCargandoAccion(false);
    }
  };

  // 5. Guardar Nota en Historial
  const handleGuardarNota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTituloNota.trim() || !formDescNota.trim()) {
      setErrorAccion("El título y la descripción de la novedad son obligatorios.");
      return;
    }

    setCargandoAccion(true);
    setErrorAccion(null);
    try {
      const res = await authFetch(`/api/expedientes/${expediente.id}/licencia/historial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: formTituloNota.trim(),
          descripcion: formDescNota.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar nota en historial");

      setExitoAccion("Novedad agregada al historial de la licencia.");
      setModalNota(false);
      setFormTituloNota("");
      setFormDescNota("");
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al registrar nota.");
    } finally {
      setCargandoAccion(false);
    }
  };

  // 6. Avanzar a Fase 6
  const handleAvanzarFase6 = () => {
    if (estado !== "aprobada") {
      setModalRequisitosPendientesF6(true);
      return;
    }
    if (!puedeAvanzarFase) {
      setErrorAccion("Acción restringida: solo Ingeniería, Supervisión o Administrador pueden avanzar de fase.");
      return;
    }
    setModalConfirmarAvanzarF6(true);
  };

  const handleEjecutarAvanzarFase6 = async () => {
    setCargandoAccion(true);
    setErrorAccion(null);
    try {
      const res = await authFetch(`/api/expedientes/${expediente.id}/avanzar-fase-6`, {
        method: "POST"
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al avanzar a Fase 6");

      setModalConfirmarAvanzarF6(false);
      setExitoAccion("Expediente avanzado con éxito a Fase 6: En Postulación.");
      await onActualizarExpediente(6);
    } catch (err: any) {
      setErrorAccion(err.message || "Error al avanzar a Fase 6.");
    } finally {
      setCargandoAccion(false);
    }
  };

  // Helper para abrir visor
  const abrirSoporte = (soporte?: SoporteDocumentoLicencia, tituloDefecto?: string) => {
    if (!soporte) return;
    onAbrirVisor({
      titulo: tituloDefecto || soporte.nombreArchivo,
      nombreArchivo: soporte.nombreArchivo,
      mimeType: soporte.mimeType || "application/pdf",
      tamanoBytes: soporte.tamanoBytes || 1024000,
      sha256Hash: soporte.sha256Hash || soporte.sha256 || "sha256-demo",
      subidoPor: soporte.subidoPor || "Ingeniería VRD",
      subidoEn: soporte.subidoEn || new Date().toISOString(),
      archivoDataUrl: soporte.archivoDataUrl || soporte.url
    });
  };

  // Configuración visual del estado único de trámite
  const getBadgeEstado = () => {
    switch (estado) {
      case "aprobada":
        return {
          texto: "Licencia Aprobada / Expedida",
          clase: "bg-emerald-100 text-emerald-800 border-emerald-300",
          icono: ShieldCheck,
          indicadorColor: "bg-emerald-500",
          descripcion: "La Licencia de Construcción cuenta con resolución oficial ejecutoriada y soporte documental verificado."
        };
      case "con_observaciones":
        return {
          texto: "Con Observaciones / En Subsanación",
          clase: "bg-amber-100 text-amber-900 border-amber-300",
          icono: AlertTriangle,
          indicadorColor: "bg-amber-500",
          descripcion: "La entidad municipal o curaduría emitió requerimientos técnicos. Se encuentra en etapa de subsanación."
        };
      case "radicado_en_revision":
        return {
          texto: "Radicado — En Trámite Municipal",
          clase: "bg-blue-100 text-blue-900 border-blue-300",
          icono: Clock,
          indicadorColor: "bg-blue-500",
          descripcion: "Solicitud radicada formalmente ante la entidad municipal. En estudio técnico de planeación / curaduría."
        };
      case "desistida_rechazada":
        return {
          texto: "Desistida / No Viable",
          clase: "bg-rose-100 text-rose-900 border-rose-300",
          icono: AlertCircle,
          indicadorColor: "bg-rose-500",
          descripcion: "El trámite fue archivado o desistido por la entidad competente."
        };
      case "sin_radicar":
      default:
        return {
          texto: "Licencia: Sin Radicar",
          clase: "bg-slate-100 text-slate-800 border-slate-300",
          icono: Building2,
          indicadorColor: "bg-slate-400",
          descripcion: "El expediente cuenta con los documentos técnicos de Fase 4 y está listo para ser radicado ante la entidad municipal."
        };
    }
  };

  const badge = getBadgeEstado();
  const IconoBadge = badge.icono;
  const rondas = tramite.rondasSubsanacion || [];
  const ultimaRonda = rondas.length > 0 ? rondas[rondas.length - 1] : null;
  const rondaPendienteSubsanar = ultimaRonda && !ultimaRonda.fechaRadicacionSubsanacion ? ultimaRonda : null;

  return (
    <div className="space-y-6" id="fase5-seguimiento-licencia-root">
      {/* MENSAJES DE ALERTA O FEEDBACK */}
      {errorAccion && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorAccion}</span>
          </div>
          <button
            type="button"
            aria-label="Cerrar alerta de error"
            onClick={() => setErrorAccion(null)}
            className="text-rose-500 hover:text-rose-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {exitoAccion && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{exitoAccion}</span>
          </div>
          <button
            type="button"
            aria-label="Cerrar alerta de confirmación"
            onClick={() => setExitoAccion(null)}
            className="text-emerald-500 hover:text-emerald-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* BANNER INFORMATIVO: FASE 5 CULMINADA (MODO SOLO LECTURA) */}
      {estaBloqueadaPorFaseAvanzada && (
        <div className="p-4 bg-slate-50 border border-slate-300 rounded-2xl text-slate-800 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2.5">
            <Lock className="w-5 h-5 text-slate-600 shrink-0" />
            <div>
              <strong className="block font-bold text-slate-900 text-sm">Fase 5 Culminada (Modo Solo Lectura)</strong>
              <span className="text-slate-600">
                La Licencia de Construcción fue obtenida y el expediente avanzó a Fase 6: En Postulación. Los registros y soportes de esta fase se conservan para fines de auditoría y consulta técnica.
              </span>
            </div>
          </div>
          <span className="px-3 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg shrink-0">
            Fase {expediente.faseActual} Activa
          </span>
        </div>
      )}

      {/* PANEL SUPERIOR: ESTADO ÚNICO DE TRÁMITE Y ACCIONES GLOBALES */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Fase 5 • Seguimiento de Trámite
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-500 font-medium">
                {tramite.entidadMunicipal}
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mt-1 flex items-center space-x-2.5">
              <span>Licencia de Construcción (Planeación / Curaduría)</span>
            </h3>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
              {badge.descripcion}
            </p>
          </div>

          {/* INDICADOR ÚNICO DE TRÁMITE (REEMPLAZA EL ANTERIOR '4 DE 5 ACEPTADOS') */}
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`px-3.5 py-2 rounded-xl border flex items-center space-x-2 text-sm font-semibold shadow-2xs ${badge.clase}`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${badge.indicadorColor} animate-pulse`} />
              <IconoBadge className="w-4 h-4 shrink-0" />
              <span>{badge.texto}</span>
            </div>

            {/* BOTÓN AVANZAR A FASE 6 */}
            {estaBloqueadaPorFaseAvanzada ? (
              <button
                type="button"
                disabled
                className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center space-x-2 bg-slate-100 text-slate-500 border border-slate-300 cursor-not-allowed shadow-2xs"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Fase 5 Culminada (Avanzado a Fase 6)</span>
              </button>
            ) : (
              <button
                type="button"
                id="btn-avanzar-fase-6"
                onClick={handleAvanzarFase6}
                disabled={cargandoAccion}
                className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center space-x-2 transition-all shadow-xs cursor-pointer active:scale-98 ${
                  estado === "aprobada" && puedeAvanzarFase
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-300 ring-offset-1"
                    : estado === "aprobada" && !puedeAvanzarFase
                    ? "bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                }`}
                title={
                  estado !== "aprobada"
                    ? "Haga clic para ver los requisitos pendientes para avanzar a Fase 6 (Resolución de Licencia)."
                    : !puedeAvanzarFase
                    ? "Acción disponible para Ingeniería, Supervisión y Administrador."
                    : "Avanzar formalmente el expediente a Fase 6: En Postulación"
                }
              >
                {cargandoAccion ? <Clock className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                <span>Avanzar a Fase 6</span>
              </button>
            )}
          </div>
        </div>

        {/* BANNER ORIENTADOR DE ESTADO PARA AVANCE A FASE 6 */}
        {estado !== "aprobada" && (
          <div className="mt-3.5 p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start sm:items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
              <span>
                <strong>Requisito para Fase 6:</strong> La Licencia de Construcción debe estar en estado <strong>Aprobada</strong> con su acto administrativo y resolución cargada. Actualmente el trámite está en estado <em>«{badge.texto}»</em>.
              </span>
            </div>
            {puedeOperar && (
              <button
                type="button"
                onClick={() => {
                  setFormNumResolucion(tramite.numeroResolucionLicencia || "");
                  setModalAprobar(true);
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs shrink-0 self-start sm:self-auto shadow-2xs cursor-pointer"
              >
                Registrar Licencia Aprobada
              </button>
            )}
          </div>
        )}

        {/* BARRA DE ROLES Y VISIBILIDAD */}
      <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-slate-700">Responsable de gestión:</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 font-medium">
            Ingeniería (Gestor Directo)
          </span>
          <span className="text-slate-300">|</span>
          <span className="font-semibold text-slate-700">Visibilidad y Control:</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-medium">
            Analista Documental & Administrador
          </span>
        </div>

        {!estaBloqueadaPorFaseAvanzada && (
          <div className="flex items-center space-x-2">
            <button
              type="button"
              id="btn-nueva-nota-licencia"
              onClick={() => {
                setFormTituloNota("");
                setFormDescNota("");
                setModalNota(true);
              }}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center space-x-1 hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-slate-500" />
              <span>Registrar Novedad / Nota</span>
            </button>
          </div>
        )}
      </div>
    </div>

    {/* COMPONENTE TRASLADADO: F5-01 PRESUPUESTO OFICIAL Y APU DETALLADO */}
    {(() => {
      const tieneDocF5_01 = Boolean(
        requisitoPresupuesto?.documentoAsociado?.versionActual ||
        (requisitoPresupuesto?.documentoAsociado?.versiones && requisitoPresupuesto.documentoAsociado.versiones.length > 0)
      );

      const estadoF5_01 = requisitoPresupuesto?.estado === "aceptado"
        ? "aceptado"
        : requisitoPresupuesto?.estado === "con_observaciones"
        ? "con_observaciones"
        : tieneDocF5_01
        ? (requisitoPresupuesto?.estado || "recibido_revision")
        : (requisitoPresupuesto?.estado === "recibido_revision" ? "recibido_revision" : "pendiente_carga");

      return (
        <div
          id="card-f5-01-presupuesto"
          className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div
                className={`p-3 rounded-xl ${
                  estadoF5_01 === "aceptado"
                    ? "bg-emerald-100 text-emerald-700"
                    : estadoF5_01 === "recibido_revision"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                    F5-01
                  </span>
                  <h4 className="text-sm font-bold text-slate-900">
                    Presupuesto Oficial y APU Detallado
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-semibold">
                    Obligatorio
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                  Análisis de Precios Unitarios regionalizado Cundinamarca y presupuesto oficial de obra desglosado para el subsidio de vivienda rural.
                </p>

                {requisitoPresupuesto?.documentoAsociado?.versionActual && (
                  <div className="text-[11px] text-slate-600 mt-2 flex flex-wrap items-center gap-2 font-mono">
                    <span className="font-bold text-slate-700">
                      v{requisitoPresupuesto.documentoAsociado.versionActual.versionNumero}
                    </span>
                    <span>•</span>
                    <span>{requisitoPresupuesto.documentoAsociado.versionActual.nombreArchivoOriginal}</span>
                    <span>•</span>
                    <span className="text-slate-400">
                      Subido: {requisitoPresupuesto.documentoAsociado.versionActual.subidoEn?.split("T")[0]}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
              {/* Estado del Requisito */}
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  estadoF5_01 === "aceptado"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : estadoF5_01 === "recibido_revision"
                    ? "bg-blue-50 text-blue-700 border-blue-300"
                    : estadoF5_01 === "con_observaciones"
                    ? "bg-amber-50 text-amber-700 border-amber-300"
                    : "bg-slate-100 text-slate-600 border-slate-300"
                }`}
              >
                {estadoF5_01 === "aceptado"
                  ? "Aceptado"
                  : estadoF5_01 === "recibido_revision"
                  ? "Cargado / En Revisión"
                  : estadoF5_01 === "con_observaciones"
                  ? "Con Observaciones"
                  : "Pendiente por Cargar"}
              </span>

              {/* Ver en Visor Interno */}
              {requisitoPresupuesto?.documentoAsociado?.versionActual && (
                <button
                  type="button"
                  id="btn-ver-presupuesto-f5"
                  onClick={() => {
                    const ver = requisitoPresupuesto.documentoAsociado!.versionActual!;
                    onAbrirVisor({
                      titulo: "Presupuesto Oficial y APU Detallado (F5-01)",
                      nombreArchivo: ver.nombreArchivoOriginal,
                      mimeType: ver.mimeType,
                      sha256Hash: ver.sha256Hash,
                      tamanoBytes: ver.tamanoBytes,
                      subidoPor: ver.subidoPorNombre,
                      subidoEn: ver.subidoEn,
                      archivoDataUrl: ver.archivoDataUrl
                    });
                  }}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  title="Abrir en Visor"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Ver Archivo</span>
                </button>
              )}

              {/* Subir Documento (Ingeniería, Supervisor, Administrador) */}
              {!estaBloqueadaPorFaseAvanzada && onSubirDocPresupuesto && requisitoPresupuesto && (
                <button
                  type="button"
                  id="btn-cargar-presupuesto-f5"
                  onClick={() => onSubirDocPresupuesto(requisitoPresupuesto.id)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{tieneDocF5_01 ? "Actualizar APU" : "Cargar APU"}</span>
                </button>
              )}

              {/* Revisar Documento (Supervisor / Administrador) */}
              {!estaBloqueadaPorFaseAvanzada &&
                onRevisarDocPresupuesto &&
                requisitoPresupuesto &&
                estadoF5_01 !== "aceptado" &&
                (currentUser.rol === "supervisor" || currentUser.rol === "administrador") && (
                  <button
                    type="button"
                    id="btn-revisar-presupuesto-f5"
                    onClick={() => onRevisarDocPresupuesto(requisitoPresupuesto)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Revisar y Decidir</span>
                  </button>
                )}
            </div>
          </div>
        </div>
      );
    })()}

      {/* TARJETA DE RESUMEN DE RADICACIÓN Y RESOLUCIÓN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* BLOQUE 1: DATOS DE RADICACIÓN INICIAL */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                <Landmark className="w-4 h-4 text-blue-600" />
                <span>Radicación Municipal</span>
              </span>
              {tramite.numeroRadicadoInicial ? (
                <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                  Radicado
                </span>
              ) : (
                <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                  Pendiente
                </span>
              )}
            </div>

            <div className="mt-4 space-y-2.5">
              <div>
                <span className="text-2xs font-medium text-slate-400 block">Entidad Competente</span>
                <span className="text-xs font-semibold text-slate-900 block truncate" title={tramite.entidadMunicipal}>
                  {tramite.entidadMunicipal}
                </span>
              </div>

              <div>
                <span className="text-2xs font-medium text-slate-400 block">Número de Radicado</span>
                <span className="text-xs font-mono font-bold text-slate-900 block">
                  {tramite.numeroRadicadoInicial || "Sin radicar aún"}
                </span>
              </div>

              <div>
                <span className="text-2xs font-medium text-slate-400 block">Fecha de Radicación</span>
                <span className="text-xs text-slate-700 flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {tramite.fechaRadicacionInicial
                      ? new Date(tramite.fechaRadicacionInicial).toLocaleDateString("es-CO", {
                          year: "numeric",
                          month: "long",
                          day: "numeric"
                        })
                      : "No registrada"}
                  </span>
                </span>
              </div>

              {tramite.soporteRadicacionInicial && (
                <div className="pt-2">
                  <span className="text-2xs font-medium text-slate-400 block mb-1">Comprobante de Radicación</span>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-xs text-slate-700 truncate max-w-[170px]" title={tramite.soporteRadicacionInicial.nombreArchivo}>
                      {tramite.soporteRadicacionInicial.nombreArchivo}
                    </span>
                    <button
                      type="button"
                      onClick={() => abrirSoporte(tramite.soporteRadicacionInicial, "Radicación Inicial de Licencia")}
                      className="text-2xs font-semibold text-blue-700 hover:text-blue-900 flex items-center space-x-1 px-2 py-1 bg-white border border-blue-200 rounded-md hover:bg-blue-50 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Ver</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {puedeOperar && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                id="btn-modal-radicar"
                onClick={() => {
                  setFormEntidad(tramite.entidadMunicipal || "Secretaría de Planeación Municipal");
                  setFormNumRadicado(tramite.numeroRadicadoInicial || "");
                  setModalRadicar(true);
                }}
                className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-xs font-semibold border border-blue-200 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>
                  {tramite.numeroRadicadoInicial ? "Actualizar Datos de Radicación" : "Registrar Radicación Inicial"}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* BLOQUE 2: ESTADO DE REQUERIMIENTOS Y RONDAS DE SUBSANACIÓN */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                <RotateCcw className="w-4 h-4 text-amber-600" />
                <span>Subsanación y Correcciones</span>
              </span>
              <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                {rondas.length} {rondas.length === 1 ? "Ronda" : "Rondas"}
              </span>
            </div>

            <div className="mt-4 space-y-2.5 text-xs text-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Rondas registradas:</span>
                <span className="font-semibold text-slate-900">{rondas.length}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Estado de requerimientos:</span>
                {estado === "con_observaciones" ? (
                  <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    Pendiente Subsanar
                  </span>
                ) : estado === "aprobada" ? (
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Aprobado / Sin pendientes
                  </span>
                ) : estado === "radicado_en_revision" ? (
                  <span className="font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                    En estudio por la entidad
                  </span>
                ) : (
                  <span className="text-slate-400">Sin observaciones</span>
                )}
              </div>

              {ultimaRonda && (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-2xs uppercase">
                      Última Ronda (#{ultimaRonda.numeroRonda})
                    </span>
                    <span className="text-2xs text-slate-500">
                      {new Date(ultimaRonda.fechaObservaciones).toLocaleDateString("es-CO")}
                    </span>
                  </div>
                  <p className="text-2xs text-slate-600 line-clamp-2 leading-relaxed">
                    {ultimaRonda.detalleObservaciones}
                  </p>
                  {ultimaRonda.fechaRadicacionSubsanacion ? (
                    <div className="text-2xs text-emerald-700 flex items-center space-x-1 font-medium pt-1">
                      <Check className="w-3 h-3" />
                      <span>Subsanada el {new Date(ultimaRonda.fechaRadicacionSubsanacion).toLocaleDateString("es-CO")}</span>
                    </div>
                  ) : (
                    <div className="text-2xs text-amber-700 flex items-center space-x-1 font-medium pt-1">
                      <Clock className="w-3 h-3" />
                      <span>Pendiente radicar subsanación técnica</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {puedeOperar && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
              {rondaPendienteSubsanar ? (
                <button
                  type="button"
                  id="btn-subsanar-ronda"
                  onClick={() => {
                    setFormNumRadSub("");
                    setFormDetalleSub("");
                    setArchivoSub(null);
                    setModalSubsanar(rondaPendienteSubsanar);
                  }}
                  className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Radicar Subsanación de Ronda #{rondaPendienteSubsanar.numeroRonda}</span>
                </button>
              ) : (
                <button
                  type="button"
                  id="btn-registrar-observaciones"
                  onClick={() => {
                    setFormNumActaObs("");
                    setFormDetalleObs("");
                    setArchivoObs(null);
                    setModalObservaciones(true);
                  }}
                  className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-semibold border border-slate-200 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Registrar Acta de Observaciones</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* BLOQUE 3: LICENCIA DE CONSTRUCCIÓN APROBADA (ACTO ADMINISTRATIVO FINAL) */}
        <div
          className={`border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all ${
            estado === "aprobada"
              ? "bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-200"
              : "bg-white border-slate-200"
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                <ShieldCheck
                  className={`w-4 h-4 ${estado === "aprobada" ? "text-emerald-600" : "text-slate-400"}`}
                />
                <span>Licencia Oficial Expedida</span>
              </span>
              {estado === "aprobada" ? (
                <span className="text-2xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center space-x-1">
                  <Check className="w-3 h-3" />
                  <span>Aprobada</span>
                </span>
              ) : (
                <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                  En proceso
                </span>
              )}
            </div>

            <div className="mt-4 space-y-2.5">
              {estado === "aprobada" ? (
                <>
                  <div>
                    <span className="text-2xs font-medium text-slate-500 block">Resolución de Licencia</span>
                    <span className="text-sm font-bold text-emerald-950 font-mono block">
                      {tramite.numeroResolucionLicencia || "Sin número registrado"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-2xs font-medium text-slate-500 block">Fecha Expedición</span>
                      <span className="text-slate-800 font-medium">
                        {tramite.fechaExpedicionLicencia
                          ? new Date(tramite.fechaExpedicionLicencia).toLocaleDateString("es-CO")
                          : "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-2xs font-medium text-slate-500 block">Vigencia</span>
                      <span className="text-slate-800 font-medium">{tramite.vigenciaMeses || 24} meses</span>
                    </div>
                  </div>

                  {/* CAMBIO 8: Lista de documentos de soporte oficial de licencia (multi-documento) */}
                  {(() => {
                    const docsList = (tramite.soporteLicenciaAprobadaDocs && tramite.soporteLicenciaAprobadaDocs.length > 0)
                      ? tramite.soporteLicenciaAprobadaDocs
                      : (tramite.soporteLicenciaAprobada ? [tramite.soporteLicenciaAprobada] : []);

                    if (docsList.length === 0) return null;

                    return (
                      <div className="pt-2">
                        <span className="text-2xs font-medium text-slate-500 block mb-1">
                          Documentos Oficiales Aprobados ({docsList.length})
                        </span>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {docsList.map((doc, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white border border-emerald-200">
                              <span className="text-xs text-slate-800 font-medium truncate max-w-[160px]" title={doc.nombreArchivo}>
                                {doc.nombreArchivo}
                              </span>
                              <button
                                type="button"
                                onClick={() => abrirSoporte(doc, `Licencia de Construcción Aprobada - Doc ${idx + 1}`)}
                                className="text-2xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center space-x-1 px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 rounded-md border border-emerald-300 cursor-pointer shrink-0"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Ver</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div className="py-6 text-center text-slate-400">
                  <Building2 className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
                  <p className="text-xs text-slate-500 mt-2 font-medium">
                    Aún no se ha registrado la resolución de aprobación de la Licencia.
                  </p>
                  <p className="text-2xs text-slate-400 mt-0.5">
                    Una vez la entidad emita el acto favorable, regístrelo para habilitar el avance a Fase 6.
                  </p>
                </div>
              )}
            </div>
          </div>

          {puedeOperar && (
            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
              <button
                type="button"
                id="btn-modal-aprobar-licencia"
                onClick={() => {
                  setFormNumResolucion(tramite.numeroResolucionLicencia || "");
                  setModalAprobar(true);
                }}
                className={`w-full py-2 px-3 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer ${
                  estado === "aprobada"
                    ? "bg-white hover:bg-slate-50 text-emerald-900 border border-emerald-300 shadow-2xs"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>
                  {estado === "aprobada" ? "Actualizar Resolución de Licencia" : "Registrar Licencia Aprobada"}
                </span>
              </button>

              {estado === "aprobada" && puedeAvanzarFase && (
                <button
                  type="button"
                  id="btn-bloque-avanzar-fase-6"
                  onClick={handleAvanzarFase6}
                  disabled={cargandoAccion}
                  className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer active:scale-98"
                >
                  {cargandoAccion ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  <span>Avanzar a Fase 6 (Ejecución de Obra)</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SECCIÓN DETALLADA: HISTORIAL DE RONDAS DE SUBSANACIÓN (FLUJO FLEXIBLE SIN LÍMITE) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h4 className="font-bold text-base text-slate-900 flex items-center space-x-2">
              <RotateCcw className="w-5 h-5 text-indigo-600" />
              <span>Flujo de Subsanaciones y Observaciones Técnicas</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Rondas de requerimientos formuladas por la entidad y subsanaciones radicadas por el equipo de Ingeniería.
            </p>
          </div>
          {puedeOperar && (
            <button
              type="button"
              onClick={() => {
                setFormNumActaObs("");
                setFormDetalleObs("");
                setArchivoObs(null);
                setModalObservaciones(true);
              }}
              className="text-xs font-semibold px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-slate-500" />
              <span>Nueva Ronda de Observaciones</span>
            </button>
          )}
        </div>

        {rondas.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <CheckCircle2 className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
            <p className="text-xs font-medium text-slate-600 mt-2">
              No se han registrado requerimientos u observaciones de la entidad municipal hasta el momento.
            </p>
            <p className="text-2xs text-slate-400 mt-0.5">
              Si Planeación o la Curaduría expide un acta de observaciones, agréguela aquí para iniciar la ronda de subsanación.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {rondas.map((ronda, idx) => (
              <div
                key={ronda.id || idx}
                className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-200/70">
                  <div className="flex items-center space-x-2.5">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 font-bold text-xs flex items-center justify-center">
                      {ronda.numeroRonda}
                    </span>
                    <h5 className="font-bold text-sm text-slate-900">
                      Ronda de Requerimientos #{ronda.numeroRonda}
                    </h5>
                    {ronda.numeroActaObservaciones && (
                      <span className="text-2xs font-mono px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                        Acta: {ronda.numeroActaObservaciones}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 text-xs">
                    {ronda.fechaRadicacionSubsanacion ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                        <Check className="w-3.5 h-3.5" />
                        <span>Subsanada</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Pendiente Radicación</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 text-xs">
                  {/* Requerimiento de la Entidad */}
                  <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                    <span className="text-2xs font-bold uppercase tracking-wider text-amber-800 flex items-center space-x-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      <span>Requerimiento de Planeación / Curaduría</span>
                    </span>
                    <p className="text-slate-700 leading-relaxed">
                      {ronda.detalleObservaciones}
                    </p>
                    <div className="pt-1 text-2xs text-slate-400 flex flex-wrap items-center gap-3">
                      <span>Notificado: {new Date(ronda.fechaObservaciones).toLocaleDateString("es-CO")}</span>
                      {ronda.fechaLimiteSubsanacion && (
                        <span>Límite: {new Date(ronda.fechaLimiteSubsanacion).toLocaleDateString("es-CO")}</span>
                      )}
                    </div>
                    {ronda.soporteObservaciones && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => abrirSoporte(ronda.soporteObservaciones, `Acta Observaciones Ronda ${ronda.numeroRonda}`)}
                          className="text-2xs text-blue-700 hover:text-blue-900 font-semibold flex items-center space-x-1 hover:underline cursor-pointer"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Ver Acta en PDF ({ronda.soporteObservaciones.nombreArchivo})</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Respuesta / Subsanación de Ingeniería */}
                  <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                    <span className="text-2xs font-bold uppercase tracking-wider text-emerald-800 flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Respuesta Radicada por Ingeniería</span>
                    </span>

                    {ronda.fechaRadicacionSubsanacion ? (
                      <>
                        <p className="text-slate-700 leading-relaxed">
                          {ronda.detalleRespuestaSubsanacion}
                        </p>
                        <div className="pt-1 text-2xs text-slate-400 flex flex-wrap items-center gap-3">
                          <span className="font-mono font-semibold text-slate-700">
                            Radicado: {ronda.numeroRadicadoSubsanacion}
                          </span>
                          <span>
                            Fecha: {new Date(ronda.fechaRadicacionSubsanacion).toLocaleDateString("es-CO")}
                          </span>
                        </div>
                        {ronda.soporteSubsanacion && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => abrirSoporte(ronda.soporteSubsanacion, `Radicado Subsanación Ronda ${ronda.numeroRonda}`)}
                              className="text-2xs text-blue-700 hover:text-blue-900 font-semibold flex items-center space-x-1 hover:underline cursor-pointer"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Ver Soporte de Subsanación ({ronda.soporteSubsanacion.nombreArchivo})</span>
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="py-3 text-center">
                        <p className="text-xs text-amber-800 font-medium">
                          Aún no se ha radicado la respuesta a estos requerimientos.
                        </p>
                        {puedeOperar && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormNumRadSub("");
                              setFormDetalleSub("");
                              setArchivoSub(null);
                              setModalSubsanar(ronda);
                            }}
                            className="mt-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors inline-flex items-center space-x-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Radicar Subsanación Ahora</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECCIÓN DE BITÁCORA Y CRONOLOGÍA COMPLETA DEL TRÁMITE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h4 className="font-bold text-base text-slate-900 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-slate-600" />
              <span>Bitácora Cronológica de la Licencia de Construcción</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Registro histórico inmutable de radicaciones, observaciones, respuestas y novedades con fecha y autor.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {tramite.historial.length} eventos registrados
          </span>
        </div>

        {tramite.historial.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            No hay eventos registrados en la bitácora todavía.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {tramite.historial.map((hist, idx) => (
              <div
                key={hist.id || idx}
                className="flex items-start space-x-3 text-xs border-l-2 border-slate-200 pl-3 py-1 hover:border-blue-400 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="font-bold text-slate-900">{hist.titulo}</span>
                    <span className="text-2xs text-slate-400">
                      {new Date(hist.fecha).toLocaleString("es-CO", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>

                  {hist.descripcion && (
                    <p className="text-slate-600 mt-1 leading-relaxed">
                      {hist.descripcion}
                    </p>
                  )}

                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-2xs text-slate-400">
                    <span className="flex items-center space-x-1">
                      <User className="w-3 h-3" />
                      <span>{hist.usuarioNombre} ({hist.usuarioRol})</span>
                    </span>

                    {hist.numeroRadicado && (
                      <span className="flex items-center space-x-1 font-mono">
                        <Hash className="w-3 h-3" />
                        <span>{hist.numeroRadicado}</span>
                      </span>
                    )}

                    {hist.soporte && (
                      <button
                        type="button"
                        onClick={() => abrirSoporte(hist.soporte, hist.titulo)}
                        className="text-blue-700 hover:text-blue-900 font-semibold flex items-center space-x-1 hover:underline cursor-pointer"
                      >
                        <Paperclip className="w-3 h-3" />
                        <span>Ver Soporte ({hist.soporte.nombreArchivo})</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CONFIRMAR AVANCE FORMAL A FASE 6 */}
      {/* ========================================================================= */}
      {modalConfirmarAvanzarF6 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div role="dialog" aria-modal="true" aria-labelledby="f5-modal-avanzar-f6-titulo" className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-emerald-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                <h3 id="f5-modal-avanzar-f6-titulo" className="font-bold text-base">Avanzar a Fase 6: Ejecución de Obra</h3>
              </div>
              <button
                type="button"
                aria-label="Cerrar modal de pase a Fase 6"
                onClick={() => setModalConfirmarAvanzarF6(false)}
                className="text-emerald-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-1.5">
                <p className="font-bold text-sm text-emerald-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Licencia de Construcción Aprobada y Verificada
                </p>
                <p>
                  <strong>Resolución:</strong> {tramite.numeroResolucionLicencia || "Resolución Oficial Registrada"}
                </p>
                {tramite.fechaExpedicionLicencia && (
                  <p>
                    <strong>Fecha de Expedición:</strong> {new Date(tramite.fechaExpedicionLicencia).toLocaleDateString("es-CO")}
                  </p>
                )}
                {tramite.fechaEjecutoriaLicencia && (
                  <p>
                    <strong>Fecha de Ejecutoria:</strong> {new Date(tramite.fechaEjecutoriaLicencia).toLocaleDateString("es-CO")}
                  </p>
                )}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Al confirmar, el expediente pasará formalmente a la <strong>Fase 6: Ejecución de Obra</strong>. Se registrará la trazabilidad completa en la bitácora del proyecto y quedará habilitado el seguimiento de actas de inicio y avance de obra.
              </p>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalConfirmarAvanzarF6(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={cargandoAccion}
                  onClick={handleEjecutarAvanzarFase6}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer flex items-center space-x-1.5"
                >
                  {cargandoAccion ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  <span>{cargandoAccion ? "Avanzando..." : "Confirmar y Pasar a Fase 6"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REQUISITOS PENDIENTES PARA AVANZAR A FASE 6 */}
      {/* ========================================================================= */}
      {modalRequisitosPendientesF6 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div role="dialog" aria-modal="true" aria-labelledby="f5-modal-req-f6-titulo" className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-amber-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-amber-300" />
                <h3 id="f5-modal-req-f6-titulo" className="font-bold text-base">Requisitos para Avanzar a Fase 6</h3>
              </div>
              <button
                type="button"
                aria-label="Cerrar modal de requisitos pendientes"
                onClick={() => setModalRequisitosPendientesF6(false)}
                className="text-amber-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed">
                Para trasladar el expediente a la <strong>Fase 6: Ejecución de Obra</strong>, la normativa constructiva y el flujo del CRM exigen que la <strong>Licencia de Construcción</strong> esté en estado <strong>Aprobada</strong> con su acto administrativo formal registrado.
              </p>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Estado actual del trámite:</span>
                  <span className="font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                    {badge.texto}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Resolución oficial de Licencia:</span>
                  <span className="font-mono text-slate-500">
                    {tramite.numeroResolucionLicencia || "Pendiente de registro"}
                  </span>
                </div>
              </div>

              <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200 text-xs text-blue-900 space-y-1">
                <p className="font-bold flex items-center gap-1 text-blue-950">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  ¿Cómo desbloquear el avance a Fase 6?
                </p>
                <p>
                  1. Si la curaduría o planeación ya expidió la licencia, use el botón <strong>«Registrar Licencia Aprobada»</strong> para ingresar el número de resolución, fechas de ejecutoria y los documentos en PDF.
                </p>
                <p>
                  2. Una vez guardado el estado Aprobada, este botón avanzará el proyecto de manera automática y habilitará la Fase 6.
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalRequisitosPendientesF6(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  Entendido
                </button>
                {puedeOperar && (
                  <button
                    type="button"
                    onClick={() => {
                      setModalRequisitosPendientesF6(false);
                      setFormNumResolucion(tramite.numeroResolucionLicencia || "");
                      setModalAprobar(true);
                    }}
                    className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer flex items-center space-x-1"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Registrar Licencia Aprobada Ahora</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: REGISTRAR RADICACIÓN INICIAL */}
      {/* ========================================================================= */}
      {modalRadicar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div role="dialog" aria-modal="true" aria-labelledby="f5-modal-radicar-titulo" className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Landmark className="w-5 h-5 text-blue-400" />
                <h3 id="f5-modal-radicar-titulo" className="font-bold text-base">Registrar Radicación de Licencia</h3>
              </div>
              <button
                type="button"
                aria-label="Cerrar modal de radicación de licencia"
                onClick={() => setModalRadicar(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarRadicacion} className="p-5 space-y-4">
              <div>
                <label htmlFor="f5-rad-entidad" className="block text-xs font-bold text-slate-700 mb-1">
                  Entidad Municipal / Curaduría Urbana *
                </label>
                <input
                  id="f5-rad-entidad"
                  type="text"
                  required
                  value={formEntidad}
                  onChange={(e) => setFormEntidad(e.target.value)}
                  placeholder="Ej: Secretaría de Planeación Municipal de Choachí"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="f5-rad-num" className="block text-xs font-bold text-slate-700 mb-1">
                    Número de Radicado *
                  </label>
                  <input
                    id="f5-rad-num"
                    type="text"
                    required
                    value={formNumRadicado}
                    onChange={(e) => setFormNumRadicado(e.target.value)}
                    placeholder="Ej: RAD-2026-FOS-0482"
                    className="w-full text-xs font-mono font-bold px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="f5-rad-fecha" className="block text-xs font-bold text-slate-700 mb-1">
                    Fecha de Radicación *
                  </label>
                  <input
                    id="f5-rad-fecha"
                    type="date"
                    required
                    value={formFechaRad}
                    onChange={(e) => setFormFechaRad(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="f5-rad-archivo" className="block text-xs font-bold text-slate-700 mb-1">
                  Comprobante de Radicación / Formulario Único Nacional (PDF)
                </label>
                <input
                  id="f5-rad-archivo"
                  type="file"
                  accept=".pdf,application/pdf,image/*"
                  onClick={(e) => {
                    (e.target as HTMLInputElement).value = "";
                  }}
                  onChange={(e) => setArchivoRad(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-2xs text-slate-400 mt-1">
                  Adjunte la copia escaneada del formulario único nacional con sello de radicación.
                </p>
              </div>

              <div>
                <label htmlFor="f5-rad-obs" className="block text-xs font-bold text-slate-700 mb-1">
                  Observaciones de Radicación
                </label>
                <textarea
                  id="f5-rad-obs"
                  rows={2}
                  value={formObsRad}
                  onChange={(e) => setFormObsRad(e.target.value)}
                  placeholder="Notas adicionales sobre la entrega en ventanilla, funcionarios o requisitos preliminares."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalRadicar(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargandoAccion}
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {cargandoAccion ? "Guardando..." : "Registrar Radicación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: REGISTRAR ACTA DE OBSERVACIONES */}
      {/* ========================================================================= */}
      {modalObservaciones && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div role="dialog" aria-modal="true" aria-labelledby="f5-modal-obs-titulo" className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="p-5 bg-amber-600 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-amber-200" />
                <h3 id="f5-modal-obs-titulo" className="font-bold text-base">Registrar Acta de Observaciones</h3>
              </div>
              <button
                type="button"
                aria-label="Cerrar modal de acta de observaciones"
                onClick={() => setModalObservaciones(false)}
                className="text-amber-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarObservaciones} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="f5-obs-num-acta" className="block text-xs font-bold text-slate-700 mb-1">
                    Número de Acta / Oficio
                  </label>
                  <input
                    id="f5-obs-num-acta"
                    type="text"
                    value={formNumActaObs}
                    onChange={(e) => setFormNumActaObs(e.target.value)}
                    placeholder="Ej: ACTA-OBS-2026-019"
                    className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label htmlFor="f5-obs-fecha" className="block text-xs font-bold text-slate-700 mb-1">
                    Fecha de Notificación *
                  </label>
                  <input
                    id="f5-obs-fecha"
                    type="date"
                    required
                    value={formFechaObs}
                    onChange={(e) => setFormFechaObs(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="f5-obs-limite" className="block text-xs font-bold text-slate-700 mb-1">
                  Fecha Límite para Subsanación (si aplica)
                </label>
                <input
                  id="f5-obs-limite"
                  type="date"
                  value={formFechaLimite}
                  onChange={(e) => setFormFechaLimite(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label htmlFor="f5-obs-detalle" className="block text-xs font-bold text-slate-700 mb-1">
                  Detalle de Observaciones y Requerimientos *
                </label>
                <textarea
                  id="f5-obs-detalle"
                  required
                  rows={4}
                  value={formDetalleObs}
                  onChange={(e) => setFormDetalleObs(e.target.value)}
                  placeholder="Detalle puntual de las correcciones arquitectónicas, estructurales, o documentales exigidas por la entidad."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label htmlFor="f5-obs-archivo" className="block text-xs font-bold text-slate-700 mb-1">
                  Acta de Observaciones Escaneada (PDF)
                </label>
                <input
                  id="f5-obs-archivo"
                  type="file"
                  accept=".pdf,application/pdf,image/*"
                  onClick={(e) => {
                    (e.target as HTMLInputElement).value = "";
                  }}
                  onChange={(e) => setArchivoObs(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-50 file:text-amber-800 hover:file:bg-amber-100"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalObservaciones(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargandoAccion}
                  className="px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {cargandoAccion ? "Guardando..." : "Registrar Observaciones"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: RADICAR SUBSANACIÓN */}
      {/* ========================================================================= */}
      {modalSubsanar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div role="dialog" aria-modal="true" aria-labelledby="f5-modal-subsanar-titulo" className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="p-5 bg-indigo-700 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <RotateCcw className="w-5 h-5 text-indigo-200" />
                <h3 id="f5-modal-subsanar-titulo" className="font-bold text-base">
                  Radicar Subsanación (Ronda #{modalSubsanar.numeroRonda})
                </h3>
              </div>
              <button
                type="button"
                aria-label="Cerrar modal de subsanación técnica"
                onClick={() => setModalSubsanar(null)}
                className="text-indigo-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarSubsanacion} className="p-5 space-y-4">
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                <span className="font-bold block mb-0.5">Observación a subsanar:</span>
                <p className="line-clamp-3 text-2xs leading-relaxed">{modalSubsanar.detalleObservaciones}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="f5-sub-num-rad" className="block text-xs font-bold text-slate-700 mb-1">
                    Número de Radicado de Subsanación *
                  </label>
                  <input
                    id="f5-sub-num-rad"
                    type="text"
                    required
                    value={formNumRadSub}
                    onChange={(e) => setFormNumRadSub(e.target.value)}
                    placeholder="Ej: SUB-2026-FOS-0112"
                    className="w-full text-xs font-mono font-bold px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="f5-sub-fecha" className="block text-xs font-bold text-slate-700 mb-1">
                    Fecha de Radicación *
                  </label>
                  <input
                    id="f5-sub-fecha"
                    type="date"
                    required
                    value={formFechaRadSub}
                    onChange={(e) => setFormFechaRadSub(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="f5-sub-detalle" className="block text-xs font-bold text-slate-700 mb-1">
                  Detalle de Respuesta / Ajustes Efectuados *
                </label>
                <textarea
                  id="f5-sub-detalle"
                  required
                  rows={3}
                  value={formDetalleSub}
                  onChange={(e) => setFormDetalleSub(e.target.value)}
                  placeholder="Explique las correcciones incorporadas (ej: planos corregidos con retiro de 6m y memorias técnicas actualizadas)."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="f5-sub-archivo" className="block text-xs font-bold text-slate-700 mb-1">
                  Soporte de Subsanación Radicada (PDF)
                </label>
                <input
                  id="f5-sub-archivo"
                  type="file"
                  accept=".pdf,application/pdf,image/*"
                  onClick={(e) => {
                    (e.target as HTMLInputElement).value = "";
                  }}
                  onChange={(e) => setArchivoSub(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalSubsanar(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargandoAccion}
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {cargandoAccion ? "Guardando..." : "Radicar Subsanación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: REGISTRAR LICENCIA APROBADA / EXPEDIDA */}
      {/* ========================================================================= */}
      {modalAprobar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div role="dialog" aria-modal="true" aria-labelledby="f5-modal-aprobar-titulo" className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="p-5 bg-emerald-700 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-200" />
                <h3 id="f5-modal-aprobar-titulo" className="font-bold text-base">Registrar Licencia de Construcción Aprobada</h3>
              </div>
              <button
                type="button"
                aria-label="Cerrar modal de aprobación de licencia"
                onClick={() => setModalAprobar(false)}
                className="text-emerald-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarAprobacion} className="p-5 space-y-4">
              <div>
                <label htmlFor="f5-aprob-resolucion" className="block text-xs font-bold text-slate-700 mb-1">
                  Número de Resolución / Licencia *
                </label>
                <input
                  id="f5-aprob-resolucion"
                  type="text"
                  required
                  value={formNumResolucion}
                  onChange={(e) => setFormNumResolucion(e.target.value)}
                  placeholder="Ej: RES-LC-2026-089"
                  className="w-full text-xs font-mono font-bold px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="f5-aprob-fecha-exp" className="block text-xs font-bold text-slate-700 mb-1">
                    Fecha de Expedición *
                  </label>
                  <input
                    id="f5-aprob-fecha-exp"
                    type="date"
                    required
                    value={formFechaExpedicion}
                    onChange={(e) => setFormFechaExpedicion(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="f5-aprob-fecha-ejec" className="block text-xs font-bold text-slate-700 mb-1">
                    Fecha de Ejecutoria
                  </label>
                  <input
                    id="f5-aprob-fecha-ejec"
                    type="date"
                    value={formFechaEjecutoria}
                    onChange={(e) => setFormFechaEjecutoria(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="f5-aprob-vigencia" className="block text-xs font-bold text-slate-700 mb-1">
                  Vigencia de la Licencia (Meses)
                </label>
                <input
                  id="f5-aprob-vigencia"
                  type="number"
                  min="6"
                  max="60"
                  value={formVigenciaMeses}
                  onChange={(e) => setFormVigenciaMeses(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label htmlFor="f5-aprob-archivos" className="block text-xs font-bold text-slate-700 mb-1">
                  Documentos Oficiales de la Licencia Expedida (Resolución, Planos Sellados, etc.) *
                </label>
                <div className="space-y-2">
                  <input
                    id="f5-aprob-archivos"
                    type="file"
                    multiple
                    accept=".pdf,application/pdf,image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        const nuevos = Array.from(e.target.files);
                        setArchivosAprobar((prev) => [...prev, ...nuevos]);
                        e.target.value = "";
                      }
                    }}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-800 hover:file:bg-emerald-100 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-500">
                    Puede seleccionar varios archivos a la vez o agregarlos uno a uno (Resolución, Planos Sellados, Acta de Ejecutoria).
                  </p>

                  {/* Lista de archivos seleccionados */}
                  {archivosAprobar.length > 0 && (
                    <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5">
                      <div className="text-[11px] font-bold text-emerald-900">
                        Documentos seleccionados ({archivosAprobar.length}):
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                        {archivosAprobar.map((f, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-1.5 bg-white rounded-lg border border-emerald-100 text-xs text-slate-800"
                          >
                            <span className="truncate max-w-[280px]" title={f.name}>
                              {f.name}
                            </span>
                            <div className="flex items-center space-x-2 shrink-0">
                              <span className="text-[10px] text-slate-400">
                                {(f.size / 1024).toFixed(1)} KB
                              </span>
                              <button
                                type="button"
                                aria-label={`Eliminar archivo ${f.name}`}
                                onClick={() => setArchivosAprobar((prev) => prev.filter((_, i) => i !== idx))}
                                className="text-rose-600 hover:text-rose-800 font-bold p-0.5 rounded cursor-pointer"
                                title="Eliminar archivo"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Archivos previos si existieran */}
                  {archivosAprobar.length === 0 && (tramite.soporteLicenciaAprobadaDocs || tramite.soporteLicenciaAprobada) && (
                    <div className="text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                      Archivos cargados previamente:{" "}
                      {(tramite.soporteLicenciaAprobadaDocs?.map((d) => d.nombreArchivo).join(", ")) ||
                        tramite.soporteLicenciaAprobada?.nombreArchivo}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="f5-aprob-obs" className="block text-xs font-bold text-slate-700 mb-1">
                  Observaciones Finales / Condiciones Urbanísticas
                </label>
                <textarea
                  id="f5-aprob-obs"
                  rows={2}
                  value={formObsFinales}
                  onChange={(e) => setFormObsFinales(e.target.value)}
                  placeholder="Modalidad de obra nueva, área autorizada m², compromisos adicionales de cesión o retiros."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalAprobar(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargandoAccion}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {cargandoAccion ? "Guardando..." : "Confirmar Aprobación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: REGISTRAR NOVEDAD EN HISTORIAL */}
      {/* ========================================================================= */}
      {modalNota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div role="dialog" aria-modal="true" aria-labelledby="f5-modal-nota-titulo" className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Plus className="w-5 h-5 text-blue-400" />
                <h3 id="f5-modal-nota-titulo" className="font-bold text-base">Registrar Novedad de Trámite</h3>
              </div>
              <button
                type="button"
                aria-label="Cerrar modal de registro de nota"
                onClick={() => setModalNota(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarNota} className="p-5 space-y-4">
              <div>
                <label htmlFor="f5-nota-titulo" className="block text-xs font-bold text-slate-700 mb-1">
                  Título de la Novedad *
                </label>
                <input
                  id="f5-nota-titulo"
                  type="text"
                  required
                  value={formTituloNota}
                  onChange={(e) => setFormTituloNota(e.target.value)}
                  placeholder="Ej: Llamada de seguimiento con el arquitecto revisor"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="f5-nota-desc" className="block text-xs font-bold text-slate-700 mb-1">
                  Descripción Detallada *
                </label>
                <textarea
                  id="f5-nota-desc"
                  required
                  rows={4}
                  value={formDescNota}
                  onChange={(e) => setFormDescNota(e.target.value)}
                  placeholder="Describa el compromiso, llamada o avance en la curaduría / planeación."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNota(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargandoAccion}
                  className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {cargandoAccion ? "Guardando..." : "Guardar Novedad"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
