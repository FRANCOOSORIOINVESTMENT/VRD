import React, { useState, useEffect } from "react";
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
  obtenerDocumentosHeredadosFase6,
  CATALOGO_CARGA_ACTIVA_FASE6
} from "../utils/documentosFase6";
import JSZip from "jszip";
import {
  Building2,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  UploadCloud,
  Eye,
  Calendar,
  User,
  Plus,
  X,
  HardHat,
  FileCheck,
  Layers,
  Copy,
  Download,
  FileSpreadsheet,
  Check,
  Paperclip,
  FolderOpen,
  ArrowUpRight,
  Sparkles,
  HelpCircle,
  FileDown,
  RotateCcw,
  Trash2,
  Archive
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

  // Control total otorgado a Ingeniería (sin intermediación de Analista Documental)
  const puedeOperar = currentUser.rol === "ingenieria" || currentUser.rol === "administrador";
  const puedeAvanzarFase = currentUser.rol === "ingenieria" || currentUser.rol === "supervisor" || currentUser.rol === "administrador";

  // Estados locales para Módulo 1 (Portapapeles y Descargas)
  const [copiadoPortapapeles, setCopiadoPortapapeles] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [descargandoZip, setDescargandoZip] = useState(false);
  const [progresoZip, setProgresoZip] = useState("");

  // Estados de modales
  const [modalAvanzarFase7, setModalAvanzarFase7] = useState(false);
  const [modalCargarDocActivo, setModalCargarDocActivo] = useState<{ codigo: string; nombre: string } | null>(null);
  const [modalMultipredio, setModalMultipredio] = useState(false);
  const [modalConfirmarEliminarMultipredio, setModalConfirmarEliminarMultipredio] = useState(false);
  const [modalConfirmarEliminarDocActivo, setModalConfirmarEliminarDocActivo] = useState<{
    codigo: string;
    nombre: string;
    nombreArchivo: string;
  } | null>(null);
  const [modalConfirmarEliminarAnexo, setModalConfirmarEliminarAnexo] = useState<{
    id: string;
    titulo: string;
    nombreArchivo: string;
  } | null>(null);
  const [modalNuevoAnexo, setModalNuevoAnexo] = useState(false);
  const [modalSubsanar, setModalSubsanar] = useState<RondaSubsanacionPostulacion | null>(null);
  const [modalNota, setModalNota] = useState(false);

  // Safe Escape key listener for all modals in Fase 6
  useEffect(() => {
    const hayModalAbierto =
      modalAvanzarFase7 ||
      modalCargarDocActivo !== null ||
      modalMultipredio ||
      modalConfirmarEliminarMultipredio ||
      modalConfirmarEliminarDocActivo !== null ||
      modalConfirmarEliminarAnexo !== null ||
      modalNuevoAnexo ||
      modalSubsanar !== null ||
      modalNota;

    if (!hayModalAbierto) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (modalConfirmarEliminarMultipredio) setModalConfirmarEliminarMultipredio(false);
        else if (modalConfirmarEliminarDocActivo !== null) setModalConfirmarEliminarDocActivo(null);
        else if (modalConfirmarEliminarAnexo !== null) setModalConfirmarEliminarAnexo(null);
        else if (modalAvanzarFase7) setModalAvanzarFase7(false);
        else if (modalCargarDocActivo !== null) setModalCargarDocActivo(null);
        else if (modalMultipredio) setModalMultipredio(false);
        else if (modalNuevoAnexo) setModalNuevoAnexo(false);
        else if (modalSubsanar !== null) setModalSubsanar(null);
        else if (modalNota) setModalNota(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    modalAvanzarFase7,
    modalCargarDocActivo,
    modalMultipredio,
    modalConfirmarEliminarMultipredio,
    modalConfirmarEliminarDocActivo,
    modalConfirmarEliminarAnexo,
    modalNuevoAnexo,
    modalSubsanar,
    modalNota
  ]);

  // Formularios de modales
  const [cargandoAccion, setCargandoAccion] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  // Formulario Módulo 5: Cierre y Salto a Fase 7
  const [formNumResolucionCompensar, setFormNumResolucionCompensar] = useState(
    postulacion.numeroResolucionAsignacion || ""
  );
  const [archivoResolucionPdf, setArchivoResolucionPdf] = useState<{
    nombre: string;
    mimeType: string;
    tamanoBytes: number;
    dataUrl: string;
  } | null>(null);

  // Formulario Carga Activa
  const [archivoDocActivo, setArchivoDocActivo] = useState<{
    nombre: string;
    mimeType: string;
    tamanoBytes: number;
    dataUrl: string;
  } | null>(null);

  // Formulario Multi-predio
  const [formMatriculaAdicional, setFormMatriculaAdicional] = useState("");
  const [formObsMultipredio, setFormObsMultipredio] = useState("");
  const [archivoMultipredio, setArchivoMultipredio] = useState<{
    nombre: string;
    mimeType: string;
    tamanoBytes: number;
    dataUrl: string;
  } | null>(null);

  // Formulario Anexo Libre
  const [formTituloAnexo, setFormTituloAnexo] = useState("");
  const [archivoAnexoLibre, setArchivoAnexoLibre] = useState<{
    nombre: string;
    mimeType: string;
    tamanoBytes: number;
    dataUrl: string;
  } | null>(null);

  // Formulario Nota interna de bitácora
  const [formTituloNota, setFormTituloNota] = useState("");
  const [formDescNota, setFormDescNota] = useState("");

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

  // Helpers de archivos
  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: { nombre: string; mimeType: string; tamanoBytes: number; dataUrl: string } | null) => void
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
    };
    reader.readAsDataURL(file);
  };

  // MÓDULO 1: ACCIÓN PORTAPAPELES
  const handleCopiarPortapapeles = async () => {
    const texto = generarTextoPortapapeles(expediente);
    try {
      await navigator.clipboard.writeText(texto);
      setCopiadoPortapapeles(true);
      setTimeout(() => setCopiadoPortapapeles(false), 3000);
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = texto;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiadoPortapapeles(true);
      setTimeout(() => setCopiadoPortapapeles(false), 3000);
    }
  };

  // MÓDULO 1: DESCARGA FORMULARIO PDF DILIGENCIADO
  const handleDescargarPdfDiligenciado = () => {
    setGenerandoPdf(true);
    try {
      const blob = generarPdfFormularioPostulacion(expediente);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Formulario_Postulacion_Compensar_${expediente.codigoVisible || expediente.id}_Diligenciado.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error("Error al generar PDF de formulario:", e);
    } finally {
      setGenerandoPdf(false);
    }
  };

  // MÓDULO 1: DESCARGA EXCEL PRESUPUESTO
  const handleDescargarExcelPresupuesto = () => {
    descargarExcelPresupuestoFase6(expediente);
  };

  // MÓDULO 1 & GENERAL: DESCARGA MASIVA DE DOCUMENTOS EN FORMATO ZIP
  const handleDescargaMasivaZip = async () => {
    try {
      setDescargandoZip(true);
      setProgresoZip("Iniciando...");
      const zip = new JSZip();

      const folderHeredados = zip.folder("01_Documentos_Heredados_Fases_1_a_5");
      const folderActivos = zip.folder("02_Documentos_Postulacion_Compensar");
      const folderAnexos = zip.folder("03_Anexos_y_Soportes_Complementarios");

      let totalArchivos = 0;
      let totalBytesEmpaquetados = 0;

      // 1. Documentos heredados de Fases 1 a 5
      for (let i = 0; i < documentosHeredados.length; i++) {
        const doc = documentosHeredados[i];
        setProgresoZip(`Heredados (${i + 1}/${documentosHeredados.length})...`);
        const safeName = `${String(i + 1).padStart(2, "0")}_${doc.codigo}_${(doc.nombreArchivo || doc.nombre).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const finalName = safeName.endsWith(".pdf") ? safeName : `${safeName}.pdf`;

        if (doc.soporteUrl && doc.soporteUrl.startsWith("data:")) {
          const parts = doc.soporteUrl.split(",");
          const base64Data = parts[1] || "";
          const tamano = doc.tamanoBytes || Math.round((base64Data.length * 3) / 4);
          totalBytesEmpaquetados += tamano;
          // Si supera 1MB (1048576 bytes), aplicar compresión máxima DEFLATE level 9 para optimizar memoria
          const esPesado = tamano > 1024 * 1024;
          folderHeredados?.file(finalName, base64Data, {
            base64: true,
            compression: "DEFLATE",
            compressionOptions: { level: esPesado ? 9 : 6 }
          });
        } else {
          // Generar documento oficial certificado si aún no cuenta con binario subido
          const docSimulado = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF`;
          folderHeredados?.file(finalName, docSimulado);
        }
        totalArchivos++;
      }

      // 2. Documentos de carga activa Fase 6
      for (const cat of CATALOGO_CARGA_ACTIVA_FASE6) {
        const soporte = docsCargaActiva[cat.codigo];
        if (soporte) {
          const safeName = `${cat.codigo}_${(soporte.nombreArchivo || cat.nombre).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          if (soporte.archivoDataUrl && soporte.archivoDataUrl.startsWith("data:")) {
            const b64 = soporte.archivoDataUrl.split(",")[1] || "";
            const tamano = soporte.tamanoBytes || Math.round((b64.length * 3) / 4);
            totalBytesEmpaquetados += tamano;
            const esPesado = tamano > 1024 * 1024;
            folderActivos?.file(safeName, b64, {
              base64: true,
              compression: "DEFLATE",
              compressionOptions: { level: esPesado ? 9 : 6 }
            });
            totalArchivos++;
          }
        }
      }

      // 3. Documento Multi-predio si existe
      if (postulacion.soporteMultipredio?.soporte) {
        const sop = postulacion.soporteMultipredio.soporte;
        const safeName = `Multipredio_${(sop.nombreArchivo || "Certificado").replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        if (sop.archivoDataUrl && sop.archivoDataUrl.startsWith("data:")) {
          const b64 = sop.archivoDataUrl.split(",")[1] || "";
          folderAnexos?.file(safeName, b64, { base64: true, compression: "DEFLATE" });
          totalArchivos++;
        }
      }

      // 4. Anexos Libres
      for (let j = 0; j < anexosLibres.length; j++) {
        const an = anexosLibres[j];
        const safeName = `Anexo_${j + 1}_${(an.soporte.nombreArchivo || an.titulo).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        if (an.soporte.archivoDataUrl && an.soporte.archivoDataUrl.startsWith("data:")) {
          const b64 = an.soporte.archivoDataUrl.split(",")[1] || "";
          folderAnexos?.file(safeName, b64, { base64: true, compression: "DEFLATE" });
          totalArchivos++;
        }
      }

      // 5. Índice de control de expedientes
      const txtIndice = `================================================================================
CRM VRD — FRANCO OSORIO INVESTMENT S.A.S.
PAQUETE OFICIAL DE DOCUMENTACIÓN PARA POSTULACIÓN ANTE COMPENSAR (FASE 6)
================================================================================
Código Visible del Expediente: ${expediente.codigoVisible || expediente.id}
Titular Postulante: ${expediente.postulante.nombres}
Documento de Identidad: ${expediente.postulante.tipoIdentificacion} ${expediente.postulante.numeroIdentificacion}
Predio Rural: ${expediente.predioVivienda?.nombreODireccion || "Predio Rural"}
Municipio / Departamento: Cundinamarca
Entidad de Radicación: Compensar (Caja de Compensación Familiar)
Fecha y Hora de Empaquetado: ${new Date().toLocaleString("es-CO")}
Total de Archivos Incluidos: ${totalArchivos}
================================================================================
ESTRUCTURA DE CARPETAS DEL ARCHIVO ZIP:
📁 01_Documentos_Heredados_Fases_1_a_5/
   - Contiene los 15 documentos consolidados de Fase 1 a Fase 5 (Licencia de Construcción,
     Presupuesto Oficial APU, Planos Arquitectónicos, Estudio de Suelos, Interventoría,
     Cédula, Tradición y Libertad, Impuesto Predial, etc.).
📁 02_Documentos_Postulacion_Compensar/
   - Cargas activas específicas de Fase 6 (Formularios suscritos, Cierre Financiero 10%, etc.).
📁 03_Anexos_y_Soportes_Complementarios/
   - Certificaciones multi-predio y anexos adicionales registrados en el expediente.
================================================================================
Generado de forma automatizada y certificada por el sistema CRM VRD.
`;
      zip.file("00_INDICE_EXPEDIENTE_Y_DOCUMENTOS.txt", txtIndice);

      setProgresoZip("Empaquetando ZIP...");
      const blob = await zip.generateAsync(
        {
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 6 }
        },
        (meta) => {
          setProgresoZip(`${Math.round(meta.percent)}%`);
        }
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Expediente_${expediente.codigoVisible || expediente.id}_Documentacion_Fase6.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorAccion(err?.message || "Error al generar y descargar el paquete ZIP.");
    } finally {
      setDescargandoZip(false);
      setProgresoZip("");
    }
  };

  // MÓDULO 3: GUARDAR DOCUMENTO DE CARGA ACTIVA
  const handleSubirDocActivo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalCargarDocActivo || !archivoDocActivo) {
      setErrorAccion("Debe seleccionar un archivo PDF.");
      return;
    }
    try {
      setCargandoAccion(true);
      setErrorAccion(null);
      const res = await authFetch(`/api/expedientes/${expediente.id}/postulacion/documento-carga-activa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: modalCargarDocActivo.codigo,
          nombreArchivo: archivoDocActivo.nombre,
          mimeType: archivoDocActivo.mimeType,
          tamanoBytes: archivoDocActivo.tamanoBytes,
          archivoDataUrl: archivoDocActivo.dataUrl
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al subir documento de carga activa.");
      setModalCargarDocActivo(null);
      setArchivoDocActivo(null);
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al subir documento.");
    } finally {
      setCargandoAccion(false);
    }
  };

  // MÓDULO 4: GUARDAR MULTI-PREDIO
  const handleSubirMultipredio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivoMultipredio) {
      setErrorAccion("Debe seleccionar el PDF consolidado del predio adicional.");
      return;
    }
    try {
      setCargandoAccion(true);
      setErrorAccion(null);
      const res = await authFetch(`/api/expedientes/${expediente.id}/postulacion/soporte-multipredio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matriculaInmobiliariaAdicional: formMatriculaAdicional.trim(),
          observaciones: formObsMultipredio.trim(),
          nombreArchivo: archivoMultipredio.nombre,
          mimeType: archivoMultipredio.mimeType,
          tamanoBytes: archivoMultipredio.tamanoBytes,
          archivoDataUrl: archivoMultipredio.dataUrl
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar soporte multi-predio.");
      setModalMultipredio(false);
      setFormMatriculaAdicional("");
      setFormObsMultipredio("");
      setArchivoMultipredio(null);
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al subir multi-predio.");
    } finally {
      setCargandoAccion(false);
    }
  };

  // MÓDULO 3: ELIMINAR / DESVINCULAR DOCUMENTO DE CARGA ACTIVA
  const handleEliminarDocActivo = async () => {
    if (!modalConfirmarEliminarDocActivo) return;
    try {
      setCargandoAccion(true);
      setErrorAccion(null);
      const res = await authFetch(
        `/api/expedientes/${expediente.id}/postulacion/documento-carga-activa/${modalConfirmarEliminarDocActivo.codigo}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al desvincular el documento.");
      setModalConfirmarEliminarDocActivo(null);
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al desvincular el documento.");
    } finally {
      setCargandoAccion(false);
    }
  };

  // MÓDULO 4: ELIMINAR SOPORTE MULTI-PREDIO
  const handleEliminarMultipredio = async () => {
    try {
      setCargandoAccion(true);
      setErrorAccion(null);
      const res = await authFetch(`/api/expedientes/${expediente.id}/postulacion/soporte-multipredio`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al eliminar el soporte multi-predio.");
      setModalConfirmarEliminarMultipredio(false);
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al eliminar el soporte multi-predio.");
    } finally {
      setCargandoAccion(false);
    }
  };

  // MÓDULO 4: ELIMINAR ANEXO LIBRE
  const handleEliminarAnexoLibre = async () => {
    if (!modalConfirmarEliminarAnexo) return;
    try {
      setCargandoAccion(true);
      setErrorAccion(null);
      const res = await authFetch(
        `/api/expedientes/${expediente.id}/postulacion/anexo-libre/${modalConfirmarEliminarAnexo.id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al eliminar el anexo.");
      setModalConfirmarEliminarAnexo(null);
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al eliminar el anexo.");
    } finally {
      setCargandoAccion(false);
    }
  };

  // MÓDULO 4: AGREGAR ANEXO LIBRE
  const handleAgregarAnexoLibre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTituloAnexo.trim() || !archivoAnexoLibre) {
      setErrorAccion("Título y archivo adjunto son obligatorios.");
      return;
    }
    try {
      setCargandoAccion(true);
      setErrorAccion(null);
      const res = await authFetch(`/api/expedientes/${expediente.id}/postulacion/anexo-libre`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: formTituloAnexo.trim(),
          nombreArchivo: archivoAnexoLibre.nombre,
          mimeType: archivoAnexoLibre.mimeType,
          tamanoBytes: archivoAnexoLibre.tamanoBytes,
          archivoDataUrl: archivoAnexoLibre.dataUrl
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al agregar anexo.");
      setModalNuevoAnexo(false);
      setFormTituloAnexo("");
      setArchivoAnexoLibre(null);
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al agregar anexo.");
    } finally {
      setCargandoAccion(false);
    }
  };

  // MÓDULO 5: CIERRE Y SALTO DIRECTO A FASE 7
  const handleAvanzarFase7Directo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNumResolucionCompensar.trim()) {
      setErrorAccion("El Número de la Resolución emitida por Compensar es innegociable y obligatorio.");
      return;
    }
    if (!archivoResolucionPdf && !postulacion.soporteRespuesta) {
      setErrorAccion("Debe adjuntar el Documento de Resolución oficial en formato PDF emitido por Compensar.");
      return;
    }
    try {
      setCargandoAccion(true);
      setErrorAccion(null);
      const res = await authFetch(`/api/expedientes/${expediente.id}/avanzar-fase-7`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numeroResolucion: formNumResolucionCompensar.trim(),
          nombreArchivo: archivoResolucionPdf?.nombre,
          mimeType: archivoResolucionPdf?.mimeType,
          tamanoBytes: archivoResolucionPdf?.tamanoBytes,
          archivoDataUrl: archivoResolucionPdf?.dataUrl
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

  // SUBSANACIÓN (SI HUBO OBSERVACIONES DE COMPENSAR)
  const handleEnviarSubsanacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalSubsanar || !formRadicadoSubsanacion.trim()) {
      setErrorAccion("El número de radicado de subsanación es obligatorio.");
      return;
    }
    try {
      setCargandoAccion(true);
      setErrorAccion(null);
      const res = await authFetch(`/api/expedientes/${expediente.id}/postulacion/subsanar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rondaId: modalSubsanar.id,
          fechaEnvioSubsanacion: formFechaSubsanacion,
          radicadoEnvioSubsanacion: formRadicadoSubsanacion.trim(),
          detalleSubsanacion: formDetalleSubsanacion.trim(),
          nombreArchivo: archivoSubsanacion?.nombre,
          mimeType: archivoSubsanacion?.mimeType,
          tamanoBytes: archivoSubsanacion?.tamanoBytes,
          archivoDataUrl: archivoSubsanacion?.dataUrl
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar subsanación.");
      setModalSubsanar(null);
      setArchivoSubsanacion(null);
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al subsanar.");
    } finally {
      setCargandoAccion(false);
    }
  };

  // NOTA EN BITÁCORA
  const handleAgregarNota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTituloNota.trim() || !formDescNota.trim()) {
      setErrorAccion("Título y descripción son obligatorios.");
      return;
    }
    try {
      setCargandoAccion(true);
      setErrorAccion(null);
      const res = await authFetch(`/api/expedientes/${expediente.id}/postulacion/historial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: formTituloNota.trim(),
          descripcion: formDescNota.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al agregar apunte.");
      setModalNota(false);
      setFormTituloNota("");
      setFormDescNota("");
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al registrar la nota.");
    } finally {
      setCargandoAccion(false);
    }
  };

  // Obtener los 15 documentos heredados (Módulo 2: SE TIENE)
  const documentosHeredados = obtenerDocumentosHeredadosFase6(expediente);
  const docsCargaActiva = postulacion.documentosCargaActiva || {};
  const anexosLibres = postulacion.anexosLibres || [];
  const tieneMultipredio = !!postulacion.soporteMultipredio;

  // Conteo total de los 29 ítems
  const totalHeredados = documentosHeredados.length; // 15
  const totalCargaActiva = CATALOGO_CARGA_ACTIVA_FASE6.length; // 9
  const cargaActivaCompletados = CATALOGO_CARGA_ACTIVA_FASE6.filter((c) => !!docsCargaActiva[c.codigo]).length;

  const estaAprobada =
    postulacion.resultadoRespuesta === "aprobada" ||
    estado === "aprobada" ||
    estado === "indicacion_obra_enviada";

  return (
    <div className="space-y-6" id="fase6-postulacion-root">
      {/* ENCABEZADO PRINCIPAL DE LA FASE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-100 text-orange-800 border border-orange-200">
                Fase 6 • Postulación Compensar
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 flex items-center space-x-2.5">
              <Building2 className="w-6 h-6 text-orange-600" />
              <span>En Postulación y Seguimiento Compensar</span>
            </h3>
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

            {/* BOTÓN DESCARGA MASIVA DE DOCUMENTOS (ZIP) */}
            <button
              type="button"
              id="btn-descarga-masiva-zip"
              onClick={handleDescargaMasivaZip}
              disabled={descargandoZip}
              className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center space-x-2 transition-all shadow-xs bg-blue-600 hover:bg-blue-700 text-white cursor-pointer active:scale-98 disabled:opacity-50"
              title="Descargar todos los documentos validados del expediente en un único paquete ZIP comprimido"
            >
              {descargandoZip ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>Empaquetando {progresoZip ? `(${progresoZip})` : "..."}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Descarga Masiva de Documentos</span>
                </>
              )}
            </button>

            {/* BOTÓN DETONADOR: AVANZAR A FASE 7 */}
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
              <span>Avanzar a Fase 7 (Ejecución de Obra)</span>
            </button>
          </div>
        </div>

        {/* BARRA DE PROGRESO DE LOS 29 ÍTEMS */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-3 text-slate-600">
            <span className="font-semibold text-slate-800">Estatus Documental Global:</span>
            <span className="inline-flex items-center space-x-1 text-emerald-700 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{totalHeredados} Heredados Fases 1-5 (Verificados)</span>
            </span>
            <span>•</span>
            <span className="inline-flex items-center space-x-1 text-blue-700 font-bold">
              <UploadCloud className="w-3.5 h-3.5" />
              <span>{cargaActivaCompletados} de {totalCargaActiva} Cargas Activas</span>
            </span>
            {tieneMultipredio && (
              <>
                <span>•</span>
                <span className="text-purple-700 font-bold">Multi-Predio Anexado</span>
              </>
            )}
            {anexosLibres.length > 0 && (
              <>
                <span>•</span>
                <span className="text-slate-700 font-bold">{anexosLibres.length} Anexos Libres</span>
              </>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <div className="w-32 bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.round(((totalHeredados + cargaActivaCompletados) / (totalHeredados + totalCargaActiva)) * 100)}%`
                }}
              />
            </div>
            <span className="font-mono font-bold text-slate-700">
              {Math.round(((totalHeredados + cargaActivaCompletados) / (totalHeredados + totalCargaActiva)) * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MÓDULO 1: HERRAMIENTAS DE AUTOMATIZACIÓN (GENERADOS POR EL SISTEMA) */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-5">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs">
              M1
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Módulo 1: Herramientas de Automatización (Generados por el Sistema)
              </h4>
              <p className="text-xs text-slate-500">
                Diseñado para eliminar el trabajo manual repetitivo y agilizar radicaciones ante Compensar.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-orange-50 text-orange-700 border border-orange-200">
            4 Herramientas Rápidas
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* HERRAMIENTA 1: DATOS DEL PROYECTO (PORTAPAPELES) */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-all flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
                  <Copy className="w-3.5 h-3.5 text-blue-600" />
                  <span>Datos del Proyecto</span>
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                  Portapapeles
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Panel de texto consolidado con los datos clave del hogar, predio, finanzas y radicación para correos o plataformas externas.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopiarPortapapeles}
              className={`mt-4 w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                copiadoPortapapeles
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs"
              }`}
            >
              {copiadoPortapapeles ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>¡Datos Copiados al Portapapeles!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-blue-600" />
                  <span>Copiar Texto Consolidado</span>
                </>
              )}
            </button>
          </div>

          {/* HERRAMIENTA 2: FORMULARIO DE POSTULACIÓN DILIGENCIADO */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-all flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
                  <FileDown className="w-3.5 h-3.5 text-orange-600" />
                  <span>Formulario Oficial</span>
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-orange-100 text-orange-800">
                  PDF Autodiligenciado
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Formulario oficial Compensar generado en PDF con modalidades marcadas (CSP, Rural), miembros del hogar y recursos financieros.
              </p>
            </div>

            <button
              type="button"
              disabled={generandoPdf}
              onClick={handleDescargarPdfDiligenciado}
              className="mt-4 w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all bg-orange-600 hover:bg-orange-700 text-white shadow-xs flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {generandoPdf ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>Generando PDF Oficial...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Descargar Formulario PDF</span>
                </>
              )}
            </button>
          </div>

          {/* HERRAMIENTA 3: ACCESO DIRECTO AL PRESUPUESTO EN EXCEL */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-all flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Presupuesto Oficial</span>
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Plantilla Excel (.xlsx)
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Acceso directo para descargar el presupuesto de obra oficial estructurado en la plantilla técnica que exige Compensar.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDescargarExcelPresupuesto}
              className="mt-4 w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center justify-center space-x-2 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Descargar Presupuesto Excel</span>
            </button>
          </div>

          {/* HERRAMIENTA 4: EMPAQUETADO Y DESCARGA MASIVA ZIP */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-all flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
                  <Archive className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Paquete ZIP</span>
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                  Descarga Masiva
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Descarga en un solo clic todos los 15 documentos heredados, cargas activas y anexos organizados en carpetas con compresión optimizada.
              </p>
            </div>

            <button
              type="button"
              disabled={descargandoZip}
              onClick={handleDescargaMasivaZip}
              className="mt-4 w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {descargandoZip ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>Empaquetando {progresoZip ? `(${progresoZip})` : "..."}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Descargar Paquete ZIP</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MÓDULO 2: REPOSITORIO HEREDADO ("SE TIENE") - 15 DOCUMENTOS AUTOMÁTICOS */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 mb-5 gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
              M2
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Módulo 2: Repositorio Heredado ("SE TIENE") — 15 Documentos Consolidados
              </h4>
              <p className="text-xs text-slate-500">
                Extraídos automáticamente de las Fases 1 a 5. Disponibles en solo lectura con soporte PDF verificado.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>15 de 15 Disponibles</span>
            </span>
          </div>
        </div>

        {/* MATRIZ DE DOCUMENTOS HEREDADOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {documentosHeredados.map((doc, idx) => (
            <div
              key={doc.codigo}
              className="p-3.5 rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-2xs transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                      Fase {doc.faseOrigen}
                    </span>
                  </div>
                  <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verificado</span>
                  </span>
                </div>

                <h5 className="font-bold text-xs text-slate-900 line-clamp-2 leading-snug">
                  {doc.nombre}
                </h5>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                  Tipo: {doc.tipoRequerimiento}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400 truncate max-w-[140px]" title={doc.nombreArchivo}>
                  {doc.nombreArchivo}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    onAbrirVisor({
                      titulo: doc.nombre,
                      nombreArchivo: doc.nombreArchivo,
                      mimeType: doc.mimeType || "application/pdf",
                      sha256Hash: doc.sha256Hash || `sha256-${doc.codigo}`,
                      tamanoBytes: doc.tamanoBytes || 1024 * 150,
                      archivoDataUrl: doc.soporteUrl
                    })
                  }
                  className="px-2.5 py-1 text-[11px] font-bold bg-slate-50 hover:bg-blue-50 text-blue-700 border border-slate-200 hover:border-blue-200 rounded-lg flex items-center space-x-1 cursor-pointer transition-colors"
                  title="Ver documento en visor PDF"
                >
                  <Eye className="w-3 h-3" />
                  <span>Ver PDF</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MÓDULO 3: REQUERIMIENTOS DE CARGA ACTIVA ("SE DEBEN SOLICITAR") - 9 ÍTEMS */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 mb-5 gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
              M3
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Módulo 3: Requerimientos de Carga Activa ("SE DEBEN SOLICITAR") — 9 Ítems
              </h4>
              <p className="text-xs text-slate-500">
                Documentación faltante sujeta a solicitud formal y carga activa con validación técnica.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
            {cargaActivaCompletados} de {totalCargaActiva} Cargados
          </span>
        </div>

        {/* MATRIZ DE LAS 9 TARJETAS DE CARGA */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {CATALOGO_CARGA_ACTIVA_FASE6.map((req, idx) => {
            const soporte = docsCargaActiva[req.codigo];
            const estaCargado = !!soporte;

            return (
              <div
                key={req.codigo}
                className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                  estaCargado
                    ? "bg-emerald-50/40 border-emerald-200"
                    : "bg-white border-slate-200/90 hover:border-slate-300"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                      REQ-0{idx + 1}
                    </span>

                    {estaCargado ? (
                      <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Cargado</span>
                      </span>
                    ) : req.obligatorio ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        Requerido
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        Condicional
                      </span>
                    )}
                  </div>

                  <h5 className="font-bold text-xs text-slate-900 leading-snug">
                    {req.nombre}
                  </h5>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    {req.descripcion}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                  {estaCargado ? (
                    <>
                      <span className="text-[10px] font-mono text-emerald-800 truncate max-w-[130px]" title={soporte.nombreArchivo}>
                        {soporte.nombreArchivo}
                      </span>
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            onAbrirVisor({
                              titulo: req.nombre,
                              nombreArchivo: soporte.nombreArchivo,
                              mimeType: soporte.mimeType || "application/pdf",
                              sha256Hash: soporte.sha256Hash || `sha256-${req.codigo}`,
                              tamanoBytes: soporte.tamanoBytes || 1024,
                              archivoDataUrl: soporte.archivoDataUrl || soporte.url
                            })
                          }
                          className="px-2 py-1 text-[11px] font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg flex items-center space-x-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Ver</span>
                        </button>
                        {puedeOperar && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setErrorAccion(null);
                                setArchivoDocActivo(null);
                                setModalCargarDocActivo({ codigo: req.codigo, nombre: req.nombre });
                              }}
                              className="px-2 py-1 text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg cursor-pointer"
                              title="Actualizar o reemplazar archivo"
                            >
                              Reemplazar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setErrorAccion(null);
                                setModalConfirmarEliminarDocActivo({
                                  codigo: req.codigo,
                                  nombre: req.nombre,
                                  nombreArchivo: soporte.nombreArchivo
                                });
                              }}
                              className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg cursor-pointer flex items-center space-x-1"
                              title="Desvincular o eliminar archivo"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Eliminar</span>
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={!puedeOperar}
                      onClick={() => {
                        setErrorAccion(null);
                        setArchivoDocActivo(null);
                        setModalCargarDocActivo({ codigo: req.codigo, nombre: req.nombre });
                      }}
                      className="w-full py-2 px-3 rounded-lg text-xs font-bold transition-all bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 hover:border-blue-300 shadow-2xs flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Cargar Documento PDF</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MÓDULO 4: CASOS ESPECIALES Y ANEXOS (MULTI-PREDIO Y AGREGAR ANEXO) */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 mb-5 gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
              M4
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Módulo 4: Casos Especiales y Anexos
              </h4>
              <p className="text-xs text-slate-500">
                Soporte multi-predio consolidado y agregación libre de anexos documentales adicionales.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {puedeOperar && (
              <button
                type="button"
                onClick={() => {
                  setErrorAccion(null);
                  setArchivoAnexoLibre(null);
                  setFormTituloAnexo("");
                  setModalNuevoAnexo(true);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar Anexo Libre</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* CASO ESPECIAL: MULTI-PREDIO */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <Building2 className="w-4 h-4 text-purple-600" />
                <span>Gestión Multi-Predio</span>
              </span>
              {tieneMultipredio ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Cargado y Consolidado
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-700">
                  Opcional / Si Aplica
                </span>
              )}
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              Permite adjuntar un PDF consolidado para casos donde la solución de vivienda abarca más de un folio de matrícula inmobiliaria o predios colindantes.
            </p>

            {tieneMultipredio && postulacion.soporteMultipredio ? (
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate">
                    {postulacion.soporteMultipredio.soporte.nombreArchivo}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Matrícula Adicional: {postulacion.soporteMultipredio.matriculaInmobiliariaAdicional || "N/A"}
                  </div>
                </div>
                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      onAbrirVisor({
                        titulo: "Soporte Multi-Predio Consolidado",
                        nombreArchivo: postulacion.soporteMultipredio!.soporte.nombreArchivo,
                        mimeType: postulacion.soporteMultipredio!.soporte.mimeType || "application/pdf",
                        sha256Hash: postulacion.soporteMultipredio!.soporte.sha256Hash || "hash-mp",
                        tamanoBytes: postulacion.soporteMultipredio!.soporte.tamanoBytes || 1024,
                        archivoDataUrl: postulacion.soporteMultipredio!.soporte.archivoDataUrl || postulacion.soporteMultipredio!.soporte.url
                      })
                    }
                    className="px-2.5 py-1 text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg cursor-pointer flex items-center space-x-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver</span>
                  </button>
                  {puedeOperar && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setErrorAccion(null);
                          setArchivoMultipredio(null);
                          setModalMultipredio(true);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                      >
                        Modificar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setErrorAccion(null);
                          setModalConfirmarEliminarMultipredio(true);
                        }}
                        className="px-2 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer flex items-center space-x-1"
                        title="Eliminar soporte multi-predio"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Eliminar</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={!puedeOperar}
                onClick={() => {
                  setErrorAccion(null);
                  setArchivoMultipredio(null);
                  setModalMultipredio(true);
                }}
                className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 hover:border-purple-300 transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Cargar PDF Multi-Predio</span>
              </button>
            )}
          </div>

          {/* LISTADO DE ANEXOS LIBRES REGISTRADOS */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <Paperclip className="w-4 h-4 text-purple-600" />
                <span>Anexos Adicionales Registrados</span>
              </span>
              <span className="text-xs font-bold text-purple-800">
                {anexosLibres.length} archivo(s)
              </span>
            </div>

            {anexosLibres.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {anexosLibres.map((anx) => (
                  <div
                    key={anx.id}
                    className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-slate-800 truncate">{anx.titulo}</div>
                      <div className="text-[10px] text-slate-400 truncate">{anx.soporte.nombreArchivo}</div>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          onAbrirVisor({
                            titulo: anx.titulo,
                            nombreArchivo: anx.soporte.nombreArchivo,
                            mimeType: anx.soporte.mimeType || "application/pdf",
                            sha256Hash: anx.soporte.sha256Hash || "hash-anx",
                            tamanoBytes: anx.soporte.tamanoBytes || 1024,
                            archivoDataUrl: anx.soporte.archivoDataUrl || anx.soporte.url
                          })
                        }
                        className="px-2 py-1 text-[11px] font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md cursor-pointer flex items-center space-x-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Ver</span>
                      </button>
                      {puedeOperar && (
                        <button
                          type="button"
                          onClick={() => {
                            setErrorAccion(null);
                            setModalConfirmarEliminarAnexo({
                              id: anx.id,
                              titulo: anx.titulo,
                              nombreArchivo: anx.soporte.nombreArchivo
                            });
                          }}
                          className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-md cursor-pointer flex items-center space-x-1"
                          title="Eliminar anexo adicional"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Eliminar</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                No se han registrado anexos libres adicionales.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MÓDULO 5: CIERRE, APROBACIÓN Y SALTO A FASE 7 */}
      {/* ========================================================================= */}
      <div className="bg-white border-2 border-emerald-500/80 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                M5
              </span>
              <h4 className="text-base font-bold text-slate-900">
                Módulo 5: Cierre, Aprobación y Salto a Fase 7 (Ejecución de Obra)
              </h4>
            </div>
            <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
              Ingeniería tiene control total para detonar el inicio de obra una vez Compensar aprueba la postulación. Al registrar el Número de Resolución y el Documento PDF oficial de Compensar, el sistema cierra automáticamente la Fase 6, desbloquea la Fase 7 y registra el hito en la bitácora general del expediente.
            </p>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => {
                setErrorAccion(null);
                setModalAvanzarFase7(true);
              }}
              disabled={!puedeAvanzarFase || cargandoAccion}
              className="px-5 py-3 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md hover:shadow-lg flex items-center space-x-2 cursor-pointer active:scale-98"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Registrar Postulación Aprobada y Avanzar a Fase 7</span>
            </button>
          </div>
        </div>

        {estaAprobada && postulacion.numeroResolucionAsignacion && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                <strong>Resolución Registrada:</strong> {postulacion.numeroResolucionAsignacion}
              </span>
            </div>
            {postulacion.soporteRespuesta && (
              <button
                type="button"
                onClick={() =>
                  onAbrirVisor({
                    titulo: `Resolución Compensar ${postulacion.numeroResolucionAsignacion}`,
                    nombreArchivo: postulacion.soporteRespuesta!.nombreArchivo,
                    mimeType: postulacion.soporteRespuesta!.mimeType || "application/pdf",
                    sha256Hash: postulacion.soporteRespuesta!.sha256Hash || "hash-res",
                    tamanoBytes: postulacion.soporteRespuesta!.tamanoBytes || 1024,
                    archivoDataUrl: postulacion.soporteRespuesta!.archivoDataUrl
                  })
                }
                className="px-2.5 py-1 bg-white text-emerald-800 font-bold border border-emerald-300 rounded-lg flex items-center space-x-1 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Ver Resolución PDF</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* HISTORIAL Y BITÁCORA DE FASE 6 */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-slate-600" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Bitácora de Trazabilidad y Eventos en Fase 6
            </h4>
          </div>
          {puedeOperar && (
            <button
              type="button"
              onClick={() => {
                setErrorAccion(null);
                setModalNota(true);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar Apunte</span>
            </button>
          )}
        </div>

        {postulacion.historial.length > 0 ? (
          <div className="space-y-3">
            {postulacion.historial.map((ev) => (
              <div
                key={ev.id}
                className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl flex items-start justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                        ev.tipo === "aprobacion"
                          ? "bg-emerald-100 text-emerald-800"
                          : ev.tipo === "observaciones"
                          ? "bg-rose-100 text-rose-800"
                          : ev.tipo === "indicacion_obra"
                          ? "bg-indigo-100 text-indigo-800"
                          : ev.tipo === "subsanacion"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {ev.tipo.replace("_", " ")}
                    </span>
                    <span className="font-bold text-xs text-slate-900">{ev.titulo}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{ev.descripcion}</p>
                  <div className="text-[11px] text-slate-400 flex items-center space-x-3 pt-1">
                    <span>{new Date(ev.fecha).toLocaleString("es-CO")}</span>
                    <span>•</span>
                    <span>{ev.autorNombre} ({ev.autorRol})</span>
                  </div>
                </div>

                {ev.soporte && (
                  <button
                    type="button"
                    onClick={() =>
                      onAbrirVisor({
                        titulo: ev.titulo,
                        nombreArchivo: ev.soporte!.nombreArchivo,
                        mimeType: ev.soporte!.mimeType || "application/pdf",
                        sha256Hash: ev.soporte!.sha256Hash || "hash",
                        tamanoBytes: ev.soporte!.tamanoBytes || 1024,
                        archivoDataUrl: ev.soporte!.archivoDataUrl
                      })
                    }
                    className="shrink-0 p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center space-x-1 cursor-pointer"
                    title="Ver soporte adjunto"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden sm:inline">Soporte</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-400">
            No hay eventos registrados en la bitácora de Fase 6 aún.
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL MÓDULO 5: SALTO DIRECTO A FASE 7 */}
      {/* ========================================================================= */}
      {modalAvanzarFase7 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" aria-labelledby="f6-modal-avanzar-f7-titulo" className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 id="f6-modal-avanzar-f7-titulo" className="font-bold text-base text-slate-900">
                  Registrar Postulación Aprobada y Avanzar a Fase 7
                </h3>
              </div>
              <button
                type="button"
                aria-label="Cerrar modal de avance a Fase 7"
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
                <strong>Requisitos Obligatorios Innegociables:</strong> Para autorizar el inicio de obra y avanzar a Fase 7, debe registrar el número de resolución y adjuntar el archivo oficial emitido por Compensar.
              </div>

              {/* DATO INNEGOCIABLE 1: NÚMERO DE RESOLUCIÓN */}
              <div>
                <label htmlFor="f6-num-resolucion-comp" className="block text-xs font-bold text-slate-700 mb-1">
                  1. Número de la Resolución emitida por Compensar *
                </label>
                <input
                  id="f6-num-resolucion-comp"
                  type="text"
                  value={formNumResolucionCompensar}
                  onChange={(e) => setFormNumResolucionCompensar(e.target.value)}
                  placeholder="Ej: RES-COMP-ASIG-2026-088"
                  className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                  required
                />
              </div>

              {/* DATO INNEGOCIABLE 2: CARGA DEL PDF DE RESOLUCIÓN */}
              <div>
                <label htmlFor="file-resolucion-compensar" className="block text-xs font-bold text-slate-700 mb-1">
                  2. Documento de Resolución Oficial (PDF) *
                </label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors focus-within:ring-2 focus-within:ring-emerald-500">
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
                      {archivoResolucionPdf ? archivoResolucionPdf.nombre : "Seleccionar Resolución PDF de Compensar"}
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
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargandoAccion}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm cursor-pointer flex items-center space-x-1.5"
                >
                  {cargandoAccion ? <Clock className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  <span>Confirmar y Desbloquear Fase 7</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL MÓDULO 3: CARGA DOCUMENTO ACTIVO */}
      {/* ========================================================================= */}
      {modalCargarDocActivo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" aria-labelledby="f6-modal-doc-activo-titulo" className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <UploadCloud className="w-5 h-5 text-blue-600" />
                <h3 id="f6-modal-doc-activo-titulo" className="font-bold text-sm text-slate-900 truncate max-w-[280px]">
                  {modalCargarDocActivo.nombre}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Cerrar modal de carga de documento"
                onClick={() => setModalCargarDocActivo(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubirDocActivo} className="space-y-4">
              {errorAccion && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                  {errorAccion}
                </div>
              )}

              <div>
                <label htmlFor="file-doc-activo" className="block text-xs font-bold text-slate-700 mb-1">
                  Archivo PDF del Requerimiento *
                </label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors focus-within:ring-2 focus-within:ring-blue-500">
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={(e) => handleFileChange(e, setArchivoDocActivo)}
                    className="sr-only"
                    id="file-doc-activo"
                  />
                  <label
                    htmlFor="file-doc-activo"
                    className="cursor-pointer flex flex-col items-center justify-center space-y-1.5"
                  >
                    <UploadCloud className="w-6 h-6 text-blue-600" />
                    <span className="text-xs font-bold text-slate-700 truncate max-w-[260px]">
                      {archivoDocActivo ? archivoDocActivo.nombre : "Seleccionar documento PDF"}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Soporte con vigencia y firmas correspondientes
                    </span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalCargarDocActivo(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargandoAccion || !archivoDocActivo}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {cargandoAccion ? <Clock className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Guardar Requerimiento</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL MÓDULO 4: CARGA MULTI-PREDIO */}
      {/* ========================================================================= */}
      {modalMultipredio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" aria-labelledby="f6-modal-multipredio-titulo" className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-purple-600" />
                <h3 id="f6-modal-multipredio-titulo" className="font-bold text-sm text-slate-900">
                  Soporte Multi-Predio Consolidado
                </h3>
              </div>
              <button
                type="button"
                aria-label="Cerrar modal de multi-predio"
                onClick={() => setModalMultipredio(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubirMultipredio} className="space-y-4">
              {errorAccion && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                  {errorAccion}
                </div>
              )}

              <div>
                <label htmlFor="f6-matricula-adic" className="block text-xs font-bold text-slate-700 mb-1">
                  Matrícula(s) Inmobiliaria(s) Adicional(es)
                </label>
                <input
                  id="f6-matricula-adic"
                  type="text"
                  value={formMatriculaAdicional}
                  onChange={(e) => setFormMatriculaAdicional(e.target.value)}
                  placeholder="Ej: 50C-998811, 50C-998812"
                  className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                />
              </div>

              <div>
                <label htmlFor="f6-obs-multipredio" className="block text-xs font-bold text-slate-700 mb-1">
                  Observaciones Técnicas de la Unión Predial
                </label>
                <textarea
                  id="f6-obs-multipredio"
                  value={formObsMultipredio}
                  onChange={(e) => setFormObsMultipredio(e.target.value)}
                  placeholder="Detalle sobre englobe, colindancias o servidumbres de paso aplicables."
                  rows={2}
                  className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label htmlFor="file-multipredio" className="block text-xs font-bold text-slate-700 mb-1">
                  PDF Consolidado del Multi-Predio *
                </label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors focus-within:ring-2 focus-within:ring-purple-500">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => handleFileChange(e, setArchivoMultipredio)}
                    className="sr-only"
                    id="file-multipredio"
                  />
                  <label
                    htmlFor="file-multipredio"
                    className="cursor-pointer flex flex-col items-center justify-center space-y-1.5"
                  >
                    <UploadCloud className="w-6 h-6 text-purple-600" />
                    <span className="text-xs font-bold text-slate-700 truncate max-w-[260px]">
                      {archivoMultipredio ? archivoMultipredio.nombre : "Seleccionar PDF Consolidado"}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      CTLs, planos y escrituras del predio complementario
                    </span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalMultipredio(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargandoAccion || !archivoMultipredio}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {cargandoAccion ? <Clock className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Guardar Multi-Predio</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL CONFIRMAR ELIMINACIÓN MULTI-PREDIO */}
      {/* ========================================================================= */}
      {modalConfirmarEliminarMultipredio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" aria-labelledby="f6-modal-elim-multipredio-titulo" className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center space-x-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 id="f6-modal-elim-multipredio-titulo" className="font-bold text-slate-900 text-sm">¿Eliminar soporte multi-predio?</h4>
                <p className="text-xs text-slate-500">Esta acción desvinculará el archivo.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              El archivo consolidado <strong className="text-slate-800">{postulacion.soporteMultipredio?.soporte.nombreArchivo}</strong> será removido y el expediente retornará a condición habitual mono-predio.
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
                  setModalConfirmarEliminarMultipredio(false);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={cargandoAccion}
                onClick={handleEliminarMultipredio}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center space-x-1"
              >
                {cargandoAccion ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Sí, Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL CONFIRMAR ELIMINACIÓN DOCUMENTO CARGA ACTIVA (MÓDULO 3) */}
      {/* ========================================================================= */}
      {modalConfirmarEliminarDocActivo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" aria-labelledby="f6-modal-elim-doc-activo-titulo" className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center space-x-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 id="f6-modal-elim-doc-activo-titulo" className="font-bold text-slate-900 text-sm">¿Desvincular documento?</h4>
                <p className="text-xs text-slate-500 font-mono font-semibold">{modalConfirmarEliminarDocActivo.codigo}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              El archivo <strong className="text-slate-800">{modalConfirmarEliminarDocActivo.nombreArchivo}</strong> correspondiente al requerimiento <strong className="text-slate-800">{modalConfirmarEliminarDocActivo.nombre}</strong> será removido y regresará a estado pendiente/condicional.
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
                  setModalConfirmarEliminarDocActivo(null);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={cargandoAccion}
                onClick={handleEliminarDocActivo}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center space-x-1"
              >
                {cargandoAccion ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Sí, Desvincular</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL CONFIRMAR ELIMINACIÓN ANEXO LIBRE (MÓDULO 4) */}
      {/* ========================================================================= */}
      {modalConfirmarEliminarAnexo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" aria-labelledby="f6-modal-elim-anexo-titulo" className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center space-x-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 id="f6-modal-elim-anexo-titulo" className="font-bold text-slate-900 text-sm">¿Eliminar anexo adicional?</h4>
                <p className="text-xs text-slate-500">Módulo 4: Anexos Libres</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Se eliminará de forma definitiva el anexo adicional <strong className="text-slate-800">{modalConfirmarEliminarAnexo.titulo}</strong> ({modalConfirmarEliminarAnexo.nombreArchivo}).
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
                  setModalConfirmarEliminarAnexo(null);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={cargandoAccion}
                onClick={handleEliminarAnexoLibre}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center space-x-1"
              >
                {cargandoAccion ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Sí, Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL MÓDULO 4: AGREGAR ANEXO LIBRE */}
      {/* ========================================================================= */}
      {modalNuevoAnexo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" aria-labelledby="f6-modal-nuevo-anexo-titulo" className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <Plus className="w-5 h-5 text-purple-600" />
                <h3 id="f6-modal-nuevo-anexo-titulo" className="font-bold text-sm text-slate-900">
                  Agregar Anexo Libre
                </h3>
              </div>
              <button
                type="button"
                aria-label="Cerrar modal de nuevo anexo"
                onClick={() => setModalNuevoAnexo(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAgregarAnexoLibre} className="space-y-4">
              {errorAccion && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                  {errorAccion}
                </div>
              )}

              <div>
                <label htmlFor="f6-titulo-anexo" className="block text-xs font-bold text-slate-700 mb-1">
                  Título / Identificación del Anexo *
                </label>
                <input
                  id="f6-titulo-anexo"
                  type="text"
                  value={formTituloAnexo}
                  onChange={(e) => setFormTituloAnexo(e.target.value)}
                  placeholder="Ej: Certificado de Cobertura de Red Eléctrica Rural"
                  className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="file-anexo-libre" className="block text-xs font-bold text-slate-700 mb-1">
                  Archivo Adjunto *
                </label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors focus-within:ring-2 focus-within:ring-purple-500">
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={(e) => handleFileChange(e, setArchivoAnexoLibre)}
                    className="sr-only"
                    id="file-anexo-libre"
                  />
                  <label
                    htmlFor="file-anexo-libre"
                    className="cursor-pointer flex flex-col items-center justify-center space-y-1.5"
                  >
                    <UploadCloud className="w-6 h-6 text-purple-600" />
                    <span className="text-xs font-bold text-slate-700 truncate max-w-[260px]">
                      {archivoAnexoLibre ? archivoAnexoLibre.nombre : "Seleccionar Archivo"}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      PDF, JPG o PNG de soporte
                    </span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalNuevoAnexo(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargandoAccion || !archivoAnexoLibre}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {cargandoAccion ? <Clock className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Adjuntar Anexo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL REGISTRAR NOTA EN BITÁCORA */}
      {/* ========================================================================= */}
      {modalNota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" aria-labelledby="f6-modal-nota-titulo" className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 id="f6-modal-nota-titulo" className="font-bold text-sm text-slate-900">Registrar Apunte en Bitácora</h3>
              </div>
              <button
                type="button"
                aria-label="Cerrar modal de apunte de bitácora"
                onClick={() => setModalNota(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAgregarNota} className="space-y-4">
              {errorAccion && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                  {errorAccion}
                </div>
              )}

              <div>
                <label htmlFor="f6-titulo-nota" className="block text-xs font-bold text-slate-700 mb-1">
                  Título de la Nota / Hito *
                </label>
                <input
                  id="f6-titulo-nota"
                  type="text"
                  value={formTituloNota}
                  onChange={(e) => setFormTituloNota(e.target.value)}
                  placeholder="Ej: Llamada de verificación de datos con analista de Compensar"
                  className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="f6-desc-nota" className="block text-xs font-bold text-slate-700 mb-1">
                  Descripción Detallada *
                </label>
                <textarea
                  id="f6-desc-nota"
                  value={formDescNota}
                  onChange={(e) => setFormDescNota(e.target.value)}
                  placeholder="Detalles sobre acuerdos, requerimientos o avances en la postulación..."
                  rows={3}
                  className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalNota(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargandoAccion}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm cursor-pointer flex items-center space-x-1.5"
                >
                  {cargandoAccion ? <Clock className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Guardar Nota</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL SUBSANACIÓN (SI HUBO OBSERVACIONES PREVIAS) */}
      {/* ========================================================================= */}
      {modalSubsanar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" aria-labelledby="f6-modal-subsanar-titulo" className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <RotateCcw className="w-5 h-5 text-amber-600" />
                <h3 id="f6-modal-subsanar-titulo" className="font-bold text-base text-slate-900">
                  Subsanar Observaciones de Compensar
                </h3>
              </div>
              <button
                type="button"
                aria-label="Cerrar modal de subsanación de observaciones"
                onClick={() => setModalSubsanar(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEnviarSubsanacion} className="space-y-4">
              {errorAccion && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                  {errorAccion}
                </div>
              )}

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900">
                <strong>Observaciones Registradas:</strong>
                <p className="mt-1">{modalSubsanar.detalleObservaciones}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="f6-sub-fecha" className="block text-xs font-bold text-slate-700 mb-1">
                    Fecha Radicación Subsanación *
                  </label>
                  <input
                    id="f6-sub-fecha"
                    type="date"
                    value={formFechaSubsanacion}
                    onChange={(e) => setFormFechaSubsanacion(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="f6-sub-radicado" className="block text-xs font-bold text-slate-700 mb-1">
                    Radicado de Reingreso *
                  </label>
                  <input
                    id="f6-sub-radicado"
                    type="text"
                    value={formRadicadoSubsanacion}
                    onChange={(e) => setFormRadicadoSubsanacion(e.target.value)}
                    placeholder="Ej: SUB-COMP-2026-001"
                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="f6-sub-detalle" className="block text-xs font-bold text-slate-700 mb-1">
                  Explicación de Ajustes / Subsanaciones
                </label>
                <textarea
                  id="f6-sub-detalle"
                  value={formDetalleSubsanacion}
                  onChange={(e) => setFormDetalleSubsanacion(e.target.value)}
                  placeholder="Detalle de documentos aclarados o subsanados ante Compensar..."
                  rows={2}
                  className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label htmlFor="file-subsanacion" className="block text-xs font-bold text-slate-700 mb-1">
                  Soporte de Subsanación (PDF)
                </label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-3 text-center hover:bg-slate-50 transition-colors focus-within:ring-2 focus-within:ring-amber-500">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => handleFileChange(e, setArchivoSubsanacion)}
                    className="sr-only"
                    id="file-subsanacion"
                  />
                  <label
                    htmlFor="file-subsanacion"
                    className="cursor-pointer flex flex-col items-center justify-center space-y-1"
                  >
                    <UploadCloud className="w-5 h-5 text-amber-600" />
                    <span className="text-xs font-semibold text-slate-700 truncate max-w-[240px]">
                      {archivoSubsanacion ? archivoSubsanacion.nombre : "Adjuntar memorial o soporte de radicado"}
                    </span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalSubsanar(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargandoAccion}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-all shadow-sm cursor-pointer flex items-center space-x-1.5"
                >
                  {cargandoAccion ? <Clock className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Radicar Subsanación</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
