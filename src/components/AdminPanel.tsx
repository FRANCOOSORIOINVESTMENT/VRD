import React, { useState, useEffect, useMemo } from "react";
import {
  PerfilUsuario,
  RolUsuario,
  ConfiguracionSistema,
  RegistroAuditoriaAdmin,
  DashboardMetricasAdmin,
  RequisitoMaestroConfig,
  FaseConfiguracion,
  MunicipioConfig,
  Expediente
} from "../types";
import { formatearRol, formatearNombreUsuario } from "../utils/formatoRoles";
import {
  Users,
  Settings,
  BarChart3,
  Shield,
  ShieldCheck,
  HardHat,
  Building2,
  UserPlus,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Clock,
  DollarSign,
  MapPin,
  FileText,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  Calendar,
  Layers,
  Building,
  Check,
  ChevronRight,
  UserCheck,
  Download,
  Eye,
  Info,
  History,
  Lock,
  Unlock,
  Sliders,
  Plus,
  Database,
  Copy,
  ExternalLink,
  Terminal,
  Trash2,
  Loader2,
  Sparkles
} from "lucide-react";

interface AdminPanelProps {
  currentUser: PerfilUsuario;
  onSelectExpediente: (id: string) => void;
  mostrarToast: (mensaje: string, tipo?: "success" | "error" | "info") => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  onSelectExpediente,
  mostrarToast
}) => {
  // Pestañas principales del panel
  const [tabActiva, setTabActiva] = useState<"usuarios" | "configuracion" | "metricas" | "criticas">("usuarios");

  // Estado de datos
  const [cargando, setCargando] = useState<boolean>(true);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [configuracion, setConfiguracion] = useState<ConfiguracionSistema | null>(null);
  const [metricas, setMetricas] = useState<DashboardMetricasAdmin | null>(null);
  const [auditoria, setAuditoria] = useState<RegistroAuditoriaAdmin[]>([]);
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);

  // Subpestaña de configuración
  const [subTabConfig, setSubTabConfig] = useState<"fases" | "requisitos" | "municipios" | "plantillas" | "supabase">("fases");
  const [supabaseDiag, setSupabaseDiag] = useState<{
    ok: boolean;
    message: string;
    projectId?: string;
    url?: string;
    cargando?: boolean;
  }>({
    ok: true,
    message: "Conexión a Supabase REST API activa",
    projectId: "dcelksfchabhrlevlfah",
    url: "https://dcelksfchabhrlevlfah.supabase.co"
  });
  const [sqlSchema, setSqlSchema] = useState<string>("");
  const [cargandoSql, setCargandoSql] = useState<boolean>(false);
  const [copiadoSql, setCopiadoSql] = useState<boolean>(false);

  const ejecutarTestSupabase = async () => {
    setSupabaseDiag((prev) => ({ ...prev, cargando: true }));
    try {
      const res = await fetch("/api/supabase/status");
      const data = await res.json();
      setSupabaseDiag({
        ok: data.ok,
        message: data.message || (data.ok ? "Conectado" : "Error"),
        projectId: data.projectId || "dcelksfchabhrlevlfah",
        url: data.url || "https://dcelksfchabhrlevlfah.supabase.co",
        cargando: false
      });
      mostrarToast(
        data.ok
          ? "Conexión con Supabase verificada con éxito"
          : `Atención: ${data.message || "Error al conectar"}`,
        data.ok ? "exito" : "error"
      );
    } catch (err: any) {
      setSupabaseDiag({
        ok: false,
        message: err.message || "Fallo de conexión",
        cargando: false
      });
      mostrarToast("Error al verificar conexión con Supabase", "error");
    }
  };

  const [cargandoSeed, setCargandoSeed] = useState<boolean>(false);
  const [resultadoSeed, setResultadoSeed] = useState<{
    ok: boolean;
    message: string;
    rlsBlocked?: boolean;
    results?: { municipios: number; perfiles: number; errors: any[] };
  } | null>(null);

  const ejecutarSeedSupabase = async () => {
    setCargandoSeed(true);
    setResultadoSeed(null);
    try {
      const res = await fetch("/api/supabase/seed", { method: "POST" });
      const data = await res.json();
      setResultadoSeed(data);
      mostrarToast(data.message, data.ok ? "exito" : "error");
    } catch (err: any) {
      setResultadoSeed({ ok: false, message: err.message || "Error al sincronizar" });
      mostrarToast("Error al sincronizar datos con Supabase", "error");
    } finally {
      setCargandoSeed(false);
    }
  };

  const [cargandoLimpieza, setCargandoLimpieza] = useState<boolean>(false);

  const ejecutarLimpiarExpedientes = async () => {
    const seguro = window.confirm(
      "¿Está seguro de eliminar TODOS los expedientes e interesados de prueba? Esta acción vaciará completamente los registros tanto en memoria como en Supabase PostgreSQL para iniciar la operación oficial desde cero."
    );
    if (!seguro) return;

    setCargandoLimpieza(true);
    try {
      const res = await fetch("/api/admin/limpiar-expedientes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.id}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        mostrarToast("Todos los expedientes de prueba han sido eliminados con éxito.", "success");
        cargarDatos();
      } else {
        mostrarToast(data.error || "Error al limpiar expedientes", "error");
      }
    } catch (err: any) {
      mostrarToast("Error de conexión al limpiar expedientes", "error");
    } finally {
      setCargandoLimpieza(false);
    }
  };

  const [cargandoCasosEjemplo, setCargandoCasosEjemplo] = useState<boolean>(false);

  const ejecutarCrearCasosEjemplo = async () => {
    setCargandoCasosEjemplo(true);
    try {
      const res = await fetch("/api/admin/crear-casos-ejemplo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.id}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        mostrarToast(data.mensaje || "Se han generado los 7 casos de ejemplo (uno por fase) con éxito.", "exito");
        cargarDatos();
      } else {
        mostrarToast(data.error || "Error al generar casos de ejemplo", "error");
      }
    } catch (err: any) {
      mostrarToast("Error de conexión al generar casos de ejemplo", "error");
    } finally {
      setCargandoCasosEjemplo(false);
    }
  };

  // Modales
  const [modalNuevoUsuario, setModalNuevoUsuario] = useState<boolean>(false);
  const [modalEditarUsuario, setModalEditarUsuario] = useState<any | null>(null);
  const [modalAuditoriaUsuario, setModalAuditoriaUsuario] = useState<{ usuario: any; historial: any[] } | null>(null);
  const [modalReasignar, setModalReasignar] = useState<boolean>(false);
  const [modalNuevoRequisito, setModalNuevoRequisito] = useState<boolean>(false);
  const [modalEditarFase, setModalEditarFase] = useState<FaseConfiguracion | null>(null);
  const [modalNuevoMunicipio, setModalNuevoMunicipio] = useState<boolean>(false);

  // Form states
  const [formUsuario, setFormUsuario] = useState({
    nombreCompleto: "",
    username: "",
    email: "",
    rol: "asistente" as RolUsuario,
    password: ""
  });

  const [formReasignar, setFormReasignar] = useState({
    origenUsuarioId: "",
    destinoUsuarioId: "",
    motivo: "",
    expedienteIdsSeleccionados: [] as string[]
  });

  const [formRequisito, setFormRequisito] = useState({
    codigo: "",
    nombre: "",
    descripcion: "",
    fase: 1,
    esObligatorio: true,
    orientacionTecnica: ""
  });

  const [formMunicipio, setFormMunicipio] = useState({
    codigoCompleto: "",
    departamentoCodigo: "25",
    departamentoNombre: "Cundinamarca",
    municipioNombre: ""
  });

  // Filtros
  const [filtroUsuarioTexto, setFiltroUsuarioTexto] = useState<string>("");
  const [filtroUsuarioRol, setFiltroUsuarioRol] = useState<string>("todos");
  const [filtroRequisitoFase, setFiltroRequisitoFase] = useState<number>(1);
  const [filtroMunicipioTexto, setFiltroMunicipioTexto] = useState<string>("");

  // Acciones en curso
  const [guardando, setGuardando] = useState<boolean>(false);
  const [sincronizandoUsuarios, setSincronizandoUsuarios] = useState<boolean>(false);
  const [usuarioAEliminar, setUsuarioAEliminar] = useState<any | null>(null);
  const [eliminandoUsuario, setEliminandoUsuario] = useState<boolean>(false);
  const [errorUsuarios, setErrorUsuarios] = useState<string | null>(null);
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState<string>("");

  // Helper de peticiones autenticadas para Administración
  const authFetch = (url: string, options: RequestInit = {}) => {
    const token = currentUser?.id || localStorage.getItem("crm_user_token") || "";
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
      headers.set("x-user-id", token);
    }
    const API_URL = import.meta.env.VITE_API_URL || "";
    return fetch(`${API_URL}${url}`, {
      ...options,
      credentials: "include",
      headers
    });
  };

  // Carga directa y sincronización general desde Supabase
  const sincronizarConSupabase = async (mostrarMensaje = false) => {
    setSincronizandoUsuarios(true);
    setErrorUsuarios(null);
    try {
      await authFetch("/api/sync", { method: "POST" });
      await cargarDatos();
      setUltimaSincronizacion(new Date().toLocaleTimeString("es-CO"));
      if (mostrarMensaje) {
        mostrarToast("Base de datos, expedientes y usuarios sincronizados directamente desde Supabase.", "exito");
      }
    } catch (err: any) {
      console.error("Error sincronizando con Supabase:", err);
      const msg = err?.message || "Error de conexión al sincronizar con Supabase.";
      setErrorUsuarios(msg);
      mostrarToast(msg, "error");
    } finally {
      setSincronizandoUsuarios(false);
    }
  };

  // Carga directa de usuarios desde Supabase
  const cargarUsuariosDirecto = async (mostrarMensaje = false) => {
    setSincronizandoUsuarios(true);
    setErrorUsuarios(null);
    try {
      const res = await authFetch(`/api/admin/usuarios?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setUsuarios(data);
          setErrorUsuarios(null);
          setUltimaSincronizacion(new Date().toLocaleTimeString("es-CO"));
          if (mostrarMensaje) {
            mostrarToast("Usuarios y roles sincronizados directamente desde Supabase.");
          }
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.error || "No se pudieron obtener los usuarios de Supabase.";
        setErrorUsuarios(msg);
        mostrarToast(msg, "error");
      }
    } catch (err: any) {
      console.error("Error sincronizando usuarios:", err);
      const msg = err?.message || "Error de conexión al sincronizar con Supabase.";
      setErrorUsuarios(msg);
      mostrarToast(msg, "error");
    } finally {
      setSincronizandoUsuarios(false);
    }
  };

  // Carga inicial resiliente (evita que un fallo en métricas bloquee los usuarios)
  const cargarDatos = async () => {
    setCargando(true);
    try {
      await Promise.allSettled([
        cargarUsuariosDirecto(false),
        authFetch(`/api/admin/configuracion?t=${Date.now()}`)
          .then((res) => res.json())
          .then((data) => {
            if (data?.configuracion) setConfiguracion(data.configuracion);
            if (data?.auditoria) setAuditoria(data.auditoria || []);
          })
          .catch((err) => console.error("Error cargando configuración:", err)),
        authFetch(`/api/admin/reportes/dashboard?t=${Date.now()}`)
          .then((res) => res.json())
          .then((data) => {
            if (data) setMetricas(data);
          })
          .catch((err) => console.error("Error cargando dashboard:", err)),
        authFetch(`/api/expedientes?t=${Date.now()}`)
          .then((res) => res.json())
          .then((data) => {
            if (Array.isArray(data)) setExpedientes(data);
          })
          .catch((err) => console.error("Error cargando expedientes:", err))
      ]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
    const handleSync = () => {
      cargarDatos();
    };
    window.addEventListener("crm:datos-sincronizados", handleSync);
    return () => {
      window.removeEventListener("crm:datos-sincronizados", handleSync);
    };
  }, []);

  // Handlers Bloque 1: Usuarios
  const handleCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsuario.nombreCompleto.trim() || !formUsuario.username.trim() || !formUsuario.email.trim()) {
      mostrarToast("Todos los campos con obligatorios.", "error");
      return;
    }
    setGuardando(true);
    try {
      const res = await authFetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formUsuario)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear el usuario.");

      mostrarToast(`Usuario ${data.nombreCompleto} creado exitosamente.`);
      setModalNuevoUsuario(false);
      setFormUsuario({
        nombreCompleto: "",
        username: "",
        email: "",
        rol: "asistente",
        password: ""
      });
      cargarDatos();
    } catch (err: any) {
      mostrarToast(err.message, "error");
    } finally {
      setGuardando(false);
    }
  };

  const handleActualizarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEditarUsuario) return;
    setGuardando(true);
    try {
      const res = await authFetch(`/api/admin/usuarios/${modalEditarUsuario.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombreCompleto: modalEditarUsuario.nombreCompleto,
          email: modalEditarUsuario.email,
          rol: modalEditarUsuario.rol,
          activo: modalEditarUsuario.activo
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo actualizar el usuario.");

      mostrarToast(`Usuario ${data.nombreCompleto} actualizado.`);
      setModalEditarUsuario(null);
      cargarDatos();
    } catch (err: any) {
      mostrarToast(err.message, "error");
    } finally {
      setGuardando(false);
    }
  };

  const handleToggleActivoUsuario = async (usr: any) => {
    if (usr.id === currentUser.id) {
      mostrarToast("No puede desactivar su propio usuario de Administrador actual.", "error");
      return;
    }
    try {
      const res = await authFetch(`/api/admin/usuarios/${usr.id}/toggle-activo`, {
        method: "PATCH"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cambiar estado.");

      mostrarToast(`Usuario ${data.nombreCompleto} ${data.activo ? "activado" : "desactivado"}.`);
      cargarDatos();
    } catch (err: any) {
      mostrarToast(err.message, "error");
    }
  };

  const handleSolicitarEliminarUsuario = (usr: any) => {
    if (usr.id === currentUser.id) {
      mostrarToast("Seguridad: No puede eliminar su propia cuenta de administrador en sesión.", "error");
      return;
    }
    setUsuarioAEliminar(usr);
  };

  const handleConfirmarEliminarUsuario = async () => {
    if (!usuarioAEliminar) return;
    setEliminandoUsuario(true);
    try {
      const res = await authFetch(`/api/admin/usuarios/${usuarioAEliminar.id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo eliminar el usuario.");

      mostrarToast(data.message || `Usuario ${usuarioAEliminar.nombreCompleto} eliminado correctamente.`);
      setUsuarioAEliminar(null);
      cargarDatos();
    } catch (err: any) {
      mostrarToast(err.message, "error");
    } finally {
      setEliminandoUsuario(false);
    }
  };

  const handleVerAuditoriaUsuario = async (usr: any) => {
    try {
      const res = await authFetch(`/api/admin/usuarios/${usr.id}/auditoria`);
      if (res.ok) {
        const data = await res.json();
        setModalAuditoriaUsuario(data);
      }
    } catch (err) {
      mostrarToast("Error al obtener la bitácora del usuario.", "error");
    }
  };

  const handleEjecutarReasignacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formReasignar.destinoUsuarioId || !formReasignar.motivo.trim()) {
      mostrarToast("Seleccione el usuario de destino e ingrese el motivo.", "error");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/admin/reasignar-cartera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origenUsuarioId: formReasignar.origenUsuarioId || undefined,
          destinoUsuarioId: formReasignar.destinoUsuarioId,
          expedienteIds: formReasignar.expedienteIdsSeleccionados.length > 0 ? formReasignar.expedienteIdsSeleccionados : undefined,
          motivo: formReasignar.motivo
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al reasignar cartera.");

      mostrarToast(data.mensaje);
      setModalReasignar(false);
      setFormReasignar({
        origenUsuarioId: "",
        destinoUsuarioId: "",
        motivo: "",
        expedienteIdsSeleccionados: []
      });
      cargarDatos();
    } catch (err: any) {
      mostrarToast(err.message, "error");
    } finally {
      setGuardando(false);
    }
  };

  // Handlers Bloque 2: Configuración
  const handleGuardarFase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEditarFase) return;
    setGuardando(true);
    try {
      const res = await fetch(`/api/admin/configuracion/fases/${modalEditarFase.num}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: modalEditarFase.label,
          desc: modalEditarFase.desc,
          rolSugerido: modalEditarFase.rolSugerido
        })
      });
      if (!res.ok) throw new Error("Error al actualizar la fase.");
      mostrarToast(`Fase ${modalEditarFase.num} actualizada exitosamente.`);
      setModalEditarFase(null);
      cargarDatos();
    } catch (err: any) {
      mostrarToast(err.message, "error");
    } finally {
      setGuardando(false);
    }
  };

  const handleCrearRequisito = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRequisito.codigo.trim() || !formRequisito.nombre.trim()) {
      mostrarToast("El código y el nombre del documento son obligatorios.", "error");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/admin/configuracion/requisitos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formRequisito)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear requisito.");

      mostrarToast(`Documento ${data.codigo} agregado al catálogo maestro.`);
      setModalNuevoRequisito(false);
      setFormRequisito({
        codigo: "",
        nombre: "",
        descripcion: "",
        fase: filtroRequisitoFase,
        esObligatorio: true,
        orientacionTecnica: ""
      });
      cargarDatos();
    } catch (err: any) {
      mostrarToast(err.message, "error");
    } finally {
      setGuardando(false);
    }
  };

  const handleCrearMunicipio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMunicipio.codigoCompleto.trim() || !formMunicipio.municipioNombre.trim()) {
      mostrarToast("Código y nombre de municipio son requeridos.", "error");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/admin/configuracion/municipios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formMunicipio)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar municipio.");

      mostrarToast(`Municipio ${data.municipioNombre} habilitado en el catálogo.`);
      setModalNuevoMunicipio(false);
      setFormMunicipio({
        codigoCompleto: "",
        departamentoCodigo: "25",
        departamentoNombre: "Cundinamarca",
        municipioNombre: ""
      });
      cargarDatos();
    } catch (err: any) {
      mostrarToast(err.message, "error");
    } finally {
      setGuardando(false);
    }
  };

  // Handlers Bloque 4: Decisiones Críticas
  const handleAprobarRechazoDirecto = async (expedienteId: string) => {
    if (!confirm("¿Está seguro de aprobar el Rechazo Definitivo de este hogar? Esta acción pasará el expediente a Salida Definitiva.")) {
      return;
    }
    try {
      const res = await fetch(`/api/expedientes/${expedienteId}/aprobar-rechazo`, {
        method: "POST"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al aprobar rechazo.");

      mostrarToast(data.mensaje || "Rechazo definitivo aprobado con autoridad de Administrador.");
      cargarDatos();
    } catch (err: any) {
      mostrarToast(err.message, "error");
    }
  };

  const handleDesestimarRechazoDirecto = async (expedienteId: string) => {
    const motivo = prompt("Ingrese el motivo técnico por el cual se desestima la solicitud de rechazo:");
    if (!motivo || !motivo.trim()) return;

    try {
      const res = await fetch(`/api/expedientes/${expedienteId}/desestimar-rechazo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivoDesestimacion: motivo.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al desestimar rechazo.");

      mostrarToast("Solicitud de rechazo desestimada. El expediente continúa normalmente.");
      cargarDatos();
    } catch (err: any) {
      mostrarToast(err.message, "error");
    }
  };

  // Datos filtrados
  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter((u) => {
      const coincideTexto =
        u.nombreCompleto.toLowerCase().includes(filtroUsuarioTexto.toLowerCase()) ||
        u.username.toLowerCase().includes(filtroUsuarioTexto.toLowerCase()) ||
        u.email.toLowerCase().includes(filtroUsuarioTexto.toLowerCase());
      const coincideRol = filtroUsuarioRol === "todos" || u.rol === filtroUsuarioRol;
      return coincideTexto && coincideRol;
    });
  }, [usuarios, filtroUsuarioTexto, filtroUsuarioRol]);

  const requisitosFiltrados = useMemo(() => {
    if (!configuracion) return [];
    return configuracion.requisitosMaestros
      .filter((r) => r.fase === filtroRequisitoFase && r.activo)
      .sort((a, b) => a.orden - b.orden);
  }, [configuracion, filtroRequisitoFase]);

  const municipiosFiltrados = useMemo(() => {
    if (!configuracion) return [];
    return configuracion.municipios.filter((m) =>
      m.municipioNombre.toLowerCase().includes(filtroMunicipioTexto.toLowerCase()) ||
      m.codigoCompleto.includes(filtroMunicipioTexto)
    );
  }, [configuracion, filtroMunicipioTexto]);

  // Solicitudes de rechazo pendientes para Bloque 4
  const solicitudesRechazoPendientes = useMemo(() => {
    return expedientes.filter(
      (e) => e.solicitudRechazo && e.solicitudRechazo.estado === "pendiente"
    );
  }, [expedientes]);

  const expedientesSalidaDefinitiva = useMemo(() => {
    return expedientes.filter((e) => e.estadoGeneral === "salida_definitiva");
  }, [expedientes]);

  const expedientesSubsidioDesembolsado = useMemo(() => {
    return expedientes.filter((e) => e.estadoGeneral === "subsidio_desembolsado");
  }, [expedientes]);

  const formatCOP = (val: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-6 pb-12">
      {/* Encabezado del Módulo Administrador */}
      <div className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#3F7D58] text-white flex items-center justify-center shadow-xs">
            <ShieldCheck className="w-6 h-6 text-[#EBF3EE]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Panel de Control de Administrador
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#EBF3EE] text-[#285943] border border-[#3F7D58]/30">
                Control Total
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Gestión centralizada de usuarios, configuración maestra del proceso, visibilidad global de cartera y autoridad en decisiones críticas.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-start md:self-auto">
          <button
            type="button"
            onClick={cargarDatos}
            disabled={cargando}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? "animate-spin" : ""}`} />
            <span>Actualizar Datos</span>
          </button>
        </div>
      </div>

      {/* Navegación por Bloques de Administrador */}
      <div className="border-b border-slate-200 flex space-x-2 overflow-x-auto">
        <button
          type="button"
          id="tab-admin-usuarios"
          onClick={() => setTabActiva("usuarios")}
          className={`pb-3 px-4 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            tabActiva === "usuarios"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Bloque 1: Usuarios y Roles</span>
          <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.2 rounded-full font-bold">
            {usuarios.length}
          </span>
        </button>

        <button
          type="button"
          id="tab-admin-configuracion"
          onClick={() => setTabActiva("configuracion")}
          className={`pb-3 px-4 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            tabActiva === "configuracion"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Bloque 2: Configuración del Sistema</span>
        </button>

        <button
          type="button"
          id="tab-admin-metricas"
          onClick={() => setTabActiva("metricas")}
          className={`pb-3 px-4 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            tabActiva === "metricas"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Bloque 3: Métricas y Reportes</span>
          {metricas && (
            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.2 rounded-full font-bold">
              {metricas.totalExpedientes} casos
            </span>
          )}
        </button>

        <button
          type="button"
          id="tab-admin-criticas"
          onClick={() => setTabActiva("criticas")}
          className={`pb-3 px-4 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            tabActiva === "criticas"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Bloque 4: Decisiones Críticas y Auditoría</span>
          {solicitudesRechazoPendientes.length > 0 && (
            <span className="bg-rose-500 text-white text-[10px] px-2 py-0.2 rounded-full font-bold">
              {solicitudesRechazoPendientes.length} por resolver
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* BLOQUE 1: GESTIÓN DE USUARIOS Y ROLES */}
      {/* ========================================================================= */}
      {tabActiva === "usuarios" && (
        <div className="space-y-5">
          {/* ========================================================= */}
          {/* ESPACIO DESTACADO: ROLES DEL SISTEMA Y ROL SUPERVISOR */}
          {/* ========================================================= */}
          <div className="bg-gradient-to-r from-[#1E3A5F] via-slate-900 to-[#285943] p-5 rounded-2xl text-white shadow-md border border-slate-700/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold tracking-tight text-white">
                    Estructura Organizacional y Roles del Sistema
                  </h3>
                  <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                    Supabase perfiles_usuario
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Matriz oficial de los 6 roles reconocidos por el CRM VRD. Selecciona cualquier rol para filtrar la lista.
                </p>
              </div>

              {/* Botón de Sincronización Directa con Supabase */}
              <button
                type="button"
                id="btn-sync-usuarios-supabase"
                onClick={() => sincronizarConSupabase(true)}
                disabled={sincronizandoUsuarios}
                className="px-3.5 py-1.5 bg-[#3F7D58]/80 hover:bg-[#3F7D58] active:bg-[#285943] text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all border border-emerald-400/40 shadow-xs cursor-pointer self-start sm:self-auto shrink-0"
                title="Forzar actualización directa en tiempo real desde Supabase"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-300 ${sincronizandoUsuarios ? "animate-spin" : ""}`} />
                <span>{sincronizandoUsuarios ? "Sincronizando..." : "Sincronizar Supabase"}</span>
              </button>
            </div>

            {/* Grid de Roles: Destacando SUPERVISOR y los 5 roles oficiales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              {/* 1. TARJETA DESTACADA: SUPERVISOR */}
              <div
                onClick={() => setFiltroUsuarioRol(filtroUsuarioRol === "supervisor" ? "todos" : "supervisor")}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  filtroUsuarioRol === "supervisor"
                    ? "bg-blue-600/40 border-blue-400 ring-2 ring-blue-400 shadow-md"
                    : "bg-blue-950/40 border-blue-500/40 hover:bg-blue-900/50 hover:border-blue-400"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded">
                      ROL OFICIAL
                    </span>
                    <ShieldCheck className="w-4 h-4 text-blue-300" />
                  </div>
                  <h4 className="text-sm font-bold text-white flex items-center space-x-1">
                    <span>Supervisor</span>
                  </h4>
                  <p className="text-[10px] text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                    Evaluación documental, aprobación de fases 1/2 y resolución de retiros.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-blue-500/20 flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">Asignados:</span>
                  <span className="text-base font-black text-blue-300">
                    {usuarios.filter((u) => u.rol === "supervisor" && u.activo).length}
                  </span>
                </div>
              </div>

              {/* 2. ADMINISTRADOR */}
              <div
                onClick={() => setFiltroUsuarioRol(filtroUsuarioRol === "administrador" ? "todos" : "administrador")}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  filtroUsuarioRol === "administrador"
                    ? "bg-purple-600/40 border-purple-400 ring-2 ring-purple-400 shadow-md"
                    : "bg-purple-950/20 border-purple-500/30 hover:bg-purple-900/40"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded">
                      ADMIN
                    </span>
                    <Shield className="w-4 h-4 text-purple-300" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Administrador</h4>
                  <p className="text-[10px] text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                    Control total del sistema, configuración, reasignación y auditoría.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-purple-500/20 flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">Asignados:</span>
                  <span className="text-base font-black text-purple-300">
                    {usuarios.filter((u) => u.rol === "administrador" && u.activo).length}
                  </span>
                </div>
              </div>

              {/* 3. GESTOR RURAL (COMERCIAL) */}
              <div
                onClick={() => setFiltroUsuarioRol(filtroUsuarioRol === "comercial" ? "todos" : "comercial")}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  filtroUsuarioRol === "comercial"
                    ? "bg-emerald-600/40 border-emerald-400 ring-2 ring-emerald-400 shadow-md"
                    : "bg-emerald-950/20 border-emerald-500/30 hover:bg-emerald-900/40"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded">
                      CAMPO
                    </span>
                    <Users className="w-4 h-4 text-emerald-300" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Gestor Rural</h4>
                  <p className="text-[10px] text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                    Captación de prospectos y radicación de requisitos en Fase 1.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-emerald-500/20 flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">Asignados:</span>
                  <span className="text-base font-black text-emerald-300">
                    {usuarios.filter((u) => u.rol === "comercial" && u.activo).length}
                  </span>
                </div>
              </div>

              {/* 4. GESTOR DOCUMENTAL (ASISTENTE) */}
              <div
                onClick={() => setFiltroUsuarioRol(filtroUsuarioRol === "asistente" ? "todos" : "asistente")}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  filtroUsuarioRol === "asistente"
                    ? "bg-slate-700/60 border-slate-300 ring-2 ring-slate-300 shadow-md"
                    : "bg-slate-800/40 border-slate-700 hover:bg-slate-800"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300 bg-slate-700/50 px-2 py-0.5 rounded">
                      DOCUMENTAL
                    </span>
                    <FileText className="w-4 h-4 text-slate-300" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Gestor Doc.</h4>
                  <p className="text-[10px] text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                    Custodia documental, digitalización y subsanación en Fase 2.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-700/50 flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">Asignados:</span>
                  <span className="text-base font-black text-slate-300">
                    {usuarios.filter((u) => u.rol === "asistente" && u.activo).length}
                  </span>
                </div>
              </div>

              {/* 5. INGENIERÍA */}
              <div
                onClick={() => setFiltroUsuarioRol(filtroUsuarioRol === "ingenieria" ? "todos" : "ingenieria")}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  filtroUsuarioRol === "ingenieria"
                    ? "bg-amber-600/40 border-amber-400 ring-2 ring-amber-400 shadow-md"
                    : "bg-amber-950/20 border-amber-500/30 hover:bg-amber-900/40"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded">
                      TÉCNICO
                    </span>
                    <HardHat className="w-4 h-4 text-amber-300" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Ingeniería</h4>
                  <p className="text-[10px] text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                    Gestión técnica, licenciamiento, radicación y supervisión de obra.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-amber-500/20 flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">Asignados:</span>
                  <span className="text-base font-black text-amber-300">
                    {usuarios.filter((u) => u.rol === "ingenieria" && u.activo).length}
                  </span>
                </div>
              </div>

              {/* 6. PLANEACIÓN Y AUDITORÍA */}
              <div
                onClick={() => setFiltroUsuarioRol(filtroUsuarioRol === "planeacion" ? "todos" : "planeacion")}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  filtroUsuarioRol === "planeacion"
                    ? "bg-teal-600/40 border-teal-400 ring-2 ring-teal-400 shadow-md"
                    : "bg-teal-950/20 border-teal-500/30 hover:bg-teal-900/40"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-300 bg-teal-500/20 px-2 py-0.5 rounded">
                      AUDITORÍA
                    </span>
                    <Building2 className="w-4 h-4 text-teal-300" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Planeación</h4>
                  <p className="text-[10px] text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                    Auditoría visual universal, reportería y consulta en todas las fases.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-teal-500/20 flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">Asignados:</span>
                  <span className="text-base font-black text-teal-300">
                    {usuarios.filter((u) => u.rol === "planeacion" && u.activo).length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Banner de error o advertencia si falló la sincronización con Supabase */}
          {errorUsuarios && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center space-x-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <div className="font-bold">No se pudieron sincronizar los usuarios desde Supabase</div>
                  <div className="text-[11px] text-rose-700 mt-0.5">{errorUsuarios}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => cargarUsuariosDirecto(true)}
                disabled={sincronizandoUsuarios}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer flex items-center space-x-1.5 transition-colors self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${sincronizandoUsuarios ? "animate-spin" : ""}`} />
                <span>{sincronizandoUsuarios ? "Reintentando..." : "Reintentar Conexión"}</span>
              </button>
            </div>
          )}

          {/* Barra de herramientas y filtros */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, usuario o email..."
                  value={filtroUsuarioTexto}
                  onChange={(e) => setFiltroUsuarioTexto(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <select
                value={filtroUsuarioRol}
                onChange={(e) => setFiltroUsuarioRol(e.target.value)}
                className="w-full sm:w-52 py-1.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-700 font-medium"
              >
                <option value="todos">Todos los roles oficiales</option>
                <option value="supervisor">Supervisor</option>
                <option value="administrador">Administrador</option>
                <option value="comercial">Gestor Rural (Comercial)</option>
                <option value="asistente">Gestor Documental (Asistente)</option>
                <option value="ingenieria">Ingeniería</option>
                <option value="planeacion">Planeación y Auditoría</option>
              </select>

              {filtroUsuarioRol !== "todos" && (
                <button
                  type="button"
                  onClick={() => setFiltroUsuarioRol("todos")}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer underline"
                >
                  Limpiar filtro
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
              <button
                type="button"
                id="btn-sync-usuarios-toolbar"
                onClick={() => cargarUsuariosDirecto(true)}
                disabled={sincronizandoUsuarios}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                title="Actualizar listado de usuarios desde Supabase"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${sincronizandoUsuarios ? "animate-spin" : ""}`} />
                <span>Refrescar</span>
              </button>

              <button
                type="button"
                id="btn-abrir-reasignar"
                onClick={() => setModalReasignar(true)}
                className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Reasignar Cartera</span>
              </button>

              <button
                type="button"
                id="btn-abrir-nuevo-usuario"
                onClick={() => setModalNuevoUsuario(true)}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Nuevo Usuario</span>
              </button>
            </div>
          </div>

          {/* Tabla de Usuarios */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Usuario / Nombre</th>
                    <th className="py-3 px-4">Correo Electrónico</th>
                    <th className="py-3 px-4">Rol en el Sistema</th>
                    <th className="py-3 px-4 text-center">Expedientes Asignados</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {usuariosFiltrados.map((usr) => (
                    <tr key={usr.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{formatearNombreUsuario(usr.nombreCompleto)}</div>
                        <div className="text-[11px] text-slate-500 font-mono">@{usr.username}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{usr.email}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            usr.rol === "administrador"
                              ? "bg-purple-100 text-purple-800 border border-purple-200"
                              : usr.rol === "supervisor"
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : usr.rol === "ingenieria"
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : usr.rol === "comercial"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : usr.rol === "planeacion"
                              ? "bg-teal-100 text-teal-800 border border-teal-200"
                              : "bg-slate-100 text-slate-800 border border-slate-200"
                          }`}
                        >
                          {formatearRol(usr.rol)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-slate-900">{usr.expedientesAsignadosCount || 0}</span>
                        {usr.expedientesActivosCount > 0 && (
                          <span className="text-[10px] text-slate-500 ml-1">
                            ({usr.expedientesActivosCount} activos)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActivoUsuario(usr)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                            usr.activo
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                              : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                          }`}
                        >
                          {usr.activo ? "Activo" : "Inactivo"}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            type="button"
                            title="Ver bitácora y auditoría de acciones"
                            onClick={() => handleVerAuditoriaUsuario(usr)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Editar usuario"
                            onClick={() => setModalEditarUsuario(usr)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title={usr.id === currentUser.id ? "No puede eliminar su propio usuario en sesión" : "Eliminar usuario del sistema"}
                            disabled={usr.id === currentUser.id}
                            onClick={() => handleSolicitarEliminarUsuario(usr)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              usr.id === currentUser.id
                                ? "text-slate-300 cursor-not-allowed opacity-40"
                                : "text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {usuariosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                        No se encontraron usuarios con los criterios de búsqueda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BLOQUE 2: CONFIGURACIÓN DEL SISTEMA (PARÁMETROS MAESTROS) */}
      {/* ========================================================================= */}
      {tabActiva === "configuracion" && configuracion && (
        <div className="space-y-5">
          {/* Selector de sub-sección de configuración */}
          <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setSubTabConfig("fases")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                subTabConfig === "fases" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Fases Operativas (1 a 7)
            </button>
            <button
              type="button"
              onClick={() => setSubTabConfig("requisitos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                subTabConfig === "requisitos" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Catálogo Maestro de Requisitos
            </button>
            <button
              type="button"
              onClick={() => setSubTabConfig("municipios")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                subTabConfig === "municipios" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Municipios y Cobertura
            </button>
            <button
              type="button"
              onClick={() => setSubTabConfig("plantillas")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                subTabConfig === "plantillas" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Parámetros de Fases Especiales
            </button>
            <button
              type="button"
              id="tab-config-supabase"
              onClick={() => {
                setSubTabConfig("supabase");
                if (!sqlSchema) {
                  setCargandoSql(true);
                  fetch("/api/supabase/schema-sql")
                    .then((r) => r.text())
                    .then((txt) => {
                      setSqlSchema(txt);
                      setCargandoSql(false);
                    })
                    .catch(() => setCargandoSql(false));
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center space-x-1.5 ${
                subTabConfig === "supabase"
                  ? "bg-emerald-600 text-white shadow-xs font-bold"
                  : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200"
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Base de Datos Supabase</span>
            </button>
          </div>

          {/* Sub-tab 1: Fases Operativas */}
          {subTabConfig === "fases" && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Estructura de las 7 Fases Operativas</h3>
                  <p className="text-xs text-slate-500">
                    Nombres oficiales, alcance y roles recomendados. Cualquier cambio de nombre se refleja en la vista del proceso de inmediato.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {configuracion.fases.map((fase) => (
                  <div
                    key={fase.num}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-2 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                            {fase.num}
                          </span>
                          <span className="font-bold text-slate-900 text-xs">{fase.label}</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 uppercase">
                          Rol: {fase.rolSugerido}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-2 leading-relaxed">{fase.desc}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setModalEditarFase(fase)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Editar Parámetros</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub-tab 2: Catálogo Maestro de Requisitos */}
          {subTabConfig === "requisitos" && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-slate-700">Filtrar por Fase:</span>
                  <select
                    value={filtroRequisitoFase}
                    onChange={(e) => setFiltroRequisitoFase(parseInt(e.target.value, 10))}
                    className="py-1.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden text-slate-800 font-semibold"
                  >
                    {configuracion.fases.map((f) => (
                      <option key={f.num} value={f.num}>
                        Fase {f.num}: {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="text-[11px] text-slate-500 max-w-sm hidden lg:block leading-tight">
                    <span className="font-semibold text-slate-700">Regla de no-retroactividad:</span> Requisitos nuevos solo se aplican a expedientes activos en o antes de esta fase.
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setFormRequisito({
                        codigo: `F${filtroRequisitoFase}-0${requisitosFiltrados.length + 1}`,
                        nombre: "",
                        descripcion: "",
                        fase: filtroRequisitoFase,
                        esObligatorio: true,
                        orientacionTecnica: ""
                      });
                      setModalNuevoRequisito(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Documento Requerido</span>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-4">Código</th>
                      <th className="py-3 px-4">Nombre del Documento / Requisito</th>
                      <th className="py-3 px-4">Descripción y Propósito</th>
                      <th className="py-3 px-4 text-center">Obligatoriedad</th>
                      <th className="py-3 px-4 text-center">Orden</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {requisitosFiltrados.map((reqM) => (
                      <tr key={reqM.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-blue-700">{reqM.codigo}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{reqM.nombre}</td>
                        <td className="py-3 px-4 text-slate-600 max-w-md">{reqM.descripcion}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              reqM.esObligatorio
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            {reqM.esObligatorio ? "Obligatorio" : "Opcional"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-500">{reqM.orden}</td>
                      </tr>
                    ))}
                    {requisitosFiltrados.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                          No hay requisitos registrados para esta fase.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-tab 3: Municipios y Cobertura */}
          {subTabConfig === "municipios" && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar municipio por nombre o código DANE..."
                    value={filtroMunicipioTexto}
                    onChange={(e) => setFiltroMunicipioTexto(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-500 font-medium">
                    {municipiosFiltrados.length} de {configuracion.municipios.length} municipios
                  </span>
                  <button
                    type="button"
                    onClick={() => setModalNuevoMunicipio(true)}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Municipio</span>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-xs max-h-96 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4">Código DANE</th>
                      <th className="py-2.5 px-4">Municipio</th>
                      <th className="py-2.5 px-4">Departamento</th>
                      <th className="py-2.5 px-4 text-center">Estado Operativo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {municipiosFiltrados.slice(0, 50).map((mun) => (
                      <tr key={mun.codigoCompleto} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-600">{mun.codigoCompleto}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{mun.municipioNombre}</td>
                        <td className="py-2.5 px-4 text-slate-600">{mun.departamentoNombre}</td>
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              mun.activo
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {mun.activo ? "Habilitado" : "Inactivo"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-tab 4: Plantillas de Fases Especiales */}
          {subTabConfig === "plantillas" && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Directrices y Parámetros de Fases Especiales</h3>
                <p className="text-xs text-slate-500">
                  Textos explicativos y directrices técnicas mostradas a los equipos operativos en Fases 4, 5, 6 y 7.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <span className="font-bold text-xs text-slate-900 block">Fase 4: Documentos Técnicos e Ingeniería</span>
                  <p className="text-xs text-slate-600">{configuracion.plantillasFases?.fase4?.descripcion}</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <span className="font-bold text-xs text-slate-900 block">Fase 5: Licencia de Construcción</span>
                  <p className="text-xs text-slate-600">{configuracion.plantillasFases?.fase5?.descripcion}</p>
                  <p className="text-[11px] text-blue-700 font-medium">{configuracion.plantillasFases?.fase5?.orientacionCuraduria}</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <span className="font-bold text-xs text-slate-900 block">Fase 6: Postulación al Subsidio</span>
                  <p className="text-xs text-slate-600">{configuracion.plantillasFases?.fase6?.descripcion}</p>
                  <p className="text-[11px] text-emerald-700 font-medium">{configuracion.plantillasFases?.fase6?.instruccionesCompensar}</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <span className="font-bold text-xs text-slate-900 block">Fase 7: En Construcción y Cobro</span>
                  <p className="text-xs text-slate-600">{configuracion.plantillasFases?.fase7?.descripcion}</p>
                  <p className="text-[11px] text-amber-700 font-medium">{configuracion.plantillasFases?.fase7?.instruccionesObra}</p>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab 5: Conexión y Gestión de Base de Datos Supabase */}
          {subTabConfig === "supabase" && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
              {/* Encabezado y Estado de Conexión */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                        <span>Supabase Database & API Gateway</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1"></span>
                          Conectado
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        Integración activa con PostgreSQL vía Supabase REST API y autenticación mediante clave publicable.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={ejecutarTestSupabase}
                    disabled={supabaseDiag.cargando}
                    className="px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${supabaseDiag.cargando ? "animate-spin" : ""}`} />
                    <span>{supabaseDiag.cargando ? "Probando..." : "Verificar Conexión"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={ejecutarSeedSupabase}
                    disabled={cargandoSeed}
                    className="px-3.5 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    title="Inserta los municipios de Colombia y los usuarios predeterminados en la base de datos Supabase"
                  >
                    <Download className={`w-3.5 h-3.5 ${cargandoSeed ? "animate-spin" : ""}`} />
                    <span>{cargandoSeed ? "Sincronizando..." : "Poblar Municipios y Usuarios"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={ejecutarCrearCasosEjemplo}
                    disabled={cargandoCasosEjemplo}
                    className="px-3.5 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    title="Crea automáticamente 7 expedientes de ejemplo realistas, uno para cada fase operativa (Fase 1 a Fase 7)"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${cargandoCasosEjemplo ? "animate-spin" : ""}`} />
                    <span>{cargandoCasosEjemplo ? "Generando..." : "Generar Casos de Ejemplo (Fases 1 a 7)"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={ejecutarLimpiarExpedientes}
                    disabled={cargandoLimpieza}
                    className="px-3.5 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    title="Elimina todos los expedientes e interesados de prueba tanto en PostgreSQL como en memoria para operar desde cero"
                  >
                    <Trash2 className={`w-3.5 h-3.5 ${cargandoLimpieza ? "animate-spin" : ""}`} />
                    <span>{cargandoLimpieza ? "Borrando..." : "Borrar Expedientes de Prueba"}</span>
                  </button>

                  <a
                    href="https://supabase.com/dashboard/project/dcelksfchabhrlevlfah"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center space-x-1.5"
                  >
                    <span>Dashboard Supabase</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Resultado de Sincronización / Alerta RLS */}
              {resultadoSeed && (
                <div className={`p-4 rounded-xl border flex flex-col space-y-2 ${
                  resultadoSeed.ok
                    ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                    : resultadoSeed.rlsBlocked
                    ? "bg-amber-50 border-amber-300 text-amber-950"
                    : "bg-rose-50 border-rose-300 text-rose-950"
                }`}>
                  <div className="flex items-center space-x-2">
                    {resultadoSeed.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span className="font-bold text-xs">{resultadoSeed.message}</span>
                  </div>

                  {resultadoSeed.rlsBlocked && (
                    <div className="mt-2 pt-2 border-t border-amber-200/80 text-xs space-y-2">
                      <p className="text-amber-900 leading-relaxed">
                        Supabase activó Row Level Security (RLS) exclusivamente para <code>authenticated</code>. Dado que las peticiones web usan la clave publicable <code>anon</code>, para habilitar escrituras directas ejecute este código en el <strong>SQL Editor de Supabase</strong>:
                      </p>
                      <div className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-[11px] flex items-center justify-between">
                        <code>CREATE POLICY "Acceso anon" ON public.catalogo_municipios FOR ALL TO anon USING (true) WITH CHECK (true);</code>
                        <button
                          type="button"
                          onClick={() => {
                            const sql = `DO $$ DECLARE tabla record; BEGIN FOR tabla IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP BEGIN EXECUTE format('CREATE POLICY "Acceso anon" ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true);', tabla.tablename); EXCEPTION WHEN duplicate_object THEN NULL; END; END LOOP; END $$;`;
                            navigator.clipboard.writeText(sql);
                            mostrarToast("Código SQL copiado", "exito");
                          }}
                          className="ml-3 px-2 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-[10px] shrink-0 cursor-pointer"
                        >
                          Copiar SQL RLS Anon
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tarjetas de Parámetros Técnicos */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Project ID</span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-900 selection:bg-emerald-200">
                      dcelksfchabhrlevlfah
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText("dcelksfchabhrlevlfah");
                        mostrarToast("Project ID copiado", "exito");
                      }}
                      className="p-1 hover:bg-slate-200 text-slate-500 rounded cursor-pointer"
                      title="Copiar Project ID"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-semibold block">Identificador Oficial Activo</span>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Project REST URL</span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-semibold text-slate-800 truncate" title="https://dcelksfchabhrlevlfah.supabase.co/rest/v1/">
                      https://dcelksfchabhrlevlfah.supabase.co/rest/v1/
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText("https://dcelksfchabhrlevlfah.supabase.co/rest/v1/");
                        mostrarToast("URL REST copiada", "exito");
                      }}
                      className="p-1 hover:bg-slate-200 text-slate-500 rounded cursor-pointer shrink-0 ml-1"
                      title="Copiar URL REST"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 block">Gateway PostgREST v1</span>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Public API Key (Anon)</span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-semibold text-slate-800 truncate" title="sb_publishable_B8tc_3lQWCKeBJ3camRySQ_yZAVTqLw">
                      sb_publishable_B8tc...qLw
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText("sb_publishable_B8tc_3lQWCKeBJ3camRySQ_yZAVTqLw");
                        mostrarToast("Public API Key copiada", "exito");
                      }}
                      className="p-1 hover:bg-slate-200 text-slate-500 rounded cursor-pointer shrink-0 ml-1"
                      title="Copiar API Key"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 block">Segura para peticiones cliente</span>
                </div>
              </div>

              {/* Mensaje de Diagnóstico Actual */}
              <div className={`p-4 rounded-xl border flex items-start space-x-3 ${
                supabaseDiag.ok
                  ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                  : "bg-rose-50 border-rose-200 text-rose-950"
              }`}>
                {supabaseDiag.ok ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 text-xs">
                  <span className="font-bold block">
                    {supabaseDiag.ok ? "Conexión a Supabase REST API Operativa" : "Diagnóstico de Conexión"}
                  </span>
                  <p className="leading-relaxed text-slate-700">{supabaseDiag.message}</p>
                  <p className="text-[11px] text-slate-500">
                    Host: <code className="font-mono text-slate-800">dcelksfchabhrlevlfah.supabase.co</code> • Protocolo: HTTPS/2 TLS 1.3 • Cloudflare Edge
                  </p>
                </div>
              </div>

              {/* Instrucciones de Migración SQL y Visor */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center space-x-2">
                      <Terminal className="w-4 h-4 text-slate-600" />
                      <span>Script de Migración SQL Inicial (001_initial_schema.sql)</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Esquema completo con tipos enumerados, tablas relacionales, llaves foráneas y reglas RLS para Supabase.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (sqlSchema) {
                          navigator.clipboard.writeText(sqlSchema);
                          setCopiadoSql(true);
                          setTimeout(() => setCopiadoSql(false), 2500);
                          mostrarToast("Script SQL copiado al portapapeles", "exito");
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                    >
                      {copiadoSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiadoSql ? "¡Copiado!" : "Copiar SQL"}</span>
                    </button>

                    <a
                      href="/api/supabase/schema-sql"
                      download="001_initial_schema.sql"
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors flex items-center space-x-1.5 shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar .sql</span>
                    </a>

                    <a
                      href="https://supabase.com/dashboard/project/dcelksfchabhrlevlfah/sql/new"
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center space-x-1.5 shadow-xs"
                    >
                      <span>Abrir SQL Editor Supabase</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                <div className="p-4 bg-slate-900 text-slate-100 font-mono text-[11px] leading-relaxed max-h-96 overflow-y-auto">
                  {cargandoSql ? (
                    <div className="py-8 text-center text-slate-400 flex items-center justify-center space-x-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Cargando esquema SQL...</span>
                    </div>
                  ) : sqlSchema ? (
                    <pre className="whitespace-pre">{sqlSchema}</pre>
                  ) : (
                    <div className="py-6 text-center text-slate-400">
                      <span>Presione "Cargar Esquema" o abra la pestaña nuevamente para visualizar el script SQL.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* BLOQUE 3: VISIBILIDAD GLOBAL Y REPORTES */}
      {/* ========================================================================= */}
      {tabActiva === "metricas" && metricas && (
        <div className="space-y-6">
          {/* Tarjetas KPI Superiores */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Casos</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">{metricas.totalExpedientes}</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">100% cartera global</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/20 shadow-xs">
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">En Trámite</span>
              <span className="text-2xl font-black text-blue-800 mt-1 block">{metricas.activosEnTramite}</span>
              <span className="text-[10px] text-blue-600 mt-0.5 block">Flujo operativo activo</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">Pausa Aporte 10%</span>
              <span className="text-2xl font-black text-amber-800 mt-1 block">{metricas.enPausaAporte}</span>
              <span className="text-[10px] text-amber-600 mt-0.5 block">A la espera de pago</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-xs">
              <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">Bloqueados Rev.</span>
              <span className="text-2xl font-black text-rose-800 mt-1 block">{metricas.bloqueadosRevision}</span>
              <span className="text-[10px] text-rose-600 mt-0.5 block">Por subsanar</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Desembolsados</span>
              <span className="text-2xl font-black text-emerald-800 mt-1 block">{metricas.subsidioDesembolsado}</span>
              <span className="text-[10px] text-emerald-600 mt-0.5 block">Completados</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Salida Definitiva</span>
              <span className="text-2xl font-black text-slate-700 mt-1 block">{metricas.salidaDefinitiva}</span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Rechazo / Salida</span>
            </div>
          </div>

          {/* Reporte Financiero de Subsidios */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">Reporte Financiero: Desembolsos de Subsidio Familiar</h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Consolidado financiero de recursos girados por cajas de compensación (Compensar) al constructor/operador.
                </p>
              </div>

              <div className="flex items-center space-x-4 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200">
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-700 block">Total Desembolsado</span>
                  <span className="text-base font-black text-emerald-900">{formatCOP(metricas.totalDesembolsadoCOP)}</span>
                </div>
                <div className="border-l border-emerald-200 pl-4">
                  <span className="text-[10px] font-bold uppercase text-emerald-700 block">Promedio por Vivienda</span>
                  <span className="text-xs font-bold text-emerald-800">{formatCOP(metricas.promedioDesembolsadoCOP)}</span>
                </div>
              </div>
            </div>

            {metricas.reporteFinanciero.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-2.5 px-4">Expediente</th>
                      <th className="py-2.5 px-4">Titular del Subsidio</th>
                      <th className="py-2.5 px-4">Municipio</th>
                      <th className="py-2.5 px-4">Fecha Desembolso</th>
                      <th className="py-2.5 px-4">N° Comprobante</th>
                      <th className="py-2.5 px-4 text-right">Monto Desembolsado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {metricas.reporteFinanciero.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-bold text-blue-700">
                          <button
                            type="button"
                            onClick={() => onSelectExpediente(item.expedienteId)}
                            className="hover:underline cursor-pointer"
                          >
                            {item.codigoVisible}
                          </button>
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{item.titular}</td>
                        <td className="py-2.5 px-4 text-slate-600">{item.municipio}</td>
                        <td className="py-2.5 px-4 text-slate-600">{new Date(item.fechaDesembolso).toLocaleDateString("es-CO")}</td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">{item.numeroComprobante}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-emerald-700">{formatCOP(item.montoDesembolsado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center py-4">
                No se registran expedientes con desembolso completado en este momento.
              </p>
            )}
          </div>

          {/* Cuellos de Botella y Tiempos de Trámite */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Tiempos de permanencia por Fase */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Permanencia Promedio y Detección de Cuellos de Botella
                </h4>
              </div>
              <p className="text-xs text-slate-500">
                Tiempo promedio en días transcurrido por expediente en cada fase operativa.
              </p>

              <div className="space-y-2.5 pt-2">
                {metricas.cuellosDeBotella.map((cb) => (
                  <div key={cb.fase} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-800">
                        Fase {cb.fase}: {cb.label}
                      </span>
                      <span className="font-bold text-slate-900">
                        {cb.promedioDias} días promedio
                        {cb.rezagadosCount > 0 && (
                          <span className="ml-1.5 text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded-full text-[10px]">
                            {cb.rezagadosCount} rezagados
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          cb.promedioDias > 30
                            ? "bg-rose-500"
                            : cb.promedioDias > 15
                            ? "bg-amber-500"
                            : "bg-blue-600"
                        }`}
                        style={{ width: `${Math.min(100, (cb.promedioDias / 45) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Expedientes Rezagados */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Expedientes con Mayor Tiempo de Trámite (&gt; 20 días)
                </h4>
              </div>
              <p className="text-xs text-slate-500">
                Casos que requieren intervención administrativa prioritaria para destrabar el avance.
              </p>

              <div className="max-h-64 overflow-y-auto space-y-2 pt-1">
                {metricas.expedientesRezagados.length > 0 ? (
                  metricas.expedientesRezagados.map((rez) => (
                    <div
                      key={rez.id}
                      className="p-3 rounded-lg border border-amber-200 bg-amber-50/40 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => onSelectExpediente(rez.id)}
                            className="font-bold font-mono text-blue-700 hover:underline cursor-pointer"
                          >
                            {rez.codigoVisible}
                          </button>
                          <span className="font-semibold text-slate-800">{rez.titular}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Fase actual: {rez.faseActual} • Responsable: {rez.responsable} • {rez.municipio}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-rose-700 text-xs block">{rez.diasEnFase} días en fase</span>
                        <span className="text-[10px] text-slate-500">{rez.diasTotales} días totales</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 text-center py-6">
                    No hay expedientes rezagados en el sistema. Todos los casos se encuentran dentro de los tiempos estándar.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Distribución Geográfica y por Responsable */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Por Municipio */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Distribución Geográfica de la Cartera
                </h4>
              </div>

              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-[11px] font-semibold">
                      <th className="py-2">Municipio</th>
                      <th className="py-2 text-center">Expedientes</th>
                      <th className="py-2 text-right">Desembolsados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {metricas.porMunicipio.map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 font-medium text-slate-800">{m.municipio}</td>
                        <td className="py-2 text-center font-bold text-slate-900">{m.cantidad}</td>
                        <td className="py-2 text-right text-emerald-700 font-semibold">{m.desembolsados}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Carga por Responsable */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Carga Operativa por Responsable
                </h4>
              </div>

              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-[11px] font-semibold">
                      <th className="py-2">Responsable</th>
                      <th className="py-2">Rol</th>
                      <th className="py-2 text-center">Total Asignados</th>
                      <th className="py-2 text-right">En Trámite</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {metricas.porResponsable.map((r) => (
                      <tr key={r.responsableId} className="hover:bg-slate-50">
                        <td className="py-2 font-semibold text-slate-900">{r.nombre}</td>
                        <td className="py-2">
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {r.rol}
                          </span>
                        </td>
                        <td className="py-2 text-center font-bold text-slate-900">{r.totalAsignados}</td>
                        <td className="py-2 text-right font-bold text-blue-700">{r.enTramite}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BLOQUE 4: DECISIONES CRÍTICAS Y AUDITORÍA GENERAL */}
      {/* ========================================================================= */}
      {tabActiva === "criticas" && (
        <div className="space-y-6">
          {/* Solicitudes de Rechazo Pendientes */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Bandeja de Aprobación de Rechazo Definitivo
                  </h3>
                  <p className="text-xs text-slate-500">
                    Como Administrador, usted comparte junto al Analista Documental la máxima autoridad para ratificar o desestimar la salida definitiva de un hogar.
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                {solicitudesRechazoPendientes.length} solicitudes pendientes
              </span>
            </div>

            {solicitudesRechazoPendientes.length > 0 ? (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {solicitudesRechazoPendientes.map((exp) => (
                  <div key={exp.id} className="p-4 bg-white hover:bg-slate-50/50 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2.5">
                        <button
                          type="button"
                          onClick={() => onSelectExpediente(exp.id)}
                          className="font-mono font-bold text-blue-700 hover:underline cursor-pointer"
                        >
                          {exp.codigoVisible}
                        </button>
                        <span className="font-bold text-slate-900">{exp.titularNombreCompleto}</span>
                        <span className="text-xs text-slate-500">
                          (C.C. {exp.titularNumeroDocumento} • Fase {exp.faseActual})
                        </span>
                      </div>

                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 self-start sm:self-auto">
                        Motivo: {exp.solicitudRechazo?.motivo}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed">
                      <span className="font-semibold text-slate-900">Justificación del solicitante ({exp.solicitudRechazo?.solicitanteNombre}):</span>{" "}
                      {exp.solicitudRechazo?.justificacion}
                    </p>

                    <div className="flex items-center justify-end space-x-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleDesestimarRechazoDirecto(exp.id)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                      >
                        Desestimar Solicitud
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAprobarRechazoDirecto(exp.id)}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center space-x-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Aprobar Rechazo Definitivo</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">No hay solicitudes de rechazo pendientes</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Todas las postulaciones continúan su curso normal.</p>
              </div>
            )}
          </div>

          {/* Historial de Salidas Definitivas */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Historial de Expedientes en Salida Definitiva ({expedientesSalidaDefinitiva.length})
                </h4>
                <p className="text-xs text-slate-500">
                  Hogares desestimados o retirados del programa con su respectivo soporte de cierre formal.
                </p>
              </div>
            </div>

            {expedientesSalidaDefinitiva.length > 0 ? (
              <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {expedientesSalidaDefinitiva.map((exp) => (
                  <div key={exp.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <button
                        type="button"
                        onClick={() => onSelectExpediente(exp.id)}
                        className="font-mono font-bold text-blue-700 hover:underline mr-2 cursor-pointer"
                      >
                        {exp.codigoVisible}
                      </button>
                      <span className="font-semibold text-slate-800">{exp.titularNombreCompleto}</span>
                      <span className="text-[11px] text-slate-500 ml-2">
                        • {exp.predios?.[0]?.municipioNombre || "Cundinamarca"}
                      </span>
                    </div>

                    <span className="text-[11px] text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded-full">
                      Salida Definitiva
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center py-4">No hay expedientes en Salida Definitiva.</p>
            )}
          </div>

          {/* Bitácora Inmutable de Auditoría del Sistema */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Bitácora Global de Auditoría del Sistema
                </h4>
              </div>
              <span className="text-xs text-slate-500">{auditoria.length} eventos registrados</span>
            </div>

            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto border border-slate-200 rounded-xl">
              {auditoria.map((aud) => (
                <div key={aud.id} className="p-3 hover:bg-slate-50 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 font-mono text-[11px]">{aud.accion}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 uppercase font-semibold">
                        {aud.categoria}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {new Date(aud.fecha).toLocaleString("es-CO")}
                    </span>
                  </div>

                  <p className="text-slate-700 leading-relaxed">{aud.detalle}</p>

                  <div className="text-[11px] text-slate-500">
                    Ejecutado por: <span className="font-semibold text-slate-800">{aud.adminNombre}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALES DEL MÓDULO ADMINISTRADOR */}
      {/* ========================================================================= */}

      {/* Modal 1: Nuevo Usuario */}
      {modalNuevoUsuario && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Crear Nuevo Usuario</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalNuevoUsuario(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCrearUsuario} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Laura Camila Vargas"
                  value={formUsuario.nombreCompleto}
                  onChange={(e) => setFormUsuario({ ...formUsuario, nombreCompleto: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nombre de Usuario (Username)</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: lvargas"
                  value={formUsuario.username}
                  onChange={(e) => setFormUsuario({ ...formUsuario, username: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  placeholder="Ej: lvargas@francoosorio.com"
                  value={formUsuario.email}
                  onChange={(e) => setFormUsuario({ ...formUsuario, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Rol Asignado</label>
                <select
                  value={formUsuario.rol}
                  onChange={(e) => setFormUsuario({ ...formUsuario, rol: e.target.value as RolUsuario })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="supervisor">Supervisor (Control y Aprobación)</option>
                  <option value="administrador">Administrador</option>
                  <option value="comercial">Gestor Rural (Comercial)</option>
                  <option value="asistente">Gestor Documental (Asistente)</option>
                  <option value="ingenieria">Ingeniería</option>
                  <option value="planeacion">Planeación y Auditoría</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Contraseña Inicial</label>
                <input
                  type="password"
                  placeholder="Por defecto: crm2026*"
                  value={formUsuario.password}
                  onChange={(e) => setFormUsuario({ ...formUsuario, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalNuevoUsuario(false)}
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-xs"
                >
                  {guardando ? "Creando..." : "Crear Usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Editar Usuario */}
      {modalEditarUsuario && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Edit2 className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-sm">Modificar Usuario</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalEditarUsuario(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleActualizarUsuario} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={modalEditarUsuario.nombreCompleto}
                  onChange={(e) => setModalEditarUsuario({ ...modalEditarUsuario, nombreCompleto: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  value={modalEditarUsuario.email}
                  onChange={(e) => setModalEditarUsuario({ ...modalEditarUsuario, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Rol en el Sistema</label>
                <select
                  value={modalEditarUsuario.rol}
                  onChange={(e) => setModalEditarUsuario({ ...modalEditarUsuario, rol: e.target.value as RolUsuario })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="supervisor">Supervisor (Control y Aprobación)</option>
                  <option value="administrador">Administrador</option>
                  <option value="comercial">Gestor Rural (Comercial)</option>
                  <option value="asistente">Gestor Documental (Asistente)</option>
                  <option value="ingenieria">Ingeniería</option>
                  <option value="planeacion">Planeación y Auditoría</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalEditarUsuario(null)}
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-xs"
                >
                  {guardando ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmación de Eliminación Segura de Usuario */}
      {usuarioAEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
            <div className="flex items-start space-x-3.5 mb-4">
              <div className="p-3 rounded-xl shrink-0 bg-rose-100 text-rose-600">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900 leading-snug">
                  ¿Eliminar usuario del sistema?
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Está a punto de eliminar al usuario <strong className="text-slate-900">{usuarioAEliminar.nombreCompleto}</strong> (<code>@{usuarioAEliminar.username}</code>, Rol: <span className="font-semibold uppercase">{formatearRol(usuarioAEliminar.rol)}</span>).
                </p>
                <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 leading-relaxed space-y-1">
                  <div className="font-bold flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Acción permanente</span>
                  </div>
                  <p>
                    Este usuario será eliminado de forma definitiva tanto del sistema CRM como de la base de datos de <strong>Supabase</strong> (<code>perfiles_usuario</code>).
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={eliminandoUsuario}
                onClick={() => setUsuarioAEliminar(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={eliminandoUsuario}
                onClick={handleConfirmarEliminarUsuario}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                {eliminandoUsuario && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{eliminandoUsuario ? "Eliminando..." : "Sí, Eliminar Usuario"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Bitácora de Acciones por Usuario */}
      {modalAuditoriaUsuario && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <History className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    Historial de Auditoría de Usuario: {modalAuditoriaUsuario.usuario.nombreCompleto}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rol: <span className="font-semibold uppercase">{modalAuditoriaUsuario.usuario.rol}</span> • Total acciones: {modalAuditoriaUsuario.totalAcciones}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalAuditoriaUsuario(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {modalAuditoriaUsuario.historial.map((ev, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span className="font-bold uppercase text-slate-700">{ev.tipo}</span>
                    <span>{new Date(ev.fecha).toLocaleString("es-CO")}</span>
                  </div>
                  <p className="text-slate-800 leading-relaxed">{ev.descripcion}</p>
                  {ev.expedienteId && (
                    <button
                      type="button"
                      onClick={() => {
                        setModalAuditoriaUsuario(null);
                        onSelectExpediente(ev.expedienteId);
                      }}
                      className="text-blue-600 hover:underline font-semibold text-[11px] inline-flex items-center space-x-1"
                    >
                      <span>Ver Expediente Afectado</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              {modalAuditoriaUsuario.historial.length === 0 && (
                <p className="text-center py-6 text-slate-500">No se registran acciones para este usuario aún.</p>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setModalAuditoriaUsuario(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Reasignar Cartera */}
      {modalReasignar && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <ArrowRight className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Reasignación Operativa de Cartera</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalReasignar(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEjecutarReasignacion} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Usuario de Origen (Responsable actual)</label>
                <select
                  value={formReasignar.origenUsuarioId}
                  onChange={(e) => setFormReasignar({ ...formReasignar, origenUsuarioId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="">-- Seleccionar usuario de origen (opcional si es carterizada) --</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {formatearNombreUsuario(u.nombreCompleto)} ({formatearRol(u.rol).toUpperCase()}) - {u.expedientesAsignadosCount} casos
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Usuario de Destino (Nuevo responsable asignado) *
                </label>
                <select
                  required
                  value={formReasignar.destinoUsuarioId}
                  onChange={(e) => setFormReasignar({ ...formReasignar, destinoUsuarioId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="">-- Seleccionar nuevo responsable --</option>
                  {usuarios
                    .filter((u) => u.activo)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {formatearNombreUsuario(u.nombreCompleto)} ({formatearRol(u.rol).toUpperCase()})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Motivo Formal de la Reasignación *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Ej: Rebalanceo de carga laboral en municipios del Alto Magdalena / Incapacidad médica..."
                  value={formReasignar.motivo}
                  onChange={(e) => setFormReasignar({ ...formReasignar, motivo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-blue-800 text-[11px] leading-relaxed">
                <Info className="w-3.5 h-3.5 inline mr-1" />
                Esta acción registrará automáticamente una nota formal en la bitácora de cada expediente reasignado y dejará constancia en la auditoría general.
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalReasignar(false)}
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold shadow-xs"
                >
                  {guardando ? "Reasignando..." : "Confirmar Reasignación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Agregar Requisito Maestro */}
      {modalNuevoRequisito && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Plus className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Nuevo Documento Requerido (Fase {formRequisito.fase})</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalNuevoRequisito(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCrearRequisito} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Código del Documento</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: F1-07"
                  value={formRequisito.codigo}
                  onChange={(e) => setFormRequisito({ ...formRequisito, codigo: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono uppercase"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nombre Oficial del Documento</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Certificado de Pertenencia Comunal o Veredal"
                  value={formRequisito.nombre}
                  onChange={(e) => setFormRequisito({ ...formRequisito, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Descripción y Directriz</label>
                <textarea
                  rows={2}
                  placeholder="Explique el propósito o características técnicas del documento..."
                  value={formRequisito.descripcion}
                  onChange={(e) => setFormRequisito({ ...formRequisito, descripcion: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-obligatorio"
                  checked={formRequisito.esObligatorio}
                  onChange={(e) => setFormRequisito({ ...formRequisito, esObligatorio: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="chk-obligatorio" className="font-semibold text-slate-700 cursor-pointer">
                  Documento obligatorio para avanzar de fase
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalNuevoRequisito(false)}
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-xs"
                >
                  {guardando ? "Guardando..." : "Incorporar Requisito"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 6: Editar Fase */}
      {modalEditarFase && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Edit2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Editar Fase {modalEditarFase.num}</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalEditarFase(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarFase} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nombre Oficial de la Fase</label>
                <input
                  type="text"
                  required
                  value={modalEditarFase.label}
                  onChange={(e) => setModalEditarFase({ ...modalEditarFase, label: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Descripción del Alcance</label>
                <textarea
                  rows={3}
                  value={modalEditarFase.desc}
                  onChange={(e) => setModalEditarFase({ ...modalEditarFase, desc: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Rol Sugerido Responsable</label>
                <select
                  value={modalEditarFase.rolSugerido}
                  onChange={(e) => setModalEditarFase({ ...modalEditarFase, rolSugerido: e.target.value as RolUsuario })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="supervisor">Supervisor</option>
                  <option value="administrador">Administrador</option>
                  <option value="comercial">Gestor Rural</option>
                  <option value="asistente">Gestor Documental</option>
                  <option value="ingenieria">Ingeniería</option>
                  <option value="planeacion">Planeación y Auditoría</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalEditarFase(null)}
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-xs"
                >
                  {guardando ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 7: Agregar Municipio */}
      {modalNuevoMunicipio && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Habilitar Nuevo Municipio</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalNuevoMunicipio(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCrearMunicipio} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nombre del Municipio</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Medina"
                  value={formMunicipio.municipioNombre}
                  onChange={(e) => setFormMunicipio({ ...formMunicipio, municipioNombre: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Código DANE Completo (5 dígitos)</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 25438"
                  value={formMunicipio.codigoCompleto}
                  onChange={(e) => setFormMunicipio({ ...formMunicipio, codigoCompleto: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Departamento</label>
                <input
                  type="text"
                  required
                  value={formMunicipio.departamentoNombre}
                  onChange={(e) => setFormMunicipio({ ...formMunicipio, departamentoNombre: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalNuevoMunicipio(false)}
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-xs"
                >
                  {guardando ? "Guardando..." : "Habilitar Municipio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
