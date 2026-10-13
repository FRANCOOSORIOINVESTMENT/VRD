import React from "react";
import {
  X,
  FileText,
  ZoomIn,
  ZoomOut,
  Download,
  ShieldCheck,
  Camera,
  ChevronLeft,
  ChevronRight,
  ImageIcon
} from "lucide-react";
import { FotoRegistro } from "../types";

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
  const [zoom, setZoom] = React.useState<number>(100);
  const [fotoActivaIndex, setFotoActivaIndex] = React.useState<number>(fotoInicialIndex);

  React.useEffect(() => {
    if (typeof fotoInicialIndex === "number" && fotoInicialIndex >= 0) {
      setFotoActivaIndex(fotoInicialIndex);
    }
  }, [fotoInicialIndex]);

  const tieneGaleria = Array.isArray(fotos) && fotos.length > 0;
  const fotoActual = tieneGaleria ? fotos[fotoActivaIndex] : null;

  const esPdf = !tieneGaleria && (mimeType.toLowerCase().includes("pdf") || nombreArchivo.toLowerCase().endsWith(".pdf"));
  const esImagen = tieneGaleria || mimeType.toLowerCase().startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(nombreArchivo);

  const handlePrevFoto = () => {
    if (tieneGaleria) {
      setFotoActivaIndex((prev) => (prev > 0 ? prev - 1 : fotos.length - 1));
      setZoom(100);
    }
  };

  const handleNextFoto = () => {
    if (tieneGaleria) {
      setFotoActivaIndex((prev) => (prev < fotos.length - 1 ? prev + 1 : 0));
      setZoom(100);
    }
  };

  // Escuchar flechas del teclado y escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrevFoto();
      if (e.key === "ArrowRight") handleNextFoto();
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tieneGaleria, fotos?.length, onClose, fotoActivaIndex]);

  const aplicarParametroAntiCache = (url?: string) => {
    if (!url || url.startsWith("data:")) return url;
    const urlLimpia = url.replace(/([?&])t=\d+(&|$)/g, "$1").replace(/[?&]$/, "");
    const sep = urlLimpia.includes("?") ? "&" : "?";
    return `${urlLimpia}${sep}t=${Date.now()}`;
  };

  const urlBase = fotoActual ? fotoActual.url : archivoDataUrl;
  const urlVisualizar = aplicarParametroAntiCache(urlBase);
  const nombreDescargar = fotoActual ? fotoActual.nombre : nombreArchivo;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-3 sm:p-5 animate-in fade-in duration-150">
      <div role="dialog" aria-modal="true" aria-labelledby="doc-visor-titulo" className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Cabecera del visor */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className={`p-2 rounded-lg shrink-0 ${tieneGaleria ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
              {tieneGaleria ? <Camera className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2 truncate">
                <h3 id="doc-visor-titulo" title={titulo} className="font-semibold text-slate-800 text-sm sm:text-base truncate">{titulo}</h3>
                {tieneGaleria && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-full text-[10px]">
                    Álbum: {fotoActivaIndex + 1} de {fotos.length} fotos
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
                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-xs"
                title="Descargar imagen/archivo"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Descargar</span>
              </a>
            )}
            {esImagen && (
              <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 text-xs text-slate-600 space-x-1">
                <button
                  type="button"
                  onClick={() => setZoom(Math.max(50, zoom - 25))}
                  className="p-1 hover:bg-slate-100 rounded"
                  title="Alejar"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="px-1.5 font-medium">{zoom}%</span>
                <button
                  type="button"
                  onClick={() => setZoom(Math.min(200, zoom + 25))}
                  className="p-1 hover:bg-slate-100 rounded"
                  title="Acercar"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
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
        <div className="flex-1 bg-slate-900/90 relative overflow-hidden flex flex-col items-center justify-center min-h-0">
          {urlVisualizar ? (
            esPdf ? (
              <div className="w-full h-full rounded-lg overflow-hidden border border-slate-300 shadow-sm bg-white flex flex-col">
                <iframe
                  src={urlVisualizar}
                  title={nombreArchivo}
                  className="w-full h-full border-0"
                />
              </div>
            ) : esImagen ? (
              <div className="relative w-full h-full flex items-center justify-center overflow-auto p-4 select-none">
                <img
                  src={urlVisualizar}
                  alt={nombreDescargar}
                  className="max-h-full max-w-full object-contain rounded-lg shadow-2xl border border-slate-700 transition-transform duration-150"
                  style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center center" }}
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
              <div className="bg-white p-8 rounded-xl shadow-md max-w-lg w-full text-center border border-slate-200">
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
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar y abrir en su equipo</span>
                </a>
              </div>
            )
          ) : (
            <div
              className="bg-white p-6 sm:p-8 rounded-xl shadow-md max-w-2xl w-full text-center border border-slate-200"
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
                  setZoom(100);
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
