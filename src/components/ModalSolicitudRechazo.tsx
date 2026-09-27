import React, { useState, useEffect } from "react";
import { Expediente, PerfilUsuario } from "../types";
import { UserX, AlertTriangle, FileUp, Check, X, ShieldAlert, Paperclip } from "lucide-react";
import { formatearRol } from "../utils/formatoRoles";

interface ModalSolicitudRechazoProps {
  expediente: Expediente;
  currentUser: PerfilUsuario;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (datos: {
    motivo: string;
    justificacion: string;
    evidenciaUrl?: string;
    evidenciaNombre?: string;
  }) => Promise<void>;
}

export const MOTIVOS_RECHAZO_ESTANDAR = [
  "No cumple requisitos prediales",
  "No cumple condiciones socioeconómicas",
  "Desistimiento del postulante",
  "Inconsistencia documental no subsanable",
  "Rechazo de Compensar",
  "Fallecimiento del postulante",
  "Predio en zona de alto riesgo no mitigable",
  "Otro motivo"
];

export const ModalSolicitudRechazo: React.FC<ModalSolicitudRechazoProps> = ({
  expediente,
  currentUser,
  isOpen,
  onClose,
  onConfirm
}) => {
  const [motivo, setMotivo] = useState<string>(MOTIVOS_RECHAZO_ESTANDAR[0]);
  const [justificacion, setJustificacion] = useState<string>("");
  const [evidenciaNombre, setEvidenciaNombre] = useState<string>("");
  const [evidenciaUrl, setEvidenciaUrl] = useState<string>("");
  const [enviando, setEnviando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justificacion.trim()) {
      setError("Debe detallar la justificación de la solicitud de rechazo.");
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      await onConfirm({
        motivo,
        justificacion,
        evidenciaUrl,
        evidenciaNombre
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al procesar la solicitud de rechazo.");
    } finally {
      setEnviando(false);
    }
  };

  const handleArchivoSeleccionado = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEvidenciaNombre(file.name);
      // Simular almacenamiento o dataURL para evidencia
      const reader = new FileReader();
      reader.onload = () => {
        setEvidenciaUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const esSupervisorOAdmin = currentUser.rol === "supervisor" || currentUser.rol === "administrador";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 animate-in fade-in duration-150">
      <div role="dialog" aria-modal="true" aria-labelledby="modal-rechazo-titulo" className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 border border-slate-200">
        <div className="flex items-start justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <h3 id="modal-rechazo-titulo" className="text-base font-bold text-slate-900">
                {esSupervisorOAdmin ? "Rechazo del Hogar" : "Solicitar Rechazo del Hogar"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Expediente: <strong>{expediente.codigoVisible || expediente.id.toUpperCase()}</strong> • Fase {expediente.faseActual}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar modal de rechazo"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Nota explicativa de permisos y flujo intermedio */}
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start space-x-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            {esSupervisorOAdmin ? (
              <span>
                Como <strong>{formatearRol(currentUser.rol).toUpperCase()}</strong>, al confirmar este rechazo se ejecutará la <strong>Salida Definitiva</strong> del hogar, generando la tarea obligatoria al Gestor Rural de notificación formal y la carta de salida.
              </span>
            ) : (
              <span>
                Al enviar esta solicitud, el expediente pasará al estado intermedio <strong>&quot;Rechazo Propuesto — Pendiente Aprobación del Analista Documental&quot;</strong>, notificando de inmediato al Analista Documental con alta prioridad.
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label htmlFor="modal-rechazo-motivo" className="block font-semibold text-slate-700 mb-1">
              Motivo Estándar del Rechazo:
            </label>
            <select
              id="modal-rechazo-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 outline-none focus:border-rose-500 bg-white font-medium"
            >
              {MOTIVOS_RECHAZO_ESTANDAR.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="modal-rechazo-justificacion" className="block font-semibold text-slate-700 mb-1">
              Justificación Detallada (Obligatorio):
            </label>
            <textarea
              id="modal-rechazo-justificacion"
              rows={4}
              required
              value={justificacion}
              onChange={(e) => setJustificacion(e.target.value)}
              placeholder="Describa de manera pormenorizada las razones por las cuales el hogar no es viable en el programa o los hechos sobrevinientes..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 outline-none focus:border-rose-500 leading-relaxed"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Documento o Evidencia de Soporte (PDF opcional):
            </label>
            <div className="flex items-center space-x-2">
              <label htmlFor="modal-rechazo-input-soporte" className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-slate-700 font-medium cursor-pointer flex items-center space-x-1.5 transition-colors focus-within:ring-2 focus-within:ring-rose-500">
                <FileUp className="w-4 h-4 text-slate-600" />
                <span>Adjuntar archivo</span>
                <input
                  id="modal-rechazo-input-soporte"
                  type="file"
                  accept=".pdf,.jpg,.png"
                  onChange={handleArchivoSeleccionado}
                  className="sr-only"
                />
              </label>
              {evidenciaNombre && (
                <span title={evidenciaNombre} className="text-[11px] font-medium text-slate-600 flex items-center space-x-1 truncate max-w-xs">
                  <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                  <span>{evidenciaNombre}</span>
                </span>
              )}
            </div>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold text-xs transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:bg-slate-300"
            >
              <UserX className="w-4 h-4" />
              <span>{enviando ? "Procesando..." : esSupervisorOAdmin ? "Confirmar Rechazo Definitivo" : "Enviar Solicitud al Analista Documental"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
