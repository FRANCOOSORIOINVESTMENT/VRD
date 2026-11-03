import React, { useState, useEffect, useMemo } from "react";
import {
  Expediente,
  PerfilUsuario,
  PostulacionSubsidio,
  RondaSubsanacionPostulacion,
  SoporteDocumentoPostulacion
} from "../types";
import {
  generarTextoPortapapeles,
  generarPdfFormularioPostulacion,
  descargarExcelPresupuestoFase6
} from "../utils/herramientasFase6";
import {
  ItemDocumentoOficial28,
  CATALOGO_ESTRICTO_28_DOCUMENTOS,
  construirListaOficial28,
  analizarPaqueteComprimidoZip,
  generarPaqueteZipOficialFase6,
  ResultadoAnalisisZip
} from "../utils/documentosFase6";
import {
  Building2,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  UploadCloud,
  Eye,
  Plus,
  X,
  Copy,
  Download,
  FileSpreadsheet,
  Check,
  Archive,
  Search,
  Filter,
  FileCheck,
  Layers,
  Sparkles,
  HelpCircle,
  FileDown,
  Trash2,
  FileArchive,
  ShieldAlert,
  ShieldCheck,
  Info
} from "lucide-react";

interface Fase6PostulacionSubsidioProps {
  expediente: Expediente;
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
  }) => void;
  onActualizarExpediente: (nuevaFase?: number) => Promise<void>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export const Fase6PostulacionSubsidio: React.FC<Fase6PostulacionSubsidioProps> = ({
  expediente,
  currentUser,
  onAbrirVisor,
  onActualizarExpediente,
  authFetch
}) => {
  // Inicialización defensiva de la postulación
  const postulacion: PostulacionSubsidio = expediente.postulacionSubsidio || {
    id: `post-${expediente.id}`,
    expedienteId: expediente.id,
    estadoActual: "borrador",
    entidadPostulacion: "Compensar (Caja de Compensación Familiar)",
    documentosIncluidos: [],
    rondasSubsanacion: [],
    documentosCargaActiva: {},
    anexosLibres: [],
    historial: [],
    creadoEn: new Date().toISOString(),
    actualizadoEn: new Date().toISOString()
  };

  const estado = postulacion.estadoActual;

  // Permisos: Control total otorgado a Ingeniería y Administrador
  const puedeOperar = currentUser.rol === "ingenieria" || currentUser.rol === "administrador";
  const puedeAvanzarFase = true;

  // Lista canónica de los 28 documentos en orden estricto
  const [lista28, setLista28] = useState<ItemDocumentoOficial28[]>(() => construirListaOficial28(expediente));

  useEffect(() => {
    setLista28(construirListaOficial28(expediente));
  }, [expediente]);

  // Filtros y búsqueda en la tabla de los 28 documentos
  const [filtroEstado, setFiltroEstado] = useState<
    "todos" | "Añadido en Fase 6" | "Traído de Fase Anterior" | "Encontrado" | "No Encontrado" | "No Aplica"
  >("todos");
  const [busquedaTexto, setBusquedaTexto] = useState("");

  const itemsFiltrados = useMemo(() => {
    return lista28.filter((it) => {
      if (filtroEstado !== "todos" && it.estado !== filtroEstado) return false;
      if (busquedaTexto.trim()) {
        const query = busquedaTexto.toLowerCase().trim();
        const numStr = String(it.numero);
        const matchNombre = it.nombre.toLowerCase().includes(query);
        const matchArchivo = (it.nombreArchivoOriginal || "").toLowerCase().includes(query);
        const matchObs = it.observacionesValidacion.toLowerCase().includes(query);
        return numStr === query || matchNombre || matchArchivo || matchObs;
      }
      return true;
    });
  }, [lista28, filtroEstado, busquedaTexto]);

  // Contadores por estado
  const conteoTraidos = lista28.filter((d) => d.estado === "Traído de Fase Anterior").length;
  const conteoAnadidos = lista28.filter((d) => d.estado === "Añadido en Fase 6").length;
  const conteoEncontrados = lista28.filter((d) => d.estado === "Encontrado").length;
  const conteoFaltantes = lista28.filter((d) => d.estado === "No Encontrado").length;
  const conteoNoAplica = lista28.filter((d) => d.estado === "No Aplica").length;
  const totalListos = conteoTraidos + conteoAnadidos + conteoEncontrados;

  // Estados locales para herramientas y descargas
  const [copiadoPortapapeles, setCopiadoPortapapeles] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [descargandoZip, setDescargandoZip] = useState(false);
  const [progresoZip, setProgresoZip] = useState("");
  const [copiadoReporte, setCopiadoReporte] = useState(false);

  // Estados para procesamiento de archivos comprimidos (.ZIP / .RAR)
  const [procesandoZip, setProcesandoZip] = useState(false);
  const [resultadoZip, setResultadoZip] = useState<ResultadoAnalisisZip | null>(null);
  const [errorZip, setErrorZip] = useState<string | null>(null);
  const [aplicandoLote, setAplicandoLote] = useState(false);

  // Estados de modales
  const [modalAvanzarFase7, setModalAvanzarFase7] = useState(false);
  const [modalCargarDoc28, setModalCargarDoc28] = useState<ItemDocumentoOficial28 | null>(null);
  const [modalSubsanar, setModalSubsanar] = useState<RondaSubsanacionPostulacion | null>(null);
  const [modalNota, setModalNota] = useState(false);

  // Formulario Carga Documento Específico (de los 28)
  const [archivoDocSeleccionado, setArchivoDocSeleccionado] = useState<{
    nombre: string;
    mimeType: string;
    tamanoBytes: number;
    dataUrl: string;
  } | null>(null);
  const [cargandoAccion, setCargandoAccion] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  // Formulario Salto a Fase 7
  const [formNumResolucionCompensar, setFormNumResolucionCompensar] = useState(
    postulacion.numeroResolucionAsignacion || ""
  );
  const [archivoResolucionPdf, setArchivoResolucionPdf] = useState<{
    nombre: string;
    mimeType: string;
    tamanoBytes: number;
    dataUrl: string;
  } | null>(null);

  // Formulario Subsanación
  const [formFechaSubsanacion, setFormFechaSubsanacion] = useState(new Date().toISOString().split("T")[0]);
  const [formRadicadoSubsanacion, setFormRadicadoSubsanacion] = useState("");
  const [formDetalleSubsanacion, setFormDetalleSubsanacion] = useState("");
  const [archivoSubsanacion, setArchivoSubsanacion] = useState<{
    nombre: string;
    mimeType: string;
    tamanoBytes: number;
    dataUrl: string;
  } | null>(null);

  // Formulario Nota interna
  const [formTituloNota, setFormTituloNota] = useState("");
  const [formDescNota, setFormDescNota] = useState("");

  // Manejo de Tecla Escape en modales
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (modalAvanzarFase7) setModalAvanzarFase7(false);
        if (modalCargarDoc28 !== null) setModalCargarDoc28(null);
        if (modalSubsanar !== null) setModalSubsanar(null);
        if (modalNota) setModalNota(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalAvanzarFase7, modalCargarDoc28, modalSubsanar, modalNota]);

  // Manejo de carga de archivo genérico a Base64
  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<any | null>>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setter({
        nombre: file.name,
        mimeType: file.type || "application/pdf",
        tamanoBytes: file.size,
        dataUrl: reader.result as string
      });
      try {
        e.target.value = "";
      } catch {}
    };
    reader.readAsDataURL(file);
  };

  // 1. PROCESAMIENTO Y DESCOMPRESIÓN DE ARCHIVOS COMPRIMIDOS (.ZIP / .RAR)
  const handleProcesarArchivoZip = async (file: File) => {
    try {
      setProcesandoZip(true);
      setErrorZip(null);
      const resultado = await analizarPaqueteComprimidoZip(file);
      setResultadoZip(resultado);

      // Actualizar la vista preliminar de los 28 ítems
      setLista28(resultado.items);
    } catch (err: any) {
      console.error("[ERROR DESCOMPRIMIENDO ZIP]:", err);
      setErrorZip(
        "No fue posible descomprimir o procesar el archivo. Asegúrese de que sea un archivo .ZIP válido y no esté protegido por contraseña."
      );
    } finally {
      setProcesandoZip(false);
    }
  };

  const handleInputZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcesarArchivoZip(file);
    }
  };

  // 2. APLICAR CLASIFICACIÓN EN LOTE AL EXPEDIENTE (PERSISTIR EN BACKEND)
  const handleAplicarClasificacionLote = async () => {
    if (!resultadoZip) return;
    try {
      setAplicandoLote(true);
      const res = await authFetch(`/api/expedientes/${expediente.id}/postulacion/aplicar-lote-documentos-28`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: resultadoZip.items })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al sincronizar clasificación de documentos.");

      await onActualizarExpediente();
      setResultadoZip(null);
    } catch (err: any) {
      setErrorZip(err.message || "Error al guardar clasificación en el expediente.");
    } finally {
      setAplicandoLote(false);
    }
  };

  // 3. CARGA DE DOCUMENTO ESPECÍFICO A UNO DE LOS 28 PUESTOS
  const handleGuardarDoc28Individual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalCargarDoc28 || !archivoDocSeleccionado) {
      setErrorAccion("Debe seleccionar un archivo válido para cargar.");
      return;
    }
    try {
      setCargandoAccion(true);
      setErrorAccion(null);

      const res = await authFetch(`/api/expedientes/${expediente.id}/postulacion/documento-carga-activa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: modalCargarDoc28.codigo,
          nombreArchivo: archivoDocSeleccionado.nombre,
          mimeType: archivoDocSeleccionado.mimeType,
          tamanoBytes: archivoDocSeleccionado.tamanoBytes,
          archivoDataUrl: archivoDocSeleccionado.dataUrl
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar el documento.");

      setModalCargarDoc28(null);
      setArchivoDocSeleccionado(null);
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al guardar documento.");
    } finally {
      setCargandoAccion(false);
    }
  };

  // 4. DESCARGA MASIVA COMPRIMIDA (.ZIP) ORDENADA ESTRICTAMENTE DEL 01 AL 28
  const handleDescargaMasivaZipOficial = async () => {
    try {
      setDescargandoZip(true);
      setProgresoZip("Preparando 28 documentos en orden estricto...");

      const blobZip = await generarPaqueteZipOficialFase6(expediente, lista28, (msg) => {
        setProgresoZip(msg);
      });

      const url = URL.createObjectURL(blobZip);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Expediente_${expediente.codigoVisible || "VRD"}_Postulacion_Compensar_28_Documentos.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("[ERROR DESCARGA ZIP]:", err);
    } finally {
      setDescargandoZip(false);
      setProgresoZip("");
    }
  };

  // 5. COPIAR REPORTE OFICIAL EN TEXTO AL PORTAPAPELES
  const handleCopiarReporteAuditoria = async () => {
    const lineas = [
      "================================================================================",
      "REPORTE OFICIAL DE AUDITORÍA DOCUMENTAL — FASE 6 (POSTULACIÓN COMPENSAR)",
      "================================================================================",
      `Expediente: ${expediente.codigoVisible || expediente.id}`,
      `Titular: ${expediente.postulante.nombres}`,
      `Cédula: ${expediente.postulante.tipoIdentificacion} ${expediente.postulante.numeroIdentificacion}`,
      `Predio: ${expediente.predioVivienda?.nombreODireccion || "Rural"}`,
      `Fecha de Emisión: ${new Date().toLocaleString("es-CO")}`,
      "--------------------------------------------------------------------------------",
      "N° | NOMBRE DEL DOCUMENTO | ESTADO | ARCHIVO ENCONTRADO | OBSERVACIONES",
      "--------------------------------------------------------------------------------"
    ];

    lista28.forEach((d) => {
      lineas.push(
        `#${String(d.numero).padStart(2, "0")} | ${d.nombre} | [${d.estado}] | ${d.nombreArchivoOriginal || "(Sin archivo)"} | ${d.observacionesValidacion}`
      );
    });

    lineas.push("================================================================================");
    const texto = lineas.join("\n");

    try {
      await navigator.clipboard.writeText(texto);
      setCopiadoReporte(true);
      setTimeout(() => setCopiadoReporte(false), 3000);
    } catch {
      setCopiadoReporte(true);
      setTimeout(() => setCopiadoReporte(false), 3000);
    }
  };

  // 6. ACCIÓN: AVANZAR DIRECTO A FASE 7
  const handleAvanzarFase7Directo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCargandoAccion(true);
      setErrorAccion(null);
      const res = await authFetch(`/api/expedientes/${expediente.id}/postulacion/indicar-obra`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numeroResolucionAsignacion: formNumResolucionCompensar.trim() || `RES-COMP-${expediente.codigoVisible || "ASIG"}`,
          soporteResolucionPdf: archivoResolucionPdf,
          instruccionesObra: "Resolución de asignación y documentación registrada. Autorización de inicio de obra aprobada."
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al avanzar a Fase 7.");
      setModalAvanzarFase7(false);
      await onActualizarExpediente(7);
    } catch (err: any) {
      setErrorAccion(err.message || "Error al autorizar y avanzar a Fase 7.");
    } finally {
      setCargandoAccion(false);
    }
  };

  const estaAprobada =
    postulacion.resultadoRespuesta === "aprobada" ||
    estado === "aprobada" ||
    estado === "indicacion_obra_enviada";

  return (
    <div className="space-y-6" id="fase6-postulacion-root">
      {/* ========================================================================= */}
      {/* ENCABEZADO PRINCIPAL DE LA FASE 6 */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-100 text-orange-800 border border-orange-200">
                Fase 6 • Postulación Compensar
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                Norma Compensar • 28 Documentos
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 flex items-center space-x-2.5">
              <Building2 className="w-6 h-6 text-orange-600" />
              <span>Organización, Verificación y Postulación del Expediente</span>
            </h3>
            <p className="text-xs text-slate-500">
              Procesamiento de paquetes comprimidos, clasificación secuencial del 1 al 28 y radicación formal ante Compensar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* BADGE DE ESTADO */}
            <div
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border flex items-center space-x-1.5 ${
                estaAprobada
                  ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                  : "bg-amber-100 text-amber-900 border-amber-300"
              }`}
            >
              {estaAprobada ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>
                {estaAprobada
                  ? `Postulación Aprobada — Res: ${postulacion.numeroResolucionAsignacion || "Oficial"}`
                  : "En Integración y Seguimiento Compensar"}
              </span>
            </div>

            {/* BOTÓN DESCARGA MASIVA .ZIP (ORDEN 1 A 28) */}
            <button
              type="button"
              id="btn-descarga-masiva-zip-oficial"
              onClick={handleDescargaMasivaZipOficial}
              disabled={descargandoZip}
              className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center space-x-2 transition-all shadow-xs bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:scale-98 disabled:opacity-50"
              title="Descargar todos los 28 documentos en archivo comprimido .ZIP ordenados estrictamente del 01 al 28"
            >
              {descargandoZip ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>{progresoZip || "Empaquetando..."}</span>
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4" />
                  <span>Descargar Paquete ZIP (1 a 28)</span>
                </>
              )}
            </button>

            {/* BOTÓN AVANZAR A FASE 7 */}
            <button
              type="button"
              id="btn-avanzar-fase-7"
              onClick={() => {
                setErrorAccion(null);
                setModalAvanzarFase7(true);
              }}
              disabled={!puedeAvanzarFase || cargandoAccion}
              className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center space-x-2 transition-all shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-98"
              title="Registrar Postulación Aprobada y Avanzar a Fase 7"
            >
              <ArrowRight className="w-4 h-4" />
              <span>Avanzar a Fase 7 (Obra)</span>
            </button>
          </div>
        </div>

        {/* BARRA DE PROGRESO DE LOS 28 DOCUMENTOS */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-slate-600">
            <span className="font-semibold text-slate-800">Estado de Auditoría (28 Documentos):</span>
            {conteoTraidos > 0 && (
              <span className="inline-flex items-center space-x-1 text-blue-800 font-bold bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>{conteoTraidos} de Fases Previas</span>
              </span>
            )}
            {conteoAnadidos > 0 && (
              <span className="inline-flex items-center space-x-1 text-purple-800 font-bold bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                <Plus className="w-3.5 h-3.5 text-purple-600" />
                <span>{conteoAnadidos} Subidos en F6</span>
              </span>
            )}
            {conteoEncontrados > 0 && (
              <span className="inline-flex items-center space-x-1 text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{conteoEncontrados} en ZIP</span>
              </span>
            )}
            <span className="inline-flex items-center space-x-1 text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>{conteoFaltantes} No Encontrados</span>
            </span>
            {conteoNoAplica > 0 && (
              <span className="inline-flex items-center space-x-1 text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                <Info className="w-3.5 h-3.5 text-slate-500" />
                <span>{conteoNoAplica} No Aplica</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <div className="w-36 bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.round(((totalListos + conteoNoAplica) / 28) * 100)}%`
                }}
              />
            </div>
            <span className="font-mono font-bold text-slate-700">
              {Math.round(((totalListos + conteoNoAplica) / 28) * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BANNER DE REGLAS DE ORO Y EXCLUSIONES COMPENSAR */}
      {/* ========================================================================= */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 shadow-2xs">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5 text-amber-900" />
          </div>
          <div className="space-y-2 flex-1">
            <h4 className="font-bold text-xs uppercase tracking-wider text-amber-950">
              Directrices de Auditoría y Reglas Innegociables — Norma Compensar
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-amber-900">
              <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/80">
                <span className="font-bold block text-slate-900 mb-0.5">1. REGLA DE ORO: ORDEN ESTRICTO</span>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Es de carácter crítico mantener el orden secuencial de los documentos strictly enumerados del 1 al 28. Ningún documento debe cambiar de posición ni omitirse.
                </p>
              </div>

              <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/80">
                <span className="font-bold block text-slate-900 mb-0.5">2. EXCLUSIÓN EN COMPENSAR</span>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  NO exigir ni radicar la <em>Ficha de Caracterización Socioeconómica</em> ni el <em>Certificado Sisbén IV</em> para postulaciones en Compensar.
                </p>
              </div>

              <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/80">
                <span className="font-bold block text-slate-900 mb-0.5">3. SEPARACIÓN DE SERVICIOS Y ESCRITURA</span>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Los certificados de <strong>Agua</strong> y <strong>Energía</strong> deben entregarse completamente separados. La <strong>Escritura Pública</strong> debe quedar aparte del Certificado de Tradición y Libertad.
                </p>
              </div>

              <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/80 md:col-span-2 lg:col-span-3">
                <span className="font-bold block text-slate-900 mb-0.5">4. COMPOSICIÓN OBLIGATORIA DE PLANOS (#18)</span>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Todo lo correspondiente a los planos del proyecto se conforma obligatoriamente de: <strong>1. Planos estructurales</strong>, <strong>2. Planos arquitectónicos</strong>, <strong>3. Plano de implantación</strong>, <strong>4. Planos eléctricos</strong> y <strong>5. Planos hidrosanitarios</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* HERRAMIENTA: MANEJO Y PROCESAMIENTO DE ARCHIVOS COMPRIMIDOS (.ZIP / .RAR) */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 mb-5 gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
              <FileArchive className="w-4 h-4 text-indigo-700" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Manejo de Archivos Comprimidos (.ZIP / .RAR)
              </h4>
              <p className="text-xs text-slate-500">
                Carga el paquete comprimido del expediente para descomprimirlo, analizar su contenido interno y clasificar los 28 documentos automáticamente.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
            Descompresión Automática con JSZip
          </span>
        </div>

        {/* ZONA DE CARGA DEL ARCHIVO COMPRIMIDO */}
        <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 hover:bg-indigo-50/50 rounded-2xl p-6 text-center transition-colors">
          <input
            type="file"
            id="input-zip-expediente"
            accept=".zip,.rar,application/zip,application/x-zip-compressed,application/x-rar-compressed"
            onChange={handleInputZipChange}
            className="sr-only"
            disabled={procesandoZip}
          />
          <label
            htmlFor="input-zip-expediente"
            className="cursor-pointer flex flex-col items-center justify-center space-y-2"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-xs">
              {procesandoZip ? (
                <Clock className="w-6 h-6 animate-spin text-indigo-600" />
              ) : (
                <UploadCloud className="w-6 h-6 text-indigo-600" />
              )}
            </div>
            <div className="space-y-0.5">
              <span className="text-sm font-bold text-slate-800 block">
                {procesandoZip
                  ? "Descomprimiendo y analizando contenido interno del archivo..."
                  : "Arrastra o selecciona el archivo comprimido (.ZIP o .RAR)"}
              </span>
              <span className="text-xs text-slate-500 block">
                Analiza carpetas internas, verifica vigencias, firmas y asigna los archivos del 1 al 28
              </span>
            </div>
            <span className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-block shadow-xs mt-2 transition-colors">
              Explorar archivo .ZIP / .RAR
            </span>
          </label>
        </div>

        {errorZip && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorZip}</span>
          </div>
        )}

        {/* RESULTADOS DEL ANÁLISIS DEL ARCHIVO COMPRIMIDO */}
        {resultadoZip && (
          <div className="mt-5 p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-emerald-200">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="font-bold text-xs uppercase tracking-wider text-emerald-900">
                  Paquete Descomprimido con Éxito ({resultadoZip.totalArchivosInternos} archivos internos)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleAplicarClasificacionLote}
                  disabled={aplicandoLote}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{aplicandoLote ? "Guardando en expediente..." : "Aplicar Clasificación al Expediente"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setResultadoZip(null)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Archivos Leídos:</span>
                <span className="font-mono font-bold text-slate-800 text-sm">
                  {resultadoZip.totalArchivosInternos}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Clasificados (1 a 28):</span>
                <span className="font-mono font-bold text-emerald-700 text-sm">
                  {resultadoZip.archivosClasificados} de 28
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Pendientes / Faltantes:</span>
                <span className="font-mono font-bold text-amber-700 text-sm">
                  {resultadoZip.archivosFaltantes}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[11px]">Fecha Análisis:</span>
                <span className="font-mono text-slate-700 text-[11px] truncate block">
                  {resultadoZip.fechaAnalisis}
                </span>
              </div>
            </div>

            {/* ALERTAS NORMATIVAS DETECTADAS EN EL PAQUETE */}
            {resultadoZip.alertasNormativas.length > 0 && (
              <div className="p-3 bg-amber-100/70 border border-amber-300 rounded-xl space-y-1 text-xs text-amber-950">
                <div className="flex items-center space-x-1.5 font-bold">
                  <ShieldAlert className="w-4 h-4 text-amber-800" />
                  <span>Observaciones Especiales Detectadas en el Paquete:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-900 pl-1">
                  {resultadoZip.alertasNormativas.map((al, idx) => (
                    <li key={idx}>{al}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MATRIZ Y REPORTE OFICIAL DE LOS 28 DOCUMENTOS (ORDEN ESTRICTO 1 A 28) */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs">
              28
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Estructura y Orden Estricto de los 28 Documentos del Expediente
              </h4>
              <p className="text-xs text-slate-500">
                Reporte oficial de auditoría con validación de vigencias, firmas y comprobación documental.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopiarReporteAuditoria}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center space-x-1.5 shadow-2xs cursor-pointer"
              title="Copiar reporte oficial de auditoría en texto plano"
            >
              {copiadoReporte ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">¡Reporte Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copiar Reporte</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDescargaMasivaZipOficial}
              disabled={descargandoZip}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              title="Descargar ZIP comprimido con los 28 archivos enumerados"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar ZIP (01 a 28)</span>
            </button>
          </div>
        </div>

        {/* BARRA DE FILTROS Y BÚSQUEDA */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            <button
              type="button"
              onClick={() => setFiltroEstado("todos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filtroEstado === "todos"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Todos (28)
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstado("Traído de Fase Anterior")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                filtroEstado === "Traído de Fase Anterior"
                  ? "bg-blue-700 text-white shadow-xs"
                  : "bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200"
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>De Fases Previas ({conteoTraidos})</span>
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstado("Añadido en Fase 6")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                filtroEstado === "Añadido en Fase 6"
                  ? "bg-purple-700 text-white shadow-xs"
                  : "bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200"
              }`}
            >
              <Plus className="w-3 h-3" />
              <span>Subidos en F6 ({conteoAnadidos})</span>
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstado("Encontrado")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                filtroEstado === "Encontrado"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Encontrados ZIP ({conteoEncontrados})</span>
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstado("No Encontrado")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                filtroEstado === "No Encontrado"
                  ? "bg-amber-700 text-white shadow-xs"
                  : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>No Encontrados ({conteoFaltantes})</span>
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstado("No Aplica")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                filtroEstado === "No Aplica"
                  ? "bg-slate-700 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
              }`}
            >
              <Info className="w-3 h-3" />
              <span>No Aplica ({conteoNoAplica})</span>
            </button>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busquedaTexto}
              onChange={(e) => setBusquedaTexto(e.target.value)}
              placeholder="Buscar por número o nombre de documento..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* TABLA OFICIAL EN EL FORMATO EXACTO SOLICITADO */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 uppercase tracking-wider text-[11px] font-bold border-b border-slate-200">
                <th className="py-3 px-3 w-16 text-center">N°</th>
                <th className="py-3 px-4 min-w-[260px]">Nombre del Documento</th>
                <th className="py-3 px-3 w-36 text-center">Estado</th>
                <th className="py-3 px-4 min-w-[220px]">Nombre Original del Archivo</th>
                <th className="py-3 px-4 min-w-[300px]">Observaciones / Validaciones Especiales</th>
                <th className="py-3 px-3 w-36 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itemsFiltrados.map((item) => {
                const esTraidoAnterior = item.estado === "Traído de Fase Anterior";
                const esAnadidoF6 = item.estado === "Añadido en Fase 6";
                const esEncontradoZip = item.estado === "Encontrado";
                const esNoAplica = item.estado === "No Aplica";
                const esFaltante = item.estado === "No Encontrado";

                return (
                  <tr
                    key={item.numero}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      esFaltante ? "bg-amber-50/20" : ""
                    }`}
                  >
                    {/* COLUMNA 1: N° */}
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg font-mono font-bold text-xs bg-slate-100 text-slate-800 border border-slate-200">
                        {item.numero}
                      </span>
                    </td>

                    {/* COLUMNA 2: NOMBRE DEL DOCUMENTO */}
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-slate-900">{item.nombre}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                            {item.formatoEsperado}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1">
                          {item.descripcion}
                        </p>
                      </div>
                    </td>

                    {/* COLUMNA 3: ESTADO */}
                    <td className="py-3 px-3 text-center">
                      {esTraidoAnterior && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-300" title={item.faseOrigenNombre || "Fase previa"}>
                          <Layers className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                          <span>Fase {item.faseOrigenNum || "Previa"}</span>
                        </span>
                      )}
                      {esAnadidoF6 && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
                          <Plus className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                          <span>Subido en F6</span>
                        </span>
                      )}
                      {esEncontradoZip && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <span>Encontrado ZIP</span>
                        </span>
                      )}
                      {esFaltante && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span>No Encontrado</span>
                        </span>
                      )}
                      {esNoAplica && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                          <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>No Aplica</span>
                        </span>
                      )}
                    </td>

                    {/* COLUMNA 4: NOMBRE ORIGINAL DEL ARCHIVO ENCONTRADO */}
                    <td className="py-3 px-4">
                      {item.nombreArchivoOriginal ? (
                        <div className="flex items-center space-x-1.5">
                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span
                            className="font-mono text-xs text-slate-700 truncate max-w-[200px]"
                            title={item.nombreArchivoOriginal}
                          >
                            {item.nombreArchivoOriginal}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">
                          (Ningún archivo asignado)
                        </span>
                      )}
                    </td>

                    {/* COLUMNA 5: OBSERVACIONES / VALIDACIONES ESPECIALES */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <p className="text-[11px] text-slate-700 leading-snug">
                          {item.observacionesValidacion}
                        </p>
                        {item.numero === 18 && (
                          <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-800 text-[10px] font-bold border border-blue-200">
                            Nota: 5 especialidades (estructural, arq, implantación, eléctrico, hidro)
                          </span>
                        )}
                        {item.numero === 10 && (
                          <span className="inline-block px-2 py-0.5 rounded bg-purple-50 text-purple-800 text-[10px] font-bold border border-purple-200">
                            Nota: Separado de Tradición y Libertad
                          </span>
                        )}
                        {item.numero === 25 && (
                          <span className="inline-block px-2 py-0.5 rounded bg-teal-50 text-teal-800 text-[10px] font-bold border border-teal-200">
                            Nota: Agua y Energía en archivos independientes
                          </span>
                        )}
                      </div>
                    </td>

                    {/* COLUMNA 6: ACCIONES (ASIGNAR / REEMPLAZAR / VER) */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        {/* BOTÓN VER DOCUMENTO SI TIENE ARCHIVO */}
                        {(item.soporteUrl || item.nombreArchivoOriginal) && (
                          <button
                            type="button"
                            onClick={() => {
                              onAbrirVisor({
                                titulo: item.nombre,
                                nombreArchivo: item.nombreArchivoOriginal || `${item.codigo}.pdf`,
                                mimeType: item.mimeType || "application/pdf",
                                sha256Hash: item.sha256Hash || `sha256-${item.codigo}`,
                                tamanoBytes: item.tamanoBytes || 1024 * 200,
                                archivoDataUrl: item.soporteUrl
                              });
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 transition-colors cursor-pointer"
                            title="Ver documento en visor PDF"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* BOTÓN ASIGNAR (SI NO TIENE ARCHIVO) O REEMPLAZAR (SI YA TIENE) */}
                        {puedeOperar && (
                          esFaltante ? (
                            <button
                              type="button"
                              onClick={() => {
                                setErrorAccion(null);
                                setArchivoDocSeleccionado(null);
                                setModalCargarDoc28(item);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center space-x-1 transition-all cursor-pointer shadow-2xs shrink-0"
                              title="Asignar o cargar archivo a este requisito no asignado"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>+ Asignar</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setErrorAccion(null);
                                setArchivoDocSeleccionado(null);
                                setModalCargarDoc28(item);
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-orange-100 text-slate-600 hover:text-orange-700 transition-colors cursor-pointer flex items-center space-x-1 text-[11px] font-bold shrink-0"
                              title="Reemplazar archivo asignado para este ítem"
                            >
                              <UploadCloud className="w-3.5 h-3.5" />
                              <span>Reemplazar</span>
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* HERRAMIENTAS ADICIONALES DE AUTOMATIZACIÓN (PORTAPAPELES, FORMULARIO, EXCEL) */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100">
          Herramientas Complementarias de Postulación
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* HERRAMIENTA 1: DATOS PORTAPAPELES */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <Copy className="w-3.5 h-3.5 text-blue-600" />
                <span>Datos del Proyecto (Portapapeles)</span>
              </span>
              <p className="text-[11px] text-slate-500">
                Texto estructurado con datos del predio, titular y finanzas listo para radicación.
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                const txt = generarTextoPortapapeles(expediente);
                await navigator.clipboard.writeText(txt);
                setCopiadoPortapapeles(true);
                setTimeout(() => setCopiadoPortapapeles(false), 3000);
              }}
              className="mt-3 w-full py-2 px-3 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              {copiadoPortapapeles ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>¡Datos Copiados!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-blue-600" />
                  <span>Copiar Texto Consolidado</span>
                </>
              )}
            </button>
          </div>

          {/* HERRAMIENTA 2: FORMULARIO DILIGENCIADO PDF */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <FileDown className="w-3.5 h-3.5 text-orange-600" />
                <span>Formulario Oficial Compensar PDF</span>
              </span>
              <p className="text-[11px] text-slate-500">
                Formulario de postulación generado con datos del hogar y modalidad de subsidio rural.
              </p>
            </div>
            <button
              type="button"
              disabled={generandoPdf}
              onClick={() => {
                setGenerandoPdf(true);
                try {
                  const blob = generarPdfFormularioPostulacion(expediente);
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `Formulario_Postulacion_${expediente.codigoVisible || "VRD"}.pdf`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                } finally {
                  setGenerandoPdf(false);
                }
              }}
              className="mt-3 w-full py-2 px-3 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{generandoPdf ? "Generando..." : "Descargar Formulario PDF"}</span>
            </button>
          </div>

          {/* HERRAMIENTA 3: EXCEL PRESUPUESTO */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Presupuesto en Excel (.xlsx)</span>
              </span>
              <p className="text-[11px] text-slate-500">
                Plantilla nativa de presupuesto oficial y análisis de precios unitarios (APU).
              </p>
            </div>
            <button
              type="button"
              onClick={() => descargarExcelPresupuestoFase6(expediente)}
              className="mt-3 w-full py-2 px-3 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Descargar Presupuesto Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CARGAR O REEMPLAZAR DOCUMENTO ESPECÍFICO (DE LOS 28) */}
      {/* ========================================================================= */}
      {modalCargarDoc28 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="f6-modal-cargar-doc-titulo"
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <UploadCloud className="w-5 h-5 text-orange-600" />
                <h3 id="f6-modal-cargar-doc-titulo" className="font-bold text-sm text-slate-900">
                  Cargar Documento #{modalCargarDoc28.numero}: {modalCargarDoc28.nombre}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalCargarDoc28(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarDoc28Individual} className="space-y-4">
              {errorAccion && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorAccion}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
                <span className="font-bold text-slate-800 block">Especificaciones del Requisito:</span>
                <p>{modalCargarDoc28.descripcion}</p>
                {modalCargarDoc28.instruccionEspecial && (
                  <p className="text-orange-700 font-medium">{modalCargarDoc28.instruccionEspecial}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Seleccionar Archivo ({modalCargarDoc28.formatoEsperado}) *
                </label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors">
                  <input
                    type="file"
                    accept={
                      modalCargarDoc28.formatoEsperado === "XLSX"
                        ? ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        : "application/pdf"
                    }
                    onChange={(e) => handleFileChange(e, setArchivoDocSeleccionado)}
                    className="sr-only"
                    id="input-archivo-doc-28"
                  />
                  <label
                    htmlFor="input-archivo-doc-28"
                    className="cursor-pointer flex flex-col items-center justify-center space-y-1.5"
                  >
                    <UploadCloud className="w-6 h-6 text-orange-600" />
                    <span className="text-xs font-bold text-slate-700">
                      {archivoDocSeleccionado ? archivoDocSeleccionado.nombre : "Seleccionar Archivo"}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {modalCargarDoc28.formatoEsperado === "XLSX" ? "Hoja de cálculo Excel (.xlsx)" : "Archivo PDF firmado o escaneado"}
                    </span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalCargarDoc28(null)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargandoAccion || !archivoDocSeleccionado}
                  className="px-4 py-2 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {cargandoAccion ? "Guardando..." : "Guardar Documento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SALTO DIRECTO A FASE 7 (INICIO DE OBRA) */}
      {/* ========================================================================= */}
      {modalAvanzarFase7 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="f6-modal-avanzar-f7-titulo"
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 id="f6-modal-avanzar-f7-titulo" className="font-bold text-base text-slate-900">
                  Registrar Postulación Aprobada y Avanzar a Fase 7
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalAvanzarFase7(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAvanzarFase7Directo} className="space-y-4">
              {errorAccion && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorAccion}</span>
                </div>
              )}

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
                <strong>Registro de Postulación Aprobada:</strong> Puede registrar opcionalmente el número de resolución y/o adjuntar el soporte oficial para autorizar el inicio de obra y avanzar a Fase 7.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  1. Número de la Resolución emitida por Compensar (Opcional)
                </label>
                <input
                  type="text"
                  value={formNumResolucionCompensar}
                  onChange={(e) => setFormNumResolucionCompensar(e.target.value)}
                  placeholder="Ej: RES-COMP-ASIG-2026-088"
                  className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  2. Documento de Resolución Oficial (PDF) (Opcional)
                </label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => handleFileChange(e, setArchivoResolucionPdf)}
                    className="sr-only"
                    id="file-resolucion-compensar"
                  />
                  <label
                    htmlFor="file-resolucion-compensar"
                    className="cursor-pointer flex flex-col items-center justify-center space-y-1.5"
                  >
                    <UploadCloud className="w-6 h-6 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-700">
                      {archivoResolucionPdf ? archivoResolucionPdf.nombre : "Seleccionar Resolución PDF (Opcional)"}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Archivo PDF firmado y emitido por Compensar
                    </span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalAvanzarFase7(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargandoAccion}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {cargandoAccion ? "Procesando..." : "Autorizar y Avanzar a Fase 7"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
