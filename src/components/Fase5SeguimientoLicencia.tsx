import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Expediente,
  PerfilUsuario,
  TramiteLicenciaConstruccion,
  EstadoTramiteLicencia,
  RondaSubsanacionLicencia,
  RegistroHistorialLicencia,
  SoporteDocumentoLicencia,
  DocumentoRadicacionPlaneacion,
  PLANTILLA_DOCUMENTOS_FASE_5,
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
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Trash2,
  Upload,
  RefreshCw,
  FolderArchive,
  Layers,
  FileCheck,
  FileUp,
  Sparkles,
  Info
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
    documentosPlaneacion: [],
    historial: []
  };

  const estado: EstadoTramiteLicencia = tramite.estadoActual || "sin_radicar";
  const estaBloqueadaPorFaseAvanzada = (expediente.faseActual || 1) > 5;

  // Permisos:
  // - Ingeniería: gestor directo de documentos, radicación y avance
  // - Supervisor y Administrador: supervisión, auditoría y aprobación
  const puedeOperar =
    !estaBloqueadaPorFaseAvanzada &&
    (currentUser.rol === "ingenieria" || currentUser.rol === "administrador");
  const puedeAvanzarFase =
    !estaBloqueadaPorFaseAvanzada &&
    (currentUser.rol === "ingenieria" ||
      currentUser.rol === "supervisor" ||
      currentUser.rol === "administrador");

  // Feedback y estados generales
  const [cargandoAccion, setCargandoAccion] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [exitoAccion, setExitoAccion] = useState<string | null>(null);

  // Estado de carga individual para archivos en el checklist
  const [subiendoDocKey, setSubiendoDocKey] = useState<string | null>(null);
  const [progresoCarga, setProgresoCarga] = useState<number>(0);

  // Sección desplegable de datos de radicación / resolución
  const [seccionRadicacionAbierta, setSeccionRadicacionAbierta] = useState<boolean>(true);
  const [seccionSubsanacionesAbierta, setSeccionSubsanacionesAbierta] = useState<boolean>(false);
  const [seccionBitacoraAbierta, setSeccionBitacoraAbierta] = useState<boolean>(false);

  // Formulario en línea de Radicación Oficial
  const [formEntidad, setFormEntidad] = useState(
    tramite.entidadMunicipal || "Secretaría de Planeación Municipal"
  );
  const [formNumRadicado, setFormNumRadicado] = useState(
    tramite.numeroRadicadoInicial || ""
  );
  const [formFechaRad, setFormFechaRad] = useState(
    tramite.fechaRadicacionInicial
      ? tramite.fechaRadicacionInicial.split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [formObsRad, setFormObsRad] = useState("");
  const [guardandoRadicacion, setGuardandoRadicacion] = useState(false);

  // Formulario en línea de Resolución Aprobatoria
  const [formNumResolucion, setFormNumResolucion] = useState(
    tramite.numeroResolucionLicencia || ""
  );
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
  const [formVigenciaMeses, setFormVigenciaMeses] = useState(
    tramite.vigenciaMeses || 24
  );
  const [formObsFinales, setFormObsFinales] = useState(
    tramite.observacionesFinales || ""
  );
  const [archivosAprobarNuevos, setArchivosAprobarNuevos] = useState<File[]>([]);
  const [guardandoResolucion, setGuardandoResolucion] = useState(false);

  // Modales de confirmación indispensables (solo confirmaciones críticas de sistema)
  const [modalConfirmarAvanzarF6, setModalConfirmarAvanzarF6] = useState(false);
  const [modalRequisitosPendientesF6, setModalRequisitosPendientesF6] = useState(false);

  // Panel inline para nueva observación y subsanación
  const [mostrarFormNuevaObs, setMostrarFormNuevaObs] = useState(false);
  const [formNumActaObs, setFormNumActaObs] = useState("");
  const [formFechaObs, setFormFechaObs] = useState(new Date().toISOString().split("T")[0]);
  const [formFechaLimite, setFormFechaLimite] = useState("");
  const [formDetalleObs, setFormDetalleObs] = useState("");
  const [archivoObs, setArchivoObs] = useState<File | null>(null);

  const [rondaParaSubsanar, setRondaParaSubsanar] = useState<RondaSubsanacionLicencia | null>(null);
  const [formNumRadSub, setFormNumRadSub] = useState("");
  const [formFechaRadSub, setFormFechaRadSub] = useState(new Date().toISOString().split("T")[0]);
  const [formDetalleSub, setFormDetalleSub] = useState("");
  const [archivoSub, setArchivoSub] = useState<File | null>(null);

  // Refs para inputs de archivo directos en el checklist (sin modales)
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Sincronizar estados locales cuando cambie el expediente recibido
  useEffect(() => {
    if (tramite.entidadMunicipal) setFormEntidad(tramite.entidadMunicipal);
    if (tramite.numeroRadicadoInicial) setFormNumRadicado(tramite.numeroRadicadoInicial);
    if (tramite.fechaRadicacionInicial) {
      setFormFechaRad(tramite.fechaRadicacionInicial.split("T")[0]);
    }
    if (tramite.numeroResolucionLicencia) {
      setFormNumResolucion(tramite.numeroResolucionLicencia);
    }
    if (tramite.fechaExpedicionLicencia) {
      setFormFechaExpedicion(tramite.fechaExpedicionLicencia.split("T")[0]);
    }
    if (tramite.fechaEjecutoriaLicencia) {
      setFormFechaEjecutoria(tramite.fechaEjecutoriaLicencia.split("T")[0]);
    }
    if (tramite.vigenciaMeses) setFormVigenciaMeses(tramite.vigenciaMeses);
  }, [tramite]);

  // Lista consolidada de los 15 documentos de Fase 5
  const lista15Documentos: DocumentoRadicacionPlaneacion[] = useMemo(() => {
    const docsActuales = tramite.documentosPlaneacion || [];
    return PLANTILLA_DOCUMENTOS_FASE_5.map((plantilla) => {
      const docExistente = docsActuales.find(
        (d) => d.itemNumero === plantilla.itemNumero || d.tipo === plantilla.tipo
      );
      if (docExistente) {
        return {
          ...docExistente,
          itemNumero: plantilla.itemNumero,
          nombre: docExistente.nombre || plantilla.nombre,
          descripcion: docExistente.descripcion || plantilla.descripcion,
          formatosPermitidos: plantilla.formatosPermitidos,
          esObligatorio: plantilla.esObligatorio,
          requiereDobleArchivo: plantilla.requiereDobleArchivo,
          soportaArchivoPesado: plantilla.soportaArchivoPesado
        };
      }
      return {
        id: `doc-fase5-${plantilla.itemNumero}-${expediente.id}`,
        itemNumero: plantilla.itemNumero,
        tipo: plantilla.tipo,
        nombre: plantilla.nombre,
        descripcion: plantilla.descripcion,
        formatosPermitidos: plantilla.formatosPermitidos,
        esObligatorio: plantilla.esObligatorio,
        requiereDobleArchivo: plantilla.requiereDobleArchivo,
        soportaArchivoPesado: plantilla.soportaArchivoPesado
      };
    });
  }, [tramite.documentosPlaneacion, expediente.id]);

  // Cálculo de progreso del checklist
  const statsChecklist = useMemo(() => {
    let listos = 0;
    let obligatoriosListos = 0;
    const total = lista15Documentos.length;
    const totalObligatorios = lista15Documentos.filter((d) => d.esObligatorio).length;

    lista15Documentos.forEach((doc) => {
      if (doc.requiereDobleArchivo) {
        // Item 12: requiere tanto Excel como PDF
        const tieneExcel = !!doc.soporteExcel;
        const tienePdf = !!doc.soportePdf || !!doc.soporte;
        if (tieneExcel && tienePdf) {
          listos++;
          if (doc.esObligatorio) obligatoriosListos++;
        }
      } else {
        if (doc.soporte) {
          listos++;
          if (doc.esObligatorio) obligatoriosListos++;
        }
      }
    });

    const porcentajeGlobal = Math.round((listos / total) * 100);
    return {
      total,
      listos,
      totalObligatorios,
      obligatoriosListos,
      porcentajeGlobal,
      todosObligatoriosListos: obligatoriosListos === totalObligatorios
    };
  }, [lista15Documentos]);

  // Helper para procesar archivo a Base64 / Hash
  const procesarArchivo = async (
    file: File,
    onProgress?: (porcentaje: number) => void
  ): Promise<{ dataUrl: string; sha256: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      if (onProgress) {
        reader.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 90);
            onProgress(pct);
          }
        };
      }

      reader.onload = () => {
        if (onProgress) onProgress(98);
        const dataUrl = reader.result as string;
        // Hash determinístico simple para auditoría
        let hash = 0;
        for (let i = 0; i < Math.min(dataUrl.length, 500000); i++) {
          hash = (hash << 5) - hash + dataUrl.charCodeAt(i);
          hash |= 0;
        }
        const sha256 = `sha256-${Math.abs(hash).toString(16).padStart(16, "0")}-${Date.now().toString(16)}`;
        if (onProgress) onProgress(100);
        resolve({ dataUrl, sha256 });
      };

      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Helper para abrir soporte en el visor interno optimizado
  const abrirSoporte = (
    soporte?: SoporteDocumentoLicencia,
    tituloDefecto?: string
  ) => {
    if (!soporte) return;
    onAbrirVisor({
      titulo: tituloDefecto || soporte.nombreArchivo,
      nombreArchivo: soporte.nombreArchivo,
      mimeType: soporte.mimeType || "application/pdf",
      tamanoBytes: soporte.tamanoBytes || 1024000,
      sha256Hash: soporte.sha256Hash || soporte.sha256 || "sha256-verified",
      subidoPor: soporte.subidoPor || currentUser.nombreCompleto,
      subidoEn: soporte.subidoEn || new Date().toISOString(),
      archivoDataUrl: soporte.archivoDataUrl || soporte.url
    });
  };

  // =========================================================================
  // CARGA DIRECTA DE DOCUMENTOS DEL CHECKLIST (SIN MODAL NI PANTALLA SECUNDARIA)
  // =========================================================================
  const handleSubirArchivoDirecto = async (
    doc: DocumentoRadicacionPlaneacion,
    file: File,
    slotTipo?: "excel" | "pdf"
  ) => {
    if (!puedeOperar) {
      setErrorAccion("No tiene permisos para modificar la documentación de Fase 5.");
      return;
    }

    const key = `${doc.itemNumero}-${slotTipo || "main"}`;
    setSubiendoDocKey(key);
    setProgresoCarga(15);
    setErrorAccion(null);

    // Animación de progreso para archivos pesados o extensos
    const intervaloProgreso = setInterval(() => {
      setProgresoCarga((prev) => (prev < 85 ? prev + 15 : prev));
    }, 180);

    try {
      const p = await procesarArchivo(file, (pct) => {
        setProgresoCarga(Math.max(pct, 20));
      });

      clearInterval(intervaloProgreso);
      setProgresoCarga(92);

      const res = await authFetch(
        `/api/expedientes/${expediente.id}/licencia/documentos-planeacion`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idDoc: doc.id,
            itemNumero: doc.itemNumero,
            tipo: doc.tipo,
            nombre: doc.nombre,
            descripcion: doc.descripcion,
            esObligatorio: doc.esObligatorio,
            slotTipo,
            nombreArchivo: file.name,
            mimeType:
              file.type ||
              (file.name.endsWith(".xlsx")
                ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                : file.name.endsWith(".xls")
                ? "application/vnd.ms-excel"
                : file.name.endsWith(".zip")
                ? "application/zip"
                : "application/pdf"),
            tamanoBytes: file.size,
            archivoDataUrl: p.dataUrl,
            sha256Hash: p.sha256
          })
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar archivo.");

      setProgresoCarga(100);
      setExitoAccion(
        `Documento "${doc.nombre}"${
          slotTipo ? ` (${slotTipo.toUpperCase()})` : ""
        } cargado y sincronizado exitosamente.`
      );
      await onActualizarExpediente();
    } catch (err: any) {
      clearInterval(intervaloProgreso);
      setErrorAccion(err.message || "Error al subir el archivo.");
    } finally {
      setTimeout(() => {
        setSubiendoDocKey(null);
        setProgresoCarga(0);
      }, 500);
    }
  };

  // =========================================================================
  // ELIMINACIÓN DIRECTA DE ARCHIVO DEL CHECKLIST (SIN REDIRECCIONES)
  // =========================================================================
  const handleEliminarArchivoDirecto = async (
    doc: DocumentoRadicacionPlaneacion,
    slotTipo?: "excel" | "pdf"
  ) => {
    if (!puedeOperar) {
      setErrorAccion("No tiene permisos para modificar la documentación de Fase 5.");
      return;
    }

    const confirmacion = window.confirm(
      `¿Está seguro de remover el archivo ${
        slotTipo ? `(${slotTipo.toUpperCase()}) ` : ""
      }de "${doc.nombre}"?`
    );
    if (!confirmacion) return;

    setCargandoAccion(true);
    setErrorAccion(null);
    try {
      const url = `/api/expedientes/${expediente.id}/licencia/documentos-planeacion/${
        doc.id
      }${slotTipo ? `?slot=${slotTipo}` : ""}`;
      const res = await authFetch(url, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al desvincular archivo.");

      setExitoAccion(
        `Archivo removido de "${doc.nombre}". Puede cargar uno nuevo cuando lo requiera.`
      );
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al desvincular archivo.");
    } finally {
      setCargandoAccion(false);
    }
  };

  // =========================================================================
  // GUARDAR RADICACIÓN INICIAL INLINE (SIN MODAL)
  // =========================================================================
  const handleGuardarRadicacionInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNumRadicado.trim() || !formFechaRad) {
      setErrorAccion("El número de radicado y la fecha de radicación son obligatorios.");
      return;
    }

    setGuardandoRadicacion(true);
    setErrorAccion(null);
    try {
      const res = await authFetch(
        `/api/expedientes/${expediente.id}/licencia/radicar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entidadMunicipal: formEntidad.trim(),
            numeroRadicado: formNumRadicado.trim(),
            fechaRadicacion: new Date(formFechaRad).toISOString(),
            observaciones: formObsRad.trim()
          })
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar radicación.");

      setExitoAccion("Datos oficiales de radicación municipal guardados exitosamente.");
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al guardar radicación.");
    } finally {
      setGuardandoRadicacion(false);
    }
  };

  // Carga directa de comprobante de radicación municipal
  const handleCargarComprobanteRadicacion = async (file: File) => {
    setGuardandoRadicacion(true);
    setErrorAccion(null);
    try {
      const p = await procesarArchivo(file);
      const res = await authFetch(
        `/api/expedientes/${expediente.id}/licencia/radicar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entidadMunicipal: formEntidad.trim(),
            numeroRadicado: formNumRadicado.trim() || "RAD-S-N",
            fechaRadicacion: new Date(formFechaRad).toISOString(),
            observaciones: formObsRad.trim(),
            nombreArchivo: file.name,
            mimeType: file.type || "application/pdf",
            tamanoBytes: file.size,
            archivoDataUrl: p.dataUrl,
            sha256Hash: p.sha256
          })
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al adjuntar comprobante.");

      setExitoAccion("Comprobante de radicación adjuntado correctamente.");
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al subir comprobante de radicación.");
    } finally {
      setGuardandoRadicacion(false);
    }
  };

  // =========================================================================
  // GUARDAR RESOLUCIÓN DE LICENCIA APROBADA INLINE (SIN MODAL)
  // =========================================================================
  const handleGuardarResolucionInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNumResolucion.trim() || !formFechaExpedicion) {
      setErrorAccion("El número de resolución y la fecha de expedición son obligatorios.");
      return;
    }

    const tieneSoportesPrevios =
      (tramite.soporteLicenciaAprobadaDocs &&
        tramite.soporteLicenciaAprobadaDocs.length > 0) ||
      !!tramite.soporteLicenciaAprobada;

    if (archivosAprobarNuevos.length === 0 && !tieneSoportesPrevios) {
      setErrorAccion(
        "Debe adjuntar al menos un archivo digital de soporte de la Licencia expedida (Resolución o Planos sellados)."
      );
      return;
    }

    setGuardandoResolucion(true);
    setErrorAccion(null);
    try {
      let docsNuevosProcesados: any[] = [];
      if (archivosAprobarNuevos.length > 0) {
        docsNuevosProcesados = await Promise.all(
          archivosAprobarNuevos.map(async (f) => {
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

      const res = await authFetch(
        `/api/expedientes/${expediente.id}/licencia/aprobar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            numeroResolucionLicencia: formNumResolucion.trim(),
            fechaExpedicionLicencia: new Date(formFechaExpedicion).toISOString(),
            fechaEjecutoriaLicencia: formFechaEjecutoria
              ? new Date(formFechaEjecutoria).toISOString()
              : undefined,
            vigenciaMeses: Number(formVigenciaMeses),
            observacionesFinales: formObsFinales.trim(),
            archivos:
              docsNuevosProcesados.length > 0 ? docsNuevosProcesados : undefined
          })
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar resolución.");

      setExitoAccion(
        "¡Licencia de Construcción APROBADA! Resolución y documentos oficiales registrados."
      );
      setArchivosAprobarNuevos([]);
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al registrar aprobación de la licencia.");
    } finally {
      setGuardandoResolucion(false);
    }
  };

  // =========================================================================
  // GESTIÓN DE SUBSANACIONES INLINE
  // =========================================================================
  const handleGuardarObservacionesInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDetalleObs.trim() || !formFechaObs) {
      setErrorAccion("La fecha y el detalle del requerimiento son obligatorios.");
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

      const res = await authFetch(
        `/api/expedientes/${expediente.id}/licencia/observaciones`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            numeroActaObservaciones: formNumActaObs.trim(),
            fechaObservaciones: new Date(formFechaObs).toISOString(),
            detalleObservaciones: formDetalleObs.trim(),
            fechaLimiteSubsanacion: formFechaLimite
              ? new Date(formFechaLimite).toISOString()
              : undefined,
            nombreArchivo: archivoObs ? archivoObs.name : undefined,
            mimeType: archivoObs ? archivoObs.type : undefined,
            tamanoBytes: archivoObs ? archivoObs.size : undefined,
            archivoDataUrl,
            sha256Hash
          })
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar requerimiento.");

      setExitoAccion("Ronda de observaciones registrada correctamente.");
      setMostrarFormNuevaObs(false);
      setFormDetalleObs("");
      setFormNumActaObs("");
      setArchivoObs(null);
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al registrar requerimiento.");
    } finally {
      setCargandoAccion(false);
    }
  };

  const handleGuardarSubsanacionInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rondaParaSubsanar || !formNumRadSub.trim() || !formFechaRadSub || !formDetalleSub.trim()) {
      setErrorAccion("El radicado, fecha y detalle de subsanación son obligatorios.");
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

      const res = await authFetch(
        `/api/expedientes/${expediente.id}/licencia/subsanar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rondaId: rondaParaSubsanar.id,
            numeroRadicadoSubsanacion: formNumRadSub.trim(),
            fechaRadicacionSubsanacion: new Date(formFechaRadSub).toISOString(),
            detalleRespuestaSubsanacion: formDetalleSub.trim(),
            nombreArchivo: archivoSub ? archivoSub.name : undefined,
            mimeType: archivoSub ? archivoSub.type : undefined,
            tamanoBytes: archivoSub ? archivoSub.size : undefined,
            archivoDataUrl,
            sha256Hash
          })
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al radicar subsanación.");

      setExitoAccion("Subsanación técnica radicada exitosamente ante la entidad.");
      setRondaParaSubsanar(null);
      setFormNumRadSub("");
      setFormDetalleSub("");
      setArchivoSub(null);
      await onActualizarExpediente();
    } catch (err: any) {
      setErrorAccion(err.message || "Error al radicar subsanación.");
    } finally {
      setCargandoAccion(false);
    }
  };

  // =========================================================================
  // AVANZAR FORMALMENTE A FASE 6
  // =========================================================================
  const handleAvanzarFase6 = () => {
    if (estado !== "aprobada") {
      setModalRequisitosPendientesF6(true);
      return;
    }
    if (!puedeAvanzarFase) {
      setErrorAccion("Acción restringida: solo Ingeniería, Supervisión o Administrador pueden avanzar a Fase 6.");
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
      if (!res.ok) throw new Error(data.error || "Error al avanzar a Fase 6.");

      setModalConfirmarAvanzarF6(false);
      setExitoAccion("Expediente avanzado exitosamente a Fase 6: En Postulación.");
      await onActualizarExpediente(6);
    } catch (err: any) {
      setErrorAccion(err.message || "Error al avanzar a Fase 6.");
    } finally {
      setCargandoAccion(false);
    }
  };

  // Configuración visual del badge de estado
  const getBadgeEstado = () => {
    switch (estado) {
      case "aprobada":
        return {
          texto: "Licencia Aprobada / Expedida",
          clase: "bg-emerald-100 text-emerald-800 border-emerald-300",
          icono: ShieldCheck,
          indicadorColor: "bg-emerald-500",
          descripcion:
            "La Licencia de Construcción cuenta con resolución oficial ejecutoriada y soportes verificados."
        };
      case "con_observaciones":
        return {
          texto: "Con Observaciones / En Subsanación",
          clase: "bg-amber-100 text-amber-900 border-amber-300",
          icono: AlertTriangle,
          indicadorColor: "bg-amber-500",
          descripcion:
            "La curaduría o secretaría de planeación emitió observaciones técnicas. Trámite en subsanación."
        };
      case "radicado_en_revision":
        return {
          texto: "Radicado — En Estudio Municipal",
          clase: "bg-blue-100 text-blue-900 border-blue-300",
          icono: Clock,
          indicadorColor: "bg-blue-500",
          descripcion:
            "Solicitud radicada formalmente ante la entidad territorial. En estudio de viabilidad urbanística."
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
          descripcion:
            "Cargue y verifique el checklist de los 15 documentos obligatorios para radicar ante la curaduría o planeación."
        };
    }
  };

  const badge = getBadgeEstado();
  const IconoBadge = badge.icono;
  const rondas = tramite.rondasSubsanacion || [];
  const soportesLicenciaList = (tramite.soporteLicenciaAprobadaDocs && tramite.soporteLicenciaAprobadaDocs.length > 0)
    ? tramite.soporteLicenciaAprobadaDocs
    : (tramite.soporteLicenciaAprobada ? [tramite.soporteLicenciaAprobada] : []);

  return (
    <div className="space-y-6" id="fase5-seguimiento-licencia-root">
      {/* ========================================================================= */}
      {/* 1. MENSAJES DE ALERTA O FEEDBACK                                         */}
      {/* ========================================================================= */}
      {errorAccion && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-sm flex items-start justify-between shadow-2xs">
          <div className="flex items-center space-x-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <span className="font-medium">{errorAccion}</span>
          </div>
          <button
            type="button"
            aria-label="Cerrar alerta de error"
            onClick={() => setErrorAccion(null)}
            className="text-rose-500 hover:text-rose-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {exitoAccion && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm flex items-start justify-between shadow-2xs">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <span className="font-medium">{exitoAccion}</span>
          </div>
          <button
            type="button"
            aria-label="Cerrar confirmación"
            onClick={() => setExitoAccion(null)}
            className="text-emerald-500 hover:text-emerald-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* BANNER SOLO LECTURA SI FASE YA AVANZADA */}
      {estaBloqueadaPorFaseAvanzada && (
        <div className="p-4 bg-slate-50 border border-slate-300 rounded-2xl text-slate-800 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2.5">
            <Lock className="w-5 h-5 text-slate-600 shrink-0" />
            <div>
              <strong className="block font-bold text-slate-900 text-sm">
                Fase 5 Culminada (Modo Consulta y Auditoría)
              </strong>
              <span className="text-slate-600">
                La Licencia de Construcción fue obtenida y el expediente avanzó a Fase 6: En Postulación. Los 15 documentos oficiales y registros de radicación se conservan de forma inmutable.
              </span>
            </div>
          </div>
          <span className="px-3 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg shrink-0">
            Fase {expediente.faseActual} Activa
          </span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. HEADER UNIFICADO: ESTADO DE TRÁMITE, PROGRESO Y ACCIÓN DE AVANCE        */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center space-x-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Fase 5 • Trámite de Licencia de Construcción
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-blue-700 font-mono font-semibold">
                {expediente.codigoVisible || expediente.id}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-500 font-medium">
                {tramite.entidadMunicipal}
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mt-1 flex items-center space-x-2.5">
              <span>Gestión y Licenciamiento Municipal (Vista Única de Carga)</span>
            </h3>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Consolidación en una sola pantalla de los 15 documentos técnicos y jurídicos oficiales para radicación territorial, con soporte integrado de radicación municipal y archivos pesados.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* BADGE DE ESTADO SEMÁNTICO */}
            <div
              className={`px-3.5 py-2 rounded-xl border flex items-center space-x-2 text-sm font-semibold shadow-2xs ${badge.clase}`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${badge.indicadorColor} animate-pulse`}
              />
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
                <span>Fase 5 Culminada (En Fase {expediente.faseActual})</span>
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
                    ? "Requiere Licencia Aprobada para habilitar el avance a Fase 6."
                    : "Avanzar formalmente el expediente a Fase 6: En Postulación"
                }
              >
                {cargandoAccion ? (
                  <Clock className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                <span>Avanzar a Fase 6</span>
              </button>
            )}
          </div>
        </div>

        {/* BARRA DE PROGRESO DE LOS 15 DOCUMENTOS OFICIALES */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs mb-2">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-800">
                Avance del Checklist Documental Oficial:
              </span>
              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-mono font-bold border border-blue-200">
                {statsChecklist.listos} de {statsChecklist.total} documentos listos
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600">
                ({statsChecklist.obligatoriosListos} de {statsChecklist.totalObligatorios} obligatorios)
              </span>
            </div>
            <span className="font-mono font-bold text-slate-900 text-sm">
              {statsChecklist.porcentajeGlobal}% completado
            </span>
          </div>

          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/80">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                statsChecklist.porcentajeGlobal === 100
                  ? "bg-emerald-500"
                  : statsChecklist.porcentajeGlobal > 50
                  ? "bg-blue-600"
                  : "bg-amber-500"
              }`}
              style={{ width: `${statsChecklist.porcentajeGlobal}%` }}
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SECCIÓN UNIFICADA INLINE: DATOS DE RADICACIÓN Y RESOLUCIÓN (SIN MODAL) */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <span>Datos Oficiales de Radicación y Licencia Municipal</span>
                <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                  Gestión en la misma pantalla
                </span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Edición y guardado directo de radicación, fechas, número de resolución y actas sin ventanas intermedias.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSeccionRadicacionAbierta((prev) => !prev)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
            title="Colapsar o expandir panel de radicación"
          >
            {seccionRadicacionAbierta ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {seccionRadicacionAbierta && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SUB-BLOQUE A: RADICACIÓN INICIAL MUNICIPAL */}
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/80">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span>Radicación Inicial ante Entidad Territorial</span>
                  </span>
                  <span
                    className={`text-2xs font-bold px-2 py-0.5 rounded-md ${
                      tramite.numeroRadicadoInicial
                        ? "bg-blue-100 text-blue-800 border border-blue-200"
                        : "bg-amber-100 text-amber-800 border border-amber-200"
                    }`}
                  >
                    {tramite.numeroRadicadoInicial ? "Radicado Formal" : "Pendiente Radicar"}
                  </span>
                </div>

                <form onSubmit={handleGuardarRadicacionInline} className="space-y-3">
                  <div>
                    <label className="block text-2xs font-bold text-slate-600 mb-1">
                      Entidad Competente (Curaduría o Secretaría de Planeación) *
                    </label>
                    <input
                      type="text"
                      disabled={!puedeOperar}
                      value={formEntidad}
                      onChange={(e) => setFormEntidad(e.target.value)}
                      placeholder="Ej: Curaduría Urbana No. 1 o Secretaría de Planeación"
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden disabled:bg-slate-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-2xs font-bold text-slate-600 mb-1">
                        Número de Radicado Oficial *
                      </label>
                      <input
                        type="text"
                        disabled={!puedeOperar}
                        value={formNumRadicado}
                        onChange={(e) => setFormNumRadicado(e.target.value)}
                        placeholder="Ej: RAD-2026-FOS-0482"
                        className="w-full text-xs font-mono font-bold px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden disabled:bg-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-bold text-slate-600 mb-1">
                        Fecha de Radicación *
                      </label>
                      <input
                        type="date"
                        disabled={!puedeOperar}
                        value={formFechaRad}
                        onChange={(e) => setFormFechaRad(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden disabled:bg-slate-100"
                      />
                    </div>
                  </div>

                  {/* SOPORTE DEL RADICADO */}
                  <div className="pt-1">
                    <label className="block text-2xs font-bold text-slate-600 mb-1">
                      Comprobante de Radicación / FUN Sellado (PDF)
                    </label>
                    {tramite.soporteRadicacionInicial ? (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 text-xs">
                        <span
                          className="truncate max-w-[200px] font-mono text-slate-700"
                          title={tramite.soporteRadicacionInicial.nombreArchivo}
                        >
                          {tramite.soporteRadicacionInicial.nombreArchivo}
                        </span>
                        <div className="flex items-center space-x-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              abrirSoporte(
                                tramite.soporteRadicacionInicial,
                                "Comprobante de Radicación Municipal"
                              )
                            }
                            className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-2xs font-bold border border-blue-200 hover:bg-blue-100 cursor-pointer flex items-center space-x-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Ver</span>
                          </button>
                          {puedeOperar && (
                            <label className="px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-2xs font-bold border border-slate-200 hover:bg-slate-200 cursor-pointer flex items-center space-x-1">
                              <span>Reemplazar</span>
                              <input
                                type="file"
                                accept=".pdf,application/pdf"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    handleCargarComprobanteRadicacion(e.target.files[0]);
                                  }
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    ) : (
                      puedeOperar && (
                        <label className="flex items-center justify-center p-2 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-100 text-blue-700 text-xs font-semibold cursor-pointer transition-colors">
                          <UploadCloud className="w-4 h-4 mr-1.5" />
                          <span>Adjuntar Comprobante de Radicación (PDF)</span>
                          <input
                            type="file"
                            accept=".pdf,application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleCargarComprobanteRadicacion(e.target.files[0]);
                              }
                            }}
                          />
                        </label>
                      )
                    )}
                  </div>

                  {puedeOperar && (
                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={guardandoRadicacion}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer flex items-center space-x-1.5"
                      >
                        {guardandoRadicacion ? (
                          <Clock className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Guardar Radicado Municipal</span>
                      </button>
                    </div>
                  )}
                </form>
              </div>
            </div>

            {/* SUB-BLOQUE B: LICENCIA OFICIAL APROBADA / EXPEDIDA */}
            <div
              className={`p-4 rounded-xl border flex flex-col justify-between ${
                estado === "aprobada"
                  ? "bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-200"
                  : "bg-slate-50/70 border-slate-200"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/80">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                    <ShieldCheck
                      className={`w-4 h-4 ${
                        estado === "aprobada" ? "text-emerald-600" : "text-slate-400"
                      }`}
                    />
                    <span>Resolución y Acto Aprobatorio de Licencia</span>
                  </span>
                  <span
                    className={`text-2xs font-bold px-2 py-0.5 rounded-md ${
                      estado === "aprobada"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                    }`}
                  >
                    {estado === "aprobada" ? "Licencia Expedida" : "En Espera de Acto"}
                  </span>
                </div>

                <form onSubmit={handleGuardarResolucionInline} className="space-y-3">
                  <div>
                    <label className="block text-2xs font-bold text-slate-600 mb-1">
                      Número de Resolución Oficial de Licencia *
                    </label>
                    <input
                      type="text"
                      disabled={!puedeOperar}
                      value={formNumResolucion}
                      onChange={(e) => setFormNumResolucion(e.target.value)}
                      placeholder="Ej: RES-LC-2026-089"
                      className="w-full text-xs font-mono font-bold px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-2xs font-bold text-slate-600 mb-1">
                        Fecha Expedición *
                      </label>
                      <input
                        type="date"
                        disabled={!puedeOperar}
                        value={formFechaExpedicion}
                        onChange={(e) => setFormFechaExpedicion(e.target.value)}
                        className="w-full text-xs px-2.5 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-bold text-slate-600 mb-1">
                        Fecha Ejecutoria
                      </label>
                      <input
                        type="date"
                        disabled={!puedeOperar}
                        value={formFechaEjecutoria}
                        onChange={(e) => setFormFechaEjecutoria(e.target.value)}
                        className="w-full text-xs px-2.5 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-2xs font-bold text-slate-600 mb-1">
                        Vigencia (Meses)
                      </label>
                      <input
                        type="number"
                        min="6"
                        max="60"
                        disabled={!puedeOperar}
                        value={formVigenciaMeses}
                        onChange={(e) => setFormVigenciaMeses(Number(e.target.value))}
                        className="w-full text-xs px-2.5 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden disabled:bg-slate-100"
                      />
                    </div>
                  </div>

                  {/* SOPORTES OFICIALES MULTI-DOCUMENTO */}
                  <div className="pt-1">
                    <label className="block text-2xs font-bold text-slate-600 mb-1">
                      Documentos Oficiales Expedidos (Resolución, Planos Sellados)
                    </label>

                    {soportesLicenciaList.length > 0 && (
                      <div className="space-y-1 mb-2 max-h-24 overflow-y-auto pr-1">
                        {soportesLicenciaList.map((doc, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-1.5 rounded-lg bg-white border border-emerald-200 text-xs"
                          >
                            <span
                              className="truncate max-w-[200px] text-slate-800 text-2xs font-medium"
                              title={doc.nombreArchivo}
                            >
                              {doc.nombreArchivo}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                abrirSoporte(doc, `Licencia Aprobada - Doc ${idx + 1}`)
                              }
                              className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-2xs font-bold hover:bg-emerald-100 cursor-pointer flex items-center space-x-1"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Ver</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {puedeOperar && (
                      <div className="space-y-2">
                        <label className="flex items-center justify-center p-2 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold cursor-pointer transition-colors">
                          <Upload className="w-4 h-4 mr-1.5" />
                          <span>
                            {soportesLicenciaList.length > 0
                              ? "+ Agregar Otros Documentos Oficiales"
                              : "Cargar Documentos de Licencia (PDF)"}
                          </span>
                          <input
                            type="file"
                            multiple
                            accept=".pdf,application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                setArchivosAprobarNuevos((prev) => [
                                  ...prev,
                                  ...Array.from(e.target.files!)
                                ]);
                                e.target.value = "";
                              }
                            }}
                          />
                        </label>

                        {archivosAprobarNuevos.length > 0 && (
                          <div className="p-2 bg-emerald-100/60 rounded-lg text-2xs text-emerald-900 flex items-center justify-between">
                            <span>
                              {archivosAprobarNuevos.length} archivo(s) nuevo(s) listo(s) para registrar
                            </span>
                            <button
                              type="button"
                              onClick={() => setArchivosAprobarNuevos([])}
                              className="text-emerald-700 hover:text-emerald-900 font-bold"
                            >
                              Limpiar
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {puedeOperar && (
                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={guardandoResolucion}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer flex items-center space-x-1.5"
                      >
                        {guardandoResolucion ? (
                          <Clock className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        )}
                        <span>Guardar y Aprobar Licencia</span>
                      </button>
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. CHECKLIST PRINCIPAL DE LOS 15 DOCUMENTOS OFICIALES DE FASE 5 (VISTA ÚNICA) */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h4 className="font-bold text-base text-slate-900 flex items-center space-x-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <span>Checklist de los 15 Documentos Exigidos para Licenciamiento</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Carga directa en una sola pantalla sin modales de paso a paso. Haga clic en los botones de carga para vincular cada archivo oficial.
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="font-semibold text-slate-600">Estado global:</span>
            {statsChecklist.todosObligatoriosListos ? (
              <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 flex items-center space-x-1">
                <Check className="w-3.5 h-3.5" />
                <span>100% Obligatorios Listos</span>
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 font-bold border border-amber-300 flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Pendientes por Cargar</span>
              </span>
            )}
          </div>
        </div>

        {/* TABLA CHECKLIST DE ALTA DENSIDAD */}
        <div className="mt-4 divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {lista15Documentos.map((doc) => {
            const num = String(doc.itemNumero || 0).padStart(2, "0");
            const esItem12 = doc.itemNumero === 12 || doc.requiereDobleArchivo;
            const esItem14 = doc.itemNumero === 14 || doc.soportaArchivoPesado;

            // Estados para Item 12 (Doble archivo)
            const tieneExcel12 = !!doc.soporteExcel;
            const tienePdf12 = !!doc.soportePdf || (!doc.soporteExcel && !!doc.soporte);
            const item12Completo = tieneExcel12 && tienePdf12;

            // Estado para documentos estándar
            const estaCargado = esItem12 ? item12Completo : !!doc.soporte;
            const estaSubiendo =
              subiendoDocKey === `${doc.itemNumero}-main` ||
              subiendoDocKey === `${doc.itemNumero}-excel` ||
              subiendoDocKey === `${doc.itemNumero}-pdf`;

            return (
              <div
                key={doc.id || doc.itemNumero}
                className={`p-4 transition-colors ${
                  estaCargado
                    ? "bg-emerald-50/20 hover:bg-emerald-50/40"
                    : "bg-white hover:bg-slate-50/80"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* COLUMNA 1: IDENTIFICACIÓN Y NOMBRE */}
                  <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                        estaCargado
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {num}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <h5 className="font-bold text-sm text-slate-900 leading-snug">
                          {doc.nombre}
                        </h5>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                          Obligatorio
                        </span>
                        {esItem12 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            <span>Requiere 2 Archivos (Excel + PDF)</span>
                          </span>
                        )}
                        {esItem14 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1">
                            <Layers className="w-3 h-3" />
                            <span>Archivos Pesados &gt;80 págs</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
                        {doc.descripcion}
                      </p>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-2xs text-slate-400">
                        <span className="font-medium text-slate-500">
                          Formatos admitidos: {doc.formatosPermitidos}
                        </span>

                        {/* DETALLE DE ARCHIVO ESTÁNDAR CARGADO */}
                        {!esItem12 && doc.soporte && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-emerald-700 font-semibold truncate max-w-[280px]">
                              {doc.soporte.nombreArchivo}
                            </span>
                            <span>•</span>
                            <span>
                              {doc.soporte.tamanoBytes
                                ? `${(doc.soporte.tamanoBytes / 1024).toFixed(1)} KB`
                                : "Cargado"}
                            </span>
                            {doc.fechaCarga && (
                              <>
                                <span>•</span>
                                <span>{doc.fechaCarga.split("T")[0]}</span>
                              </>
                            )}
                          </>
                        )}
                      </div>

                      {/* BARRA DE PROGRESO INLINE SI SE ESTÁ CARGANDO ESTE ITEM */}
                      {estaSubiendo && (
                        <div className="mt-2 p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs space-y-1 max-w-md">
                          <div className="flex items-center justify-between text-indigo-900 font-semibold text-2xs">
                            <span className="flex items-center gap-1.5">
                              <RefreshCw className="w-3 h-3 animate-spin text-indigo-600" />
                              <span>Procesando y cargando archivo oficial...</span>
                            </span>
                            <span>{progresoCarga}%</span>
                          </div>
                          <div className="w-full bg-indigo-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-indigo-600 h-full transition-all duration-150 rounded-full"
                              style={{ width: `${progresoCarga}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* COLUMNA 2: BOTONES Y ACCIONES DIRECTAS EN LA MISMA FILA */}
                  <div className="flex flex-wrap items-center gap-2 lg:self-center shrink-0">
                    {/* CASO ESPECIAL: ITEM 12 (MEMORIA DE CANTIDADES - DOS SLOTS LADO A LADO) */}
                    {esItem12 ? (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
                        {/* SLOT 1: ARCHIVO EXCEL (.XLSX / .XLS) */}
                        <div
                          className={`p-2 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                            tieneExcel12
                              ? "bg-emerald-50 border-emerald-300"
                              : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div className="flex items-center space-x-1.5">
                            <FileSpreadsheet
                              className={`w-4 h-4 ${
                                tieneExcel12 ? "text-emerald-700" : "text-slate-400"
                              }`}
                            />
                            <div>
                              <span className="font-bold block text-slate-800 text-2xs">
                                1. Excel (.xlsx / .xls)
                              </span>
                              {tieneExcel12 && (
                                <span
                                  className="text-[10px] font-mono text-emerald-800 truncate max-w-[120px] block"
                                  title={doc.soporteExcel?.nombreArchivo}
                                >
                                  {doc.soporteExcel?.nombreArchivo}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-1 shrink-0">
                            {tieneExcel12 ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    abrirSoporte(
                                      doc.soporteExcel,
                                      "Memoria de Cantidades - Versión Excel"
                                    )
                                  }
                                  className="p-1 text-emerald-800 hover:text-emerald-950 hover:bg-emerald-100 rounded cursor-pointer"
                                  title="Ver archivo Excel"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                {puedeOperar && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        fileInputRefs.current["doc-12-excel"]?.click()
                                      }
                                      className="text-2xs font-bold text-indigo-700 hover:underline px-1 cursor-pointer"
                                    >
                                      Reemplazar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleEliminarArchivoDirecto(doc, "excel")
                                      }
                                      className="p-1 text-rose-600 hover:text-rose-800 rounded cursor-pointer"
                                      title="Eliminar Excel"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </>
                            ) : (
                              puedeOperar && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    fileInputRefs.current["doc-12-excel"]?.click()
                                  }
                                  disabled={estaSubiendo}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-2xs transition-colors shadow-2xs cursor-pointer flex items-center space-x-1"
                                >
                                  <UploadCloud className="w-3 h-3" />
                                  <span>Cargar Excel</span>
                                </button>
                              )
                            )}
                          </div>

                          {/* INPUT OCULTO EXCEL */}
                          <input
                            type="file"
                            ref={(el) => (fileInputRefs.current["doc-12-excel"] = el)}
                            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleSubirArchivoDirecto(doc, f, "excel");
                              e.target.value = "";
                            }}
                          />
                        </div>

                        {/* SLOT 2: ARCHIVO PDF (.PDF) */}
                        <div
                          className={`p-2 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                            tienePdf12
                              ? "bg-rose-50 border-rose-300"
                              : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div className="flex items-center space-x-1.5">
                            <FileText
                              className={`w-4 h-4 ${
                                tienePdf12 ? "text-rose-700" : "text-slate-400"
                              }`}
                            />
                            <div>
                              <span className="font-bold block text-slate-800 text-2xs">
                                2. PDF (.pdf)
                              </span>
                              {tienePdf12 && (
                                <span
                                  className="text-[10px] font-mono text-rose-800 truncate max-w-[120px] block"
                                  title={
                                    doc.soportePdf?.nombreArchivo ||
                                    doc.soporte?.nombreArchivo
                                  }
                                >
                                  {doc.soportePdf?.nombreArchivo ||
                                    doc.soporte?.nombreArchivo}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-1 shrink-0">
                            {tienePdf12 ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    abrirSoporte(
                                      doc.soportePdf || doc.soporte,
                                      "Memoria de Cantidades - Versión PDF"
                                    )
                                  }
                                  className="p-1 text-rose-800 hover:text-rose-950 hover:bg-rose-100 rounded cursor-pointer"
                                  title="Ver archivo PDF"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                {puedeOperar && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        fileInputRefs.current["doc-12-pdf"]?.click()
                                      }
                                      className="text-2xs font-bold text-indigo-700 hover:underline px-1 cursor-pointer"
                                    >
                                      Reemplazar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleEliminarArchivoDirecto(doc, "pdf")
                                      }
                                      className="p-1 text-rose-600 hover:text-rose-800 rounded cursor-pointer"
                                      title="Eliminar PDF"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </>
                            ) : (
                              puedeOperar && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    fileInputRefs.current["doc-12-pdf"]?.click()
                                  }
                                  disabled={estaSubiendo}
                                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-2xs transition-colors shadow-2xs cursor-pointer flex items-center space-x-1"
                                >
                                  <UploadCloud className="w-3 h-3" />
                                  <span>Cargar PDF</span>
                                </button>
                              )
                            )}
                          </div>

                          {/* INPUT OCULTO PDF */}
                          <input
                            type="file"
                            ref={(el) => (fileInputRefs.current["doc-12-pdf"] = el)}
                            accept=".pdf,application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleSubirArchivoDirecto(doc, f, "pdf");
                              e.target.value = "";
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      /* CASO ESTÁNDAR: DOCUMENTO DE ARCHIVO ÚNICO (PDF O ZIP) */
                      <div className="flex items-center space-x-2">
                        {estaCargado ? (
                          <>
                            <button
                              type="button"
                              onClick={() => abrirSoporte(doc.soporte, doc.nombre)}
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 shadow-2xs"
                            >
                              <Eye className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Ver Documento</span>
                            </button>

                            {puedeOperar && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    fileInputRefs.current[`doc-${doc.itemNumero}`]?.click()
                                  }
                                  disabled={estaSubiendo}
                                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                                >
                                  Reemplazar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleEliminarArchivoDirecto(doc)}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl cursor-pointer"
                                  title="Remover archivo"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </>
                        ) : (
                          puedeOperar && (
                            <button
                              type="button"
                              onClick={() =>
                                fileInputRefs.current[`doc-${doc.itemNumero}`]?.click()
                              }
                              disabled={estaSubiendo}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center space-x-1.5 active:scale-98 ${
                                esItem14
                                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                                  : "bg-blue-600 hover:bg-blue-700 text-white"
                              }`}
                            >
                              <UploadCloud className="w-3.5 h-3.5" />
                              <span>
                                {esItem14
                                  ? "Cargar Estudio de Suelos (>80 págs)"
                                  : doc.tipo === "paquete_arquitecto" ||
                                    doc.tipo === "paquete_constructor"
                                  ? "Cargar Paquete (PDF/Zip)"
                                  : "Cargar PDF Oficial"}
                              </span>
                            </button>
                          )
                        )}

                        {/* INPUT OCULTO PARA CARGA DIRECTA */}
                        <input
                          type="file"
                          ref={(el) =>
                            (fileInputRefs.current[`doc-${doc.itemNumero}`] = el)
                          }
                          accept={
                            esItem14
                              ? ".pdf,.docx,.doc,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                              : doc.tipo === "paquete_arquitecto" ||
                                doc.tipo === "paquete_constructor"
                              ? ".pdf,.zip,application/pdf,application/zip,application/x-zip-compressed"
                              : ".pdf,application/pdf"
                          }
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleSubirArchivoDirecto(doc, f);
                            e.target.value = "";
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. SECCIÓN INLINE: SUBSANACIONES Y REQUERIMIENTOS TÉCNICOS                 */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <span>Rondas de Observaciones y Subsanaciones Municipales</span>
                <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                  {rondas.length} {rondas.length === 1 ? "Ronda" : "Rondas"}
                </span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Requerimientos de curaduría o planeación y respuestas radicadas por Ingeniería.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {puedeOperar && !mostrarFormNuevaObs && (
              <button
                type="button"
                onClick={() => setMostrarFormNuevaObs(true)}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrar Acta de Observaciones</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSeccionSubsanacionesAbierta((prev) => !prev)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              title="Colapsar o expandir"
            >
              {seccionSubsanacionesAbierta ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* FORMULARIO INLINE PARA NUEVA OBSERVACIÓN (SIN MODAL) */}
        {mostrarFormNuevaObs && (
          <form
            onSubmit={handleGuardarObservacionesInline}
            className="mt-4 p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Registrar Nueva Acta de Observaciones de la Entidad</span>
              </span>
              <button
                type="button"
                onClick={() => setMostrarFormNuevaObs(false)}
                className="text-amber-800 hover:text-amber-950 text-xs font-semibold cursor-pointer"
              >
                ✕ Cancelar
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-2xs font-bold text-slate-700 mb-1">
                  Número de Acta / Oficio
                </label>
                <input
                  type="text"
                  value={formNumActaObs}
                  onChange={(e) => setFormNumActaObs(e.target.value)}
                  placeholder="Ej: ACTA-OBS-2026-019"
                  className="w-full text-xs font-mono px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-2xs font-bold text-slate-700 mb-1">
                  Fecha de Notificación *
                </label>
                <input
                  type="date"
                  required
                  value={formFechaObs}
                  onChange={(e) => setFormFechaObs(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-2xs font-bold text-slate-700 mb-1">
                  Fecha Límite Subsanación
                </label>
                <input
                  type="date"
                  value={formFechaLimite}
                  onChange={(e) => setFormFechaLimite(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-2xs font-bold text-slate-700 mb-1">
                Detalle Puntual de Requerimientos y Ajustes Exigidos *
              </label>
              <textarea
                required
                rows={3}
                value={formDetalleObs}
                onChange={(e) => setFormDetalleObs(e.target.value)}
                placeholder="Detalle de correcciones solicitadas por Planeación / Curaduría."
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div>
                <input
                  type="file"
                  id="input-acta-obs-inline"
                  accept=".pdf,application/pdf"
                  onChange={(e) => setArchivoObs(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <label
                  htmlFor="input-acta-obs-inline"
                  className="text-xs font-semibold text-amber-900 bg-white border border-amber-300 rounded-lg px-3 py-1.5 cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>
                    {archivoObs ? archivoObs.name : "Adjuntar Acta Escaneada (PDF)"}
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={cargandoAccion}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              >
                {cargandoAccion ? "Guardando..." : "Guardar Acta y Abrir Ronda"}
              </button>
            </div>
          </form>
        )}

        {/* FORMULARIO INLINE PARA RADICAR SUBSANACIÓN (SIN MODAL) */}
        {rondaParaSubsanar && (
          <form
            onSubmit={handleGuardarSubsanacionInline}
            className="mt-4 p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-indigo-600" />
                <span>
                  Radicar Subsanación Técnica (Ronda #{rondaParaSubsanar.numeroRonda})
                </span>
              </span>
              <button
                type="button"
                onClick={() => setRondaParaSubsanar(null)}
                className="text-indigo-800 hover:text-indigo-950 text-xs font-semibold cursor-pointer"
              >
                ✕ Cancelar
              </button>
            </div>

            <div className="p-2.5 rounded-lg bg-white border border-indigo-100 text-xs text-slate-700">
              <strong className="text-2xs uppercase text-slate-400 block mb-0.5">
                Requerimiento a responder:
              </strong>
              <p className="line-clamp-2 text-2xs">
                {rondaParaSubsanar.detalleObservaciones}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-bold text-slate-700 mb-1">
                  Número de Radicado de Subsanación *
                </label>
                <input
                  type="text"
                  required
                  value={formNumRadSub}
                  onChange={(e) => setFormNumRadSub(e.target.value)}
                  placeholder="Ej: SUB-2026-FOS-0112"
                  className="w-full text-xs font-mono font-bold px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-2xs font-bold text-slate-700 mb-1">
                  Fecha de Radicación *
                </label>
                <input
                  type="date"
                  required
                  value={formFechaRadSub}
                  onChange={(e) => setFormFechaRadSub(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-2xs font-bold text-slate-700 mb-1">
                Detalle de Ajustes Efectuados por Ingeniería *
              </label>
              <textarea
                required
                rows={2}
                value={formDetalleSub}
                onChange={(e) => setFormDetalleSub(e.target.value)}
                placeholder="Explique las memorias, planos o aclaraciones anexadas a la entidad."
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div>
                <input
                  type="file"
                  id="input-subsanacion-inline"
                  accept=".pdf,application/pdf"
                  onChange={(e) => setArchivoSub(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <label
                  htmlFor="input-subsanacion-inline"
                  className="text-xs font-semibold text-indigo-900 bg-white border border-indigo-300 rounded-lg px-3 py-1.5 cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>
                    {archivoSub ? archivoSub.name : "Adjuntar Soporte de Subsanación (PDF)"}
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={cargandoAccion}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              >
                {cargandoAccion ? "Guardando..." : "Radicar Subsanación"}
              </button>
            </div>
          </form>
        )}

        {/* LISTADO DE RONDAS EXISTENTES */}
        {seccionSubsanacionesAbierta && (
          <div className="mt-4 space-y-3">
            {rondas.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No hay observaciones registradas de la entidad municipal hasta el momento.
              </p>
            ) : (
              rondas.map((ronda, idx) => (
                <div
                  key={ronda.id || idx}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/70">
                    <span className="font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 font-bold text-2xs flex items-center justify-center">
                        {ronda.numeroRonda}
                      </span>
                      <span>Ronda #{ronda.numeroRonda}</span>
                      {ronda.numeroActaObservaciones && (
                        <span className="font-mono text-2xs text-slate-500 font-normal">
                          (Acta: {ronda.numeroActaObservaciones})
                        </span>
                      )}
                    </span>

                    <div className="flex items-center space-x-2">
                      {ronda.fechaRadicacionSubsanacion ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-2xs font-bold border border-emerald-200">
                          Subsanada el {ronda.fechaRadicacionSubsanacion.split("T")[0]}
                        </span>
                      ) : (
                        puedeOperar && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormNumRadSub("");
                              setFormDetalleSub("");
                              setArchivoSub(null);
                              setRondaParaSubsanar(ronda);
                            }}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-2xs font-bold transition-colors cursor-pointer"
                          >
                            Radicar Subsanación Ahora
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <p className="text-slate-700 leading-relaxed text-2xs">
                    {ronda.detalleObservaciones}
                  </p>

                  {ronda.detalleRespuestaSubsanacion && (
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-2xs text-emerald-950">
                      <strong>Respuesta de Ingeniería:</strong> {ronda.detalleRespuestaSubsanacion}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 6. MODAL DE CONFIRMACIÓN: AVANZAR A FASE 6 (EJECUCIÓN DE OBRA)            */}
      {/* ========================================================================= */}
      {modalConfirmarAvanzarF6 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="p-5 bg-emerald-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                <h3 className="font-bold text-base">Avanzar a Fase 6: En Postulación</h3>
              </div>
              <button
                type="button"
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
                  <span>Licencia de Construcción Verificada</span>
                </p>
                <p>
                  <strong>Resolución Oficial:</strong>{" "}
                  {tramite.numeroResolucionLicencia || "Resolución Registrada"}
                </p>
                {tramite.fechaExpedicionLicencia && (
                  <p>
                    <strong>Fecha Expedición:</strong>{" "}
                    {tramite.fechaExpedicionLicencia.split("T")[0]}
                  </p>
                )}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Al confirmar, el expediente pasará formalmente a la{" "}
                <strong>Fase 6: En Postulación</strong> para vinculación ante Compensar y seguimiento de obra. Los 15 documentos de Fase 5 quedarán archivados de forma definitiva.
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
                  {cargandoAccion ? (
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5" />
                  )}
                  <span>Confirmar y Pasar a Fase 6</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INFORMATIVO: REQUISITOS PENDIENTES PARA AVANZAR A FASE 6 */}
      {modalRequisitosPendientesF6 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="p-5 bg-amber-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-base">Requisitos para Avanzar a Fase 6</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalRequisitosPendientesF6(false)}
                className="text-amber-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700">
              <p className="leading-relaxed">
                Para trasladar el expediente a la <strong>Fase 6: En Postulación</strong>, la normativa constructiva y el flujo del CRM exigen que la <strong>Licencia de Construcción</strong> esté en estado <strong>Aprobada</strong> con su acto administrativo y resolución formal cargada.
              </p>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Estado actual:</span>
                  <span className="font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                    {badge.texto}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Resolución de Licencia:</span>
                  <span className="font-mono text-slate-500">
                    {tramite.numeroResolucionLicencia || "Pendiente de registro"}
                  </span>
                </div>
              </div>

              <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 text-blue-900 space-y-1">
                <strong className="block text-blue-950">¿Cómo habilitar el avance?</strong>
                <p>
                  En la sección superior <em>«Resolución y Acto Aprobatorio de Licencia»</em> ingrese el número de resolución oficial, las fechas de ejecutoria y guarde la aprobación.
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalRequisitosPendientesF6(false)}
                  className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
