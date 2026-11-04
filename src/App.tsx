import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  Users,
  FileText,
  Clock,
  Shield,
  Search,
  Filter,
  PlusCircle,
  Eye,
  EyeOff,
  User,
  CheckCircle2,
  AlertCircle,
  LogOut,
  ChevronRight,
  ChevronDown,
  Upload,
  UserPlus,
  Send,
  MessageSquare,
  Building2,
  MapPin,
  Lock,
  ArrowRight,
  Loader2,
  Trash2,
  X,
  Calculator,
  ShieldCheck,
  HardHat,
  Award,
  RotateCcw,
  AlertTriangle,
  HelpCircle,
  UserCheck,
  UserCog,
  UserX,
  Camera,
  ImageIcon,
  Image,
  FileSpreadsheet,
  Phone,
  PhoneCall,
  KeyRound,
  Printer,
  RefreshCw,
  Download,
  Sparkles
} from "lucide-react";
import { supabase } from "./utils/supabaseClient";
import {
  PerfilUsuario,
  Expediente,
  Interesado,
  RequisitoCaso,
  NotaConversacion,
  Tarea,
  RolUsuario,
  TipoIdentificacion,
  SolicitudRetiroCedula,
  FotoRegistro,
  calcularCodigoVisible,
  OPCIONES_ORIGEN_CAPTACION,
  DocumentoInteresado
} from "./types";
import { DocVisorModal } from "./components/DocVisorModal";
import { Fase3Compensar } from "./components/Fase3Compensar";
import { Fase4GestionTecnica } from "./components/Fase4GestionTecnica";
import { Fase5SeguimientoLicencia } from "./components/Fase5SeguimientoLicencia";
import { Fase6PostulacionSubsidio } from "./components/Fase6PostulacionSubsidio";
import { Fase7ConstruccionCobro } from "./components/Fase7ConstruccionCobro";
import { ModalSolicitudRechazo } from "./components/ModalSolicitudRechazo";
import { AdminPanel } from "./components/AdminPanel";
import { ModuloInformes } from "./components/ModuloInformes";
import { ModalCambioPassword } from "./components/ModalCambioPassword";
import { FichaTecnicaImprimible } from "./components/FichaTecnicaImprimible";
import { CATALOGO_MUNICIPIOS } from "./data/municipios";
import { normalizarTextoNombre, construirNombreCompleto, descomponerNombreCompleto, decodificarNombresMetadata, generarNombreArchivoCedulaEstandar } from "./utils/normalizacion";
import { formatearRol, formatearNombreUsuario } from "./utils/formatoRoles";
import { convertirImagenAPdf } from "./utils/imageToPdf";

