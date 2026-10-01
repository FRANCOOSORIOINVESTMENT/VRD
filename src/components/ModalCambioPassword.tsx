import React, { useState } from "react";
import { PerfilUsuario } from "../types";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  KeyRound,
  LogOut,
  RefreshCw,
  X
} from "lucide-react";

interface ModalCambioPasswordProps {
  usuario: PerfilUsuario;
  /**
   * Callback invocado tras el cambio exitoso de contraseña.
   * Provee el objeto PerfilUsuario con `requiere_cambio_password: false`.
   */
  onPasswordCambiada: (usuarioActualizado: PerfilUsuario) => void;
  /**
   * Callback para cerrar sesión si el usuario no desea completar el cambio obligatorio.
   */
  onCerrarSesion?: () => void;
  /**
   * Si es opcional (cambio voluntario desde el perfil del usuario), permite cerrar la ventana.
   */
  esVoluntario?: boolean;
  onCerrarModal?: () => void;
}

/**
 * Componente ModalCambioPassword
 * Garantiza el cumplimiento de políticas de seguridad al exigir o permitir
 * la actualización de la contraseña con cifrado bcrypt en el servidor.
 */
export const ModalCambioPassword: React.FC<ModalCambioPasswordProps> = ({
  usuario,
  onPasswordCambiada,
  onCerrarSesion,
  esVoluntario = false,
  onCerrarModal
}) => {
  const [nuevaPassword, setNuevaPassword] = useState<string>("");
  const [confirmarPassword, setConfirmarPassword] = useState<string>("");
  const [mostrarNueva, setMostrarNueva] = useState<boolean>(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState<boolean>(false);
  const [cargando, setCargando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  // Criterios de validación en tiempo real
  const tieneLongitudMinima = nuevaPassword.length >= 8;
  const tieneNumero = /\d/.test(nuevaPassword);
  const tieneLetra = /[a-zA-Z]/.test(nuevaPassword);
  const coinciden = Boolean(nuevaPassword && nuevaPassword === confirmarPassword);
  const esDiferenteDeDefecto = nuevaPassword !== "crm2026*";

  const formularioValido =
    tieneLongitudMinima && tieneNumero && tieneLetra && coinciden && esDiferenteDeDefecto;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setExito(null);

    if (!tieneLongitudMinima) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (!tieneNumero || !tieneLetra) {
      setError("La contraseña debe incluir al menos una letra y un número.");
      return;
    }
    if (!esDiferenteDeDefecto) {
      setError("Debe elegir una contraseña diferente a la contraseña genérica por defecto.");
      return;
    }
    if (nuevaPassword !== confirmarPassword) {
      setError("La nueva contraseña y la confirmación no coinciden.");
      return;
    }

    setCargando(true);
    try {
      const token = localStorage.getItem("crm_user_token") || usuario.id;
      const res = await fetch("/api/auth/cambiar-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          nuevaPassword: nuevaPassword.trim(),
          confirmarPassword: confirmarPassword.trim()
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se pudo actualizar la contraseña. Verifique los datos ingresados.");
        return;
      }

      setExito("¡Contraseña actualizada y cifrada con bcrypt exitosamente!");

      // Breve retardo para feedback visual antes de pasar a la aplicación
      setTimeout(() => {
        const usuarioActualizado: PerfilUsuario = {
          ...usuario,
          ...data.user,
          requiere_cambio_password: false,
          requiereCambioPassword: false
        };
        onPasswordCambiada(usuarioActualizado);
      }, 900);
    } catch (err: any) {
      setError(err?.message || "Error de red al contactar el servidor de autenticación.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Encabezado con identidad de seguridad */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-6 text-white relative">
          {esVoluntario && onCerrarModal && (
            <button
              type="button"
              onClick={onCerrarModal}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2.5 bg-blue-600/90 text-white rounded-xl shadow-md flex items-center justify-center">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">
                {esVoluntario ? "Cambiar Contraseña" : "Actualización Obligatoria"}
              </h2>
              <p className="text-xs text-blue-200 font-medium">
                Seguridad de Acceso • FRANCO OSORIO S.A.S.
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-300 mt-2 leading-relaxed">
            {esVoluntario
              ? "Establezca una nueva contraseña personal cifrada para su cuenta corporativa."
              : `Hola, ${usuario.nombreCompleto}. Por políticas de seguridad institucional, debe definir una contraseña personal para acceder al CRM.`}
          </p>
        </div>

        {/* Cuerpo del formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Mensajes de error o éxito */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start space-x-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {exito && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center space-x-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{exito}</span>
            </div>
          )}

          {/* Campo: Nueva Contraseña */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Nueva Contraseña</span>
              <span className="text-[10px] text-slate-400 font-normal">Mínimo 8 caracteres</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={mostrarNueva ? "text" : "password"}
                value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
                placeholder="Ingrese su nueva contraseña"
                required
                disabled={cargando}
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setMostrarNueva(!mostrarNueva)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                title={mostrarNueva ? "Ocultar" : "Mostrar"}
              >
                {mostrarNueva ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Campo: Confirmar Nueva Contraseña */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Confirmar Nueva Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={mostrarConfirmar ? "text" : "password"}
                value={confirmarPassword}
                onChange={(e) => setConfirmarPassword(e.target.value)}
                placeholder="Reingrese la contraseña para confirmar"
                required
                disabled={cargando}
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setMostrarConfirmar(!mostrarConfirmar)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                title={mostrarConfirmar ? "Ocultar" : "Mostrar"}
              >
                {mostrarConfirmar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Checklist de requisitos de seguridad en tiempo real */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Requisitos de la contraseña:
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="flex items-center space-x-1.5">
                <span
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                    tieneLongitudMinima ? "bg-emerald-500 text-white font-bold" : "bg-slate-200 text-slate-500"
                  }`}
                >
                  ✓
                </span>
                <span className={tieneLongitudMinima ? "text-slate-800 font-medium" : "text-slate-500"}>
                  8+ caracteres
                </span>
              </div>

              <div className="flex items-center space-x-1.5">
                <span
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                    tieneNumero ? "bg-emerald-500 text-white font-bold" : "bg-slate-200 text-slate-500"
                  }`}
                >
                  ✓
                </span>
                <span className={tieneNumero ? "text-slate-800 font-medium" : "text-slate-500"}>
                  Al menos 1 número
                </span>
              </div>

              <div className="flex items-center space-x-1.5">
                <span
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                    tieneLetra ? "bg-emerald-500 text-white font-bold" : "bg-slate-200 text-slate-500"
                  }`}
                >
                  ✓
                </span>
                <span className={tieneLetra ? "text-slate-800 font-medium" : "text-slate-500"}>
                  Al menos 1 letra
                </span>
              </div>

              <div className="flex items-center space-x-1.5">
                <span
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                    coinciden ? "bg-emerald-500 text-white font-bold" : "bg-slate-200 text-slate-500"
                  }`}
                >
                  ✓
                </span>
                <span className={coinciden ? "text-slate-800 font-medium" : "text-slate-500"}>
                  Ambas coinciden
                </span>
              </div>
            </div>
          </div>

          {/* Garantía técnica bcrypt */}
          <div className="flex items-center space-x-2 text-[11px] text-slate-500 pt-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Su contraseña será cifrada en el servidor con algoritmo <strong>bcryptjs (10 rondas de salt)</strong>.</span>
          </div>

          {/* Botones de acción */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
            {!esVoluntario && onCerrarSesion && (
              <button
                type="button"
                onClick={onCerrarSesion}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer order-2 sm:order-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar Sesión</span>
              </button>
            )}

            <button
              type="submit"
              disabled={!formularioValido || cargando}
              className="w-full sm:flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2"
            >
              {cargando ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Cifrando y Guardando...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Establecer Contraseña Segura</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default ModalCambioPassword;
