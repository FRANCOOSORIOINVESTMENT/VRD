import React, { useState, useEffect } from "react";
import {
  Expediente,
  RequisitoCaso,
  PerfilUsuario,
  GestionFase4,
  FrenteInterventoria,
  FrenteArquitectura,
  FrenteEstudioSuelos,
  EstadoFrenteFase4,
  SoporteFrenteFase4,
  RegistroHistorialFrenteFase4
} from "../types";
import {
  HardHat,
  Layers,
  Mountain,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  UploadCloud,
  Eye,
  Plus,
  ArrowRight,
  ShieldCheck,
  Calendar,
  User,
  History,
  Check,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Percent,
  Sliders,
  Sparkles,
  Info,
  Lock
} from "lucide-react";

interface Fase4GestionTecnicaProps {
  expediente: Expediente;
  requisitoPresupuesto?: RequisitoCaso;
  currentUser: PerfilUsuario;
  onAbrirVisor: (data: {
    titulo: string;
    nombreArchivo: string;
    mimeType: string;
    sha256Hash: string;
    tamanoBytes: number;
    subidoPor?: string;
    subidoEn?: string;
    archivoDataUrl?: string;
    fotos?: any[];
    fotoInicialIndex?: number;
  }) => void;
  onSubirDocPresupuesto?: (reqId: string) => void;
  onRevisarDocPresupuesto?: (req: RequisitoCaso) => void;
  onActualizarExpediente: () => Promise<void>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export const Fase4GestionTecnica: React.FC<Fase4GestionTecnicaProps> = ({
  expediente,
  requisitoPresupuesto,
  currentUser,
  onAbrirVisor,
  onSubirDocPresupuesto,
  onRevisarDocPresupuesto,
  onActualizarExpediente,
  authFetch
}) => {
  const gestion = expediente.gestionFase4;

  // Estado de bloqueo si el expediente ya avanzó a Fase 5 o superior
  const yaAvanzoFase5 = (expediente.faseActual || 1) >= 5;

  // Permisos: Ingeniería y Administrador gestionan frentes; Supervisor también puede revisar y avanzar
  const puedeEditarFrentes =
    !yaAvanzoFase5 &&
    (currentUser.rol === "ingenieria" ||
    currentUser.rol === "administrador" ||
    currentUser.rol === "supervisor");

  const puedeAvanzarFase5 =
    currentUser.rol === "supervisor" ||
    currentUser.rol === "administrador" ||
    currentUser.rol === "ingenieria";

  // Estados de los frentes (con valores por defecto si aún no existen en DB)
  const intData: FrenteInterventoria = gestion?.interventoria || {
    estado: "pendiente",
    historial: []
  };

  const arqData: FrenteArquitectura = gestion?.arquitectura || {
    estado: "pendiente",
    porcentajeAvance: 0,
    historial: []
  };

  const sueData: FrenteEstudioSuelos = gestion?.estudioSuelos || {
    estado: "pendiente",
    historial: []
  };

  // Verificación de los 3 frentes técnicos obligatorios para avanzar a Fase 5
  const intCumplido = intData.estado === "completado" && !!intData.soporte?.nombreArchivo;
  const arqCumplido = arqData.estado === "completado" && !!arqData.soporte?.nombreArchivo;
  const sueCumplido = sueData.estado === "completado" && !!sueData.soporte?.nombreArchivo;

  const itemsCompletados = [intCumplido, arqCumplido, sueCumplido].filter(Boolean).length;
  // CAMBIO 7: Sincronización escalonada del progreso: 1 = 33%, 2 = 67%, 3 = 100%
  const porcentajeProgreso = itemsCompletados === 1 ? 33 : itemsCompletados === 2 ? 67 : itemsCompletados === 3 ? 100 : 0;
  const todosCumplidos = itemsCompletados === 3;

  // Estados locales para modales de edición de frente
  const [frenteEditar, setFrenteEditar] = useState<"interventoria" | "arquitectura" | "estudioSuelos" | null>(null);
  const [formEstado, setFormEstado] = useState<EstadoFrenteFase4>("pendiente");
  const [formFechaSolicitud, setFormFechaSolicitud] = useState<string>("");
  const [formFechaEstimada, setFormFechaEstimada] = useState<string>(""); // CAMBIO 4
  const [formFechaVisita, setFormFechaVisita] = useState<string>("");
  const [formResultadoConcepto, setFormResultadoConcepto] = useState<string>("");
  const [formPorcentajeAvance, setFormPorcentajeAvance] = useState<number>(0);
  const [formFechaEntregaEstimada, setFormFechaEntregaEstimada] = useState<string>("");
  const [formFechaEntregaReal, setFormFechaEntregaReal] = useState<string>("");
  const [formFechaRealizacion, setFormFechaRealizacion] = useState<string>("");
  const [formObservaciones, setFormObservaciones] = useState<string>("");
  const [formNotaHistorial, setFormNotaHistorial] = useState<string>("");
  const [formSoporteNombre, setFormSoporteNombre] = useState<string>("");
  const [formSoporteUrl, setFormSoporteUrl] = useState<string>("");
  const [formSoporteHash, setFormSoporteHash] = useState<string>("");
  const [guardandoFrente, setGuardandoFrente] = useState<boolean>(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  // Modal para agregar nota rápida a bitácora
  const [frenteNota, setFrenteNota] = useState<"interventoria" | "arquitectura" | "estudioSuelos" | null>(null);
  const [textoNotaRapida, setTextoNotaRapida] = useState<string>("");
  const [guardandoNota, setGuardandoNota] = useState<boolean>(false);

  // Modal de confirmación para avanzar a Fase 5
  const [modalConfirmarAvanzarF5, setModalConfirmarAvanzarF5] = useState<boolean>(false);
  const [avanzandoFase5, setAvanzandoFase5] = useState<boolean>(false);
  const [errorAvanzar, setErrorAvanzar] = useState<string | null>(null);

  // Escape key handler for modal
  useEffect(() => {
    if (!frenteEditar) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setFrenteEditar(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [frenteEditar]);

  // Abrir modal de edición con datos precargados
  const abrirModalEditar = (frente: "interventoria" | "arquitectura" | "estudioSuelos") => {
    setErrorModal(null);
    setFrenteEditar(frente);

    if (frente === "interventoria") {
      setFormEstado(intData.estado);
      setFormFechaSolicitud(intData.fechaSolicitud || "");
      setFormFechaEstimada(intData.fechaEstimada || ""); // CAMBIO 4
      setFormFechaVisita(intData.fechaVisitaRealizada || "");
      setFormResultadoConcepto(intData.resultadoConcepto || "");
      setFormObservaciones(intData.observaciones || "");
      setFormSoporteNombre(intData.soporte?.nombreArchivo || "");
      setFormSoporteUrl(intData.soporte?.url || "");
      setFormSoporteHash(intData.soporte?.sha256 || "");
      setFormNotaHistorial("");
    } else if (frente === "arquitectura") {
      setFormEstado(arqData.estado);
      setFormFechaSolicitud(arqData.fechaSolicitud || "");
      setFormPorcentajeAvance(arqData.porcentajeAvance || 0);
      setFormFechaEntregaEstimada(arqData.fechaEntregaEstimada || "");
      setFormFechaEntregaReal(arqData.fechaEntregaReal || "");
      setFormObservaciones(arqData.observaciones || "");
      setFormSoporteNombre(arqData.soporte?.nombreArchivo || "");
      setFormSoporteUrl(arqData.soporte?.url || "");
      setFormSoporteHash(arqData.soporte?.sha256 || "");
      setFormNotaHistorial("");
    } else if (frente === "estudioSuelos") {
      setFormEstado(sueData.estado);
      setFormFechaSolicitud(sueData.fechaSolicitud || "");
      setFormFechaRealizacion(sueData.fechaRealizacion || "");
      setFormFechaEntregaEstimada(sueData.fechaEntregaEstimada || "");
      setFormFechaEntregaReal(sueData.fechaEntregaReal || "");
      setFormObservaciones(sueData.observaciones || "");
      setFormSoporteNombre(sueData.soporte?.nombreArchivo || "");
      setFormSoporteUrl(sueData.soporte?.url || "");
      setFormSoporteHash(sueData.soporte?.sha256 || "");
      setFormNotaHistorial("");
    }
  };

  // Manejar carga simulada de archivo de soporte
  const handleSimularCargaArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // CAMBIO 9: Validar exclusivamente formato PDF para Planos de Arquitectura
    if (frenteEditar === "arquitectura") {
      const esPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!esPdf) {
        setErrorModal("Formato no válido. Solo se permiten documentos en formato PDF.");
        if (e.target) e.target.value = "";
        return;
      }
    }

    setErrorModal(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setFormSoporteNombre(file.name);
      setFormSoporteUrl(dataUrl);
      setFormSoporteHash(`sha256-${Date.now().toString(16)}-${Math.random().toString(16).substring(2, 8)}`);
    };
    reader.readAsDataURL(file);
  };

  // Guardar cambios del frente
  const handleGuardarFrente = async () => {
    if (!frenteEditar) return;
    setErrorModal(null);

    // VALIDACIONES EXIGIDAS EN CAMBIOS 1, 4, 5, 6
    if (formEstado === "completado") {
      // 1. Debe contar con archivo de soporte obligatorio
      if (!formSoporteNombre) {
        setErrorModal("Debe cargar el informe de soporte antes de completar este frente.");
        return;
      }

      // 2. Fechas obligatorias por cada frente
      if (frenteEditar === "interventoria") {
        if (!formFechaSolicitud || !formFechaEstimada || !formFechaVisita) {
          setErrorModal("Debe especificar las fechas de solicitud, fecha estimada y visita realizada para completar este frente.");
          return;
        }
      } else if (frenteEditar === "arquitectura") {
        if (!formFechaSolicitud || !formFechaEntregaEstimada || !formFechaEntregaReal) {
          setErrorModal("Debe especificar las fechas de solicitud, entrega estimada y entrega real para completar este frente.");
          return;
        }
      } else if (frenteEditar === "estudioSuelos") {
        const fInf = formFechaEntregaReal || formFechaEntregaEstimada;
        if (!formFechaSolicitud || !formFechaRealizacion || !fInf) {
          setErrorModal("Debe especificar las fechas de solicitud, sondeos en campo y entrega del informe para completar este frente.");
          return;
        }
      }
    }

    setGuardandoFrente(true);

    try {
      const payload: any = {
        estado: formEstado,
        observaciones: formObservaciones,
        observacionHistorial: formNotaHistorial || undefined
      };

      if (frenteEditar === "interventoria") {
        payload.fechaSolicitud = formFechaSolicitud || undefined;
        payload.fechaEstimada = formFechaEstimada || undefined; // CAMBIO 4
        payload.fechaVisitaRealizada = formFechaVisita || undefined;
        payload.resultadoConcepto = formResultadoConcepto || undefined;
      } else if (frenteEditar === "arquitectura") {
        payload.fechaSolicitud = formFechaSolicitud || undefined;
        payload.porcentajeAvance = formEstado === "completado" ? 100 : formPorcentajeAvance;
        payload.fechaEntregaEstimada = formFechaEntregaEstimada || undefined;
        payload.fechaEntregaReal = formFechaEntregaReal || undefined;
      } else if (frenteEditar === "estudioSuelos") {
        payload.fechaSolicitud = formFechaSolicitud || undefined;
        payload.fechaRealizacion = formFechaRealizacion || undefined;
        payload.fechaEntregaEstimada = formFechaEntregaEstimada || undefined;
        payload.fechaEntregaReal = formFechaEntregaReal || undefined;
      }

      if (formSoporteNombre) {
        payload.soporte = {
          nombreArchivo: formSoporteNombre,
          url: formSoporteUrl || "https://example.com/documento.pdf",
          sha256: formSoporteHash || `sha256-${Date.now().toString(16)}`,
          tamanoBytes: 524288,
          subidoPor: currentUser.nombreCompleto,
          subidoEn: new Date().toISOString()
        };
      }

      const res = await authFetch(`/api/expedientes/${expediente.id}/fase4/frente/${frenteEditar}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo actualizar el frente técnico.");
      }

      await onActualizarExpediente();
      setFrenteEditar(null);
    } catch (err: any) {
      setErrorModal(err.message || "Error al actualizar.");
    } finally {
      setGuardandoFrente(false);
    }
  };

  // Guardar nota rápida en bitácora
  const handleGuardarNotaRapida = async () => {
    if (!frenteNota || !textoNotaRapida.trim()) return;
    setGuardandoNota(true);
    try {
      const res = await authFetch(`/api/expedientes/${expediente.id}/fase4/frente/${frenteNota}/historial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          observaciones: textoNotaRapida.trim(),
          accion: "Nota de seguimiento de Ingeniería"
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo agregar la nota.");
      }

      await onActualizarExpediente();
      setFrenteNota(null);
      setTextoNotaRapida("");
    } catch (err: any) {
      alert(err.message || "Error al registrar nota.");
    } finally {
      setGuardandoNota(false);
    }
  };

  // Avanzar a Fase 5
  const handleEjecutarAvanzarFase5 = async () => {
    setAvanzandoFase5(true);
    setErrorAvanzar(null);

    try {
      const res = await authFetch(`/api/expedientes/${expediente.id}/avanzar-fase-5`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo avanzar a Fase 5.");
      }

      await onActualizarExpediente();
      setModalConfirmarAvanzarF5(false);
    } catch (err: any) {
      setErrorAvanzar(err.message || "Error al avanzar a Fase 5.");
    } finally {
      setAvanzandoFase5(false);
    }
  };

  // Helper visual para estado de frente
  const badgeEstado = (estado: EstadoFrenteFase4) => {
    switch (estado) {
      case "completado":
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Completado</span>
          </span>
        );
      case "en_gestion":
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            <Clock className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
            <span>En Gestión</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>Pendiente</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6" id="fase4-gestion-tecnica-root">
      {/* BANNER INFORMATIVO: FASE 4 CULMINADA (MODO SOLO LECTURA) */}
      {yaAvanzoFase5 && (
        <div className="p-4 bg-slate-50 border border-slate-300 rounded-2xl text-slate-800 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2.5">
            <Lock className="w-5 h-5 text-slate-600 shrink-0" />
            <div>
              <strong className="block font-bold text-slate-900 text-sm">Fase 4 Culminada (Modo Solo Lectura)</strong>
              <span className="text-slate-600">
                Los 3 frentes técnicos fueron validados y el expediente avanzó a Fase {expediente.faseActual}. La información técnica y soportes se conservan para fines de auditoría y consulta.
              </span>
            </div>
          </div>
          <span className="px-3 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg shrink-0">
            Fase {expediente.faseActual} Activa
          </span>
        </div>
      )}

      {/* 1. ENCABEZADO DE FASE Y RESUMEN GENERAL DE PROGRESO */}
      <div className="p-5 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 bg-blue-500/30 text-blue-200 border border-blue-400/40 rounded-full text-xs font-bold font-mono uppercase tracking-wider">
                Fase 4 • Ingeniería
              </span>
              <span className="text-xs text-indigo-200 font-medium">
                Gestión simultánea con terceros externos
              </span>
            </div>
            <h3 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Recolección de Documentos Técnicos</span>
            </h3>
            <p className="text-xs text-indigo-100/80 max-w-2xl leading-relaxed">
              Supervisión de los 3 frentes técnicos en paralelo (Interventoría externa, Taller de Arquitectura y Laboratorio de Suelos). El Presupuesto Oficial APU se gestiona de manera oficial en la Fase 5.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Responsable de la fase */}
            <div className="px-3 py-2 bg-white/10 rounded-xl border border-white/10 text-xs backdrop-blur-xs flex items-center space-x-2">
              <User className="w-4 h-4 text-blue-300" />
              <div>
                <div className="text-[10px] text-blue-200 uppercase font-semibold">Responsable</div>
                <div className="font-bold text-white">Área de Ingeniería</div>
              </div>
            </div>

            {/* Botón Avanzar a Fase 5 */}
            {puedeAvanzarFase5 && (
              yaAvanzoFase5 ? (
                <button
                  type="button"
                  id="btn-avanzar-fase-5"
                  disabled={true}
                  className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs bg-slate-700/60 text-slate-400 border border-slate-600/50 cursor-not-allowed"
                  title="El expediente ya culminó la Fase 4 y se encuentra en Fase 5 o superior"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Fase 4 Culminada (Avanzado a Fase 5)</span>
                </button>
              ) : (
                <button
                  type="button"
                  id="btn-avanzar-fase-5"
                  disabled={!todosCumplidos}
                  onClick={() => setModalConfirmarAvanzarF5(true)}
                  title={
                    todosCumplidos
                      ? "Los 3 frentes técnicos están listos para avanzar a Fase 5"
                      : `Faltan ${3 - itemsCompletados} frente(s) técnico(s) por completar`
                  }
                  className={`inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
                    todosCumplidos
                      ? "bg-emerald-500 hover:bg-emerald-600 text-white ring-2 ring-emerald-300 ring-offset-2 ring-offset-slate-900"
                      : "bg-slate-700/60 text-slate-400 border border-slate-600/50 cursor-not-allowed"
                  }`}
                >
                  <span>Avanzar a Fase 5</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )
            )}
          </div>
        </div>

        {/* Barra de progreso global de los 3 frentes técnicos */}
        <div className="mt-5 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-medium text-indigo-200">
              Cumplimiento de Fase:{" "}
              <strong className={`font-bold ${todosCumplidos ? "text-emerald-300" : "text-white"}`}>
                {todosCumplidos ? "Frentes Técnicos Completados" : `${itemsCompletados} de 3 frentes completados`}
              </strong>{" "}
              ({porcentajeProgreso}%)
            </span>
            <span className="text-[11px] text-indigo-300 font-mono">
              {todosCumplidos ? "✓ Frentes Técnicos Completados" : "En proceso de gestión simultánea"}
            </span>
          </div>

          <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                todosCumplidos ? "bg-emerald-400" : "bg-gradient-to-r from-blue-400 to-indigo-300"
              }`}
              style={{ width: `${porcentajeProgreso}%` }}
            />
          </div>

          {/* Pastillas de estado de los 3 componentes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-[11px]">
            <div className={`p-2 rounded-lg flex items-center space-x-2 ${intCumplido ? "bg-emerald-950/60 border border-emerald-600/40 text-emerald-200" : "bg-white/5 border border-white/10 text-slate-300"}`}>
              {intCumplido ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clock className="w-3.5 h-3.5 text-slate-400" />}
              <span className="truncate">1. Interventoría</span>
            </div>

            <div className={`p-2 rounded-lg flex items-center space-x-2 ${arqCumplido ? "bg-emerald-950/60 border border-emerald-600/40 text-emerald-200" : "bg-white/5 border border-white/10 text-slate-300"}`}>
              {arqCumplido ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clock className="w-3.5 h-3.5 text-slate-400" />}
              <span className="truncate">2. Arquitectura</span>
            </div>

            <div className={`p-2 rounded-lg flex items-center space-x-2 ${sueCumplido ? "bg-emerald-950/60 border border-emerald-600/40 text-emerald-200" : "bg-white/5 border border-white/10 text-slate-300"}`}>
              {sueCumplido ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clock className="w-3.5 h-3.5 text-slate-400" />}
              <span className="truncate">3. Estudio de Suelos</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. LOS 3 FRENTES DE TRABAJO EN PARALELO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* =========================================================
            FRENTE 1: VISITA DE INTERVENTORÍA
        ========================================================= */}
        <div
          id="card-frente-interventoria"
          className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden"
        >
          <div>
            {/* Cabecera del Frente */}
            <div className="p-4 bg-slate-50/80 border-b border-slate-200/70 flex items-start justify-between gap-2">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
                  <HardHat className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 font-mono">Frente 1</div>
                  <h4 className="text-sm font-bold text-slate-900">Visita de Interventoría</h4>
                </div>
              </div>
              {badgeEstado(intData.estado)}
            </div>

            {/* Contenido y Datos Técnicos */}
            <div className="p-4 space-y-3.5 text-xs text-slate-700">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Coordinación con la interventoría externa delegada para inspección de campo y emisión de concepto técnico sobre el predio.
              </p>

              {/* CAMBIO 4: Orden cronológico estricto: 1. Fecha Solicitud, 2. Fecha Estimada, 3. Visita Realizada */}
              <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Fecha Solicitud:
                  </span>
                  <span className="font-mono font-medium text-slate-800">
                    {intData.fechaSolicitud || "No registrada"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                    Fecha Estimada:
                  </span>
                  <span className="font-mono font-medium text-slate-800">
                    {intData.fechaEstimada || "Pendiente agendamiento"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Visita Realizada:
                  </span>
                  <span className="font-mono font-semibold text-slate-900">
                    {intData.fechaVisitaRealizada || "Pendiente realización"}
                  </span>
                </div>

                <div className="pt-1.5 border-t border-slate-200/60">
                  <span className="text-[11px] text-slate-500 block mb-0.5">Resultado / Concepto:</span>
                  <p className="font-medium text-slate-800 italic bg-white p-2 rounded border border-slate-200/80 text-[11px]">
                    {intData.resultadoConcepto || "En espera de visita técnica."}
                  </p>
                </div>

                {intData.observaciones && (
                  <div className="text-[11px] text-slate-600 pt-1">
                    <span className="font-semibold text-slate-700">Observaciones:</span> {intData.observaciones}
                  </div>
                )}
              </div>

              {/* Documento de Soporte */}
              <div className="pt-1">
                <div className="text-[11px] font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                  <span>Soporte Técnico de Visita:</span>
                  {intData.soporte ? (
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Adjunto
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-600 font-semibold">Pendiente archivo</span>
                  )}
                </div>

                {intData.soporte ? (
                  <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center space-x-2 truncate">
                      <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="truncate">
                        <div className="font-mono text-xs font-semibold text-emerald-950 truncate" title={intData.soporte.nombreArchivo}>
                          {intData.soporte.nombreArchivo}
                        </div>
                        <div className="text-[10px] text-emerald-700">
                          {intData.soporte.subidoPor} • {intData.soporte.subidoEn?.split("T")[0]}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onAbrirVisor({
                          titulo: "Soporte de Visita de Interventoría",
                          nombreArchivo: intData.soporte!.nombreArchivo,
                          mimeType: "application/pdf",
                          sha256Hash: intData.soporte!.sha256 || "sha256-interventoria",
                          tamanoBytes: intData.soporte!.tamanoBytes || 450000,
                          subidoPor: intData.soporte!.subidoPor,
                          subidoEn: intData.soporte!.subidoEn,
                          archivoDataUrl: intData.soporte!.url
                        })
                      }
                      className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
                      title="Ver en Visor Interno"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center text-slate-500 text-xs">
                    Sin certificado de visita cargado
                  </div>
                )}
              </div>

              {/* Bitácora / Historial Reciente */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <History className="w-3.5 h-3.5 text-slate-400" />
                    Bitácora ({intData.historial?.length || 0})
                  </span>
                  {puedeEditarFrentes && (
                    <button
                      type="button"
                      onClick={() => {
                        setFrenteNota("interventoria");
                        setTextoNotaRapida("");
                      }}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                    >
                      + Nota
                    </button>
                  )}
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 text-[11px]">
                  {(!intData.historial || intData.historial.length === 0) && (
                    <div className="text-slate-400 italic text-center py-2">Sin registros en bitácora</div>
                  )}
                  {intData.historial?.map((h) => (
                    <div key={h.id} className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-slate-600">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                        <span className="font-semibold text-slate-700">{h.usuarioNombre}</span>
                        <span>{h.fecha?.split("T")[0]}</span>
                      </div>
                      <div className="font-medium text-slate-800">{h.accion}</div>
                      {h.observaciones && <p className="text-slate-500 mt-0.5">{h.observaciones}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Botón de acción */}
          {puedeEditarFrentes && (
            <div className="p-3 bg-slate-50/80 border-t border-slate-200/70 flex justify-end">
              <button
                type="button"
                onClick={() => abrirModalEditar("interventoria")}
                className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Gestionar Interventoría</span>
              </button>
            </div>
          )}
        </div>

        {/* =========================================================
            FRENTE 2: PLANOS DE ARQUITECTURA PARA LICENCIA
        ========================================================= */}
        <div
          id="card-frente-arquitectura"
          className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden"
        >
          <div>
            {/* Cabecera del Frente */}
            <div className="p-4 bg-slate-50/80 border-b border-slate-200/70 flex items-start justify-between gap-2">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-100 text-indigo-800 rounded-xl">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 font-mono">Frente 2</div>
                  <h4 className="text-sm font-bold text-slate-900">Planos de Arquitectura</h4>
                </div>
              </div>
              {badgeEstado(arqData.estado)}
            </div>

            {/* Contenido y Datos Técnicos */}
            <div className="p-4 space-y-3.5 text-xs text-slate-700">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Elaboración y adecuación de los planos arquitectónicos VRD con cumplimiento de norma urbanística para radicación de licencia.
              </p>

              {/* Estado del Entregable de Arquitectura (Cambio 8) */}
              <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-950">Estado del Entregable:</span>
                <span className="font-semibold text-xs text-indigo-800">
                  {arqData.estado === "completado"
                    ? "✓ Planos Completados"
                    : arqData.estado === "en_gestion"
                    ? "En Modelado y Diseño"
                    : "Pendiente de Inicio"}
                </span>
              </div>

              <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Fecha Solicitud:
                  </span>
                  <span className="font-mono font-medium text-slate-800">
                    {arqData.fechaSolicitud || "No registrada"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Entrega Estimada:
                  </span>
                  <span className="font-mono text-slate-800">
                    {arqData.fechaEntregaEstimada || "Pendiente"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Entrega Real:
                  </span>
                  <span className="font-mono font-semibold text-slate-900">
                    {arqData.fechaEntregaReal || "En desarrollo"}
                  </span>
                </div>

                {arqData.observaciones && (
                  <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                    <span className="font-semibold text-slate-700">Observaciones:</span> {arqData.observaciones}
                  </div>
                )}
              </div>

              {/* Documento de Soporte (Planos) */}
              <div className="pt-1">
                <div className="text-[11px] font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                  <span>Juego de Planos para Licencia:</span>
                  {arqData.soporte ? (
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Adjunto
                    </span>
                  ) : (
                    <span className="text-[10px] text-indigo-600 font-semibold">Pendiente planos</span>
                  )}
                </div>

                {arqData.soporte ? (
                  <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center space-x-2 truncate">
                      <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div className="truncate">
                        <div className="font-mono text-xs font-semibold text-indigo-950 truncate" title={arqData.soporte.nombreArchivo}>
                          {arqData.soporte.nombreArchivo}
                        </div>
                        <div className="text-[10px] text-indigo-700">
                          {arqData.soporte.subidoPor} • {arqData.soporte.subidoEn?.split("T")[0]}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onAbrirVisor({
                          titulo: "Planos Arquitectónicos para Licencia",
                          nombreArchivo: arqData.soporte!.nombreArchivo,
                          mimeType: "application/pdf",
                          sha256Hash: arqData.soporte!.sha256 || "sha256-arquitectura",
                          tamanoBytes: arqData.soporte!.tamanoBytes || 1250000,
                          subidoPor: arqData.soporte!.subidoPor,
                          subidoEn: arqData.soporte!.subidoEn,
                          archivoDataUrl: arqData.soporte!.url
                        })
                      }
                      className="p-1.5 text-indigo-700 hover:text-indigo-900 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
                      title="Ver Planos en Visor Interno"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center text-slate-500 text-xs">
                    Sin archivo de planos arquitectónicos cargado
                  </div>
                )}
              </div>

              {/* Bitácora / Historial Reciente */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <History className="w-3.5 h-3.5 text-slate-400" />
                    Bitácora ({arqData.historial?.length || 0})
                  </span>
                  {puedeEditarFrentes && (
                    <button
                      type="button"
                      onClick={() => {
                        setFrenteNota("arquitectura");
                        setTextoNotaRapida("");
                      }}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                    >
                      + Nota
                    </button>
                  )}
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 text-[11px]">
                  {(!arqData.historial || arqData.historial.length === 0) && (
                    <div className="text-slate-400 italic text-center py-2">Sin registros en bitácora</div>
                  )}
                  {arqData.historial?.map((h) => (
                    <div key={h.id} className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-slate-600">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                        <span className="font-semibold text-slate-700">{h.usuarioNombre}</span>
                        <span>{h.fecha?.split("T")[0]}</span>
                      </div>
                      <div className="font-medium text-slate-800">{h.accion}</div>
                      {h.observaciones && <p className="text-slate-500 mt-0.5">{h.observaciones}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Botón de acción */}
          {puedeEditarFrentes && (
            <div className="p-3 bg-slate-50/80 border-t border-slate-200/70 flex justify-end">
              <button
                type="button"
                onClick={() => abrirModalEditar("arquitectura")}
                className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Gestionar Arquitectura</span>
              </button>
            </div>
          )}
        </div>

        {/* =========================================================
            FRENTE 3: ESTUDIO DE SUELOS
        ========================================================= */}
        <div
          id="card-frente-estudio-suelos"
          className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden"
        >
          <div>
            {/* Cabecera del Frente */}
            <div className="p-4 bg-slate-50/80 border-b border-slate-200/70 flex items-start justify-between gap-2">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Mountain className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 font-mono">Frente 3</div>
                  <h4 className="text-sm font-bold text-slate-900">Estudio de Suelos</h4>
                </div>
              </div>
              {badgeEstado(sueData.estado)}
            </div>

            {/* Contenido y Datos Técnicos */}
            <div className="p-4 space-y-3.5 text-xs text-slate-700">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Contratación de sondeos geotécnicos, análisis estratigráfico y cálculo de capacidad portante conforme a norma NSR-10.
              </p>

              <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Fecha Solicitud:
                  </span>
                  <span className="font-mono font-medium text-slate-800">
                    {sueData.fechaSolicitud || "No registrada"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Sondeos en Campo:
                  </span>
                  <span className="font-mono text-slate-800">
                    {sueData.fechaRealizacion || "Pendiente ejecución"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Entrega Informe:
                  </span>
                  <span className="font-mono font-semibold text-slate-900">
                    {sueData.fechaEntregaReal || sueData.fechaEntregaEstimada || "En proceso de laboratorio"}
                  </span>
                </div>

                {sueData.observaciones && (
                  <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                    <span className="font-semibold text-slate-700">Dictamen Geotécnico:</span> {sueData.observaciones}
                  </div>
                )}
              </div>

              {/* Documento de Soporte (Informe de Suelos) */}
              <div className="pt-1">
                <div className="text-[11px] font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                  <span>Informe Geotécnico NSR-10:</span>
                  {sueData.soporte ? (
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Adjunto
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-700 font-semibold">Pendiente informe</span>
                  )}
                </div>

                {sueData.soporte ? (
                  <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center space-x-2 truncate">
                      <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="truncate">
                        <div className="font-mono text-xs font-semibold text-emerald-950 truncate" title={sueData.soporte.nombreArchivo}>
                          {sueData.soporte.nombreArchivo}
                        </div>
                        <div className="text-[10px] text-emerald-700">
                          {sueData.soporte.subidoPor} • {sueData.soporte.subidoEn?.split("T")[0]}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onAbrirVisor({
                          titulo: "Informe de Estudio de Suelos (NSR-10)",
                          nombreArchivo: sueData.soporte!.nombreArchivo,
                          mimeType: "application/pdf",
                          sha256Hash: sueData.soporte!.sha256 || "sha256-suelos",
                          tamanoBytes: sueData.soporte!.tamanoBytes || 2150000,
                          subidoPor: sueData.soporte!.subidoPor,
                          subidoEn: sueData.soporte!.subidoEn,
                          archivoDataUrl: sueData.soporte!.url
                        })
                      }
                      className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
                      title="Ver Informe en Visor Interno"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center text-slate-500 text-xs">
                    Sin informe de estudio de suelos cargado
                  </div>
                )}
              </div>

              {/* Bitácora / Historial Reciente */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <History className="w-3.5 h-3.5 text-slate-400" />
                    Bitácora ({sueData.historial?.length || 0})
                  </span>
                  {puedeEditarFrentes && (
                    <button
                      type="button"
                      onClick={() => {
                        setFrenteNota("estudioSuelos");
                        setTextoNotaRapida("");
                      }}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                    >
                      + Nota
                    </button>
                  )}
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 text-[11px]">
                  {(!sueData.historial || sueData.historial.length === 0) && (
                    <div className="text-slate-400 italic text-center py-2">Sin registros en bitácora</div>
                  )}
                  {sueData.historial?.map((h) => (
                    <div key={h.id} className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-slate-600">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                        <span className="font-semibold text-slate-700">{h.usuarioNombre}</span>
                        <span>{h.fecha?.split("T")[0]}</span>
                      </div>
                      <div className="font-medium text-slate-800">{h.accion}</div>
                      {h.observaciones && <p className="text-slate-500 mt-0.5">{h.observaciones}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Botón de acción */}
          {puedeEditarFrentes && (
            <div className="p-3 bg-slate-50/80 border-t border-slate-200/70 flex justify-end">
              <button
                type="button"
                onClick={() => abrirModalEditar("estudioSuelos")}
                className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Gestionar Estudio de Suelos</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. MODAL PARA EDITAR GESTIÓN DEL FRENTE TÉCNICO */}
      {frenteEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div role="dialog" aria-modal="true" aria-labelledby="fase4-modal-frente-titulo" className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center space-x-2.5">
                <Sliders className="w-5 h-5 text-blue-600" />
                <h3 id="fase4-modal-frente-titulo" className="font-bold text-base text-slate-900">
                  {frenteEditar === "interventoria" && "Gestionar Frente 1: Visita de Interventoría"}
                  {frenteEditar === "arquitectura" && "Gestionar Frente 2: Planos de Arquitectura"}
                  {frenteEditar === "estudioSuelos" && "Gestionar Frente 3: Estudio de Suelos"}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Cerrar modal de gestión del frente técnico"
                onClick={() => setFrenteEditar(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700">
              {errorModal && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorModal}</span>
                </div>
              )}

              {/* Selector de Estado */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">Estado de la Gestión:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormEstado("pendiente")}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                      formEstado === "pendiente"
                        ? "bg-slate-800 text-white border-slate-800 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    Pendiente
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormEstado("en_gestion")}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                      formEstado === "en_gestion"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100"
                    }`}
                  >
                    En Gestión
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormEstado("completado");
                      if (frenteEditar === "arquitectura") setFormPorcentajeAvance(100);
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                      formEstado === "completado"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                    }`}
                  >
                    Completado
                  </button>
                </div>
              </div>

              {/* Campos específicos según el frente */}
              {frenteEditar === "interventoria" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">1. Fecha de Solicitud:</label>
                      <input
                        type="date"
                        value={formFechaSolicitud}
                        onChange={(e) => setFormFechaSolicitud(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">2. Fecha Estimada:</label>
                      <input
                        type="date"
                        value={formFechaEstimada}
                        onChange={(e) => setFormFechaEstimada(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">3. Visita Realizada:</label>
                      <input
                        type="date"
                        value={formFechaVisita}
                        onChange={(e) => setFormFechaVisita(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Resultado / Concepto Técnico:</label>
                    <input
                      type="text"
                      placeholder="Ej: Favorable sin observaciones / Aprobado condicionado a cerramiento"
                      value={formResultadoConcepto}
                      onChange={(e) => setFormResultadoConcepto(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </>
              )}

              {frenteEditar === "arquitectura" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Fecha Solicitud:</label>
                    <input
                      type="date"
                      value={formFechaSolicitud}
                      onChange={(e) => setFormFechaSolicitud(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Entrega Estimada:</label>
                    <input
                      type="date"
                      value={formFechaEntregaEstimada}
                      onChange={(e) => setFormFechaEntregaEstimada(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Entrega Real:</label>
                    <input
                      type="date"
                      value={formFechaEntregaReal}
                      onChange={(e) => setFormFechaEntregaReal(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              )}

              {frenteEditar === "estudioSuelos" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Fecha Solicitud:</label>
                      <input
                        type="date"
                        value={formFechaSolicitud}
                        onChange={(e) => setFormFechaSolicitud(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Fecha Sondeos:</label>
                      <input
                        type="date"
                        value={formFechaRealizacion}
                        onChange={(e) => setFormFechaRealizacion(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Entrega Informe:</label>
                      <input
                        type="date"
                        value={formFechaEntregaReal || formFechaEntregaEstimada}
                        onChange={(e) => {
                          setFormFechaEntregaReal(e.target.value);
                          setFormFechaEntregaEstimada(e.target.value);
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Observaciones generales */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Observaciones Técnicas / Detalles de la Gestión:
                </label>
                <textarea
                  rows={2}
                  value={formObservaciones}
                  onChange={(e) => setFormObservaciones(e.target.value)}
                  placeholder="Detalles sobre contratistas, condiciones del predio, hallazgos o acuerdos..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Carga / Actualización de Soporte */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="block font-bold text-slate-800">
                  Documento de Soporte ({frenteEditar === "interventoria" ? "Certificado de Visita" : frenteEditar === "arquitectura" ? "Planos para Licencia" : "Informe NSR-10"}):
                </label>

                {formSoporteNombre ? (
                  <div className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg">
                    <div className="flex items-center space-x-2 truncate">
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <span title={formSoporteNombre} className="font-mono text-xs text-slate-800 truncate">{formSoporteNombre}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormSoporteNombre("");
                        setFormSoporteUrl("");
                        setFormSoporteHash("");
                      }}
                      className="text-rose-600 hover:text-rose-800 text-xs font-semibold px-2 cursor-pointer"
                    >
                      Remover
                    </button>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="fase4-input-soporte-tecnico" className="inline-flex items-center justify-center space-x-2 px-3 py-2 bg-white border border-dashed border-slate-300 hover:border-blue-400 rounded-xl w-full text-center text-xs text-slate-600 hover:text-blue-600 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-blue-500">
                      <UploadCloud className="w-4 h-4 text-slate-400" />
                      <span>
                        {frenteEditar === "arquitectura"
                          ? "Cargar planos en PDF (Solo PDF)"
                          : "Seleccionar archivo (PDF o Imagen)"}
                      </span>
                      <input
                        id="fase4-input-soporte-tecnico"
                        type="file"
                        accept={frenteEditar === "arquitectura" ? ".pdf,application/pdf" : ".pdf,.jpg,.jpeg,.png"}
                        onChange={handleSimularCargaArchivo}
                        className="sr-only"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Nota para la Bitácora */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nota para la Bitácora (Opcional):
                </label>
                <input
                  type="text"
                  placeholder="Ej: Se coordinó visita para el próximo martes con el ingeniero de campo..."
                  value={formNotaHistorial}
                  onChange={(e) => setFormNotaHistorial(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end space-x-2 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setFrenteEditar(null)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-200/60 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardandoFrente}
                onClick={handleGuardarFrente}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {guardandoFrente ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Guardar Cambios</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL PARA AGREGAR NOTA RÁPIDA A LA BITÁCORA */}
      {frenteNota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <History className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Agregar Nota a Bitácora ({frenteNota === "interventoria" ? "Interventoría" : frenteNota === "arquitectura" ? "Arquitectura" : "Estudio de Suelos"})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setFrenteNota(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Anotación de seguimiento técnico:
              </label>
              <textarea
                rows={3}
                placeholder="Escriba la novedad, llamada o gestión realizada..."
                value={textoNotaRapida}
                onChange={(e) => setTextoNotaRapida(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setFrenteNota(null)}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-800 text-xs font-semibold rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardandoNota || !textoNotaRapida.trim()}
                onClick={handleGuardarNotaRapida}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl disabled:bg-slate-300 cursor-pointer"
              >
                {guardandoNota ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Registrar Nota</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL DE CONFIRMACIÓN PARA AVANZAR A FASE 5 */}
      {modalConfirmarAvanzarF5 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Avanzar a Fase 5: En Trámite de Licencia de Construcción
                </h3>
                <p className="text-xs text-slate-500">
                  Validación integral de los 3 frentes de trabajo técnico
                </p>
              </div>
            </div>

            {errorAvanzar && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorAvanzar}</span>
              </div>
            )}

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="font-bold text-slate-800 mb-1">Resumen de Frentes Cumplidos:</div>
              <div className="flex items-center justify-between text-slate-700">
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Frente 1: Visita de Interventoría
                </span>
                <span className="font-mono font-semibold text-emerald-700">Completado y con Soporte</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Frente 2: Planos de Arquitectura
                </span>
                <span className="font-mono font-semibold text-emerald-700">Completado y con Planos</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Frente 3: Estudio de Suelos
                </span>
                <span className="font-mono font-semibold text-emerald-700">Completado y con Informe</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Al confirmar, el expediente pasará formalmente a <strong>Fase 5</strong> y la responsabilidad se transferirá a la Supervisión e Ingeniería para la radicación y seguimiento del trámite de la Licencia de Construcción.
            </p>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setModalConfirmarAvanzarF5(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={avanzandoFase5}
                onClick={handleEjecutarAvanzarFase5}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {avanzandoFase5 ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                <span>Confirmar y Avanzar a Fase 5</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