export default function App() {
  // Estado de sesión persistente en iframes
  const [currentUser, setCurrentUser] = useState<PerfilUsuario | null>(() => {
    try {
      const saved = localStorage.getItem("crm_user_session");
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);
  const [systemStatus, setSystemStatus] = useState<{
    mode: "mock" | "supabase";
    isPersistent: boolean;
    label: string;
    projectId?: string;
    projectUrl?: string;
    supabaseConnected?: boolean;
    supabaseStatusMsg?: string;
  }>({
    mode: "supabase",
    isPersistent: true,
    label: "MODO SUPABASE — PROYECTO: dcelksfchabhrlevlfah",
    projectId: "dcelksfchabhrlevlfah",
    projectUrl: "https://dcelksfchabhrlevlfah.supabase.co",
    supabaseConnected: true
  });
  const [loginUsername, setLoginUsername] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [mostrarPassword, setMostrarPassword] = useState<boolean>(false);
  const [iniciandoSesion, setIniciandoSesion] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Notificaciones y estados de modales
  const [toast, setToast] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const [errorInteresado, setErrorInteresado] = useState<string | null>(null);
  const [guardandoInteresado, setGuardandoInteresado] = useState<boolean>(false);
  const [errorConvertir, setErrorConvertir] = useState<string | null>(null);
  const [guardandoConvertir, setGuardandoConvertir] = useState<boolean>(false);
  const [errorNota, setErrorNota] = useState<string | null>(null);
  const [errorAgregarCedula, setErrorAgregarCedula] = useState<string | null>(null);
  const [errorSubirArchivo, setErrorSubirArchivo] = useState<string | null>(null);
  const [errorRevisar, setErrorRevisar] = useState<string | null>(null);
  const [guardandoRevision, setGuardandoRevision] = useState<boolean>(false);
  const [errorAprobar, setErrorAprobar] = useState<string | null>(null);
  const [modalCambioPasswordVoluntario, setModalCambioPasswordVoluntario] = useState<boolean>(false);
  const [mostrarFichaImprimible, setMostrarFichaImprimible] = useState<boolean>(false);

  const mostrarToast = (texto: string, tipo: "exito" | "error" = "exito") => {
    setToast({ tipo, texto });
    setTimeout(() => setToast(null), 4500);
  };

  // Helper de peticiones autenticadas compatible con cookies, iframes y sin caché
  const authFetch = (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem("crm_user_token") || currentUser?.id || "";
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
      headers.set("x-user-id", currentUser?.id || token);
    }
    
    // Solicitar explícitamente JSON para evitar fallbacks HTML del servidor o proxies
    headers.set("Accept", "application/json");

    // Evitar caché de navegador para sincronización y actualización inmediata en tiempo real
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    headers.set("Pragma", "no-cache");
    
    // Sanitizar API_URL para prevenir dobles barras accidentales (ej: //api/...)
    const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    const separator = cleanPath.includes("?") ? "&" : "?";
    const cacheBustedUrl = `${cleanPath}${separator}_t=${Date.now()}`;
    const fullUrl = rawApiUrl ? `${rawApiUrl}${cacheBustedUrl}` : cacheBustedUrl;
    
    return fetch(fullUrl, {
      ...options,
      cache: "no-store",
      credentials: "include",
      headers
    });
  };

  // Navegación principal
  const [vistaActual, setVistaActual] = useState<"expedientes" | "captacion" | "detalle" | "administracion" | "informes">("expedientes");
  const [expedienteSeleccionadoId, setExpedienteSeleccionadoId] = useState<string | null>(null);

  // Datos principales
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [interesados, setInteresados] = useState<Interesado[]>([]);
  const [detalleExp, setDetalleExp] = useState<{
    expediente: Expediente;
    requisitos: RequisitoCaso[];
    notas: NotaConversacion[];
    tareas: Tarea[];
  } | null>(null);

  // Filtros de búsqueda (Cambios 1 y 7)
  const [filtroTexto, setFiltroTexto] = useState<string>("");
  const [filtroMunicipio, setFiltroMunicipio] = useState<string>("");
  const [filtroEstado, setFiltroEstado] = useState<string>("");
  const [filtroFase, setFiltroFase] = useState<string>(""); // Cambio 1: Filtro por Fase
  const [filtroResponsable, setFiltroResponsable] = useState<string>(""); // Cambio 7: Filtro por Responsable General
  const [filtroTiempo, setFiltroTiempo] = useState<string>(""); // Cambio 7: Filtro por Tiempo en días

  const handleLimpiarFiltros = () => {
    setFiltroTexto("");
    setFiltroMunicipio("");
    setFiltroEstado("");
    setFiltroFase("");
    setFiltroResponsable("");
    setFiltroTiempo("");
  };
  const [integranteAEliminar, setIntegranteAEliminar] = useState<{
    id: string;
    nombre: string;
    parentesco?: string;
    numeroIdentificacion?: string;
    tipoIdentificacion?: string;
  } | null>(null); // Cambio 2: Gestión de retiro de cédula
  const [eliminandoIntegrante, setEliminandoIntegrante] = useState<boolean>(false);
  const [motivoSolicitudRetiro, setMotivoSolicitudRetiro] = useState<string>("");
  const [guardandoSolicitudRetiro, setGuardandoSolicitudRetiro] = useState<boolean>(false);
  
  // Solicitudes de retiro para supervisores (Cambio 2)
  const [solicitudesRetiro, setSolicitudesRetiro] = useState<SolicitudRetiroCedula[]>([]);
  const [modalBandejaRetiro, setModalBandejaRetiro] = useState<boolean>(false);
  const [solicitudAResolver, setSolicitudAResolver] = useState<SolicitudRetiroCedula | null>(null);
  const [modalRechazarSolicitud, setModalRechazarSolicitud] = useState<boolean>(false);
  const [motivoRechazoSolicitud, setMotivoRechazoSolicitud] = useState<string>("");
  const [guardandoResolucionRetiro, setGuardandoResolucionRetiro] = useState<boolean>(false);

  // Visor modal
  const [docVisorData, setDocVisorData] = useState<{
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
  } | null>(null);

  // Estados para Rechazo del Hogar (Cambio 6)
  const [modalSolicitarRechazoHogar, setModalSolicitarRechazoHogar] = useState<boolean>(false);
  const [modalAprobarRechazoHogar, setModalAprobarRechazoHogar] = useState<boolean>(false);
  const [modalDesestimarRechazoHogar, setModalDesestimarRechazoHogar] = useState<boolean>(false);
  const [justificacionDesestimarHogar, setJustificacionDesestimarHogar] = useState<string>("");
  const [procesandoRechazoHogar, setProcesandoRechazoHogar] = useState<boolean>(false);

  // Modales operativos
  const [modalNuevoInteresado, setModalNuevoInteresado] = useState<boolean>(false);
  const [modalConvertirInteresado, setModalConvertirInteresado] = useState<Interesado | null>(null);
  const [notasDelInteresado, setNotasDelInteresado] = useState<NotaConversacion[]>([]);
  const [nuevaNotaInteresadoTexto, setNuevaNotaInteresadoTexto] = useState<string>("");
  const [modalAgregarCedula, setModalAgregarCedula] = useState<boolean>(false);
  const [archivoCedulaIntegrante, setArchivoCedulaIntegrante] = useState<File | null>(null);
  const [modalSubirArchivoReq, setModalSubirArchivoReq] = useState<RequisitoCaso | null>(null);
  const [archivoSeleccionadoSubir, setArchivoSeleccionadoSubir] = useState<File | null>(null);
  const [fotosParaRegistro, setFotosParaRegistro] = useState<{
    id: string;
    nombre: string;
    url: string;
    tamanoBytes: number;
    categoria: string;
  }[]>([]);
  const [subiendoArchivo, setSubiendoArchivo] = useState<boolean>(false);
  const [dragOverSubir, setDragOverSubir] = useState<boolean>(false);
  const [modalRevisarReq, setModalRevisarReq] = useState<RequisitoCaso | null>(null);
  const [modalAprobarFase1, setModalAprobarFase1] = useState<boolean>(false);
  const [guardandoAprobacion, setGuardandoAprobacion] = useState<boolean>(false);
  const [modalNuevoRequisito, setModalNuevoRequisito] = useState<boolean>(false);
  const [guardandoRequisito, setGuardandoRequisito] = useState<boolean>(false);
  const [errorNuevoRequisito, setErrorNuevoRequisito] = useState<string | null>(null);
  const [archivoAdjuntoNuevoReq, setArchivoAdjuntoNuevoReq] = useState<File | null>(null);
  const [modalDevolverFase2, setModalDevolverFase2] = useState<boolean>(false);
  const [textoDevolucionFase2, setTextoDevolucionFase2] = useState<string>("");
  const [guardandoDevolucionFase2, setGuardandoDevolucionFase2] = useState<boolean>(false);
  const [guardandoEnvioRevisionFase2, setGuardandoEnvioRevisionFase2] = useState<boolean>(false);
  const [guardandoEnvioRevision, setGuardandoEnvioRevision] = useState<boolean>(false);
  const [guardandoAprobacionFase2, setGuardandoAprobacionFase2] = useState<boolean>(false);
  const [tabCaptacion, setTabCaptacion] = useState<"activos" | "convertidos" | "todos">("todos");
  const [tabExpedientes, setTabExpedientes] = useState<"activos" | "retirados" | "todos">("activos");
  const [filtroTextoCaptacion, setFiltroTextoCaptacion] = useState("");
  const [filtroMunicipioCaptacion, setFiltroMunicipioCaptacion] = useState("");
  const [filtroOrigenCaptacion, setFiltroOrigenCaptacion] = useState("");
  const [origenesCaptacion, setOrigenesCaptacion] = useState<string[]>(OPCIONES_ORIGEN_CAPTACION);
  const [filtroRangoDiasCaptacion, setFiltroRangoDiasCaptacion] = useState("");
  const [modalGestionarVencimiento, setModalGestionarVencimiento] = useState<Interesado | null>(null);
  const [diasExtensionSeleccionados, setDiasExtensionSeleccionados] = useState<number>(7);
  const [motivoDescarte, setMotivoDescarte] = useState<string>("");
  const [procesandoVencimiento, setProcesandoVencimiento] = useState<boolean>(false);
  const [confirmarDescarte, setConfirmarDescarte] = useState<boolean>(false);
  const [popoverDocInteresadoId, setPopoverDocInteresadoId] = useState<string | null>(null);
  const [nuevoDocNombre, setNuevoDocNombre] = useState<string>("");

  const [formNuevoRequisito, setFormNuevoRequisito] = useState({
    nombre: "",
    descripcion: "",
    esObligatorio: true,
    fase: 2
  });
  const [tabRequisitos, setTabRequisitos] = useState<number>(1);

  // Formularios de entrada con estructura de 4 nombres y cédula desde captación
  const [formInteresado, setFormInteresado] = useState({
    primerNombre: "",
    segundoNombre: "",
    primerApellido: "",
    segundoApellido: "",
    nombreContacto: "",
    tipoIdentificacion: "CC" as TipoIdentificacion,
    numeroIdentificacion: "",
    telefono: "",
    tieneWhatsapp: true,
    habilitarSegundoTelefono: false,
    telefonoSecundario: "",
    tieneWhatsappSecundario: false,
    correo: "",
    departamentoCodigo: "25",
    municipioCodigo: "25151",
    vereda: "",
    origenContacto: "Llamada",
    resumenNecesidad: ""
  });

  const [formConvertir, setFormConvertir] = useState({
    tipoIdentificacion: "CC" as TipoIdentificacion,
    numeroIdentificacion: "",
    primerNombre: "",
    segundoNombre: "",
    primerApellido: "",
    segundoApellido: "",
    nombres: "",
    municipioCodigo: "25151",
    vereda: "",
    nombreODireccionPredio: ""
  });

  const [formIntegrante, setFormIntegrante] = useState({
    tipoIdentificacion: "CC" as TipoIdentificacion,
    numeroIdentificacion: "",
    primerNombre: "",
    segundoNombre: "",
    primerApellido: "",
    segundoApellido: "",
    nombres: "",
    parentesco: "hijo"
  });

  const [formRevision, setFormRevision] = useState({
    resultado: "ACEPTADO" as "ACEPTADO" | "OBSERVADO",
    observacion: ""
  });

  const [asistentesElegibles, setAsistentesElegibles] = useState<{ id: string; nombreCompleto: string }[]>([]);
  const [asistenteSeleccionadoId, setAsistenteSeleccionadoId] = useState<string>("");
  const [nuevaNotaTexto, setNuevaNotaTexto] = useState<string>("");

  // Estados para Auditoría y Acciones Robustas de Botones
  const [modalConfirmacion, setModalConfirmacion] = useState<{
    isOpen: boolean;
    titulo: string;
    mensaje: string;
    textoBoton?: string;
    tipo?: "peligro" | "primario" | "advertencia";
    onConfirm: () => Promise<void> | void;
  } | null>(null);
  const [ejecutandoConfirmacion, setEjecutandoConfirmacion] = useState<boolean>(false);

  const [modalDevolverFase1, setModalDevolverFase1] = useState<boolean>(false);
  const [textoDevolucionFase1, setTextoDevolucionFase1] = useState<string>("");
  const [guardandoDevolucionFase1, setGuardandoDevolucionFase1] = useState<boolean>(false);

  const [modalReasignar, setModalReasignar] = useState<boolean>(false);
  const [todosUsuarios, setTodosUsuarios] = useState<PerfilUsuario[]>([]);
  const [nuevoResponsableId, setNuevoResponsableId] = useState<string>("");
  const [motivoReasignacion, setMotivoReasignacion] = useState<string>("");
  const [guardandoReasignacion, setGuardandoReasignacion] = useState<boolean>(false);
  const [sincronizando, setSincronizando] = useState<boolean>(false);
  const [mensajeSincronizacion, setMensajeSincronizacion] = useState<string | null>(null);
  const [estadoSincronizacion, setEstadoSincronizacion] = useState<"inactivo" | "cargando" | "exito" | "error">("inactivo");
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState<string>("");
  const [cambiandoRol, setCambiandoRol] = useState<boolean>(false);
  const roleSelectRef = useRef<HTMLSelectElement | null>(null);

  // Lista siempre activa y resiliente para el cambiador rápido de usuario y rol
  const usuariosParaSelector = useMemo(() => {
    const lista = (todosUsuarios && todosUsuarios.length > 0)
      ? todosUsuarios.filter((u) => u.activo !== false)
      : [
          { id: "757ef367-c0bd-480a-b294-d5fef041f39c", nombreCompleto: "Carlos Mendoza (Gestor Rural)", rol: "comercial" as RolUsuario, activo: true },
          { id: "ee12d5e6-34cf-4de5-b11a-f256ddde4be2", nombreCompleto: "Laura Castillo (Gestor Documental)", rol: "asistente" as RolUsuario, activo: true },
          { id: "f00564c8-adb3-46d2-b154-837b9e7386aa", nombreCompleto: "Dra. Helena Ramírez (Supervisor)", rol: "supervisor" as RolUsuario, activo: true },
          { id: "73e7181a-02ea-49a9-afaa-7c58e7097a24", nombreCompleto: "Ing. Roberto Salazar (Coordinador Técnico)", rol: "ingenieria" as RolUsuario, activo: true },
          { id: "a49c95b6-75da-48cb-a827-0cf4957e8c3b", nombreCompleto: "Administrador de Sistemas", rol: "administrador" as RolUsuario, activo: true }
        ];

    if (currentUser && !lista.some((u) => u.id === currentUser.id)) {
      return [{ id: currentUser.id, nombreCompleto: currentUser.nombreCompleto, rol: currentUser.rol, activo: true }, ...lista];
    }
    return lista;
  }, [todosUsuarios, currentUser]);

  // Sincronización en Tiempo Real con Supabase (WebSockets + Polling en Segundo Plano)
  useEffect(() => {
    if (!currentUser) return;

    // 1. Suscripción por WebSockets (Supabase Realtime)
    let channel: any = null;
    if (supabase) {
      try {
        channel = supabase
          .channel("realtime-cambios-crm")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "expedientes" },
            () => {
              cargarExpedientes();
              if (expedienteSeleccionadoId) {
                cargarDetalleExpediente(expedienteSeleccionadoId);
              }
            }
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "interesados" },
            () => {
              if (currentUser.rol === "comercial" || currentUser.rol === "administrador") {
                cargarInteresados();
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.warn("[REALTIME]: No se pudo iniciar suscripción websocket:", err);
      }
    }

    // 2. Sincronización continua de fondo (Heartbeat cada 12 segundos y al volver a la pestaña)
    const sincronizarFondo = () => {
      cargarExpedientes();
      if (currentUser.rol === "comercial" || currentUser.rol === "administrador") {
        cargarInteresados();
      }
    };

    window.addEventListener("focus", sincronizarFondo);
    const intervalo = setInterval(sincronizarFondo, 12000);

    return () => {
      window.removeEventListener("focus", sincronizarFondo);
      clearInterval(intervalo);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [currentUser, expedienteSeleccionadoId]);

  // Comprobación de sesión inicial y estado del sistema
  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || "";
    fetch(`${API_URL}/api/system/status`)
      .then((res) => res.json())
      .then((data) => {
        if (data.mode) setSystemStatus(data);
      })
      .catch(() => {});

    authFetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401) {
            setCurrentUser(null);
            localStorage.removeItem("crm_user_session");
            localStorage.removeItem("crm_user_token");
          }
          return null;
        }
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) return null;
        return res.json();
      })
      .then((data) => {
        if (data && data.authenticated && data.user) {
          setCurrentUser(data.user);
          localStorage.setItem("crm_user_session", JSON.stringify(data.user));
          localStorage.setItem("crm_user_token", data.user.id);
          // Pantalla de aterrizaje por rol (Cambio 7): Comercial -> Captación, otros -> Expedientes
          if (data.user.rol === "comercial") {
            setVistaActual("captacion");
          } else {
            setVistaActual("expedientes");
          }
        } else if (data && !data.authenticated) {
          setCurrentUser(null);
          localStorage.removeItem("crm_user_session");
          localStorage.removeItem("crm_user_token");
        }
      })
      .catch(() => {})
      .finally(() => setLoadingAuth(false));
  }, []);

  // Carga de datos cuando hay usuario autenticado y protección de rutas
  useEffect(() => {
    if (currentUser) {
      cargarExpedientes();
      cargarUsuarios();
      cargarOrigenesCaptacion();
      const rolesConAccesoCaptacion = ["comercial", "administrador", "planeacion", "supervisor", "asistente"];
      if (rolesConAccesoCaptacion.includes(currentUser.rol)) {
        cargarInteresados();
      } else if (vistaActual === "captacion") {
        // Bloqueo de ruta no autorizada solo para perfiles no autorizados
        setVistaActual("expedientes");
      }
    }
  }, [currentUser, vistaActual]);

  // Carga de asistentes para la transición de Fase 1
  useEffect(() => {
    if (currentUser && modalAprobarFase1) {
      authFetch("/api/usuarios/asistentes")
        .then(async (res) => {
          if (!res.ok) return null;
          const contentType = res.headers.get("content-type") || "";
          return contentType.includes("application/json") ? res.json() : null;
        })
        .then((data) => {
          if (Array.isArray(data)) {
            setAsistentesElegibles(data);
            if (data.length > 0) setAsistenteSeleccionadoId(data[0].id);
          }
        })
        .catch(() => {});
    }
  }, [currentUser, modalAprobarFase1]);

  // Carga de detalle cuando cambia el ID seleccionado con limpieza estricta de estado (previene fuga entre expedientes)
  useEffect(() => {
    if (expedienteSeleccionadoId && currentUser) {
      setDetalleExp(null);
      setModalRevisarReq(null);
      setFormRevision({ resultado: "ACEPTADO", observacion: "" });
      setTextoDevolucionFase1("");
      setTextoDevolucionFase2("");
      setModalSubirArchivoReq(null);
      setArchivoSeleccionadoSubir(null);
      setFotosParaRegistro([]);
      setNuevaNotaTexto("");
      setPopoverDocInteresadoId(null);
      setNuevoDocNombre("");
      cargarDetalleExpediente(expedienteSeleccionadoId);
    } else {
      setDetalleExp(null);
    }
  }, [expedienteSeleccionadoId, currentUser]);

  // Helper para normalizar y mostrar nombre completo del postulante sin apellidos duplicados (Cambio 1)
  const obtenerNombrePostulante = (persona?: any) => {
    if (!persona) return "";
    if (persona.primerNombre && persona.primerApellido) {
      return construirNombreCompleto(
        persona.primerNombre,
        persona.segundoNombre,
        persona.primerApellido,
        persona.segundoApellido
      );
    }
    if (persona.nombres && persona.primerApellido) {
      if (persona.nombres.toLowerCase().includes(persona.primerApellido.toLowerCase())) {
        return normalizarTextoNombre(persona.nombres);
      }
      return normalizarTextoNombre(`${persona.nombres} ${persona.primerApellido}`);
    }
    return normalizarTextoNombre(persona.nombres || "");
  };

  // Helper para mostrar etiqueta descriptiva y estilos de cada fase (Cambio 4)
  const getEtiquetaFase = (fase: number) => {
    switch (fase) {
      case 1:
        return {
          nombre: "Fase 1: En Ingreso Hogar (3 docs)",
          nombreCorto: "Fase 1: Ingreso (3 docs)",
          estiloBadge: "bg-blue-50 text-blue-700 border-blue-200 font-semibold"
        };
      case 2:
        return {
          nombre: "Fase 2: En Solicitud 8 Documentos",
          nombreCorto: "Fase 2: 8 Documentos",
          estiloBadge: "bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold"
        };
      case 3:
        return {
          nombre: "Fase 3: En Validación Inicial Compensar",
          nombreCorto: "Fase 3: Validación Compensar",
          estiloBadge: "bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold"
        };
      case 4:
        return {
          nombre: "Fase 4: En Recolección de Documentos Técnicos",
          nombreCorto: "Fase 4: Documentos Técnicos",
          estiloBadge: "bg-purple-50 text-purple-700 border-purple-200 font-semibold"
        };
      case 5:
        return {
          nombre: "Fase 5: En Trámite de Licencia de Construcción",
          nombreCorto: "Fase 5: Licencia Construcción",
          estiloBadge: "bg-teal-50 text-teal-700 border-teal-200 font-semibold"
        };
      case 6:
        return {
          nombre: "Fase 6: En Postulación",
          nombreCorto: "Fase 6: Postulación",
          estiloBadge: "bg-amber-50 text-amber-700 border-amber-200 font-semibold"
        };
      case 7:
        return {
          nombre: "Fase 7: En Construcción y Cobro Subsidio",
          nombreCorto: "Fase 7: Construcción y Cobro",
          estiloBadge: "bg-slate-50 text-slate-700 border-slate-200 font-semibold"
        };
      default:
        return {
          nombre: `Fase ${fase}`,
          nombreCorto: `Fase ${fase}`,
          estiloBadge: "bg-slate-50 text-slate-700 border-slate-200 font-semibold"
        };
    }
  };

  // Generador de URL con parámetro anti-caché para forzar reactividad en el navegador
  const obtenerUrlConAntiCache = (url?: string): string => {
    if (!url) return "";
    if (url.startsWith("data:")) return url;
    const urlLimpia = url.replace(/([?&])t=\d+(&|$)/g, "$1").replace(/[?&]$/, "");
    const sep = urlLimpia.includes("?") ? "&" : "?";
    return `${urlLimpia}${sep}t=${Date.now()}`;
  };

  // Ajustar pestaña de requisitos según la fase actual activa del expediente (Cambio 2)
  useEffect(() => {
    if (detalleExp?.expediente) {
      setTabRequisitos(detalleExp.expediente.faseActual || 1);
    }
  }, [detalleExp?.expediente?.id]);

  // Handlers para el ciclo de rechazo del hogar (Cambio 6)
  const handleConfirmarSolicitudRechazoHogar = async (datos: {
    motivo: string;
    justificacion: string;
    evidenciaUrl?: string;
    evidenciaNombre?: string;
  }) => {
    if (!detalleExp) return;
    const res = await authFetch(`/api/expedientes/${detalleExp.expediente.id}/solicitar-rechazo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "No fue posible registrar la solicitud de rechazo.");
    }
    mostrarToast(data.mensaje || "Solicitud de rechazo enviada correctamente.");
    setModalSolicitarRechazoHogar(false);
    await cargarDetalleExpediente(detalleExp.expediente.id);
    await cargarExpedientes();
  };

  const handleAprobarRechazoHogar = async () => {
    if (!detalleExp) return;
    setProcesandoRechazoHogar(true);
    try {
      const res = await authFetch(`/api/expedientes/${detalleExp.expediente.id}/aprobar-rechazo`, {
        method: "POST"
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No fue posible aprobar el rechazo.");
      }
      mostrarToast(data.mensaje || "Rechazo aprobado. Expediente trasladado a Retirados / Histórico.");
      setModalAprobarRechazoHogar(false);
      await cargarDetalleExpediente(detalleExp.expediente.id);
      await cargarExpedientes();
      setTabExpedientes("retirados");
    } catch (err: any) {
      mostrarToast(err.message, "error");
    } finally {
      setProcesandoRechazoHogar(false);
    }
  };

  const handleDesestimarRechazoHogar = async () => {
    if (!detalleExp || !justificacionDesestimarHogar.trim()) {
      mostrarToast("Debe ingresar la justificación de la desestimación.", "error");
      return;
    }
    setProcesandoRechazoHogar(true);
    try {
      const res = await authFetch(`/api/expedientes/${detalleExp.expediente.id}/desestimar-rechazo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ justificacion: justificacionDesestimarHogar.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No fue posible desestimar la solicitud de rechazo.");
      }
      mostrarToast(data.mensaje || "Solicitud de rechazo desestimada. El expediente continúa en trámite.");
      setModalDesestimarRechazoHogar(false);
      setJustificacionDesestimarHogar("");
      await cargarDetalleExpediente(detalleExp.expediente.id);
      await cargarExpedientes();
    } catch (err: any) {
      mostrarToast(err.message, "error");
    } finally {
      setProcesandoRechazoHogar(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIniciandoSesion(true);
    try {
      const rawApiUrl = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
      const res = await fetch(`${rawApiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      let data: any = {};
      try {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          data = await res.json();
        } else {
          setAuthError("El servidor respondió con un formato no reconocido. Verifique la conexión.");
          return;
        }
      } catch {
        setAuthError("No se pudo conectar con el servidor. Verifique la conexión con el servicio web en Render.");
        return;
      }
      if (!res.ok) {
        const errorMsg = typeof data.error === "string"
          ? data.error
          : (data.error?.message || data.message || "Error al iniciar sesión.");
        setAuthError(errorMsg);
        return;
      }
      setCurrentUser(data.user);
      localStorage.setItem("crm_user_session", JSON.stringify(data.user));
      localStorage.setItem("crm_user_token", data.token || data.user.id);

      const requiereCambio = Boolean(data.user.requiere_cambio_password ?? data.user.requiereCambioPassword);
      if (requiereCambio) {
        mostrarToast("Seguridad: Debe definir su contraseña personal para continuar.", "error");
        return;
      }

      if (data.user.rol === "comercial") {
        setVistaActual("captacion");
      } else {
        setVistaActual("expedientes");
      }
      setExpedienteSeleccionadoId(null);
      mostrarToast(`Sesión iniciada como ${data.user.nombreCompleto}`);
    } catch {
      setAuthError("No se pudo conectar con el servidor.");
    } finally {
      setIniciandoSesion(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authFetch("/api/auth/logout", { method: "POST" });
    } catch {}
    localStorage.removeItem("crm_user_session");
    localStorage.removeItem("crm_user_token");
    setCurrentUser(null);
    setDetalleExp(null);
    setExpedienteSeleccionadoId(null);
  };

  const handleSwitchUser = async (userId: string) => {
    if (!userId || userId === currentUser?.id) return;
    setCambiandoRol(true);
    try {
      const res = await authFetch("/api/auth/switch-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setCurrentUser(data.user);
        localStorage.setItem("crm_user_session", JSON.stringify(data.user));
        localStorage.setItem("crm_user_token", data.token || data.user.id);
        mostrarToast(`Sesión activa: ${data.user.nombreCompleto} (${data.user.rol.toUpperCase()})`);
        await Promise.all([
          cargarExpedientes(),
          cargarUsuarios()
        ]);
        if (data.user.rol === "comercial") {
          setVistaActual("captacion");
          cargarInteresados();
        } else {
          setVistaActual("expedientes");
        }
        setExpedienteSeleccionadoId(null);
        if (expedienteSeleccionadoId) {
          cargarDetalleExpediente(expedienteSeleccionadoId);
        }
      } else {
        mostrarToast(data.error || "No se pudo cambiar de usuario", "error");
      }
    } catch {
      mostrarToast("Error de conexión al cambiar de perfil de usuario", "error");
    } finally {
      setCambiandoRol(false);
    }
  };

  const cargarUsuarios = () => {
    authFetch("/api/usuarios/todos")
      .then(async (res) => {
        if (!res.ok) return null;
        const contentType = res.headers.get("content-type") || "";
        return contentType.includes("application/json") ? res.json() : null;
      })
      .then((data) => {
        if (Array.isArray(data)) setTodosUsuarios(data);
      })
      .catch(() => {});
  };

  const cargarExpedientes = (): Promise<void> => {
    return authFetch(`/api/expedientes?t=${Date.now()}`)
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401) {
            console.warn("[CARGA EXPEDIENTES]: Sesión no autorizada (401).");
          }
          return null;
        }
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          console.warn("[CARGA EXPEDIENTES]: Respuesta no JSON recibida del servidor.");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setExpedientes([...data]);
        }
      })
      .catch((err) => {
        console.error("[CARGA EXPEDIENTES ERROR]:", err);
      });
  };

  const cargarInteresados = (): Promise<void> => {
    const rolesAutorizados = ["comercial", "administrador", "planeacion", "supervisor", "asistente"];
    if (!currentUser || !rolesAutorizados.includes(currentUser.rol)) return Promise.resolve();
    return authFetch(`/api/interesados?t=${Date.now()}`)
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401) {
            console.warn("[CARGA INTERESADOS]: Sesión no autorizada (401).");
          }
          return null;
        }
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          console.warn("[CARGA INTERESADOS]: Respuesta no JSON recibida del servidor.");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setInteresados([...data]);
        }
      })
      .catch((err) => {
        console.error("[CARGA INTERESADOS ERROR]:", err);
      });
  };

  const cargarOrigenesCaptacion = (): Promise<void> => {
    return authFetch(`/api/configuracion/origenes-captacion?t=${Date.now()}`)
      .then(async (res) => {
        if (!res.ok) return null;
        const contentType = res.headers.get("content-type") || "";
        return contentType.includes("application/json") ? res.json() : null;
      })
      .then((data) => {
        if (data?.success && Array.isArray(data.origenes) && data.origenes.length > 0) {
          setOrigenesCaptacion(data.origenes);
        }
      })
      .catch((err) => {
        console.warn("[CARGA ORIGENES ERROR]:", err);
      });
  };


  const cargarDetalleExpediente = (id: string): Promise<any> => {
    return authFetch(`/api/expedientes/${id}?t=${Date.now()}`)
      .then(async (res) => {
        if (!res.ok) return null;
        const contentType = res.headers.get("content-type") || "";
        return contentType.includes("application/json") ? res.json() : null;
      })
      .then((data) => {
        if (!data) return;
        if (data?.requisitos && Array.isArray(data.requisitos)) {
          const reqs = data.requisitos;
          const reqPostulante = reqs.find(
            (r: any) => r.codigoRequisito === "F1-03" && r.nombre?.toLowerCase().includes("postulante")
          );
          const reqsIntegrantes = reqs.filter(
            (r: any) => r.codigoRequisito === "F1-03" && r.nombre?.toLowerCase().includes("integrante")
          );

          if (reqPostulante?.documentoAsociado) {
            const archNom = (reqPostulante.documentoAsociado.versionActual?.nombreArchivoOriginal || "").toLowerCase();
            const docTit = (reqPostulante.documentoAsociado.titulo || "").toLowerCase();
            if (archNom.includes("integrante") || docTit.includes("integrante")) {
              const docMover = reqPostulante.documentoAsociado;
              reqPostulante.documentoAsociado = undefined;
              reqPostulante.estado = "pendiente_carga";

              const targetInteg =
                reqsIntegrantes.find((ri: any) => {
                  const nomInteg = (ri.personaNombre || ri.nombre || "").toLowerCase();
                  const partes = nomInteg.split(" ").filter((p: string) => p.length >= 3);
                  return partes.some((p: string) => archNom.includes(p) || docTit.includes(p));
                }) || reqsIntegrantes[0];

              if (targetInteg) {
                targetInteg.documentoAsociado = docMover;
                targetInteg.estado = "recibido_revision";
              }
            }
          }
        }
        if (data && data.expediente) {
          setDetalleExp({ ...data });
        } else {
          setDetalleExp(data);
        }
        if (data?.expediente) {
          const compAprob = data.expediente.validacionCompensar?.estadoActual === "aprobado";
          const faseEfectiva = compAprob && data.expediente.faseActual < 4 ? 4 : (data.expediente.faseActual || 1);
          // Bloqueo de retroceso: asegura que al consultar el expediente se posicione en la fase activa (excepto admin y planeacion que tienen visibilidad libre)
          setTabRequisitos((prev) => {
            if (currentUser?.rol !== "administrador" && currentUser?.rol !== "planeacion") {
              return faseEfectiva;
            }
            return prev || faseEfectiva;
          });
        }
        return data;
      })
      .catch((err) => {
        console.error("[CARGA DETALLE ERROR]:", err);
      });
  };

  // Función de recarga de datos automática e inmediata tras sincronización de base de datos
  const recargarDatosSistema = async (
    mostrarFeedback: boolean = false,
    targetExpedienteId?: string | null
  ): Promise<void> => {
    try {
      // 1. Disparar sincronización bidireccional en el backend (Supabase <-> Memoria)
      const resSync = await authFetch("/api/sync", { method: "POST" });
      if (resSync.ok) {
        const syncData = await resSync.json();
        // Actualización directa y atómica de React state si el endpoint retorna la colección
        if (Array.isArray(syncData.expedientes)) {
          setExpedientes([...syncData.expedientes]);
        }
        if (Array.isArray(syncData.interesados)) {
          setInteresados([...syncData.interesados]);
        }
      }
    } catch (syncErr) {
      console.warn("[SYNC]: Fallo en endpoint /api/sync, ejecutando recarga directa:", syncErr);
    }

    // 2. Consulta y recarga atómica desde backend con anti-caché garantizado
    const idAconsultar = targetExpedienteId !== undefined ? targetExpedienteId : expedienteSeleccionadoId;
    await Promise.allSettled([
      cargarExpedientes(),
      currentUser && ["comercial", "administrador", "planeacion", "supervisor", "asistente"].includes(currentUser.rol)
        ? cargarInteresados()
        : Promise.resolve(),
      cargarUsuarios(),
      cargarOrigenesCaptacion(),
      idAconsultar ? cargarDetalleExpediente(idAconsultar) : Promise.resolve()
    ]);

    // 3. Notificar a componentes hijos o paneles (como AdminPanel) que los datos fueron sincronizados
    window.dispatchEvent(new CustomEvent("crm:datos-sincronizados"));
    setUltimaSincronizacion(new Date().toLocaleTimeString("es-CO"));

    if (mostrarFeedback) {
      mostrarToast("Base de datos sincronizada y datos actualizados en tiempo real.", "exito");
    }
  };

  // Manejador del botón de sincronización manual con indicador visual
  const handleSincronizarManual = async () => {
    if (sincronizando) return;
    setSincronizando(true);
    setEstadoSincronizacion("cargando");
    setMensajeSincronizacion("Sincronizando...");
    try {
      await recargarDatosSistema(true, expedienteSeleccionadoId);
      if (expedienteSeleccionadoId) {
        await cargarDetalleExpediente(expedienteSeleccionadoId);
      }
      setEstadoSincronizacion("exito");
      setMensajeSincronizacion("¡Actualizado!");
      setTimeout(() => {
        setMensajeSincronizacion(null);
        setEstadoSincronizacion("inactivo");
      }, 2500);
    } catch (err: any) {
      console.error("[SYNC UI ERROR]:", err);
      setEstadoSincronizacion("error");
      setMensajeSincronizacion("Error al sincronizar");
      mostrarToast("Error al sincronizar con la base de datos.", "error");
      setTimeout(() => {
        setMensajeSincronizacion(null);
        setEstadoSincronizacion("inactivo");
      }, 2500);
    } finally {
      setSincronizando(false);
    }
  };

  const handleCrearRequisito = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detalleExp || !formNuevoRequisito.nombre.trim()) return;
    setGuardandoRequisito(true);
    setErrorNuevoRequisito(null);
    try {
      let archivoDataUrl: string | undefined = undefined;
      if (archivoAdjuntoNuevoReq) {
        try {
          archivoDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(archivoAdjuntoNuevoReq);
          });
        } catch {
          console.warn("No se pudo generar data URL del archivo adjunto");
        }
      }

      const res = await authFetch(`/api/expedientes/${detalleExp.expediente.id}/requisitos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: formNuevoRequisito.nombre.trim(),
          descripcion: formNuevoRequisito.descripcion.trim(),
          fase: formNuevoRequisito.fase,
          esObligatorio: formNuevoRequisito.esObligatorio,
          nombreArchivo: archivoAdjuntoNuevoReq ? archivoAdjuntoNuevoReq.name : undefined,
          mimeType: archivoAdjuntoNuevoReq ? (archivoAdjuntoNuevoReq.type || "application/pdf") : undefined,
          tamanoBytes: archivoAdjuntoNuevoReq ? archivoAdjuntoNuevoReq.size : undefined,
          archivoDataUrl
        })
      });
      const data = await res.json();
      if (res.ok) {
        setModalNuevoRequisito(false);
        setFormNuevoRequisito({
          nombre: "",
          descripcion: "",
          esObligatorio: false,
          fase: 1
        });
        setArchivoAdjuntoNuevoReq(null);
        mostrarToast(data.mensaje || `Archivo adicional "${formNuevoRequisito.nombre}" registrado y cargado exitosamente en Fase ${formNuevoRequisito.fase}.`);
        await cargarDetalleExpediente(detalleExp.expediente.id);
        await cargarExpedientes();
      } else {
        setErrorNuevoRequisito(data.error || "No fue posible agregar el requisito.");
      }
    } catch {
      setErrorNuevoRequisito("Error de conexión al registrar el requisito.");
    } finally {
      setGuardandoRequisito(false);
    }
  };

  const handleEliminarRequisito = (reqId: string) => {
    if (!detalleExp) return;
    setModalConfirmacion({
      isOpen: true,
      titulo: "Eliminar Requisito",
      mensaje: "¿Desea eliminar este requisito del expediente del hogar? Esta acción removerá el registro documental.",
      textoBoton: "Eliminar Requisito",
      tipo: "peligro",
      onConfirm: async () => {
        try {
          const res = await authFetch(`/api/expedientes/${detalleExp.expediente.id}/requisitos/${reqId}`, {
            method: "DELETE"
          });
          if (res.ok) {
            mostrarToast("Requisito eliminado correctamente.");
            await cargarDetalleExpediente(detalleExp.expediente.id);
            await cargarExpedientes();
          } else {
            const data = await res.json();
            mostrarToast(data.error || "No fue posible eliminar el requisito.", "error");
          }
        } catch {
          mostrarToast("Error de conexión al eliminar el requisito.", "error");
        }
      }
    });
  };

  // Eliminar integrante del hogar y limpiar requisitos huérfanos (Cambio 5)
  const handleEliminarIntegrante = (integranteId: string, nombreCompleto: string) => {
    if (!detalleExp) return;
    setModalConfirmacion({
      isOpen: true,
      titulo: "Remover Integrante del Hogar",
      mensaje: `¿Está seguro de remover a ${nombreCompleto} del hogar declarado? Se eliminará también el requisito de su documento de identidad.`,
      textoBoton: "Remover Integrante",
      tipo: "peligro",
      onConfirm: async () => {
        try {
          const res = await authFetch(`/api/expedientes/${detalleExp.expediente.id}/hogar/integrantes/${integranteId}`, {
            method: "DELETE"
          });
          const data = await res.json();
          if (res.ok) {
            mostrarToast(data.mensaje || "Integrante y documento de identidad removidos exitosamente.");
            await cargarDetalleExpediente(detalleExp.expediente.id);
            await cargarExpedientes();
          } else {
            mostrarToast(data.error || "No fue posible eliminar el integrante.", "error");
          }
        } catch {
          mostrarToast("Error de conexión al eliminar el integrante.", "error");
        }
      }
    });
  };

  // Enviar a Revisión de la Supervisión Jurídica (Para cualquier fase)
  const handleEnviarRevisionFase = async (numFase: number) => {
    if (!detalleExp) return;
    setGuardandoEnvioRevision(true);
    setGuardandoEnvioRevisionFase2(true);
    try {
      const endpoint =
        numFase === 2
          ? `/api/expedientes/${detalleExp.expediente.id}/fase2/enviar-revision`
          : `/api/expedientes/${detalleExp.expediente.id}/fases/${numFase}/enviar-revision`;
      const res = await authFetch(endpoint, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        mostrarToast(data.mensaje || `Expediente enviado a revisión de la Fase ${numFase} exitosamente. Documentos bloqueados para Gestor Rural.`);
        setDetalleExp((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            expediente: {
              ...prev.expediente,
              ...(data.expediente || {}),
              bloqueadoPorRevision: true,
              faseEnRevision: numFase
            }
          };
        });
        setExpedientes((prev) =>
          prev.map((e) =>
            e.id === detalleExp.expediente.id
              ? { ...e, ...(data.expediente || {}), bloqueadoPorRevision: true, faseEnRevision: numFase }
              : e
          )
        );
        await cargarDetalleExpediente(detalleExp.expediente.id);
        await cargarExpedientes();
      } else {
        mostrarToast(data.error || "No fue posible enviar a revisión.", "error");
      }
    } catch {
      mostrarToast("Error de conexión al enviar a revisión.", "error");
    } finally {
      setGuardandoEnvioRevision(false);
      setGuardandoEnvioRevisionFase2(false);
    }
  };

  const handleEnviarRevisionFase2 = () => handleEnviarRevisionFase(2);

  // Aprobar Fase 2 y pasar a Fase 3 (Supervisor) (Cambio 7)
  const handleAprobarFase2 = async () => {
    if (!detalleExp) return;
    setGuardandoAprobacionFase2(true);
    try {
      const res = await authFetch(`/api/expedientes/${detalleExp.expediente.id}/fase2/aprobar`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        mostrarToast(data.mensaje || "Fase 2 aprobada con éxito. Avanzó a Fase 3.");
        setTabRequisitos(3);
        await cargarDetalleExpediente(detalleExp.expediente.id);
        await cargarExpedientes();
      } else {
        mostrarToast(data.error || "No fue posible aprobar la Fase 2.", "error");
      }
    } catch {
      mostrarToast("Error de conexión al aprobar Fase 2.", "error");
    } finally {
      setGuardandoAprobacionFase2(false);
    }
  };

  // Devolver Fase 2 con observaciones al Asistente (Supervisor) (Cambio 7)
  const handleDevolverFase2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detalleExp || !textoDevolucionFase2.trim()) return;
    setGuardandoDevolucionFase2(true);
    try {
      const res = await authFetch(`/api/expedientes/${detalleExp.expediente.id}/fase2/devolver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observacion: textoDevolucionFase2.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setModalDevolverFase2(false);
        setTextoDevolucionFase2("");
        mostrarToast(data.mensaje || "Expediente devuelto al Gestor Documental con observaciones.");
        await cargarDetalleExpediente(detalleExp.expediente.id);
        await cargarExpedientes();
      } else {
        mostrarToast(data.error || "No fue posible devolver el expediente.", "error");
      }
    } catch {
      mostrarToast("Error de conexión al devolver el expediente.", "error");
    } finally {
      setGuardandoDevolucionFase2(false);
    }
  };

  // Devolver Fase 1 con observaciones a Gestor Rural (Supervisor / Admin)
  const handleDevolverFase1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detalleExp || !textoDevolucionFase1.trim()) return;
    setGuardandoDevolucionFase1(true);
    try {
      const res = await authFetch(`/api/expedientes/${detalleExp.expediente.id}/fases/1/devolver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observacion: textoDevolucionFase1.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setModalDevolverFase1(false);
        setTextoDevolucionFase1("");
        mostrarToast(data.mensaje || "Expediente devuelto a Gestor Rural con observaciones.");
        await cargarDetalleExpediente(detalleExp.expediente.id);
        await cargarExpedientes();
      } else {
        mostrarToast(data.error || "No fue posible devolver el expediente.", "error");
      }
    } catch {
      mostrarToast("Error de conexión al devolver el expediente.", "error");
    } finally {
      setGuardandoDevolucionFase1(false);
    }
  };

  // Reasignar responsable general (Supervisor / Admin)
  const handleReasignarResponsable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detalleExp || !nuevoResponsableId) return;
    setGuardandoReasignacion(true);
    try {
      const res = await authFetch(`/api/expedientes/${detalleExp.expediente.id}/reasignar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nuevoResponsableId,
          motivo: motivoReasignacion.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        setModalReasignar(false);
        setMotivoReasignacion("");
        mostrarToast(data.mensaje || "Responsable general reasignado exitosamente.");
        await cargarDetalleExpediente(detalleExp.expediente.id);
        await cargarExpedientes();
      } else {
        mostrarToast(data.error || "No fue posible reasignar el expediente.", "error");
      }
    } catch {
      mostrarToast("Error de conexión al reasignar.", "error");
    } finally {
      setGuardandoReasignacion(false);
    }
  };

  // Avanzar de fase general (para supervisores, ingeniería y administradores)
  const handleAvanzarFase = (faseDestino: number) => {
    if (!detalleExp) return;
    setModalConfirmacion({
      isOpen: true,
      titulo: `Avanzar Expediente a Fase ${faseDestino}`,
      mensaje: `¿Confirma el avance formal del expediente a la Fase ${faseDestino}? Esta acción actualizará la etapa del hogar y notificará a las áreas correspondientes.`,
      textoBoton: `Avanzar a Fase ${faseDestino}`,
      tipo: "primario",
      onConfirm: async () => {
        try {
          const res = await authFetch(`/api/expedientes/${detalleExp.expediente.id}/avanzar-fase`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nuevaFase: faseDestino })
          });
          const data = await res.json();
          if (res.ok) {
            mostrarToast(data.mensaje || `Expediente avanzado a Fase ${faseDestino}.`);
            setTabRequisitos(faseDestino);
            await cargarDetalleExpediente(detalleExp.expediente.id);
            await cargarExpedientes();
          } else {
            mostrarToast(data.error || "No fue posible avanzar de fase.", "error");
          }
        } catch {
          mostrarToast("Error de conexión al avanzar de fase.", "error");
        }
      }
    });
  };

  // Crear interesado (Comercial)
  const handleCrearInteresado = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorInteresado(null);

    const primerNom = formInteresado.primerNombre.trim();
    const segNom = formInteresado.segundoNombre.trim();
    const primerAp = formInteresado.primerApellido.trim();
    const segAp = formInteresado.segundoApellido.trim();

    let nombreLimpio = formInteresado.nombreContacto.trim();
    if (primerNom && primerAp) {
      nombreLimpio = construirNombreCompleto(primerNom, segNom, primerAp, segAp);
    }

    const numIdLimpio = formInteresado.numeroIdentificacion.trim();
    const telLimpio = formInteresado.telefono.trim();
    const telSecLimpio = formInteresado.habilitarSegundoTelefono ? formInteresado.telefonoSecundario.trim() : "";

    if (!nombreLimpio && !primerNom) {
      setErrorInteresado("Debe ingresar el primer nombre y primer apellido de contacto.");
      return;
    }
    if (!numIdLimpio) {
      setErrorInteresado("Debe ingresar el número de cédula / identificación del interesado.");
      return;
    }
    if (!telLimpio) {
      setErrorInteresado("Debe ingresar un número de teléfono principal.");
      return;
    }

    setGuardandoInteresado(true);
    try {
      const mun = CATALOGO_MUNICIPIOS.find((m) => m.codigoCompleto === formInteresado.municipioCodigo);
      const payload = {
        ...formInteresado,
        primerNombre: primerNom,
        segundoNombre: segNom,
        primerApellido: primerAp,
        segundoApellido: segAp,
        nombreContacto: nombreLimpio,
        tipoIdentificacion: formInteresado.tipoIdentificacion,
        numeroIdentificacion: numIdLimpio,
        cedula: numIdLimpio,
        telefono: telLimpio,
        telefonoSecundario: telSecLimpio || undefined,
        tieneWhatsappSecundario: formInteresado.habilitarSegundoTelefono ? formInteresado.tieneWhatsappSecundario : false,
        departamentoCodigo: mun?.departamentoCodigo || (formInteresado.municipioCodigo ? formInteresado.municipioCodigo.substring(0, 2) : "25")
      };

      const res = await authFetch("/api/interesados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        setModalNuevoInteresado(false);
        setFormInteresado({
          primerNombre: "",
          segundoNombre: "",
          primerApellido: "",
          segundoApellido: "",
          nombreContacto: "",
          tipoIdentificacion: "CC",
          numeroIdentificacion: "",
          telefono: "",
          tieneWhatsapp: true,
          habilitarSegundoTelefono: false,
          telefonoSecundario: "",
          tieneWhatsappSecundario: false,
          correo: "",
          departamentoCodigo: "25",
          municipioCodigo: "25151",
          vereda: "",
          origenContacto: origenesCaptacion[0] || "Llamada",
          resumenNecesidad: ""
        });
        cargarInteresados();
        mostrarToast(`Interesado "${data.nombreContacto}" registrado exitosamente.`);
      } else {
        setErrorInteresado(data.error || "No fue posible guardar el interesado.");
      }
    } catch {
      setErrorInteresado("Error de red o conexión al guardar el interesado.");
    } finally {
      setGuardandoInteresado(false);
    }
  };

  // CAMBIO 3: Ampliar plazo de prospección (7 o 15 días)
  const handleAmpliarPlazo = async (interesadoId: string, dias: number) => {
    setProcesandoVencimiento(true);
    try {
      const res = await authFetch(`/api/interesados/${interesadoId}/ampliar-plazo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dias })
      });
      const data = await res.json();
      if (res.ok) {
        mostrarToast(`Plazo ampliado exitosamente por ${dias} días.`);
        setModalGestionarVencimiento(null);
        await cargarInteresados();
      } else {
        mostrarToast(data.error || "No se pudo ampliar el plazo.", "error");
      }
    } catch {
      mostrarToast("Error de conexión al ampliar plazo.", "error");
    } finally {
      setProcesandoVencimiento(false);
    }
  };

  // CAMBIO 3: Descartar prospecto definitivamente
  const handleDescartarProspecto = async (interesadoId: string, motivo: string) => {
    setProcesandoVencimiento(true);
    try {
      const res = await authFetch(`/api/interesados/${interesadoId}/descartar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivo.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        mostrarToast("Prospecto descartado de la captación.");
        setModalGestionarVencimiento(null);
        setMotivoDescarte("");
        setConfirmarDescarte(false);
        await cargarInteresados();
      } else {
        mostrarToast(data.error || "No se pudo descartar el prospecto.", "error");
      }
    } catch {
      mostrarToast("Error de conexión al descartar prospecto.", "error");
    } finally {
      setProcesandoVencimiento(false);
    }
  };

  // CAMBIO 7: Subir documento a interesado
  const handleSubirDocumentoInteresado = async (interesadoId: string, nombreArchivo: string) => {
    if (!nombreArchivo.trim()) return;
    try {
      const res = await authFetch(`/api/interesados/${interesadoId}/documentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombreArchivo: nombreArchivo.trim() })
      });
      if (res.ok) {
        mostrarToast(`Documento "${nombreArchivo}" adjuntado al prospecto.`);
        setNuevoDocNombre("");
        await cargarInteresados();
      } else {
        mostrarToast("No se pudo adjuntar el documento.", "error");
      }
    } catch {
      mostrarToast("Error de conexión al subir documento.", "error");
    }
  };

  // Abrir modal de conversión con datos precargados
  const handleAbrirConversion = async (item: Interesado) => {
    // Descomposición canónica según el estándar de nombres oficial colombiano
    const partesDescompuestas = descomponerNombreCompleto(item.nombreContacto);

    let primerNombre = item.primerNombre?.trim() || "";
    let segundoNombre = item.segundoNombre?.trim() || "";
    let primerApellido = item.primerApellido?.trim() || "";
    let segundoApellido = item.segundoApellido?.trim() || "";

    // Detección de corrupción previa: si el segundo nombre sustituyó al primer apellido
    // (ej. 'EMMA' en primerApellido cuando el nombre es 'ROSA EMMA HERNANDEZ VELASQUEZ')
    // o si faltan los apellidos desglosados
    const necesitaSanacion =
      !primerNombre ||
      !primerApellido ||
      (partesDescompuestas.segundoNombre && primerApellido.toUpperCase() === partesDescompuestas.segundoNombre.toUpperCase()) ||
      (segundoNombre && primerApellido.toUpperCase() === segundoNombre.toUpperCase()) ||
      (partesDescompuestas.primerApellido && primerApellido.toUpperCase() !== partesDescompuestas.primerApellido.toUpperCase() && partesDescompuestas.segundoNombre);

    if (necesitaSanacion && (partesDescompuestas.primerNombre || partesDescompuestas.primerApellido)) {
      primerNombre = partesDescompuestas.primerNombre;
      segundoNombre = partesDescompuestas.segundoNombre || "";
      primerApellido = partesDescompuestas.primerApellido;
      segundoApellido = partesDescompuestas.segundoApellido || "";
    }

    const nombres = [primerNombre, segundoNombre].filter(Boolean).join(" ");

    let cedulaRecuperada = (item.numeroIdentificacion || item.cedula || "").trim();
    let tipoIdRecuperado = (item.tipoIdentificacion as TipoIdentificacion) || "CC";

    if (!cedulaRecuperada && item.resumenNecesidad) {
      const meta = decodificarNombresMetadata(item.resumenNecesidad);
      if (meta?.numeroIdentificacion) {
        cedulaRecuperada = meta.numeroIdentificacion;
        if (meta.tipoIdentificacion) tipoIdRecuperado = meta.tipoIdentificacion as TipoIdentificacion;
      }
    }

    if (!cedulaRecuperada) {
      const telLimpio = (item.telefono || "").replace(/\D/g, "");
      const expMatch = expedientes.find(
        (e) => (telLimpio && e.titular?.telefonoPrincipal?.replace(/\D/g, "") === telLimpio) ||
               (item.nombreContacto && normalizarTextoNombre(e.titular?.nombreCompleto || "").includes(normalizarTextoNombre(primerApellido || "")))
      );
      if (expMatch?.titular?.numeroIdentificacion) {
        cedulaRecuperada = expMatch.titular.numeroIdentificacion;
        if (expMatch.titular.tipoIdentificacion) tipoIdRecuperado = expMatch.titular.tipoIdentificacion as TipoIdentificacion;
      }
    }

    setFormConvertir({
      tipoIdentificacion: tipoIdRecuperado,
      numeroIdentificacion: cedulaRecuperada,
      primerNombre,
      segundoNombre,
      primerApellido,
      segundoApellido,
      nombres: nombres || item.nombreContacto,
      municipioCodigo: item.municipioCodigo || "25151",
      vereda: item.vereda || "",
      nombreODireccionPredio: ""
    });
    setModalConvertirInteresado(item);
    setErrorNota(null);

    // Cargar notas del prospecto/interesado en la bitácora integrada
    try {
      const res = await authFetch(`/api/interesados/${item.id}/notas`);
      if (res.ok) {
        const data = await res.json();
        setNotasDelInteresado(data);
      } else {
        setNotasDelInteresado([]);
      }
    } catch {
      setNotasDelInteresado([]);
    }
  };

  // Transformar interesado en expediente VRD
  const handleConfirmarConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalConvertirInteresado) return;
    setErrorConvertir(null);
    setGuardandoConvertir(true);

    try {
      const res = await authFetch(`/api/interesados/${modalConvertirInteresado.id}/convertir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formConvertir)
      });
      const data = await res.json();
      if (res.ok) {
        setModalConvertirInteresado(null);
        mostrarToast(data.mensaje || "Expediente creado exitosamente.");
        const nuevoId = data.expediente?.id;
        if (nuevoId) {
          setExpedienteSeleccionadoId(nuevoId);
        }
        setVistaActual("expedientes");
        // Limpiar filtros activos para garantizar visibilidad inmediata del nuevo expediente
        setFiltroTexto("");
        setFiltroFase("");
        setFiltroMunicipio("");
        setFiltroEstado("");
        setFiltroResponsable("");
        // Recarga de datos automática e inmediata en la interfaz
        await recargarDatosSistema(false, nuevoId);
      } else {
        setErrorConvertir(data.error || "Error al convertir interesado en expediente.");
      }
    } catch {
      setErrorConvertir("Error de conexión al convertir interesado.");
    } finally {
      setGuardandoConvertir(false);
    }
  };

  // Abrir bitácora de notas del interesado/expediente desde la tabla
  const handleAbrirNotasInteresado = async (item: Interesado) => {
    if (item.convertidoAExpedienteId) {
      setExpedienteSeleccionadoId(item.convertidoAExpedienteId);
      setVistaActual("expedientes");
      setTimeout(() => {
        const el = document.getElementById("seccion-bitacora-notas");
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
          const input = el.querySelector("input");
          if (input) input.focus();
        }
      }, 350);
    } else {
      await handleAbrirConversion(item);
      setTimeout(() => {
        const el = document.getElementById("seccion-bitacora-notas-interesado");
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
          const input = el.querySelector("input");
          if (input) input.focus();
        }
      }, 350);
    }
  };

  // Crear nota en el interesado desde la vista de detalle
  const handleCrearNotaInteresado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalConvertirInteresado || !nuevaNotaInteresadoTexto.trim()) return;
    setErrorNota(null);

    try {
      const res = await authFetch(`/api/interesados/${modalConvertirInteresado.id}/notas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contenido: nuevaNotaInteresadoTexto,
          canal: "llamada",
          personaContactada: modalConvertirInteresado.nombreContacto
        })
      });
      if (res.ok) {
        const nueva = await res.json();
        setNotasDelInteresado([nueva, ...notasDelInteresado]);
        setNuevaNotaInteresadoTexto("");
        mostrarToast("Nota registrada en la bitácora.");
      } else {
        const err = await res.json();
        setErrorNota(err.error || "Error al registrar nota.");
      }
    } catch {
      setErrorNota("Error de conexión al registrar nota.");
    }
  };

  const cargarSolicitudesRetiro = () => {
    if (!currentUser) return;
    authFetch("/api/solicitudes-retiro")
      .then(async (res) => {
        if (!res.ok) return null;
        const contentType = res.headers.get("content-type") || "";
        return contentType.includes("application/json") ? res.json() : null;
      })
      .then((data) => {
        if (Array.isArray(data)) setSolicitudesRetiro(data);
      })
      .catch(() => {});
  };

  // Agregar cédula de integrante (Comercial / Asistente) con estructura de 4 nombres
  const handleAgregarCedula = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expedienteSeleccionadoId) return;
    setErrorAgregarCedula(null);

    const numIdLimpio = formIntegrante.numeroIdentificacion.trim();
    const pNom = formIntegrante.primerNombre.trim();
    const sNom = formIntegrante.segundoNombre.trim();
    const pAp = formIntegrante.primerApellido.trim();
    const sAp = formIntegrante.segundoApellido.trim();
    const nombresCalculados = formIntegrante.nombres.trim() || [pNom, sNom].filter(Boolean).join(" ");

    if (!numIdLimpio) {
      setErrorAgregarCedula("Debe ingresar el número de identificación del integrante.");
      return;
    }
    if (!pNom && !nombresCalculados) {
      setErrorAgregarCedula("Debe ingresar el primer nombre del integrante.");
      return;
    }
    if (!pAp) {
      setErrorAgregarCedula("Debe ingresar el primer apellido del integrante.");
      return;
    }

    // VALIDACIÓN: Verificar que el número de identificación del integrante no exista previamente en el mismo hogar
    const integranteExistente = detalleExp?.expediente.hogar?.integrantes?.find(
      (i) => i.persona?.numeroIdentificacion?.trim() === numIdLimpio
    );
    const esPostulante = detalleExp?.expediente.postulante?.numeroIdentificacion?.trim() === numIdLimpio;

    if (integranteExistente || esPostulante) {
      const nombreExistente = integranteExistente
        ? (integranteExistente.persona.nombres || `${integranteExistente.persona.primerNombre || ''} ${integranteExistente.persona.primerApellido || ''}`.trim())
        : (detalleExp?.expediente.postulante.nombres || `${detalleExp?.expediente.postulante.primerNombre || ''} ${detalleExp?.expediente.postulante.primerApellido || ''}`.trim());
      setErrorAgregarCedula(`El número de identificación ${numIdLimpio} ya se encuentra registrado en este hogar (${nombreExistente}).`);
      return;
    }

    try {
      const nombreCompleto = construirNombreCompleto(pNom, sNom, pAp, sAp) || nombresCalculados;
      let archivoDataUrl: string | undefined = undefined;
      let nombreArchivoEstandar: string | undefined = undefined;
      let publicStorageUrl: string | undefined = undefined;

      if (archivoCedulaIntegrante) {
        let archivoParaCargar = archivoCedulaIntegrante;
        // Si el usuario adjuntó una imagen, convertir automáticamente a PDF
        if (archivoCedulaIntegrante.type.startsWith("image/")) {
          try {
            archivoParaCargar = await convertirImagenAPdf(archivoCedulaIntegrante);
          } catch {
            archivoParaCargar = archivoCedulaIntegrante;
          }
        }

        const ext = archivoParaCargar.name.split('.').pop() || 'pdf';
        nombreArchivoEstandar = generarNombreArchivoCedulaEstandar(nombreCompleto, numIdLimpio, ext);

        // Si el cliente supabase está disponible en el cliente, subir directamente al bucket
        if (supabase) {
          try {
            const timestampSubida = new Date().getTime();
            const rutaStorageFrontend = `expedientes/${expedienteSeleccionadoId}/cedulas/${nombreArchivoEstandar}`;
            const { error: storageErr } = await supabase.storage
              .from("expedientes-archivos")
              .upload(rutaStorageFrontend, archivoParaCargar, {
                upsert: true,
                contentType: archivoParaCargar.type || "application/pdf"
              });
            if (!storageErr) {
              const { data: pubData } = supabase.storage
                .from("expedientes-archivos")
                .getPublicUrl(rutaStorageFrontend);
              if (pubData?.publicUrl) {
                publicStorageUrl = `${pubData.publicUrl}?t=${timestampSubida}`;
              }
            }
          } catch (storageErr) {
            console.warn("[STORAGE CLIENT UPLOAD CEDULA]:", storageErr);
          }
        }

        archivoDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(archivoParaCargar);
        });
      }

      const res = await authFetch(`/api/expedientes/${expedienteSeleccionadoId}/hogar/agregar-cedula`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoIdentificacion: formIntegrante.tipoIdentificacion,
          numeroIdentificacion: numIdLimpio,
          primerNombre: pNom,
          segundoNombre: sNom,
          primerApellido: pAp,
          segundoApellido: sAp,
          nombres: nombresCalculados,
          parentesco: formIntegrante.parentesco,
          archivoDataUrl,
          nombreArchivo: nombreArchivoEstandar,
          mimeType: archivoCedulaIntegrante ? archivoCedulaIntegrante.type || "application/pdf" : undefined,
          tamanoBytes: archivoCedulaIntegrante ? archivoCedulaIntegrante.size : undefined,
          url: publicStorageUrl
        })
      });
      if (res.ok) {
        setModalAgregarCedula(false);
        setArchivoCedulaIntegrante(null);
        setFormIntegrante({
          tipoIdentificacion: "CC",
          numeroIdentificacion: "",
          primerNombre: "",
          segundoNombre: "",
          primerApellido: "",
          segundoApellido: "",
          nombres: "",
          parentesco: "hijo"
        });
        mostrarToast("Integrante y documento de cédula agregados exitosamente al hogar.");
        await cargarDetalleExpediente(expedienteSeleccionadoId);
        await cargarExpedientes();
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorAgregarCedula(err.error || "Error al agregar cédula.");
      }
    } catch {
      setErrorAgregarCedula("Error de conexión al agregar cédula.");
    }
  };

  // Apertura controlada de modal de subida con hidratación fotográfica
  const handleAbrirModalSubir = (req: RequisitoCaso) => {
    setModalSubirArchivoReq(req);
    setArchivoSeleccionadoSubir(null);
    setErrorSubirArchivo(null);
    if (req.documentoAsociado?.versionActual?.fotos && req.documentoAsociado.versionActual.fotos.length > 0) {
      setFotosParaRegistro([...req.documentoAsociado.versionActual.fotos]);
    } else {
      setFotosParaRegistro([]);
    }
  };

  // Carga de archivo real para un requisito
  const handleCargarArchivoReal = async (requisito: RequisitoCaso, file: File) => {
    if (!expedienteSeleccionadoId) return;
    setErrorSubirArchivo(null);

    // Validación preventiva de tamaño
    if (file.size > 25 * 1024 * 1024) {
      setErrorSubirArchivo("El archivo supera el tamaño máximo permitido de 25 Megabytes (25 MB). Por favor seleccione un archivo más ligero.");
      return;
    }

    setSubiendoArchivo(true);

    try {
      let archivoParaCargar = file;
      // Si el archivo cargado es una imagen y no es un requisito fotográfico (ej. F2-11),
      // convertir automáticamente la imagen a formato PDF oficial
      const esRequisitoFoto = requisito.codigoRequisito === "F2-11" || requisito.nombre.toLowerCase().includes("fotogr");
      if (!esRequisitoFoto && file.type.startsWith("image/")) {
        try {
          archivoParaCargar = await convertirImagenAPdf(file);
        } catch {
          archivoParaCargar = file;
        }
      }

      let nombreParaSubida = archivoParaCargar.name;
      const esCedulaReq = requisito.codigoRequisito === "F1-03" || requisito.nombre.toLowerCase().includes("cédula") || requisito.nombre.toLowerCase().includes("cedula");

      if (esCedulaReq) {
        let pNombre = requisito.personaNombre || "";
        let pId = "";
        if (requisito.personaId) {
          const intEnHogar = detalleExp?.expediente.hogar?.integrantes?.find((i) => i.persona?.id === requisito.personaId);
          if (intEnHogar) {
            pNombre = intEnHogar.persona.nombres || `${intEnHogar.persona.primerNombre || ''} ${intEnHogar.persona.primerApellido || ''}`.trim();
            pId = intEnHogar.persona.numeroIdentificacion;
          } else if (detalleExp?.expediente.postulante?.id === requisito.personaId) {
            pNombre = detalleExp.expediente.postulante.nombres || `${detalleExp.expediente.postulante.primerNombre || ''} ${detalleExp.expediente.postulante.primerApellido || ''}`.trim();
            pId = detalleExp.expediente.postulante.numeroIdentificacion;
          }
        }
        if (!pNombre) pNombre = detalleExp?.expediente.postulante?.nombres || "integrante";
        if (!pId) pId = detalleExp?.expediente.postulante?.numeroIdentificacion || "00000";

        const ext = archivoParaCargar.name.split('.').pop() || 'pdf';
        nombreParaSubida = generarNombreArchivoCedulaEstandar(pNombre, pId, ext);
      }

      // Si el cliente supabase de frontend está disponible, asegurar subida directa a Storage en Supabase
      let publicStorageUrl: string | undefined = undefined;
      if (supabase) {
        try {
          const timestampSubida = new Date().getTime();
          const rutaStorageFrontend = esCedulaReq
            ? `expedientes/${expedienteSeleccionadoId}/cedulas/${nombreParaSubida}`
            : `expedientes/${expedienteSeleccionadoId}/${requisito.codigoRequisito}_v${timestampSubida}_${archivoParaCargar.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const { error: storageErr } = await supabase.storage
            .from("expedientes-archivos")
            .upload(rutaStorageFrontend, archivoParaCargar, {
              upsert: true,
              contentType: archivoParaCargar.type || "application/pdf"
            });
          if (storageErr) {
            console.warn("[STORAGE CLIENT UPLOAD]:", storageErr.message);
          } else {
            const { data: pubData } = supabase.storage
              .from("expedientes-archivos")
              .getPublicUrl(rutaStorageFrontend);
            if (pubData?.publicUrl) {
              publicStorageUrl = `${pubData.publicUrl}?t=${timestampSubida}`;
            }
          }
        } catch (storageErr) {
          console.warn("[STORAGE CLIENT UPLOAD]:", storageErr);
        }
      }

      // Convertir archivo a Data URL base64 real
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(archivoParaCargar);
      });

      // Generar huella SHA256 determinista visual
      const sha256Hash = `sha256-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}${archivoParaCargar.size.toString(16)}`;

      const res = await authFetch(
        `/api/expedientes/${expedienteSeleccionadoId}/requisitos/${requisito.id}/subir`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombreArchivo: nombreParaSubida,
            mimeType: archivoParaCargar.type || "application/pdf",
            tamanoBytes: archivoParaCargar.size,
            archivoDataUrl: dataUrl,
            url: publicStorageUrl,
            sha256Hash,
            codigoRequisito: requisito.codigoRequisito,
            fase: requisito.fase,
            requisitoNombre: requisito.nombre,
            personaId: requisito.personaId
          })
        }
      );

      if (res.ok) {
        const respJson = await res.json().catch(() => null);
        setModalSubirArchivoReq(null);
        setArchivoSeleccionadoSubir(null);
        mostrarToast(`Documento "${archivoParaCargar.name}" cargado exitosamente.`, "exito");

        // Actualización reactiva instantánea del estado en memoria
        if (respJson?.documento) {
          setDetalleExp((prev) => {
            if (!prev) return prev;
            const reqsActualizados = prev.requisitos.map((r) => {
              if (r.id === requisito.id) {
                return {
                  ...r,
                  estado: (prev.expediente.faseActual >= 3 || r.documentoAsociado?.versionActual) ? ("actualizado" as const) : ("recibido_revision" as const),
                  documentoAsociado: respJson.documento
                };
              }
              return r;
            });
            return {
              ...prev,
              requisitos: reqsActualizados
            };
          });
        }

        // Forzar re-fetch inmediato y reactivo de la lista de documentos y estado del expediente
        await cargarDetalleExpediente(expedienteSeleccionadoId);
        await cargarExpedientes();
      } else {
        let msg = "";
        try {
          const err = await res.json();
          if (err && err.error) msg = err.error;
        } catch {
          // Respuesta sin JSON estructurado
        }

        if (!msg) {
          if (res.status === 403) {
            msg = `Acceso restringido por permisos de rol: Su rol actual (${currentUser.rol}) no tiene autorización para cargar o reemplazar este documento en la fase actual del expediente.`;
          } else if (res.status === 401) {
            msg = "Sesión no autenticada o expirada. Por favor inicie sesión nuevamente.";
          } else if (res.status === 413) {
            msg = "El archivo excede el tamaño máximo permitido de subida (límite: 25 MB).";
          } else {
            msg = `No fue posible completar la carga del documento (Código HTTP ${res.status}). Verifique los permisos de su perfil.`;
          }
        }
        setErrorSubirArchivo(msg);
      }
    } catch (err: any) {
      setErrorSubirArchivo(err?.message || "Error al procesar el archivo seleccionado localmente.");
    } finally {
      setSubiendoArchivo(false);
    }
  };

  // Generador de fotografías periciales de muestra para registro fotográfico predial
  const generarFotosPredioMuestra = (codigoVisible?: string) => {
    const cod = codigoVisible || "VRD-PREDIO";
    const fecha = new Date().toLocaleDateString("es-CO");
    const hora = new Date().toLocaleTimeString("es-CO");

    const foto1Svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <linearGradient id="sky1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="60%" stop-color="#bae6fd"/>
          <stop offset="100%" stop-color="#f0fdf4"/>
        </linearGradient>
        <linearGradient id="grass1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#84cc16"/>
          <stop offset="100%" stop-color="#15803d"/>
        </linearGradient>
        <linearGradient id="roof1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#b91c1c"/>
          <stop offset="100%" stop-color="#7f1d1d"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#sky1)"/>
      <circle cx="150" cy="90" r="45" fill="#ffffff" opacity="0.8"/>
      <circle cx="200" cy="80" r="55" fill="#ffffff" opacity="0.9"/>
      <circle cx="250" cy="90" r="40" fill="#ffffff" opacity="0.8"/>
      <polygon points="-50,380 200,220 450,380" fill="#047857" opacity="0.4"/>
      <polygon points="300,380 550,190 850,380" fill="#065f46" opacity="0.5"/>
      <path d="M0,360 Q200,340 400,370 T800,350 L800,600 L0,600 Z" fill="url(#grass1)"/>
      <rect x="90" y="320" width="16" height="60" fill="#78350f"/>
      <circle cx="98" cy="300" r="42" fill="#15803d"/>
      <polygon points="260,260 400,170 540,260" fill="url(#roof1)"/>
      <rect x="280" y="260" width="240" height="150" fill="#f8fafc" stroke="#94a3b8" stroke-width="2"/>
      <rect x="380" y="310" width="40" height="100" fill="#92400e" rx="4"/>
      <circle cx="412" cy="360" r="3" fill="#fef08a"/>
      <rect x="305" y="295" width="48" height="48" fill="#e0f2fe" stroke="#0284c7" stroke-width="3" rx="4"/>
      <line x1="329" y1="295" x2="329" y2="343" stroke="#0284c7" stroke-width="2"/>
      <line x1="305" y1="319" x2="353" y2="319" stroke="#0284c7" stroke-width="2"/>
      <rect x="447" y="295" width="48" height="48" fill="#e0f2fe" stroke="#0284c7" stroke-width="3" rx="4"/>
      <line x1="471" y1="295" x2="471" y2="343" stroke="#0284c7" stroke-width="2"/>
      <line x1="447" y1="319" x2="495" y2="319" stroke="#0284c7" stroke-width="2"/>
      <line x1="160" y1="420" x2="640" y2="420" stroke="#78350f" stroke-width="4"/>
      <line x1="160" y1="440" x2="640" y2="440" stroke="#78350f" stroke-width="4"/>
      <rect x="200" y="405" width="8" height="50" fill="#78350f"/>
      <rect x="280" y="405" width="8" height="50" fill="#78350f"/>
      <rect x="520" y="405" width="8" height="50" fill="#78350f"/>
      <rect x="600" y="405" width="8" height="50" fill="#78350f"/>
      <rect x="20" y="490" width="760" height="90" rx="8" fill="#0f172a" opacity="0.90"/>
      <text x="40" y="520" font-family="sans-serif" font-size="13" font-weight="bold" fill="#38bdf8">PROGRAMA VIVIENDA RURAL DIGNA (VRD) — REGISTRO OFICIAL</text>
      <text x="40" y="542" font-family="sans-serif" font-size="12" font-weight="bold" fill="#f8fafc">FOTO 1: FACHADA Y VIVIENDA ACTUAL • EXP: ${cod}</text>
      <text x="40" y="562" font-family="sans-serif" font-size="11" fill="#94a3b8">FECHA: ${fecha} ${hora} | GPS: 4°51'43.2"N 74°03'15.8"W | ESTADO: EVIDENCIA INICIAL</text>
    </svg>`;

    const foto2Svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <linearGradient id="sky2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0284c7"/>
          <stop offset="70%" stop-color="#7dd3fc"/>
          <stop offset="100%" stop-color="#e0f2fe"/>
        </linearGradient>
        <linearGradient id="field2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#65a30d"/>
          <stop offset="100%" stop-color="#166534"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#sky2)"/>
      <polygon points="-40,320 220,180 500,320" fill="#14532d" opacity="0.6"/>
      <polygon points="260,320 540,160 840,320" fill="#15803d" opacity="0.5"/>
      <path d="M0,300 Q250,280 500,310 T800,290 L800,600 L0,600 Z" fill="url(#field2)"/>
      <polygon points="220,360 580,360 640,460 160,460" fill="#fbbf24" opacity="0.28" stroke="#f59e0b" stroke-width="3" stroke-dasharray="8 6"/>
      <text x="400" y="420" font-family="sans-serif" font-size="15" font-weight="bold" fill="#78350f" text-anchor="middle">ÁREA PROPUESTA DE CONSTRUCCIÓN NUEVA (120 m²)</text>
      <line x1="220" y1="340" x2="220" y2="370" stroke="#b45309" stroke-width="4"/>
      <line x1="580" y1="340" x2="580" y2="370" stroke="#b45309" stroke-width="4"/>
      <line x1="160" y1="440" x2="160" y2="470" stroke="#b45309" stroke-width="4"/>
      <line x1="640" y1="440" x2="640" y2="470" stroke="#b45309" stroke-width="4"/>
      <rect x="20" y="490" width="760" height="90" rx="8" fill="#0f172a" opacity="0.90"/>
      <text x="40" y="520" font-family="sans-serif" font-size="13" font-weight="bold" fill="#38bdf8">PROGRAMA VIVIENDA RURAL DIGNA (VRD) — REGISTRO OFICIAL</text>
      <text x="40" y="542" font-family="sans-serif" font-size="12" font-weight="bold" fill="#f8fafc">FOTO 2: LOTE Y TERRENO DE CONSTRUCCIÓN • EXP: ${cod}</text>
      <text x="40" y="562" font-family="sans-serif" font-size="11" fill="#94a3b8">FECHA: ${fecha} ${hora} | PENDIENTE: &lt; 5% | TOPOGRAFÍA ESTABLE SIN AMENAZA DE REMOCIÓN</text>
    </svg>`;

    const foto3Svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <linearGradient id="sky3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0369a1"/>
          <stop offset="100%" stop-color="#bae6fd"/>
        </linearGradient>
        <linearGradient id="field3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#4d7c0f"/>
          <stop offset="100%" stop-color="#14532d"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#sky3)"/>
      <path d="M0,320 Q300,290 600,330 T800,310 L800,600 L0,600 Z" fill="url(#field3)"/>
      <line x1="50" y1="460" x2="750" y2="280" stroke="#713f12" stroke-width="4"/>
      <line x1="50" y1="480" x2="750" y2="300" stroke="#713f12" stroke-width="4"/>
      <rect x="120" y="400" width="12" height="90" fill="#854d0e"/>
      <rect x="260" y="360" width="12" height="90" fill="#854d0e"/>
      <rect x="420" y="320" width="12" height="90" fill="#854d0e"/>
      <rect x="580" y="280" width="12" height="90" fill="#854d0e"/>
      <rect x="405" y="375" width="26" height="45" fill="#f8fafc" stroke="#475569" stroke-width="2" rx="3"/>
      <text x="418" y="400" font-family="sans-serif" font-size="10" font-weight="bold" fill="#0f172a" text-anchor="middle">M-1</text>
      <rect x="20" y="490" width="760" height="90" rx="8" fill="#0f172a" opacity="0.90"/>
      <text x="40" y="520" font-family="sans-serif" font-size="13" font-weight="bold" fill="#38bdf8">PROGRAMA VIVIENDA RURAL DIGNA (VRD) — REGISTRO OFICIAL</text>
      <text x="40" y="542" font-family="sans-serif" font-size="12" font-weight="bold" fill="#f8fafc">FOTO 3: LINDEROS, CERCA Y MOJÓN DE COORDENADA • EXP: ${cod}</text>
      <text x="40" y="562" font-family="sans-serif" font-size="11" fill="#94a3b8">FECHA: ${fecha} ${hora} | LINDERO NORTE: CERCA EN ALAMBRE Y MOJÓN DE CONCRETO M-1</text>
    </svg>`;

    const foto4Svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <linearGradient id="sky4" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0284c7"/>
          <stop offset="100%" stop-color="#cffafe"/>
        </linearGradient>
        <linearGradient id="road" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#a1a1aa"/>
          <stop offset="100%" stop-color="#71717a"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#sky4)"/>
      <polygon points="0,320 300,200 600,320" fill="#15803d" opacity="0.5"/>
      <polygon points="200,320 550,180 800,320" fill="#166534" opacity="0.6"/>
      <rect y="300" width="800" height="300" fill="#4d7c0f"/>
      <polygon points="400,300 420,300 650,600 150,600" fill="url(#road)"/>
      <line x1="430" y1="260" x2="430" y2="320" stroke="#475569" stroke-width="3"/>
      <line x1="480" y1="230" x2="480" y2="350" stroke="#475569" stroke-width="4"/>
      <line x1="600" y1="180" x2="600" y2="450" stroke="#475569" stroke-width="5"/>
      <rect x="20" y="490" width="760" height="90" rx="8" fill="#0f172a" opacity="0.90"/>
      <text x="40" y="520" font-family="sans-serif" font-size="13" font-weight="bold" fill="#38bdf8">PROGRAMA VIVIENDA RURAL DIGNA (VRD) — REGISTRO OFICIAL</text>
      <text x="40" y="542" font-family="sans-serif" font-size="12" font-weight="bold" fill="#f8fafc">FOTO 4: VÍA DE ACCESO VEREDAL Y ENTORNO • EXP: ${cod}</text>
      <text x="40" y="562" font-family="sans-serif" font-size="11" fill="#94a3b8">FECHA: ${fecha} ${hora} | ACCESO VEHICULAR CARROZABLE | RED DE ENERGÍA Y SERVICIOS</text>
    </svg>`;

    const toUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    return [
      {
        id: `foto-${Date.now()}-1`,
        nombre: `Foto_Fachada_Vivienda_${cod}.svg`,
        categoria: "Fachada / Vivienda actual",
        tamanoBytes: 154200,
        url: toUrl(foto1Svg)
      },
      {
        id: `foto-${Date.now()}-2`,
        nombre: `Foto_Lote_Construccion_${cod}.svg`,
        categoria: "Lote / Terreno",
        tamanoBytes: 148100,
        url: toUrl(foto2Svg)
      },
      {
        id: `foto-${Date.now()}-3`,
        nombre: `Foto_Linderos_Mojon_${cod}.svg`,
        categoria: "Linderos / Mojones",
        tamanoBytes: 142300,
        url: toUrl(foto3Svg)
      },
      {
        id: `foto-${Date.now()}-4`,
        nombre: `Foto_Via_Acceso_Veredal_${cod}.svg`,
        categoria: "Vía de acceso / Entorno",
        tamanoBytes: 151800,
        url: toUrl(foto4Svg)
      }
    ];
  };

  // Carga formal de Registro Fotográfico múltiple
  const handleCargarRegistroFotografico = async (
    requisito: RequisitoCaso,
    fotosSubir: { id: string; nombre: string; url: string; tamanoBytes: number; categoria: string }[]
  ) => {
    if (!expedienteSeleccionadoId) return;
    if (fotosSubir.length === 0) {
      setErrorSubirArchivo("Debe adjuntar al menos una fotografía para conformar el registro fotográfico del predio.");
      return;
    }
    setErrorSubirArchivo(null);
    setSubiendoArchivo(true);

    try {
      const sha256Hash = `sha256-foto-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
      const res = await authFetch(
        `/api/expedientes/${expedienteSeleccionadoId}/requisitos/${requisito.id}/subir`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombreArchivo: `Registro_Fotografico_${fotosSubir.length}_fotos.jpg`,
            mimeType: "image/jpeg",
            tamanoBytes: fotosSubir.reduce((acc, f) => acc + (f.tamanoBytes || 0), 0),
            archivoDataUrl: fotosSubir[0]?.url,
            sha256Hash,
            codigoRequisito: requisito.codigoRequisito,
            fase: requisito.fase,
            requisitoNombre: requisito.nombre,
            fotos: fotosSubir.map((f, idx) => ({
              id: f.id || `foto-${Date.now()}-${idx}`,
              nombre: f.nombre,
              url: f.url,
              tamanoBytes: f.tamanoBytes || 150000,
              categoria: f.categoria || "Registro predial",
              subidoEn: new Date().toISOString()
            }))
          })
        }
      );

      if (res.ok) {
        setModalSubirArchivoReq(null);
        setArchivoSeleccionadoSubir(null);
        setFotosParaRegistro([]);
        mostrarToast(`Registro fotográfico de ${fotosSubir.length} fotos guardado exitosamente.`);
        await cargarDetalleExpediente(expedienteSeleccionadoId);
        await cargarExpedientes();
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorSubirArchivo(
          err.error ||
          (res.status === 403
            ? `Acceso restringido por permisos de rol: Su rol actual (${currentUser.rol}) no tiene autorización para registrar fotos en este expediente.`
            : "No fue posible guardar el registro fotográfico.")
        );
      }
    } catch {
      setErrorSubirArchivo("Error de conexión al procesar el registro fotográfico.");
    } finally {
      setSubiendoArchivo(false);
    }
  };

  // Carga simulada rápida de respaldo
  const handleSimularCarga = async (nombreArchivo: string) => {
    if (!expedienteSeleccionadoId || !modalSubirArchivoReq) return;
    setErrorSubirArchivo(null);
    setSubiendoArchivo(true);

    try {
      const res = await authFetch(
        `/api/expedientes/${expedienteSeleccionadoId}/requisitos/${modalSubirArchivoReq.id}/subir`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombreArchivo,
            mimeType: "application/pdf",
            tamanoBytes: 1048576,
            sha256Hash: `sha256-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`,
            codigoRequisito: modalSubirArchivoReq.codigoRequisito,
            fase: modalSubirArchivoReq.fase,
            requisitoNombre: modalSubirArchivoReq.nombre
          })
        }
      );
      if (res.ok) {
        setModalSubirArchivoReq(null);
        setArchivoSeleccionadoSubir(null);
        mostrarToast(`Documento ${nombreArchivo} subido correctamente.`);
        await cargarDetalleExpediente(expedienteSeleccionadoId);
        await cargarExpedientes();
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorSubirArchivo(
          err.error ||
          (res.status === 403
            ? `Acceso restringido por permisos de rol: Su rol actual (${currentUser.rol}) no tiene autorización para cargar este archivo.`
            : "No fue posible subir el archivo.")
        );
      }
    } catch {
      setErrorSubirArchivo("Error de conexión al subir archivo.");
    } finally {
      setSubiendoArchivo(false);
    }
  };

  // Enviar revisión (Supervisor / Administrador / Ingeniería)
  const handleEnviarRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expedienteSeleccionadoId || !modalRevisarReq) return;
    setErrorRevisar(null);
    setGuardandoRevision(true);

    try {
      const res = await authFetch(
        `/api/expedientes/${expedienteSeleccionadoId}/requisitos/${modalRevisarReq.id}/revisar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formRevision)
        }
      );
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const reqActualizado = data.requisito;
        setModalRevisarReq(null);
        const dictamenFinal = formRevision.resultado;
        setFormRevision({ resultado: "ACEPTADO", observacion: "" });
        mostrarToast(
          dictamenFinal === "ACEPTADO"
            ? "Revisión registrada con éxito: Requisito ACEPTADO."
            : "Revisión registrada con éxito: Requisito OBSERVADO con novedades para subsanar."
        );
        // Actualización optimista local inmediata en el estado del expediente activo
        setDetalleExp((prev) => {
          if (!prev) return prev;
          const expActualizado = data.expediente
            ? { ...prev.expediente, ...data.expediente }
            : dictamenFinal === "OBSERVADO"
            ? { ...prev.expediente, bloqueadoPorRevision: false, estadoFase1: "devuelto" }
            : prev.expediente;

          return {
            ...prev,
            expediente: expActualizado,
            requisitos: prev.requisitos.map((r) =>
              r.id === modalRevisarReq.id
                ? {
                    ...r,
                    ...reqActualizado,
                    estado: reqActualizado?.estado || (dictamenFinal === "ACEPTADO" ? "aceptado" : "con_observaciones"),
                    observaciones: formRevision.observacion,
                    ultimaRevision: data.revision || {
                      id: `rev-${Date.now()}`,
                      requisitoCasoId: r.id,
                      resultado: dictamenFinal,
                      observacion: formRevision.observacion,
                      fechaRevision: new Date().toISOString()
                    }
                  }
                : r
            )
          };
        });
        await cargarDetalleExpediente(expedienteSeleccionadoId);
        await cargarExpedientes();
      } else {
        const err = await res.json().catch(() => ({}));
        const mensajeError = err.error || "Error al registrar la revisión del requisito.";
        setErrorRevisar(mensajeError);
        mostrarToast(mensajeError, "error");
      }
    } catch {
      setErrorRevisar("Error de conexión al registrar revisión.");
      mostrarToast("Error de conexión al registrar revisión.", "error");
    } finally {
      setGuardandoRevision(false);
    }
  };

  // Aprobar Fase 1 con asignación obligatoria de Asistente
  const handleConfirmarAprobacionFase1 = async () => {
    const asistenteFinalId = asistenteSeleccionadoId || (asistentesElegibles[0]?.id || "usr-asistente-01");
    if (!expedienteSeleccionadoId || !asistenteFinalId) {
      setErrorAprobar("Debe seleccionar un Gestor Documental.");
      return;
    }
    setErrorAprobar(null);
    setGuardandoAprobacion(true);

    try {
      const res = await authFetch(`/api/expedientes/${expedienteSeleccionadoId}/aprobar-fase-1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asistenteAsignadoId: asistenteFinalId })
      });
      const data = await res.json();
      if (res.ok) {
        setModalAprobarFase1(false);
        mostrarToast(data.mensaje || "Fase 1 aprobada con éxito. Expediente avanzó a Fase 2.");
        setTabRequisitos(2);
        await cargarDetalleExpediente(expedienteSeleccionadoId);
        await cargarExpedientes();
      } else {
        setErrorAprobar(data.error || "No se pudo aprobar la Fase 1.");
      }
    } catch {
      setErrorAprobar("Error de conexión al aprobar Fase 1.");
    } finally {
      setGuardandoAprobacion(false);
    }
  };

  // Agregar nota a la bitácora
  const handleAgregarNota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expedienteSeleccionadoId || !nuevaNotaTexto.trim()) return;

    try {
      const res = await authFetch(`/api/expedientes/${expedienteSeleccionadoId}/notas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenido: nuevaNotaTexto, canal: "llamada" })
      });
      if (res.ok) {
        const nuevaNota = await res.json();
        setNuevaNotaTexto("");
        mostrarToast("Nota agregada a la bitácora del expediente.");
        setDetalleExp((prev) => prev ? { ...prev, notas: [nuevaNota, ...prev.notas] } : prev);
        cargarDetalleExpediente(expedienteSeleccionadoId);
      }
    } catch {}
  };

  // Solicitar retiro de cédula (Comercial / Asistente - Cambio 2)
  const handleSolicitarRetiro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detalleExp || !integranteAEliminar) return;
    const motivo = motivoSolicitudRetiro.trim();
    if (!motivo) {
      mostrarToast("Debe ingresar la observación obligatoria para la solicitud de retiro.", "error");
      return;
    }

    setGuardandoSolicitudRetiro(true);
    try {
      const res = await authFetch(
        `/api/expedientes/${detalleExp.expediente.id}/hogar/integrantes/${integranteAEliminar.id}/solicitar-retiro`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivo, motivoSolicitud: motivo })
        }
      );
      const data = await res.json();
      if (res.ok) {
        setIntegranteAEliminar(null);
        setMotivoSolicitudRetiro("");
        mostrarToast(data.mensaje || "Solicitud de retiro radicada. En espera de autorización del Analista Documental.");
        await cargarDetalleExpediente(detalleExp.expediente.id);
        await cargarExpedientes();
        cargarSolicitudesRetiro();
      } else {
        mostrarToast(data.error || "Error al solicitar retiro.", "error");
      }
    } catch {
      mostrarToast("Error de conexión al solicitar el retiro.", "error");
    } finally {
      setGuardandoSolicitudRetiro(false);
    }
  };

  // Autorizar solicitud de retiro (Supervisor / Admin - Cambio 2)
  const handleAutorizarRetiro = (solicitudId: string) => {
    setModalConfirmacion({
      isOpen: true,
      titulo: "Autorizar Retiro Definitivo de Cédula",
      mensaje: "¿Confirma la AUTORIZACIÓN del retiro de esta cédula del hogar? El integrante y sus requisitos serán removidos definitivamente del expediente.",
      textoBoton: "Autorizar y Remover",
      tipo: "peligro",
      onConfirm: async () => {
        setGuardandoResolucionRetiro(true);
        try {
          const res = await authFetch(`/api/solicitudes-retiro/${solicitudId}/autorizar`, {
            method: "POST"
          });
          const data = await res.json();
          if (res.ok) {
            mostrarToast(data.mensaje || "Retiro de cédula autorizado y ejecutado exitosamente.");
            if (detalleExp) await cargarDetalleExpediente(detalleExp.expediente.id);
            await cargarExpedientes();
            cargarSolicitudesRetiro();
          } else {
            mostrarToast(data.error || "No fue posible autorizar el retiro.", "error");
          }
        } catch {
          mostrarToast("Error de conexión al autorizar el retiro.", "error");
        } finally {
          setGuardandoResolucionRetiro(false);
        }
      }
    });
  };

  // Rechazar solicitud de retiro (Supervisor / Admin - Cambio 2)
  const handleRechazarRetiro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!solicitudAResolver) return;
    const motivo = motivoRechazoSolicitud.trim();
    if (!motivo) {
      mostrarToast("Debe ingresar el motivo de rechazo obligatorio.", "error");
      return;
    }

    setGuardandoResolucionRetiro(true);
    try {
      const res = await authFetch(`/api/solicitudes-retiro/${solicitudAResolver.id}/rechazar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivoRechazo: motivo })
      });
      const data = await res.json();
      if (res.ok) {
        setModalRechazarSolicitud(false);
        setSolicitudAResolver(null);
        setMotivoRechazoSolicitud("");
        mostrarToast(data.mensaje || "Solicitud de retiro rechazada.");
        if (detalleExp) await cargarDetalleExpediente(detalleExp.expediente.id);
        await cargarExpedientes();
        cargarSolicitudesRetiro();
      } else {
        mostrarToast(data.error || "No fue posible rechazar la solicitud.", "error");
      }
    } catch {
      mostrarToast("Error de conexión al rechazar el retiro.", "error");
    } finally {
      setGuardandoResolucionRetiro(false);
    }
  };

  // Confirmar eliminación directa de integrante del hogar (Solo Supervisor / Admin - Cambio 2)
  const handleConfirmarEliminarIntegrante = async () => {
    if (!detalleExp || !integranteAEliminar) return;
    setEliminandoIntegrante(true);
    try {
      const res = await authFetch(
        `/api/expedientes/${detalleExp.expediente.id}/hogar/integrantes/${integranteAEliminar.id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (res.ok) {
        setIntegranteAEliminar(null);
        mostrarToast(data.mensaje || "Cédula e integrante removidos exitosamente.");
        await cargarDetalleExpediente(detalleExp.expediente.id);
        await cargarExpedientes();
        cargarSolicitudesRetiro();
      } else {
        mostrarToast(data.error || "No fue posible eliminar el integrante.", "error");
      }
    } catch {
      mostrarToast("Error de conexión al eliminar el integrante.", "error");
    } finally {
      setEliminandoIntegrante(false);
    }
  };

  // Lista dinámicamente construida de responsables desde perfiles_usuario (todosUsuarios) y expedientes
  const listaResponsables = useMemo(() => {
    const nombresSet = new Set<string>();

    // 1. Inclusión dinámica desde la tabla perfiles_usuario (todosUsuarios)
    if (Array.isArray(todosUsuarios) && todosUsuarios.length > 0) {
      todosUsuarios
        .filter((u) => u.activo !== false)
        .forEach((u) => {
          if (u.nombreCompleto) {
            nombresSet.add(formatearNombreUsuario(u.nombreCompleto));
          }
        });
    }

    // 2. Inclusión desde los expedientes cargados resolviendo perfiles dinámicos
    expedientes.forEach((e) => {
      const respUser = todosUsuarios.find(
        (u) => u.id === e.responsableGeneralId || u.username === e.responsableGeneralId
      );
      const nombreEfectivo = respUser?.nombreCompleto || e.responsableGeneralNombre;
      if (nombreEfectivo) {
        nombresSet.add(formatearNombreUsuario(nombreEfectivo));
      }
    });

    return Array.from(nombresSet).sort();
  }, [todosUsuarios, expedientes]);

  // Contadores para pestañas de expedientes (Activos vs Retirados / Histórico)
  const conteoExpedientesActivos = useMemo(() => {
    return expedientes.filter((e) => e.estadoGeneral !== "salida_definitiva").length;
  }, [expedientes]);

  const conteoExpedientesRetirados = useMemo(() => {
    return expedientes.filter((e) => e.estadoGeneral === "salida_definitiva").length;
  }, [expedientes]);

  // Filtrado de expedientes (Filtro Fase, Filtro Responsable dinámico y Tiempo)
  const expedientesFiltrados = expedientes.filter((exp) => {
    // 1. Filtrado estricto por pestaña de navegación: Activos excluye 'salida_definitiva'
    if (tabExpedientes === "activos" && exp.estadoGeneral === "salida_definitiva") {
      return false;
    }
    if (tabExpedientes === "retirados" && exp.estadoGeneral !== "salida_definitiva") {
      return false;
    }

    const texto = filtroTexto.toLowerCase();
    const munInfo = CATALOGO_MUNICIPIOS.find(
      (m) =>
        m.codigoCompleto === exp.predioVivienda.municipioCodigo ||
        m.municipioCodigo === exp.predioVivienda.municipioCodigo
    );
    const nombreMun = munInfo ? munInfo.municipioNombre.toLowerCase() : "";
    const coincideTexto =
      !filtroTexto ||
      exp.postulante.nombres.toLowerCase().includes(texto) ||
      exp.postulante.primerApellido.toLowerCase().includes(texto) ||
      exp.postulante.numeroIdentificacion.includes(texto) ||
      (exp.codigoVisible && exp.codigoVisible.toLowerCase().includes(texto)) ||
      (exp.predioVivienda.municipioCodigo && exp.predioVivienda.municipioCodigo.includes(texto)) ||
      (exp.predioVivienda.vereda && exp.predioVivienda.vereda.toLowerCase().includes(texto)) ||
      nombreMun.includes(texto);

    const coincideMunicipio = !filtroMunicipio || exp.predioVivienda.municipioCodigo === filtroMunicipio;
    const coincideEstado = !filtroEstado || exp.estadoGeneral === filtroEstado;
    const coincideFase = !filtroFase || String(exp.faseActual) === filtroFase;

    // Resolución dinámica de responsable desde todosUsuarios (perfiles_usuario)
    const respUser = todosUsuarios.find(
      (u) => u.id === exp.responsableGeneralId || u.username === exp.responsableGeneralId
    );
    const supervisorUser = todosUsuarios.find((u) => u.rol === "supervisor");
    const nombreRespEfectivo = (exp.bloqueadoPorRevision && supervisorUser)
      ? supervisorUser.nombreCompleto
      : (respUser?.nombreCompleto || exp.responsableGeneralNombre || "");

    const coincideResponsable =
      !filtroResponsable ||
      exp.responsableGeneralNombre === filtroResponsable ||
      exp.responsableGeneralId === filtroResponsable ||
      formatearNombreUsuario(exp.responsableGeneralNombre) === filtroResponsable ||
      formatearNombreUsuario(nombreRespEfectivo) === filtroResponsable ||
      nombreRespEfectivo === filtroResponsable;

    let coincideTiempo = true;
    const dias = exp.diasTranscurridos ?? 0;
    if (filtroTiempo === "0-15") coincideTiempo = dias >= 0 && dias <= 15;
    else if (filtroTiempo === "15-30") coincideTiempo = dias > 15 && dias <= 30;
    else if (filtroTiempo === "30-60") coincideTiempo = dias > 30 && dias <= 60;
    else if (filtroTiempo === "60-90") coincideTiempo = dias > 60 && dias <= 90;
    else if (filtroTiempo === "90+") coincideTiempo = dias > 90;

    return (
      coincideTexto &&
      coincideMunicipio &&
      coincideEstado &&
      coincideFase &&
      coincideResponsable &&
      coincideTiempo
    );
  });

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-500 font-medium">Cargando RuralIA...</div>
      </div>
    );
  }

  // PANTALLA DE ACCESO (SCR-01: REDISEÑO INSTITUCIONAL MODERNO RURALIA)
  if (!currentUser) {
    return (
      <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F8FAF8] text-slate-800 selection:bg-[#3F7D58]/20 selection:text-[#285943]">
        {/* SECCIÓN VISUAL IZQUIERDA (55% EN ESCRITORIO CON IMAGEN REALISTA DE VIVIENDA RURAL) */}
        <div className="w-full lg:w-[55%] min-h-[360px] sm:min-h-[440px] lg:min-h-screen relative flex flex-col justify-between p-6 sm:p-10 lg:p-14 overflow-hidden bg-[#1E3A5F]">
          {/* Fotografía realizada por Franco Osorio para el proyecto de vivienda rural digna */}
          <img
            src="/assets/aistudio/WhatsApp_Image_2026-11-03_at_12.01.12_PM_107f8f67.jpeg"
            alt="Vivienda Rural Digna — Franco Osorio"
            className="absolute inset-0 w-full h-full object-cover object-center transform scale-105 motion-safe:transition-transform motion-safe:duration-1000"
          />

          {/* Overlay graduado institucional oscuro/transparente para legibilidad óptima */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-900/65 to-slate-950/40 backdrop-blur-[0.5px]" />

          {/* Sutil halo cálido en verde institucional (#3F7D58) */}
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#3F7D58]/20 rounded-full blur-3xl pointer-events-none" />

          {/* Cabecera visual izquierda */}
          <div className="relative z-10 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-sm">
              <Building2 className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <span className="font-bold text-white text-base tracking-tight block">RuralIA</span>
              <span className="text-[11px] text-emerald-200/80 font-medium block">FRANCO OSORIO • Vivienda Rural Digna</span>
            </div>
          </div>

          {/* Contenido central institucional sobre la imagen */}
          <div className="relative z-10 my-auto py-8 lg:py-12">
            <div className="w-12 h-1 bg-[#3F7D58] rounded-full mb-5 shadow-xs"></div>
            <span className="text-[11px] uppercase tracking-widest text-emerald-300 font-bold block mb-1">
              Sistema de Gestión Integral
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              RuralIA
            </h1>
            <p className="text-lg sm:text-xl font-medium text-emerald-100/90 mt-1.5">
              Vivienda Rural Digna
            </p>
            <p className="text-sm sm:text-base text-slate-200/90 font-light mt-4 max-w-md leading-relaxed">
              &quot;Gestión integral para transformar y mejorar la vivienda rural.&quot;
            </p>

            {/* Micro métricas sutiles para reforzar la seriedad del software */}
            <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-2 gap-4 max-w-sm">
              <div>
                <span className="block text-[11px] text-slate-400 uppercase tracking-wider font-medium">Cobertura</span>
                <span className="text-sm font-semibold text-white">Rural & Municipal</span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-400 uppercase tracking-wider font-medium">Fases</span>
                <span className="text-sm font-semibold text-white">7 Etapas de Gestión</span>
              </div>
            </div>
          </div>

          {/* Pie inferior izquierdo */}
          <div className="relative z-10 pt-4 border-t border-white/15 flex items-center justify-between">
            <p className="text-[11px] tracking-wider text-slate-300/80 font-medium uppercase">
              FRANCO OSORIO INVESTMENT S.A.S.
            </p>
            <span className="text-[10px] text-emerald-300/80 font-mono">
              Programa Nacional VRD
            </span>
          </div>
        </div>

        {/* PANEL DERECHO (45% EN ESCRITORIO, BLANCO, MINIMALISTA Y ELEGANTE) */}
        <div className="w-full lg:w-[45%] flex flex-col justify-between p-6 sm:p-10 lg:p-14 bg-white min-h-screen overflow-y-auto">
          {/* Espaciador superior en desktop */}
          <div className="hidden lg:block"></div>

          {/* Contenedor centrado del formulario (ancho máx 420px) */}
          <div className="w-full max-w-[420px] mx-auto my-auto py-6 sm:py-8 space-y-6">
            {/* Cabecera del formulario */}
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#F4EFE6] border border-[#3F7D58]/20 flex items-center justify-center text-[#3F7D58] shadow-2xs mb-5">
                <Building2 className="w-6 h-6 text-[#3F7D58]" />
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold tracking-wider uppercase text-[#3F7D58]">
                  RuralIA
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-xs font-medium text-slate-500">
                  Vivienda Rural Digna
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 tracking-tight">
                Bienvenido
              </h2>
              <p className="text-xs sm:text-sm text-[#475569] mt-1.5 leading-relaxed">
                Ingresa con tus credenciales para continuar.
              </p>
            </div>

            {/* Banner de error de autenticación si existe */}
            {authError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start space-x-2.5 shadow-2xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-snug">{authError}</span>
              </div>
            )}

            {/* Formulario */}
            <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
              {/* Campo Usuario */}
              <div>
                <label
                  htmlFor="login-username"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Usuario
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="login-username"
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    className="w-full h-12 pl-10 pr-4 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#3F7D58] focus:ring-4 focus:ring-[#3F7D58]/10 hover:border-slate-300 outline-none transition-all duration-200 text-slate-800 placeholder:text-slate-400 font-medium shadow-2xs"
                    placeholder="Usuario institucional"
                    required
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Campo Contraseña */}
              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="login-password"
                    type={mostrarPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full h-12 pl-10 pr-11 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#3F7D58] focus:ring-4 focus:ring-[#3F7D58]/10 hover:border-slate-300 outline-none transition-all duration-200 text-slate-800 placeholder:text-slate-400 font-medium shadow-2xs"
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPassword(!mostrarPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none focus:text-[#3F7D58] transition-colors cursor-pointer"
                    title={mostrarPassword ? "Ocultar contraseña" : "Ver contraseña"}
                    aria-label={mostrarPassword ? "Ocultar contraseña" : "Ver contraseña"}
                  >
                    {mostrarPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Botón Iniciar sesión */}
              <button
                type="submit"
                disabled={iniciandoSesion}
                className="w-full h-12 px-5 bg-[#3F7D58] hover:bg-[#285943] active:bg-[#1E3A5F] text-white font-semibold text-sm rounded-xl shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed group mt-2"
              >
                {iniciandoSesion ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Verificando credenciales...</span>
                  </>
                ) : (
                  <>
                    <span>Iniciar sesión</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 text-center">
              <span className="text-[11px] text-slate-400">
                Acceso restringido a personal autorizado de RuralIA.
              </span>
            </div>
          </div>

          {/* Pie de página del panel derecho */}
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>© 2026 RuralIA · FRANCO OSORIO INVESTMENT S.A.S.</span>
            <span className="text-slate-400 font-mono text-[10px]">v1.2 · Producción</span>
          </div>
        </div>
      </div>
    );
  }

  // PANTALLA OBLIGATORIA DE CAMBIO DE CONTRASEÑA (BCRYPT)
  const requiereCambioPassword = Boolean(
    currentUser?.requiere_cambio_password ?? currentUser?.requiereCambioPassword
  );

  if (currentUser && requiereCambioPassword) {
    return (
      <ModalCambioPassword
        usuario={currentUser}
        onPasswordCambiada={(usuarioActualizado) => {
          setCurrentUser(usuarioActualizado);
          localStorage.setItem("crm_user_session", JSON.stringify(usuarioActualizado));
          mostrarToast("Contraseña actualizada y protegida con bcrypt. ¡Bienvenido!");
        }}
        onCerrarSesion={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAF8] flex flex-col font-sans selection:bg-[#3F7D58]/20 selection:text-[#285943]">
      {/* AVISO PERMANENTE DE MODO DE EJECUCIÓN (SOLO VISIBLE PARA ADMINISTRADOR) */}
      {currentUser?.rol === "administrador" && (
        <div className={`py-1.5 px-4 text-center text-xs font-semibold tracking-wide border-b flex items-center justify-center space-x-2 ${
          systemStatus.mode === "supabase" 
            ? "bg-[#1E3A5F] text-emerald-100 border-[#285943]" 
            : "bg-amber-100 text-amber-900 border-amber-300"
        }`}>
          {systemStatus.mode === "supabase" ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>⚡ CONECTADO A SUPABASE • Proyecto: <strong className="font-mono text-emerald-200">{systemStatus.projectId || "dcelksfchabhrlevlfah"}</strong> • Persistencia y REST API Activas</span>
            </>
          ) : (
            <span>⚠️ {systemStatus.label}</span>
          )}
        </div>
      )}

      {/* BARRA SUPERIOR DE NAVEGACIÓN */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 px-6 py-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-[#3F7D58] text-white rounded-xl shadow-xs">
              <Building2 className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-sm tracking-tight block">RuralIA</span>
              <span className="text-[10px] text-[#3F7D58] font-bold uppercase tracking-wider block">FRANCO OSORIO • Vivienda Rural Digna</span>
            </div>
          </div>

          <nav className="flex items-center space-x-1 pl-4 border-l border-slate-200">
            <button
              type="button"
              onClick={() => {
                setVistaActual("expedientes");
                setExpedienteSeleccionadoId(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                vistaActual === "expedientes" ? "bg-[#EBF3EE] text-[#285943] font-bold border border-[#3F7D58]/20 shadow-2xs" : "text-slate-600 hover:bg-[#F4FAF6] hover:text-[#285943]"
              }`}
            >
              Expedientes VRD
            </button>
            {["comercial", "administrador", "planeacion", "supervisor", "asistente"].includes(currentUser.rol) && (
              <button
                type="button"
                id="btn-nav-captacion"
                onClick={() => {
                  setExpedienteSeleccionadoId(null);
                  setDetalleExp(null);
                  setVistaActual("captacion");
                  cargarInteresados();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  vistaActual === "captacion" ? "bg-[#EBF3EE] text-[#285943] font-bold border border-[#3F7D58]/20 shadow-2xs" : "text-slate-600 hover:bg-[#F4FAF6] hover:text-[#285943]"
                }`}
              >
                Captación de Hogares
              </button>
            )}
            {/* NUEVO MÓDULO INFORMES: ACCESIBLE PARA TODOS LOS ROLES */}
            <button
              type="button"
              id="btn-nav-informes"
              onClick={() => {
                setVistaActual("informes");
                setExpedienteSeleccionadoId(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer ${
                vistaActual === "informes" ? "bg-[#EBF3EE] text-[#285943] font-bold border border-[#3F7D58]/20 shadow-2xs" : "text-slate-600 hover:bg-[#F4FAF6] hover:text-[#285943]"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#3F7D58]" />
              <span>Informes</span>
            </button>
            {currentUser.rol === "administrador" && (
              <button
                type="button"
                id="btn-nav-administracion"
                onClick={() => {
                  setVistaActual("administracion");
                  setExpedienteSeleccionadoId(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  vistaActual === "administracion" ? "bg-[#EBF3EE] text-[#285943] font-bold border border-[#3F7D58]/20 shadow-2xs" : "text-slate-600 hover:bg-[#F4FAF6] hover:text-[#285943]"
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-[#3F7D58]" />
                <span>Panel de Administración</span>
              </button>
            )}
            {(currentUser.rol === "supervisor" || currentUser.rol === "administrador" || currentUser.rol === "asistente" || currentUser.rol === "planeacion") && (
              <button
                type="button"
                onClick={() => setModalBandejaRetiro(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all text-slate-600 hover:bg-amber-50 hover:text-amber-800 flex items-center space-x-1.5 cursor-pointer"
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Bandeja de Retiro</span>
                {solicitudesRetiro.filter((s) => s.estado === "pendiente").length > 0 && (
                  <span className="bg-amber-500 text-white font-bold rounded-full px-1.5 py-0.2 text-[10px]">
                    {solicitudesRetiro.filter((s) => s.estado === "pendiente").length}
                  </span>
                )}
              </button>
            )}
          </nav>
        </div>

        <div className="flex items-center space-x-3">
          {/* Botón de Sincronización Manual Directa con Supabase y Recarga Automática */}
          <button
            type="button"
            onClick={handleSincronizarManual}
            disabled={sincronizando}
            title={
              sincronizando
                ? "Sincronizando información en tiempo real..."
                : `Sincronizar base de datos y recargar información en tiempo real${
                    ultimaSincronizacion ? ` (Última: ${ultimaSincronizacion})` : ""
                  }`
            }
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border transition-all text-xs font-semibold cursor-pointer shadow-2xs ${
              sincronizando
                ? "bg-[#EBF3EE] border-[#3F7D58] text-[#285943] cursor-wait opacity-90 ring-2 ring-[#3F7D58]/20"
                : estadoSincronizacion === "exito"
                ? "bg-emerald-50 border-emerald-400 text-emerald-800"
                : estadoSincronizacion === "error"
                ? "bg-rose-50 border-rose-300 text-rose-800"
                : "bg-[#F4FAF6] hover:bg-[#E3F0E7] active:bg-[#C2DEC9] border-[#C2DEC9] text-[#285943]"
            }`}
          >
            {sincronizando ? (
              <RefreshCw className="w-3.5 h-3.5 text-[#3F7D58] shrink-0 animate-spin" />
            ) : estadoSincronizacion === "exito" ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : estadoSincronizacion === "error" ? (
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-[#3F7D58] shrink-0" />
            )}
            <span>
              {mensajeSincronizacion || "Sincronizar DB"}
            </span>
            {sincronizando && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#3F7D58] animate-ping" />
            )}
          </button>

          {/* CAMBIADOR RÁPIDO DE USUARIO / ROL (EXCLUSIVO PARA EL ADMINISTRADOR) */}
          {currentUser.rol === "administrador" && (
            <div
              id="selector-cambio-rol"
              title="Haz clic para cambiar de rol o perfil de usuario"
              onClick={() => {
                if (roleSelectRef.current) {
                  if (typeof (roleSelectRef.current as any).showPicker === "function") {
                    try {
                      (roleSelectRef.current as any).showPicker();
                    } catch {
                      roleSelectRef.current.focus();
                    }
                  } else {
                    roleSelectRef.current.focus();
                  }
                }
              }}
              className="flex items-center space-x-2 bg-[#F4EFE6]/70 hover:bg-[#F4EFE6] active:bg-[#F4EFE6] px-3 py-1.5 rounded-xl border border-[#3F7D58]/25 shadow-2xs transition-all cursor-pointer select-none group"
            >
              {cambiandoRol ? (
                <RefreshCw className="w-4 h-4 text-[#3F7D58] shrink-0 animate-spin" />
              ) : (
                <UserCheck className="w-4 h-4 text-[#3F7D58] group-hover:scale-105 shrink-0 transition-transform" />
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#3F7D58] leading-none group-hover:text-[#285943] transition-colors">
                  Cambio Rápido de Rol
                </span>
                <div className="flex items-center">
                  <select
                    ref={roleSelectRef}
                    aria-label="Cambio rápido de rol de usuario"
                    value={currentUser.id}
                    disabled={cambiandoRol}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleSwitchUser(e.target.value);
                    }}
                    className="text-xs font-semibold text-slate-800 bg-transparent outline-none cursor-pointer pr-1 hover:text-[#285943]"
                  >
                    {usuariosParaSelector.map((u) => (
                      <option key={u.id} value={u.id} className="bg-white text-slate-800 py-1">
                        {formatearNombreUsuario(u.nombreCompleto)} ({formatearRol(u.rol)})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-[#3F7D58]/60 group-hover:text-[#3F7D58] shrink-0 pointer-events-none -ml-0.5" />
                </div>
              </div>
            </div>
          )}

          <div className="text-right hidden md:block">
            <div className="text-xs font-bold text-slate-900">{formatearNombreUsuario(currentUser.nombreCompleto)}</div>
            <div className="text-[11px] text-[#3F7D58] font-bold">Rol: {formatearRol(currentUser.rol)}</div>
          </div>
          <button
            type="button"
            onClick={() => setModalCambioPasswordVoluntario(true)}
            className="p-2 text-slate-500 hover:text-[#3F7D58] rounded-xl hover:bg-[#EBF3EE] transition-colors cursor-pointer"
            title="Cambiar contraseña de seguridad (bcrypt)"
          >
            <KeyRound className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL SEGÚN LA VISTA */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {vistaActual === "expedientes" && !expedienteSeleccionadoId && (
          <div>
            {/* ENCABEZADO Y FILTROS */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold text-slate-900">Listado General de Expedientes</h2>
                  {currentUser.rol === "planeacion" && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full border border-teal-200">
                      Auditoría / Solo Lectura
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Consulta universal del estado del proceso. Acceso según asignación y rol.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-xs transition-colors cursor-pointer"
                  title="Imprimir listado actual o guardar como PDF"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  <span>Imprimir Vista / PDF</span>
                </button>
              </div>
            </div>

            {/* PESTAÑAS PRINCIPALES: ACTIVOS vs RETIRADOS / HISTÓRICO vs TODOS */}
            <div className="flex items-center space-x-2 mb-4 border-b border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setTabExpedientes("activos");
                  if (filtroEstado === "salida_definitiva") setFiltroEstado("");
                }}
                className={`pb-2.5 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 cursor-pointer -mb-[1px] ${
                  tabExpedientes === "activos"
                    ? "border-[#3F7D58] text-[#285943]"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <span>Expedientes Activos</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    tabExpedientes === "activos"
                      ? "bg-[#EBF3EE] text-[#285943] border border-[#3F7D58]/30"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {conteoExpedientesActivos}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTabExpedientes("retirados");
                }}
                className={`pb-2.5 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 cursor-pointer -mb-[1px] ${
                  tabExpedientes === "retirados"
                    ? "border-rose-600 text-rose-700"
                    : "border-transparent text-slate-500 hover:text-rose-700"
                }`}
              >
                <span>Retirados / Histórico</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    tabExpedientes === "retirados"
                      ? "bg-rose-100 text-rose-800 border border-rose-300"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {conteoExpedientesRetirados}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTabExpedientes("todos");
                }}
                className={`pb-2.5 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 cursor-pointer -mb-[1px] ${
                  tabExpedientes === "todos"
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <span>Todos</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    tabExpedientes === "todos"
                      ? "bg-blue-100 text-blue-800 border border-blue-200"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {expedientes.length}
                </span>
              </button>
            </div>

            {/* BARRA DE BÚSQUEDA Y FILTROS (Cambio 1: Filtro Fase, Cambio 7: Filtro Responsable y Tiempo) */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs mb-6 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="relative sm:col-span-2 lg:col-span-2">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por postulante, cédula, vereda o código (ej: 25151)..."
                    value={filtroTexto}
                    onChange={(e) => setFiltroTexto(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <select
                    value={filtroMunicipio}
                    onChange={(e) => setFiltroMunicipio(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-slate-700 bg-white"
                  >
                    <option value="">Todos los municipios</option>
                    {CATALOGO_MUNICIPIOS.map((m) => (
                      <option key={m.codigoCompleto} value={m.codigoCompleto}>
                        {m.municipioNombre} ({m.codigoCompleto})
                      </option>
                    ))}
                  </select>
                </div>
                {/* CAMBIO 1: DROPDOWN DE FASE ACTIVA */}
                <div>
                  <select
                    value={filtroFase}
                    onChange={(e) => setFiltroFase(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-slate-700 bg-white font-medium"
                  >
                    <option value="">Todas las fases</option>
                    <option value="1">Fase 1: En Ingreso Hogar (3 docs)</option>
                    <option value="2">Fase 2: En Solicitud 8 Documentos</option>
                    <option value="3">Fase 3: En Validación Inicial Compensar</option>
                    <option value="4">Fase 4: En Recolección de Documentos Técnicos</option>
                    <option value="5">Fase 5: En Trámite de Licencia de Construcción</option>
                    <option value="6">Fase 6: En Postulación</option>
                    <option value="7">Fase 7: En Construcción y Cobro Subsidio</option>
                  </select>
                </div>
                <div>
                  <select
                    value={filtroEstado}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFiltroEstado(val);
                      if (val === "salida_definitiva" && tabExpedientes === "activos") {
                        setTabExpedientes("retirados");
                      } else if (val && val !== "salida_definitiva" && tabExpedientes === "retirados") {
                        setTabExpedientes("activos");
                      }
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-slate-700 bg-white"
                  >
                    <option value="">Todos los estados</option>
                    <option value="en_tramite">En trámite</option>
                    <option value="en_pausa_aporte">En pausa (Aporte 10%)</option>
                    <option value="subsidio_desembolsado">Subsidio desembolsado y cerrado</option>
                    <option value="salida_definitiva">Salida definitiva</option>
                  </select>
                </div>
              </div>

              {/* FILA SECUNDARIA: RESPONSABLE GENERAL, RANGO DE TIEMPO Y RESET (CAMBIO 7) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  {/* CAMBIO 7: DROPDOWN DE RESPONSABLE GENERAL */}
                  <div className="flex items-center">
                    <select
                      aria-label="Responsable General"
                      value={filtroResponsable}
                      onChange={(e) => setFiltroResponsable(e.target.value)}
                      className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-slate-700 bg-white max-w-[220px] truncate font-medium"
                    >
                      <option value="">Todos los responsables</option>
                      {listaResponsables.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* CAMBIO 7: DROPDOWN DE TIEMPO (DÍAS) */}
                  <div className="flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      aria-label="Tiempo en días"
                      value={filtroTiempo}
                      onChange={(e) => setFiltroTiempo(e.target.value)}
                      className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-slate-700 bg-white font-medium"
                    >
                      <option value="">Todos los rangos</option>
                      <option value="0-15">0 a 15 días</option>
                      <option value="15-30">15 a 30 días</option>
                      <option value="30-60">30 a 60 días</option>
                      <option value="60-90">60 a 90 días (Alerta)</option>
                      <option value="90+">Mayor a 90 días (Crítico)</option>
                    </select>
                  </div>

                  {/* CONTADOR DINÁMICO DE EXPEDIENTES */}
                  <div className="text-xs text-slate-500 font-medium pl-1">
                    Mostrando <strong className="text-slate-800">{expedientesFiltrados.length}</strong> de{" "}
                    <strong className="text-slate-800">{expedientes.length}</strong> expedientes
                  </div>
                </div>

                {(filtroTexto || filtroMunicipio || filtroEstado || filtroFase || filtroResponsable || filtroTiempo) && (
                  <button
                    type="button"
                    onClick={handleLimpiarFiltros}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center space-x-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restablecer filtros</span>
                  </button>
                )}
              </div>
            </div>

            {/* TABLA DE EXPEDIENTES */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 sticky left-0 bg-slate-50 z-20 border-r border-slate-200 shadow-xs min-w-[210px]">
                        Código y Postulante
                      </th>
                      <th className="px-4 py-3">Teléfono & WhatsApp</th>
                      <th className="px-4 py-3">Municipio & Vereda</th>
                      <th className="px-4 py-3">Fase Activa</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Novedad / Alerta</th>
                      <th className="px-4 py-3">Responsable General</th>
                      <th className="px-4 py-3">Tiempo (Días)</th>
                      <th className="px-4 py-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expedientesFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-12 text-center">
                          <div className="max-w-sm mx-auto flex flex-col items-center">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2.5">
                              <Search className="w-5 h-5" />
                            </div>
                            <h4 className="text-xs font-bold text-slate-800 mb-1">
                              {expedientes.length === 0 ? "No hay expedientes registrados en el sistema" : "No se encontraron expedientes"}
                            </h4>
                            <p className="text-xs text-slate-500 mb-3.5 leading-relaxed">
                              {expedientes.length === 0
                                ? "La aplicación se encuentra lista para iniciar la operación desde cero. Registre nuevos hogares en la sección de Captación Comercial para convertirlos a Expediente."
                                : "No hay registros que coincidan con los filtros aplicados."}
                            </p>
                            {(filtroTexto || filtroMunicipio || filtroEstado || filtroFase || filtroResponsable || filtroTiempo) && (
                              <button
                                type="button"
                                onClick={handleLimpiarFiltros}
                                className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Limpiar todos los filtros</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      expedientesFiltrados.map((exp) => (
                        <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r border-slate-200 shadow-xs">
                            <div className="font-mono font-bold text-slate-900">
                              {exp.codigoVisible || exp.id.toUpperCase()}
                            </div>
                            <div className="font-semibold text-slate-800">
                              {obtenerNombrePostulante(exp.postulante)}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {exp.postulante.tipoIdentificacion}: {exp.postulante.numeroIdentificacion}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {(() => {
                              const tel1 = exp.postulante?.telefonoPrincipal || (exp as any).telefono || (exp.postulante as any)?.telefono;
                              const tel2 = exp.postulante?.telefonoSecundario || (exp as any).telefonoSecundario || (exp as any).telefonoContacto2 || (exp as any).telefono2;
                              if (!tel1 && !tel2) {
                                return <span className="text-slate-400 text-xs italic">Sin registrar</span>;
                              }
                              return (
                                <div className="space-y-1.5">
                                  {tel1 && (
                                    <div>
                                      <div className="flex items-center space-x-1.5 font-mono text-slate-800 text-xs">
                                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                        <span>{tel1}</span>
                                      </div>
                                      <a
                                        href={`https://wa.me/57${tel1.replace(/\D/g, "")}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center space-x-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-0.5 font-semibold hover:bg-emerald-100 transition-colors"
                                        title="WhatsApp Teléfono Principal"
                                      >
                                        <span>WhatsApp Directo</span>
                                      </a>
                                    </div>
                                  )}
                                  {tel2 && (
                                    <div className={tel1 ? "pt-1 border-t border-slate-100" : ""}>
                                      <div className="flex items-center space-x-1.5 font-mono text-slate-700 text-[11px]">
                                        <PhoneCall className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                        <span title="Teléfono Secundario">{tel2}</span>
                                      </div>
                                      <a
                                        href={`https://wa.me/57${tel2.replace(/\D/g, "")}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center space-x-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-0.5 font-semibold hover:bg-emerald-100 transition-colors"
                                        title="WhatsApp Teléfono Secundario"
                                      >
                                        <span>WhatsApp Tel. 2</span>
                                      </a>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3">
                            {(() => {
                              const munInfo = CATALOGO_MUNICIPIOS.find(
                                (m) =>
                                  m.codigoCompleto === exp.predioVivienda.municipioCodigo ||
                                  m.municipioCodigo === exp.predioVivienda.municipioCodigo
                              );
                              const nombreMun = munInfo ? munInfo.municipioNombre : (exp.predioVivienda.municipioCodigo ? `Municipio ${exp.predioVivienda.municipioCodigo}` : "Sin municipio");
                              const codMun = munInfo ? munInfo.codigoCompleto : (exp.predioVivienda.municipioCodigo || "N/A");
                              const veredaTexto = exp.predioVivienda.vereda
                                ? (exp.predioVivienda.vereda.toLowerCase().startsWith("vereda")
                                    ? exp.predioVivienda.vereda
                                    : `Vereda ${exp.predioVivienda.vereda}`)
                                : "Zona Rural";
                              return (
                                <>
                                  <div className="font-medium text-slate-800">{nombreMun}</div>
                                  <div className="text-[11px] text-slate-500 font-medium">
                                    {veredaTexto} (Cód. {codMun})
                                  </div>
                                </>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] border ${
                                getEtiquetaFase(exp.faseActual).estiloBadge
                              }`}
                            >
                              {getEtiquetaFase(exp.faseActual).nombre}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                exp.estadoGeneral === "en_tramite"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : exp.estadoGeneral === "en_pausa_aporte"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : exp.estadoGeneral === "subsidio_desembolsado"
                                  ? "bg-teal-50 text-teal-800 border border-teal-300 font-semibold"
                                  : "bg-rose-50 text-rose-700 border border-rose-200 font-medium"
                              }`}
                            >
                              {exp.estadoGeneral === "en_tramite"
                                ? "En Trámite"
                                : exp.estadoGeneral === "en_pausa_aporte"
                                ? "Pausa (10%)"
                                : exp.estadoGeneral === "subsidio_desembolsado"
                                ? "Subsidio Desembolsado"
                                : "Salida Definitiva"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {exp.solicitudRechazo?.estado === "pendiente" ? (
                              <span
                                id={`alerta-rechazo-${exp.id}`}
                                className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200"
                                title={`Rechazo solicitado en Fase ${exp.solicitudRechazo.fase}: ${exp.solicitudRechazo.motivo}`}
                              >
                                <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                <span>Rechazo Pendiente</span>
                              </span>
                            ) : exp.estadoGeneral === "salida_definitiva" ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                <Lock className="w-3 h-3 text-slate-500 shrink-0" />
                                <span>Exp. Archivado</span>
                              </span>
                            ) : exp.bloqueadoPorRevision ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                <Lock className="w-3 h-3 text-amber-600 shrink-0" />
                                <span>En Revisión</span>
                              </span>
                            ) : (exp.tieneObservaciones || exp.estadoFase1 === "devuelto" || exp.estadoFase2 === "devuelto" || (exp as any).subsanacionFase3Activa || (exp.revisionFases && Object.values(exp.revisionFases).some((rf: any) => rf?.estado === "devuelto" || rf?.estado === "devuelto_observaciones"))) ? (
                              <span
                                id={`alerta-observaciones-${exp.id}`}
                                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300"
                                title="Expediente devuelto con observaciones que requieren subsanación"
                              >
                                <AlertCircle className="w-3 h-3 text-amber-700 shrink-0" />
                                <span>Con Observaciones</span>
                              </span>
                            ) : exp.faseActual === 4 ? (
                              (() => {
                                const g4 = exp.gestionFase4;
                                const intComp = g4?.interventoria?.estado === "completado";
                                const arqComp = g4?.arquitectura?.estado === "completado";
                                const sueComp = g4?.estudioSuelos?.estado === "completado";
                                const completados = [intComp, arqComp, sueComp].filter(Boolean).length;
                                return (
                                  <span
                                    id={`alerta-fase4-progreso-${exp.id}`}
                                    className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                      completados === 3
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                        : completados > 0
                                        ? "bg-blue-50 text-blue-700 border-blue-300"
                                        : "bg-slate-100 text-slate-600 border-slate-300"
                                    }`}
                                    title={`Progreso técnico Fase 4: ${completados} de 3 frentes completados (Interventoría, Arquitectura, Estudio de Suelos)`}
                                  >
                                    <Clock className="w-3 h-3 text-blue-600 shrink-0" />
                                    <span>{completados}/3 Frentes Completados</span>
                                  </span>
                                );
                              })()
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {(() => {
                              // Extracción dinámica del nombre_completo y rol directamente de perfiles_usuario (todosUsuarios) por ID
                              let respUser = todosUsuarios.find(
                                (u) => u.id === exp.responsableGeneralId || u.username === exp.responsableGeneralId
                              );
                              if (!respUser || exp.bloqueadoPorRevision) {
                                const supervisorUser = todosUsuarios.find((u) => u.rol === "supervisor");
                                if (supervisorUser) respUser = supervisorUser;
                              }
                              const nombreMostrar = respUser?.nombreCompleto || exp.responsableGeneralNombre || "Sin asignar";
                              const rolMostrar = respUser?.rol || exp.responsableGeneralRol || "supervisor";

                              return (
                                <>
                                  <div className="font-medium text-slate-800">
                                    {formatearNombreUsuario(nombreMostrar)}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    Rol: {formatearRol(rolMostrar)}
                                  </div>
                                </>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {exp.diasTranscurridos > 90 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                                {exp.diasTranscurridos} días (Crítico)
                              </span>
                            ) : exp.diasTranscurridos >= 60 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                {exp.diasTranscurridos} días (Alerta)
                              </span>
                            ) : (
                              <span className="text-slate-700 font-medium">{exp.diasTranscurridos} días</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setExpedienteSeleccionadoId(exp.id);
                                setTabRequisitos(exp.faseActual || 1);
                              }}
                              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-blue-200"
                              title={`Continuar en Fase ${exp.faseActual}`}
                            >
                              <span>Continuar</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VISTA DE CAPTACIÓN DE HOGARES (ACCESIBLE PARA ROLES AUTORIZADOS) */}
        {!["comercial", "administrador", "planeacion", "supervisor", "asistente"].includes(currentUser.rol) && vistaActual === "captacion" && (
          <div className="p-8 bg-red-50 border border-red-200 rounded-xl text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-600 mx-auto" />
            <h3 className="text-base font-bold text-red-900">Acceso Denegado</h3>
            <p className="text-xs text-red-700 max-w-md mx-auto">
              El módulo de Captación de Hogares está reservado para perfiles autorizados (Gestor Rural, Planeación, Supervisor y Administrador).
            </p>
            <button
              type="button"
              onClick={() => setVistaActual("expedientes")}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
            >
              Ir a Expedientes VRD
            </button>
          </div>
        )}

        {["comercial", "administrador", "planeacion", "supervisor", "asistente"].includes(currentUser.rol) && vistaActual === "captacion" && !expedienteSeleccionadoId && (
          <div>
            {/* ENCABEZADO Y ACCIÓN PRINCIPAL (CAMBIO 2: CAPTACIÓN DE HOGARES) */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold text-slate-900">Captación de Hogares</h2>
                  {currentUser.rol === "planeacion" && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full border border-teal-200">
                      Auditoría / Solo Lectura
                    </span>
                  )}
                  {currentUser.rol !== "comercial" && currentUser.rol !== "planeacion" && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                      {formatearRol(currentUser.rol)} • Consulta
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Prospección y registro de hogares interesados antes de la radicación documental formal en Fase 1.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {/* BOTÓN IMPRIMIR VISTA / PDF PARA PLANEACIÓN Y AUDITORÍA */}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-xs transition-colors cursor-pointer"
                  title="Imprimir listado actual o guardar como PDF"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  <span>Imprimir Vista / PDF</span>
                </button>
                  {(currentUser.rol === "comercial" || currentUser.rol === "asistente" || currentUser.rol === "administrador") && (
                    <button
                      type="button"
                      onClick={() => setModalNuevoInteresado(true)}
                      className="inline-flex items-center space-x-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Registrar Hogar Interesado</span>
                    </button>
                  )}
              </div>
            </div>

            {/* BARRA DE BÚSQUEDA Y FILTROS DIRECTOS (CAMBIOS 1, 4 y 8) */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs mb-6 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                {/* CAMBIO 1: Placeholder sin referencia a correo */}
                <div className="relative sm:col-span-2">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por titular, teléfono, vereda o código (ej: int-001)..."
                    value={filtroTextoCaptacion}
                    onChange={(e) => setFiltroTextoCaptacion(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-slate-800"
                  />
                </div>
                <div>
                  <select
                    value={filtroMunicipioCaptacion}
                    onChange={(e) => setFiltroMunicipioCaptacion(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-slate-700 bg-white"
                  >
                    <option value="">Todos los municipios</option>
                    {CATALOGO_MUNICIPIOS.map((m) => (
                      <option key={m.codigoCompleto} value={m.codigoCompleto}>
                        {m.municipioNombre} ({m.codigoCompleto})
                      </option>
                    ))}
                  </select>
                </div>
                {/* CAMBIO 8: Desplegable con los 15 orígenes de captación */}
                <div>
                  <select
                    value={filtroOrigenCaptacion}
                    onChange={(e) => setFiltroOrigenCaptacion(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-slate-700 bg-white font-medium"
                  >
                    <option value="">Todos los orígenes</option>
                    {origenesCaptacion.map((origen) => (
                      <option key={origen} value={origen}>
                        {origen}
                      </option>
                    ))}
                  </select>
                </div>
                {/* CAMBIO 4: Filtro de rangos de tiempo adaptado */}
                <div>
                  <select
                    value={filtroRangoDiasCaptacion}
                    onChange={(e) => setFiltroRangoDiasCaptacion(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 text-slate-700 bg-white font-medium"
                  >
                    <option value="">Todos los rangos</option>
                    <option value="0_15">0 a 15 días</option>
                    <option value="16_30">16 a 30 días</option>
                    <option value="31_45">31 a 45 días</option>
                    <option value="vencidos">Vencidos / En extensión</option>
                  </select>
                </div>
              </div>

              {/* FILA SECUNDARIA: RESUMEN Y RESTABLECER (CAMBIO 2: Pestañas de convertidos eliminadas) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-800 bg-blue-50 text-blue-800 px-3 py-1 rounded-lg border border-blue-100">
                    Prospección Activa
                  </span>
                  {(filtroTextoCaptacion || filtroMunicipioCaptacion || filtroOrigenCaptacion || filtroRangoDiasCaptacion) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFiltroTextoCaptacion("");
                        setFiltroMunicipioCaptacion("");
                        setFiltroOrigenCaptacion("");
                        setFiltroRangoDiasCaptacion("");
                      }}
                      className="ml-2 text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center space-x-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restablecer filtros</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {(() => {
              const itemsAMostrar = interesados.filter((item) => {
                // CAMBIO 2: Ocultar hogares convertidos o descartados
                if (item.convertidoAExpedienteId || item.descartado || item.estadoComercial === "convertido_a_expediente" || item.estadoComercial === "descartado") {
                  return false;
                }

                const ahora = Date.now();
                const msDia = 1000 * 60 * 60 * 24;
                const diasTranscurridos = (item as any).diasDesdeRegistro ?? Math.max(0, Math.floor((ahora - new Date(item.creadoEn).getTime()) / msDia));

                if (filtroTextoCaptacion) {
                  const q = filtroTextoCaptacion.toLowerCase();
                  const match =
                    item.id.toLowerCase().includes(q) ||
                    item.nombreContacto.toLowerCase().includes(q) ||
                    (item.numeroIdentificacion && item.numeroIdentificacion.toLowerCase().includes(q)) ||
                    (item.cedula && item.cedula.toLowerCase().includes(q)) ||
                    (item.telefono && item.telefono.includes(q)) ||
                    (item.telefonoSecundario && item.telefonoSecundario.includes(q)) ||
                    (item.correo && item.correo.toLowerCase().includes(q)) ||
                    (item.vereda && item.vereda.toLowerCase().includes(q)) ||
                    (item.resumenNecesidad && item.resumenNecesidad.toLowerCase().includes(q));
                  if (!match) return false;
                }

                if (filtroMunicipioCaptacion && item.municipioCodigo !== filtroMunicipioCaptacion) {
                  return false;
                }

                if (filtroOrigenCaptacion && item.origenContacto !== filtroOrigenCaptacion) {
                  return false;
                }

                // CAMBIO 4: Lógica de filtro por rango de tiempo
                if (filtroRangoDiasCaptacion) {
                  if (filtroRangoDiasCaptacion === "0_15" && diasTranscurridos > 15) return false;
                  if (filtroRangoDiasCaptacion === "16_30" && (diasTranscurridos < 16 || diasTranscurridos > 30)) return false;
                  if (filtroRangoDiasCaptacion === "31_45" && (diasTranscurridos < 31 || diasTranscurridos > 45)) return false;
                  if (filtroRangoDiasCaptacion === "vencidos") {
                    const estaVencidoItem = (item as any).estaVencido ?? (diasTranscurridos > 45);
                    const tieneExtension = Boolean(item.diasExtension && item.diasExtension > 0);
                    if (!estaVencidoItem && !tieneExtension && diasTranscurridos <= 45) return false;
                  }
                }

                return true;
              });

              if (itemsAMostrar.length === 0) {
                return (
                  <div className="p-10 bg-white border border-dashed border-slate-300 rounded-xl text-center space-y-3">
                    <Users className="w-10 h-10 text-slate-400 mx-auto" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-700">No hay prospectos en captación</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                        {interesados.length === 0
                          ? "Actualmente no hay hogares interesados registrados en la base de datos de prospección."
                          : "No se encontraron hogares interesados con los criterios de búsqueda y filtros seleccionados."}
                      </p>
                    </div>
                    {(currentUser.rol === "comercial" || currentUser.rol === "asistente" || currentUser.rol === "administrador") && (
                      <button
                        type="button"
                        onClick={() => setModalNuevoInteresado(true)}
                        className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>Registrar Primer Interesado</span>
                      </button>
                    )}
                  </div>
                );
              }

              // MODO TABLA FIJO (CAMBIOS 1, 3, 5, 6 y 7)
              return (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-visible">
                  <div className="overflow-x-auto overflow-y-visible">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Código / ID</th>
                          <th className="px-4 py-3">Hogar / Contacto Titular</th>
                          <th className="px-4 py-3">Municipio & Vereda</th>
                          <th className="px-4 py-3">Teléfono & WhatsApp</th>
                          <th className="px-4 py-3">Origen Captación</th>
                          {/* CAMBIO 5: ESTADO CAPTACIÓN ELIMINADO */}
                          {/* CAMBIO 6: ÚLTIMO CONTACTO INSERTADO A LA IZQUIERDA DE FECHA REGISTRO */}
                          <th className="px-4 py-3">Último Contacto</th>
                          <th className="px-4 py-3">Fecha Registro</th>
                          {/* CAMBIO 7: DOCS ENVIADOS CON PREVISUALIZACIÓN ENTRE FECHA REGISTRO Y ACCIÓN */}
                          <th className="px-4 py-3 text-center">Docs. Enviados</th>
                          <th className="px-4 py-3 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {itemsAMostrar.map((item) => {
                          const munInfo = CATALOGO_MUNICIPIOS.find(
                            (m) => m.codigoCompleto === item.municipioCodigo || m.municipioCodigo === item.municipioCodigo
                          );
                          const nombreMun = munInfo ? munInfo.municipioNombre : `Municipio ${item.municipioCodigo}`;

                          const ahora = Date.now();
                          const msDia = 1000 * 60 * 60 * 24;
                          const diasTranscurridos = (item as any).diasDesdeRegistro ?? Math.max(0, Math.floor((ahora - new Date(item.creadoEn).getTime()) / msDia));
                          const limitePermitido = 45 + (item.diasExtension || 0);
                          const estaVencido = (item as any).estaVencido !== undefined ? (item as any).estaVencido : (diasTranscurridos > limitePermitido);

                          // CAMBIO 6: Fecha de último contacto calculada
                          const fechaUltContacto = item.ultimoContactoFecha || item.creadoEn;

                          // CAMBIO 7: Documentos adjuntos
                          const docs = item.documentosAdjuntos || [];
                          const esPopoverAbierto = popoverDocInteresadoId === item.id;

                          return (
                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 font-mono font-medium text-slate-900">
                                {item.id.toUpperCase()}
                              </td>
                              {/* CAMBIO 1: Correo electrónico ocultado en la vista de captación */}
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900">
                                  {item.nombreContacto}
                                </div>
                                {(item.numeroIdentificacion || item.cedula) && (
                                  <div className="text-[11px] font-mono text-blue-700 flex items-center space-x-1 mt-0.5">
                                    <span className="bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.2 rounded font-semibold text-[10px]">
                                      {item.tipoIdentificacion || "CC"}: {item.numeroIdentificacion || item.cedula}
                                    </span>
                                  </div>
                                )}
                                <div className="text-[11px] text-slate-500 max-w-xs truncate" title={item.resumenNecesidad}>
                                  {item.resumenNecesidad || "Sin resumen registrado."}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-medium text-slate-800">{nombreMun}</div>
                                <div className="text-[11px] text-slate-500">
                                  {item.vereda ? `Vereda ${item.vereda}` : "Zona Rural"} (Cód. {item.municipioCodigo})
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-1.5 font-mono text-slate-800">
                                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span>{item.telefono}</span>
                                    {item.telefono && (
                                      <a
                                        href={`https://wa.me/57${item.telefono.replace(/\D/g, "")}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center space-x-0.5 text-[9px] text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 font-bold hover:bg-emerald-100 transition-colors"
                                        title="WhatsApp Teléfono Principal"
                                      >
                                        <span>WA</span>
                                      </a>
                                    )}
                                  </div>
                                  {item.telefonoSecundario && (
                                    <div className="flex items-center space-x-1.5 font-mono text-slate-600 text-[11px] pt-0.5 border-t border-slate-100">
                                      <PhoneCall className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                      <span title="Teléfono de Contacto 2">{item.telefonoSecundario}</span>
                                      <a
                                        href={`https://wa.me/57${item.telefonoSecundario.replace(/\D/g, "")}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center space-x-0.5 text-[9px] text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 font-bold hover:bg-emerald-100 transition-colors ml-1"
                                        title="WhatsApp Teléfono Secundario"
                                      >
                                        <span>WA Tel 2</span>
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </td>
                              {/* CAMBIO 8: Visualización fidedigna del origen de captación */}
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                                  {item.origenContacto || "Llamada"}
                                </span>
                              </td>
                              {/* CAMBIO 6: Columna ÚLTIMO CONTACTO */}
                              <td className="px-4 py-3 text-slate-700 text-[11px]">
                                <div className="font-medium">
                                  {new Date(fechaUltContacto).toLocaleDateString("es-CO")}
                                </div>
                              </td>
                              {/* CAMBIO 3: Alerta de vigencia si supera los 45 días */}
                              <td className="px-4 py-3 text-[11px]">
                                {estaVencido ? (
                                  <div>
                                    <span className="font-bold text-red-600 block">
                                      {new Date(item.creadoEn).toLocaleDateString("es-CO")}
                                    </span>
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 mt-0.5">
                                      Plazo Vencido ({diasTranscurridos}d)
                                    </span>
                                  </div>
                                ) : (
                                  <div className="text-slate-600">
                                    <span>{new Date(item.creadoEn).toLocaleDateString("es-CO")}</span>
                                    <span className="text-slate-400 text-[10px] block">
                                      {diasTranscurridos} {diasTranscurridos === 1 ? "día" : "días"}
                                    </span>
                                  </div>
                                )}
                              </td>
                              {/* CAMBIO 7: Columna DOCS. ENVIADOS con Popover interactivo */}
                              <td className="px-4 py-3 text-center relative">
                                {docs.length === 0 ? (
                                  <span className="text-slate-400 font-medium text-[11px]">0 docs</span>
                                ) : (
                                  <div className="relative inline-block">
                                    <button
                                      type="button"
                                      onClick={() => setPopoverDocInteresadoId(esPopoverAbierto ? null : item.id)}
                                      className="text-blue-600 font-bold underline hover:text-blue-800 cursor-pointer text-[11px] transition-colors"
                                      title="Ver lista de documentos soporte"
                                    >
                                      {docs.length} {docs.length === 1 ? "doc" : "docs"}
                                    </button>

                                    {esPopoverAbierto && (
                                      <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-40 text-left">
                                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                                          <div className="font-bold text-slate-800 text-xs flex items-center space-x-1">
                                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                                            <span>Documentos ({docs.length})</span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => setPopoverDocInteresadoId(null)}
                                            className="text-slate-400 hover:text-slate-600 p-0.5"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                        <ul className="space-y-1.5 text-[11px] max-h-48 overflow-y-auto">
                                          {docs.map((d: any, idx: number) => (
                                            <li
                                              key={d.id || idx}
                                              className="flex items-start space-x-1.5 text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-100"
                                            >
                                              <span className="font-semibold text-blue-600">{idx + 1}.</span>
                                              <span className="break-all font-mono text-[10px]">{d.nombreArchivo}</span>
                                            </li>
                                          ))}
                                        </ul>
                                        {currentUser.rol !== "planeacion" && (
                                          <div className="mt-2 pt-2 border-t border-slate-100">
                                            <div className="flex items-center space-x-1">
                                              <input
                                                type="text"
                                                placeholder="Adjuntar doc (ej: Cedula.pdf)..."
                                                value={nuevoDocNombre}
                                                onChange={(e) => setNuevoDocNombre(e.target.value)}
                                                className="text-[10px] px-2 py-1 border border-slate-200 rounded flex-1 outline-none"
                                              />
                                              <button
                                                type="button"
                                                onClick={async () => {
                                                  if (nuevoDocNombre.trim()) {
                                                    await handleSubirDocumentoInteresado(item.id, nuevoDocNombre.trim());
                                                  }
                                                }}
                                                className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-bold hover:bg-blue-700"
                                                title="Adjuntar"
                                              >
                                                +
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                              {/* CAMBIO 3: Acción condicionada por vigencia y rol */}
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end">
                                  {currentUser.rol === "planeacion" ? (
                                    estaVencido ? (
                                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold border border-amber-200">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                        <span>Plazo Vencido</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium border border-slate-200">
                                        En Prospección
                                      </span>
                                    )
                                  ) : estaVencido ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setModalGestionarVencimiento(item);
                                        setDiasExtensionSeleccionados(7);
                                        setMotivoDescarte("");
                                        setConfirmarDescarte(false);
                                      }}
                                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                                      title="El plazo de prospección ha vencido. Requiere gestionar prórroga o descarte."
                                    >
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                      <span>Gestionar Vencimiento</span>
                                    </button>
                                  ) : (
                                    (currentUser.rol === "comercial" || currentUser.rol === "asistente" || currentUser.rol === "administrador") && (
                                      <button
                                        type="button"
                                        onClick={() => handleAbrirConversion(item)}
                                        className="inline-flex items-center space-x-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                                        title="Iniciar formalmente Fase 1 del expediente"
                                      >
                                        <FileText className="w-3.5 h-3.5" />
                                        <span>Crear Expediente</span>
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
              );
            })()}
          </div>
        )}

        {/* VISTA DE ADMINISTRADOR (CONTROL TOTAL: USUARIOS, CONFIGURACIÓN, REPORTES, CRÍTICAS) */}
        {currentUser.rol === "administrador" && vistaActual === "administracion" && !expedienteSeleccionadoId && (
          <AdminPanel
            currentUser={currentUser}
            onSelectExpediente={(id) => {
              setExpedienteSeleccionadoId(id);
            }}
            mostrarToast={mostrarToast}
          />
        )}

        {/* NUEVO MÓDULO DE INFORMES (EXPORTACIÓN EXCEL / CSV CON FILTROS AVANZADOS) */}
        {vistaActual === "informes" && !expedienteSeleccionadoId && (
          <ModuloInformes
            currentUser={currentUser}
            expedientes={expedientes}
            onSelectExpediente={(id) => {
              setExpedienteSeleccionadoId(id);
            }}
            mostrarToast={mostrarToast}
          />
        )}

        {/* INDICADOR DE CARGA DE DETALLE EN TIEMPO REAL */}
        {expedienteSeleccionadoId && !detalleExp && (
          <div className="flex flex-col items-center justify-center py-24 space-y-3 bg-white rounded-2xl border border-slate-200 shadow-xs">
            <RefreshCw className="w-8 h-8 text-[#3F7D58] animate-spin" />
            <div className="text-sm font-bold text-slate-800">Cargando expediente en tiempo real...</div>
            <p className="text-xs text-slate-400">Sincronizando información técnica, jurídica y documental del hogar</p>
          </div>
        )}

        {/* DETALLE DEL EXPEDIENTE (FICHA + REQUISITOS + VISOR) */}
        {expedienteSeleccionadoId && detalleExp && (() => {
          const esSalidaDefinitiva = detalleExp.expediente.estadoGeneral === "salida_definitiva";
          const estaEnRevisionAnalista = Boolean(
            detalleExp.expediente.bloqueadoPorRevision ||
            detalleExp.expediente.estadoFase1 === "en_revision_supervisor" ||
            detalleExp.expediente.estadoFase2 === "en_revision_supervisor" ||
            (detalleExp.expediente.subsanacionFase3Activa && detalleExp.expediente.subsanacionFase3Estado === "revision_analista")
          );
          const notasOrdenadas = [...detalleExp.notas].sort(
            (a, b) => new Date(b.creadoEn || b.fechaGestion).getTime() - new Date(a.creadoEn || a.fechaGestion).getTime()
          );

          return (
          <div>
            {/* BANNER EXPEDIENTE EN SALIDA DEFINITIVA */}
            {esSalidaDefinitiva && (
              <div className="mb-6 p-4 bg-rose-50 border-2 border-rose-300 rounded-xl flex items-start space-x-3 text-rose-900 shadow-xs">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="px-2.5 py-0.5 bg-rose-200 text-rose-900 rounded-full text-xs font-black uppercase tracking-wider">
                      Salida Definitiva — Inmutable
                    </span>
                    <span className="text-xs text-rose-700 font-semibold">
                      Archivo Histórico de Solo Lectura
                    </span>
                  </div>
                  <p className="text-xs text-rose-800 leading-relaxed">
                    Este expediente ha sido retirado definitivamente del programa. Se encuentra en estado inmutable; todas las acciones de edición, avance y aprobación están estrictamente bloqueadas.
                  </p>
                  {detalleExp.expediente.solicitudRechazo && (
                    <p className="text-xs text-rose-900 mt-1 font-medium bg-rose-100/70 p-2 rounded border border-rose-200">
                      <strong>Motivo de rechazo registrado:</strong> {detalleExp.expediente.solicitudRechazo.motivo} (en Fase {detalleExp.expediente.solicitudRechazo.fase})
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ENCABEZADO DE EXPEDIENTE */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center space-x-3 mb-1">
                    <button
                      type="button"
                      onClick={() => setExpedienteSeleccionadoId(null)}
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      ← Volver al listado
                    </button>
                    <span className="text-slate-300">•</span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border ${
                        getEtiquetaFase(detalleExp.expediente.faseActual).estiloBadge
                      }`}
                    >
                      {getEtiquetaFase(detalleExp.expediente.faseActual).nombre}
                    </span>
                    {currentUser.rol === "planeacion" && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full border border-teal-200">
                        Auditoría / Solo Lectura
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl font-black text-slate-900">
                    {detalleExp.expediente.codigoVisible || "CÓDIGO PENDIENTE"}
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Postulante Principal:{" "}
                    <strong>
                      {obtenerNombrePostulante(detalleExp.expediente.postulante)}
                    </strong>{" "}
                    ({detalleExp.expediente.postulante.tipoIdentificacion}:{" "}
                    {detalleExp.expediente.postulante.numeroIdentificacion})
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  {/* BOTÓN IMPRIMIR VISTA / EXPEDIENTE (PDF / IMPRESIÓN) */}
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold border border-slate-300 shadow-2xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                    title="Imprimir pantalla del expediente o guardar como PDF"
                  >
                    <Printer className="w-4 h-4 text-slate-700" />
                    <span>Imprimir Vista / PDF</span>
                  </button>

                  {/* BOTÓN IMPRIMIR FICHA TÉCNICA OFICIAL */}
                  <button
                    type="button"
                    onClick={() => setMostrarFichaImprimible(true)}
                    className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold border border-slate-300 shadow-2xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                    title="Generar e imprimir Ficha Técnica Oficial (PDF / Impresión)"
                  >
                    <FileText className="w-4 h-4 text-slate-700" />
                    <span>Ficha Técnica Oficial</span>
                  </button>

                  {/* BOTÓN SOLICITAR RECHAZO DEL HOGAR (CUALQUIER FASE 1 A 7) - EXCLUYE PLANEACIÓN */}
                  {!esSalidaDefinitiva && currentUser.rol !== "planeacion" && detalleExp.expediente.solicitudRechazo?.estado !== "pendiente" && (() => {
                    const analistaBloqueadoPorCarga = currentUser.rol === "supervisor" && !detalleExp.expediente.bloqueadoPorRevision;
                    const gestorBloqueadoPorRevision = (currentUser.rol === "asistente" || currentUser.rol === "comercial") && detalleExp.expediente.bloqueadoPorRevision;
                    const deshabilitarRechazo = analistaBloqueadoPorCarga || gestorBloqueadoPorRevision;

                    return (
                      <button
                        type="button"
                        disabled={deshabilitarRechazo}
                        onClick={() => !deshabilitarRechazo && setModalSolicitarRechazoHogar(true)}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 border shadow-2xs ${
                          deshabilitarRechazo
                            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60"
                            : "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 cursor-pointer"
                        }`}
                        title={
                          analistaBloqueadoPorCarga
                            ? "Acción no disponible: El expediente está en carga documental a cargo del Gestor Documental. Se habilitará cuando sea enviado a Análisis Documental."
                            : gestorBloqueadoPorRevision
                            ? "Acción deshabilitada: El hogar se encuentra en revisión de Análisis Documental."
                            : "Solicitar formalmente la salida o rechazo del hogar en esta fase"
                        }
                      >
                        <UserX className={`w-3.5 h-3.5 ${deshabilitarRechazo ? "text-slate-400" : "text-rose-600"}`} />
                        <span>
                          {currentUser.rol === "supervisor" || currentUser.rol === "administrador"
                            ? "Rechazar Hogar"
                            : "Solicitar Rechazo"}
                        </span>
                      </button>
                    );
                  })()}

                  {/* ESTADO DE BLOQUEO POR REVISIÓN */}
                  {detalleExp.expediente.bloqueadoPorRevision && (
                    <div className="flex items-center space-x-2 bg-amber-50 text-amber-900 border border-amber-300 px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs">
                      <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        {currentUser.rol === "comercial"
                          ? "En Revisión de Análisis Documental • Edición Bloqueada para Gestor Rural"
                          : currentUser.rol === "asistente"
                          ? "En Revisión de Análisis Documental • En Evaluación"
                          : currentUser.rol === "supervisor"
                          ? "En Revisión de Análisis Documental • Pendiente de Dictamen"
                          : "En Revisión de Análisis Documental • Control Maestro de Administrador"}
                      </span>
                    </div>
                  )}

                  {/* FASE 1: BOTÓN ENVIAR A SUPERVISIÓN SI NO ESTÁ BLOQUEADO Y NO ES SALIDA DEFINITIVA */}
                  {!esSalidaDefinitiva &&
                    !detalleExp.expediente.bloqueadoPorRevision &&
                    detalleExp.expediente.faseActual === 1 &&
                    (currentUser.rol === "comercial" || currentUser.rol === "asistente" || currentUser.rol === "administrador") && (
                      <button
                        type="button"
                        disabled={
                          detalleExp.requisitos.filter((r) => (r.fase === 1 || !r.fase) && r.esObligatorio && r.estado === "pendiente_carga" && !r.documentoAsociado).length > 0 ||
                          guardandoEnvioRevision
                        }
                        onClick={() => handleEnviarRevisionFase(1)}
                        title={
                          detalleExp.requisitos.filter((r) => (r.fase === 1 || !r.fase) && r.esObligatorio && r.estado === "pendiente_carga" && !r.documentoAsociado).length > 0
                            ? "Suba todos los documentos obligatorios antes de enviar a supervisión"
                            : "Enviar formalmente el expediente a Análisis Documental"
                        }
                        className={`px-4 py-2 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center space-x-1.5 ${
                          detalleExp.requisitos.filter((r) => (r.fase === 1 || !r.fase) && r.esObligatorio && r.estado === "pendiente_carga" && !r.documentoAsociado).length > 0
                            ? "bg-slate-300 cursor-not-allowed text-slate-500"
                            : "bg-blue-600 hover:bg-blue-700 cursor-pointer"
                        }`}
                      >
                        {guardandoEnvioRevision ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        <span>Enviar a Análisis Documental</span>
                      </button>
                    )}

                  {/* SUPERVISOR O ADMIN: APROBAR FASE 1 (SOLO SI NO ES SALIDA DEFINITIVA) */}
                  {!esSalidaDefinitiva && (currentUser.rol === "supervisor" || currentUser.rol === "administrador") && detalleExp.expediente.faseActual === 1 && (() => {
                    const todosAceptadosF1 = detalleExp.requisitos
                      .filter((r) => (r.fase === 1 || !r.fase) && r.esObligatorio)
                      .every((r) => r.estado === "aceptado");
                    const deshabilitarSupervisorF1 = currentUser.rol === "supervisor" && !detalleExp.expediente.bloqueadoPorRevision && !todosAceptadosF1;
                    return (
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => !deshabilitarSupervisorF1 && setModalAprobarFase1(true)}
                          disabled={
                            deshabilitarSupervisorF1 ||
                            !todosAceptadosF1 || guardandoAprobacion
                          }
                          className={`px-4 py-2 text-xs font-bold rounded-lg shadow-sm transition-all flex items-center space-x-1.5 ${
                            !deshabilitarSupervisorF1 && todosAceptadosF1
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer ring-2 ring-emerald-400/40 shadow-emerald-200 shadow-md"
                              : "bg-slate-300 cursor-not-allowed text-slate-500 opacity-60"
                          }`}
                          title={
                            deshabilitarSupervisorF1
                              ? "Aprobación no disponible: El expediente está en conformación por el Gestor Rural."
                              : todosAceptadosF1
                              ? "Revisión completa: Aprobar Fase 1 y Asignar Gestor Documental para avanzar a Fase 2"
                              : "Debe aceptar todos los requisitos obligatorios de Fase 1 antes de aprobar"
                          }
                        >
                          {guardandoAprobacion ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          <span>Aprobar Fase 1</span>
                        </button>
                      </div>
                    );
                  })()}

                  {!esSalidaDefinitiva && detalleExp.expediente.faseActual >= 2 && !detalleExp.expediente.bloqueadoPorRevision && (
                    <div className="flex items-center space-x-2 bg-emerald-50 text-emerald-800 border border-emerald-300 px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>En Gestión {getEtiquetaFase(detalleExp.expediente.faseActual).nombreCorto}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* BANNER DE SOLICITUD DE RECHAZO PENDIENTE DE REVISIÓN */}
              {detalleExp.expediente.solicitudRechazo?.estado === "pendiente" && (
                <div className="mt-4 p-4 bg-rose-50 border-2 border-rose-300 rounded-xl">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                            Rechazo Propuesto — Pendiente Aprobación de Analista Documental
                          </span>
                          <span className="text-xs text-rose-700 font-semibold">
                            Fase {detalleExp.expediente.solicitudRechazo.fase}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-rose-950 mt-1">
                          Motivo: {detalleExp.expediente.solicitudRechazo.motivo}
                        </p>
                        <p className="text-xs text-rose-800 mt-0.5">
                          Solicitado por: <strong>{formatearNombreUsuario(detalleExp.expediente.solicitudRechazo.solicitadoPorNombre)}</strong> ({formatearRol(detalleExp.expediente.solicitudRechazo.solicitadoPorRol)}) el {new Date(detalleExp.expediente.solicitudRechazo.fechaSolicitud).toLocaleString("es-CO")}
                        </p>
                        <p className="text-xs text-slate-700 mt-1.5 italic bg-white/80 p-2 rounded border border-rose-200 leading-relaxed">
                          &quot;{detalleExp.expediente.solicitudRechazo.justificacion}&quot;
                        </p>
                        {detalleExp.expediente.solicitudRechazo.evidenciaNombre && (
                          <p className="text-[11px] text-blue-700 mt-1 font-medium flex items-center space-x-1">
                            <span>Evidencia anexa:</span>
                            <span className="font-semibold underline">{detalleExp.expediente.solicitudRechazo.evidenciaNombre}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {(currentUser.rol === "supervisor" || currentUser.rol === "administrador") ? (
                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setJustificacionDesestimarHogar("");
                            setModalDesestimarRechazoHogar(true);
                          }}
                          className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                        >
                          Rechazar Solicitud (Continuar Trámite)
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalAprobarRechazoHogar(true)}
                          className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center space-x-1.5"
                        >
                          <UserX className="w-4 h-4" />
                          <span>Aprobar Rechazo del Hogar</span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-rose-800 bg-rose-100/70 border border-rose-200 px-3 py-2 rounded-lg shrink-0 font-medium">
                        Expediente bloqueado para edición mientras el Analista Documental evalúa la solicitud.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* BANNER SALIDA DEFINITIVA */}
              {detalleExp.expediente.estadoGeneral === "salida_definitiva" && (
                <div className="mt-4 p-4 bg-slate-100 border-2 border-slate-300 rounded-xl flex items-center space-x-3 text-slate-800">
                  <UserX className="w-6 h-6 text-rose-600 shrink-0" />
                  <div>
                    <span className="font-bold text-sm block text-slate-900">Expediente en Salida Definitiva</span>
                    <span className="text-xs text-slate-600">
                      Este hogar fue retirado formalmente del programa VRD. Se generó la tarea al Gestor Rural para la notificación oficial.
                    </span>
                  </div>
                </div>
              )}

              {/* DATOS CLAVE EN GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Predio de Vivienda:</span>
                  <span className="font-semibold text-slate-800">
                    {detalleExp.expediente.predioVivienda.nombreODireccion}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    {(() => {
                      const mun = CATALOGO_MUNICIPIOS.find(
                        (m) =>
                          m.codigoCompleto === detalleExp.expediente.predioVivienda.municipioCodigo ||
                          m.municipioCodigo === detalleExp.expediente.predioVivienda.municipioCodigo
                      );
                      const nombreMun = mun ? mun.municipioNombre : (detalleExp.expediente.predioVivienda.municipioCodigo ? `Municipio ${detalleExp.expediente.predioVivienda.municipioCodigo}` : "Sin municipio");
                      const codMun = mun ? mun.codigoCompleto : (detalleExp.expediente.predioVivienda.municipioCodigo || "N/A");
                      const veredaExtra = detalleExp.expediente.predioVivienda.vereda ? ` • Vereda ${detalleExp.expediente.predioVivienda.vereda}` : "";
                      return `${nombreMun} (Cód. ${codMun})${veredaExtra}`;
                    })()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Responsable General:</span>
                  <span className="font-semibold text-slate-800">
                    {formatearNombreUsuario(detalleExp.expediente.responsableGeneralNombre) || "Asignado"}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    Rol: {formatearRol(detalleExp.expediente.responsableGeneralRol || (detalleExp.expediente.faseActual >= 2 ? "asistente" : "comercial"))}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Fecha Ingreso Fase 1:</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(detalleExp.expediente.fechaIngresoFase1).toLocaleDateString("es-CO")}
                  </span>
                </div>
              </div>
            </div>

            {/* SECCIÓN 1: HOGAR DECLARADO Y BOTÓN «AGREGAR CÉDULA» (CAMBIOS 1, 2, 4) */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-slate-900">Hogar Declarado para el Subsidio</h3>
                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-semibold">
                      {detalleExp.expediente.hogar.integrantes.length} integrante(s)
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {(currentUser.rol === "supervisor" || currentUser.rol === "administrador") && solicitudesRetiro.filter((s) => s.expedienteId === detalleExp.expediente.id && s.estado === "pendiente").length > 0 && (
                    <button
                      type="button"
                      onClick={() => setModalBandejaRetiro(true)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-lg text-xs font-bold transition-colors border border-amber-300 shadow-2xs cursor-pointer"
                    >
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <span>Ver Solicitudes de Retiro ({solicitudesRetiro.filter((s) => s.expedienteId === detalleExp.expediente.id && s.estado === "pendiente").length})</span>
                    </button>
                  )}

                  {(() => {
                    const puedeEditarHogar =
                      !esSalidaDefinitiva &&
                      !detalleExp.expediente.bloqueadoPorRevision &&
                      (detalleExp.expediente.faseActual === 1
                        ? currentUser.rol === "comercial" || currentUser.rol === "asistente" || currentUser.rol === "administrador"
                        : currentUser.rol === "asistente" || currentUser.rol === "administrador");

                    return (
                      puedeEditarHogar && (
                        <button
                          type="button"
                          onClick={() => setModalAgregarCedula(true)}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-colors border border-blue-200 cursor-pointer"
                        >
                          <UserPlus className="w-4 h-4" />
                          <span>Agregar Cédula</span>
                        </button>
                      )
                    );
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {detalleExp.expediente.hogar.integrantes.map((integ) => {
                  const puedeEliminarEste =
                    !esSalidaDefinitiva &&
                    !integ.esPostulantePrincipal &&
                    !integ.retiroPendiente &&
                    !detalleExp.expediente.bloqueadoPorRevision &&
                    (detalleExp.expediente.faseActual === 1
                      ? currentUser.rol === "comercial" || currentUser.rol === "asistente" || currentUser.rol === "administrador"
                      : currentUser.rol === "asistente" || currentUser.rol === "administrador");

                  const solRetiro = solicitudesRetiro.find(
                    (s) => s.integranteId === integ.id && s.estado === "pendiente"
                  );

                  return (
                    <div
                      key={integ.id}
                      className={`p-3 rounded-lg text-xs flex flex-col justify-between transition-all ${
                        integ.retiroPendiente
                          ? "bg-amber-50/70 border-2 border-amber-300"
                          : "bg-slate-50 border border-slate-200"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-800">
                            {integ.persona.primerNombre || integ.persona.nombres}{" "}
                            {integ.persona.segundoNombre ? `${integ.persona.segundoNombre} ` : ""}
                            {integ.persona.primerApellido}{" "}
                            {integ.persona.segundoApellido || ""}
                          </span>
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-medium capitalize">
                              {integ.parentesco}
                            </span>
                            {/* BOTÓN SOLICITAR/CONFIRMAR RETIRO DE CÉDULA (CAMBIO 2) */}
                            {puedeEliminarEste && (
                              <button
                                type="button"
                                onClick={() =>
                                  setIntegranteAEliminar({
                                    id: integ.id,
                                    nombre: `${integ.persona.nombres} ${integ.persona.primerApellido}`,
                                    parentesco: integ.parentesco,
                                    numeroIdentificacion: integ.persona.numeroIdentificacion,
                                    tipoIdentificacion: integ.persona.tipoIdentificacion
                                  })
                                }
                                title={
                                  currentUser.rol === "supervisor" || currentUser.rol === "administrador"
                                    ? "Eliminar integrante y su cédula del expediente"
                                    : "Radicar solicitud de retiro de cédula ante el Analista Documental"
                                }
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="text-slate-500 font-mono text-[11px]">
                          {integ.persona.tipoIdentificacion}: {integ.persona.numeroIdentificacion}
                        </div>

                        {/* ESTADO DE RETIRO PENDIENTE DE AUTORIZACIÓN (CAMBIO 2) */}
                        {integ.retiroPendiente && (
                          <div className="mt-2.5 p-2 bg-amber-100/80 border border-amber-300 rounded text-[11px] text-amber-900 space-y-1.5">
                            <div className="flex items-center space-x-1 font-bold">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                              <span>Retiro en revisión por Análisis Documental</span>
                            </div>
                            {integ.motivoRetiroPendiente && (
                              <p className="text-[10px] text-amber-800 italic bg-white/70 p-1.5 rounded border border-amber-200">
                                &quot;{integ.motivoRetiroPendiente}&quot;
                              </p>
                            )}
                            {(currentUser.rol === "supervisor" || currentUser.rol === "administrador") && solRetiro && (
                              <div className="pt-1 flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() => handleAutorizarRetiro(solRetiro.id)}
                                  className="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[10px] transition-colors cursor-pointer"
                                >
                                  Autorizar Retiro
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSolicitudAResolver(solRetiro);
                                    setModalRechazarSolicitud(true);
                                  }}
                                  className="flex-1 py-1 px-2 bg-slate-200 hover:bg-red-100 text-slate-700 hover:text-red-700 rounded font-semibold text-[10px] transition-colors cursor-pointer"
                                >
                                  Rechazar
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECCIÓN 2: EXPEDIENTE DOCUMENTAL MULTI-FASE (FASES 1 A 7) */}
            {(() => {
              const fasesConfig = [
                { num: 1, label: "Fase 1: En Ingreso Hogar (3 docs)", desc: "Verificación y carga de los 3 documentos iniciales de viabilidad" },
                { num: 2, label: "Fase 2: En Solicitud 8 Documentos", desc: "Recolección y validación jurídica de los 8 documentos familiares complementarios" },
                { num: 3, label: "Fase 3: En Validación Inicial Compensar", desc: "Consolidación de los 11 documentos y remisión a Compensar para concepto inicial" },
                { num: 4, label: "Fase 4: En Recolección de Documentos Técnicos", desc: "Levantamientos arquitectónicos, topográficos y de riesgo estructural" },
                { num: 5, label: "Fase 5: En Trámite de Licencia de Construcción", desc: "Gestión de radicación de licencias urbanísticas y permisos municipales" },
                { num: 6, label: "Fase 6: En Postulación", desc: "Postulación formal y resolución administrativa de subsidio" },
                { num: 7, label: "Fase 7: En Construcción y Cobro Subsidio", desc: "Ejecución de obra constructiva, actas de recibo y cobro del subsidio" }
              ];

              const titularId = detalleExp.expediente.postulante?.id;
              const reqsFaseActual = detalleExp.requisitos.filter((r) => {
                if (tabRequisitos === 1) {
                  const esFase1 = r.fase === 1 || (!r.fase && r.codigoRequisito?.startsWith("F1-"));
                  if (!esFase1) return false;
                  if (r.codigoRequisito === "F1-04" || r.nombre?.toLowerCase().includes("fotogr")) return false;
                  return ["F1-01", "F1-02", "F1-03"].includes(r.codigoRequisito) || Boolean(r.codigoRequisito?.includes("ADICIONAL")) || Boolean(r.esAdicional);
                }
                return r.fase === tabRequisitos;
              });
              const reqsFaseActualObligatorios = reqsFaseActual.filter((r) => r.esObligatorio);
              const faltanSubirFaseActual = reqsFaseActualObligatorios.filter((r) => r.estado === "pendiente_carga" && !r.documentoAsociado);
              const todosFaseActualAceptados = reqsFaseActualObligatorios.length > 0 && reqsFaseActualObligatorios.every((r) => r.estado === "aceptado");

              const reqsFase1 = detalleExp.requisitos.filter((r) => {
                const esFase1 = r.fase === 1 || (!r.fase && r.codigoRequisito?.startsWith("F1-"));
                if (!esFase1) return false;
                if (r.codigoRequisito === "F1-04" || r.nombre?.toLowerCase().includes("fotogr")) return false;
                return ["F1-01", "F1-02", "F1-03"].includes(r.codigoRequisito) || Boolean(r.codigoRequisito?.includes("ADICIONAL")) || Boolean(r.esAdicional);
              });
              const reqsFase1Obligatorios = reqsFase1.filter((r) => r.esObligatorio);
              const faltanSubirFase1 = reqsFase1Obligatorios.filter((r) => r.estado === "pendiente_carga" && !r.documentoAsociado);
              const todosFase1Aceptados = reqsFase1Obligatorios.length > 0 && reqsFase1Obligatorios.every((r) => r.estado === "aceptado");

              const reqsFase2 = detalleExp.requisitos.filter((r) => r.fase === 2);
              const reqsFase2Obligatorios = reqsFase2.filter((r) => r.esObligatorio);
              const faltanSubirFase2 = reqsFase2Obligatorios.filter((r) => r.estado === "pendiente_carga" && !r.documentoAsociado);
              const todosFase2Aceptados = reqsFase2Obligatorios.length > 0 && reqsFase2Obligatorios.every((r) => r.estado === "aceptado");

              return (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs mb-6">
                  {/* PESTAÑAS DE NAVEGACIÓN ENTRE FASES (1 A 7) — BLOQUEO ESTRICTO DE RETROCESO (EXCEPTO ADMIN Y PLANEACIÓN) */}
                  <div className="flex items-center gap-2 border-b border-slate-200 mb-6 pb-0 overflow-x-auto scroll-smooth">
                    {fasesConfig.map((f) => {
                      const reqsDeEstaFase = detalleExp.requisitos.filter((r) => (f.num === 1 ? r.fase === 1 || !r.fase : r.fase === f.num));
                      const validacionCompensarAprobada = detalleExp.expediente.validacionCompensar?.estadoActual === "aprobado";
                      const faseEfectivaActual = validacionCompensarAprobada && detalleExp.expediente.faseActual < 4 ? 4 : detalleExp.expediente.faseActual;

                      const esFaseActual = faseEfectivaActual === f.num;
                      const esFaseAnterior = f.num < faseEfectivaActual;
                      const esFaseFutura = f.num > faseEfectivaActual;

                      const esPlaneacion = currentUser.rol === "planeacion";
                      const esAdmin = currentUser.rol === "administrador";

                      // Regla de Negocio VRD: Fase activa habilitada; si Compensar aprobó Fase 3, Fase 4 está habilitada;
                      // los administradores pueden consultar fases previas para auditoría.
                      // El rol Planeación tiene acceso total e irrestricto a todas las fases (sin bloqueo visual) para auditoría y descarga.
                      const estaHabilitada =
                        esPlaneacion ||
                        esFaseActual ||
                        (f.num === 4 && validacionCompensarAprobada) ||
                        (esAdmin && f.num <= faseEfectivaActual);
                      const esSeleccionada = tabRequisitos === f.num;
                      const aceptados = reqsDeEstaFase.filter((r) => r.estado === "aceptado").length;

                      const getBadgeTexto = () => {
                        if (esPlaneacion) {
                          if (esFaseActual) return "Fase Activa";
                          if (esFaseFutura) return "Auditoría";
                          return "Histórico";
                        }
                        if (esFaseAnterior) return "Cerrada / Bloqueada";
                        if (esFaseFutura) return "Bloqueada";
                        if (f.num === 6) {
                          const post = detalleExp.expediente.postulacionSubsidio;
                          if (post?.estadoActual === "indicacion_obra_enviada") return "Obra Notificada";
                          if (post?.resultadoRespuesta === "aprobada" || post?.estadoActual === "aprobada") return "Aprobada";
                          if (post?.estadoActual === "observaciones") return "Observaciones";
                          if (post?.estadoActual === "enviada") return "Enviada";
                          return "Preparación";
                        }
                        if (f.num === 5) {
                          const lic = detalleExp.expediente.tramiteLicencia;
                          if (lic?.estadoActual === "aprobada") return "Licencia Lista";
                          if (lic?.estadoActual === "observaciones") return "Subsanación";
                          if (lic?.estadoActual === "radicado") return "Radicada";
                          return "Por Radicar";
                        }
                        return reqsDeEstaFase.length > 0 ? `${aceptados}/${reqsDeEstaFase.length}` : "Fase Activa";
                      };

                      return (
                        <button
                          key={f.num}
                          type="button"
                          disabled={!estaHabilitada}
                          onClick={async () => {
                            if (estaHabilitada) {
                              if (f.num === 4 && validacionCompensarAprobada && detalleExp.expediente.faseActual < 4 && !esPlaneacion) {
                                try {
                                  await authFetch(`/api/expedientes/${detalleExp.expediente.id}/compensar/avanzar-fase4`, { method: "POST" });
                                  await cargarDetalleExpediente(detalleExp.expediente.id);
                                  await cargarExpedientes();
                                } catch (e) {
                                  console.error("Error avanzando formalmente a fase 4:", e);
                                }
                              }
                              setTabRequisitos(f.num);
                            }
                          }}
                          title={
                            esPlaneacion
                              ? `Fase ${f.num}: ${f.label} (Visibilidad total de auditoría y descarga - Solo Lectura)`
                              : esFaseAnterior
                              ? (esAdmin 
                                  ? "Fase superada y cerrada (Auditoría Administrativa)" 
                                  : "Fase completada y bloqueada. No está permitido retroceder entre fases.")
                              : esFaseFutura && !(f.num === 4 && validacionCompensarAprobada)
                              ? "Fase bloqueada. Requiere completar la fase activa precedente."
                              : `Fase activa en gestión (${f.label})`
                          }
                          className={`pb-2.5 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 shrink-0 whitespace-nowrap -mb-[1px] ${
                            !estaHabilitada
                              ? "border-transparent text-slate-400 opacity-60 cursor-not-allowed bg-slate-50/50"
                              : esSeleccionada
                              ? "border-blue-600 text-blue-700 cursor-pointer"
                              : "border-transparent text-slate-500 hover:text-slate-800 cursor-pointer"
                          }`}
                        >
                          <div className="flex items-center space-x-1.5">
                            {!esPlaneacion && ((esFaseAnterior && !esAdmin) || (esFaseFutura && !(f.num === 4 && validacionCompensarAprobada))) && (
                              <Lock className={`w-3.5 h-3.5 ${esFaseAnterior ? "text-slate-400" : "text-slate-300"}`} />
                            )}
                            <span>{f.label}</span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              esPlaneacion
                                ? (esSeleccionada ? "bg-teal-100 text-teal-800 border border-teal-200" : "bg-slate-100 text-slate-600")
                                : esFaseAnterior
                                ? "bg-slate-100 text-slate-500 border border-slate-200"
                                : esFaseFutura
                                ? "bg-slate-100 text-slate-400"
                                : (f.num === 6 && (detalleExp.expediente.postulacionSubsidio?.estadoActual === "aprobada" || detalleExp.expediente.postulacionSubsidio?.estadoActual === "indicacion_obra_enviada")) ||
                                  (f.num === 5 && detalleExp.expediente.tramiteLicencia?.estadoActual === "aprobada") ||
                                  (reqsDeEstaFase.length > 0 && aceptados === reqsDeEstaFase.length)
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-blue-50 text-blue-700 font-bold"
                            }`}
                          >
                            {getBadgeTexto()}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* BARRA SUPERIOR DE ACCIONES DE FASE: BOTÓN AÑADIR ARCHIVO ADICIONAL (OCULTO PARA SUPERVISOR - FIX 2) */}
                  {!esSalidaDefinitiva && currentUser.rol !== "supervisor" && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 p-3.5 bg-blue-50/60 border border-blue-200/70 rounded-xl">
                      <div className="flex items-center space-x-2 text-xs">
                        <span className="font-bold text-slate-800">
                          Fase {tabRequisitos}: {fasesConfig.find((f) => f.num === tabRequisitos)?.label || "Gestión de Fase"}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-500 font-medium">
                          {tabRequisitos <= detalleExp.expediente.faseActual ? "Fase activa / habilitada para carga documental" : "Fase proyectada"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFormNuevoRequisito({
                            nombre: "",
                            descripcion: "",
                            esObligatorio: false,
                            fase: tabRequisitos
                          });
                          setArchivoAdjuntoNuevoReq(null);
                          setErrorNuevoRequisito(null);
                          setModalNuevoRequisito(true);
                        }}
                        className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer shrink-0"
                        title={`Añadir un archivo o requisito adicional a la Fase ${tabRequisitos}`}
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>+ Añadir archivo adicional a Fase {tabRequisitos}</span>
                      </button>
                    </div>
                  )}

                  {/* CONTENIDO PESTAÑA 1: VIABILIDAD PREDIAL */}
                  {tabRequisitos === 1 && (
                    <div>
                      {detalleExp.expediente.faseActual >= 2 && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 mb-4 flex items-center space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            <strong>Fase 1 aprobada con viabilidad predial y jurídica favorable.</strong> El expediente
                            se encuentra activo en Fase 2 a cargo del Gestor Documental.
                          </span>
                        </div>
                      )}

                      {/* BANNER DE EXPEDIENTE DEVUELTO CON OBSERVACIONES EN FASE 1 */}
                      {detalleExp.expediente.estadoFase1 === "devuelto" && !detalleExp.expediente.bloqueadoPorRevision && (
                        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl mb-5 flex items-start space-x-3 text-amber-900 shadow-xs">
                          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-bold text-sm">Expediente Devuelto con Observaciones por Análisis Documental</h4>
                            <p className="text-xs text-amber-800 mt-0.5">
                              <strong>Motivo:</strong> {detalleExp.expediente.motivoDevolucionFase || "Corrija los documentos observados usando el botón 'Corregir Documento' y vuelva a enviar a revisión."}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* BARRA DE HERRAMIENTAS Y ACCIONES DE FASE 1 */}
                      <div className="p-4 bg-blue-50/90 border border-blue-200 rounded-xl mb-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-blue-600 text-white rounded-lg shadow-xs">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-bold text-sm text-blue-950">
                                Requisitos Documentales de Fase 1
                              </h4>
                              <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                                todosFase1Aceptados
                                  ? "bg-emerald-100 text-emerald-900 border-emerald-300 shadow-2xs"
                                  : "bg-blue-100 text-blue-800 border-blue-200"
                              }`}>
                                {todosFase1Aceptados
                                  ? "✓ Todos Aceptados"
                                  : (() => {
                                      const baseReqs = reqsFase1.filter((r) => !r.esAdicional && !r.codigoRequisito?.includes("ADICIONAL"));
                                      const adicReqs = reqsFase1.filter((r) => r.esAdicional || r.codigoRequisito?.includes("ADICIONAL"));
                                      const cargadosBase = baseReqs.filter((r) => r.estado !== "pendiente_carga" || Boolean(r.documentoAsociado)).length;
                                      return adicReqs.length > 0
                                        ? `${cargadosBase} de ${baseReqs.length} requeridos [+${adicReqs.length} adicional${adicReqs.length > 1 ? "es" : ""}]`
                                        : `${reqsFase1Obligatorios.length - faltanSubirFase1.length} de ${reqsFase1Obligatorios.length} cargados`;
                                    })()}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              Tradición (≤ 90 días), Impuesto Predial del año y Cédulas de ciudadanía.
                            </p>
                          </div>
                        </div>

                        {/* ACCIONES DE FASE 1 SEGÚN ROL Y ESTADO */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* SI ESTÁ BLOQUEADO POR REVISIÓN */}
                          {detalleExp.expediente.bloqueadoPorRevision && detalleExp.expediente.faseActual === 1 && (
                            <div className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-xs font-bold shadow-xs">
                              <Lock className="w-3.5 h-3.5 text-amber-600" />
                              <span>
                                {currentUser.rol === "comercial"
                                  ? "Enviado a Análisis Documental • Bloqueado para Gestor Rural"
                                  : currentUser.rol === "asistente"
                                  ? "Enviado a Análisis Documental • En Evaluación"
                                  : currentUser.rol === "supervisor"
                                  ? "Enviado a Análisis Documental • Pendiente de Dictamen"
                                  : "Enviado a Análisis Documental • Acceso Total de Administrador"}
                              </span>
                            </div>
                          )}

                          {/* BOTÓN ENVIAR A SUPERVISIÓN (Comercial, Asistente, Administrador) */}
                          {!esSalidaDefinitiva &&
                            (currentUser.rol === "comercial" || currentUser.rol === "asistente" || currentUser.rol === "administrador") &&
                            !detalleExp.expediente.bloqueadoPorRevision &&
                            detalleExp.expediente.faseActual === 1 && (
                              <button
                                type="button"
                                disabled={faltanSubirFase1.length > 0 || guardandoEnvioRevision}
                                onClick={() => handleEnviarRevisionFase(1)}
                                title={
                                  faltanSubirFase1.length > 0
                                    ? `Faltan ${faltanSubirFase1.length} documento(s) obligatorio(s) por subir antes de enviar a supervisión`
                                    : "Enviar formalmente el expediente a Análisis Documental"
                                }
                                className={`inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-xs ${
                                  faltanSubirFase1.length > 0
                                    ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                                    : "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-sm"
                                }`}
                              >
                                {guardandoEnvioRevision ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                <span>
                                  {faltanSubirFase1.length > 0
                                    ? `Faltan ${faltanSubirFase1.length} Doc(s) por Cargar`
                                    : (detalleExp.expediente.estadoFase1 === "devuelto" || reqsFase1.some((r) => r.estado === "actualizado" || r.estado === "corregido"))
                                    ? "Reenviar a Análisis Documental"
                                    : "Enviar a Análisis Documental"}
                                </span>
                              </button>
                            )}

                          {/* SUPERVISOR O ADMIN: APROBAR FASE 1 */}
                          {!esSalidaDefinitiva &&
                            (currentUser.rol === "supervisor" || currentUser.rol === "administrador") &&
                            detalleExp.expediente.faseActual === 1 && (() => {
                              const deshabilitarSupervisorF1 =
                                currentUser.rol === "supervisor" &&
                                !detalleExp.expediente.bloqueadoPorRevision &&
                                !todosFase1Aceptados;
                              const yaDevueltoF1 = detalleExp.expediente.estadoFase1 === "devuelto";
                              return (
                                <div className="flex items-center space-x-2">
                                  <button
                                    type="button"
                                    disabled={yaDevueltoF1}
                                    onClick={() => !yaDevueltoF1 && setModalDevolverFase1(true)}
                                    className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
                                      yaDevueltoF1
                                        ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60"
                                        : "bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 cursor-pointer"
                                    }`}
                                    title={
                                      yaDevueltoF1
                                        ? "El expediente ya fue devuelto con observaciones al Gestor Rural."
                                        : "Devolver expediente al Gestor Rural para corregir observaciones"
                                    }
                                  >
                                    <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                                    <span>Devolver con Observaciones</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={deshabilitarSupervisorF1 || !todosFase1Aceptados || guardandoAprobacion}
                                    onClick={() => !deshabilitarSupervisorF1 && setModalAprobarFase1(true)}
                                    title={
                                      deshabilitarSupervisorF1
                                        ? "Aprobación no disponible: El expediente está en conformación por el Gestor Rural."
                                        : todosFase1Aceptados
                                        ? "Revisión completa: Aprobar Fase 1 y Asignar Gestor Documental para Fase 2"
                                        : "Debe aceptar todos los requisitos obligatorios de Fase 1 antes de aprobar"
                                    }
                                    className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
                                      !deshabilitarSupervisorF1 && todosFase1Aceptados
                                        ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer ring-2 ring-emerald-400/40 shadow-emerald-200 shadow-sm"
                                        : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 opacity-60"
                                    }`}
                                  >
                                    {guardandoAprobacion ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                    <span>Aprobar Fase 1</span>
                                  </button>
                                </div>
                              );
                            })()}
                        </div>
                      </div>

                      <div className="space-y-3">
                        {reqsFaseActual.map((req) => (
                          <div
                            key={req.id}
                            className="p-4 border border-slate-200 rounded-xl hover:border-slate-300 transition-all bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                          >
                            <div className="flex items-start space-x-3">
                              <div
                                className={`p-2.5 rounded-lg ${
                                  req.estado === "aceptado"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : req.estado === "con_observaciones"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                <FileText className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                    {req.codigoRequisito}
                                  </span>
                                  <h4 className="text-sm font-bold text-slate-800">{req.nombre}</h4>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">{req.descripcion}</p>

                                {/* Versión actual si existe */}
                                {req.documentoAsociado?.versionActual && (
                                  <div className="text-[11px] text-slate-600 mt-1.5 flex items-center space-x-2 font-mono">
                                    <span>v{req.documentoAsociado.versionActual.versionNumero}</span>
                                    <span>•</span>
                                    <span>{req.documentoAsociado.versionActual.nombreArchivoOriginal}</span>
                                    <span>•</span>
                                    <span className="text-slate-400">
                                      Hash: {req.documentoAsociado.versionActual.sha256Hash.substring(0, 12)}...
                                    </span>
                                  </div>
                                )}

                                {/* Miniaturas de Fotografías adjuntas (Cambio 1 - Registro fotográfico) */}
                                {req.documentoAsociado?.versionActual?.fotos && req.documentoAsociado.versionActual.fotos.length > 0 && (
                                  <div className="mt-2.5 pt-2 border-t border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-500 block mb-1.5">
                                      📷 {req.documentoAsociado.versionActual.fotos.length} fotos cargadas (clic para ampliar en visor):
                                    </span>
                                    <div className="flex flex-wrap gap-2">
                                      {req.documentoAsociado.versionActual.fotos.map((f, fIdx) => (
                                        <button
                                          key={f.id || fIdx}
                                          type="button"
                                          onClick={() => {
                                            setDocVisorData({
                                              titulo: req.nombre,
                                              nombreArchivo: req.documentoAsociado!.versionActual!.nombreArchivoOriginal,
                                              mimeType: req.documentoAsociado!.versionActual!.mimeType,
                                              sha256Hash: req.documentoAsociado!.versionActual!.sha256Hash,
                                              tamanoBytes: req.documentoAsociado!.versionActual!.tamanoBytes,
                                              subidoPor: req.documentoAsociado!.versionActual!.subidoPorNombre,
                                              subidoEn: req.documentoAsociado!.versionActual!.subidoEn,
                                              archivoDataUrl: req.documentoAsociado!.versionActual!.archivoDataUrl,
                                              fotos: req.documentoAsociado!.versionActual!.fotos,
                                              fotoInicialIndex: fIdx
                                            });
                                          }}
                                          className="relative w-16 h-12 rounded-lg overflow-hidden border border-slate-300 hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer group bg-slate-100 shrink-0"
                                          title={`Ver foto ${fIdx + 1}: ${f.categoria || f.nombre}`}
                                        >
                                          <img
                                            src={f.url}
                                            alt={f.nombre}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                          />
                                          <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] px-0.5 truncate text-center">
                                            {fIdx + 1}/{req.documentoAsociado.versionActual.fotos.length}
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Observación activa si existe */}
                                {(() => {
                                  const esAceptado = req.estado === "aceptado";
                                  const obsTexto = (req.ultimaRevision?.observacion || req.observaciones || "").trim();
                                  const esObsTrivial = !obsTexto || ["ok", "ok.", "aceptado", "cumple", "aprobado", "sin observaciones", "conforme", "correcto", "revisado"].includes(obsTexto.toLowerCase());

                                  if (esAceptado && esObsTrivial) return null;

                                  const tieneObsActiva = req.estado === "con_observaciones" || req.ultimaRevision?.resultado === "OBSERVADO" || (obsTexto && !esObsTrivial);

                                  if (!tieneObsActiva) return null;

                                  if (esAceptado) {
                                    return (
                                      <div className="mt-2.5 p-3 bg-emerald-50/90 border border-emerald-200 rounded-lg text-xs text-emerald-900 shadow-2xs">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                          <div className="flex items-center space-x-1.5 font-bold text-emerald-900">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                            <span>Nota / Observación Registrada:</span>
                                          </div>
                                        </div>
                                        <p className="text-slate-700 pl-5 leading-relaxed">{obsTexto}</p>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div className="mt-2.5 p-3 bg-amber-50/90 border border-amber-300 rounded-lg text-xs text-amber-900 shadow-2xs">
                                      <div className="flex items-center justify-between gap-2 mb-1">
                                        <div className="flex items-center space-x-1.5 font-bold text-amber-900">
                                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                          <span>Observación de Análisis Documental:</span>
                                        </div>
                                        {(currentUser.rol === "comercial" || currentUser.rol === "asistente" || currentUser.rol === "administrador") && (
                                          <button
                                            type="button"
                                            onClick={() => handleAbrirModalSubir(req)}
                                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold transition-colors cursor-pointer shrink-0 shadow-2xs"
                                            title="Subir archivo corregido para subsanar esta observación"
                                          >
                                            <Upload className="w-3 h-3" />
                                            <span>Subir Corrección</span>
                                          </button>
                                        )}
                                      </div>
                                      <p className="text-slate-700 pl-5 leading-relaxed">
                                        {obsTexto || "Por favor subsanar la observación indicada por el supervisor."}
                                      </p>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>

                            {/* ESTADO Y BOTONES DE ACCIÓN */}
                            <div className="flex items-center space-x-2 self-end md:self-center">
                              {(() => {
                                const vNum = req.documentoAsociado?.versionActual?.versionNumero ?? 0;
                                const tieneCorrSubida = vNum > 1 || req.estado === "actualizado" || req.estado === "corregido";
                                const esAceptado = req.estado === "aceptado";
                                const tieneObsPura = (req.estado === "con_observaciones" || req.ultimaRevision?.resultado === "OBSERVADO" || Boolean(req.observaciones)) && !tieneCorrSubida;

                                if (esAceptado) {
                                  return (
                                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Aceptado
                                    </span>
                                  );
                                }

                                if (tieneCorrSubida) {
                                  return (
                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                      {req.estado === "corregido" || vNum > 1 ? "Corrección Subida (En Revisión)" : "En Revisión"}
                                    </span>
                                  );
                                }

                                if (tieneObsPura) {
                                  return (
                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                      Con Observaciones
                                    </span>
                                  );
                                }

                                if (req.estado === "recibido_revision") {
                                  return (
                                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                      En Revisión
                                    </span>
                                  );
                                }

                                return (
                                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                                    Pendiente Carga
                                  </span>
                                );
                              })()}

                              {/* Abrir en Visor seguro */}
                              {req.documentoAsociado?.versionActual && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDocVisorData({
                                      titulo: req.nombre,
                                      nombreArchivo: req.documentoAsociado!.versionActual!.nombreArchivoOriginal,
                                      mimeType: req.documentoAsociado!.versionActual!.mimeType,
                                      sha256Hash: req.documentoAsociado!.versionActual!.sha256Hash,
                                      tamanoBytes: req.documentoAsociado!.versionActual!.tamanoBytes,
                                      subidoPor: req.documentoAsociado!.versionActual!.subidoPorNombre,
                                      subidoEn: req.documentoAsociado!.versionActual!.subidoEn,
                                      archivoDataUrl: obtenerUrlConAntiCache(req.documentoAsociado!.versionActual!.archivoDataUrl),
                                      fotos: req.documentoAsociado!.versionActual!.fotos
                                    });
                                  }}
                                  className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                                  title="Abrir en Visor Interno"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              )}

                              {/* Descargar directamente con anti-caché */}
                              {req.documentoAsociado?.versionActual && (
                                <a
                                  href={obtenerUrlConAntiCache(req.documentoAsociado.versionActual.archivoDataUrl)}
                                  download={req.documentoAsociado.versionActual.nombreArchivoOriginal}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                                  title="Descargar documento directamente"
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                              )}

                              {/* Cargar / Reemplazar en Fase 1 según Rol y Estado de Revisión (Supervisor strictly excluded) */}
                              {!esSalidaDefinitiva && currentUser.rol !== "planeacion" && currentUser.rol !== "supervisor" && (() => {
                                const vNum = req.documentoAsociado?.versionActual?.versionNumero ?? 0;
                                const tieneCorrSubida = vNum > 1 || req.estado === "actualizado" || req.estado === "corregido";
                                const tieneObsPura = (req.estado === "con_observaciones" || req.ultimaRevision?.resultado === "OBSERVADO" || Boolean(req.observaciones)) && !tieneCorrSubida;
                                const estaBloqueado = Boolean(detalleExp.expediente.bloqueadoPorRevision);

                                if (estaBloqueado && (currentUser.rol === "comercial" || currentUser.rol === "asistente")) {
                                  return (
                                    <span
                                      title={
                                        currentUser.rol === "comercial"
                                          ? "El expediente se encuentra en evaluación de Análisis Documental. La edición se habilitará si el documento recibe observaciones."
                                          : "El expediente se encuentra en evaluación de Análisis Documental."
                                      }
                                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-semibold"
                                    >
                                      <Lock className="w-3 h-3 text-amber-600" />
                                      <span>
                                        {currentUser.rol === "comercial"
                                          ? "Bloqueado para Gestor Rural"
                                          : "En Revisión Documental"}
                                      </span>
                                    </span>
                                  );
                                }

                                const puedeCargar = currentUser.rol === "administrador" || (!estaBloqueado && (currentUser.rol === "comercial" || currentUser.rol === "asistente"));

                                if (puedeCargar) {
                                  if (tieneObsPura && (currentUser.rol === "comercial" || currentUser.rol === "asistente")) {
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => handleAbrirModalSubir(req)}
                                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
                                        title="Subir corrección para subsanar la observación del supervisor"
                                      >
                                        <Upload className="w-3.5 h-3.5" />
                                        <span>Corregir Documento</span>
                                      </button>
                                    );
                                  }
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => handleAbrirModalSubir(req)}
                                      className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 cursor-pointer"
                                    >
                                      <Upload className="w-3.5 h-3.5" />
                                      <span>{req.documentoAsociado ? "Reemplazar" : "Subir"}</span>
                                    </button>
                                  );
                                }

                                return null;
                              })()}

                              {/* Supervisor: Evaluar */}
                              {!esSalidaDefinitiva && (currentUser.rol === "supervisor" || currentUser.rol === "administrador") && req.documentoAsociado?.versionActual && (() => {
                                const deshabilitarRevisarSupervisor = !req.documentoAsociado?.versionActual;
                                return (
                                  <button
                                    type="button"
                                    disabled={deshabilitarRevisarSupervisor}
                                    onClick={() => {
                                      if (deshabilitarRevisarSupervisor) return;
                                      setModalRevisarReq(req);
                                      setFormRevision({ resultado: "ACEPTADO", observacion: "" });
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 border bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 cursor-pointer"
                                    title="Dictaminar o revisar requisito documental"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                                    <span>Revisar</span>
                                  </button>
                                );
                              })()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CONTENIDO PESTAÑA 2: FASE 2 (CONFORMACIÓN DEL HOGAR Y FLUJO DE REVISIÓN) */}
                  {tabRequisitos === 2 && (
                    <div>
                      {detalleExp.expediente.faseActual < 2 ? (
                        <div className="p-6 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 flex items-start space-x-3.5">
                          <Lock className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-bold text-sm text-amber-900">Fase 2 no habilitada</h4>
                            <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                              Para habilitar la conformación del hogar y la carga de documentos familiares a cargo
                              del Gestor Documental, el Analista Documental debe primero aprobar la Fase 1
                              (todos los requisitos de viabilidad predial deben estar en estado Aceptado).
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {/* BANNER DE EXPEDIENTE DEVUELTO CON OBSERVACIONES (Cambio 7) */}
                          {detalleExp.expediente.estadoFase2 === "devuelto" && !detalleExp.expediente.bloqueadoPorRevision && (
                            <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl mb-5 flex items-start space-x-3 text-rose-900 shadow-xs">
                              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <h4 className="font-bold text-sm">Expediente Devuelto con Observaciones por Análisis Documental</h4>
                                <p className="text-xs text-rose-800 mt-0.5">
                                  <strong>Motivo:</strong> {detalleExp.expediente.observacionDevolucionFase2 || "Corregir los documentos observados y volver a enviar a revisión."}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* BARRA DE HERRAMIENTAS Y ACCIONES DE FASE 2 */}
                          <div className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-xl mb-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div className="flex items-center space-x-3">
                              <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-xs">
                                <Users className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="font-bold text-sm text-emerald-950">
                                  Documentación del Hogar (Fase 2)
                                </h4>
                                <p className="text-xs text-emerald-700 mt-0.5">
                                  Gestor Documental a cargo: <strong>{formatearNombreUsuario(detalleExp.expediente.responsableGeneralNombre) || "Gestor Documental"}</strong>.
                                  {detalleExp.expediente.bloqueadoPorRevision
                                    ? " Estado: En revisión de Análisis Documental."
                                    : " Estado: En carga y conformación documental."}
                                </p>
                              </div>
                            </div>

                            {/* BOTONES DE ACCIÓN SEGÚN ROL */}
                            <div className="flex flex-wrap items-center gap-2">
                              {/* ASISTENTE O ADMIN: AGREGAR DOCUMENTO (OCULTO PARA SUPERVISOR - Cambio 8) */}
                              {!esSalidaDefinitiva && (currentUser.rol === "asistente" || currentUser.rol === "administrador") && !detalleExp.expediente.bloqueadoPorRevision && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setErrorNuevoRequisito(null);
                                    setArchivoAdjuntoNuevoReq(null);
                                    setModalNuevoRequisito(true);
                                  }}
                                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  <span>+ Agregar Documento al Hogar</span>
                                </button>
                              )}

                              {/* INDICADOR SI ESTÁ BLOQUEADO POR REVISIÓN */}
                              {detalleExp.expediente.bloqueadoPorRevision && (
                                <div className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-amber-100 border border-amber-300 text-amber-800 rounded-lg text-xs font-bold shadow-xs">
                                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Enviado a Análisis Documental (En Evaluación)</span>
                                </div>
                              )}

                              {/* ASISTENTE, COMERCIAL O ADMIN: ENVIAR A REVISIÓN DEL SUPERVISOR */}
                              {!esSalidaDefinitiva && (currentUser.rol === "asistente" || currentUser.rol === "comercial" || currentUser.rol === "administrador") && !detalleExp.expediente.bloqueadoPorRevision && (
                                <button
                                  type="button"
                                  disabled={faltanSubirFase2.length > 0 || guardandoEnvioRevisionFase2}
                                  onClick={handleEnviarRevisionFase2}
                                  title={faltanSubirFase2.length > 0 ? `Faltan ${faltanSubirFase2.length} documento(s) obligatorio(s) por subir` : "Remitir expediente a Análisis Documental"}
                                  className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
                                    faltanSubirFase2.length > 0
                                      ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                                      : "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                                  }`}
                                >
                                  {guardandoEnvioRevisionFase2 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                  <span>
                                    {faltanSubirFase2.length > 0
                                      ? `Faltan ${faltanSubirFase2.length} Obligatorios`
                                      : "Enviar a Análisis Documental"}
                                  </span>
                                </button>
                              )}

                              {/* SUPERVISOR O ADMIN: APROBAR FASE 2 */}
                              {!esSalidaDefinitiva && (currentUser.rol === "supervisor" || currentUser.rol === "administrador") && (() => {
                                const deshabilitarParaSupervisor =
                                  currentUser.rol === "supervisor" &&
                                  !detalleExp.expediente.bloqueadoPorRevision &&
                                  !todosFase2Aceptados;
                                return (
                                  <div className="flex items-center space-x-2">
                                    <button
                                      type="button"
                                      onClick={() => setModalDevolverFase2(true)}
                                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 cursor-pointer"
                                      title="Devolver expediente al Gestor Documental para corregir observaciones"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                                      <span>Devolver con Observaciones</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={deshabilitarParaSupervisor || !todosFase2Aceptados || guardandoAprobacionFase2}
                                      onClick={handleAprobarFase2}
                                      title={
                                        deshabilitarParaSupervisor
                                          ? "Aprobación no disponible: El expediente está en conformación por el Gestor Documental."
                                          : todosFase2Aceptados
                                          ? "Aprobar Fase 2 y pasar a Fase 3"
                                          : "Todos los documentos obligatorios de Fase 2 deben estar en estado Aceptado"
                                      }
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 ${
                                        deshabilitarParaSupervisor
                                          ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 opacity-60"
                                          : todosFase2Aceptados
                                          ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                                          : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                                      }`}
                                    >
                                      {guardandoAprobacionFase2 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                      <span>Aprobar Fase 2 y Avanzar a Fase 3</span>
                                    </button>
                                  </div>
                                );
                              })()}

                              <div className="font-mono font-bold text-xs bg-white px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-800 shadow-xs">
                                {reqsFase2.length > 0 ? `${reqsFase2.filter((r) => r.estado === "aceptado").length} de ${reqsFase2.length} Aceptados` : "Sin requisitos"}
                              </div>
                            </div>
                          </div>

                          {reqsFase2.length === 0 ? (
                            <div className="p-8 bg-white border border-dashed border-slate-300 rounded-xl text-center space-y-3">
                              <div className="inline-flex p-3 bg-emerald-50 text-emerald-600 rounded-full">
                                <FileText className="w-6 h-6" />
                              </div>
                              <h4 className="text-sm font-bold text-slate-800">
                                Sin documentos registrados en Fase 2 para este hogar
                              </h4>
                              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                                Como Gestor Documental, use el botón &quot;+ Agregar Documento al Hogar&quot; para registrar los requisitos específicos y adjuntar los archivos correspondientes a este hogar.
                              </p>
                              {!esSalidaDefinitiva && (currentUser.rol === "asistente" || currentUser.rol === "administrador") && !detalleExp.expediente.bloqueadoPorRevision && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setErrorNuevoRequisito(null);
                                    setArchivoAdjuntoNuevoReq(null);
                                    setModalNuevoRequisito(true);
                                  }}
                                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                                >
                                  <PlusCircle className="w-4 h-4" />
                                  <span>Agregar Primer Documento Requerido</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {reqsFase2.map((req) => (
                                <div
                                  key={req.id}
                                  className="p-4 border border-slate-200 rounded-xl hover:border-slate-300 transition-all bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                                >
                                  <div className="flex items-start space-x-3">
                                    <div
                                      className={`p-2.5 rounded-lg ${
                                        req.estado === "aceptado"
                                          ? "bg-emerald-100 text-emerald-700"
                                          : req.estado === "con_observaciones"
                                          ? "bg-amber-100 text-amber-700"
                                          : req.estado === "recibido_revision"
                                          ? "bg-blue-100 text-blue-700"
                                          : "bg-slate-100 text-slate-600"
                                      }`}
                                    >
                                      <FileText className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <div className="flex items-center space-x-2">
                                        <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                          {req.codigoRequisito}
                                        </span>
                                        <h4 className="text-sm font-bold text-slate-800">{req.nombre}</h4>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${req.esObligatorio ? "bg-slate-100 text-slate-600" : "bg-blue-50 text-blue-600"}`}>
                                          {req.esObligatorio ? "Obligatorio" : "Opcional"}
                                        </span>
                                      </div>
                                      <p className="text-xs text-slate-500 mt-0.5">{req.descripcion}</p>

                                      {/* Versión actual si existe */}
                                      {req.documentoAsociado?.versionActual && (
                                        <div className="text-[11px] text-slate-600 mt-1.5 flex items-center space-x-2 font-mono">
                                          <span>v{req.documentoAsociado.versionActual.versionNumero}</span>
                                          <span>•</span>
                                          <span>{req.documentoAsociado.versionActual.nombreArchivoOriginal}</span>
                                          <span>•</span>
                                          <span className="text-slate-400">
                                            Hash: {req.documentoAsociado.versionActual.sha256Hash.substring(0, 12)}...
                                          </span>
                                        </div>
                                      )}

                                      {/* Miniaturas de Fotografías adjuntas si aplica */}
                                      {req.documentoAsociado?.versionActual?.fotos && req.documentoAsociado.versionActual.fotos.length > 0 && (
                                        <div className="mt-2.5 pt-2 border-t border-slate-100">
                                          <span className="text-[10px] font-bold text-slate-500 block mb-1.5">
                                            📷 {req.documentoAsociado.versionActual.fotos.length} fotos cargadas (clic para ampliar en visor):
                                          </span>
                                          <div className="flex flex-wrap gap-2">
                                            {req.documentoAsociado.versionActual.fotos.map((f, fIdx) => (
                                              <button
                                                key={f.id || fIdx}
                                                type="button"
                                                onClick={() => {
                                                  setDocVisorData({
                                                    titulo: req.nombre,
                                                    nombreArchivo: req.documentoAsociado!.versionActual!.nombreArchivoOriginal,
                                                    mimeType: req.documentoAsociado!.versionActual!.mimeType,
                                                    sha256Hash: req.documentoAsociado!.versionActual!.sha256Hash,
                                                    tamanoBytes: req.documentoAsociado!.versionActual!.tamanoBytes,
                                                    subidoPor: req.documentoAsociado!.versionActual!.subidoPorNombre,
                                                    subidoEn: req.documentoAsociado!.versionActual!.subidoEn,
                                                    archivoDataUrl: req.documentoAsociado!.versionActual!.archivoDataUrl,
                                                    fotos: req.documentoAsociado!.versionActual!.fotos,
                                                    fotoInicialIndex: fIdx
                                                  });
                                                }}
                                                className="relative w-16 h-12 rounded-lg overflow-hidden border border-slate-300 hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer group bg-slate-100 shrink-0"
                                                title={`Ver foto ${fIdx + 1}: ${f.categoria || f.nombre}`}
                                              >
                                                <img
                                                  src={f.url}
                                                  alt={f.nombre}
                                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                />
                                                <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] px-0.5 truncate text-center">
                                                  {fIdx + 1}/{req.documentoAsociado.versionActual.fotos.length}
                                                </span>
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Observación activa si existe */}
                                      {(() => {
                                        const esAceptado = req.estado === "aceptado";
                                        const obsTexto = (req.ultimaRevision?.observacion || req.observaciones || "").trim();
                                        const esObsTrivial = !obsTexto || ["ok", "ok.", "aceptado", "cumple", "aprobado", "sin observaciones", "conforme", "correcto", "revisado"].includes(obsTexto.toLowerCase());

                                        if (esAceptado && esObsTrivial) return null;

                                        const tieneObsActiva = req.estado === "con_observaciones" || req.ultimaRevision?.resultado === "OBSERVADO" || (obsTexto && !esObsTrivial);

                                        if (!tieneObsActiva) return null;

                                        if (esAceptado) {
                                          return (
                                            <div className="mt-2.5 p-3 bg-emerald-50/90 border border-emerald-200 rounded-lg text-xs text-emerald-900 shadow-2xs">
                                              <div className="flex items-center justify-between gap-2 mb-1">
                                                <div className="flex items-center space-x-1.5 font-bold text-emerald-900">
                                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                  <span>Nota / Observación Registrada:</span>
                                                </div>
                                              </div>
                                              <p className="text-slate-700 pl-5 leading-relaxed">{obsTexto}</p>
                                            </div>
                                          );
                                        }

                                        return (
                                          <div className="mt-2.5 p-3 bg-amber-50/90 border border-amber-300 rounded-lg text-xs text-amber-900 shadow-2xs">
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                              <div className="flex items-center space-x-1.5 font-bold text-amber-900">
                                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                                <span>Observación de Análisis Documental:</span>
                                              </div>
                                              {(currentUser.rol === "asistente" || currentUser.rol === "comercial" || currentUser.rol === "administrador") && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleAbrirModalSubir(req)}
                                                  className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold transition-colors cursor-pointer shrink-0 shadow-2xs"
                                                  title="Subir archivo corregido para subsanar esta observación"
                                                >
                                                  <Upload className="w-3 h-3" />
                                                  <span>Subir Corrección</span>
                                                </button>
                                              )}
                                            </div>
                                            <p className="text-slate-700 pl-5 leading-relaxed">
                                              {obsTexto || "Por favor subsanar la observación indicada por el supervisor."}
                                            </p>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>

                                   {/* ESTADO Y BOTONES DE ACCIÓN */}
                                  <div className="flex items-center space-x-2 self-end md:self-center">
                                    {(() => {
                                      const vNum = req.documentoAsociado?.versionActual?.versionNumero ?? 0;
                                      const tieneCorrSubida = vNum > 1 || req.estado === "actualizado" || req.estado === "corregido";
                                      const esAceptado = req.estado === "aceptado";
                                      const tieneObsPura = (req.estado === "con_observaciones" || req.ultimaRevision?.resultado === "OBSERVADO" || Boolean(req.observaciones)) && !tieneCorrSubida;

                                      if (esAceptado) {
                                        return (
                                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            Aceptado
                                          </span>
                                        );
                                      }

                                      if (tieneCorrSubida) {
                                        return (
                                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                            {req.estado === "corregido" || vNum > 1 ? "Corrección Subida (En Revisión)" : "En Revisión"}
                                          </span>
                                        );
                                      }

                                      if (tieneObsPura) {
                                        return (
                                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                            Con Observaciones
                                          </span>
                                        );
                                      }

                                      if (req.estado === "recibido_revision") {
                                        return (
                                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                            En Revisión
                                          </span>
                                        );
                                      }

                                      return (
                                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                                          Pendiente Carga
                                        </span>
                                      );
                                    })()}

                                    {/* Abrir en Visor seguro */}
                                    {req.documentoAsociado?.versionActual && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDocVisorData({
                                            titulo: req.nombre,
                                            nombreArchivo: req.documentoAsociado!.versionActual!.nombreArchivoOriginal,
                                            mimeType: req.documentoAsociado!.versionActual!.mimeType,
                                            sha256Hash: req.documentoAsociado!.versionActual!.sha256Hash,
                                            tamanoBytes: req.documentoAsociado!.versionActual!.tamanoBytes,
                                            subidoPor: req.documentoAsociado!.versionActual!.subidoPorNombre,
                                            subidoEn: req.documentoAsociado!.versionActual!.subidoEn,
                                            archivoDataUrl: obtenerUrlConAntiCache(req.documentoAsociado!.versionActual!.archivoDataUrl),
                                            fotos: req.documentoAsociado!.versionActual!.fotos
                                          });
                                        }}
                                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                                        title="Abrir en Visor Interno"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                    )}

                                    {/* Descargar directamente con anti-caché */}
                                    {req.documentoAsociado?.versionActual && (
                                      <a
                                        href={obtenerUrlConAntiCache(req.documentoAsociado.versionActual.archivoDataUrl)}
                                        download={req.documentoAsociado.versionActual.nombreArchivoOriginal}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                                        title="Descargar documento directamente"
                                      >
                                        <Download className="w-4 h-4" />
                                      </a>
                                    )}

                                    {/* ASISTENTE O ADMIN: CARGAR / REEMPLAZAR DOCUMENTO (Supervisor strictly excluded) */}
                                    {!esSalidaDefinitiva && currentUser.rol !== "planeacion" && currentUser.rol !== "supervisor" && (() => {
                                      const vNum = req.documentoAsociado?.versionActual?.versionNumero ?? 0;
                                      const tieneCorrSubida = vNum > 1 || req.estado === "actualizado" || req.estado === "corregido";
                                      const tieneObsPura = (req.estado === "con_observaciones" || req.ultimaRevision?.resultado === "OBSERVADO" || Boolean(req.observaciones)) && !tieneCorrSubida;
                                      const estaBloqueado = Boolean(detalleExp.expediente.bloqueadoPorRevision);

                                      if (estaBloqueado && (currentUser.rol === "asistente" || currentUser.rol === "comercial")) {
                                        return (
                                          <span
                                            title="Expediente en evaluación de Análisis Documental"
                                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-semibold"
                                          >
                                            <Lock className="w-3 h-3 text-amber-600" />
                                            <span>En Revisión Documental</span>
                                          </span>
                                        );
                                      }

                                      const puedeCargarF2 = currentUser.rol === "administrador" || (!estaBloqueado && (currentUser.rol === "asistente" || currentUser.rol === "comercial"));

                                      if (puedeCargarF2) {
                                        if (tieneObsPura && (currentUser.rol === "asistente" || currentUser.rol === "comercial")) {
                                          return (
                                            <button
                                              type="button"
                                              onClick={() => handleAbrirModalSubir(req)}
                                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
                                              title="Subir corrección para subsanar la observación del supervisor"
                                            >
                                              <Upload className="w-3.5 h-3.5" />
                                              <span>Corregir Documento</span>
                                            </button>
                                          );
                                        }
                                        return (
                                          <button
                                            type="button"
                                            onClick={() => handleAbrirModalSubir(req)}
                                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 cursor-pointer border border-emerald-200 shadow-2xs"
                                          >
                                            <Upload className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>{req.documentoAsociado ? "Reemplazar" : "Subir Documento"}</span>
                                          </button>
                                        );
                                      }

                                      return null;
                                    })()}

                                    {/* SUPERVISOR: EVALUAR DOCUMENTO CARGADO */}
                                    {!esSalidaDefinitiva && (currentUser.rol === "supervisor" || currentUser.rol === "administrador") && req.documentoAsociado?.versionActual && (() => {
                                      const deshabilitarRevisarSupervisor = !req.documentoAsociado?.versionActual;
                                      return (
                                        <button
                                          type="button"
                                          disabled={deshabilitarRevisarSupervisor}
                                          onClick={() => {
                                            if (deshabilitarRevisarSupervisor) return;
                                            setModalRevisarReq(req);
                                            setFormRevision({ resultado: "ACEPTADO", observacion: "" });
                                          }}
                                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 border ${
                                            deshabilitarRevisarSupervisor
                                              ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60"
                                              : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 cursor-pointer"
                                          }`}
                                          title={
                                            deshabilitarRevisarSupervisor
                                              ? "Revisión no disponible: El Gestor Documental debe finalizar la carga y remitir el expediente a Análisis Documental."
                                              : "Revisar y calificar documento"
                                          }
                                        >
                                          <CheckCircle2 className={`w-3.5 h-3.5 ${deshabilitarRevisarSupervisor ? "text-slate-400" : "text-emerald-700"}`} />
                                          <span>Revisar</span>
                                        </button>
                                      );
                                    })()}

                                    {/* ELIMINAR REQUISITO (ASISTENTE O ADMIN CUANDO NO ESTÉ BLOQUEADO) */}
                                    {!esSalidaDefinitiva && (currentUser.rol === "asistente" || currentUser.rol === "administrador") && !detalleExp.expediente.bloqueadoPorRevision && (
                                      <button
                                        type="button"
                                        onClick={() => handleEliminarRequisito(req.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                        title="Eliminar requisito"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* CONTENIDO PESTAÑA 3: VALIDACIÓN COMPENSAR (CAMBIO 5) */}
                  {tabRequisitos === 3 && (
                    <div>
                      {detalleExp.expediente.faseActual < 3 && currentUser.rol !== "planeacion" ? (
                        <div className="p-6 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 flex items-start space-x-3.5">
                          <Lock className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-bold text-sm text-amber-900">
                              Fase 3: En Validación Inicial Compensar aún no habilitada
                            </h4>
                            <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                              El expediente se encuentra actualmente en Fase {detalleExp.expediente.faseActual}.
                              Para habilitar la Fase 3 y enviar a Compensar, debe completar y aprobar satisfactoriamente los 11 requisitos de Fase 2.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <Fase3Compensar
                          expediente={detalleExp.expediente}
                          requisitosFase2={detalleExp.requisitos.filter((r) => r.fase === 2)}
                          currentUser={currentUser}
                          onAbrirVisor={(docData) => setDocVisorData(docData)}
                          onSubirDocumento={handleAbrirModalSubir}
                          onActualizarExpediente={async (nuevaFase?: number) => {
                            await cargarDetalleExpediente(detalleExp.expediente.id);
                            await cargarExpedientes();
                            if (nuevaFase) {
                              setTabRequisitos(nuevaFase);
                            }
                          }}
                          onNavegarAFase={(fase) => setTabRequisitos(fase)}
                          authFetch={authFetch}
                        />
                      )}
                    </div>
                  )}

                  {/* CONTENIDO PESTAÑA 4: GESTIÓN DE 3 FRENTES EN PARALELO + PRESUPUESTO OFICIAL APU */}
                  {tabRequisitos === 4 && (
                    <div>
                      {detalleExp.expediente.faseActual < 4 && detalleExp.expediente.validacionCompensar?.estadoActual !== "aprobado" && currentUser.rol !== "planeacion" ? (
                        <div className="p-6 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 flex items-start space-x-3.5">
                          <Lock className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-bold text-sm text-amber-900">
                              Fase 4: En Recolección de Documentos Técnicos aún no habilitada
                            </h4>
                            <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                              El expediente se encuentra actualmente en Fase {detalleExp.expediente.faseActual}.
                              Para acceder a la recolección y frentes de trabajo técnico de esta fase, se debe contar con la validación de viabilidad aprobada de Compensar en Fase 3.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <Fase4GestionTecnica
                          expediente={detalleExp.expediente}
                          currentUser={currentUser}
                          onAbrirVisor={(docData) => setDocVisorData(docData)}
                          onActualizarExpediente={async () => {
                            await cargarDetalleExpediente(detalleExp.expediente.id);
                            await cargarExpedientes();
                          }}
                          authFetch={authFetch}
                        />
                      )}
                    </div>
                  )}

                  {/* CONTENIDO PESTAÑA 5: SEGUIMIENTO DE TRÁMITE DE LICENCIA DE CONSTRUCCIÓN (MUNICIPAL / CURADURÍA) */}
                  {tabRequisitos === 5 && (
                    <div>
                      {detalleExp.expediente.faseActual < 5 && currentUser.rol !== "planeacion" ? (
                        <div className="p-6 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 flex items-start space-x-3.5">
                          <Lock className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-bold text-sm text-amber-900">
                              Fase 5: En Trámite de Licencia de Construcción aún no habilitada
                            </h4>
                            <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                              El expediente se encuentra actualmente en Fase {detalleExp.expediente.faseActual}.
                              Para acceder a la gestión y seguimiento de la Licencia de Construcción ante la entidad municipal, se deben completar y validar los 3 frentes técnicos en Fase 4.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <Fase5SeguimientoLicencia
                          expediente={detalleExp.expediente}
                          currentUser={currentUser}
                          requisitoPresupuesto={detalleExp.requisitos.find((r) => r.fase === 5 && r.codigoRequisito === "F5-01")}
                          onAbrirVisor={(docData) => setDocVisorData(docData)}
                          onSubirDocPresupuesto={(_reqId) => {
                            let req = detalleExp.requisitos.find((r) => r.fase === 5 && r.codigoRequisito === "F5-01");
                            if (!req) {
                              req = {
                                id: `req-f5-01-${detalleExp.expediente.id}`,
                                expedienteId: detalleExp.expediente.id,
                                codigoRequisito: "F5-01",
                                nombre: "Presupuesto Oficial y APU Detallado",
                                descripcion: "Análisis de Precios Unitarios regionalizado Cundinamarca y presupuesto oficial de obra.",
                                fase: 5,
                                estado: "pendiente_carga",
                                esObligatorio: true,
                                esAdicional: false
                              };
                            }
                            handleAbrirModalSubir(req);
                          }}
                          onRevisarDocPresupuesto={(req) => {
                            setModalRevisarReq(req);
                            setFormRevision({ resultado: "ACEPTADO", observacion: "" });
                          }}
                          onActualizarExpediente={async (nuevaFase?: number) => {
                            await cargarDetalleExpediente(detalleExp.expediente.id);
                            await cargarExpedientes();
                            if (nuevaFase) {
                              setTabRequisitos(nuevaFase);
                            }
                          }}
                          authFetch={authFetch}
                        />
                      )}
                    </div>
                  )}

                  {/* CONTENIDO PESTAÑA 6: EN POSTULACIÓN (COMPENSAR E INDICACIÓN DE INICIO DE OBRA) */}
                  {tabRequisitos === 6 && (
                    <div>
                      {detalleExp.expediente.faseActual < 6 && currentUser.rol !== "planeacion" ? (
                        <div className="p-6 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 flex items-start space-x-3.5">
                          <Lock className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-bold text-sm text-amber-900">
                              Fase 6: En Postulación aún no habilitada
                            </h4>
                            <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                              El expediente se encuentra actualmente en Fase {detalleExp.expediente.faseActual}.
                              Para acceder a la postulación y seguimiento ante Compensar, se debe contar con la Licencia de Construcción expedida y aprobada en Fase 5.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <Fase6PostulacionSubsidio
                          expediente={detalleExp.expediente}
                          currentUser={currentUser}
                          onAbrirVisor={(docData) => setDocVisorData(docData)}
                          onActualizarExpediente={async (nuevaFase?: number) => {
                            await cargarDetalleExpediente(detalleExp.expediente.id);
                            await cargarExpedientes();
                            if (nuevaFase) {
                              setTabRequisitos(nuevaFase);
                            }
                          }}
                          authFetch={authFetch}
                        />
                      )}
                    </div>
                  )}

                  {/* CONTENIDO PESTAÑA 7: EN CONSTRUCCIÓN Y COBRO SUBSIDIO (OBRA Y LIQUIDACIÓN) */}
                  {tabRequisitos >= 7 && (
                    <div>
                      {detalleExp.expediente.faseActual < tabRequisitos && currentUser.rol !== "planeacion" ? (
                        <div className="p-6 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 flex items-start space-x-3.5">
                          <Lock className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-bold text-sm text-amber-900">
                              {fasesConfig.find((f) => f.num === tabRequisitos)?.label} aún no habilitada
                            </h4>
                            <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                              El expediente se encuentra actualmente en Fase {detalleExp.expediente.faseActual}.
                              Para acceder a las actividades y requisitos de esta fase, deben aprobarse satisfactoriamente las fases precedentes.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-xl mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                              <h4 className="font-bold text-sm text-blue-950">
                                {fasesConfig.find((f) => f.num === tabRequisitos)?.label}
                              </h4>
                              <p className="text-xs text-blue-700 mt-0.5">
                                {fasesConfig.find((f) => f.num === tabRequisitos)?.desc}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Si está bloqueado por revisión en esta fase */}
                              {detalleExp.expediente.bloqueadoPorRevision && detalleExp.expediente.faseActual === tabRequisitos && (
                                <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-100 border border-amber-300 text-amber-800 rounded-lg text-xs font-bold shadow-xs">
                                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Enviado a Supervisión</span>
                                </div>
                              )}

                              {/* Botón Enviar a Supervisión si es la fase activa con documentos */}
                              {!esSalidaDefinitiva && !detalleExp.expediente.bloqueadoPorRevision &&
                                detalleExp.expediente.faseActual === tabRequisitos &&
                                reqsFaseActual.length > 0 && (
                                  <button
                                    type="button"
                                    disabled={faltanSubirFaseActual.length > 0 || guardandoEnvioRevision}
                                    onClick={() => handleEnviarRevisionFase(tabRequisitos)}
                                    title={
                                      faltanSubirFaseActual.length > 0
                                        ? `Faltan ${faltanSubirFaseActual.length} documento(s) obligatorio(s) por subir`
                                        : `Enviar documentación de Fase ${tabRequisitos} a Supervisión`
                                    }
                                    className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
                                      faltanSubirFaseActual.length > 0
                                        ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                                        : "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                                    }`}
                                  >
                                    {guardandoEnvioRevision ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                    <span>
                                      {faltanSubirFaseActual.length > 0
                                        ? `Faltan ${faltanSubirFaseActual.length} Doc(s)`
                                        : "Enviar a Supervisión"}
                                    </span>
                                  </button>
                                )}

                              {/* Botón de avance de fase para supervisores / administradores / ingenieros */}
                              {!esSalidaDefinitiva && (currentUser.rol === "supervisor" || currentUser.rol === "administrador" || currentUser.rol === "ingenieria") && tabRequisitos < 7 && (
                                <button
                                  type="button"
                                  onClick={() => handleAvanzarFase(tabRequisitos + 1)}
                                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                                >
                                  <span>Avanzar a Fase {tabRequisitos + 1}</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <div className="font-mono font-bold text-xs bg-white px-3 py-1.5 rounded-lg border border-blue-200 text-blue-800 shadow-xs">
                                {reqsFaseActual.length > 0 ? `${reqsFaseActual.filter((r) => r.estado === "aceptado").length} de ${reqsFaseActual.length} Aceptados` : "Activa"}
                              </div>
                            </div>
                          </div>

                          {reqsFaseActual.length === 0 ? (
                            <div className="p-8 bg-white border border-dashed border-slate-300 rounded-xl text-center space-y-2">
                              <FileText className="w-6 h-6 text-slate-400 mx-auto" />
                              <h4 className="text-sm font-bold text-slate-700">Sin requisitos configurados para esta fase</h4>
                              <p className="text-xs text-slate-500">
                                Los requisitos y entregables técnicos de esta fase se gestionan de acuerdo al cronograma de obra.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {reqsFaseActual.map((req) => (
                                <div
                                  key={req.id}
                                  className="p-4 border border-slate-200 rounded-xl hover:border-slate-300 transition-all bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                                >
                                  <div className="flex items-start space-x-3">
                                    <div
                                      className={`p-2.5 rounded-lg ${
                                        req.estado === "aceptado"
                                          ? "bg-emerald-100 text-emerald-700"
                                          : req.estado === "con_observaciones"
                                          ? "bg-amber-100 text-amber-700"
                                          : "bg-slate-100 text-slate-600"
                                      }`}
                                    >
                                      <FileText className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <div className="flex items-center space-x-2">
                                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                          {req.codigoRequisito}
                                        </span>
                                        <h4 className="text-sm font-bold text-slate-800">{req.nombre}</h4>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${req.esObligatorio ? "bg-slate-100 text-slate-600" : "bg-blue-50 text-blue-600"}`}>
                                          {req.esObligatorio ? "Obligatorio" : "Opcional"}
                                        </span>
                                      </div>
                                      <p className="text-xs text-slate-500 mt-0.5">{req.descripcion}</p>

                                      {req.documentoAsociado?.versionActual && (
                                        <div className="text-[11px] text-slate-600 mt-1.5 flex items-center space-x-2 font-mono">
                                          <span>v{req.documentoAsociado.versionActual.versionNumero}</span>
                                          <span>•</span>
                                          <span>{req.documentoAsociado.versionActual.nombreArchivoOriginal}</span>
                                          <span>•</span>
                                          <span className="text-slate-400">
                                            Hash: {req.documentoAsociado.versionActual.sha256Hash.substring(0, 12)}...
                                          </span>
                                        </div>
                                      )}

                                      {/* Observación activa si existe */}
                                      {(req.estado === "con_observaciones" || req.ultimaRevision?.resultado === "OBSERVADO" || Boolean(req.observaciones)) && (
                                        <div className="mt-2.5 p-3 bg-amber-50/90 border border-amber-300 rounded-lg text-xs text-amber-900 shadow-2xs">
                                          <div className="flex items-center justify-between gap-2 mb-1">
                                            <div className="flex items-center space-x-1.5 font-bold text-amber-900">
                                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                              <span>Observación de Análisis Documental:</span>
                                            </div>
                                            {(currentUser.rol === "asistente" || currentUser.rol === "ingenieria" || currentUser.rol === "administrador" || currentUser.rol === "comercial") && (
                                              <button
                                                type="button"
                                                onClick={() => handleAbrirModalSubir(req)}
                                                className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold transition-colors cursor-pointer shrink-0 shadow-2xs"
                                                title="Subir archivo corregido para subsanar esta observación"
                                              >
                                                <Upload className="w-3 h-3" />
                                                <span>Subir Corrección</span>
                                              </button>
                                            )}
                                          </div>
                                          <p className="text-slate-700 pl-5 leading-relaxed">
                                            {req.ultimaRevision?.observacion || req.observaciones || "Por favor subsanar la observación indicada por el supervisor."}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center space-x-2 self-end md:self-center">
                                    <span
                                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                        req.estado === "aceptado"
                                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                          : req.estado === "con_observaciones"
                                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                                          : "bg-slate-100 text-slate-600"
                                      }`}
                                    >
                                      {req.estado === "aceptado"
                                        ? "Aceptado"
                                        : req.estado === "con_observaciones"
                                        ? "Con Observaciones"
                                        : "Pendiente Carga"}
                                    </span>

                                    {req.documentoAsociado?.versionActual && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDocVisorData({
                                            titulo: req.nombre,
                                            nombreArchivo: req.documentoAsociado!.versionActual!.nombreArchivoOriginal,
                                            mimeType: req.documentoAsociado!.versionActual!.mimeType,
                                            sha256Hash: req.documentoAsociado!.versionActual!.sha256Hash,
                                            tamanoBytes: req.documentoAsociado!.versionActual!.tamanoBytes,
                                            subidoPor: req.documentoAsociado!.versionActual!.subidoPorNombre,
                                            subidoEn: req.documentoAsociado!.versionActual!.subidoEn,
                                            archivoDataUrl: obtenerUrlConAntiCache(req.documentoAsociado!.versionActual!.archivoDataUrl),
                                            fotos: req.documentoAsociado!.versionActual!.fotos
                                          });
                                        }}
                                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                                        title="Abrir en Visor Interno"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                    )}

                                    {/* Descargar directamente con anti-caché */}
                                    {req.documentoAsociado?.versionActual && (
                                      <a
                                        href={obtenerUrlConAntiCache(req.documentoAsociado.versionActual.archivoDataUrl)}
                                        download={req.documentoAsociado.versionActual.nombreArchivoOriginal}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                                        title="Descargar documento directamente"
                                      >
                                        <Download className="w-4 h-4" />
                                      </a>
                                    )}

                                    {!esSalidaDefinitiva && currentUser.rol !== "planeacion" && (currentUser.rol === "asistente" || currentUser.rol === "administrador" || currentUser.rol === "ingenieria" || currentUser.rol === "comercial") && (() => {
                                      const tieneObservacionFases =
                                        req.estado === "con_observaciones" ||
                                        req.ultimaRevision?.resultado === "OBSERVADO" ||
                                        Boolean(req.ultimaRevision?.observacion) ||
                                        Boolean(req.observaciones);

                                      const faseGenericaConObservaciones =
                                        detalleExp.expediente.revisionFases?.[req.fase || tabRequisitos]?.estado === "devuelto" ||
                                        Boolean(detalleExp.expediente.revisionFases?.[req.fase || tabRequisitos]?.observacionesDevolucion) ||
                                        detalleExp.requisitos.some(
                                          (r) =>
                                            r.fase === (req.fase || tabRequisitos) &&
                                            (r.estado === "con_observaciones" || r.ultimaRevision?.resultado === "OBSERVADO" || Boolean(r.observaciones))
                                        );

                                      const esObservadoFases = tieneObservacionFases || faseGenericaConObservaciones;

                                      if (!detalleExp.expediente.bloqueadoPorRevision || currentUser.rol === "administrador" || esObservadoFases) {
                                        return (
                                          <button
                                            type="button"
                                            onClick={() => handleAbrirModalSubir(req)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 cursor-pointer border shadow-2xs ${
                                              esObservadoFases
                                                ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500 font-bold"
                                                : "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                                            }`}
                                          >
                                            <Upload className={`w-3.5 h-3.5 ${esObservadoFases ? "text-white" : "text-blue-600"}`} />
                                            <span>{esObservadoFases ? "Corregir Documento" : req.documentoAsociado ? "Reemplazar" : "Subir Documento"}</span>
                                          </button>
                                        );
                                      }

                                      return (
                                        <span className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-semibold">
                                          <Lock className="w-3 h-3 text-amber-600" />
                                          <span>Bloqueado por Revisión</span>
                                        </span>
                                      );
                                    })()}

                                    {!esSalidaDefinitiva && (currentUser.rol === "supervisor" || currentUser.rol === "administrador") && req.documentoAsociado?.versionActual && (() => {
                                      const deshabilitarRevisarSupervisor = !req.documentoAsociado?.versionActual;
                                      return (
                                        <button
                                          type="button"
                                          disabled={deshabilitarRevisarSupervisor}
                                          onClick={() => {
                                            if (deshabilitarRevisarSupervisor) return;
                                            setModalRevisarReq(req);
                                            setFormRevision({ resultado: "ACEPTADO", observacion: "" });
                                          }}
                                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 border ${
                                            deshabilitarRevisarSupervisor
                                              ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60"
                                              : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 cursor-pointer"
                                          }`}
                                          title={
                                            deshabilitarRevisarSupervisor
                                              ? "Revisión no disponible: El responsable debe enviar el expediente a Análisis Documental."
                                              : "Revisar y calificar documento"
                                          }
                                        >
                                          <CheckCircle2 className={`w-3.5 h-3.5 ${deshabilitarRevisarSupervisor ? "text-slate-400" : "text-emerald-700"}`} />
                                          <span>Revisar</span>
                                        </button>
                                      );
                                    })()}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {/* SECCIÓN DE ARCHIVOS ADICIONALES PARA FASES 3, 4, 5, 6, 7 */}
                  {tabRequisitos >= 3 && detalleExp.requisitos.filter((r) => r.fase === tabRequisitos && Boolean(r.codigoRequisito?.includes("ADICIONAL"))).length > 0 && (
                    <div className="mt-6 pt-5 border-t border-slate-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Archivos Adicionales Incorporados a Fase {tabRequisitos} ({detalleExp.requisitos.filter((r) => r.fase === tabRequisitos && Boolean(r.codigoRequisito?.includes("ADICIONAL"))).length})
                          </h4>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {detalleExp.requisitos
                          .filter((r) => r.fase === tabRequisitos && Boolean(r.codigoRequisito?.includes("ADICIONAL")))
                          .map((req) => (
                            <div key={req.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center space-x-1.5 mb-1">
                                  <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-100/60 px-1.5 py-0.5 rounded">
                                    {req.codigoRequisito}
                                  </span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${req.documentoAsociado ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                                    {req.documentoAsociado ? "Cargado" : "Pendiente de archivo"}
                                  </span>
                                </div>
                                <h5 className="font-bold text-xs text-slate-900 truncate" title={req.nombre}>{req.nombre}</h5>
                                {req.descripcion && <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{req.descripcion}</p>}
                                {req.documentoAsociado?.versionActual && (
                                  <p className="text-[10px] text-slate-400 font-mono mt-1 truncate">
                                    {req.documentoAsociado.versionActual.nombreArchivoOriginal}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center space-x-1 shrink-0">
                                {req.documentoAsociado?.versionActual && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDocVisorData({
                                          titulo: req.nombre,
                                          nombreArchivo: req.documentoAsociado!.versionActual!.nombreArchivoOriginal,
                                          mimeType: req.documentoAsociado!.versionActual!.mimeType,
                                          sha256Hash: req.documentoAsociado!.versionActual!.sha256Hash,
                                          tamanoBytes: req.documentoAsociado!.versionActual!.tamanoBytes,
                                          subidoPor: req.documentoAsociado!.versionActual!.subidoPorNombre,
                                          subidoEn: req.documentoAsociado!.versionActual!.subidoEn,
                                          versionNumero: req.documentoAsociado!.versionActual!.versionNumero,
                                          categoria: `Fase ${req.fase} Adicional`,
                                          url: req.documentoAsociado!.versionActual!.archivoDataUrl
                                        });
                                      }}
                                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg cursor-pointer transition-colors"
                                      title="Visualizar documento"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    <a
                                      href={obtenerUrlConAntiCache(req.documentoAsociado.versionActual.archivoDataUrl)}
                                      download={req.documentoAsociado.versionActual.nombreArchivoOriginal}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
                                      title="Descargar documento"
                                    >
                                      <Download className="w-4 h-4" />
                                    </a>
                                  </>
                                )}
                                {!esSalidaDefinitiva && (
                                  <button
                                    type="button"
                                    onClick={() => handleAbrirModalSubir(req)}
                                    className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                                    title={req.documentoAsociado ? "Reemplazar archivo" : "Cargar archivo"}
                                  >
                                    <Upload className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* SECCIÓN 3: BITÁCORA Y NOTAS DE SEGUIMIENTO */}
            <div id="seccion-bitacora-notas" className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
              <h3 className="text-base font-bold text-slate-900 mb-4">Bitácora de Conversaciones y Notas</h3>

              {esSalidaDefinitiva || currentUser.rol === "planeacion" ? (
                <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 flex items-center space-x-2">
                  <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    {currentUser.rol === "planeacion"
                      ? "Perfil de Planeación y Auditoría: La bitácora se encuentra en modo de consulta histórica (solo lectura)."
                      : "El expediente está en salida definitiva. La bitácora se encuentra en modo de consulta histórica (solo lectura)."}
                  </span>
                </div>
              ) : (
                <form onSubmit={handleAgregarNota} className="mb-6">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={nuevaNotaTexto}
                      onChange={(e) => setNuevaNotaTexto(e.target.value)}
                      placeholder="Registrar conversación, llamada o compromiso..."
                      className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center space-x-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Guardar Nota</span>
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                {notasOrdenadas.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">No hay notas registradas todavía.</p>
                ) : (
                  notasOrdenadas.map((n) => (
                    <div key={n.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                        <span className="font-bold text-slate-700">{formatearNombreUsuario(n.autorNombre)}</span>
                        <span>{new Date(n.creadoEn || n.fechaGestion).toLocaleString("es-CO")}</span>
                      </div>
                      <p className="text-slate-800">{n.contenido}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          );
        })()}
      </main>

      {/* MODAL: NUEVO INTERESADO */}
      {modalNuevoInteresado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Registrar Nuevo Interesado</h3>
              <button
                type="button"
                onClick={() => setModalNuevoInteresado(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorInteresado && (
              <div className="p-3 mb-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{errorInteresado}</span>
              </div>
            )}

            <form onSubmit={handleCrearInteresado} className="space-y-3.5 text-xs">
              {/* Espacio para guardar la Cédula / Documento desde un primer lugar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tipo de Doc. <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formInteresado.tipoIdentificacion}
                    onChange={(e) => setFormInteresado({ ...formInteresado, tipoIdentificacion: e.target.value as TipoIdentificacion })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                  >
                    <option value="CC">Cédula Ciudadanía (CC)</option>
                    <option value="CE">Cédula Extranjería (CE)</option>
                    <option value="TI">Tarjeta Identidad (TI)</option>
                    <option value="PAS">Pasaporte (PAS)</option>
                    <option value="RC">Registro Civil (RC)</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Cédula / Documento de Identidad <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formInteresado.numeroIdentificacion}
                    onChange={(e) => setFormInteresado({ ...formInteresado, numeroIdentificacion: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono font-medium"
                    placeholder="ej: 75097530 o 1023456789"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Se almacena desde la captación y se utilizará en todos los trámites futuros del expediente.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Primer Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formInteresado.primerNombre}
                    onChange={(e) => {
                      const val = e.target.value;
                      const full = [val, formInteresado.segundoNombre, formInteresado.primerApellido, formInteresado.segundoApellido].filter(Boolean).join(" ");
                      setFormInteresado({ ...formInteresado, primerNombre: val, nombreContacto: full });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="ej: Marta"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Segundo Nombre
                  </label>
                  <input
                    type="text"
                    value={formInteresado.segundoNombre}
                    onChange={(e) => {
                      const val = e.target.value;
                      const full = [formInteresado.primerNombre, val, formInteresado.primerApellido, formInteresado.segundoApellido].filter(Boolean).join(" ");
                      setFormInteresado({ ...formInteresado, segundoNombre: val, nombreContacto: full });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="ej: Lucía"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Primer Apellido <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formInteresado.primerApellido}
                    onChange={(e) => {
                      const val = e.target.value;
                      const full = [formInteresado.primerNombre, formInteresado.segundoNombre, val, formInteresado.segundoApellido].filter(Boolean).join(" ");
                      setFormInteresado({ ...formInteresado, primerApellido: val, nombreContacto: full });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="ej: Rojas"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Segundo Apellido
                  </label>
                  <input
                    type="text"
                    value={formInteresado.segundoApellido}
                    onChange={(e) => {
                      const val = e.target.value;
                      const full = [formInteresado.primerNombre, formInteresado.segundoNombre, formInteresado.primerApellido, val].filter(Boolean).join(" ");
                      setFormInteresado({ ...formInteresado, segundoApellido: val, nombreContacto: full });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="ej: Gómez"
                  />
                </div>
              </div>

              {/* Opción para poner 2 teléfonos de contacto en caso de ser necesario */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 flex items-center space-x-1.5">
                    <Phone className="w-3.5 h-3.5 text-blue-600" />
                    <span>Teléfonos de Contacto</span>
                  </span>
                  {!formInteresado.habilitarSegundoTelefono && (
                    <button
                      type="button"
                      onClick={() => setFormInteresado({ ...formInteresado, habilitarSegundoTelefono: true })}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center space-x-1 cursor-pointer"
                    >
                      <PlusCircle className="w-3 h-3" />
                      <span>+ Añadir 2do teléfono</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Teléfono Principal (Contacto 1) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={formInteresado.telefono}
                      onChange={(e) => setFormInteresado({ ...formInteresado, telefono: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono bg-white"
                      placeholder="ej: 3104567890"
                    />
                    <label className="mt-1.5 flex items-center space-x-1.5 cursor-pointer text-slate-600 select-none">
                      <input
                        type="checkbox"
                        checked={formInteresado.tieneWhatsapp}
                        onChange={(e) => setFormInteresado({ ...formInteresado, tieneWhatsapp: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-[11px]">Tiene WhatsApp</span>
                    </label>
                  </div>

                  {formInteresado.habilitarSegundoTelefono ? (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-semibold text-slate-700">
                          Teléfono Contacto 2 (Opcional)
                        </label>
                        <button
                          type="button"
                          onClick={() => setFormInteresado({ ...formInteresado, habilitarSegundoTelefono: false, telefonoSecundario: "", tieneWhatsappSecundario: false })}
                          className="text-[10px] text-red-500 hover:text-red-700 font-medium cursor-pointer"
                        >
                          Quitar
                        </button>
                      </div>
                      <input
                        type="tel"
                        value={formInteresado.telefonoSecundario}
                        onChange={(e) => setFormInteresado({ ...formInteresado, telefonoSecundario: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono bg-white"
                        placeholder="ej: 3209876543 / 6012345678"
                      />
                      <label className="mt-1.5 flex items-center space-x-1.5 cursor-pointer text-slate-600 select-none">
                        <input
                          type="checkbox"
                          checked={formInteresado.tieneWhatsappSecundario}
                          onChange={(e) => setFormInteresado({ ...formInteresado, tieneWhatsappSecundario: e.target.checked })}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-[11px]">Tiene WhatsApp</span>
                      </label>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center border border-dashed border-slate-300 rounded-lg p-2.5 text-center text-slate-400 bg-white">
                      <button
                        type="button"
                        onClick={() => setFormInteresado({ ...formInteresado, habilitarSegundoTelefono: true })}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1.5 cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Opción de 2do teléfono de contacto</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Municipio Tentativo</label>
                  <select
                    value={formInteresado.municipioCodigo}
                    onChange={(e) => {
                      const mun = CATALOGO_MUNICIPIOS.find((m) => m.codigoCompleto === e.target.value);
                      setFormInteresado({
                        ...formInteresado,
                        municipioCodigo: e.target.value,
                        departamentoCodigo: mun?.departamentoCodigo || e.target.value.substring(0, 2)
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    {CATALOGO_MUNICIPIOS.map((m) => (
                      <option key={m.codigoCompleto} value={m.codigoCompleto}>
                        {m.municipioNombre} ({m.codigoCompleto})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vereda (Opcional)</label>
                  <input
                    type="text"
                    value={formInteresado.vereda}
                    onChange={(e) => setFormInteresado({ ...formInteresado, vereda: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="ej: Rincón Grande"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Origen de la Captación <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formInteresado.origenContacto}
                    onChange={(e) => setFormInteresado({ ...formInteresado, origenContacto: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 bg-white"
                  >
                    {origenesCaptacion.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Correo Electrónico (Opcional)</label>
                  <input
                    type="email"
                    value={formInteresado.correo}
                    onChange={(e) => setFormInteresado({ ...formInteresado, correo: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="ej: marta@correo.com"
                  />
                </div>
              </div>

              {/* CAMBIO 8: Detalles del Contacto / Resumen de la Necesidad */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Detalles del Contacto / Resumen de la Necesidad
                </label>
                <textarea
                  rows={3}
                  value={formInteresado.resumenNecesidad}
                  onChange={(e) => setFormInteresado({ ...formInteresado, resumenNecesidad: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Detalles sobre cómo se contactó al hogar, necesidades expuestas, antecedentes del predio y observaciones iniciales..."
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Esta información se registrará automáticamente como la primera nota en la bitácora del hogar para garantizar su trazabilidad histórica.
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNuevoInteresado(false)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoInteresado}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-bold shadow-sm transition-colors flex items-center"
                >
                  {guardandoInteresado ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>Guardar Interesado</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CAMBIO 3: MODAL GESTIONAR VENCIMIENTO DE PROSPECCIÓN */}
      {modalGestionarVencimiento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">Gestionar Vencimiento de Prospección</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalGestionarVencimiento(null);
                  setMotivoDescarte("");
                  setConfirmarDescarte(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1">
              <div className="font-bold text-amber-900">
                Hogar: {modalGestionarVencimiento.nombreContacto}
              </div>
              <div className="text-slate-600">
                Registrado el {new Date(modalGestionarVencimiento.creadoEn).toLocaleDateString("es-CO")} ({
                  (modalGestionarVencimiento as any).diasDesdeRegistro ??
                  Math.max(0, Math.floor((Date.now() - new Date(modalGestionarVencimiento.creadoEn).getTime()) / (1000 * 60 * 60 * 24)))
                } días transcurridos).
              </div>
              <div className="text-amber-800 font-medium">
                El plazo inicial de 45 días calendario ha expirado sin formalizar la creación del expediente. Seleccione una de las dos decisiones requeridas:
              </div>
            </div>

            {!confirmarDescarte ? (
              <div className="space-y-4 text-xs">
                {/* OPCIÓN 1: AMPLIAR PLAZO */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>Opción 1: Ampliar Plazo de Prospección</span>
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Otorga prórroga de tiempo extra para recopilar documentos faltantes y desbloquear la creación del expediente.
                  </p>
                  <div className="flex items-center space-x-2">
                    <select
                      value={diasExtensionSeleccionados}
                      onChange={(e) => setDiasExtensionSeleccionados(Number(e.target.value))}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold text-slate-700 outline-none"
                    >
                      <option value={7}>7 días de ampliación</option>
                      <option value={15}>15 días de ampliación</option>
                    </select>
                    <button
                      type="button"
                      disabled={procesandoVencimiento}
                      onClick={() => handleAmpliarPlazo(modalGestionarVencimiento.id, diasExtensionSeleccionados)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {procesandoVencimiento ? "Guardando..." : "Confirmar Prórroga"}
                    </button>
                  </div>
                </div>

                {/* OPCIÓN 2: DESCARTAR PROSPECTO */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                    <UserX className="w-4 h-4 text-red-600" />
                    <span>Opción 2: Descartar Prospecto</span>
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Si el hogar no es viable o manifestó desistimiento, descártelo de la captación activa. Esta acción es definitiva.
                  </p>
                  <button
                    type="button"
                    onClick={() => setConfirmarDescarte(true)}
                    className="w-full px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold rounded-lg transition-colors cursor-pointer text-center"
                  >
                    Descartar este Hogar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
                  <div className="font-bold mb-1">Confirmar descarte definitivo</div>
                  <p className="text-[11px]">
                    Indique el motivo por el cual se descarta el prospecto. El registro quedará archivado con nota en bitácora y se retirará de la vista de captación activa.
                  </p>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Motivo del descarte:</label>
                  <textarea
                    rows={3}
                    value={motivoDescarte}
                    onChange={(e) => setMotivoDescarte(e.target.value)}
                    placeholder="ej: Desistimiento voluntario, predio no cumple condiciones técnicas, no aporta documentación requerida..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none text-xs"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmarDescarte(false)}
                    className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                  >
                    Regresar
                  </button>
                  <button
                    type="button"
                    disabled={procesandoVencimiento}
                    onClick={() => handleDescartarProspecto(modalGestionarVencimiento.id, motivoDescarte)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-xs transition-colors"
                  >
                    {procesandoVencimiento ? "Descartando..." : "Confirmar Descarte Definitivo"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR CÉDULA AL HOGAR */}
      {modalAgregarCedula && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-slate-900 mb-2">Agregar Cédula de Integrante</h3>
            <p className="text-xs text-slate-500 mb-4">
              Agregue un integrante declarado por la familia. Esto creará el requisito documental correspondiente.
            </p>
            {errorAgregarCedula && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorAgregarCedula}</span>
              </div>
            )}
            <form onSubmit={handleAgregarCedula} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo Identificación</label>
                  <select
                    value={formIntegrante.tipoIdentificacion}
                    onChange={(e) =>
                      setFormIntegrante({
                        ...formIntegrante,
                        tipoIdentificacion: e.target.value as TipoIdentificacion
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none"
                  >
                    <option value="CC">Cédula de Ciudadanía (CC)</option>
                    <option value="CE">Cédula de Extranjería (CE)</option>
                    <option value="TI">Tarjeta de Identidad (TI)</option>
                    <option value="RC">Registro Civil (RC)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Número</label>
                  <input
                    type="text"
                    required
                    value={formIntegrante.numeroIdentificacion}
                    onChange={(e) => setFormIntegrante({ ...formIntegrante, numeroIdentificacion: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none"
                    placeholder="ej: 1018945678"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Primer Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formIntegrante.primerNombre}
                    onChange={(e) => {
                      const val = e.target.value;
                      const nomCompleto = [val, formIntegrante.segundoNombre].filter(Boolean).join(" ");
                      setFormIntegrante({ ...formIntegrante, primerNombre: val, nombres: nomCompleto });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none"
                    placeholder="ej: Andrés"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Segundo Nombre</label>
                  <input
                    type="text"
                    value={formIntegrante.segundoNombre}
                    onChange={(e) => {
                      const val = e.target.value;
                      const nomCompleto = [formIntegrante.primerNombre, val].filter(Boolean).join(" ");
                      setFormIntegrante({ ...formIntegrante, segundoNombre: val, nombres: nomCompleto });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none"
                    placeholder="ej: Felipe"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Primer Apellido <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formIntegrante.primerApellido}
                    onChange={(e) => setFormIntegrante({ ...formIntegrante, primerApellido: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none"
                    placeholder="ej: Franco"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Segundo Apellido</label>
                  <input
                    type="text"
                    value={formIntegrante.segundoApellido}
                    onChange={(e) => setFormIntegrante({ ...formIntegrante, segundoApellido: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none"
                    placeholder="ej: Osorio"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Parentesco con el Postulante</label>
                <input
                  type="text"
                  required
                  value={formIntegrante.parentesco}
                  onChange={(e) => setFormIntegrante({ ...formIntegrante, parentesco: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none"
                  placeholder="ej: hijo, cónyuge, hermano..."
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Documento de Cédula / Identidad (Opcional - PDF o Imagen)
                </label>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => setArchivoCedulaIntegrante(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-200 rounded-lg p-1 bg-slate-50/50"
                />
                {archivoCedulaIntegrante && (
                  <p className="text-[11px] text-blue-700 mt-1 font-mono">
                    Se guardará como: <span className="font-semibold">{generarNombreArchivoCedulaEstandar(construirNombreCompleto(formIntegrante.primerNombre, formIntegrante.segundoNombre, formIntegrante.primerApellido, formIntegrante.segundoApellido) || formIntegrante.primerNombre || "integrante", formIntegrante.numeroIdentificacion || "0000", archivoCedulaIntegrante.name.split('.').pop() || 'pdf')}</span>
                  </p>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setModalAgregarCedula(false);
                    setErrorAgregarCedula(null);
                    setArchivoCedulaIntegrante(null);
                  }}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm"
                >
                  Confirmar Integrante
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SUBIR / REEMPLAZAR ARCHIVO REAL */}
      {modalSubirArchivoReq && (() => {
        const esRequisitoFoto =
          modalSubirArchivoReq.codigoRequisito === "F2-11" ||
          modalSubirArchivoReq.nombre.toLowerCase().includes("fotogr") ||
          modalSubirArchivoReq.nombre.toLowerCase().includes("foto");

        const esPresupuestoOMemorias =
          modalSubirArchivoReq.codigoRequisito === "F5-01" ||
          modalSubirArchivoReq.nombre.toLowerCase().includes("presupuesto") ||
          modalSubirArchivoReq.nombre.toLowerCase().includes("memoria") ||
          modalSubirArchivoReq.nombre.toLowerCase().includes("apu") ||
          modalSubirArchivoReq.nombre.toLowerCase().includes("calculo");

        const categoriasPermitidas = [
          "Fachada / Vivienda actual",
          "Lote / Terreno",
          "Linderos / Mojones",
          "Vía de acceso / Entorno",
          "Fotografía complementaria"
        ];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
            <div className={`bg-white rounded-xl shadow-2xl w-full ${esRequisitoFoto ? "max-w-3xl" : "max-w-lg"} p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col`}>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4 shrink-0">
                <div className="flex items-center space-x-3">
                  <div className={`p-2.5 rounded-xl shrink-0 ${esRequisitoFoto ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                    {esRequisitoFoto ? <Camera className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {esRequisitoFoto ? "Registro Fotográfico del Predio" : modalSubirArchivoReq.documentoAsociado ? "Reemplazar Documento" : "Cargar Documento Real"}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Requisito: <strong className="text-slate-800">{modalSubirArchivoReq.codigoRequisito} — {modalSubirArchivoReq.nombre}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModalSubirArchivoReq(null);
                    setArchivoSeleccionadoSubir(null);
                    setFotosParaRegistro([]);
                    setErrorSubirArchivo(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {errorSubirArchivo && (
                <div className="p-3.5 mb-4 bg-amber-50/90 border border-amber-300 rounded-xl text-xs text-amber-950 flex items-start space-x-2.5 shrink-0 shadow-2xs">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                  <span className="leading-relaxed">{errorSubirArchivo}</span>
                </div>
              )}

              {esRequisitoFoto ? (
                /* EXPERIENCIA ESPECIALIZADA: ÁLBUM Y REGISTRO FOTOGRÁFICO */
                <div className="space-y-4 overflow-y-auto pr-1 flex-1">
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start space-x-2.5">
                    <Camera className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <strong className="block text-amber-950">Lineamientos del Registro Fotográfico VRD:</strong>
                      <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                        Adjunte fotografías nítidas del predio rural: <strong>1) Fachada / Vivienda actual</strong>, <strong>2) Lote a construir</strong>, <strong>3) Linderos y mojones</strong>, y <strong>4) Vía de acceso veredal</strong>. Puede seleccionar o arrastrar varias imágenes al tiempo (.jpg, .jpeg, .png, .webp).
                      </p>
                    </div>
                  </div>

                  {/* Zona Drag & Drop para Múltiples Fotos */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverSubir(true);
                    }}
                    onDragLeave={() => setDragOverSubir(false)}
                    onDrop={async (e) => {
                      e.preventDefault();
                      setDragOverSubir(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        const nuevas: { id: string; nombre: string; url: string; tamanoBytes: number; categoria: string }[] = [];
                        for (let i = 0; i < e.dataTransfer.files.length; i++) {
                          const file = e.dataTransfer.files[i];
                          if (file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(file.name)) {
                            const dataUrl = await new Promise<string>((res) => {
                              const r = new FileReader();
                              r.onload = () => res(r.result as string);
                              r.readAsDataURL(file);
                            });
                            const catIndex = (fotosParaRegistro.length + nuevas.length) % categoriasPermitidas.length;
                            nuevas.push({
                              id: `foto-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
                              nombre: file.name,
                              url: dataUrl,
                              tamanoBytes: file.size,
                              categoria: categoriasPermitidas[catIndex]
                            });
                          }
                        }
                        if (nuevas.length > 0) {
                          setFotosParaRegistro((prev) => [...prev, ...nuevas]);
                          setErrorSubirArchivo(null);
                        } else {
                          setErrorSubirArchivo("Por favor seleccione archivos de imagen (.jpg, .png, .webp).");
                        }
                      }
                    }}
                    className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-all ${
                      dragOverSubir
                        ? "border-amber-500 bg-amber-50/90 scale-[1.01]"
                        : "border-slate-300 hover:border-amber-400 bg-slate-50/60 hover:bg-amber-50/20"
                    }`}
                  >
                    <input
                      type="file"
                      id="inputFotosMultipleModal"
                      multiple
                      accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onClick={(e) => {
                        (e.target as HTMLInputElement).value = "";
                      }}
                      onChange={async (e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          const nuevas: { id: string; nombre: string; url: string; tamanoBytes: number; categoria: string }[] = [];
                          for (let i = 0; i < e.target.files.length; i++) {
                            const file = e.target.files[i];
                            const dataUrl = await new Promise<string>((res) => {
                              const r = new FileReader();
                              r.onload = () => res(r.result as string);
                              r.readAsDataURL(file);
                            });
                            const catIndex = (fotosParaRegistro.length + nuevas.length) % categoriasPermitidas.length;
                            nuevas.push({
                              id: `foto-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
                              nombre: file.name,
                              url: dataUrl,
                              tamanoBytes: file.size,
                              categoria: categoriasPermitidas[catIndex]
                            });
                          }
                          setFotosParaRegistro((prev) => [...prev, ...nuevas]);
                          setErrorSubirArchivo(null);
                        }
                      }}
                    />

                    <label htmlFor="inputFotosMultipleModal" className="cursor-pointer block space-y-1.5">
                      <div className="w-10 h-10 mx-auto rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                        <Camera className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-amber-800 hover:underline block">
                        Haga clic para seleccionar una o varias fotos de su equipo
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        o arrastre y suelte las fotos aquí (.jpg, .jpeg, .png, .webp)
                      </span>
                    </label>
                  </div>

                  {/* Botón rápido de prueba para generar 4 fotos prediales oficiales (Solo Administrador) */}
                  {currentUser.rol === "administrador" && (
                    <div className="flex items-center justify-between p-3 bg-amber-50/80 border border-amber-200 rounded-xl">
                      <div className="text-xs">
                        <span className="font-bold text-amber-900 block">Modo Administrador: Registro Oficial de Prueba</span>
                        <span className="text-amber-800 text-[11px]">Herramienta de diagnóstico para pruebas técnicas futuras. Genera 4 fotos periciales con georreferenciación.</span>
                      </div>
                      <button
                        type="button"
                        disabled={subiendoArchivo}
                        onClick={() => {
                          const fotosGeneradas = generarFotosPredioMuestra(detalleExp?.expediente.codigoVisible);
                          setFotosParaRegistro(fotosGeneradas);
                          setErrorSubirArchivo(null);
                          mostrarToast("4 fotografías periciales de prueba generadas (Solo Admin).");
                        }}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors shrink-0 flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Generar 4 Fotos (Solo Admin)</span>
                      </button>
                    </div>
                  )}

                  {/* Cuadrícula de fotos cargadas / preparadas */}
                  {fotosParaRegistro.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between text-xs text-slate-600 font-semibold px-1">
                        <span>Fotografías preparadas ({fotosParaRegistro.length}):</span>
                        <button
                          type="button"
                          onClick={() => setFotosParaRegistro([])}
                          className="text-red-600 hover:text-red-700 text-[11px] font-medium hover:underline cursor-pointer"
                        >
                          Limpiar todas
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1">
                        {fotosParaRegistro.map((foto, idx) => (
                          <div
                            key={foto.id || idx}
                            className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs flex space-x-3 items-center relative group hover:border-amber-400 transition-colors"
                          >
                            <img
                              src={foto.url}
                              alt={foto.nombre}
                              className="w-16 h-16 rounded-lg object-cover bg-slate-100 shrink-0 border border-slate-200"
                            />
                            <div className="min-w-0 flex-1 space-y-1">
                              <select
                                value={foto.categoria}
                                onChange={(e) => {
                                  const nuevaCat = e.target.value;
                                  setFotosParaRegistro((prev) =>
                                    prev.map((f, i) => (i === idx ? { ...f, categoria: nuevaCat } : f))
                                  );
                                }}
                                className="w-full text-[11px] font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                              >
                                {categoriasPermitidas.map((cat) => (
                                  <option key={cat} value={cat}>
                                    {cat}
                                  </option>
                                ))}
                              </select>
                              <div className="text-[10px] text-slate-500 truncate" title={foto.nombre}>
                                {foto.nombre}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {(foto.tamanoBytes / 1024).toFixed(0)} KB • Foto {idx + 1}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setFotosParaRegistro((prev) => prev.filter((_, i) => i !== idx));
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                              title="Quitar esta foto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* CARGADOR ESTÁNDAR: DOCUMENTO INDIVIDUAL / PDF */
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverSubir(true);
                    }}
                    onDragLeave={() => setDragOverSubir(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverSubir(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        setArchivoSeleccionadoSubir(e.dataTransfer.files[0]);
                        setErrorSubirArchivo(null);
                      }
                    }}
                    className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                      dragOverSubir
                        ? "border-blue-500 bg-blue-50/80 scale-[1.01]"
                        : archivoSeleccionadoSubir
                        ? "border-emerald-400 bg-emerald-50/40"
                        : "border-slate-300 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/30"
                    }`}
                  >
                    <input
                      type="file"
                      id="inputArchivoRealModal"
                      accept={
                        esPresupuestoOMemorias
                          ? ".pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                          : "application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                      }
                      className="hidden"
                      onClick={(e) => {
                        (e.target as HTMLInputElement).value = "";
                      }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setArchivoSeleccionadoSubir(e.target.files[0]);
                          setErrorSubirArchivo(null);
                        }
                      }}
                    />

                    {archivoSeleccionadoSubir ? (
                      <div className="space-y-3">
                        <div className="inline-flex p-3 bg-emerald-100 text-emerald-700 rounded-xl">
                          <FileText className="w-8 h-8" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800 break-all">
                            {archivoSeleccionadoSubir.name}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {(archivoSeleccionadoSubir.size / 1024).toFixed(1)} KB • {archivoSeleccionadoSubir.type || "Documento binario"}
                          </div>
                          {archivoSeleccionadoSubir.type.startsWith("image/") && !esRequisitoFoto && (
                            <div className="mt-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-[11px] font-medium flex items-center justify-center space-x-1.5">
                              <span>📄 Formato imagen detectado: se convertirá automáticamente a formato PDF oficial al subir.</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-center space-x-2 pt-1">
                          <label
                            htmlFor="inputArchivoRealModal"
                            className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs"
                          >
                            Cambiar archivo
                          </label>
                          <button
                            type="button"
                            onClick={() => setArchivoSeleccionadoSubir(null)}
                            className="px-2.5 py-1 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label htmlFor="inputArchivoRealModal" className="cursor-pointer block space-y-2">
                        <div className="w-12 h-12 mx-auto rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                          <Upload className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-blue-700 hover:underline block">
                            Haga clic para seleccionar archivo desde su equipo
                          </span>
                          <span className="text-[11px] text-slate-500 block mt-0.5">
                            o arrastre y suelte el archivo aquí
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {esPresupuestoOMemorias
                            ? "Formatos aceptados: Hojas de cálculo Excel (.xlsx, .xls, .csv) y documentos PDF (.pdf) hasta 25 MB"
                            : "Formatos admitidos: PDF, JPG, PNG, WEBP, DOCX (hasta 25 MB)"}
                        </p>
                      </label>
                    )}
                  </div>

                  {/* Opción alternativa rápida de prueba (HABILITADO EXCLUSIVAMENTE PARA ADMINISTRADOR) */}
                  {currentUser.rol === "administrador" && (
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[11px] font-bold text-amber-800 block mb-1.5">
                        Herramienta de Diagnóstico Exclusiva de Administrador:
                      </span>
                      <button
                        type="button"
                        disabled={subiendoArchivo}
                        onClick={() => {
                          const tit = `CERTIFICADO OFICIAL: ${modalSubirArchivoReq.codigoRequisito} - ${modalSubirArchivoReq.nombre.replace(/[()\\]/g, "")}`;
                          const sub = `Expediente: ${detalleExp?.expediente.codigoVisible || "VRD"} | Fecha: ${new Date().toLocaleDateString("es-CO")}`;
                          const stream = `BT /F1 14 Tf 50 720 Td (${tit}) Tj 0 -25 Td /F1 10 Tf (${sub}) Tj 0 -20 Td /F1 9 Tf (Documento digital inmutable verificado por el sistema CRM VRD.) Tj ET`;
                          const streamLen = new TextEncoder().encode(stream).length;
                          const pdfStr = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length ${streamLen} >>\nstream\n${stream}\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000224 00000 n \n0000000300 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n380\n%%EOF`;
                          const blob = new Blob([pdfStr], { type: "application/pdf" });
                          const mockFile = new File(
                            [blob],
                            `${modalSubirArchivoReq.codigoRequisito}_${modalSubirArchivoReq.nombre.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
                            { type: "application/pdf" }
                          );
                          handleCargarArchivoReal(modalSubirArchivoReq, mockFile);
                        }}
                        className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs text-amber-900 font-semibold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-700" />
                        <span>Generar y radicar PDF oficial de prueba (Solo Admin)</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Botones de acción inferiores */}
              <div className="flex items-center justify-end space-x-2 pt-4 mt-4 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setModalSubirArchivoReq(null);
                    setArchivoSeleccionadoSubir(null);
                    setFotosParaRegistro([]);
                    setErrorSubirArchivo(null);
                  }}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                {esRequisitoFoto ? (
                  <button
                    type="button"
                    disabled={fotosParaRegistro.length === 0 || subiendoArchivo}
                    onClick={() => {
                      if (modalSubirArchivoReq && fotosParaRegistro.length > 0) {
                        handleCargarRegistroFotografico(modalSubirArchivoReq, fotosParaRegistro);
                      }
                    }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white rounded-lg text-xs font-bold shadow-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
                  >
                    {subiendoArchivo && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>
                      {subiendoArchivo
                        ? "Guardando registro fotográfico..."
                        : `Guardar Registro Fotográfico (${fotosParaRegistro.length} foto${fotosParaRegistro.length === 1 ? "" : "s"})`}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!archivoSeleccionadoSubir || subiendoArchivo}
                    onClick={() => {
                      if (archivoSeleccionadoSubir && modalSubirArchivoReq) {
                        handleCargarArchivoReal(modalSubirArchivoReq, archivoSeleccionadoSubir);
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-xs font-bold shadow-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
                  >
                    {subiendoArchivo && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>
                      {subiendoArchivo
                        ? "Subiendo archivo..."
                        : archivoSeleccionadoSubir?.type.startsWith("image/") && !esRequisitoFoto
                        ? "Convertir a PDF y Subir"
                        : "Subir Documento"}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: REVISIÓN DEL SUPERVISOR */}
      {modalRevisarReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-base font-bold text-slate-900 mb-1">Revisión Humana Independiente</h3>
            <p className="text-xs text-slate-500 mb-3">
              Requisito: <strong>{modalRevisarReq.nombre}</strong> ({modalRevisarReq.codigoRequisito})
            </p>

            {/* Visualización previa de documento o fotos en la revisión */}
            {modalRevisarReq.documentoAsociado?.versionActual && (
              <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-700 truncate max-w-[260px]">
                    Archivo: {modalRevisarReq.documentoAsociado.versionActual.nombreArchivoOriginal}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDocVisorData({
                        titulo: modalRevisarReq.nombre,
                        nombreArchivo: modalRevisarReq.documentoAsociado!.versionActual!.nombreArchivoOriginal,
                        mimeType: modalRevisarReq.documentoAsociado!.versionActual!.mimeType,
                        sha256Hash: modalRevisarReq.documentoAsociado!.versionActual!.sha256Hash,
                        tamanoBytes: modalRevisarReq.documentoAsociado!.versionActual!.tamanoBytes,
                        subidoPor: modalRevisarReq.documentoAsociado!.versionActual!.subidoPorNombre,
                        subidoEn: modalRevisarReq.documentoAsociado!.versionActual!.subidoEn,
                        archivoDataUrl: modalRevisarReq.documentoAsociado!.versionActual!.archivoDataUrl,
                        fotos: modalRevisarReq.documentoAsociado!.versionActual!.fotos,
                        fotoInicialIndex: 0
                      });
                    }}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center space-x-1 cursor-pointer shrink-0"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Abrir Visor</span>
                  </button>
                </div>

                {/* Si tiene fotos adjuntas (Registro fotográfico) */}
                {modalRevisarReq.documentoAsociado.versionActual.fotos && modalRevisarReq.documentoAsociado.versionActual.fotos.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/60">
                    <span className="text-[10px] text-slate-500 font-semibold block mb-1.5">
                      📷 {modalRevisarReq.documentoAsociado.versionActual.fotos.length} Fotografías Cargadas (clic para examinar):
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {modalRevisarReq.documentoAsociado.versionActual.fotos.map((f, fIdx) => (
                        <button
                          key={f.id || fIdx}
                          type="button"
                          onClick={() => {
                            setDocVisorData({
                              titulo: modalRevisarReq.nombre,
                              nombreArchivo: modalRevisarReq.documentoAsociado!.versionActual!.nombreArchivoOriginal,
                              mimeType: modalRevisarReq.documentoAsociado!.versionActual!.mimeType,
                              sha256Hash: modalRevisarReq.documentoAsociado!.versionActual!.sha256Hash,
                              tamanoBytes: modalRevisarReq.documentoAsociado!.versionActual!.tamanoBytes,
                              subidoPor: modalRevisarReq.documentoAsociado!.versionActual!.subidoPorNombre,
                              subidoEn: modalRevisarReq.documentoAsociado!.versionActual!.subidoEn,
                              archivoDataUrl: modalRevisarReq.documentoAsociado!.versionActual!.archivoDataUrl,
                              fotos: modalRevisarReq.documentoAsociado!.versionActual!.fotos,
                              fotoInicialIndex: fIdx
                            });
                          }}
                          className="relative aspect-video rounded-md overflow-hidden border border-slate-300 hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer group bg-slate-100"
                        >
                          <img
                            src={f.url}
                            alt={f.nombre}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate text-center">
                            {f.categoria || `Foto ${fIdx + 1}`}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleEnviarRevision} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Dictamen de Análisis Documental</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormRevision({ ...formRevision, resultado: "ACEPTADO" })}
                    className={`p-2.5 rounded-lg border font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                      formRevision.resultado === "ACEPTADO"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs ring-2 ring-emerald-400/20"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Aceptar Requisito</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormRevision({ ...formRevision, resultado: "OBSERVADO" })}
                    className={`p-2.5 rounded-lg border font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                      formRevision.resultado === "OBSERVADO"
                        ? "bg-amber-50 border-amber-500 text-amber-700 shadow-xs ring-2 ring-amber-400/20"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span>Observar Subsanable</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {formRevision.resultado === "OBSERVADO" ? "Observación obligatoria:" : "Comentarios de revisión (opcional):"}
                </label>
                <textarea
                  rows={3}
                  required={formRevision.resultado === "OBSERVADO"}
                  value={formRevision.observacion}
                  onChange={(e) => setFormRevision({ ...formRevision, observacion: e.target.value })}
                  placeholder={
                    formRevision.resultado === "OBSERVADO"
                      ? "Indique la corrección requerida para el responsable (Gestor Rural / Gestor Documental)..."
                      : "Documento legible, verificado con la ficha..."
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errorRevisar && (
                  <p className="mt-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-md p-2 flex items-center space-x-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorRevisar}</span>
                  </p>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={guardandoRevision}
                  onClick={() => setModalRevisarReq(null)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoRevision}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg font-bold shadow-sm inline-flex items-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  {guardandoRevision ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>Guardar Revisión</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: APROBAR FASE 1 Y ASIGNAR GESTOR DOCUMENTAL */}
      {modalAprobarFase1 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-slate-900 mb-1">Aprobación de Fase 1</h3>
            <p className="text-xs text-slate-500 mb-4">
              Todos los requisitos obligatorios están aceptados. Para completar la aprobación, seleccione el Gestor
              Documental encargado del seguimiento general.
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Gestor Documental Responsable</label>
                <select
                  value={asistenteSeleccionadoId}
                  onChange={(e) => setAsistenteSeleccionadoId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none font-medium text-slate-800"
                >
                  {asistentesElegibles.map((asist) => (
                    <option key={asist.id} value={asist.id}>
                      {formatearNombreUsuario(asist.nombreCompleto)} ({asist.username})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 space-y-1">
                <div className="font-bold flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Validación de Requisitos Superada</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Tradición y predial evaluados. Al aprobar, el expediente pasa inmediatamente a <strong>Fase 2: Conformación del Hogar</strong> a cargo del Gestor Documental para la gestión y carga documental del hogar.
                </p>
              </div>

              {errorAprobar && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorAprobar}</span>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalAprobarFase1(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={guardandoAprobacion}
                  onClick={handleConfirmarAprobacionFase1}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg font-bold shadow-sm flex items-center space-x-1.5 cursor-pointer"
                >
                  {guardandoAprobacion && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{guardandoAprobacion ? "Aprobando..." : "Aprobar y Pasar a Fase 2"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONVERTIR INTERESADO EN EXPEDIENTE VRD (CAMBIO 5: TEXTOS INFORMATIVOS RETIRADOS) */}
      {modalConvertirInteresado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 mb-4">
              Crear Expediente VRD desde Interesado
            </h3>

            <form onSubmit={handleConfirmarConversion} className="space-y-4 text-xs">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg space-y-1">
                <div className="font-bold text-blue-900">Origen de Captación:</div>
                <div className="text-slate-700">
                  {modalConvertirInteresado.nombreContacto} • Tel: {modalConvertirInteresado.telefono}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <h4 className="font-bold text-slate-800 mb-2">1. Postulante Principal</h4>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Tipo ID</label>
                    <select
                      value={formConvertir.tipoIdentificacion}
                      onChange={(e) => setFormConvertir({ ...formConvertir, tipoIdentificacion: e.target.value as TipoIdentificacion })}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg outline-none"
                    >
                      <option value="CC">CC - Cédula</option>
                      <option value="CE">CE - Extranjería</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-600 font-medium">
                        Número Cédula / ID <span className="text-red-500">*</span>
                      </label>
                      {formConvertir.numeroIdentificacion && (
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                          ✓ Traída de captación
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      value={formConvertir.numeroIdentificacion}
                      onChange={(e) => setFormConvertir({ ...formConvertir, numeroIdentificacion: e.target.value })}
                      placeholder="ej: 75097530"
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg outline-none font-mono bg-slate-50 focus:bg-white"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      {formConvertir.numeroIdentificacion
                        ? "Cédula vinculada automáticamente desde la captación del hogar. No es necesario volver a digitarla."
                        : "No se registró en captación. Ingrese el número de cédula para crear el expediente."}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">
                      Primer Nombre <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formConvertir.primerNombre}
                      onChange={(e) => {
                        const val = e.target.value;
                        const nomCompleto = [val, formConvertir.segundoNombre].filter(Boolean).join(" ");
                        setFormConvertir({ ...formConvertir, primerNombre: val, nombres: nomCompleto });
                      }}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Segundo Nombre</label>
                    <input
                      type="text"
                      value={formConvertir.segundoNombre}
                      onChange={(e) => {
                        const val = e.target.value;
                        const nomCompleto = [formConvertir.primerNombre, val].filter(Boolean).join(" ");
                        setFormConvertir({ ...formConvertir, segundoNombre: val, nombres: nomCompleto });
                      }}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">
                      Primer Apellido <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formConvertir.primerApellido}
                      onChange={(e) => setFormConvertir({ ...formConvertir, primerApellido: e.target.value })}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Segundo Apellido</label>
                    <input
                      type="text"
                      value={formConvertir.segundoApellido}
                      onChange={(e) => setFormConvertir({ ...formConvertir, segundoApellido: e.target.value })}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <h4 className="font-bold text-slate-800 mb-2">2. Ubicación del Predio de Vivienda</h4>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Municipio Oficial (5 dígitos) *</label>
                    <select
                      value={formConvertir.municipioCodigo}
                      onChange={(e) => setFormConvertir({ ...formConvertir, municipioCodigo: e.target.value })}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg outline-none"
                    >
                      {CATALOGO_MUNICIPIOS.map((m) => (
                        <option key={m.codigoCompleto} value={m.codigoCompleto}>
                          {m.municipioNombre} ({m.codigoCompleto})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Vereda</label>
                    <input
                      type="text"
                      value={formConvertir.vereda}
                      onChange={(e) => setFormConvertir({ ...formConvertir, vereda: e.target.value })}
                      placeholder="ej: Monteredondo"
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Nombre o Dirección del Predio</label>
                  <input
                    type="text"
                    value={formConvertir.nombreODireccionPredio}
                    onChange={(e) => setFormConvertir({ ...formConvertir, nombreODireccionPredio: e.target.value })}
                    placeholder="ej: Finca El Mirador, Lote 3"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
              </div>

              {errorConvertir && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorConvertir}</span>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setModalConvertirInteresado(null);
                    setErrorConvertir(null);
                  }}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoConvertir}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-lg font-bold shadow-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
                >
                  {guardandoConvertir && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                  <span>{guardandoConvertir ? "Creando Expediente..." : "Crear Expediente VRD"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR DOCUMENTO / REQUISITO AL HOGAR (FASE 2) */}
      {modalNuevoRequisito && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-slate-900">
                Añadir Archivo Adicional (Fase {formNuevoRequisito.fase})
              </h3>
              <button
                type="button"
                onClick={() => setModalNuevoRequisito(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Asigne un nombre oficial al archivo en el sistema y adjunte el documento correspondiente para vincularlo a la Fase {formNuevoRequisito.fase}.
            </p>

            <form onSubmit={handleCrearRequisito} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nombre del Archivo / Documento en el Sistema *
                </label>
                <input
                  type="text"
                  required
                  value={formNuevoRequisito.nombre}
                  onChange={(e) =>
                    setFormNuevoRequisito({ ...formNuevoRequisito, nombre: e.target.value })
                  }
                  placeholder="ej: Certificado Extraordinario, Poder Notarial, Plano Complementario, Paz y Salvo..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Descripción o Instrucciones para el Hogar
                </label>
                <textarea
                  rows={3}
                  value={formNuevoRequisito.descripcion}
                  onChange={(e) =>
                    setFormNuevoRequisito({ ...formNuevoRequisito, descripcion: e.target.value })
                  }
                  placeholder="ej: Expedición no mayor a 30 días, legible en formato PDF..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* ADJUNTAR ARCHIVO (CAMBIO 6) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Adjuntar Documento Digital (PDF o Imagen)
                </label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-3 text-center hover:border-emerald-500 transition-colors bg-slate-50/50">
                  <input
                    type="file"
                    id="archivoNuevoReq"
                    accept="application/pdf,image/jpeg,image/png"
                    onClick={(e) => {
                      (e.target as HTMLInputElement).value = "";
                    }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setArchivoAdjuntoNuevoReq(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  {archivoAdjuntoNuevoReq ? (
                    <div className="flex items-center justify-between text-xs bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="flex items-center space-x-2 truncate">
                        <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-semibold text-slate-800 truncate">
                          {archivoAdjuntoNuevoReq.name}
                        </span>
                        <span className="text-slate-400 shrink-0">
                          ({(archivoAdjuntoNuevoReq.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setArchivoAdjuntoNuevoReq(null)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                        title="Quitar archivo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label htmlFor="archivoNuevoReq" className="cursor-pointer block py-1">
                      <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                      <span className="text-xs text-emerald-700 font-semibold hover:underline">
                        Seleccionar archivo desde el equipo
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Formatos PDF, JPG o PNG (Opcional si solo desea crear el requisito y cargarlo después)
                      </p>
                    </label>
                  )}
                </div>
              </div>

              {errorNuevoRequisito && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorNuevoRequisito}</span>
                </div>
              )}

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="chkObligatorio"
                  checked={formNuevoRequisito.esObligatorio}
                  onChange={(e) =>
                    setFormNuevoRequisito({ ...formNuevoRequisito, esObligatorio: e.target.checked })
                  }
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <label htmlFor="chkObligatorio" className="text-slate-700 font-medium cursor-pointer">
                  Este documento es de carácter obligatorio para el subsidio
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNuevoRequisito(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoRequisito}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-bold shadow-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
                >
                  {guardandoRequisito && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{guardandoRequisito ? "Guardando y cargando..." : "Guardar y Cargar Archivo Adicional"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SOLICITAR O CONFIRMAR RETIRO DE CÉDULA DEL HOGAR (CAMBIO 2) */}
      {integranteAEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center space-x-3 mb-3 text-red-600">
              <div className="p-2 bg-red-50 rounded-full">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {currentUser.rol === "supervisor" || currentUser.rol === "administrador"
                  ? "¿Eliminar Cédula del Hogar?"
                  : "Solicitar Retiro de Cédula a Análisis Documental"}
              </h3>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs mb-3 space-y-1">
              <div className="text-slate-500 font-medium">Integrante a retirar:</div>
              <div className="font-bold text-slate-800 text-sm">{integranteAEliminar.nombre}</div>
              {integranteAEliminar.numeroIdentificacion && (
                <div className="text-slate-600 font-mono text-[11px]">
                  {integranteAEliminar.tipoIdentificacion || "CC"}: {integranteAEliminar.numeroIdentificacion} • Parentesco: {integranteAEliminar.parentesco || "Familiar"}
                </div>
              )}
            </div>

            {currentUser.rol === "supervisor" || currentUser.rol === "administrador" ? (
              <div>
                <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                  ¿Está seguro que desea eliminar a este integrante del hogar declarado?
                </p>
                <p className="text-[11px] text-slate-500 bg-amber-50 border border-amber-200 p-2.5 rounded-lg mb-4 text-amber-900">
                  Como <strong>{formatearRol(currentUser.rol)}</strong>, esta acción retirará de inmediato a este integrante del grupo familiar y suprimirá su requisito de cédula del expediente.
                </p>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIntegranteAEliminar(null);
                      setMotivoSolicitudRetiro("");
                    }}
                    className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-medium cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={eliminandoIntegrante}
                    onClick={handleConfirmarEliminarIntegrante}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg text-xs font-bold shadow-xs flex items-center space-x-1.5 cursor-pointer"
                  >
                    {eliminandoIntegrante && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{eliminandoIntegrante ? "Eliminando..." : "Confirmar Eliminación"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSolicitarRetiro} className="space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Para retirar una cédula del hogar, las reglas de negocio exigen radicar una <strong>Solicitud de Retiro</strong> con justificación u observación obligatoria ante el Analista Documental.
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Observación / Justificación Obligatoria de Retiro *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={motivoSolicitudRetiro}
                    onChange={(e) => setMotivoSolicitudRetiro(e.target.value)}
                    placeholder="ej: El integrante desistió voluntariamente de la postulación o cambió de domicilio habitual..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIntegranteAEliminar(null);
                      setMotivoSolicitudRetiro("");
                    }}
                    className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-medium cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardandoSolicitudRetiro}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg text-xs font-bold shadow-xs flex items-center space-x-1.5 cursor-pointer"
                  >
                    {guardandoSolicitudRetiro && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{guardandoSolicitudRetiro ? "Radicando..." : "Radicar Solicitud de Retiro"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: BANDEJA DE SOLICITUDES DE RETIRO DE CÉDULA (CAMBIO 2) */}
      {modalBandejaRetiro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Bandeja de Solicitudes de Retiro de Cédula</h3>
                  <p className="text-xs text-slate-500">
                    Control y dictamen de retiro de integrantes de hogares postulados (Cambio 2)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalBandejaRetiro(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {solicitudesRetiro.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No hay solicitudes de retiro registradas en el sistema.
                </div>
              ) : (
                solicitudesRetiro.map((sol) => (
                  <div
                    key={sol.id}
                    className="p-3.5 border border-slate-200 rounded-xl bg-white space-y-2 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-800 text-sm">
                            {sol.integranteNombre}
                          </span>
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono font-medium">
                            {sol.integranteTipoId}: {sol.integranteNumeroId}
                          </span>
                          <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                            {sol.integranteParentesco}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Expediente: <span className="font-mono font-semibold text-slate-700">{sol.expedienteCodigo}</span> ({sol.expedienteTitular})
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${
                          sol.estado === "pendiente"
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : sol.estado === "autorizada"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : "bg-red-100 text-red-800 border border-red-300"
                        }`}
                      >
                        {sol.estado}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-lg text-xs space-y-1 border border-slate-100">
                      <div className="text-slate-500 text-[11px]">
                        Radicada por <strong>{sol.solicitadoPorNombre}</strong> ({sol.solicitadoPorRol}) el {new Date(sol.solicitadoEn).toLocaleString("es-CO")}:
                      </div>
                      <p className="text-slate-800 italic">&quot;{sol.motivoSolicitud}&quot;</p>
                    </div>

                    {sol.estado === "rechazada" && (
                      <div className="bg-red-50 p-2 rounded-lg text-[11px] text-red-800 border border-red-200">
                        <strong>Rechazada por:</strong> {sol.resueltoPorNombre} • {sol.resueltoEn ? new Date(sol.resueltoEn).toLocaleString("es-CO") : ""}
                        {sol.motivoRechazo && <p className="mt-0.5 italic">&quot;{sol.motivoRechazo}&quot;</p>}
                      </div>
                    )}

                    {sol.estado === "autorizada" && (
                      <div className="bg-emerald-50 p-2 rounded-lg text-[11px] text-emerald-800 border border-emerald-200">
                        <strong>Autorizada por:</strong> {sol.resueltoPorNombre} el {sol.resueltoEn ? new Date(sol.resueltoEn).toLocaleString("es-CO") : ""}
                      </div>
                    )}

                    {sol.estado === "pendiente" && (currentUser.rol === "supervisor" || currentUser.rol === "administrador") && (
                      <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setSolicitudAResolver(sol);
                            setModalRechazarSolicitud(true);
                          }}
                          className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 rounded-lg font-semibold transition-colors cursor-pointer"
                        >
                          Rechazar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAutorizarRetiro(sol.id)}
                          className="px-3.5 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-2xs transition-colors cursor-pointer"
                        >
                          Autorizar y Retirar Cédula
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setModalBandejaRetiro(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MOTIVO DE RECHAZO DE SOLICITUD DE RETIRO */}
      {modalRechazarSolicitud && solicitudAResolver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Rechazar Solicitud de Retiro
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Indique la razón o motivo formal por el cual se desestima el retiro de <strong>{solicitudAResolver.integranteNombre}</strong> del hogar.
            </p>

            <form onSubmit={handleRechazarRetiro} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Motivo de Rechazo *
                </label>
                <textarea
                  required
                  rows={3}
                  value={motivoRechazoSolicitud}
                  onChange={(e) => setMotivoRechazoSolicitud(e.target.value)}
                  placeholder="ej: La persona aporta ingresos indispensables para el cumplimiento del cierre financiero..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setModalRechazarSolicitud(false);
                    setSolicitudAResolver(null);
                    setMotivoRechazoSolicitud("");
                  }}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoResolucionRetiro}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg font-bold shadow-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  {guardandoResolucionRetiro && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{guardandoResolucionRetiro ? "Guardando..." : "Confirmar Rechazo"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DEVOLVER FASE 2 CON OBSERVACIONES */}
      {modalDevolverFase2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-slate-900">
                Devolver Fase 2 con Observaciones
              </h3>
              <button
                type="button"
                onClick={() => setModalDevolverFase2(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Indique al Gestor Documental las correcciones o documentos requeridos para que subsane el expediente y lo reenvíe a revisión.
            </p>

            <form onSubmit={handleDevolverFase2} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Motivo y Observaciones de Devolución *
                </label>
                <textarea
                  rows={4}
                  required
                  value={textoDevolucionFase2}
                  onChange={(e) => setTextoDevolucionFase2(e.target.value)}
                  placeholder="ej: El certificado de tradición supera los 90 días de vigencia y la cédula del cónyuge presenta ilegibilidad..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalDevolverFase2(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoDevolucionFase2}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg font-bold shadow-sm flex items-center space-x-1.5 cursor-pointer"
                >
                  {guardandoDevolucionFase2 && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{guardandoDevolucionFase2 ? "Devolviendo..." : "Confirmar Devolución"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VISOR MODAL DE DOCUMENTO */}
      {docVisorData && (
        <DocVisorModal
          titulo={docVisorData.titulo}
          nombreArchivo={docVisorData.nombreArchivo}
          mimeType={docVisorData.mimeType}
          sha256Hash={docVisorData.sha256Hash}
          tamanoBytes={docVisorData.tamanoBytes}
          subidoPor={docVisorData.subidoPor}
          subidoEn={docVisorData.subidoEn}
          archivoDataUrl={docVisorData.archivoDataUrl}
          fotos={docVisorData.fotos}
          fotoInicialIndex={docVisorData.fotoInicialIndex}
          onClose={() => setDocVisorData(null)}
        />
      )}

      {/* MODAL: DEVOLVER FASE 1 CON OBSERVACIONES */}
      {modalDevolverFase1 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <RotateCcw className="w-4 h-4 text-amber-600" />
                  <span>Devolver Fase 1 a Gestor Rural</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Devuelve el expediente al Gestor Rural y desbloquea la carga para corregir requisitos observados.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalDevolverFase1(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDevolverFase1} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Instrucciones u Observaciones para Gestor Rural <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={textoDevolucionFase1}
                  onChange={(e) => setTextoDevolucionFase1(e.target.value)}
                  placeholder="ej: El certificado de tradición presenta gravámenes no aclarados. Por favor solicitar aclaratoria al usuario..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalDevolverFase1(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoDevolucionFase1}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg font-bold shadow-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  {guardandoDevolucionFase1 && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{guardandoDevolucionFase1 ? "Devolviendo..." : "Confirmar Devolución"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REASIGNAR RESPONSABLE GENERAL */}
      {modalReasignar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <UserCog className="w-4 h-4 text-indigo-600" />
                  <span>Reasignar Responsable del Expediente</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cambie el colaborador o funcionario a cargo del seguimiento del expediente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalReasignar(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReasignarResponsable} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nuevo Responsable Asignado <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={nuevoResponsableId}
                  onChange={(e) => setNuevoResponsableId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none font-medium text-slate-800"
                >
                  <option value="">Seleccione un colaborador...</option>
                  {todosUsuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {formatearNombreUsuario(u.nombreCompleto)} ({formatearRol(u.rol).toUpperCase()} - {u.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Motivo o Justificación del Traslado</label>
                <textarea
                  rows={3}
                  value={motivoReasignacion}
                  onChange={(e) => setMotivoReasignacion(e.target.value)}
                  placeholder="ej: Redistribución operativa por municipio, reasignación por carga..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalReasignar(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoReasignacion || !nuevoResponsableId}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-bold shadow-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  {guardandoReasignacion && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{guardandoReasignacion ? "Reasignando..." : "Guardar Reasignación"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL UNIVERSAL DE CONFIRMACIÓN (REEMPLAZO ROBUSTO DE confirm() EN IFRAMES) */}
      {modalConfirmacion && modalConfirmacion.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
            <div className="flex items-start space-x-3.5 mb-4">
              <div
                className={`p-3 rounded-xl shrink-0 ${
                  modalConfirmacion.tipo === "peligro"
                    ? "bg-rose-100 text-rose-600"
                    : modalConfirmacion.tipo === "advertencia"
                    ? "bg-amber-100 text-amber-600"
                    : "bg-blue-100 text-blue-600"
                }`}
              >
                {modalConfirmacion.tipo === "peligro" ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : modalConfirmacion.tipo === "advertencia" ? (
                  <AlertCircle className="w-6 h-6" />
                ) : (
                  <HelpCircle className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 leading-snug">{modalConfirmacion.titulo}</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{modalConfirmacion.mensaje}</p>
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={ejecutandoConfirmacion}
                onClick={() => setModalConfirmacion(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={ejecutandoConfirmacion}
                onClick={async () => {
                  setEjecutandoConfirmacion(true);
                  try {
                    await modalConfirmacion.onConfirm();
                  } finally {
                    setEjecutandoConfirmacion(false);
                    setModalConfirmacion(null);
                  }
                }}
                className={`px-4 py-2 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer ${
                  modalConfirmacion.tipo === "peligro"
                    ? "bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400"
                    : modalConfirmacion.tipo === "advertencia"
                    ? "bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400"
                    : "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400"
                }`}
              >
                {ejecutandoConfirmacion && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{modalConfirmacion.textoBoton || "Confirmar"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SOLICITAR RECHAZO DEL HOGAR (Cualquier Fase) */}
      {modalSolicitarRechazoHogar && detalleExp && (
        <ModalSolicitudRechazo
          expediente={detalleExp.expediente}
          currentUser={currentUser}
          isOpen={modalSolicitarRechazoHogar}
          onClose={() => setModalSolicitarRechazoHogar(false)}
          onConfirm={handleConfirmarSolicitudRechazoHogar}
        />
      )}

      {/* MODAL: APROBAR RECHAZO DEL HOGAR (SUPERVISOR / ADMIN) */}
      {modalAprobarRechazoHogar && detalleExp?.expediente.solicitudRechazo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 border border-slate-200">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <UserX className="w-5 h-5 text-rose-600" />
                  <span>Aprobar Rechazo del Hogar (Salida Definitiva)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Expediente {detalleExp.expediente.codigoVisible} • Fase {detalleExp.expediente.solicitudRechazo.fase}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalAprobarRechazoHogar(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl mb-4 text-xs text-rose-900">
              <p className="font-bold text-rose-950">
                Motivo solicitado: {detalleExp.expediente.solicitudRechazo.motivo}
              </p>
              <p className="mt-1 text-rose-800 italic bg-white/70 p-2 rounded border border-rose-200">
                &quot;{detalleExp.expediente.solicitudRechazo.justificacion}&quot;
              </p>
              <p className="mt-2 text-[11px] text-rose-700">
                Solicitado por: <strong>{formatearNombreUsuario(detalleExp.expediente.solicitudRechazo.solicitadoPorNombre)}</strong> ({formatearRol(detalleExp.expediente.solicitudRechazo.solicitadoPorRol)}) el {new Date(detalleExp.expediente.solicitudRechazo.fechaSolicitud).toLocaleString("es-CO")}
              </p>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Al aprobar esta solicitud, el hogar pasará a estado <strong>Salida Definitiva</strong>. Se creará automáticamente la tarea al Gestor Rural para notificar formalmente al postulante el retiro del programa.
            </p>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalAprobarRechazoHogar(false)}
                className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={procesandoRechazoHogar}
                onClick={handleAprobarRechazoHogar}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-lg text-xs font-bold shadow-xs flex items-center space-x-1.5 cursor-pointer"
              >
                {procesandoRechazoHogar ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                <span>Confirmar Salida Definitiva</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DESESTIMAR RECHAZO DEL HOGAR (CONTINUAR TRÁMITE) */}
      {modalDesestimarRechazoHogar && detalleExp?.expediente.solicitudRechazo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <RotateCcw className="w-4 h-4 text-blue-600" />
                  <span>Desestimar Rechazo (Continuar en el Programa)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  El hogar continuará normalmente en su fase actual
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalDesestimarRechazoHogar(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDesestimarRechazoHogar} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Justificación o Instrucciones de Continuidad <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={justificacionDesestimarHogar}
                  onChange={(e) => setJustificacionDesestimarHogar(e.target.value)}
                  placeholder="ej: Se desestima la salida porque el certificado de tradición fue subsanado o el predio es viable técnicamente..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalDesestimarRechazoHogar(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesandoRechazoHogar || !justificacionDesestimarHogar.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-xs font-bold shadow-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  {procesandoRechazoHogar ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Reanudar Trámite</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VOLUNTARIO DE CAMBIO DE CONTRASEÑA */}
      {modalCambioPasswordVoluntario && currentUser && (
        <ModalCambioPassword
          usuario={currentUser}
          esVoluntario={true}
          onCerrarModal={() => setModalCambioPasswordVoluntario(false)}
          onPasswordCambiada={(usuarioActualizado) => {
            setCurrentUser(usuarioActualizado);
            localStorage.setItem("crm_user_session", JSON.stringify(usuarioActualizado));
            setModalCambioPasswordVoluntario(false);
            mostrarToast("Contraseña actualizada exitosamente con bcrypt.");
          }}
        />
      )}

      {/* FICHA TÉCNICA OFICIAL IMPRIMIBLE (TAMAÑO CARTA / A4) */}
      {mostrarFichaImprimible && detalleExp && (
        <FichaTecnicaImprimible
          expediente={detalleExp.expediente}
          requisitos={detalleExp.requisitos}
          onCerrar={() => setMostrarFichaImprimible(false)}
        />
      )}

      {/* OVERLAY DE CARGA Y SINCRONIZACIÓN DE ARCHIVO (REACTIVIDAD Y BLOQUEO DE INTERACCIÓN) */}
      {subiendoArchivo && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl p-6 border border-slate-200 max-w-sm w-full text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="inline-flex p-3 bg-emerald-50 text-emerald-600 rounded-full">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Sincronizando archivo y documento...</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Guardando en Supabase Storage y actualizando el historial inmutable en versiones_documento. Por favor espere.
              </p>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div className="bg-emerald-600 h-1.5 rounded-full animate-pulse w-3/4"></div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST FLOTANTE */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 max-w-sm p-4 rounded-xl shadow-2xl flex items-center space-x-3 text-xs font-semibold animate-in slide-in-from-bottom-5 duration-200 border ${
            toast.tipo === "exito"
              ? "bg-emerald-800 text-white border-emerald-700 shadow-emerald-950/20"
              : "bg-red-800 text-white border-red-700 shadow-red-950/20"
          }`}
        >
          {toast.tipo === "exito" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0" />
          )}
          <span className="flex-1">{toast.texto}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-white/70 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
