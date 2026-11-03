import React, { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  X,
  FileText,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  ShieldCheck,
  Camera,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { FotoRegistro } from "../types";

// Configure pdfjs worker using standard unpkg CDN matching the pdfjs version
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocVisorModalProps {
  titulo: string;
  nombreArchivo: string;
  mimeType: string;
  sha256Hash: string;
  tamanoBytes: number;
  subidoPor?: string;
  subidoEn?: string;
  archivoDataUrl?: string;
  fotos?: FotoRegistro[];
  fotoInicialIndex?: number;
  onClose: () => void;
}

export const DocVisorModal: React.FC<DocVisorModalProps> = ({
  titulo,
  nombreArchivo,
  mimeType,
  sha256Hash,
  tamanoBytes,
  subidoPor,
  subidoEn,
  archivoDataUrl,
  fotos,
  fotoInicialIndex = 0,
  onClose
}) => {
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [fotoActivaIndex, setFotoActivaIndex] = useState<number>(fotoInicialIndex);

  // Estados react-pdf
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [pdfLoading, setPdfLoading] = useState<boolean>(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(800);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof fotoInicialIndex === "number" && fotoInicialIndex >= 0) {
      setFotoActivaIndex(fotoInicialIndex);
    }
  }, [fotoInicialIndex]);

  // Observer para el ancho del contenedor del visor PDF
  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(Math.max(320, containerRef.current.clientWidth - 48));
      }
    };
    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const tieneGaleria = Array.isArray(fotos) && fotos.length > 0;
  const fotoActual = tieneGaleria ? fotos[fotoActivaIndex] : null;

  const esPdf = !tieneGaleria && (mimeType.toLowerCase().includes("pdf") || nombreArchivo.toLowerCase().endsWith(".pdf"));
  const esImagen = tieneGaleria || mimeType.toLowerCase().startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(nombreArchivo);

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleResetView = () => {
    setZoom(100);
    setRotation(0);
  };

  const handlePrevFoto = () => {
    if (tieneGaleria) {
      setFotoActivaIndex((prev) => (prev > 0 ? prev - 1 : fotos.length - 1));
      handleResetView();
    }
  };

  const handleNextFoto = () => {
    if (tieneGaleria) {
      setFotoActivaIndex((prev) => (prev < fotos.length - 1 ? prev + 1 : 0));
      handleResetView();
    }
  };

  const handlePrevPdfPage = () => {
    setPageNumber((prev) => Math.max(1, prev - 1));
  };

  const handleNextPdfPage = () => {
    if (numPages) {
      setPageNumber((prev) => Math.min(numPages, prev + 1));
    }
  };

  // Teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        if (tieneGaleria) handlePrevFoto();
        else if (esPdf) handlePrevPdfPage();
      }
      if (e.key === "ArrowRight") {
        if (tieneGaleria) handleNextFoto();
        else if (esPdf) handleNextPdfPage();
      }
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tieneGaleria, fotos?.length, esPdf, numPages, onClose]);

  const aplicarParametroAntiCache = (url?: string) => {
    if (!url || url.startsWith("data:")) return url;
    const urlLimpia = url.replace(/([?&])t=\d+(&|$)/g, "$1").replace(/[?&]$/, "");
    const sep = urlLimpia.includes("?") ? "&" : "?";
    return `${urlLimpia}${sep}t=${Date.now()}`;
  };

  const urlBase = fotoActual ? fotoActual.url : archivoDataUrl;
  const urlVisualizar = aplicarParametroAntiCache(urlBase);
  const nombreDescargar = fotoActual ? fotoActual.nombre : nombreArchivo;

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setPdfLoading(false);
    setPdfError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error("Error al cargar PDF con react-pdf:", error);
    setPdfError("No se pudo previsualizar el archivo PDF directamente en el visor.");
    setPdfLoading(false);
  };

  // Ancho efectivo para la página PDF considerando zoom
  const pageCalculatedWidth = Math.min(
    1400,
    Math.max(300, (containerWidth * (zoom / 100)))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-3 sm:p-5 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="doc-visor-titulo"
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden border border-slate-200"
      >
        {/* Cabecera del visor */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className={`p-2 rounded-lg shrink-0 ${tieneGaleria ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
              {tieneGaleria ? <Camera className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2 truncate">
                <h3 id="doc-visor-titulo" title={titulo} className="font-semibold text-slate-800 text-sm sm:text-base truncate">
                  {titulo}
                </h3>
                {tieneGaleria && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-full text-[10px]">
                    Álbum: {fotoActivaIndex + 1} de {fotos.length} fotos
                  </span>
                )}
                {esPdf && numPages && numPages > 0 && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-bold rounded-full text-[10px]">
                    Pág. {pageNumber} de {numPages}
                  </span>
                )}
              </div>
              <p title={fotoActual ? `${fotoActual.categoria || "Registro"} • ${fotoActual.nombre}` : `${nombreArchivo} • ${(tamanoBytes / 1024).toFixed(1)} KB`} className="text-xs text-slate-500 truncate">
                {fotoActual ? (
                  <>
                    <strong className="text-slate-700">{fotoActual.categoria || "Registro"}</strong> • {fotoActual.nombre} • {(fotoActual.tamanoBytes / 1024).toFixed(1)} KB
                  </>
                ) : (
                  <>
                    {nombreArchivo} • {(tamanoBytes / 1024).toFixed(1)} KB • {mimeType}
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {urlVisualizar && (
              <a
                href={urlVisualizar}
                download={nombreDescargar}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
                title="Descargar archivo"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Descargar</span>
              </a>
            )}

            {/* Navegación de páginas PDF */}
            {esPdf && numPages && numPages > 1 && (
              <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-1 text-xs text-slate-700 space-x-1">
                <button
                  type="button"
                  onClick={handlePrevPdfPage}
                  disabled={pageNumber <= 1}
                  className="p-1 hover:bg-white rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-1 font-medium text-slate-800">
                  {pageNumber} / {numPages}
                </span>
                <button
                  type="button"
                  onClick={handleNextPdfPage}
                  disabled={pageNumber >= numPages}
                  className="p-1 hover:bg-white rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Página siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Controles Zoom y Rotación */}
            {(esImagen || esPdf) && (
              <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 text-xs text-slate-600 space-x-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(50, z - 25))}
                  className="p-1 hover:bg-slate-100 rounded cursor-pointer"
                  title="Alejar"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="px-1.5 font-medium text-slate-700 min-w-[38px] text-center">{zoom}%</span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(250, z + 25))}
                  className="p-1 hover:bg-slate-100 rounded cursor-pointer"
                  title="Acercar"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleRotate}
                  className="p-1 hover:bg-slate-100 rounded text-slate-700 cursor-pointer border-l border-slate-200 pl-1.5 ml-0.5 flex items-center space-x-1"
                  title="Rotar 90° (React-PDF nativo)"
                >
                  <RotateCw className="w-4 h-4" />
                  <span className="text-[10px] font-mono font-bold text-slate-500 hidden md:inline">{rotation}°</span>
                </button>
                {(zoom !== 100 || rotation !== 0) && (
                  <button
                    type="button"
                    onClick={handleResetView}
                    className="p-1 hover:bg-slate-100 rounded text-amber-600 cursor-pointer border-l border-slate-200 pl-1.5 ml-0.5"
                    title="Restablecer vista a 100% y 0°"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              aria-label="Cerrar visor de documento"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cuerpo del visor interactivo */}
        <div
          ref={containerRef}
          className="flex-1 bg-slate-900/90 relative overflow-auto flex flex-col items-center justify-start p-4 min-h-0 select-none"
        >
          {urlVisualizar ? (
            esPdf ? (
              <div className="w-full h-full flex flex-col items-center justify-start relative">
                {/* Indicador superior de controles rápida */}
                <div className="w-full max-w-4xl bg-slate-800/90 backdrop-blur-xs text-white px-4 py-2 rounded-lg mb-3 flex items-center justify-between text-xs border border-slate-700 shrink-0">
                  <div className="flex items-center space-x-2 truncate">
                    <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="font-medium truncate">{nombreArchivo}</span>
                  </div>
                  <div className="flex items-center space-x-3 shrink-0">
                    {numPages && (
                      <span className="text-slate-300">
                        Página <strong>{pageNumber}</strong> de <strong>{numPages}</strong>
                      </span>
                    )}
                    <a
                      href={urlVisualizar}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
                    >
                      <span>Abrir externo</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Renderizado interactivo nativo con react-pdf */}
                <div className="flex-1 w-full flex items-center justify-center overflow-auto p-2">
                  <Document
                    file={urlVisualizar}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={
                      <div className="flex flex-col items-center justify-center p-12 text-slate-300 space-y-3">
                        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                        <p className="text-sm font-medium">Renderizando documento PDF con react-pdf...</p>
                      </div>
                    }
                    error={
                      <div className="bg-white p-6 rounded-xl shadow-lg max-w-md text-center border border-slate-200 my-auto">
                        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                        <h4 className="font-bold text-slate-800 text-sm mb-1">Previsualización incrustada no disponible</h4>
                        <p className="text-xs text-slate-600 mb-4">
                          {pdfError || "El archivo no se pudo renderizar directamente en el canvas."}
                        </p>
                        <a
                          href={urlVisualizar}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Abrir en ventana independiente</span>
                        </a>
                      </div>
                    }
                  >
                    {!pdfError && (
                      <div className="shadow-2xl rounded-lg overflow-hidden border border-slate-700 bg-white transition-all duration-150">
                        <Page
                          pageNumber={pageNumber}
                          width={pageCalculatedWidth}
                          rotate={rotation}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          loading={
                            <div className="flex flex-col items-center justify-center p-8 text-slate-500 space-y-2 bg-white">
                              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                              <span className="text-xs font-medium">Cargando página {pageNumber}...</span>
                            </div>
                          }
                        />
                      </div>
                    )}
                  </Document>
                </div>

                {/* Navegación flotante inferior si es multi-página */}
                {numPages && numPages > 1 && (
                  <div className="mt-3 bg-slate-800/90 text-white px-4 py-2 rounded-full border border-slate-700 flex items-center space-x-3 shadow-xl backdrop-blur-xs shrink-0 z-10">
                    <button
                      type="button"
                      onClick={handlePrevPdfPage}
                      disabled={pageNumber <= 1}
                      className="p-1 hover:bg-slate-700 rounded-full cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Página anterior"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-xs font-semibold px-2">
                      Página {pageNumber} de {numPages}
                    </span>
                    <button
                      type="button"
                      onClick={handleNextPdfPage}
                      disabled={pageNumber >= numPages}
                      className="p-1 hover:bg-slate-700 rounded-full cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Página siguiente"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            ) : esImagen ? (
              <div className="relative w-full h-full flex items-center justify-center overflow-auto p-4 select-none">
                <img
                  src={urlVisualizar}
                  alt={nombreDescargar}
                  className="max-h-full max-w-full object-contain rounded-lg shadow-2xl border border-slate-700 transition-transform duration-150"
                  style={{ transform: `scale(${zoom / 100}) rotate(${rotation}deg)`, transformOrigin: "center center" }}
                />

                {/* Controles flotantes de navegación si hay múltiples fotos */}
                {tieneGaleria && fotos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrevFoto}
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full shadow-lg border border-slate-600 transition-all cursor-pointer backdrop-blur-xs"
                      title="Foto anterior (Flecha izquierda)"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextFoto}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full shadow-lg border border-slate-600 transition-all cursor-pointer backdrop-blur-xs"
                      title="Siguiente foto (Flecha derecha)"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </>
                )}

                {/* Etiqueta de la categoría flotante sobre la foto */}
                {fotoActual?.categoria && (
                  <div className="absolute top-4 left-4 px-3 py-1.5 bg-slate-900/80 backdrop-blur-xs text-white rounded-lg text-xs font-semibold border border-slate-700 shadow-lg flex items-center space-x-1.5">
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                    <span>{fotoActual.categoria}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white p-8 rounded-xl shadow-md max-w-lg w-full text-center border border-slate-200 my-auto">
                <div className="inline-flex p-4 bg-blue-50 border border-blue-200 rounded-2xl mb-4 text-blue-600">
                  <FileText className="w-12 h-12" />
                </div>
                <h4 className="text-base font-bold text-slate-800 mb-1">{nombreArchivo}</h4>
                <p className="text-xs text-slate-600 mb-4">
                  Documento binario almacenado con éxito ({mimeType}). Puede descargarlo directamente para visualizarlo.
                </p>
                <a
                  href={urlVisualizar}
                  download={nombreArchivo}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar y abrir en su equipo</span>
                </a>
              </div>
            )
          ) : (
            <div
              className="bg-white p-6 sm:p-8 rounded-xl shadow-md max-w-2xl w-full text-center border border-slate-200 my-auto"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
            >
              <div className="inline-flex p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-3 text-slate-600">
                <FileText className="w-12 h-12 text-blue-600" />
              </div>
              <h4 className="text-base font-bold text-slate-800 mb-1">{nombreArchivo}</h4>
              <p className="text-xs text-slate-600 max-w-md mx-auto mb-4">
                Documento radicado y validado. Almacenado de forma segura en el repositorio inmutable del expediente.
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-left text-xs text-slate-600 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Hash Criptográfico (SHA-256):</span>
                  <span className="truncate max-w-[240px]" title={sha256Hash}>
                    {sha256Hash}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Subido por:</span>
                  <span>{subidoPor || "Usuario autenticado"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Fecha de recepción:</span>
                  <span>{subidoEn ? new Date(subidoEn).toLocaleString("es-CO") : "Reciente"}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* TIRA DE MINIATURAS SI ES GALERÍA FOTOGRÁFICA */}
        {tieneGaleria && (
          <div className="bg-slate-900 border-t border-slate-800 px-4 py-2.5 flex items-center space-x-2 overflow-x-auto shrink-0">
            {fotos.map((f, index) => (
              <button
                key={f.id || index}
                type="button"
                onClick={() => {
                  setFotoActivaIndex(index);
                  handleResetView();
                }}
                className={`relative shrink-0 rounded-lg overflow-hidden border-2 transition-all p-0.5 cursor-pointer ${
                  fotoActivaIndex === index
                    ? "border-amber-400 ring-2 ring-amber-400/40 scale-105"
                    : "border-slate-700 opacity-60 hover:opacity-100 hover:border-slate-500"
                }`}
                title={`${f.categoria || "Foto"} - ${f.nombre}`}
              >
                <img
                  src={f.url}
                  alt={f.nombre}
                  className="w-16 h-12 object-cover rounded"
                />
                <span title={f.nombre} className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-slate-200 truncate px-1 text-center font-medium">
                  {f.categoria || `Foto ${index + 1}`}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Barra de estado inferior */}
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center space-x-1.5 text-emerald-600">
            <ShieldCheck className="w-4 h-4" />
            <span>Evidencia digital inmutable radicada en el expediente VRD</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {tieneGaleria ? `${fotos.length} fotografías verificadas` : `Hash: ${sha256Hash.substring(0, 18)}...`}
          </div>
        </div>
      </div>
    </div>
  );
};
