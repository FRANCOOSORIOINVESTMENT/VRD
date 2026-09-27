import React, { useState, useEffect } from "react";
import {
  Expediente,
  RequisitoCaso,
  PerfilUsuario,
  EnvioCompensar,
  DocumentoEnvioCompensar,
  RespuestaCompensar
} from "../types";
import { formatearRol } from "../utils/formatoRoles";
import {
  Building2,
  Send,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  Eye,
  RotateCcw,
  UserX,
  ArrowRight,
  ShieldCheck,
  Paperclip,
  Check,
  Info,
  Calendar,
  User,
  Hash,
  UploadCloud,
  FileSpreadsheet,
  Inbox,
  Upload
} from "lucide-react";

interface Fase3CompensarProps {
  expediente: Expediente;
  requisitosFase2: RequisitoCaso[];
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
  onSubirDocumento?: (req: RequisitoCaso) => void;
  onActualizarExpediente: () => Promise<void>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export const Fase3Compensar: React.FC<Fase3CompensarProps> = ({
  expediente,
  requisitosFase2,
  currentUser,
  onAbrirVisor,
  onSubirDocumento,
  onActualizarExpediente,
  authFetch
}) => {
  const validacion = expediente.validacionCompensar;
  const envios = validacion?.envios || [];
  const estadoActual = validacion?.estadoActual || "sin_enviar";
  const ultimoEnvio = envios.length > 0 ? envios[envios.length - 1] : null;

  // Permisos por rol
  const puedeOperar = currentUser.rol === "ingenieria" || currentUser.rol === "administrador";
  const puedeRegistrarRespuesta = currentUser.rol === "ingenieria" || currentUser.rol === "supervisor" || currentUser.rol === "administrador";
  const puedeAvanzarFase = currentUser.rol === "supervisor" || currentUser.rol === "administrador";

  // Formulario de Envío
  const [seleccionados, setSeleccionados] = useState<Record<string, boolean>>({});
  const [fechaEnvio, setFechaEnvio] = useState<string>(new Date().toISOString().split("T")[0]);
  const [evidenciaArchivo, setEvidenciaArchivo] = useState<File | null>(null);
  const [evidenciaUrl, setEvidenciaUrl] = useState<string>("");
  const [evidenciaNombre, setEvidenciaNombre] = useState<string>("");
  const [evidenciaMimeType, setEvidenciaMimeType] = useState<string>("image/png");
  const [evidenciaTamanoBytes, setEvidenciaTamanoBytes] = useState<number>(0);
  const [correoDestinatario, setCorreoDestinatario] = useState<string>("radicacion.vrd@compensar.com");
  const [asunto, setAsunto] = useState<string>("");
  const [cuerpoMensaje, setCuerpoMensaje] = useState<string>("");
  const [radicadoOReferencia, setRadicadoOReferencia] = useState<string>("");
  const [notasEnvio, setNotasEnvio] = useState<string>("");
  const [enviandoPaquete, setEnviandoPaquete] = useState<boolean>(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  // Subsanación interna (Cambio 6)
  const [devolviendoAIngenieria, setDevolviendoAIngenieria] = useState<boolean>(false);
  // CAMBIO 3: Flujo de revisión jurídica por el Analista Documental
  const [enviandoARevisionAnalista, setEnviandoARevisionAnalista] = useState<boolean>(false);
  const [modalRechazoAnalista, setModalRechazoAnalista] = useState<boolean>(false);
  const [motivoRechazoAnalista, setMotivoRechazoAnalista] = useState<string>("");
  const [procesandoDecisionAnalista, setProcesandoDecisionAnalista] = useState<boolean>(false);
  const [errorDecisionAnalista, setErrorDecisionAnalista] = useState<string | null>(null);

  // Formulario de Respuesta
  const [modalRespuesta, setModalRespuesta] = useState<boolean>(false);
  const [tipoResultado, setTipoResultado] = useState<"aprobado" | "observaciones" | "rechazo_definitivo">("aprobado");
  const [radicadoConcepto, setRadicadoConcepto] = useState<string>("");
  const [fechaRespuesta, setFechaRespuesta] = useState<string>(new Date().toISOString().split("T")[0]);
  const [observacionesRespuesta, setObservacionesRespuesta] = useState<string>("");
  const [archivoConceptoUrl, setArchivoConceptoUrl] = useState<string>("");
  const [archivoConceptoNombre, setArchivoConceptoNombre] = useState<string>("");
  const [docsObservados, setDocsObservados] = useState<Record<string, boolean>>({});
  const [guardandoRespuesta, setGuardandoRespuesta] = useState<boolean>(false);
  const [errorRespuesta, setErrorRespuesta] = useState<string | null>(null);

  // Escape key handler for open modals
  useEffect(() => {
    if (!modalRespuesta && !modalRechazoAnalista) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (modalRechazoAnalista) setModalRechazoAnalista(false);
        else if (modalRespuesta) setModalRespuesta(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalRespuesta, modalRechazoAnalista]);

  // Inicializar selección de documentos (todos los 11 seleccionados por defecto)
  useEffect(() => {
    const selInit: Record<string, boolean> = {};
    requisitosFase2.forEach((r) => {
      selInit[r.codigoRequisito] = true;
    });
    setSeleccionados(selInit);
  }, [requisitosFase2]);

  // Inicializar Asunto y Cuerpo del Mensaje
  useEffect(() => {
    const cod = expediente.codigoVisible || expediente.id.toUpperCase();
    const nombrePost = [
      expediente.postulante?.primerNombre,
      expediente.postulante?.segundoNombre,
      expediente.postulante?.primerApellido,
      expediente.postulante?.segundoApellido
    ].filter(Boolean).join(" ") || expediente.postulante?.nombres || "POSTULANTE";

    const numEnvio = (envios.length || 0) + 1;
    const prefijo = numEnvio > 1 ? `[Subsanación #${numEnvio}] ` : "";
    setAsunto(`${prefijo}Validación Inicial VRD — ${cod} — ${nombrePost}`);

    const municipio = expediente.predioVivienda?.municipioNombre || expediente.predioVivienda?.municipioCodigo || "Cundinamarca";
    const direccion = expediente.predioVivienda?.nombreODireccion || "Sector rural";

    setCuerpoMensaje(
      `Señores COMPENSAR,\n\n` +
      `Por medio de la presente, FRANCO OSORIO VRD remite formalmente el expediente consolidado del hogar para el trámite de VALIDACIÓN INICIAL DE VIABILIDAD en el marco del programa Vivienda Rural Digna:\n\n` +
      `• Código del Hogar: ${cod}\n` +
      `• Postulante Principal: ${nombrePost} (${expediente.postulante?.tipoIdentificacion}: ${expediente.postulante?.numeroIdentificacion})\n` +
      `• Predio Postulado: ${direccion}, Municipio de ${municipio}\n` +
      `• Documentación Anexa: 11 Requisitos avalados jurídicamente en Fase 2 (Cédulas, Certificado de Tradición, Impuesto Predial, Declaración Juramentada, Registro Fotográfico y demás soportes).\n\n` +
      `Agradecemos la revisión y expedición del concepto técnico/financiero correspondiente.\n\n` +
      `Cordialmente,\n` +
      `Equipo Técnico y Operativo — FRANCO OSORIO VRD`
    );
  }, [expediente.id, expediente.codigoVisible, envios.length]);

  // Documentos seleccionados para envío
  const docsParaEnvio: DocumentoEnvioCompensar[] = requisitosFase2
    .filter((r) => seleccionados[r.codigoRequisito] && r.documentoAsociado?.versionActual)
    .map((r) => ({
      requisitoCodigo: r.codigoRequisito,
      requisitoNombre: r.nombre,
      documentoId: r.documentoAsociado!.id,
      versionNumero: r.documentoAsociado!.versionActual!.versionNumero,
      nombreArchivo: r.documentoAsociado!.versionActual!.nombreArchivoOriginal,
      tamanoBytes: r.documentoAsociado!.versionActual!.tamanoBytes,
      sha256Hash: r.documentoAsociado!.versionActual!.sha256Hash
    }));

  const pesoTotalBytes = docsParaEnvio.reduce((acc, d) => acc + d.tamanoBytes, 0);
  const pesoTotalMB = (pesoTotalBytes / (1024 * 1024)).toFixed(2);

  // Calcular días desde el último envío
  const diasDesdeEnvio = ultimoEnvio
    ? Math.max(0, Math.floor((Date.now() - new Date(ultimoEnvio.fechaEnvio).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const handleSeleccionarEvidencia = (file: File) => {
    setEvidenciaArchivo(file);
    setEvidenciaNombre(file.name);
    setEvidenciaMimeType(file.type || "image/png");
    setEvidenciaTamanoBytes(file.size);
    const reader = new FileReader();
    reader.onload = () => {
      setEvidenciaUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Registrar Envío (Cambio 5: Validación simplificada centrada en Fecha y Evidencia del correo)
  const handleRegistrarEnvio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fechaEnvio) {
      setErrorEnvio("La fecha de envío es obligatoria.");
      return;
    }
    if (!evidenciaUrl && !evidenciaArchivo) {
      setErrorEnvio("Debe adjuntar el pantallazo o evidencia del correo enviado a Compensar.");
      return;
    }

    setEnviandoPaquete(true);
    setErrorEnvio(null);

    try {
      const res = await authFetch(`/api/expedientes/${expediente.id}/compensar/registrar-envio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          correoDestinatario,
          asunto,
          cuerpoMensaje,
          fechaEnvio,
          documentosIncluidos: docsParaEnvio,
          radicadoOReferencia,
          notasEnvio,
          evidenciaUrl,
          evidenciaNombre: evidenciaNombre || "Pantallazo_Envio_Compensar.png",
          evidenciaMimeType: evidenciaMimeType || "image/png",
          evidenciaTamanoBytes: evidenciaTamanoBytes || 102400
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No fue posible registrar el envío a Compensar.");
      }

      // Limpiar archivo seleccionado
      setEvidenciaArchivo(null);
      setEvidenciaUrl("");
      setEvidenciaNombre("");
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorEnvio(err.message || "Error al registrar el envío.");
    } finally {
      setEnviandoPaquete(false);
    }
  };

  // Subsanación interna: Devolver a Ingeniería (fallback)
  const handleDevolverAIngenieria = async () => {
    setDevolviendoAIngenieria(true);
    try {
      const res = await authFetch(`/api/expedientes/${expediente.id}/compensar/devolver-a-ingenieria`, {
        method: "POST"
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al remitir expediente a Ingeniería.");
      }
      await onActualizarExpediente();
    } catch (err: any) {
      alert(err.message || "Error al devolver a Ingeniería.");
    } finally {
      setDevolviendoAIngenieria(false);
    }
  };

  // CAMBIO 3: Enviar correcciones a revisión del Analista Documental (Gestor)
  const handleEnviarRevisionAnalista = async () => {
    setEnviandoARevisionAnalista(true);
    try {
      const res = await authFetch(`/api/expedientes/${expediente.id}/compensar/enviar-revision-analista`, {
        method: "POST"
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al enviar correcciones al Analista Documental.");
      }
      await onActualizarExpediente();
    } catch (err: any) {
      alert(err.message || "Error al enviar a revisión.");
    } finally {
      setEnviandoARevisionAnalista(false);
    }
  };

  // CAMBIO 3: Aprobar subsanación y transferir a Ingeniería (Analista Documental)
  const handleAprobarAnalista = async () => {
    setProcesandoDecisionAnalista(true);
    setErrorDecisionAnalista(null);
    try {
      const res = await authFetch(`/api/expedientes/${expediente.id}/compensar/analista-aprobar`, {
        method: "POST"
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al aprobar subsanación.");
      }
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorDecisionAnalista(err.message || "Error al procesar la aprobación.");
    } finally {
      setProcesandoDecisionAnalista(false);
    }
  };

  // CAMBIO 3: Rechazar subsanación y retornar al Gestor (Analista Documental)
  const handleRechazarAnalista = async () => {
    if (!motivoRechazoAnalista.trim()) {
      setErrorDecisionAnalista("Debe indicar el motivo de rechazo de la subsanación.");
      return;
    }
    setProcesandoDecisionAnalista(true);
    setErrorDecisionAnalista(null);
    try {
      const res = await authFetch(`/api/expedientes/${expediente.id}/compensar/analista-rechazar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivoRechazo: motivoRechazoAnalista })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al rechazar subsanación.");
      }
      setModalRechazoAnalista(false);
      setMotivoRechazoAnalista("");
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorDecisionAnalista(err.message || "Error al devolver al Gestor.");
    } finally {
      setProcesandoDecisionAnalista(false);
    }
  };

  // Registrar Respuesta
  const handleGuardarRespuesta = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardandoRespuesta(true);
    setErrorRespuesta(null);

    try {
      const docsObservadosLista = Object.keys(docsObservados).filter((k) => docsObservados[k]);

      const res = await authFetch(`/api/expedientes/${expediente.id}/compensar/registrar-respuesta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          envioId: ultimoEnvio?.id,
          resultado: tipoResultado,
          fechaRespuesta,
          radicadoOConcepto: radicadoConcepto,
          observacionesDetalladas: observacionesRespuesta,
          archivoConceptoUrl,
          archivoConceptoNombre: archivoConceptoNombre || (tipoResultado === "aprobado" ? "Concepto_Viabilidad_Compensar.pdf" : "Observaciones_Compensar.pdf"),
          documentosConObservacion: docsObservadosLista
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo registrar la respuesta de Compensar.");
      }

      setModalRespuesta(false);
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorRespuesta(err.message || "Error al registrar la respuesta.");
    } finally {
      setGuardandoRespuesta(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. CABECERA DESCRIPTIVA DE LA FASE 3 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-3 bg-blue-600 text-white rounded-xl shadow-xs shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">
                  Fase 3: En Validación Inicial Compensar
                </h3>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    estadoActual === "aprobado"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : estadoActual === "pendiente_respuesta"
                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                      : estadoActual === "con_observaciones"
                      ? "bg-orange-100 text-orange-800 border border-orange-300"
                      : estadoActual === "rechazado_definitivo"
                      ? "bg-rose-100 text-rose-800 border border-rose-300"
                      : "bg-slate-100 text-slate-700 border border-slate-300"
                  }`}
                >
                  {estadoActual === "aprobado" && "✓ Aprobado por Compensar"}
                  {estadoActual === "pendiente_respuesta" && "⏳ Enviado a Compensar — Pendiente Respuesta"}
                  {estadoActual === "con_observaciones" && "⚠ Con Observaciones de Compensar"}
                  {estadoActual === "rechazado_definitivo" && "✕ Rechazado Definitivo"}
                  {estadoActual === "sin_enviar" && "En Preparación de Paquete"}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                Consolidación, verificación formal y remisión a <strong>Compensar</strong> del paquete de 11 documentos aprobados en Fase 2 para emisión del concepto de viabilidad inicial del hogar.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Botón Registrar Respuesta (Ingeniería / Supervisor / Admin) */}
            {estadoActual === "pendiente_respuesta" && puedeRegistrarRespuesta && (
              <button
                type="button"
                onClick={() => {
                  setTipoResultado("aprobado");
                  setRadicadoConcepto("");
                  setObservacionesRespuesta("");
                  setArchivoConceptoUrl("");
                  setArchivoConceptoNombre("");
                  setDocsObservados({});
                  setModalRespuesta(true);
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
              >
                <Inbox className="w-4 h-4" />
                <span>Registrar Respuesta de Compensar</span>
              </button>
            )}

            {/* CAMBIO 7: Cierre automático al aprobar. Ya no se requiere autorización del Analista Documental */}
            {estadoActual === "aprobado" && (
              <div className="text-xs text-emerald-800 bg-emerald-100 border border-emerald-300 px-3.5 py-2 rounded-lg font-semibold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Validación Aprobada por Compensar • Expediente Transferido a Fase 4</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BANNER Y PANEL DE SUBSANACIÓN CON REVISIÓN DEL ANALISTA DOCUMENTAL (CAMBIO 3) */}
      {expediente.subsanacionFase3Activa && (
        <div className="space-y-4">
          {/* Si está en estado de revisión por el Analista Documental */}
          {expediente.subsanacionFase3Estado === "revision_analista" ? (
            <div className="p-5 bg-indigo-50/90 border-2 border-indigo-300 rounded-2xl shadow-sm space-y-4 text-indigo-950">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-200 text-indigo-800 uppercase tracking-wide">
                      Flujo Jurídico • Subsanación
                    </div>
                    <h4 className="font-bold text-base text-indigo-950 mt-1">
                      Revisión y Validación Jurídica de Correcciones (Analista Documental)
                    </h4>
                    <p className="text-xs text-indigo-800 mt-1 leading-relaxed max-w-2xl">
                      El Gestor Documental remitió las subsanaciones correspondientes a las observaciones de Compensar.
                      Como Analista Documental, inspeccione los documentos actualizados a continuación. Al dar el visto bueno, el expediente será transferido automáticamente a Ingeniería para nueva radicación.
                    </p>
                  </div>
                </div>

                {/* Acciones para el Analista Documental */}
                {(currentUser.rol === "juridico" || currentUser.rol === "analista" || currentUser.rol === "administrador" || currentUser.rol === "supervisor") ? (
                  <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setModalRechazoAnalista(true)}
                      disabled={procesandoDecisionAnalista}
                      className="w-full sm:w-auto px-3.5 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4 text-rose-600" />
                      <span>Rechazar / Devolver a Gestor</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAprobarAnalista}
                      disabled={procesandoDecisionAnalista}
                      className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {procesandoDecisionAnalista ? <Clock className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      <span>Aprobar y Transferir a Ingeniería</span>
                    </button>
                  </div>
                ) : (
                  <div className="px-3 py-1.5 bg-indigo-100 text-indigo-800 rounded-xl text-xs font-semibold shrink-0">
                    En espera de visto bueno jurídico
                  </div>
                )}
              </div>

              {errorDecisionAnalista && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                  {errorDecisionAnalista}
                </div>
              )}

              {/* Documentos a revisar con visor rápido */}
              <div className="bg-white rounded-xl p-3 border border-indigo-200">
                <div className="text-xs font-bold text-indigo-900 mb-2 flex items-center justify-between">
                  <span>Documentos del Expediente Disponibles para Cotejo:</span>
                  <span className="text-[11px] font-normal text-slate-500">Haga clic en 'Ver' para abrir el visor oficial</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {requisitosFase2.map((req) => (
                    <div
                      key={req.id}
                      className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="truncate">
                        <span className="font-bold text-slate-700">{req.codigoRequisito}:</span>{" "}
                        <span title={req.nombreRequisito} className="text-slate-600 truncate">{req.nombreRequisito}</span>
                      </div>
                      {req.documentoAsociado?.versionActual && (
                        <button
                          type="button"
                          onClick={() => {
                            const ver = req.documentoAsociado!.versionActual!;
                            onAbrirVisor({
                              url: ver.url,
                              nombreArchivo: ver.nombreArchivoOriginal,
                              sha256: ver.sha256,
                              version: ver.versionNumero,
                              tamanoBytes: ver.tamanoBytes,
                              subidoPor: ver.subidoPor?.nombreCompleto || "Sistema",
                              subidoEn: ver.subidoEn,
                              titulo: `${req.codigoRequisito} - ${req.nombreRequisito}`
                            });
                          }}
                          className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[11px] font-bold flex items-center space-x-1 shrink-0 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Ver</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Si está en subsanación activa en manos del Gestor Documental */
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-amber-950">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="font-bold text-sm text-amber-900">
                      Expediente en Subsanación de Observaciones de Compensar
                    </h4>
                    {expediente.subsanacionFase3ObservacionAnalista && (
                      <span className="px-2 py-0.5 bg-rose-200 text-rose-900 text-[10px] font-bold rounded-full">
                        Devuelto por Analista
                      </span>
                    )}
                  </div>

                  {expediente.subsanacionFase3ObservacionAnalista && (
                    <div className="mt-1.5 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 font-medium">
                      <strong>Motivo de devolución jurídica:</strong> {expediente.subsanacionFase3ObservacionAnalista}
                    </div>
                  )}

                  <p className="text-xs text-amber-800 mt-1.5 leading-relaxed">
                    {currentUser.rol === "asistente" || currentUser.rol === "administrador"
                      ? "Actualice o reemplace los documentos observados en el listado inferior. Al finalizar todas las correcciones, presione 'Enviar Correcciones a Revisión Analista' para solicitar el visto bueno jurídico."
                      : "El expediente se encuentra en subsanación a cargo del Gestor Documental para corregir los documentos observados por Compensar."}
                  </p>
                </div>
              </div>

              {(currentUser.rol === "asistente" || currentUser.rol === "administrador") && (
                <button
                  type="button"
                  id="btn-enviar-revision-analista"
                  onClick={handleEnviarRevisionAnalista}
                  disabled={enviandoARevisionAnalista}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center space-x-2 shrink-0 cursor-pointer disabled:bg-slate-300"
                >
                  {enviandoARevisionAnalista ? <Clock className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Enviar Correcciones a Revisión Analista</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* BANNER INFORMATIVO PARA COMERCIAL Y ASISTENTE */}
      {!puedeOperar && !puedeRegistrarRespuesta && !expediente.subsanacionFase3Activa && (
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center space-x-2.5 text-xs text-slate-600">
          <Info className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            Vista en <strong>Modo Solo Lectura</strong> para su rol ({formatearRol(currentUser.rol)}). Las actividades de consolidación y radicación ante Compensar corresponden al rol de <strong>Ingeniería</strong>.
          </span>
        </div>
      )}

      {/* BANNER DE ESTADO ACTUAL DESTACADO */}
      {estadoActual === "pendiente_respuesta" && ultimoEnvio && (
        <div className="bg-amber-50/90 border-2 border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950">
          <div className="flex items-start space-x-3">
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm">Paquete radicado ante Compensar</span>
                <span className="bg-amber-200 text-amber-900 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  Envío #{ultimoEnvio.numeroEnvio}
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                Enviado el {new Date(ultimoEnvio.fechaEnvio).toLocaleString("es-CO")} por <strong>{ultimoEnvio.usuarioEnvioNombre}</strong> a <strong>{ultimoEnvio.correoDestinatario}</strong>.
              </p>
              {ultimoEnvio.radicadoOReferencia && (
                <p className="text-xs font-mono font-bold text-amber-900 mt-1">
                  Radicado / Referencia: {ultimoEnvio.radicadoOReferencia}
                </p>
              )}
            </div>
          </div>
          <div className="text-right shrink-0 bg-white/70 p-2.5 rounded-lg border border-amber-200">
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-700 block">Tiempo en Espera</span>
            <span className="text-lg font-black text-amber-900">
              {diasDesdeEnvio} {diasDesdeEnvio === 1 ? "día" : "días"}
            </span>
          </div>
        </div>
      )}

      {estadoActual === "con_observaciones" && (
        <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4 text-orange-950">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-sm text-orange-900">
                Compensar emitió observaciones para subsanar
              </h4>
              <p className="text-xs text-orange-800 mt-1 leading-relaxed">
                {ultimoEnvio?.respuesta?.observacionesDetalladas || "Se requiere subsanación de documentos antes de continuar con la viabilidad."}
              </p>
              {ultimoEnvio?.respuesta?.documentosConObservacion && ultimoEnvio.respuesta.documentosConObservacion.length > 0 && (
                <div className="mt-2 text-xs">
                  <span className="font-bold text-orange-900">Documentos observados: </span>
                  <span className="font-semibold bg-orange-100 text-orange-800 px-2 py-0.5 rounded">
                    {ultimoEnvio.respuesta.documentosConObservacion.join(", ")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {estadoActual === "aprobado" && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4 flex items-start space-x-3 text-emerald-950">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm text-emerald-900">
              ¡Validación Inicial Aprobada por Compensar!
            </h4>
            <p className="text-xs text-emerald-800 mt-0.5">
              Radicado / Concepto: <strong>{validacion?.radicadoAprobacionFinal || "S/N"}</strong> el {validacion?.fechaAprobacionFinal ? new Date(validacion.fechaAprobacionFinal).toLocaleDateString() : ""}
            </p>
            {validacion?.observacionesFinales && (
              <p className="text-xs text-emerald-700 italic mt-1 bg-white/70 p-2 rounded border border-emerald-200">
                &quot;{validacion.observacionesFinales}&quot;
              </p>
            )}
          </div>
        </div>
      )}

      {/* 2. GRILLA DE LOS 11 DOCUMENTOS DE FASE 2 EN MODO VISOR */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 mb-4 gap-2">
          <div>
            <h4 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              <span>11 Documentos Aprobados de Fase 2 (Consolidados)</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Haga clic en cualquier documento para verificar su integridad y visualización previa a la radicación.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
              {docsParaEnvio.length} de {requisitosFase2.length} seleccionados ({pesoTotalMB} MB)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {requisitosFase2.map((req, idx) => {
            const doc = req.documentoAsociado;
            const version = doc?.versionActual;
            const estaSeleccionado = !!seleccionados[req.codigoRequisito];
            const esFoto = req.codigoRequisito === "F2-11" || req.nombre.toLowerCase().includes("fotogr");
            const tieneFotos = version?.fotos && version.fotos.length > 0;

            return (
              <div
                key={req.id || req.codigoRequisito}
                className={`p-3.5 rounded-xl border transition-all ${
                  estaSeleccionado
                    ? "bg-slate-50/70 border-slate-300 hover:border-blue-400"
                    : "bg-white border-slate-200 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start space-x-2.5">
                    {/* Checkbox de inclusión en paquete */}
                    {puedeOperar && (estadoActual === "sin_enviar" || estadoActual === "con_observaciones") && (
                      <input
                        type="checkbox"
                        checked={estaSeleccionado}
                        onChange={(e) =>
                          setSeleccionados({ ...seleccionados, [req.codigoRequisito]: e.target.checked })
                        }
                        className="mt-1 w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                        title="Incluir en el paquete de envío a Compensar"
                      />
                    )}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                          {req.codigoRequisito}
                        </span>
                        <h5 className="font-semibold text-xs text-slate-900 leading-tight">
                          {req.nombre}
                        </h5>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                        {version ? version.nombreArchivoOriginal : "Documento aprobado en Fase 2"}
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    ✓ Aprobado
                  </span>
                </div>

                {/* Detalles técnicos y botón de visor */}
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center space-x-3">
                    <span>Versión: <strong>v{version?.versionNumero || 1}</strong></span>
                    <span>
                      {version ? `${(version.tamanoBytes / 1024).toFixed(0)} KB` : "Válido"}
                    </span>
                    {tieneFotos && (
                      <span className="text-indigo-600 font-bold">
                        📷 {version.fotos!.length} fotos
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {version && (
                      <button
                        type="button"
                        onClick={() =>
                          onAbrirVisor({
                            titulo: `${req.codigoRequisito}: ${req.nombre}`,
                            nombreArchivo: version.nombreArchivoOriginal,
                            mimeType: version.mimeType,
                            sha256Hash: version.sha256Hash,
                            tamanoBytes: version.tamanoBytes,
                            subidoPor: version.subidoPorNombre,
                            subidoEn: version.subidoEn,
                            archivoDataUrl: version.archivoDataUrl,
                            fotos: version.fotos,
                            fotoInicialIndex: 0
                          })
                        }
                        className="inline-flex items-center space-x-1 font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver Documento</span>
                      </button>
                    )}

                    {/* Libertad total para el Gestor Documental de actualizar documentos en subsanación (Cambio 6) */}
                    {expediente.subsanacionFase3Activa && (currentUser.rol === "asistente" || currentUser.rol === "administrador") && onSubirDocumento && (
                      <button
                        type="button"
                        onClick={() => onSubirDocumento(req)}
                        className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded text-[11px] font-semibold flex items-center space-x-1 border border-emerald-300 transition-colors cursor-pointer"
                        title="Actualizar o reemplazar este documento para subsanar observaciones de Compensar"
                      >
                        <Upload className="w-3 h-3 text-emerald-600" />
                        <span>Actualizar</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. FORMULARIO SIMPLIFICADO DE PREPARACIÓN Y REGISTRO DE ENVÍO A COMPENSAR (Cambio 5) */}
      {puedeOperar && (estadoActual === "sin_enviar" || estadoActual === "con_observaciones") && !expediente.subsanacionFase3Activa && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="pb-3 border-b border-slate-100 mb-4">
            <h4 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <Send className="w-4 h-4 text-blue-600" />
              <span>
                {estadoActual === "con_observaciones" ? "Registrar Reenvío de Subsanación a Compensar" : "Registrar Envío Formal a Compensar"}
              </span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Ingrese la fecha en la que se despachó el correo a Compensar y adjunte el pantallazo como evidencia formal.
            </p>
          </div>

          <form onSubmit={handleRegistrarEnvio} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Selector de fecha del envío */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Fecha del envío: <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="date"
                    required
                    value={fechaEnvio}
                    onChange={(e) => setFechaEnvio(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-slate-800 outline-none focus:border-blue-500 font-medium"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Indique la fecha en la que se mandó formalmente el correo a Compensar.
                </p>
              </div>

              {/* 2. Pantallazo del correo enviado */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pantallazo del correo enviado: <span className="text-rose-600">*</span>
                </label>
                {evidenciaUrl ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center justify-between">
                    <div className="flex items-center space-x-2 overflow-hidden">
                      <FileCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div className="truncate">
                        <div className="font-semibold text-emerald-950 truncate text-xs">{evidenciaNombre}</div>
                        <div className="text-[10px] text-emerald-700">
                          {(evidenciaTamanoBytes / 1024).toFixed(1)} KB • Evidencia adjunta
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEvidenciaArchivo(null);
                        setEvidenciaUrl("");
                        setEvidenciaNombre("");
                        setEvidenciaTamanoBytes(0);
                      }}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline shrink-0 ml-2"
                    >
                      Remover
                    </button>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="fase3-input-evidencia" className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 rounded-lg cursor-pointer transition-colors text-center focus-within:ring-2 focus-within:ring-blue-500">
                      <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
                      <span className="font-semibold text-slate-700 text-xs">
                        Adjuntar pantallazo del correo
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        Haga clic o arrastre la imagen / soporte de envío
                      </span>
                      <input
                        id="fase3-input-evidencia"
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleSeleccionarEvidencia(file);
                        }}
                        className="sr-only"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>

            {errorEnvio && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorEnvio}</span>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="submit"
                disabled={enviandoPaquete || !fechaEnvio || !evidenciaUrl}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-colors shadow-sm flex items-center space-x-2 cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {enviandoPaquete ? <Clock className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>
                  {estadoActual === "con_observaciones" ? "Registrar Reenvío de Subsanación" : "Registrar Envío a Compensar"}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. LÍNEA DE TIEMPO / HISTORIAL DE ENVÍOS Y RESPUESTAS */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <h4 className="font-bold text-sm text-slate-900 flex items-center space-x-2 pb-3 border-b border-slate-100 mb-4">
          <Clock className="w-4 h-4 text-slate-600" />
          <span>Historial de Envíos y Respuestas de Compensar ({envios.length})</span>
        </h4>

        {envios.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            Aún no se han registrado envíos formales de este hogar ante Compensar.
          </div>
        ) : (
          <div className="space-y-4">
            {envios.map((env, i) => (
              <div key={env.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                {/* Cabecera del Envío */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200 gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-bold">
                      Envío #{env.numeroEnvio}
                    </span>
                    <span className="font-bold text-xs text-slate-800">{env.asunto}</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {new Date(env.fechaEnvio).toLocaleString("es-CO")}
                  </span>
                </div>

                <div className="mt-2 text-xs text-slate-600 space-y-1">
                  <p>
                    <strong>Responsable de Envío:</strong> {env.usuarioEnvioNombre}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    <strong>Documentos remitidos ({env.documentosIncluidos?.length || 0}):</strong>{" "}
                    {env.documentosIncluidos?.map((d) => d.requisitoCodigo).join(", ")}
                  </p>
                  {env.evidenciaUrl && (
                    <div className="pt-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onAbrirVisor({
                            titulo: `Evidencia de Envío #${env.numeroEnvio} a Compensar`,
                            nombreArchivo: env.evidenciaNombre || "Pantallazo_Envio_Compensar.png",
                            mimeType: env.evidenciaMimeType || "image/png",
                            sha256Hash: env.evidenciaHash || "hash-evidencia",
                            tamanoBytes: env.evidenciaTamanoBytes || 102400,
                            subidoPor: env.usuarioEnvioNombre,
                            subidoEn: env.fechaEnvio,
                            archivoDataUrl: env.evidenciaUrl
                          })
                        }
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md text-xs font-semibold border border-blue-200 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                        <span>Ver Pantallazo del Envío</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Respuesta asociada a este envío */}
                {env.respuesta ? (
                  <div className={`mt-3 p-3 rounded-lg border text-xs ${
                    env.respuesta.resultado === "aprobado"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                      : env.respuesta.resultado === "observaciones"
                      ? "bg-orange-50 border-orange-200 text-orange-950"
                      : "bg-rose-50 border-rose-200 text-rose-950"
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold flex items-center space-x-1.5">
                        {env.respuesta.resultado === "aprobado" && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                        {env.respuesta.resultado === "observaciones" && <AlertTriangle className="w-4 h-4 text-orange-600" />}
                        {env.respuesta.resultado === "rechazo_definitivo" && <UserX className="w-4 h-4 text-rose-600" />}
                        <span>
                          Respuesta Compensar:{" "}
                          {env.respuesta.resultado === "aprobado"
                            ? "Aprobado / Viable"
                            : env.respuesta.resultado === "observaciones"
                            ? "Con Observaciones"
                            : "Rechazado Definitivo"}
                        </span>
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(env.respuesta.fechaRespuesta).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs mt-1 leading-relaxed">{env.respuesta.observacionesDetalladas}</p>
                    {env.respuesta.radicadoOConcepto && (
                      <p className="text-[11px] mt-1 font-mono font-semibold">
                        Radicado Compensar: {env.respuesta.radicadoOConcepto}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200 flex items-center space-x-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Pendiente de respuesta formal por parte de Compensar.</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. MODAL: REGISTRAR RESPUESTA DE COMPENSAR */}
      {modalRespuesta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 animate-in fade-in duration-150">
          <div role="dialog" aria-modal="true" aria-labelledby="fase3-modal-respuesta-titulo" className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 border border-slate-200">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 id="fase3-modal-respuesta-titulo" className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Inbox className="w-5 h-5 text-indigo-600" />
                  <span>Registrar Respuesta Oficial de Compensar</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ingrese el dictamen emitido por Compensar para el envío #{ultimoEnvio?.numeroEnvio || 1}.
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar modal de respuesta de Compensar"
                onClick={() => setModalRespuesta(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarRespuesta} className="space-y-4 text-xs">
              {/* Selector de Resultado */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Resultado de la Validación:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTipoResultado("aprobado")}
                    className={`p-2.5 rounded-lg border font-bold text-center transition-all cursor-pointer ${
                      tipoResultado === "aprobado"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs ring-1 ring-emerald-500"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    ✓ Aprobado / Viable
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoResultado("observaciones")}
                    className={`p-2.5 rounded-lg border font-bold text-center transition-all cursor-pointer ${
                      tipoResultado === "observaciones"
                        ? "bg-amber-50 border-amber-500 text-amber-700 shadow-xs ring-1 ring-amber-500"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    ⚠ Observaciones
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoResultado("rechazo_definitivo")}
                    className={`p-2.5 rounded-lg border font-bold text-center transition-all cursor-pointer ${
                      tipoResultado === "rechazo_definitivo"
                        ? "bg-rose-50 border-rose-500 text-rose-700 shadow-xs ring-1 ring-rose-500"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    ✕ Rechazo Definitivo
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="fase3-radicado-concepto" className="block font-semibold text-slate-700 mb-1">
                    Radicado o Concepto Compensar:
                  </label>
                  <input
                    id="fase3-radicado-concepto"
                    type="text"
                    required
                    value={radicadoConcepto}
                    onChange={(e) => setRadicadoConcepto(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 outline-none focus:border-indigo-500 font-mono"
                    placeholder="Ej: RAD-COMP-2026-991"
                  />
                </div>
                <div>
                  <label htmlFor="fase3-fecha-respuesta" className="block font-semibold text-slate-700 mb-1">
                    Fecha de Respuesta:
                  </label>
                  <input
                    id="fase3-fecha-respuesta"
                    type="date"
                    required
                    value={fechaRespuesta}
                    onChange={(e) => setFechaRespuesta(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="fase3-obs-respuesta" className="block font-semibold text-slate-700 mb-1">
                  Observaciones Detalladas / Concepto de Compensar:
                </label>
                <textarea
                  id="fase3-obs-respuesta"
                  rows={3}
                  required
                  value={observacionesRespuesta}
                  onChange={(e) => setObservacionesRespuesta(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 outline-none focus:border-indigo-500 leading-relaxed"
                  placeholder={
                    tipoResultado === "aprobado"
                      ? "Indique detalles del concepto de viabilidad emitido por Compensar."
                      : tipoResultado === "observaciones"
                      ? "Describa detalladamente los requisitos o documentos a subsanar según Compensar."
                      : "Indique el motivo de no viabilidad definitiva dictaminado por Compensar."
                  }
                />
              </div>

              {/* Si hay observaciones, checklist de documentos a subsanar */}
              {tipoResultado === "observaciones" && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Seleccione los documentos específicos observados por Compensar:
                  </label>
                  <div className="max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                    {requisitosFase2.map((r) => (
                      <label
                        key={r.codigoRequisito}
                        className="flex items-center space-x-2 text-[11px] text-slate-700 p-1 hover:bg-white rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={!!docsObservados[r.codigoRequisito]}
                          onChange={(e) =>
                            setDocsObservados({ ...docsObservados, [r.codigoRequisito]: e.target.checked })
                          }
                          className="w-3.5 h-3.5 rounded text-orange-600 border-slate-300 focus:ring-orange-500"
                        />
                        <span className="font-mono font-bold text-orange-700">{r.codigoRequisito}</span>
                        <span>{r.nombre}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Alerta si es Rechazo Definitivo */}
              {tipoResultado === "rechazo_definitivo" && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-800 text-xs flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Atención:</strong> El rechazo definitivo por parte de Compensar cerrará el trámite y enviará el expediente a <strong>Salida Definitiva</strong>, generando la tarea al Gestor Rural para notificación formal al hogar.
                  </div>
                </div>
              )}

              {errorRespuesta && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                  {errorRespuesta}
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalRespuesta(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoRespuesta}
                  className={`px-4 py-2 text-white rounded-lg font-bold text-xs transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer ${
                    tipoResultado === "aprobado"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : tipoResultado === "observaciones"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {guardandoRespuesta ? <Clock className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Guardar Respuesta de Compensar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CAMBIO 3: MODAL DE RECHAZO DE SUBSANACIÓN POR ANALISTA DOCUMENTAL */}
      {modalRechazoAnalista && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div role="dialog" aria-modal="true" aria-labelledby="fase3-modal-rechazo-titulo" className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center space-x-3 mb-4 text-rose-600">
              <RotateCcw className="w-6 h-6 shrink-0" />
              <div>
                <h3 id="fase3-modal-rechazo-titulo" className="font-bold text-slate-900 text-base">Rechazar Subsanación y Devolver al Gestor</h3>
                <p className="text-xs text-slate-500">
                  Indique con claridad las inconsistencias o correcciones faltantes para el Gestor Documental.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="fase3-motivo-rechazo-analista" className="block text-xs font-bold text-slate-700 mb-1">
                  Motivo de Devolución / Observaciones Jurídicas: <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="fase3-motivo-rechazo-analista"
                  rows={4}
                  required
                  placeholder="Ej: El certificado de tradición subsanado no cuenta con fecha de expedición inferior a 30 días. Por favor solicitar uno actualizado al hogar."
                  value={motivoRechazoAnalista}
                  onChange={(e) => setMotivoRechazoAnalista(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>

              {errorDecisionAnalista && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                  {errorDecisionAnalista}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setModalRechazoAnalista(false);
                  setErrorDecisionAnalista(null);
                }}
                disabled={procesandoDecisionAnalista}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRechazarAnalista}
                disabled={procesandoDecisionAnalista || !motivoRechazoAnalista.trim()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {procesandoDecisionAnalista ? <Clock className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                <span>Devolver al Gestor Documental</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
