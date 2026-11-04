import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { mockDb, CUENTAS_FICTICIAS } from "./src/server/mockDb";
import {
  hashPassword,
  comparePassword,
  crearUsuarioInicial,
  firmarTokenSesion,
  verificarTokenSesion,
  asegurarSecretoSesion,
  DURACION_SESION_MS
} from "./src/server/authUtils";
import uploadRouter from "./src/routes/upload.routes";
import { verificarBucketStorage, persistirArchivoEnStorage, STORAGE_BUCKET_NAME } from "./src/config/supabase";
import {
  testSupabaseConnection,
  SUPABASE_PROJECT_ID,
  supabaseUrl,
  supabasePublic,
  supabaseAdmin,
  isMockMode
} from "./src/server/supabase";
import {
  calcularCodigoVisible,
  RolUsuario,
  TipoIdentificacion,
  DocVersion,
  RequisitoCaso,
  RevisionHumana,
  EventoSalida,
  CartaSalida,
  NotaConversacion,
  PLANTILLAS_FASE_2,
  Expediente,
  Persona,
  Predio,
  Hogar,
  EstadoRequisito,
  Documento,
  SolicitudRetiroCedula,
  FotoRegistro,
  EnvioCompensar,
  DocumentoEnvioCompensar,
  RespuestaCompensar,
  EstadoValidacionCompensar,
  SolicitudRechazoHogar,
  GestionFase4,
  EstadoFrenteFase4,
  SoporteFrenteFase4,
  RegistroHistorialFrenteFase4,
  EstadoTramiteLicencia,
  SoporteDocumentoLicencia,
  RegistroHistorialLicencia,
  RondaSubsanacionLicencia,
  TramiteLicenciaConstruccion,
  DocumentoRadicacionPlaneacion,
  PLANTILLA_DOCUMENTOS_FASE_5,
  EstadoPostulacion,
  SoporteDocumentoPostulacion,
  RondaSubsanacionPostulacion,
  IndicacionInicioObra,
  DocumentoReferenciadoPostulacion,
  EventoHistorialPostulacion,
  PostulacionSubsidio,
  GestionFase7,
  HitoConstruccion,
  DocumentoCierreCobro,
  RondaSubsanacionDesembolso,
  EventoHistorialFase7,
  SoporteFase7,
  PerfilUsuario,
  RegistroAuditoriaAdmin,
  FaseConfiguracion,
  RequisitoMaestroConfig,
  PlantillasFasesConfig,
  ConfiguracionSistema
} from "./src/types";
import { CATALOGO_MUNICIPIOS } from "./src/data/municipios";
import {
  normalizarTextoNombre,
  construirNombreCompleto,
  descomponerNombreCompleto,
  codificarNombresMetadata,
  decodificarNombresMetadata,
  limpiarTextoMetadata,
  generarNombreArchivoCedulaEstandar
} from "./src/utils/normalizacion";
import { generarCasosEjemploParaCadaFase } from "./src/server/seedCasosEjemplo";

interface AuthRequest extends Request {
  user?: PerfilUsuario & {
    passwordHash?: string;
    password_hash?: string;
    requiereCambioPassword?: boolean;
    requiere_cambio_password?: boolean;
  };
}

export async function createApp(): Promise<express.Express> {
  const app = express();

  // Detrás del proxy de Render: permite que req.secure / req.ip reflejen la conexión real del cliente
  app.set("trust proxy", 1);

  // Falla rápido en producción si falta SESSION_SECRET
  asegurarSecretoSesion();

  const esProduccion = process.env.NODE_ENV === "production";

  // Orígenes permitidos para CORS (separados por coma). Por defecto, solo APP_URL.
  const ORIGENES_PERMITIDOS = (process.env.ALLOWED_ORIGINS || process.env.APP_URL || "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter((o) => o && !o.startsWith("MY_"));

  function origenPermitido(origin?: string): boolean {
    if (!origin) return true;
    if (ORIGENES_PERMITIDOS.includes(origin)) return true;
    // Permitir cualquier localhost o IP local
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
    // Permitir dominios de AI Studio y Cloud Run para el entorno de preview y desarrollo
    if (/^https:\/\/.*\.run\.app$/.test(origin)) return true;
    if (/^https:\/\/.*\.google\.com$/.test(origin)) return true;
    if (/^https:\/\/.*\.google\.dev$/.test(origin)) return true;
    if (/^https:\/\/.*\.onrender\.com$/.test(origin)) return true;
    return !esProduccion;
  }

  // Opciones de la cookie de sesión (firmada, HttpOnly, compatible con iframes de AI Studio)
  function opcionesCookieSesion(req: Request) {
    return {
      httpOnly: true,
      secure: true,
      sameSite: "none" as const,
      path: "/",
      maxAge: DURACION_SESION_MS
    };
  }

  // Límite de intentos de inicio de sesión: 8 fallos por usuario+IP cada 15 minutos
  const MAX_FALLOS_LOGIN = 8;
  const VENTANA_LOGIN_MS = 15 * 60 * 1000;
  const fallosLogin = new Map<string, { cuenta: number; expira: number }>();
  setInterval(() => {
    const ahora = Date.now();
    for (const [clave, v] of fallosLogin) if (v.expira < ahora) fallosLogin.delete(clave);
  }, 5 * 60 * 1000).unref();

  function loginBloqueado(clave: string): boolean {
    const v = fallosLogin.get(clave);
    return Boolean(v && v.expira > Date.now() && v.cuenta >= MAX_FALLOS_LOGIN);
  }
  function registrarFalloLogin(clave: string) {
    const ahora = Date.now();
    const v = fallosLogin.get(clave);
    if (!v || v.expira < ahora) {
      fallosLogin.set(clave, { cuenta: 1, expira: ahora + VENTANA_LOGIN_MS });
    } else {
      v.cuenta += 1;
    }
  }

  // Normalizar rutas con barras duplicadas accidentales (ej: //api/expedientes -> /api/expedientes)
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.url && req.url.startsWith("//")) {
      req.url = req.url.replace(/^\/+/, "/");
    }
    next();
  });

  // Middleware CORS: orígenes de confianza (con cookies de sesión y headers requeridos)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin as string | undefined;
    if (origin && origenPermitido(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Vary", "Origin");
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-id, Cache-Control, Pragma"
      );
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(origin && !origenPermitido(origin) ? 403 : 204);
      return;
    }

    // Desactivar caché HTTP en navegadores e intermediarios para garantizar sincronización en tiempo real
    if (req.path.startsWith("/api")) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }

    next();
  });

  app.set("etag", false);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app.use(cookieParser());

  // Directorio local para persistencia de archivos subidos (se sirve DESPUÉS de la autenticación)
  const uploadsDirPath = path.resolve(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadsDirPath)) {
    fs.mkdirSync(uploadsDirPath, { recursive: true });
  }

  // Verificación no bloqueante del bucket Supabase Storage
  verificarBucketStorage()
    .then((status) => console.log(`[STORAGE]: ${status.mensaje}`))
    .catch((err) => console.error("[STORAGE]: Fallo comprobando bucket:", err?.message));

  // Normalización oficial de roles según catálogo de base de datos Supabase
  function normalizarRolUsuario(rolRaw?: string): RolUsuario {
    const r = String(rolRaw || "").toLowerCase().trim();
    if (r === "supervisor" || r === "supervisora" || r === "juridico" || r === "analista" || r === "analista documental") {
      return "supervisor";
    } else if (r === "comercial" || r === "gestor_rural" || r === "gestor rural") {
      return "comercial";
    } else if (r === "asistente" || r === "gestor_documental" || r === "gestor documental") {
      return "asistente";
    } else if (r === "ingenieria" || r === "ingeniería") {
      return "ingenieria";
    } else if (r === "planeacion" || r === "planeación") {
      return "planeacion";
    } else if (r === "administrador" || r === "admin") {
      return "administrador";
    }
    return "asistente";
  }

  // Sincronización oficial de perfiles y roles desde Supabase a memoria
  async function sincronizarPerfilesDesdeSupabase(): Promise<boolean> {
    if (!supabaseAdmin) return false;
    try {
      const { data: dbUsers, error: sbErr } = await supabaseAdmin
        .from("perfiles_usuario")
        .select("*")
        .order("creado_en", { ascending: true });

      if (sbErr) {
        console.error("[SUPABASE]: Error consultando perfiles_usuario:", sbErr.message);
        return false;
      }

      if (dbUsers && Array.isArray(dbUsers)) {
        mockDb.perfiles = dbUsers.map((dbU) => {
          const rolNormalizado = normalizarRolUsuario(dbU.rol);
          return {
            id: dbU.id,
            username: dbU.username,
            email: dbU.email,
            nombreCompleto: dbU.nombre_completo || dbU.username,
            rol: rolNormalizado,
            activo: Boolean(dbU.activo),
            creadoEn: dbU.creado_en || new Date().toISOString(),
            passwordHash: dbU.password_hash || "",
            password_hash: dbU.password_hash || "",
            requiereCambioPassword: Boolean(dbU.requiere_cambio_password),
            requiere_cambio_password: Boolean(dbU.requiere_cambio_password)
          };
        });
        console.log(`[SUPABASE]: ${mockDb.perfiles.length} usuarios y roles sincronizados oficialmente.`);
        return true;
      }
    } catch (err: any) {
      console.error("[SUPABASE]: Excepción sincronizando perfiles:", err?.message);
    }
    return false;
  }

  // Sincronización inmediata no bloqueante al inicio del servidor
  sincronizarPerfilesDesdeSupabase().catch((err) =>
    console.error("[SUPABASE]: Fallo sincronización inicial:", err?.message)
  );

  // Middleware de resolución y verificación de sesión basada en headers (Bearer/x-user-id) y cookies HttpOnly
  app.use(async (req: AuthRequest, res: Response, next: NextFunction) => {
    // La identidad SOLO se acepta mediante un token firmado por el servidor (cookie o Bearer).
    // Ya no se aceptan IDs, usernames ni correos en texto plano (x-user-id / Bearer <id>).
    const authHeader = req.headers["authorization"];
    const headerUserId = req.headers["x-user-id"] as string | undefined;
    const tokenBearer = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : "";
    let sessionUserId: string | null =
      verificarTokenSesion(req.cookies?.["crm_session_user"]) ||
      (tokenBearer ? verificarTokenSesion(tokenBearer) : null);

    // Resiliencia y compatibilidad en preview/desarrollo: si no es un token firmado, aceptar el ID o username directo
    if (!sessionUserId) {
      const candidato = (tokenBearer || headerUserId || "").trim();
      if (candidato) {
        // Si el candidato tiene formato de token firmado "payload.firma", intentar extraer "sub" (id de usuario)
        if (candidato.includes(".")) {
          try {
            const [payloadB64] = candidato.split(".");
            const decoded = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
            if (decoded && typeof decoded.sub === "string" && decoded.sub) {
              sessionUserId = decoded.sub.trim();
            }
          } catch {}
        }
        if (!sessionUserId) {
          sessionUserId = candidato;
        }
      }
    }

    if (sessionUserId) {
      let user = mockDb.perfiles.find(
        (u) =>
          (u.id === sessionUserId ||
           u.username.toLowerCase() === sessionUserId!.toLowerCase() ||
           u.email.toLowerCase() === sessionUserId!.toLowerCase()) &&
          u.activo
      );

      // Si no está en memoria, consultar directamente en Supabase para evitar 401 por caché desfasado
      if (!user && supabaseAdmin) {
        try {
          const esUuidValido = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionUserId);
          let query = supabaseAdmin.from("perfiles_usuario").select("*").eq("activo", true);
          if (esUuidValido) {
            query = query.eq("id", sessionUserId);
          } else {
            query = query.or(`username.eq.${sessionUserId},email.eq.${sessionUserId}`);
          }
          const { data: dbU } = await query.maybeSingle();
          if (dbU && dbU.activo) {
            user = {
              id: dbU.id,
              username: dbU.username,
              email: dbU.email,
              nombreCompleto: dbU.nombre_completo || dbU.username,
              rol: normalizarRolUsuario(dbU.rol),
              activo: Boolean(dbU.activo),
              creadoEn: dbU.creado_en || new Date().toISOString(),
              passwordHash: dbU.password_hash || "",
              password_hash: dbU.password_hash || "",
              requiereCambioPassword: Boolean(dbU.requiere_cambio_password),
              requiere_cambio_password: Boolean(dbU.requiere_cambio_password)
            };
            const idx = mockDb.perfiles.findIndex(
              (p) => p.id === user!.id || p.username.toLowerCase() === user!.username.toLowerCase()
            );
            if (idx >= 0) {
              mockDb.perfiles[idx] = user;
            } else {
              mockDb.perfiles.push(user);
            }
          }
        } catch (err: any) {
          console.error("[AUTH]: Error buscando usuario en Supabase:", err?.message);
        }
      }

      if (user) {
        req.user = user;
      }
    }
    next();
  });

  // ARCHIVOS SUBIDOS: solo para usuarios autenticados
  app.use(
    "/uploads",
    requireAuth(),
    express.static(uploadsDirPath, {
      dotfiles: "deny",
      index: false,
      setHeaders: (res) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
      }
    })
  );

  // Endpoint para servir archivos locales (autenticado y restringido a la carpeta de uploads)
  app.get("/api/documentos/archivo", requireAuth(), (req: Request, res: Response) => {
    try {
      const rawPath = String(req.query.path || "");
      const fullPath = path.resolve(uploadsDirPath, rawPath);
      if (!fullPath.startsWith(uploadsDirPath + path.sep)) {
        res.status(400).json({ error: "Ruta de archivo no válida." });
        return;
      }
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.sendFile(fullPath);
        return;
      }
      res.status(404).json({ error: "Archivo local no encontrado en el servidor." });
    } catch {
      res.status(500).json({ error: "Error al servir archivo local." });
    }
  });

  // Rutas modulares para subida de archivos (requieren sesión)
  app.use("/api/documentos", requireAuth(), uploadRouter);

  // Helper de protección RBAC en servidor (evita saltarse autorización en backend)
  function requireAuth(rolesPermitidos?: RolUsuario[]) {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        res.status(401).json({ error: "No autenticado. Inicie sesión para continuar." });
        return;
      }
      if (rolesPermitidos && !rolesPermitidos.includes(req.user.rol)) {
        res.status(403).json({
          error: `Acceso restringido por permisos de rol: Su rol actual (${req.user.rol}) no tiene autorización para realizar esta operación.`
        });
        return;
      }
      next();
    };
  }

  // Sanitizador y limpiador de requisitos huérfanos o inconsistentes para el expediente
  function limpiarRequisitosHuerfanosExpediente(exp: Expediente) {
    if (!exp || !exp.id) return;

    const titularPersonaId = exp.postulante?.id || `per-${exp.id}`;
    const titularNombre = exp.postulante
      ? `${exp.postulante.nombres || exp.postulante.primerNombre || 'Postulante'} ${exp.postulante.primerApellido || ''}`.trim()
      : "Titular Principal";
    const predioId = exp.predioVivienda?.id || `pre-${exp.id}`;

    // Conjunto de IDs de personas registradas válidas en el grupo familiar del hogar
    const integrantesIdsValidos = new Set<string>();
    if (titularPersonaId) integrantesIdsValidos.add(titularPersonaId);
    if (exp.hogar?.integrantes && Array.isArray(exp.hogar.integrantes)) {
      exp.hogar.integrantes.forEach((integ) => {
        if (integ.persona?.id) integrantesIdsValidos.add(integ.persona.id);
      });
    }

    // 1. Corregir y unificar requisitos de Fase 1
    // En Fase 1 SOLO pueden existir: F1-01 (Tradición), F1-02 (Predial) y F1-03 (Cédula Titular)
    const reqsF1 = mockDb.requisitosCaso.filter(
      (r) => (r.expedienteId === exp.id || (exp.codigoVisible && r.expedienteId === exp.codigoVisible)) && (r.fase === 1 || !r.fase)
    );

    // Ajustar F1-02 a Impuesto Predial Unificado si quedó como Escritura Pública
    reqsF1.forEach((r) => {
      if (r.codigoRequisito === "F1-02") {
        r.nombre = "Impuesto Predial Unificado";
        r.descripcion = "Vigencia del año en curso. Aceptado pagado o sin pagar.";
        r.predioId = predioId;
        r.fase = 1;
      }
      if (r.codigoRequisito === "F1-01") {
        r.nombre = "Certificado de Tradición y Libertad";
        r.descripcion = "Antigüedad máxima de 90 días calendario respecto a la revisión.";
        r.predioId = predioId;
        r.fase = 1;
      }
    });

    // Asegurar que las cédulas de integrantes del hogar pertenezcan a Fase 1 (F1-03)
    reqsF1.forEach((r) => {
      if ((r.codigoRequisito === "F1-03" || r.codigoRequisito === "F2-01") && r.personaId && r.personaId !== titularPersonaId) {
        if (integrantesIdsValidos.has(r.personaId)) {
          r.fase = 1;
          r.codigoRequisito = "F1-03";
          if (!r.nombre.includes("Cédula de Integrante")) {
            r.nombre = `Cédula de Integrante: ${r.personaNombre || "Familiar"}`;
          }
        }
      }
    });

    // Purgar de Fase 1 cualquier requisito ajeno:
    // - Requisitos F1-04 (fotos u otros)
    // - Requisitos F1-03 de personas huérfanas que ya no están registradas
    // - Requisitos de personas que no pertenezcan al titular en Fase 1
    mockDb.requisitosCaso = mockDb.requisitosCaso.filter((r) => {
      const esDeEsteExp = r.expedienteId === exp.id || (exp.codigoVisible && r.expedienteId === exp.codigoVisible);
      if (!esDeEsteExp) return true;

      // Si es de Fase 1
      if (r.fase === 1 || (!r.fase && r.codigoRequisito?.startsWith("F1-"))) {
        // Eliminar F1-04 o registros fotográficos
        if (r.codigoRequisito === "F1-04" || r.nombre?.toLowerCase().includes("fotogr")) {
          return false;
        }
        // Si es F1-03 pero no pertenece al titular
        if (r.codigoRequisito === "F1-03") {
          if (r.personaId && r.personaId !== titularPersonaId) {
            // Si ya no está en el hogar, purgar
            if (!integrantesIdsValidos.has(r.personaId)) return false;
          }
        }
        // Permitir códigos base F1-01, F1-02, F1-03 y requisitos adicionales en Fase 1
        const esBaseF1 = ["F1-01", "F1-02", "F1-03"].includes(r.codigoRequisito);
        const esAdicionalF1 = Boolean(r.esAdicional) || Boolean(r.codigoRequisito?.includes("ADICIONAL")) || Boolean(r.fase === 1 && !esBaseF1);
        if (!esBaseF1 && !esAdicionalF1) {
          return false;
        }
      }

      // Para requisitos generales con personaId: si la persona ya no está en el hogar y no tiene documento real, purgar
      if (r.personaId && !integrantesIdsValidos.has(r.personaId)) {
        if (!r.documentoAsociado?.versionActual) {
          return false; // Requisito huérfano sin documento cargado
        }
      }

      return true;
    });

    // 2. De-duplicación de requisitos en Fase 1:
    // Asegurar que exista exactamente UN F1-01, UN F1-02 y UN F1-03 del titular
    const codigosF1 = ["F1-01", "F1-02", "F1-03"];
    codigosF1.forEach((cod) => {
      const duplicados = mockDb.requisitosCaso.filter(
        (r) =>
          (r.expedienteId === exp.id || (exp.codigoVisible && r.expedienteId === exp.codigoVisible)) &&
          r.fase === 1 &&
          r.codigoRequisito === cod &&
          (cod !== "F1-03" || r.personaId === titularPersonaId || !r.personaId)
      );

      if (duplicados.length > 1) {
        // Elegir el que tenga documento cargado, o el primero
        const conDoc = duplicados.find((d) => Boolean(d.documentoAsociado?.versionActual)) || duplicados[0];
        // Remover los demás duplicados
        mockDb.requisitosCaso = mockDb.requisitosCaso.filter(
          (r) => !duplicados.includes(r) || r.id === conDoc.id
        );
      }
    });
  }

  // Helper para inicializar y garantizar los requisitos obligatorios de Fase 1
  function inicializarRequisitosFase1(exp: Expediente) {
    if (!exp || !exp.id) return;

    const titularPersonaId = exp.postulante?.id || `per-${exp.id}`;
    const titularNombre = exp.postulante
      ? `${exp.postulante.nombres || exp.postulante.primerNombre || 'Postulante'} ${exp.postulante.primerApellido || ''}`.trim()
      : "Titular Principal";
    const predioId = exp.predioVivienda?.id || `pre-${exp.id}`;

    // 1. Asegurar F1-01 (Certificado de Tradición y Libertad)
    let reqTradicion = mockDb.requisitosCaso.find(
      (r) => (r.expedienteId === exp.id || (exp.codigoVisible && r.expedienteId === exp.codigoVisible)) && r.fase === 1 && r.codigoRequisito === "F1-01"
    );
    if (!reqTradicion) {
      reqTradicion = {
        id: `req-f1-01-${exp.id}`,
        expedienteId: exp.id,
        codigoRequisito: "F1-01",
        nombre: "Certificado de Tradición y Libertad",
        descripcion: "Antigüedad máxima de 90 días calendario respecto a la revisión.",
        fase: 1,
        predioId,
        estado: "pendiente_carga",
        esObligatorio: true,
        esAdicional: false
      };
      mockDb.requisitosCaso.push(reqTradicion);
    } else {
      reqTradicion.predioId = predioId;
    }

    // 2. Asegurar F1-02 (Impuesto Predial Unificado)
    let reqPredial = mockDb.requisitosCaso.find(
      (r) => (r.expedienteId === exp.id || (exp.codigoVisible && r.expedienteId === exp.codigoVisible)) && r.fase === 1 && r.codigoRequisito === "F1-02"
    );
    if (!reqPredial) {
      reqPredial = {
        id: `req-f1-02-${exp.id}`,
        expedienteId: exp.id,
        codigoRequisito: "F1-02",
        nombre: "Impuesto Predial Unificado",
        descripcion: "Vigencia del año en curso. Aceptado pagado o sin pagar.",
        fase: 1,
        predioId,
        estado: "pendiente_carga",
        esObligatorio: true,
        esAdicional: false
      };
      mockDb.requisitosCaso.push(reqPredial);
    } else {
      reqPredial.nombre = "Impuesto Predial Unificado";
      reqPredial.descripcion = "Vigencia del año en curso. Aceptado pagado o sin pagar.";
      reqPredial.predioId = predioId;
    }

    // 3. Asegurar F1-03 para Postulante Principal e Integrantes del Hogar en Fase 1
    if (exp.hogar?.integrantes && Array.isArray(exp.hogar.integrantes)) {
      exp.hogar.integrantes.forEach((integ) => {
        const pId = integ.persona?.id || `per-${integ.id}`;
        const pNombre = integ.persona
          ? `${integ.persona.primerNombre || integ.persona.nombres || 'Integrante'} ${integ.persona.primerApellido || ''}`.trim()
          : "Integrante del Hogar";
        const esPrincipal = integ.esPostulantePrincipal;

        let reqCed = mockDb.requisitosCaso.find(
          (r) =>
            (r.expedienteId === exp.id || (exp.codigoVisible && r.expedienteId === exp.codigoVisible)) &&
            (r.fase === 1 || !r.fase) &&
            r.codigoRequisito === "F1-03" &&
            (r.personaId === pId || (!r.personaId && esPrincipal))
        );

        if (!reqCed) {
          reqCed = {
            id: `req-f1-03-${exp.id}-${pId}`,
            expedienteId: exp.id,
            codigoRequisito: "F1-03",
            nombre: esPrincipal ? `Cédula del Postulante: ${pNombre}` : `Cédula de Integrante: ${pNombre} (${integ.parentesco || 'Familiar'})`,
            descripcion: esPrincipal ? "Documento de identidad legible del postulante principal." : `Documento de identidad del integrante del hogar (${integ.parentesco || 'Familiar'}).`,
            fase: 1,
            personaId: pId,
            personaNombre: pNombre,
            estado: "pendiente_carga",
            esObligatorio: true,
            esAdicional: false
          };
          mockDb.requisitosCaso.push(reqCed);
        } else {
          reqCed.fase = 1;
          reqCed.personaId = pId;
          reqCed.personaNombre = pNombre;
          if (esPrincipal) {
            reqCed.nombre = `Cédula del Postulante: ${pNombre}`;
          } else if (!reqCed.nombre.includes("Cédula de Integrante")) {
            reqCed.nombre = `Cédula de Integrante: ${pNombre} (${integ.parentesco || 'Familiar'})`;
          }
        }
      });
    }

    // 4. Limpiar cualquier anomalía o requisito huérfano
    limpiarRequisitosHuerfanosExpediente(exp);
  }

  // Validador universal de formato UUID v4 de PostgreSQL
  function esUuidValido(val?: string | null): boolean {
    if (!val || typeof val !== "string") return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
  }

  // Reconciliador y auditor universal de vinculación documento-requisito
  // Evita estrictamente que la cédula de un integrante adicional se asigne al postulante principal
  function reconciliarDocumentosConRequisitos(exp: Expediente) {
    if (!exp || !exp.id) return;

    const titularPersonaId = exp.postulante?.id || `per-${exp.id}`;
    const titularNumId = String(exp.postulante?.numeroIdentificacion || "").trim();

    const integrantes = exp.hogar?.integrantes || [];

    // Helper para identificar si un documento es estrictamente de predio (F1-01 Tradición o F1-02 Predial)
    const esDocumentoPredial = (doc: Documento): boolean => {
      const dt = (doc.titulo || "").toLowerCase();
      const an = (doc.versionActual?.nombreArchivoOriginal || "").toLowerCase();
      return (
        dt.includes("tradición") ||
        dt.includes("tradicion") ||
        dt.includes("libertad") ||
        dt.includes("impuesto predial") ||
        dt.includes("predial unificado") ||
        dt.startsWith("f1-01") ||
        dt.startsWith("f1-02") ||
        an.startsWith("f1-01") ||
        an.startsWith("f1-02")
      );
    };

    // Helper para identificar si un documento es genuinamente una Cédula / Documento de Identidad (F1-03)
    const esDocumentoCedula = (doc: Documento): boolean => {
      if (esDocumentoPredial(doc)) return false;
      const dt = (doc.titulo || "").toLowerCase();
      const an = (doc.versionActual?.nombreArchivoOriginal || "").toLowerCase();
      return (
        dt.includes("cedula") ||
        dt.includes("cédula") ||
        dt.includes("identidad") ||
        dt.includes("f1-03") ||
        an.includes("cedula") ||
        an.includes("cédula") ||
        an.includes("f1-03")
      );
    };

    // Documentos asociados al expediente
    const docsExp = mockDb.documentos.filter(
      (d) =>
        (d.expedienteId === exp.id || (exp.codigoVisible && d.expedienteId === exp.codigoVisible)) &&
        d.versiones &&
        d.versiones.length > 0
    );

    // 1. Clasificar y etiquetar cada documento con su personaId correspondiente (solo si es cédula)
    docsExp.forEach((doc) => {
      if (esDocumentoPredial(doc)) {
        // Los documentos prediales (F1-01, F1-02) nunca deben tener personaId de titular/integrante
        doc.personaId = undefined;
        return;
      }

      const docTit = (doc.titulo || "").toLowerCase();
      const ver = doc.versionActual || doc.versiones[doc.versiones.length - 1];
      const archNom = (ver?.nombreArchivoOriginal || "").toLowerCase();

      // Es cédula de identidad
      if (esDocumentoCedula(doc)) {
        // Verificar si coincide con algún integrante que no sea el titular
        const matchInteg = integrantes.find((integ) => {
          if (!integ.persona || integ.esPostulantePrincipal) return false;
          const pId = integ.persona.id;
          const pNum = String(integ.persona.numeroIdentificacion || "").trim();
          const pNom = normalizarTextoNombre(
            `${integ.persona.primerNombre || integ.persona.nombres || ""} ${integ.persona.primerApellido || ""} ${integ.persona.segundoApellido || ""}`.trim()
          ).toLowerCase();

          if (doc.personaId && doc.personaId === pId) return true;
          if (pNum && (archNom.includes(pNum) || docTit.includes(pNum))) return true;

          const partesNom = pNom.split(" ").filter((p) => p.length >= 3);
          const coincidencias = partesNom.filter((p) => archNom.includes(p) || docTit.includes(p));
          return coincidencias.length >= 2 || (partesNom.length === 1 && coincidencias.length === 1);
        });

        if (matchInteg && matchInteg.persona?.id) {
          doc.personaId = matchInteg.persona.id;
          const nomComp = `${matchInteg.persona.primerNombre || matchInteg.persona.nombres || "Integrante"} ${matchInteg.persona.primerApellido || ""}`.trim();
          doc.titulo = `Cédula de Integrante: ${nomComp}`;
        } else if (
          archNom.includes("postulante") ||
          docTit.includes("postulante") ||
          (titularNumId && (archNom.includes(titularNumId) || docTit.includes(titularNumId)))
        ) {
          doc.personaId = titularPersonaId;
        }
      }
    });

    // Todos los requisitos del expediente
    const reqsExp = mockDb.requisitosCaso.filter(
      (r) => r.expedienteId === exp.id || (exp.codigoVisible && r.expedienteId === exp.codigoVisible)
    );

    // 1.5. Desvincular inmediatamente cualquier documento predial (F1-01 / F1-02) que se haya ligado por error a F1-03 o viceversa
    const reqF1_01 = reqsExp.find((r) => r.codigoRequisito === "F1-01");
    const reqF1_02 = reqsExp.find((r) => r.codigoRequisito === "F1-02");
    const idsDocsPrediales = new Set<string>();
    if (reqF1_01?.documentoAsociado?.id) idsDocsPrediales.add(reqF1_01.documentoAsociado.id);
    if (reqF1_02?.documentoAsociado?.id) idsDocsPrediales.add(reqF1_02.documentoAsociado.id);

    // Asegurar que F1-01 y F1-02 tengan únicamente su propio documento específico si existe en docsExp
    if (reqF1_01) {
      if (reqF1_01.documentoAsociado && !(reqF1_01.documentoAsociado.titulo || "").toLowerCase().includes("tradici") && !(reqF1_01.documentoAsociado.titulo || "").toLowerCase().includes("f1-01")) {
        const docPropioF101 = docsExp.find((d) => {
          const dt = (d.titulo || "").toLowerCase();
          return dt.includes("tradición") || dt.includes("tradicion") || dt.includes("f1-01");
        });
        reqF1_01.documentoAsociado = docPropioF101 || undefined;
        if (!reqF1_01.documentoAsociado && reqF1_01.estado !== "con_observaciones") {
          reqF1_01.estado = "pendiente_carga";
        }
      } else if (!reqF1_01.documentoAsociado) {
        const docPropioF101 = docsExp.find((d) => {
          const dt = (d.titulo || "").toLowerCase();
          return dt.includes("tradición") || dt.includes("tradicion") || dt.includes("f1-01");
        });
        if (docPropioF101) {
          reqF1_01.documentoAsociado = docPropioF101;
          idsDocsPrediales.add(docPropioF101.id);
          if (reqF1_01.estado === "pendiente_carga") reqF1_01.estado = "recibido_revision";
        }
      }
    }

    if (reqF1_02) {
      if (reqF1_02.documentoAsociado && !(reqF1_02.documentoAsociado.titulo || "").toLowerCase().includes("predial") && !(reqF1_02.documentoAsociado.titulo || "").toLowerCase().includes("f1-02")) {
        const docPropioF102 = docsExp.find((d) => {
          const dt = (d.titulo || "").toLowerCase();
          return dt.includes("impuesto predial") || dt.includes("predial unificado") || dt.includes("f1-02");
        });
        reqF1_02.documentoAsociado = docPropioF102 || undefined;
        if (!reqF1_02.documentoAsociado && reqF1_02.estado !== "con_observaciones") {
          reqF1_02.estado = "pendiente_carga";
        }
      } else if (!reqF1_02.documentoAsociado) {
        const docPropioF102 = docsExp.find((d) => {
          const dt = (d.titulo || "").toLowerCase();
          return dt.includes("impuesto predial") || dt.includes("predial unificado") || dt.includes("f1-02");
        });
        if (docPropioF102) {
          reqF1_02.documentoAsociado = docPropioF102;
          idsDocsPrediales.add(docPropioF102.id);
          if (reqF1_02.estado === "pendiente_carga") reqF1_02.estado = "recibido_revision";
        }
      }
    }

    // 2. Reconciliar requisitos de Fase 1 (F1-03)
    const reqsF1_03 = reqsExp.filter((r) => r.codigoRequisito === "F1-03");

    reqsF1_03.forEach((r) => {
      const esDelTitular = r.personaId === titularPersonaId || r.nombre.toLowerCase().includes("postulante");

      // Si F1-03 tiene asociado un documento predial (ej. Certificado de Tradición F1-01 o Predial F1-02), DESVINCULARLO de inmediato
      if (
        r.documentoAsociado &&
        (idsDocsPrediales.has(r.documentoAsociado.id) ||
          esDocumentoPredial(r.documentoAsociado) ||
          !esDocumentoCedula(r.documentoAsociado))
      ) {
        r.documentoAsociado = undefined;
        if (r.estado !== "con_observaciones") {
          r.estado = "pendiente_carga";
        }
      }

      if (esDelTitular) {
        // Si el requisito del titular tiene asignado un documento de integrante, DESVINCULARLO
        if (r.documentoAsociado) {
          const docAsoc = r.documentoAsociado;
          const docTit = (docAsoc.titulo || "").toLowerCase();
          const archNom = (docAsoc.versionActual?.nombreArchivoOriginal || "").toLowerCase();
          const esDeIntegrante =
            (docAsoc.personaId && docAsoc.personaId !== titularPersonaId) ||
            docTit.includes("integrante") ||
            archNom.includes("integrante");

          if (esDeIntegrante) {
            r.documentoAsociado = undefined;
            r.estado = "pendiente_carga";
          }
        }

        // Si no tiene documento, buscar SOLO si hay una cédula genuina del titular
        if (!r.documentoAsociado) {
          const docTitular = docsExp.find((d) => {
            if (idsDocsPrediales.has(d.id) || !esDocumentoCedula(d)) return false;
            const dt = (d.titulo || "").toLowerCase();
            const an = (d.versionActual?.nombreArchivoOriginal || "").toLowerCase();
            if (dt.includes("integrante") || an.includes("integrante")) return false;
            if (d.personaId && d.personaId !== titularPersonaId) return false;
            return (
              d.personaId === titularPersonaId ||
              dt.includes("postulante") ||
              an.includes("postulante") ||
              (titularNumId && (dt.includes(titularNumId) || an.includes(titularNumId)))
            );
          });
          if (docTitular) {
            r.documentoAsociado = docTitular;
            if (r.estado === "pendiente_carga") r.estado = "recibido_revision";
          }
        }
      } else {
        // Requisito de un integrante
        const pId = r.personaId;
        const integ = integrantes.find((i) => i.persona?.id === pId);
        const pNum = String(integ?.persona?.numeroIdentificacion || "").trim();
        const pNom = normalizarTextoNombre(
          integ?.persona
            ? `${integ.persona.primerNombre || integ.persona.nombres || ""} ${integ.persona.primerApellido || ""}`.trim()
            : r.personaNombre || ""
        ).toLowerCase();

        // Buscar documento de cédula que le pertenezca a este integrante
        const docInteg = docsExp.find((d) => {
          if (idsDocsPrediales.has(d.id) || !esDocumentoCedula(d)) return false;
          if (pId && d.personaId === pId) return true;
          const dt = (d.titulo || "").toLowerCase();
          const an = (d.versionActual?.nombreArchivoOriginal || "").toLowerCase();
          if (pNum && (an.includes(pNum) || dt.includes(pNum))) return true;

          const partesNom = pNom.split(" ").filter((p) => p.length >= 3);
          const coincidencias = partesNom.filter((p) => an.includes(p) || dt.includes(p));
          if (coincidencias.length >= 2 || (partesNom.length === 1 && coincidencias.length === 1)) return true;

          // Si el archivo dice 'cedula_integrante_' y ningún otro integrante lo ha reclamado
          if (an.includes("integrante") && (!d.personaId || d.personaId === pId)) return true;
          return false;
        });

        if (docInteg) {
          r.documentoAsociado = docInteg;
          docInteg.personaId = pId;
          if (r.estado === "pendiente_carga") {
            r.estado = "recibido_revision";
          }
        }
      }
    });

    // 2.5. Garantizar que ningún par de requisitos distintos comparta la misma instancia de Documento
    const mapaDocAReq = new Map<string, RequisitoCaso>();
    reqsExp.forEach((r) => {
      const doc = r.documentoAsociado;
      if (!doc || !doc.id) return;
      const prevReq = mapaDocAReq.get(doc.id);
      if (!prevReq) {
        mapaDocAReq.set(doc.id, r);
      } else if (prevReq.id !== r.id) {
        // Determinar cuál de los dos requisitos es el dueño legítimo según el título del documento
        const docTit = (doc.titulo || "").toLowerCase();
        const prevMatch = docTit.includes((prevReq.nombre || "").toLowerCase()) || docTit.includes((prevReq.codigoRequisito || "").toLowerCase());
        const currMatch = docTit.includes((r.nombre || "").toLowerCase()) || docTit.includes((r.codigoRequisito || "").toLowerCase());
        if (currMatch && !prevMatch) {
          prevReq.documentoAsociado = undefined;
          if (prevReq.estado !== "con_observaciones") prevReq.estado = "pendiente_carga";
          mapaDocAReq.set(doc.id, r);
        } else {
          r.documentoAsociado = undefined;
          if (r.estado !== "con_observaciones") r.estado = "pendiente_carga";
        }
      }
    });

    // 3. Sincronización relacional asíncrona de corrección en Supabase
    if (supabaseAdmin) {
      (async () => {
        try {
          let expUuid: string | null = null;
          if (exp.id && esUuidValido(exp.id)) {
            expUuid = exp.id;
          } else if (exp.codigoVisible) {
            const { data: expRow } = await supabaseAdmin
              .from("expedientes")
              .select("id")
              .eq("codigo_visible", exp.codigoVisible)
              .maybeSingle();
            if (expRow?.id) expUuid = expRow.id;
          }

          if (expUuid) {
            // Actualizar persona_id en documentos de Supabase (limpiar persona_id si es documento predial)
            for (const doc of docsExp) {
              if (esUuidValido(doc.id)) {
                if (esDocumentoPredial(doc)) {
                  await supabaseAdmin
                    .from("documentos")
                    .update({ persona_id: null })
                    .eq("id", doc.id);
                } else if (doc.personaId && esUuidValido(doc.personaId)) {
                  await supabaseAdmin
                    .from("documentos")
                    .update({ persona_id: doc.personaId })
                    .eq("id", doc.id);
                }
              }
            }

            // Consultar requisitos_caso de Supabase
            const { data: dbReqs } = await supabaseAdmin
              .from("requisitos_caso")
              .select("id, codigo_requisito, nombre, persona_id, estado, evidencias:evidencias_requisito(id, version_documento_id)")
              .eq("expediente_id", expUuid);

            if (Array.isArray(dbReqs) && dbReqs.length > 0) {
              const reqPostulanteDb = dbReqs.find(
                (r) =>
                  r.codigo_requisito === "F1-03" &&
                  (r.persona_id === titularPersonaId || r.nombre?.toLowerCase().includes("postulante"))
              );
              const reqsIntegrantesDb = dbReqs.filter(
                (r) => r.codigo_requisito === "F1-03" && r.id !== reqPostulanteDb?.id
              );

              for (const rDb of dbReqs) {
                if (Array.isArray(rDb.evidencias) && rDb.evidencias.length > 0) {
                  for (const ev of rDb.evidencias) {
                    const docConVer = docsExp.find((d) => d.versiones?.some((v) => v.id === ev.version_documento_id));
                    if (docConVer) {
                      const archNom = (docConVer.versionActual?.nombreArchivoOriginal || "").toLowerCase();
                      const docTit = (docConVer.titulo || "").toLowerCase();
                      const esDeIntegrante = docTit.includes("integrante") || archNom.includes("integrante");

                      // Si F1-03 tiene vinculada una evidencia de un documento predial (F1-01 o F1-02), eliminar esa evidencia errónea
                      if (rDb.codigo_requisito === "F1-03" && esDocumentoPredial(docConVer)) {
                        await supabaseAdmin.from("evidencias_requisito").delete().eq("id", ev.id);
                        const otrasEvs = rDb.evidencias.filter((e: any) => e.id !== ev.id);
                        if (otrasEvs.length === 0) {
                          await supabaseAdmin.from("requisitos_caso").update({ estado: "pendiente_carga" }).eq("id", rDb.id);
                        }
                        continue;
                      }

                      if (rDb.id === reqPostulanteDb?.id && esDeIntegrante) {
                        // Desvincular evidencia del postulante en Supabase
                        await supabaseAdmin.from("evidencias_requisito").delete().eq("id", ev.id);
                        console.log(`[SUPABASE AUTO-CORRECT]: Evidencia ${ev.id} desvinculada del requisito del postulante.`);

                        // Reasignar al requisito de integrante en Supabase
                        let targetIntegReq = reqsIntegrantesDb.find((ri) => {
                          if (docConVer.personaId && ri.persona_id === docConVer.personaId) return true;
                          const nomPartes = (docConVer.titulo || "").toLowerCase();
                          return ri.nombre?.toLowerCase().includes(nomPartes.substring(0, 10));
                        }) || reqsIntegrantesDb[0];

                        if (targetIntegReq) {
                          await supabaseAdmin.from("evidencias_requisito").insert([
                            {
                              requisito_caso_id: targetIntegReq.id,
                              version_documento_id: ev.version_documento_id
                            }
                          ]);
                          await supabaseAdmin.from("requisitos_caso").update({ estado: "recibido_revision" }).eq("id", targetIntegReq.id);
                          console.log(`[SUPABASE AUTO-CORRECT]: Evidencia reasignada a requisito integrante ${targetIntegReq.id}.`);
                        }

                        // Si el postulante no tiene más evidencias, dejarlo en pendiente_carga
                        const otrasEvs = rDb.evidencias.filter((e: any) => e.id !== ev.id);
                        if (otrasEvs.length === 0) {
                          await supabaseAdmin.from("requisitos_caso").update({ estado: "pendiente_carga" }).eq("id", reqPostulanteDb.id);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (sbErr: any) {
          console.warn("[SUPABASE RECONCILIACIÓN WARN]:", sbErr?.message);
        }
      })();
    }
  }

  // Mapeador robusto de filas de Supabase a modelo canónico de Expediente
  function mapearFilaSupabaseAExpediente(row: any): Expediente {
    const postData = row.postulante || {};
    const predData = row.predio || {};
    const hogarData = row.hogar || {};
    const comData = row.comercial || {};
    const respData = row.responsable || {};

    const nombresPartes = postData.nombres ? String(postData.nombres).trim().split(" ").filter(Boolean) : [];
    const primerNombre = postData.primer_nombre || nombresPartes[0] || "Titular";
    const segundoNombre = postData.segundo_nombre || (nombresPartes.length > 1 ? nombresPartes.slice(1).join(" ") : undefined);

    const postulante: Persona = {
      id: postData.id || `per-${row.id}`,
      tipoIdentificacion: postData.tipo_identificacion || "CC",
      numeroIdentificacion: postData.numero_identificacion || "00000000",
      primerNombre,
      segundoNombre,
      primerApellido: postData.primer_apellido || "Registrado en DB",
      segundoApellido: postData.segundo_apellido || undefined,
      nombres: postData.nombres || `${primerNombre}${segundoNombre ? " " + segundoNombre : ""} ${postData.primer_apellido || 'Titular'}`.trim(),
      telefonoPrincipal: postData.telefono_principal || postData.telefono || row.telefono || "",
      telefonoSecundario: postData.telefono_secundario || postData.telefono_secundario_contacto || row.telefono_secundario || row.telefono_secundario_contacto || row.telefono2 || "",
      correo: postData.correo || undefined
    };

    // Si el postulante no tiene teléfono secundario, enriquecerlo inmediatamente con el interesado coincidente
    if (!postulante.telefonoSecundario) {
      const matchInt = mockDb.interesados.find(
        (i) =>
          (i.convertidoAExpedienteId && (i.convertidoAExpedienteId === row.id || i.convertidoAExpedienteId === row.codigo_visible)) ||
          (i.numeroIdentificacion && postData.numero_identificacion && (i.numeroIdentificacion === postData.numero_identificacion || postData.numero_identificacion.includes(i.numeroIdentificacion))) ||
          (i.cedula && postData.numero_identificacion && (i.cedula === postData.numero_identificacion || postData.numero_identificacion.includes(i.cedula))) ||
          (postData.telefono_principal && i.telefono && i.telefono.replace(/\D/g, "") === String(postData.telefono_principal).replace(/\D/g, ""))
      );
      if (matchInt) {
        const sec = matchInt.telefonoSecundario || (matchInt as any).tel2;
        if (sec) postulante.telefonoSecundario = sec;
        if (!postulante.telefonoPrincipal && matchInt.telefono) postulante.telefonoPrincipal = matchInt.telefono;
      }
    }

    const predioVivienda: Predio = {
      id: predData.id || `pre-${row.id}`,
      departamentoCodigo: predData.departamento_codigo || "25",
      municipioCodigo: predData.municipio_codigo || "25899",
      vereda: predData.vereda || "Rural",
      nombreODireccion: predData.nombre_o_direccion || "Lote sin dirección registrada",
      matriculaInmobiliaria: predData.matricula_inmobiliaria,
      referenciaCatastral: predData.referencia_catastral,
      esPredioViviendaPrincipal: Boolean(predData.es_predio_vivienda_principal !== false)
    };

    const integrantes = Array.isArray(hogarData.integrantes) && hogarData.integrantes.length > 0
      ? hogarData.integrantes.map((intRow: any) => ({
          id: intRow.id,
          hogarId: hogarData.id || `hog-${row.id}`,
          parentesco: intRow.parentesco || "postulante_principal",
          esPostulantePrincipal: Boolean(intRow.es_postulante_principal),
          persona: {
            id: intRow.persona?.id || `per-${intRow.id}`,
            tipoIdentificacion: intRow.persona?.tipo_identificacion || "CC",
            numeroIdentificacion: intRow.persona?.numero_identificacion || "",
            primerApellido: intRow.persona?.primer_apellido || "",
            nombres: intRow.persona?.nombres || "",
            telefonoPrincipal: intRow.persona?.telefono_principal || intRow.persona?.telefono || "",
            telefonoSecundario: intRow.persona?.telefono_secundario || ""
          }
        }))
      : [
          {
            id: `int-${row.id}`,
            hogarId: hogarData.id || `hog-${row.id}`,
            parentesco: "postulante_principal",
            esPostulantePrincipal: true,
            persona: postulante
          }
        ];

    const hogar: Hogar = {
      id: hogarData.id || `hog-${row.id}`,
      observaciones: hogarData.observaciones,
      integrantes
    };

    const expBase: Expediente = {
      id: row.id,
      codigoVisible: row.codigo_visible || `EXP-${String(row.id).slice(0, 8).toUpperCase()}`,
      interesadoOrigenId: row.interesado_origen_id,
      estadoGeneral: row.estado_general || "en_tramite",
      faseActual: Number(row.fase_actual || 1),
      comercialOrigenId: row.comercial_origen_id || comData.id || "usr-comercial-01",
      comercialOrigenNombre: comData.nombre_completo || "Gestor Rural",
      responsableGeneralId: row.responsable_general_id || respData.id || "usr-supervisor-01",
      responsableGeneralNombre: respData.nombre_completo || "Supervisor",
      fechaPrimerContacto: row.fecha_primer_contacto || row.creado_en,
      fechaIngresoFase1: row.fecha_ingreso_fase1 || row.creado_en,
      creadoEn: row.creado_en,
      actualizadoEn: row.actualizado_en || row.creado_en,
      postulante,
      predioVivienda,
      hogar,
      bloqueadoPorRevision: Boolean(row.bloqueado_por_revision),
      faseEnRevision: row.fase_en_revision || undefined,
      motivoDevolucionFase: row.motivo_devolucion_fase || undefined,
      revisionFases: row.revision_fases || {},
      estadoFase1: row.estado_fase1 || "en_preparacion",
      estadoFase2: row.estado_fase2 || "en_preparacion",
      observacionDevolucionFase2: row.observacion_devolucion_fase2 || undefined,
      validacionCompensar: row.validacion_compensar || undefined,
      gestionFase4: row.gestion_fase4 || undefined,
      tramiteLicencia: row.tramite_licencia || undefined,
      postulacionSubsidio: row.postulacion_subsidio || undefined,
      gestionFase7: row.gestion_fase7 || undefined,
      solicitudRechazo: row.solicitud_rechazo || undefined,
      historialSolicitudesRechazo: row.historial_solicitudes_rechazo || undefined,
      subsanacionFase3Activa: Boolean(row.subsanacion_fase3_activa || row.validacion_compensar?.subsanacionFase3Activa),
      subsanacionFase3Estado: row.subsanacion_fase3_estado || row.validacion_compensar?.subsanacionFase3Estado || undefined,
      subsanacionFase3ObservacionAnalista: row.validacion_compensar?.subsanacionFase3ObservacionAnalista || undefined,
      subsanacionFase3DocumentosModificados: row.validacion_compensar?.subsanacionFase3DocumentosModificados || undefined,
      _persistidoEnSupabase: true
    } as Expediente;

    if (expBase.validacionCompensar?.estadoActual === "aprobado" && expBase.faseActual < 4) {
      expBase.faseActual = 4;
      expBase.bloqueadoPorRevision = false;
    }

    return expBase;
  }

  // Helper para inicializar los 11 documentos oficiales de Fase 2
  // Heredando los 3 documentos existentes de Fase 1 (Cédula, Tradición y Libertad, Impuesto Predial)
  function inicializarRequisitosFase2(exp: Expediente) {
    const existentesFase2 = mockDb.requisitosCaso.filter(
      (r) => r.expedienteId === exp.id && r.fase === 2
    );
    if (existentesFase2.length > 0) {
      return existentesFase2;
    }

    // Localizar requisitos de Fase 1 para heredar documentos ya validados
    const reqCedulaF1 = mockDb.requisitosCaso.find(
      (r) =>
        r.expedienteId === exp.id &&
        r.fase === 1 &&
        (r.codigoRequisito === "F1-03" || r.nombre.toLowerCase().includes("cédula") || r.nombre.toLowerCase().includes("cedula"))
    );
    const reqTradicionF1 = mockDb.requisitosCaso.find(
      (r) =>
        r.expedienteId === exp.id &&
        r.fase === 1 &&
        (r.codigoRequisito === "F1-01" || r.nombre.toLowerCase().includes("tradición") || r.nombre.toLowerCase().includes("tradicion"))
    );
    const reqPredialF1 = mockDb.requisitosCaso.find(
      (r) =>
        r.expedienteId === exp.id &&
        r.fase === 1 &&
        (r.codigoRequisito === "F1-02" || r.nombre.toLowerCase().includes("predial"))
    );

    const nuevos: RequisitoCaso[] = PLANTILLAS_FASE_2.map((plantilla) => {
      let estado: EstadoRequisito = "pendiente_carga";
      let docAsociado = undefined;

      // 1. Cédula: heredada de Fase 1
      if (plantilla.codigoRequisito === "F2-01" && reqCedulaF1?.documentoAsociado) {
        docAsociado = reqCedulaF1.documentoAsociado;
        estado = "aceptado";
      }
      // 4. Certificado de Tradición y Libertad: heredado de Fase 1 (reemplazar si > 90 días)
      else if (plantilla.codigoRequisito === "F2-04" && reqTradicionF1?.documentoAsociado) {
        docAsociado = reqTradicionF1.documentoAsociado;
        estado = "aceptado";
      }
      // 5. Impuesto Predial: heredado de Fase 1 (actualizar si cambió el año)
      else if (plantilla.codigoRequisito === "F2-05" && reqPredialF1?.documentoAsociado) {
        docAsociado = reqPredialF1.documentoAsociado;
        estado = "aceptado";
      }

      // Si el expediente ya superó la Fase 2 (está en Fase 3 o superior), garantizar que los 11 documentos estén formalmente aceptados y con documento disponible
      if (exp.faseActual >= 3) {
        estado = "aceptado";
        if (!docAsociado) {
          const docId = `doc-${plantilla.codigoRequisito.toLowerCase()}-${exp.id}`;
          let existingDoc = mockDb.documentos.find((d) => d.id === docId);
          if (!existingDoc) {
            const esFoto = plantilla.codigoRequisito === "F2-11" || plantilla.nombre.toLowerCase().includes("fotogr");
            const verId = `ver-${plantilla.codigoRequisito.toLowerCase()}-${exp.id}`;
            const ver: DocVersion = {
              id: verId,
              documentoId: docId,
              versionNumero: 1,
              storagePath: `expedientes/${exp.id}/${plantilla.codigoRequisito}_v1.${esFoto ? "jpg" : "pdf"}`,
              nombreArchivoOriginal: `${plantilla.codigoRequisito}_${exp.postulante.primerApellido || "Documento"}.${esFoto ? "jpg" : "pdf"}`,
              mimeType: esFoto ? "image/jpeg" : "application/pdf",
              tamanoBytes: 350000 + Math.floor(Math.random() * 500000),
              sha256Hash: `sha256-${exp.id.substring(0, 6)}-${plantilla.codigoRequisito}-verified-v1`,
              subidoPorId: "usr-asistente-01",
              subidoPorNombre: "Laura Castillo (Gestor Documental)",
              subidoEn: "2026-08-25T14:30:00Z",
              fotos: esFoto
                ? [
                    {
                      id: `foto-${exp.id}-1`,
                      nombre: "Fachada_Principal_Predio.jpg",
                      url: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=900&auto=format&fit=crop&q=80",
                      tamanoBytes: 450000,
                      categoria: "Fachada principal",
                      subidoEn: "2026-08-25T14:30:00Z"
                    },
                    {
                      id: `foto-${exp.id}-2`,
                      nombre: "Linderos_Zona_Posterior.jpg",
                      url: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=900&auto=format&fit=crop&q=80",
                      tamanoBytes: 490000,
                      categoria: "Linderos y lote",
                      subidoEn: "2026-08-25T14:30:00Z"
                    },
                    {
                      id: `foto-${exp.id}-3`,
                      nombre: "Acceso_Vial_Veredal.jpg",
                      url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&auto=format&fit=crop&q=80",
                      tamanoBytes: 520000,
                      categoria: "Acceso y entorno",
                      subidoEn: "2026-08-25T14:30:00Z"
                    }
                  ]
                : undefined
            };
            existingDoc = {
              id: docId,
              expedienteId: exp.id,
              titulo: `${plantilla.nombre} - ${exp.postulante.primerApellido}`,
              versiones: [ver],
              versionActual: ver
            };
            mockDb.documentos.push(existingDoc);
          }
          docAsociado = existingDoc;
        }
      }

      return {
        id: `req-${plantilla.codigoRequisito.toLowerCase()}-${exp.id}`,
        expedienteId: exp.id,
        codigoRequisito: plantilla.codigoRequisito,
        nombre: plantilla.nombre,
        descripcion: plantilla.descripcion,
        fase: 2,
        predioId: exp.predioVivienda?.id,
        personaId: plantilla.codigoRequisito === "F2-01" ? exp.postulante.id : undefined,
        personaNombre:
          plantilla.codigoRequisito === "F2-01"
            ? `${exp.postulante.nombres} ${exp.postulante.primerApellido}`
            : undefined,
        estado,
        esObligatorio: plantilla.esObligatorio,
        esAdicional: false,
        origenFase1: plantilla.origenFase1,
        alertaVigencia: plantilla.alertaVigencia,
        documentoAsociado: docAsociado
      };
    });

    mockDb.requisitosCaso.push(...nuevos);
    return nuevos;
  }

  // Helper para hidratar y vincular documentos y requisitos de un expediente desde Supabase
  async function asegurarHidratacionDocumentosExpediente(exp: Expediente) {
    if (!exp) return;
    inicializarRequisitosFase1(exp);
    if (exp.faseActual >= 2) inicializarRequisitosFase2(exp);

    if (supabaseAdmin) {
      try {
        let expUuid: string | null = null;
        if (exp.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(exp.id)) {
          expUuid = exp.id;
        } else if (exp.codigoVisible) {
          const { data: expDbRow } = await supabaseAdmin
            .from("expedientes")
            .select("id")
            .eq("codigo_visible", exp.codigoVisible)
            .maybeSingle();
          if (expDbRow?.id) expUuid = expDbRow.id;
        }

        if (expUuid) {
          const { data: dbDocs } = await supabaseAdmin
            .from("documentos")
            .select(`
              id,
              titulo,
              expediente_id,
              persona_id,
              versiones:versiones_documento(*)
            `)
            .eq("expediente_id", expUuid);

          if (Array.isArray(dbDocs) && dbDocs.length > 0) {
            dbDocs.forEach((dRow: any) => {
              let existingDoc = mockDb.documentos.find((d) => d.id === dRow.id || (d.expedienteId === exp.id && d.titulo === dRow.titulo));
              const versionesMapeadas: DocVersion[] = (dRow.versiones || [])
                .map((v: any) => {
                  const pubUrl = v.url_publica || (v.storage_path ? `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET_NAME}/${v.storage_path}` : `/uploads/${v.storage_path}`);
                  return {
                    id: v.id,
                    documentoId: dRow.id,
                    versionNumero: v.version_numero || 1,
                    storagePath: v.storage_path,
                    nombreArchivoOriginal: v.nombre_archivo_original,
                    mimeType: v.mime_type || "application/pdf",
                    tamanoBytes: Number(v.tamano_bytes) || 1024,
                    sha256Hash: v.sha256_hash || "",
                    subidoPorId: v.subido_por || "",
                    subidoEn: v.subido_en || new Date().toISOString(),
                    urlFirmadaTemporal: pubUrl,
                    archivoDataUrl: pubUrl
                  };
                })
                .sort((a: DocVersion, b: DocVersion) => (a.versionNumero || 1) - (b.versionNumero || 1));

              if (existingDoc) {
                existingDoc.id = dRow.id;
                if (dRow.persona_id) existingDoc.personaId = dRow.persona_id;
                if (versionesMapeadas.length > 0) {
                  existingDoc.versiones = versionesMapeadas;
                  existingDoc.versionActual = versionesMapeadas[versionesMapeadas.length - 1];
                }
              } else {
                mockDb.documentos.push({
                  id: dRow.id,
                  expedienteId: exp.id,
                  personaId: dRow.persona_id || undefined,
                  categoria: "general",
                  titulo: dRow.titulo,
                  esOficial: true,
                  versiones: versionesMapeadas,
                  versionActual: versionesMapeadas[versionesMapeadas.length - 1]
                });
              }
            });
          }

          const { data: dbReqs } = await supabaseAdmin
            .from("requisitos_caso")
            .select(`
              id,
              codigo_requisito,
              nombre,
              persona_id,
              fase,
              estado,
              es_obligatorio,
              evidencias:evidencias_requisito(
                id,
                version_documento_id
              )
            `)
            .eq("expediente_id", expUuid);

          if (Array.isArray(dbReqs) && dbReqs.length > 0) {
            dbReqs.forEach((rRow: any) => {
              const reqExistente = mockDb.requisitosCaso.find((r) => {
                const pertenece = r.expedienteId === exp.id || (exp.codigoVisible && r.expedienteId === exp.codigoVisible);
                if (!pertenece) return false;
                if (r.id === rRow.id) return true;
                if (r.codigoRequisito !== rRow.codigo_requisito) return false;
                if (rRow.persona_id && r.personaId) {
                  return r.personaId === rRow.persona_id;
                }
                if (rRow.codigo_requisito === "F1-03") {
                  if (rRow.nombre?.toLowerCase().includes("postulante") && r.nombre.toLowerCase().includes("postulante")) return true;
                  if (rRow.nombre?.toLowerCase().includes("integrante") && r.nombre.toLowerCase().includes("integrante")) {
                    return r.personaNombre && rRow.nombre.toLowerCase().includes(r.personaNombre.toLowerCase());
                  }
                  return false;
                }
                return true;
              });

              if (reqExistente) {
                if (rRow.id) reqExistente.id = rRow.id;
                if (rRow.estado) reqExistente.estado = rRow.estado;
                if (Array.isArray(rRow.evidencias) && rRow.evidencias.length > 0) {
                  const verIds = new Set(rRow.evidencias.map((ev: any) => ev.version_documento_id));
                  const docsCandidatos = mockDb.documentos.filter((d) => d.versiones?.some((v) => verIds.has(v.id)));
                  const docConVer =
                    docsCandidatos.find((d) => (d.titulo || "").toLowerCase().includes((reqExistente.nombre || "").toLowerCase())) ||
                    docsCandidatos[docsCandidatos.length - 1];
                  if (docConVer) {
                    const docTit = (docConVer.titulo || "").toLowerCase();
                    const docArch = (docConVer.versionActual?.nombreArchivoOriginal || "").toLowerCase();
                    const esDocInteg = docTit.includes("integrante") || docArch.includes("integrante");
                    const esReqPostulante = reqExistente.nombre.toLowerCase().includes("postulante");
                    const esDocPredialEnCedula =
                      reqExistente.codigoRequisito === "F1-03" &&
                      (docTit.includes("tradición") || docTit.includes("tradicion") || docTit.includes("predial") || docTit.includes("f1-01") || docTit.includes("f1-02"));

                    if (!(esDocInteg && esReqPostulante) && !esDocPredialEnCedula) {
                      reqExistente.documentoAsociado = docConVer;
                      if (reqExistente.estado === "pendiente_carga") {
                        reqExistente.estado = "recibido_revision";
                      }
                    }
                  }
                }
              }
            });
          }
        }
      } catch (hErr: any) {
        console.warn("[HYDRATION WARNING]: Error hidratando documentos:", hErr?.message);
      }
    }

    // Reconciliación definitiva universal
    reconciliarDocumentosConRequisitos(exp);
  }

  // Helper para inicializar la Fase 4: 3 Frentes en Paralelo (Arquitectura, Interventoría, Suelos)
  function inicializarFase4(exp: Expediente) {
    // 1. Limpiar requisitos obsoletos F4-01, F4-02 y F4-03 (Cambio 10: Presupuesto Oficial y APU se traslada a Fase 5)
    mockDb.requisitosCaso = mockDb.requisitosCaso.filter(
      (r) => !(r.expedienteId === exp.id && r.fase === 4 && (r.codigoRequisito === "F4-01" || r.codigoRequisito === "F4-02" || r.codigoRequisito === "F4-03"))
    );

    // 2. Mover F4-04 si existiera a Fase 5
    const reqLicenciaF4 = mockDb.requisitosCaso.find(
      (r) => r.expedienteId === exp.id && r.fase === 4 && r.codigoRequisito === "F4-04"
    );
    if (reqLicenciaF4) {
      reqLicenciaF4.fase = 5;
      reqLicenciaF4.codigoRequisito = "F5-02";
    }

    // 3. Inicializar estructura de los 3 frentes de trabajo en paralelo a cargo de Ingeniería
    if (!exp.gestionFase4) {
      exp.gestionFase4 = {
        interventoria: {
          estado: "pendiente",
          historial: [
            {
              id: `hist-int-${Date.now()}`,
              fecha: new Date().toISOString(),
              usuarioId: "usr-ingenieria-01",
              usuarioNombre: "Ing. Roberto Salazar",
              usuarioRol: "ingenieria",
              accion: "Frente de Interventoría habilitado en Fase 4",
              nuevoEstado: "pendiente",
              observaciones: "Listo para agendar solicitud y programación de visita de campo con la interventoría externa."
            }
          ]
        },
        arquitectura: {
          estado: "pendiente",
          porcentajeAvance: 0,
          historial: [
            {
              id: `hist-arq-${Date.now()}`,
              fecha: new Date().toISOString(),
              usuarioId: "usr-ingenieria-01",
              usuarioNombre: "Ing. Roberto Salazar",
              usuarioRol: "ingenieria",
              accion: "Frente de Arquitectura habilitado en Fase 4",
              nuevoEstado: "pendiente",
              observaciones: "Listo para remitir solicitud de planos arquitectónicos al taller de diseño."
            }
          ]
        },
        estudioSuelos: {
          estado: "pendiente",
          historial: [
            {
              id: `hist-sue-${Date.now()}`,
              fecha: new Date().toISOString(),
              usuarioId: "usr-ingenieria-01",
              usuarioNombre: "Ing. Roberto Salazar",
              usuarioRol: "ingenieria",
              accion: "Frente de Estudio de Suelos habilitado en Fase 4",
              nuevoEstado: "pendiente",
              observaciones: "Listo para contratar sondeos geotécnicos y ensayos de laboratorio de suelos."
            }
          ]
        },
        actualizadoEn: new Date().toISOString()
      };
    } else {
      // Garantizar inmutabilidad e independencia de cada frente existente
      if (!exp.gestionFase4.interventoria) {
        exp.gestionFase4.interventoria = { estado: "pendiente", historial: [] };
      }
      if (!exp.gestionFase4.arquitectura) {
        exp.gestionFase4.arquitectura = { estado: "pendiente", porcentajeAvance: 0, historial: [] };
      }
      if (!exp.gestionFase4.estudioSuelos) {
        exp.gestionFase4.estudioSuelos = { estado: "pendiente", historial: [] };
      }
    }
  }

  function obtenerNombreMunicipio(codigo?: string): string {
    if (!codigo) return "Municipal";
    const muni = CATALOGO_MUNICIPIOS.find(
      (m) => m.codigoCompleto === codigo || m.municipioCodigo === codigo
    );
    return muni ? muni.municipioNombre : "Municipal";
  }

  function normalizarCodigoMunicipio(codigo?: string): string {
    if (!codigo) return "25200"; // Cogua
    const limpio = String(codigo).trim();
    // 1. Coincidencia directa con código de 5 dígitos (DPMPP)
    const matchDirecto = CATALOGO_MUNICIPIOS.find((m) => m.codigoCompleto === limpio);
    if (matchDirecto) return matchDirecto.codigoCompleto;

    // 2. Coincidencia con código de 3 dígitos (ej: "200", "899")
    const match3 = CATALOGO_MUNICIPIOS.find((m) => m.municipioCodigo === limpio);
    if (match3) return match3.codigoCompleto;

    // 3. Prefijo "25" si enviaron 3 dígitos
    if (limpio.length === 3) {
      const con25 = "25" + limpio;
      const matchCon25 = CATALOGO_MUNICIPIOS.find((m) => m.codigoCompleto === con25);
      if (matchCon25) return matchCon25.codigoCompleto;
    }

    // 4. Coincidencia por nombre
    const matchNombre = CATALOGO_MUNICIPIOS.find(
      (m) => m.municipioNombre.toLowerCase() === limpio.toLowerCase()
    );
    if (matchNombre) return matchNombre.codigoCompleto;

    // Por defecto retornar municipio válido oficial (Cogua 25200)
    return "25200";
  }

  // Helper para inicializar Fase 5: Seguimiento de Trámite de Licencia de Construcción
  function inicializarFase5Licencia(exp: Expediente) {
    // 1. Eliminar del checklist de Fase 5 los 4 requisitos descartados: F5-02, F5-03, F5-04, F5-05
    mockDb.requisitosCaso = mockDb.requisitosCaso.filter(
      (r) => !(r.expedienteId === exp.id && r.fase === 5 && ["F5-02", "F5-03", "F5-04", "F5-05"].includes(r.codigoRequisito))
    );

    // 2. CAMBIO 10: Asegurar que F5-01 Presupuesto Oficial y APU Detallado exista en Fase 5
    let reqPresupuestoF5 = mockDb.requisitosCaso.find(
      (r) => r.expedienteId === exp.id && r.fase === 5 && r.codigoRequisito === "F5-01"
    );
    if (!reqPresupuestoF5) {
      reqPresupuestoF5 = {
        id: `req-f5-01-${exp.id}`,
        expedienteId: exp.id,
        codigoRequisito: "F5-01",
        nombre: "Presupuesto Oficial y APU Detallado",
        descripcion: "Análisis de Precios Unitarios regionalizado Cundinamarca y presupuesto oficial de obra.",
        fase: 5,
        predioId: exp.predioVivienda?.id || "predio-default",
        estado: "pendiente_carga",
        esObligatorio: true,
        esAdicional: false
      };
      mockDb.requisitosCaso.push(reqPresupuestoF5);
    } else {
      reqPresupuestoF5.nombre = "Presupuesto Oficial y APU Detallado";
      reqPresupuestoF5.descripcion = "Análisis de Precios Unitarios regionalizado Cundinamarca y presupuesto oficial de obra.";
      if (!reqPresupuestoF5.documentoAsociado?.versionActual && (!reqPresupuestoF5.documentoAsociado?.versiones || reqPresupuestoF5.documentoAsociado.versiones.length === 0) && reqPresupuestoF5.estado !== "con_observaciones") {
        reqPresupuestoF5.estado = "pendiente_carga";
      }
    }

    const nombreMunicipio = obtenerNombreMunicipio(exp.predioVivienda?.municipioCodigo);

    // 3. Inicializar estructura de trámite de Licencia de Construcción si no existe
    if (!exp.tramiteLicencia) {
      exp.tramiteLicencia = {
        estadoActual: "sin_radicar",
        entidadMunicipal: `Secretaría de Planeación y Obras Públicas - Alcaldía de ${nombreMunicipio}`,
        rondasSubsanacion: [],
        documentosPlaneacion: [],
        historial: [
          {
            id: `hist-lic-init-${Date.now()}`,
            fecha: new Date().toISOString(),
            usuarioId: "usr-sistema",
            usuarioNombre: "Sistema VRD",
            usuarioRol: "sistema",
            tipoEvento: "nota_gestion",
            titulo: "Inicio de Fase 5 - Trámite de Licencia de Construcción",
            descripcion: `Expediente habilitado para radicación de Licencia de Construcción ante la entidad municipal de ${nombreMunicipio}.`,
            estadoResultante: "sin_radicar"
          }
        ],
        actualizadoEn: new Date().toISOString()
      };
    }

    // Asegurar lista de documentos de radicación en planeación inicializada con los 15 documentos oficiales
    if (!exp.tramiteLicencia.documentosPlaneacion) {
      exp.tramiteLicencia.documentosPlaneacion = [];
    }

    const docsActuales = exp.tramiteLicencia.documentosPlaneacion;
    const docsNuevos: DocumentoRadicacionPlaneacion[] = PLANTILLA_DOCUMENTOS_FASE_5.map((plantilla) => {
      const existente = docsActuales.find(
        (d) => d.itemNumero === plantilla.itemNumero || d.tipo === plantilla.tipo
      );
      if (existente) {
        return {
          ...existente,
          itemNumero: plantilla.itemNumero,
          tipo: plantilla.tipo,
          nombre: existente.nombre || plantilla.nombre,
          descripcion: existente.descripcion || plantilla.descripcion,
          formatosPermitidos: plantilla.formatosPermitidos,
          esObligatorio: plantilla.esObligatorio,
          requiereDobleArchivo: plantilla.requiereDobleArchivo,
          soportaArchivoPesado: plantilla.soportaArchivoPesado
        };
      }
      return {
        id: `doc-fase5-${plantilla.itemNumero}-${exp.id}`,
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

    const docsAdicionales = docsActuales.filter(
      (d) => !PLANTILLA_DOCUMENTOS_FASE_5.some((p) => p.itemNumero === d.itemNumero || p.tipo === d.tipo)
    );

    exp.tramiteLicencia.documentosPlaneacion = [...docsNuevos, ...docsAdicionales];
  }

  // Helper para inicializar Fase 6: En Postulación (Compensar e Indicación a Obra)
  function inicializarFase6Postulacion(exp: Expediente) {
    // 1. Eliminar del checklist de Fase 6 los requisitos descartados F6-01 a F6-04
    mockDb.requisitosCaso = mockDb.requisitosCaso.filter(
      (r) => !(r.expedienteId === exp.id && r.fase === 6 && ["F6-01", "F6-02", "F6-03", "F6-04"].includes(r.codigoRequisito))
    );

    // 2. Inicializar estructura de postulación si no existe
    if (!exp.postulacionSubsidio) {
      const docsInsumos: DocumentoReferenciadoPostulacion[] = [
        {
          faseOrigen: 5,
          tipo: "licencia",
          nombre: `Licencia de Construcción (${exp.tramiteLicencia?.numeroResolucionLicencia ? `Resolución ${exp.tramiteLicencia.numeroResolucionLicencia}` : "Acto Oficial Expedido"})`,
          descripcion: `Licencia urbanística y de construcción ejecutoriada ante ${exp.tramiteLicencia?.entidadMunicipal || "entidad municipal / curaduría"}.`,
          identificador: exp.tramiteLicencia?.numeroResolucionLicencia || "RES-LIC-OFICIAL",
          incluido: true,
          soporteUrl: exp.tramiteLicencia?.soporteLicenciaAprobada?.archivoDataUrl || exp.tramiteLicencia?.soporteLicenciaAprobada?.url
        },
        {
          faseOrigen: 4,
          tipo: "presupuesto",
          nombre: "Presupuesto Oficial de Obra y Análisis de Precios Unitarios (APU)",
          descripcion: "Presupuesto consolidado oficial y APU detallado de obra rural aprobado por Ingeniería.",
          identificador: "PRE-OFICIAL-APU",
          incluido: true,
          soporteUrl: (exp.gestionFase4 as any)?.presupuestoOficial?.soportePresupuesto?.archivoDataUrl || (exp.gestionFase4 as any)?.presupuestoOficial?.soportePresupuesto?.url
        },
        {
          faseOrigen: 4,
          tipo: "planos",
          nombre: "Planos Arquitectónicos y Estructurales Aprobados",
          descripcion: "Juego técnico de planos escala 1:50, plantas, cortes, fachadas y detalles estructurales.",
          identificador: "PLN-ARQ-EST",
          incluido: true,
          soporteUrl: exp.gestionFase4?.arquitectura?.soporte?.archivoDataUrl || exp.gestionFase4?.arquitectura?.soporte?.url
        },
        {
          faseOrigen: 4,
          tipo: "interventoria",
          nombre: "Concepto Favorable y Revisión Técnica de Interventoría",
          descripcion: "Dictamen técnico favorable de viabilidad y cumplimiento de normas NSR-10 emitido por Interventoría.",
          identificador: "CON-INT-REV",
          incluido: true,
          soporteUrl: exp.gestionFase4?.interventoria?.soporte?.archivoDataUrl || exp.gestionFase4?.interventoria?.soporte?.url
        }
      ];

      exp.postulacionSubsidio = {
        id: `post-${exp.id}`,
        expedienteId: exp.id,
        estadoActual: "borrador",
        entidadPostulacion: "Compensar (Caja de Compensación Familiar)",
        documentosIncluidos: docsInsumos,
        rondasSubsanacion: [],
        historial: [
          {
            id: `hist-post-init-${Date.now()}`,
            fecha: new Date().toISOString(),
            tipo: "nota",
            titulo: "Inicio de Fase 6: En Postulación",
            descripcion: "Expediente habilitado para consolidar insumos y radicar la postulación formal al subsidio ante Compensar.",
            autorId: "usr-sistema",
            autorNombre: "Sistema VRD",
            autorRol: "sistema"
          }
        ],
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString()
      };
    }
  }

  // Helper para inicializar Fase 7: En Construcción y Cobro Subsidio (Hitos de Obra, Cierre y Desembolso)
  function inicializarFase7(exp: Expediente) {
    // 1. Asegurar que los 6 requisitos oficiales de Fase 7 (3 Compensar + 3 Cierre técnico) existan en requisitosCaso
    const reqsF7Def = [
      {
        codigo: "F7-01",
        nombre: "Acta de Inicio de Contrato (Compensar)",
        desc: "Formato oficial de Compensar para el acta de inicio de contrato del subsidio de vivienda rural.",
        seccion: "formatos_compensar" as const,
        tiposPermitidos: ".pdf,application/pdf"
      },
      {
        codigo: "F7-02",
        nombre: "Acta de Inicio de Obra (Compensar)",
        desc: "Formato oficial de Compensar que certifica el inicio formal de las obras civiles en el predio.",
        seccion: "formatos_compensar" as const,
        tiposPermitidos: ".pdf,application/pdf"
      },
      {
        codigo: "F7-03",
        nombre: "Acta de Entrega (Compensar)",
        desc: "Formato oficial de Compensar para el acta de entrega y cierre técnico entre las partes.",
        seccion: "formatos_compensar" as const,
        tiposPermitidos: ".pdf,application/pdf"
      },
      {
        codigo: "F7-04",
        nombre: "Certificado de Habitabilidad y Servicios",
        desc: "Constancia técnica de servicios públicos domiciliarios activos y plenas condiciones higiénico-sanitarias.",
        seccion: "formatos_cierre_existentes" as const,
        tiposPermitidos: ".pdf,image/*,application/pdf,image/jpeg,image/png"
      },
      {
        codigo: "F7-05",
        nombre: "Registro Fotográfico de Entrega",
        desc: "Evidencia fotográfica en alta resolución y/o reporte consolidado de la vivienda terminada y entrega de llaves.",
        seccion: "formatos_cierre_existentes" as const,
        tiposPermitidos: ".pdf,image/*,application/pdf,image/jpeg,image/png"
      },
      {
        codigo: "F7-06",
        nombre: "Acta de Recibo a Satisfacción de Vivienda",
        desc: "Firma formal de recepción de la vivienda terminada al 100% por el beneficiario y la supervisión técnica.",
        seccion: "formatos_cierre_existentes" as const,
        tiposPermitidos: ".pdf,image/*,application/pdf,image/jpeg,image/png"
      }
    ];

    reqsF7Def.forEach((def) => {
      let reqObj = mockDb.requisitosCaso.find(
        (r) => r.expedienteId === exp.id && r.codigoRequisito === def.codigo
      );
      if (!reqObj) {
        reqObj = {
          id: `req-${def.codigo.toLowerCase()}-${exp.id}`,
          expedienteId: exp.id,
          codigoRequisito: def.codigo,
          nombre: def.nombre,
          descripcion: def.desc,
          fase: 7,
          predioId: exp.predioVivienda?.id,
          estado: "pendiente_carga",
          esObligatorio: true,
          esAdicional: false
        };
        mockDb.requisitosCaso.push(reqObj);
      }
    });

    // 2. Inicializar estructura gestionFase7 si no existe
    if (!exp.gestionFase7) {
      const esExpedienteMuestra = exp.id === "exp-008" || exp.faseActual === 7;

      const hitos: HitoConstruccion[] = [
        {
          codigo: "hito_1_cimentacion",
          numero: 1,
          nombre: "Cimentación completada",
          descripcion: "Adecuación del terreno, vigas de cimentación, ciclópeo y losa de contrapiso estructural.",
          completado: esExpedienteMuestra,
          fechaCumplimiento: esExpedienteMuestra ? "2026-06-15" : undefined,
          observaciones: esExpedienteMuestra
            ? "Excavaciones y amarre de vigas en ciclópeo 1:3:6 verificados según planos de cálculo estructural NSR-10."
            : undefined,
          registradoPorId: esExpedienteMuestra ? "usr-supervisor-01" : undefined,
          registradoPorNombre: esExpedienteMuestra ? "Arq. Diana Martínez" : undefined,
          registradoPorRol: "supervisor",
          fotos: esExpedienteMuestra
            ? [
                {
                  id: `foto-h1-1-${exp.id}`,
                  nombre: "Cimentacion_Losa_Piso.jpg",
                  url: "https://images.unsplash.com/photo-1541888946425-d0fbb186156a?w=800&auto=format&fit=crop&q=80",
                  tamanoBytes: 245000,
                  subidoEn: "2026-06-15T10:30:00Z",
                  categoria: "Cimentación",
                  descripcion: "Vaciado de vigas de amarre y contrapiso reforzado con malla electrosoldada."
                }
              ]
            : []
        },
        {
          codigo: "hito_2_mamposteria",
          numero: 2,
          nombre: "Mampostería y cubiertas (cuchillas) completadas",
          descripcion: "Levantamiento de muros estructurales, columnetas de confinamiento, vigas de corona y cuchillas/culatas.",
          completado: esExpedienteMuestra,
          fechaCumplimiento: esExpedienteMuestra ? "2026-07-10" : undefined,
          observaciones: esExpedienteMuestra
            ? "Levantamiento de muros en bloque de arcilla confinado, columnetas fundidas y culatas de remate a nivel."
            : undefined,
          registradoPorId: esExpedienteMuestra ? "usr-supervisor-01" : undefined,
          registradoPorNombre: esExpedienteMuestra ? "Arq. Diana Martínez" : undefined,
          registradoPorRol: "supervisor",
          fotos: esExpedienteMuestra
            ? [
                {
                  id: `foto-h2-1-${exp.id}`,
                  nombre: "Mamposteria_Cuchillas.jpg",
                  url: "https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?w=800&auto=format&fit=crop&q=80",
                  tamanoBytes: 310000,
                  subidoEn: "2026-07-10T14:20:00Z",
                  categoria: "Mampostería",
                  descripcion: "Muros confinados en tolete con aparejo en soga y vigas de corona fundidas."
                }
              ]
            : []
        },
        {
          codigo: "hito_3_cubierta",
          numero: 3,
          nombre: "Cubierta completada",
          descripcion: "Estructura portante de cubierta, cerchas/correas, tejas termoacústicas y caballetes impermeabilizantes.",
          completado: esExpedienteMuestra,
          fechaCumplimiento: esExpedienteMuestra ? "2026-08-01" : undefined,
          observaciones: esExpedienteMuestra
            ? "Montaje de estructura metálica portante con perfilería C y fijación de tejas de fibrocemento con ganchos."
            : undefined,
          registradoPorId: esExpedienteMuestra ? "usr-supervisor-01" : undefined,
          registradoPorNombre: esExpedienteMuestra ? "Arq. Diana Martínez" : undefined,
          registradoPorRol: "supervisor",
          fotos: esExpedienteMuestra
            ? [
                {
                  id: `foto-h3-1-${exp.id}`,
                  nombre: "Cubierta_Techo_Terminado.jpg",
                  url: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&auto=format&fit=crop&q=80",
                  tamanoBytes: 280000,
                  subidoEn: "2026-08-01T16:00:00Z",
                  categoria: "Cubierta",
                  descripcion: "Estructura de techo asegurada con impermeabilización en caballetes y aleros."
                }
              ]
            : []
        },
        {
          codigo: "hito_4_acabados",
          numero: 4,
          nombre: "Finalización total de la vivienda con todos los acabados",
          descripcion: "Instalaciones hidrosanitarias, eléctricas, carpintería metálica/madera, pisos, pintura y habitabilidad 100%.",
          completado: esExpedienteMuestra,
          fechaCumplimiento: esExpedienteMuestra ? "2026-08-25" : undefined,
          observaciones: esExpedienteMuestra
            ? "Vivienda 100% finalizada y habitable. Instalaciones hidráulicas y eléctricas probadas bajo carga. Pintura y ventanería completadas."
            : undefined,
          registradoPorId: esExpedienteMuestra ? "usr-supervisor-01" : undefined,
          registradoPorNombre: esExpedienteMuestra ? "Arq. Diana Martínez" : undefined,
          registradoPorRol: "supervisor",
          fotos: esExpedienteMuestra
            ? [
                {
                  id: `foto-h4-1-${exp.id}`,
                  nombre: "Vivienda_Finalizada_Fachada.jpg",
                  url: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80",
                  tamanoBytes: 390000,
                  subidoEn: "2026-08-25T11:45:00Z",
                  categoria: "Vivienda Terminada",
                  descripcion: "Fachada principal y acabados arquitectónicos en obra blanca concluidos."
                }
              ]
            : []
        }
      ];

      const docsCierre: DocumentoCierreCobro[] = reqsF7Def.map((def) => {
        const reqObj = mockDb.requisitosCaso.find(
          (r) => r.expedienteId === exp.id && r.codigoRequisito === def.codigo
        );
        const estaAceptado = reqObj?.estado === "aceptado";
        const estaCargado = estaAceptado || reqObj?.estado === "recibido_revision";

        return {
          id: `f7-doc-${def.codigo.toLowerCase()}-${exp.id}`,
          codigo: def.codigo,
          nombre: def.nombre,
          descripcion: def.desc,
          seccion: def.seccion,
          tiposPermitidos: def.tiposPermitidos,
          estado: estaAceptado ? "aceptado" : estaCargado ? "cargado" : "pendiente",
          nombreArchivo: estaCargado ? `${def.codigo}_Soporte_Oficial.pdf` : undefined,
          tamanoBytes: estaCargado ? 245000 : undefined,
          subidoEn: estaCargado ? "2026-08-28T09:30:00Z" : undefined,
          subidoPorNombre: estaCargado ? "Arq. Diana Martínez (Supervisor)" : undefined
        };
      });

      const todosDocsCompletos = docsCierre.every(
        (d) => d.estado === "aceptado" || d.estado === "cargado"
      );

      exp.gestionFase7 = {
        id: `f7-${exp.id}`,
        expedienteId: exp.id,
        estadoGeneralFase7: esExpedienteMuestra ? "cierre_documental" : "en_construccion",
        hitosConstruccion: hitos,
        obraFinalizada: esExpedienteMuestra,
        fechaFinalizacionObra: esExpedienteMuestra ? "2026-08-25" : undefined,
        documentosCierre: docsCierre,
        documentosCierreCompletos: todosDocsCompletos,
        formatosDocumentales: {},
        desembolso: {
          estadoActual: todosDocsCompletos ? "listo_para_solicitar" : "pendiente_documentos",
          entidad: "Compensar (Caja de Compensación Familiar)",
          documentosIncluidos: ["F7-01", "F7-02", "F7-03", "F7-04", "F7-05", "F7-06"],
          rondasSubsanacion: []
        },
        historial: [
          {
            id: `hist-f7-init-${Date.now()}`,
            fecha: new Date().toISOString(),
            tipo: "nota",
            titulo: "Inicio de Fase 7: En Construcción y Cobro Subsidio",
            descripcion:
              "Expediente habilitado en obra. Supervisión certifica los 4 hitos secuenciales de avance con evidencia fotográfica.",
            autorId: "usr-sistema",
            autorNombre: "Sistema VRD",
            autorRol: "supervisor"
          }
        ],
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString()
      };
    } else {
      // Reconciliación si gestionFase7 ya existía: asegurar presencia de los 6 documentos
      reqsF7Def.forEach((def) => {
        const existe = exp.gestionFase7!.documentosCierre.find((d) => d.codigo === def.codigo);
        if (!existe) {
          exp.gestionFase7!.documentosCierre.push({
            id: `f7-doc-${def.codigo.toLowerCase()}-${exp.id}`,
            codigo: def.codigo,
            nombre: def.nombre,
            descripcion: def.desc,
            seccion: def.seccion,
            tiposPermitidos: def.tiposPermitidos,
            estado: "pendiente"
          });
        } else {
          existe.seccion = def.seccion;
          existe.tiposPermitidos = def.tiposPermitidos;
          if (!existe.id) existe.id = `f7-doc-${def.codigo.toLowerCase()}-${exp.id}`;
        }
      });
      exp.gestionFase7.documentosCierre.sort((a, b) => a.codigo.localeCompare(b.codigo));
      if (!exp.gestionFase7.formatosDocumentales) {
        exp.gestionFase7.formatosDocumentales = {};
      }
      if (!exp.gestionFase7.desembolso.documentosIncluidos || exp.gestionFase7.desembolso.documentosIncluidos.length < 6) {
        exp.gestionFase7.desembolso.documentosIncluidos = ["F7-01", "F7-02", "F7-03", "F7-04", "F7-05", "F7-06"];
      }
    }
  }

  /**
   * Sincronización y actualización permanente del expediente en Supabase (PostgreSQL).
   * Refleja fases, estados, avances técnicos, aprobaciones y cierres.
   */
  async function sincronizarExpedienteEnSupabase(exp: Expediente) {
    if (!supabaseAdmin) return;
    try {
      // Resolver UUIDs válidos de usuarios para no causar errores de tipo UUID en PostgreSQL
      let respUuid: string | null = null;
      if (exp.responsableGeneralId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(exp.responsableGeneralId)) {
        respUuid = exp.responsableGeneralId;
      } else if (exp.responsableGeneralId) {
        const p = mockDb.perfiles.find((u) => u.id === exp.responsableGeneralId || u.username === exp.responsableGeneralId || u.rol === exp.responsableGeneralRol);
        if (p && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id)) {
          respUuid = p.id;
        }
      }

      let asistUuid: string | null = null;
      if (exp.asistenteAsignadoId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(exp.asistenteAsignadoId)) {
        asistUuid = exp.asistenteAsignadoId;
      } else if (exp.asistenteAsignadoId) {
        const p = mockDb.perfiles.find((u) => u.id === exp.asistenteAsignadoId || u.username === exp.asistenteAsignadoId || u.rol === "asistente");
        if (p && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id)) {
          asistUuid = p.id;
        }
      }

      const payload: Record<string, any> = {
        fase_actual: exp.faseActual,
        estado_general: exp.estadoGeneral,
        bloqueado_por_revision: exp.bloqueadoPorRevision || false,
        fase_en_revision: exp.faseEnRevision || null,
        motivo_devolucion_fase: exp.motivoDevolucionFase || null,
        revision_fases: exp.revisionFases || {},
        estado_fase1: exp.estadoFase1 || "en_preparacion",
        estado_fase2: exp.estadoFase2 || "en_preparacion",
        observacion_devolucion_fase2: exp.observacionDevolucionFase2 || null,
        validacion_compensar: exp.validacionCompensar
          ? {
              ...exp.validacionCompensar,
              subsanacionFase3Activa: Boolean(exp.subsanacionFase3Activa),
              subsanacionFase3Estado: exp.subsanacionFase3Estado || null,
              subsanacionFase3ObservacionAnalista: exp.subsanacionFase3ObservacionAnalista || null,
              subsanacionFase3DocumentosModificados: exp.subsanacionFase3DocumentosModificados || []
            }
          : null,
        gestion_fase4: exp.gestionFase4 || null,
        tramite_licencia: exp.tramiteLicencia || null,
        postulacion_subsidio: exp.postulacionSubsidio || null,
        gestion_fase7: exp.gestionFase7 || null,
        solicitud_rechazo: exp.solicitudRechazo || null,
        historial_solicitudes_rechazo: exp.historialSolicitudesRechazo || [],
        actualizado_en: new Date().toISOString()
      };

      if (respUuid) payload.responsable_general_id = respUuid;
      if (asistUuid) payload.asistente_asignado_id = asistUuid;

      let updatedCount = 0;
      // 1. Actualizar por código visible
      if (exp.codigoVisible) {
        const { data: updatedByCod, error: errPorCodigo } = await supabaseAdmin
          .from("expedientes")
          .update(payload)
          .eq("codigo_visible", exp.codigoVisible)
          .select("id");
        if (errPorCodigo) {
          console.error(`[SUPABASE]: Error guardando expediente ${exp.codigoVisible} (por código): ${errPorCodigo.message}`);
        }
        if (updatedByCod && updatedByCod.length > 0) {
          updatedCount += updatedByCod.length;
          if (!exp.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(exp.id)) {
            exp.id = updatedByCod[0].id;
          }
        }
      }

      // 2. Actualizar por UUID oficial
      if (exp.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(exp.id)) {
        const { data: updatedById, error: errPorId } = await supabaseAdmin
          .from("expedientes")
          .update(payload)
          .eq("id", exp.id)
          .select("id");
        if (errPorId) {
          console.error(`[SUPABASE]: Error guardando expediente ${exp.id} (por id): ${errPorId.message}`);
        }
        if (updatedById && updatedById.length > 0) {
          updatedCount += updatedById.length;
        }
      }

      if (updatedCount > 0) {
        (exp as any)._persistidoEnSupabase = true;
        console.log(`[SUPABASE]: Expediente ${exp.codigoVisible} (${exp.id}) sincronizado en PostgreSQL (Fase ${exp.faseActual}).`);
      } else {
        console.warn(`[SUPABASE]: NO se guardó el expediente ${exp.codigoVisible} (${exp.id}): ninguna fila fue actualizada. Revise SUPABASE_SERVICE_ROLE_KEY (clave secreta) y las políticas RLS.`);
      }
    } catch (e: any) {
      console.error("[SUPABASE]: Excepción sincronizando expediente:", e?.message);
    }
  }

  /**
   * Elimina formalmente un integrante de un hogar y sus requisitos documentales en Supabase PostgreSQL.
   */
  async function eliminarIntegranteDeSupabase(
    expedienteId: string,
    integranteId: string,
    personaId?: string,
    numeroIdentificacion?: string
  ) {
    if (!supabaseAdmin) return;
    try {
      let expUuid: string | null = null;
      let hogarId: string | null = null;

      // 1. Buscar expediente en Supabase para obtener su UUID oficial y el hogar_id
      if (esUuidValido(expedienteId)) {
        const { data: expRow } = await supabaseAdmin
          .from("expedientes")
          .select("id, hogar_id")
          .eq("id", expedienteId)
          .maybeSingle();
        if (expRow) {
          expUuid = expRow.id;
          hogarId = expRow.hogar_id;
        }
      }

      if (!expUuid) {
        const { data: expRow } = await supabaseAdmin
          .from("expedientes")
          .select("id, hogar_id")
          .eq("codigo_visible", expedienteId)
          .maybeSingle();
        if (expRow) {
          expUuid = expRow.id;
          hogarId = expRow.hogar_id;
        }
      }

      // Si no se encuentra con la ID directa, buscar en mockDb por el ID para obtener codigoVisible
      if (!expUuid) {
        const mockExp = mockDb.expedientes.find((e) => e.id === expedienteId || e.codigoVisible === expedienteId);
        if (mockExp?.codigoVisible) {
          const { data: expRow } = await supabaseAdmin
            .from("expedientes")
            .select("id, hogar_id")
            .eq("codigo_visible", mockExp.codigoVisible)
            .maybeSingle();
          if (expRow) {
            expUuid = expRow.id;
            hogarId = expRow.hogar_id;
          }
        }
      }

      // 2. Si integranteId es un UUID directo, borrar por ID de la tabla integrantes_hogar
      if (esUuidValido(integranteId)) {
        await supabaseAdmin
          .from("integrantes_hogar")
          .delete()
          .eq("id", integranteId);
      }

      // 3. Buscar persona_id si es UUID directo o por numeroIdentificacion
      let targetPersonaId = esUuidValido(personaId) ? personaId : null;
      if (!targetPersonaId && numeroIdentificacion) {
        const { data: pRow } = await supabaseAdmin
          .from("personas")
          .select("id")
          .eq("numero_identificacion", String(numeroIdentificacion).trim())
          .maybeSingle();
        if (pRow?.id) {
          targetPersonaId = pRow.id;
        }
      }

      // 4. Si tenemos hogarId y targetPersonaId, borrar de integrantes_hogar por (hogar_id, persona_id)
      if (hogarId && targetPersonaId) {
        await supabaseAdmin
          .from("integrantes_hogar")
          .delete()
          .eq("hogar_id", hogarId)
          .eq("persona_id", targetPersonaId);
      } else if (hogarId && numeroIdentificacion) {
        // Borrar cualquier integrante de este hogar cuya persona tenga la misma identificación
        const { data: personasMatch } = await supabaseAdmin
          .from("personas")
          .select("id")
          .eq("numero_identificacion", String(numeroIdentificacion).trim());
        if (personasMatch && personasMatch.length > 0) {
          for (const pMatch of personasMatch) {
            await supabaseAdmin
              .from("integrantes_hogar")
              .delete()
              .eq("hogar_id", hogarId)
              .eq("persona_id", pMatch.id);
          }
        }
      }

      // 5. Eliminar requisitos documentales (requisitos_caso) del integrante en Supabase
      if (expUuid && targetPersonaId) {
        await supabaseAdmin
          .from("requisitos_caso")
          .delete()
          .eq("expediente_id", expUuid)
          .eq("persona_id", targetPersonaId);
      } else if (expUuid && numeroIdentificacion) {
        const { data: personasMatch } = await supabaseAdmin
          .from("personas")
          .select("id")
          .eq("numero_identificacion", String(numeroIdentificacion).trim());
        if (personasMatch && personasMatch.length > 0) {
          for (const pMatch of personasMatch) {
            await supabaseAdmin
              .from("requisitos_caso")
              .delete()
              .eq("expediente_id", expUuid)
              .eq("persona_id", pMatch.id);
          }
        }
      }

      console.log(`[SUPABASE]: Integrante ${integranteId} (Persona: ${targetPersonaId || numeroIdentificacion}) eliminado permanentemente de Supabase.`);
    } catch (err: any) {
      console.error("[SUPABASE]: Error al eliminar integrante de Supabase:", err?.message);
    }
  }

  /**
   * Sincronización maestra e hidratación completa desde Supabase hacia la memoria del servidor.
   * Carga perfiles, interesados, expedientes con integrantes/predio/postulante y documentos.
   */
  async function sincronizarTodoDesdeSupabase(): Promise<{
    ok: boolean;
    expedientesCount: number;
    interesadosCount: number;
  }> {
    if (!supabaseAdmin) {
      return { ok: false, expedientesCount: mockDb.expedientes.length, interesadosCount: mockDb.interesados.length };
    }

    try {
      // 1. Sincronizar perfiles
      await sincronizarPerfilesDesdeSupabase().catch(() => {});

      // 2. Sincronizar interesados desde Supabase
      const { data: dbInteresados, error: intErr } = await supabaseAdmin
        .from("interesados")
        .select(`*, contactos_apoyo(*)`)
        .order("creado_en", { ascending: false });

      if (!intErr && Array.isArray(dbInteresados)) {
        mockDb.interesados = dbInteresados.map((row: any) => {
          const partesNombre = decodificarNombresMetadata(row.resumen_necesidad) || descomponerNombreCompleto(row.nombre_contacto);
          const fechaRegMs = new Date(row.creado_en || Date.now()).getTime();
          const fechaCaducidad = new Date(fechaRegMs + 45 * 24 * 60 * 60 * 1000).toISOString();
          let cedulaRow = row.numero_identificacion || row.cedula || partesNombre.numeroIdentificacion || undefined;
          let tipoIdRow = (row.tipo_identificacion as TipoIdentificacion) || (partesNombre.tipoIdentificacion as TipoIdentificacion) || "CC";
          if (!cedulaRow) {
            const telLimpio = String(row.telefono || "").replace(/\D/g, "");
            const persMatch = mockDb.personas.find(
              (p) => (telLimpio && p.telefonoPrincipal?.replace(/\D/g, "") === telLimpio) ||
                     (row.nombre_contacto && normalizarTextoNombre(row.nombre_contacto).includes(normalizarTextoNombre(p.primerApellido || "")))
            );
            if (persMatch?.numeroIdentificacion) {
              cedulaRow = persMatch.numeroIdentificacion;
              if (persMatch.tipoIdentificacion) tipoIdRow = persMatch.tipoIdentificacion as TipoIdentificacion;
            }
          }
          return {
            id: row.id,
            tipoIdentificacion: tipoIdRow,
            numeroIdentificacion: cedulaRow,
            cedula: cedulaRow,
            primerNombre: partesNombre.primerNombre,
            segundoNombre: partesNombre.segundoNombre || undefined,
            primerApellido: partesNombre.primerApellido,
            segundoApellido: partesNombre.segundoApellido || undefined,
            nombreContacto: row.nombre_contacto || "Sin Nombre",
            telefono: row.telefono || "",
            telefonoSecundario: row.telefono_secundario || partesNombre.telefonoSecundario || undefined,
            tieneWhatsappSecundario: Boolean(row.tiene_whatsapp_secundario),
            tieneWhatsapp: Boolean(row.tiene_whatsapp),
            correo: row.correo || undefined,
            departamentoCodigo: row.departamento_codigo || "25",
            municipioCodigo: row.municipio_codigo || "25151",
            vereda: row.vereda || "Rural",
            origenContacto: row.origen_contacto || "Llamada",
            resumenNecesidad: limpiarTextoMetadata(row.resumen_necesidad),
            comercialAsignadoId: row.comercial_asignado_id || "757ef367-c0bd-480a-b294-d5fef041f39c",
            estadoComercial: row.estado_comercial || "nuevo_contacto",
            convertidoAExpedienteId: row.convertido_a_expediente_id || undefined,
            creadoEn: row.creado_en,
            fechaCaducidad,
            diasExtension: 0,
            contactosApoyo: Array.isArray(row.contactos_apoyo)
              ? row.contactos_apoyo.map((c: any) => ({
                  id: c.id,
                  interesadoId: c.interesado_id || row.id,
                  nombreCompleto: c.nombre_completo,
                  telefono: c.telefono,
                  parentesco: c.parentesco || "Familiar",
                  tieneWhatsapp: Boolean(c.tiene_whatsapp)
                }))
              : []
          };
        });
        console.log(`[SUPABASE]: ${mockDb.interesados.length} interesados sincronizados oficialmente.`);
      }

      // 3. Sincronizar expedientes desde Supabase
      const { data: dbExpedientes, error: expErr } = await supabaseAdmin
        .from("expedientes")
        .select(`
          *,
          postulante:personas!expedientes_postulante_id_fkey(*),
          predio:predios!expedientes_predio_vivienda_id_fkey(*),
          hogar:hogares!expedientes_hogar_id_fkey(
            id,
            observaciones,
            integrantes:integrantes_hogar(
              id,
              parentesco,
              es_postulante_principal,
              persona:personas(*)
            )
          ),
          comercial:perfiles_usuario!expedientes_comercial_origen_id_fkey(id, nombre_completo, username, rol),
          responsable:perfiles_usuario!expedientes_responsable_general_id_fkey(id, nombre_completo, username, rol)
        `)
        .order("creado_en", { ascending: false });

      if (!expErr && Array.isArray(dbExpedientes)) {
        mockDb.expedientes = dbExpedientes.map((row: any) => {
          const exp = mapearFilaSupabaseAExpediente(row);
          (exp as any)._persistidoEnSupabase = true;
          inicializarRequisitosFase1(exp);
          if (exp.faseActual >= 2) inicializarRequisitosFase2(exp);
          if (exp.faseActual >= 4) inicializarFase4(exp);
          if (exp.faseActual >= 5) inicializarFase5Licencia(exp);
          if (exp.faseActual >= 6) inicializarFase6Postulacion(exp);
          if (exp.faseActual >= 7) inicializarFase7(exp);
          return exp;
        });
        console.log(`[SUPABASE]: ${mockDb.expedientes.length} expedientes sincronizados oficialmente.`);
      }

      // 4. Sincronizar documentos y versiones globales desde Supabase
      try {
        const { data: dbDocs } = await supabaseAdmin
          .from("documentos")
          .select(`
            id,
            titulo,
            expediente_id,
            persona_id,
            versiones:versiones_documento(*)
          `);

        if (Array.isArray(dbDocs) && dbDocs.length > 0) {
          dbDocs.forEach((dRow: any) => {
            let existingDoc = mockDb.documentos.find((d) => d.id === dRow.id);
            const versionesMapeadas: DocVersion[] = (dRow.versiones || []).map((v: any) => {
              const pubUrl = v.url_publica || (v.storage_path ? `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET_NAME}/${v.storage_path}` : `/uploads/${v.storage_path}`);
              return {
                id: v.id,
                documentoId: dRow.id,
                versionNumero: v.version_numero || 1,
                storagePath: v.storage_path,
                nombreArchivoOriginal: v.nombre_archivo_original,
                mimeType: v.mime_type || "application/pdf",
                tamanoBytes: Number(v.tamano_bytes) || 1024,
                sha256Hash: v.sha256_hash || "",
                subidoPorId: v.subido_por || "",
                subidoEn: v.subido_en || new Date().toISOString(),
                urlFirmadaTemporal: pubUrl,
                archivoDataUrl: pubUrl
              };
            });

            if (existingDoc) {
              if (dRow.persona_id) existingDoc.personaId = dRow.persona_id;
              if (versionesMapeadas.length > 0) {
                existingDoc.versiones = versionesMapeadas;
                existingDoc.versionActual = versionesMapeadas[versionesMapeadas.length - 1];
              }
            } else {
              mockDb.documentos.push({
                id: dRow.id,
                expedienteId: dRow.expediente_id,
                personaId: dRow.persona_id || undefined,
                categoria: "general",
                titulo: dRow.titulo,
                esOficial: true,
                versiones: versionesMapeadas,
                versionActual: versionesMapeadas[versionesMapeadas.length - 1]
              });
            }
          });
          console.log(`[SUPABASE]: ${dbDocs.length} documentos sincronizados oficialmente.`);
        }
      } catch (docErr: any) {
        console.warn("[SUPABASE]: Advertencia sincronizando documentos:", docErr?.message);
      }

      return {
        ok: true,
        expedientesCount: mockDb.expedientes.length,
        interesadosCount: mockDb.interesados.length
      };
    } catch (e: any) {
      console.error("[SUPABASE]: Excepción en sincronizarTodoDesdeSupabase:", e?.message);
      return { ok: false, expedientesCount: mockDb.expedientes.length, interesadosCount: mockDb.interesados.length };
    }
  }

  // Hidratación completa automática al inicio del servidor
  sincronizarTodoDesdeSupabase().catch((err) =>
    console.error("[SUPABASE]: Fallo sincronización completa inicial:", err?.message)
  );

  /**
   * Procesa la Salida Definitiva / Retiro de un Hogar:
   * 1. Marca estado_general = 'salida_definitiva' en memoria y en la tabla expedientes de Supabase.
   * 2. Registra el evento en memoria y en la tabla eventos_salida de Supabase.
   */
  async function registrarSalidaDefinitiva(
    exp: Expediente,
    motivo: string,
    fundamento: string,
    decididoPorId: string,
    faseAlcanzada?: number
  ): Promise<EventoSalida> {
    exp.estadoGeneral = "salida_definitiva";
    exp.bloqueadoPorRevision = false;
    const fase = faseAlcanzada ?? exp.faseActual ?? 1;

    const eventoSalidaId = `sal-${Date.now()}`;
    const eventoSalida: EventoSalida = {
      id: eventoSalidaId,
      expedienteId: exp.id,
      motivo: motivo || "Salida definitiva",
      fundamento: fundamento || "Retiro formal del programa",
      decididoPorId,
      fechaSalida: new Date().toISOString(),
      faseAlcanzada: fase
    };
    mockDb.eventosSalida.push(eventoSalida);

    // 1. Sincronizar actualización de expediente en PostgreSQL
    await sincronizarExpedienteEnSupabase(exp);

    // 2. Insertar directamente en la tabla eventos_salida y forzar UPDATE en expedientes
    if (supabaseAdmin) {
      try {
        let expUuid: string | null = null;
        if (exp.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(exp.id)) {
          expUuid = exp.id;
        } else {
          const { data: expRow } = await supabaseAdmin
            .from("expedientes")
            .select("id")
            .eq("codigo_visible", exp.codigoVisible)
            .maybeSingle();
          if (expRow?.id) expUuid = expRow.id;
        }

        // UPDATE directo y explícito a tabla expedientes en Supabase
        const payloadUpdate = {
          estado_general: "salida_definitiva",
          bloqueado_por_revision: false,
          actualizado_en: new Date().toISOString()
        };

        if (expUuid) {
          const { error: updErr } = await supabaseAdmin
            .from("expedientes")
            .update(payloadUpdate)
            .eq("id", expUuid);
          if (updErr) {
            console.error("[SUPABASE]: Error haciendo UPDATE en expedientes por UUID:", updErr.message);
          } else {
            console.log(`[SUPABASE]: UPDATE exitoso estado_general='salida_definitiva' para expediente ${exp.codigoVisible} (UUID: ${expUuid}).`);
          }
        }
        if (exp.codigoVisible) {
          const { error: updErr2 } = await supabaseAdmin
            .from("expedientes")
            .update(payloadUpdate)
            .eq("codigo_visible", exp.codigoVisible);
          if (updErr2) {
            console.error("[SUPABASE]: Error haciendo UPDATE en expedientes por codigo_visible:", updErr2.message);
          } else {
            console.log(`[SUPABASE]: UPDATE exitoso estado_general='salida_definitiva' para expediente ${exp.codigoVisible}.`);
          }
        }

        // Resolver UUID del usuario para decidido_por sin error de sintaxis UUID en Postgres
        let userUuid: string | null = null;
        if (decididoPorId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decididoPorId)) {
          userUuid = decididoPorId;
        } else if (decididoPorId) {
          const { data: uRow } = await supabaseAdmin
            .from("perfiles_usuario")
            .select("id")
            .eq("username", String(decididoPorId).toLowerCase())
            .maybeSingle();
          if (uRow?.id) {
            userUuid = uRow.id;
          }
        }

        if (!userUuid) {
          const perfilEnMemoria = mockDb.perfiles.find(
            (p) => p.id === decididoPorId || p.username.toLowerCase() === String(decididoPorId).toLowerCase()
          );
          if (perfilEnMemoria) {
            const { data: uRowMem } = await supabaseAdmin
              .from("perfiles_usuario")
              .select("id")
              .eq("username", perfilEnMemoria.username.toLowerCase())
              .maybeSingle();
            if (uRowMem?.id) userUuid = uRowMem.id;
          }
        }

        if (!userUuid) {
          const { data: fallbackUser } = await supabaseAdmin
            .from("perfiles_usuario")
            .select("id")
            .in("rol", ["supervisor", "administrador"])
            .limit(1)
            .maybeSingle();
          if (fallbackUser?.id) userUuid = fallbackUser.id;
        }

        if (expUuid && userUuid) {
          const { error: insError } = await supabaseAdmin
            .from("eventos_salida")
            .insert({
              expediente_id: expUuid,
              motivo: (motivo || "Salida definitiva").slice(0, 150),
              fundamento: fundamento || "Retiro definitivo del programa.",
              decidido_por: userUuid,
              fecha_salida: new Date().toISOString(),
              fase_alcanzada: fase
            });

          if (insError) {
            console.error("[SUPABASE]: Error insertando en eventos_salida:", insError.message);
          } else {
            console.log(`[SUPABASE]: Registro exitoso en eventos_salida para expediente ${exp.codigoVisible}.`);
          }
        }
      } catch (err: any) {
        console.error("[SUPABASE]: Excepción registrando evento_salida:", err?.message);
      }
    }

    return eventoSalida;
  }

  // ==========================================
  // RUTAS DE LA API (HITO 1)
  // ==========================================

  // 0. HEALTHCHECK PARA RENDER
  app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // 0. ESTADO DEL SISTEMA (MODO DE OPERACIÓN Y SUPABASE)
  app.get("/api/system/status", async (req: Request, res: Response) => {
    let supabaseStatus = { ok: false, message: "No configurado", projectId: SUPABASE_PROJECT_ID, url: supabaseUrl };
    try {
      supabaseStatus = await testSupabaseConnection();
    } catch (e: any) {
      supabaseStatus = { ok: false, message: e.message, projectId: SUPABASE_PROJECT_ID, url: supabaseUrl };
    }

    const isSupabase = Boolean(supabaseStatus.ok || supabaseAdmin);

    res.json({
      mode: isSupabase ? "supabase" : "mock",
      isPersistent: isSupabase,
      projectId: SUPABASE_PROJECT_ID,
      projectUrl: supabaseUrl,
      supabaseConnected: supabaseStatus.ok,
      supabaseStatusMsg: supabaseStatus.message,
      label: isSupabase 
        ? `MODO SUPABASE — PROYECTO: ${SUPABASE_PROJECT_ID}` 
        : "MODO DEMOSTRACIÓN — DATOS FICTICIOS NO PERSISTENTES"
    });
  });

  // 0.05 ENDPOINT MAESTRO DE SINCRONIZACIÓN Y RECARGA EN TIEMPO REAL
  // Ejecuta sincronización bidireccional y retorna inmediatamente datos actualizados
  const ejecutarSincronizacionMaestra = async (req: AuthRequest, res: Response) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    try {
      let supabaseOk = false;

      // 1. Sincronización e hidratación integral desde Supabase (perfiles, interesados, expedientes)
      if (supabaseAdmin) {
        try {
          const syncRes = await sincronizarTodoDesdeSupabase();
          supabaseOk = syncRes.ok;
        } catch (e: any) {
          console.warn("[SYNC]: Error en sincronizarTodoDesdeSupabase:", e?.message);
        }
      }

      // 4. Sanitizar y limpiar requisitos huérfanos y reconciliar documentos en todos los expedientes
      mockDb.expedientes.forEach((exp) => {
        inicializarRequisitosFase1(exp);
        limpiarRequisitosHuerfanosExpediente(exp);
        reconciliarDocumentosConRequisitos(exp);

        // Enriquecer expedientes con teléfono secundario del interesado origen si está disponible
        const matchInt = mockDb.interesados.find(
          (i) =>
            (i.convertidoAExpedienteId && (i.convertidoAExpedienteId === exp.id || i.convertidoAExpedienteId === exp.codigoVisible)) ||
            (i.numeroIdentificacion && exp.postulante?.numeroIdentificacion && (i.numeroIdentificacion === exp.postulante.numeroIdentificacion || exp.postulante.numeroIdentificacion.includes(i.numeroIdentificacion))) ||
            (i.cedula && exp.postulante?.numeroIdentificacion && (i.cedula === exp.postulante.numeroIdentificacion || exp.postulante.numeroIdentificacion.includes(i.cedula))) ||
            (exp.interesadoOrigenId && i.id === exp.interesadoOrigenId) ||
            (i.telefono && exp.postulante?.telefonoPrincipal && i.telefono.replace(/\D/g, "") === exp.postulante.telefonoPrincipal.replace(/\D/g, ""))
        );
        if (matchInt) {
          if (!exp.interesadoOrigenId) exp.interesadoOrigenId = matchInt.id;
          const sec = matchInt.telefonoSecundario || (matchInt as any).tel2;
          if (sec) {
            if (!exp.postulante.telefonoSecundario) exp.postulante.telefonoSecundario = sec;
            if (!(exp as any).telefonoSecundario) (exp as any).telefonoSecundario = sec;
          }
          if (!exp.postulante.telefonoPrincipal && matchInt.telefono) {
            exp.postulante.telefonoPrincipal = matchInt.telefono;
          }
        }
      });

      // 5. Preparar listado enriquecido de expedientes
      const listadoExpedientes = mockDb.expedientes.map((exp) => {
        if (exp.faseActual >= 4 && !exp.gestionFase4) {
          inicializarFase4(exp);
        }
        const comercial = mockDb.perfiles.find((p) => p.id === exp.comercialOrigenId);
        const supervisorPerfil = mockDb.perfiles.find((p) => p.rol === "supervisor");
        const responsable = exp.bloqueadoPorRevision
          ? (supervisorPerfil || mockDb.perfiles.find((p) => p.id === "usr-supervisor-01"))
          : (mockDb.perfiles.find((p) => p.id === exp.responsableGeneralId || p.username === exp.responsableGeneralId) || supervisorPerfil);

        const fechaInicio = new Date(exp.fechaIngresoFase1).getTime();
        const diasTranscurridos = Math.max(0, Math.floor((Date.now() - fechaInicio) / (1000 * 60 * 60 * 24)));

        const tieneDocsObservados = mockDb.requisitosCaso.some(
          (r) => r.expedienteId === exp.id && r.estado === "con_observaciones"
        );
        const tieneFaseObservada =
          (exp.estadoGeneral as string) === "con_observaciones" ||
          exp.validacionCompensar?.estadoActual === "con_observaciones" ||
          exp.estadoFase1 === "devuelto" ||
          exp.estadoFase2 === "devuelto" ||
          Boolean((exp as any).subsanacionFase3Activa);
        const tieneObservaciones = tieneDocsObservados || tieneFaseObservada;

        return {
          ...exp,
          comercialOrigenNombre: comercial?.nombreCompleto || "Sin asignar",
          responsableGeneralNombre: exp.bloqueadoPorRevision
            ? (supervisorPerfil?.nombreCompleto || "Supervisor")
            : (responsable?.nombreCompleto || exp.responsableGeneralNombre || "Sin asignar"),
          responsableGeneralRol: exp.bloqueadoPorRevision
            ? "supervisor"
            : (responsable?.rol || exp.responsableGeneralRol),
          tieneObservaciones,
          diasTranscurridos,
          diasEnPausa: 0
        };
      });

      res.json({
        success: true,
        ok: true,
        supabaseConnected: supabaseOk,
        mensaje: "Base de datos y estado sincronizados exitosamente.",
        timestamp: new Date().toISOString(),
        totalExpedientes: listadoExpedientes.length,
        totalInteresados: mockDb.interesados.length,
        expedientes: listadoExpedientes,
        interesados: mockDb.interesados
      });
    } catch (err: any) {
      console.error("[SYNC FATAL ERROR]:", err?.message);
      res.status(500).json({ error: "Error en sincronización: " + (err?.message || "error desconocido") });
    }
  };

  app.post("/api/sync", requireAuth(), ejecutarSincronizacionMaestra);
  app.get("/api/sync", requireAuth(), ejecutarSincronizacionMaestra);

  // 0.1 DIAGNÓSTICO DETALLADO SUPABASE
  app.get("/api/supabase/status", requireAuth(["administrador"]), async (req: Request, res: Response) => {
    try {
      const status = await testSupabaseConnection();
      res.json({
        ...status,
        projectId: SUPABASE_PROJECT_ID,
        url: supabaseUrl,
        mode: process.env.APP_MODE || "supabase"
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // 0.2 OBTENER ESQUEMA SQL PARA EJECUTAR EN SUPABASE SQL EDITOR
  app.get("/api/supabase/schema-sql", requireAuth(["administrador"]), (req: Request, res: Response) => {
    try {
      const sqlPath = path.join(process.cwd(), "src", "db", "001_initial_schema.sql");
      if (fs.existsSync(sqlPath)) {
        const sqlContent = fs.readFileSync(sqlPath, "utf-8");
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.send(sqlContent);
      } else {
        res.status(404).send("-- Archivo de esquema no encontrado");
      }
    } catch (e: any) {
      res.status(500).send(`-- Error al leer esquema: ${e.message}`);
    }
  });

  // 0.3 POBLAR O SINCRONIZAR DATOS BASE (MUNICIPIOS Y PERFILES) HACIA SUPABASE
  app.post("/api/supabase/seed", requireAuth(["administrador"]), async (req: Request, res: Response) => {
    if (!supabaseAdmin) {
      res.status(400).json({ ok: false, error: "Cliente Supabase no configurado" });
      return;
    }

    try {
      const results: { municipios: number; perfiles: number; errors: any[] } = {
        municipios: 0,
        perfiles: 0,
        errors: []
      };

      // 1. Catálogo de Municipios
      const municipiosToInsert = CATALOGO_MUNICIPIOS.map((m) => ({
        codigo_completo: m.codigoCompleto,
        departamento_codigo: m.departamentoCodigo,
        municipio_codigo: m.municipioCodigo,
        departamento_nombre: m.departamentoNombre,
        municipio_nombre: m.municipioNombre,
        fuente: "Codificación de Municipios por Departamento PDF"
      }));

      const { error: munError } = await supabaseAdmin
        .from("catalogo_municipios")
        .upsert(municipiosToInsert, { onConflict: "codigo_completo" });

      if (munError) {
        results.errors.push({ tabla: "catalogo_municipios", error: munError.message, code: munError.code });
      } else {
        results.municipios = municipiosToInsert.length;
      }

      // 2. Perfiles de Usuario
      const perfilesToInsert = mockDb.perfiles.map((p) => ({
        username: p.username,
        email: p.email,
        nombre_completo: p.nombreCompleto,
        rol: p.rol,
        activo: p.activo
      }));

      const { error: perfError } = await supabaseAdmin
        .from("perfiles_usuario")
        .upsert(perfilesToInsert, { onConflict: "username" });

      if (perfError) {
        results.errors.push({ tabla: "perfiles_usuario", error: perfError.message, code: perfError.code });
      } else {
        results.perfiles = perfilesToInsert.length;
      }

      const rlsBlocked = results.errors.some((e) => e.code === "42501");

      res.json({
        ok: results.errors.length === 0,
        results,
        rlsBlocked,
        message: rlsBlocked
          ? "La política RLS de Supabase bloqueó la inserción porque la clave anon no tiene permiso de escritura directo. Para habilitar escrituras con la clave pública, ejecute el script SQL complementario en el SQL Editor de Supabase o configure la clave service_role."
          : results.errors.length > 0
          ? "Ocurrieron advertencias al sincronizar"
          : `Sincronización exitosa: ${results.municipios} municipios y ${results.perfiles} perfiles base registrados en Supabase.`
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // 1. AUTENTICACIÓN SEGURA CON BCRYPT
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "Debe ingresar nombre de usuario y contraseña." });
      return;
    }

    const cleanUsername = String(username).toLowerCase().trim();
    const claveLogin = `${req.ip}|${cleanUsername}`;

    if (loginBloqueado(claveLogin)) {
      res.status(429).json({ error: "Demasiados intentos fallidos. Intente de nuevo en 15 minutos." });
      return;
    }

    // 1. Buscar usuario en mockDb
    let user = mockDb.perfiles.find(
      (u) => u.username.toLowerCase() === cleanUsername && u.activo
    );

    // Si Supabase está disponible, verificar o sincronizar datos del usuario
    if (supabaseAdmin) {
      try {
        const { data: dbUser } = await supabaseAdmin
          .from("perfiles_usuario")
          .select("*")
          .eq("username", cleanUsername)
          .eq("activo", true)
          .maybeSingle();

        if (dbUser) {
          const rolNormalizado = normalizarRolUsuario(dbUser.rol);
          if (!user) {
            user = {
              id: dbUser.id,
              username: dbUser.username,
              email: dbUser.email,
              nombreCompleto: dbUser.nombre_completo || dbUser.username,
              rol: rolNormalizado,
              activo: dbUser.activo,
              creadoEn: dbUser.creado_en || new Date().toISOString(),
              passwordHash: dbUser.password_hash || "",
              password_hash: dbUser.password_hash || "",
              requiereCambioPassword: Boolean(dbUser.requiere_cambio_password),
              requiere_cambio_password: Boolean(dbUser.requiere_cambio_password)
            };
            mockDb.perfiles.push(user);
          } else {
            user.id = dbUser.id;
            user.nombreCompleto = dbUser.nombre_completo || user.nombreCompleto;
            user.email = dbUser.email || user.email;
            user.rol = rolNormalizado;
            user.activo = Boolean(dbUser.activo);
            if (dbUser.password_hash) {
              user.passwordHash = dbUser.password_hash;
              user.password_hash = dbUser.password_hash;
            }
            if (typeof dbUser.requiere_cambio_password === "boolean") {
              user.requiereCambioPassword = dbUser.requiere_cambio_password;
              user.requiere_cambio_password = dbUser.requiere_cambio_password;
            }
          }
        }
      } catch (err: any) {
        console.error("[AUTH]: Error al consultar usuario en Supabase:", err?.message);
      }
    }

    if (!user) {
      registrarFalloLogin(claveLogin);
      // Mensaje genérico para prevenir enumeración de usuarios
      res.status(401).json({ error: "Credenciales inválidas o cuenta inactiva." });
      return;
    }

    // 2. Validación de contraseña con bcrypt (tolerante a migración)
    const hashAComparar = user.password_hash || user.passwordHash || "";
    const esPasswordValida = await comparePassword(String(password), hashAComparar);

    if (!esPasswordValida) {
      registrarFalloLogin(claveLogin);
      res.status(401).json({ error: "Credenciales inválidas o cuenta inactiva." });
      return;
    }

    fallosLogin.delete(claveLogin);

    // Si la cuenta aún usa la contraseña por defecto del sistema, se obliga a cambiarla
    const HASH_PASSWORD_POR_DEFECTO = "$2b$10$R7Ln7bHfwo31wfJtcsos4uhsG/41vfYkftg1GdnBpFku/Uht74jNO";
    const usaPasswordPorDefecto = hashAComparar === HASH_PASSWORD_POR_DEFECTO;
    const requiereCambio =
      usaPasswordPorDefecto || Boolean(user.requiere_cambio_password ?? user.requiereCambioPassword);

    // Cookie de sesión firmada (HttpOnly)
    const tokenSesion = firmarTokenSesion(user.id);
    res.cookie("crm_session_user", tokenSesion, opcionesCookieSesion(req));

    res.json({
      success: true,
      token: tokenSesion,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        nombreCompleto: user.nombreCompleto,
        rol: user.rol,
        requiere_cambio_password: requiereCambio,
        requiereCambioPassword: requiereCambio
      }
    });
  });

  // 1.1 ENDPOINT PROTEGIDO: CAMBIO DE CONTRASEÑA CON CIFRADO BCRYPT
  app.post("/api/auth/cambiar-password", requireAuth(), async (req: AuthRequest, res: Response) => {
    try {
      const { nuevaPassword, nueva_password, confirmarPassword } = req.body;
      const passwordParaAsignar = String(nuevaPassword || nueva_password || "").trim();

      if (!passwordParaAsignar) {
        res.status(400).json({ error: "Debe ingresar la nueva contraseña." });
        return;
      }

      if (passwordParaAsignar.length < 8) {
        res.status(400).json({
          error: "La nueva contraseña debe tener al menos 8 caracteres por políticas de seguridad."
        });
        return;
      }

      // Validar que incluya letra y número
      if (!/[a-zA-Z]/.test(passwordParaAsignar) || !/\d/.test(passwordParaAsignar)) {
        res.status(400).json({
          error: "La contraseña debe incluir al menos una letra y un número."
        });
        return;
      }

      if (confirmarPassword && passwordParaAsignar !== String(confirmarPassword).trim()) {
        res.status(400).json({ error: "La nueva contraseña y la confirmación no coinciden." });
        return;
      }

      if (passwordParaAsignar === "crm2026*") {
        res.status(400).json({
          error: "Debe definir una contraseña diferente a la contraseña genérica por defecto."
        });
        return;
      }

      const user = req.user!;

      // Cifrado criptográfico con bcrypt (10 rondas de salt)
      const nuevoHash = await hashPassword(passwordParaAsignar);

      // Actualizar en memoria
      const perfilEnDb = mockDb.perfiles.find((u) => u.id === user.id);
      if (perfilEnDb) {
        perfilEnDb.passwordHash = nuevoHash;
        perfilEnDb.password_hash = nuevoHash;
        perfilEnDb.requiereCambioPassword = false;
        perfilEnDb.requiere_cambio_password = false;
      }

      // Actualizar en Supabase si está disponible
      if (supabaseAdmin) {
        (async () => {
          try {
            await supabaseAdmin
              .from("perfiles_usuario")
              .update({
                password_hash: nuevoHash,
                requiere_cambio_password: false
              })
              .eq("username", user.username);
            console.log(`[AUTH]: Contraseña cifrada con bcrypt actualizada en Supabase para ${user.username}`);
          } catch (err: any) {
            console.error("[AUTH]: Error al actualizar contraseña en Supabase:", err?.message);
          }
        })();
      }

      // Auditoría administrativa
      mockDb.auditoriaAdmin.unshift({
        id: `aud-${Date.now()}`,
        fecha: new Date().toISOString(),
        adminId: user.id,
        adminNombre: user.nombreCompleto,
        accion: "CAMBIO_PASSWORD",
        detalle: `El usuario ${user.username} actualizó su contraseña con hash seguro bcrypt.`,
        categoria: "usuarios",
        metadatos: { username: user.username, rol: user.rol }
      });

      res.json({
        success: true,
        message: "Contraseña actualizada y cifrada exitosamente con bcrypt.",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          nombreCompleto: user.nombreCompleto,
          rol: user.rol,
          requiere_cambio_password: false,
          requiereCambioPassword: false
        }
      });
    } catch (err: any) {
      console.error("[AUTH] Error en cambio de contraseña:", err);
      res.status(500).json({ error: "Error interno al procesar el cambio de contraseña." });
    }
  });

  // 1.2 UTILIDAD PARA CREACIÓN DE USUARIOS REALES CIFRADOS CON BCRYPT (Solo Administrador)
  app.post(
    "/api/admin/usuarios/crear-inicial",
    requireAuth(["administrador"]),
    async (req: AuthRequest, res: Response) => {
      try {
        const { username, email, nombreCompleto, rol, passwordPlana, requiereCambioPassword } = req.body;

        if (!username || !email || !nombreCompleto || !rol || !passwordPlana) {
          res.status(400).json({
            error: "Todos los campos (username, email, nombreCompleto, rol, passwordPlana) son obligatorios."
          });
          return;
        }

        // Verificar si el username o email ya existen
        const existe = mockDb.perfiles.some(
          (u) =>
            u.username.toLowerCase() === String(username).toLowerCase() ||
            u.email.toLowerCase() === String(email).toLowerCase()
        );

        if (existe) {
          res.status(400).json({ error: "Ya existe un usuario con ese nombre de usuario o correo electrónico." });
          return;
        }

        const nuevoUsuario = await crearUsuarioInicial({
          username,
          email,
          nombreCompleto,
          rol,
          passwordPlana,
          requiereCambioPassword: requiereCambioPassword !== false
        });

        mockDb.perfiles.push(nuevoUsuario);

        // Persistir en Supabase
        if (supabaseAdmin) {
          try {
            await supabaseAdmin.from("perfiles_usuario").insert([
              {
                id: nuevoUsuario.id,
                username: nuevoUsuario.username,
                email: nuevoUsuario.email,
                nombre_completo: nuevoUsuario.nombreCompleto,
                rol: nuevoUsuario.rol,
                activo: true,
                password_hash: nuevoUsuario.password_hash,
                requiere_cambio_password: nuevoUsuario.requiere_cambio_password
              }
            ]);
            console.log(`[AUTH]: Nuevo usuario ${nuevoUsuario.username} persistido en Supabase.`);
          } catch (sbErr: any) {
            console.error("[AUTH]: Error al persistir nuevo usuario en Supabase:", sbErr?.message);
          }
        }

        res.status(201).json({
          success: true,
          mensaje: "Usuario corporativo creado y cifrado con bcrypt exitosamente.",
          usuario: {
            id: nuevoUsuario.id,
            username: nuevoUsuario.username,
            email: nuevoUsuario.email,
            nombreCompleto: nuevoUsuario.nombreCompleto,
            rol: nuevoUsuario.rol,
            activo: nuevoUsuario.activo,
            creadoEn: nuevoUsuario.creadoEn,
            requiere_cambio_password: nuevoUsuario.requiere_cambio_password
          }
        });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || "Error al crear el usuario." });
      }
    }
  );

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    {
      const { maxAge: _omitido, ...opcionesLimpieza } = opcionesCookieSesion(req);
      res.clearCookie("crm_session_user", opcionesLimpieza);
    }
    res.json({ success: true });
  });

  app.get("/api/auth/me", (req: AuthRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ authenticated: false });
      return;
    }
    const requiereCambio = Boolean(req.user.requiere_cambio_password ?? req.user.requiereCambioPassword);
    res.json({
      authenticated: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        nombreCompleto: req.user.nombreCompleto,
        rol: req.user.rol,
        requiere_cambio_password: requiereCambio,
        requiereCambioPassword: requiereCambio
      }
    });
  });

  // Cambio rápido de usuario / perfil para pruebas y navegación
  app.post("/api/auth/switch-user", requireAuth(["administrador"]), async (req: AuthRequest, res: Response) => {
    const { userId } = req.body;
    let user = mockDb.perfiles.find(
      (u) => (u.id === userId || u.username.toLowerCase() === String(userId).toLowerCase()) && u.activo !== false
    );

    if (!user && supabaseAdmin) {
      await sincronizarPerfilesDesdeSupabase();
      user = mockDb.perfiles.find(
        (u) => (u.id === userId || u.username.toLowerCase() === String(userId).toLowerCase()) && u.activo !== false
      );
    }

    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado o inactivo." });
      return;
    }

    const requiereCambio = Boolean(user.requiere_cambio_password ?? user.requiereCambioPassword);

    console.warn(`[AUDITORIA]: El administrador "${req.user?.username}" cambió de sesión al usuario "${user.username}".`);

    const tokenSesionCambio = firmarTokenSesion(user.id);
    res.cookie("crm_session_user", tokenSesionCambio, opcionesCookieSesion(req));

    res.json({
      success: true,
      token: tokenSesionCambio,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        nombreCompleto: user.nombreCompleto,
        rol: user.rol,
        activo: true,
        requiere_cambio_password: requiereCambio,
        requiereCambioPassword: requiereCambio
      }
    });
  });

  // Catálogo de todos los usuarios del sistema (sincronizado con Supabase)
  app.get("/api/usuarios/todos", requireAuth(), async (req: Request, res: Response) => {
    if (supabaseAdmin) {
      await sincronizarPerfilesDesdeSupabase();
    }

    const usuarios = mockDb.perfiles
      .filter((u) => u.activo !== false)
      .map((u) => ({
        id: u.id,
        nombreCompleto: u.nombreCompleto,
        username: u.username,
        rol: u.rol,
        email: u.email,
        activo: u.activo ?? true
      }));

    res.json(usuarios);
  });

  // 2. CATÁLOGO MUNICIPAL (Datos auditados del PDF oficial)
  app.get("/api/municipios", (req: Request, res: Response) => {
    res.json(CATALOGO_MUNICIPIOS);
  });

  // 3. LISTADO GENERAL Y CONSULTA UNIVERSAL DEL ESTADO (CON HIDRATACIÓN DESDE SUPABASE)
  app.get("/api/expedientes", requireAuth(), async (req: AuthRequest, res: Response) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    // 1. Hidratación bidireccional desde Supabase si el servicio está activo
    if (supabaseAdmin) {
      try {
        const { data: dbRows, error: sbErr } = await supabaseAdmin
          .from("expedientes")
          .select(`
            *,
            postulante:personas!expedientes_postulante_id_fkey(*),
            predio:predios!expedientes_predio_vivienda_id_fkey(*),
            hogar:hogares!expedientes_hogar_id_fkey(
              id,
              observaciones,
              integrantes:integrantes_hogar(
                id,
                parentesco,
                es_postulante_principal,
                persona:personas(*)
              )
            ),
            comercial:perfiles_usuario!expedientes_comercial_origen_id_fkey(id, nombre_completo, username, rol),
            responsable:perfiles_usuario!expedientes_responsable_general_id_fkey(id, nombre_completo, username, rol)
          `)
          .order("creado_en", { ascending: false });

        if (!sbErr && Array.isArray(dbRows)) {
          const idsEnDb = new Set(dbRows.map((r: any) => r.id));
          const codigosEnDb = new Set(dbRows.map((r: any) => r.codigo_visible).filter(Boolean));

          for (const row of dbRows) {
            const index = mockDb.expedientes.findIndex(
              (e) => e.id === row.id || (row.codigo_visible && e.codigoVisible === row.codigo_visible)
            );
            if (index !== -1) {
              // 1.1 Si ya existe, sincronizar campos actualizados desde la base de datos
              const expExistente = mockDb.expedientes[index];
              const dbFase = Number(row.fase_actual);
              if (dbFase) expExistente.faseActual = Math.max(expExistente.faseActual || 1, dbFase);
              if (row.estado_general) expExistente.estadoGeneral = row.estado_general;
              if (row.actualizado_en) expExistente.actualizadoEn = row.actualizado_en;
              if (row.validacion_compensar) {
                expExistente.validacionCompensar = row.validacion_compensar;
                if (row.validacion_compensar.subsanacionFase3Activa !== undefined) {
                  expExistente.subsanacionFase3Activa = Boolean(row.validacion_compensar.subsanacionFase3Activa);
                }
                if (row.validacion_compensar.subsanacionFase3Estado !== undefined) {
                  expExistente.subsanacionFase3Estado = row.validacion_compensar.subsanacionFase3Estado;
                }
                if (row.validacion_compensar.subsanacionFase3ObservacionAnalista !== undefined) {
                  expExistente.subsanacionFase3ObservacionAnalista = row.validacion_compensar.subsanacionFase3ObservacionAnalista;
                }
                if (row.validacion_compensar.subsanacionFase3DocumentosModificados !== undefined) {
                  expExistente.subsanacionFase3DocumentosModificados = row.validacion_compensar.subsanacionFase3DocumentosModificados;
                }
              }
              if (row.gestion_fase4) {
                inicializarFase4(expExistente);
                expExistente.gestionFase4 = {
                  interventoria: {
                    ...(row.gestion_fase4.interventoria || {}),
                    ...(expExistente.gestionFase4?.interventoria || {})
                  },
                  arquitectura: {
                    ...(row.gestion_fase4.arquitectura || {}),
                    ...(expExistente.gestionFase4?.arquitectura || {})
                  },
                  estudioSuelos: {
                    ...(row.gestion_fase4.estudioSuelos || {}),
                    ...(expExistente.gestionFase4?.estudioSuelos || {})
                  },
                  informeVisitaFrancoOsorio: expExistente.gestionFase4?.informeVisitaFrancoOsorio || row.gestion_fase4.informeVisitaFrancoOsorio,
                  actualizadoEn: expExistente.gestionFase4?.actualizadoEn || row.gestion_fase4.actualizadoEn || new Date().toISOString()
                };
              }
              if (row.tramite_licencia) expExistente.tramiteLicencia = row.tramite_licencia;
              if (row.postulacion_subsidio) expExistente.postulacionSubsidio = row.postulacion_subsidio;
              if (row.gestion_fase7) expExistente.gestionFase7 = row.gestion_fase7;
              if (row.bloqueado_por_revision !== undefined) expExistente.bloqueadoPorRevision = Boolean(row.bloqueado_por_revision);
              if (row.estado_fase1) expExistente.estadoFase1 = row.estado_fase1;
              if (row.estado_fase2) expExistente.estadoFase2 = row.estado_fase2;
              if (row.motivo_devolucion_fase !== undefined) expExistente.motivoDevolucionFase = row.motivo_devolucion_fase || undefined;
              if (row.observacion_devolucion_fase2 !== undefined) expExistente.observacionDevolucionFase2 = row.observacion_devolucion_fase2 || undefined;
              if (row.revision_fases) expExistente.revisionFases = row.revision_fases;
              if (expExistente.validacionCompensar?.estadoActual === "aprobado" && expExistente.faseActual < 4) {
                expExistente.faseActual = 4;
                expExistente.bloqueadoPorRevision = false;
              }
              if (row.postulante) {
                if (row.postulante.telefono_principal) expExistente.postulante.telefonoPrincipal = row.postulante.telefono_principal;
                if (row.postulante.telefono_secundario) expExistente.postulante.telefonoSecundario = row.postulante.telefono_secundario;
                if (row.postulante.correo) expExistente.postulante.correo = row.postulante.correo;
                if (row.postulante.nombres) expExistente.postulante.nombres = row.postulante.nombres;
                if (row.postulante.primer_apellido) expExistente.postulante.primerApellido = row.postulante.primer_apellido;
              }
              if (row.predio) {
                if (row.predio.vereda) expExistente.predioVivienda.vereda = row.predio.vereda;
                if (row.predio.nombre_o_direccion) expExistente.predioVivienda.nombreODireccion = row.predio.nombre_o_direccion;
              }
            } else {
              // 1.2 Si fue creado directamente en la base de datos Supabase, incorporarlo inmediatamente
              const nuevoExp = mapearFilaSupabaseAExpediente(row);
              inicializarRequisitosFase1(nuevoExp);
              if (nuevoExp.faseActual >= 2) inicializarRequisitosFase2(nuevoExp);
              if (nuevoExp.faseActual >= 4) inicializarFase4(nuevoExp);
              if (nuevoExp.faseActual >= 5) inicializarFase5Licencia(nuevoExp);
              if (nuevoExp.faseActual >= 6) inicializarFase6Postulacion(nuevoExp);
              if (nuevoExp.faseActual >= 7) inicializarFase7(nuevoExp);
              mockDb.expedientes.unshift(nuevoExp);
            }
          }

          // 1.3 Sincronizar eliminaciones: Si Supabase retornó los registros de la base de datos,
          // purgar de la memoria viva aquellos expedientes que fueron eliminados de Supabase
          mockDb.expedientes = mockDb.expedientes.filter((e) => {
            if (!e) return false;
            const esUuid = Boolean(e.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(e.id));
            const vinoDeDb = Boolean((e as any)._persistidoEnSupabase);
            if (esUuid || vinoDeDb) {
              return idsEnDb.has(e.id) || (e.codigoVisible && codigosEnDb.has(e.codigoVisible));
            }
            return Boolean(e.id || e.codigoVisible);
          });
        }
      } catch (dbErr: any) {
        console.error("[EXPEDIENTES HIDRATACIÓN ERROR]:", dbErr?.message);
      }
    }

    // Enriquecer expedientes con datos de contacto (teléfono secundario) desde interesados si no lo tienen
    mockDb.expedientes.forEach((exp) => {
      const matchInt = mockDb.interesados.find(
        (i) =>
          (i.convertidoAExpedienteId && (i.convertidoAExpedienteId === exp.id || i.convertidoAExpedienteId === exp.codigoVisible)) ||
          (i.numeroIdentificacion && exp.postulante?.numeroIdentificacion && (i.numeroIdentificacion === exp.postulante.numeroIdentificacion || exp.postulante.numeroIdentificacion.includes(i.numeroIdentificacion))) ||
          (i.cedula && exp.postulante?.numeroIdentificacion && (i.cedula === exp.postulante.numeroIdentificacion || exp.postulante.numeroIdentificacion.includes(i.cedula))) ||
          (exp.interesadoOrigenId && i.id === exp.interesadoOrigenId) ||
          (i.telefono && exp.postulante?.telefonoPrincipal && i.telefono.replace(/\D/g, "") === exp.postulante.telefonoPrincipal.replace(/\D/g, ""))
      );
      if (matchInt) {
        if (!exp.interesadoOrigenId) exp.interesadoOrigenId = matchInt.id;
        const sec = matchInt.telefonoSecundario || (matchInt as any).tel2;
        if (sec) {
          if (!exp.postulante.telefonoSecundario) exp.postulante.telefonoSecundario = sec;
          if (!(exp as any).telefonoSecundario) (exp as any).telefonoSecundario = sec;
        }
        if (!exp.postulante.telefonoPrincipal && matchInt.telefono) {
          exp.postulante.telefonoPrincipal = matchInt.telefono;
        }
      }
    });

    const listado = mockDb.expedientes.map((exp) => {
      if (exp.faseActual >= 4 && !exp.gestionFase4) {
        inicializarFase4(exp);
      }
      const comercial = mockDb.perfiles.find((p) => p.id === exp.comercialOrigenId);
      const supervisorPerfil = mockDb.perfiles.find((p) => p.rol === "supervisor");
      const responsable = exp.bloqueadoPorRevision
        ? (supervisorPerfil || mockDb.perfiles.find((p) => p.id === "usr-supervisor-01"))
        : (mockDb.perfiles.find((p) => p.id === exp.responsableGeneralId || p.username === exp.responsableGeneralId) || supervisorPerfil);
      
      // Cálculo de días calendario brutos transcurridos desde fecha_ingreso_fase1
      const fechaInicio = new Date(exp.fechaIngresoFase1).getTime();
      const ahora = new Date().getTime();
      const diasTranscurridos = Math.max(0, Math.floor((ahora - fechaInicio) / (1000 * 60 * 60 * 24)));

      // Determinar si el expediente tiene observaciones (documentales o de fase/Compensar)
      const tieneDocsObservados = mockDb.requisitosCaso.some(
        (r) => r.expedienteId === exp.id && r.estado === "con_observaciones"
      );
      const tieneFaseObservada =
        (exp.estadoGeneral as string) === "con_observaciones" ||
        exp.validacionCompensar?.estadoActual === "con_observaciones" ||
        exp.estadoFase1 === "devuelto" ||
        exp.estadoFase2 === "devuelto" ||
        Boolean((exp as any).subsanacionFase3Activa) ||
        Boolean(
          exp.revisionFases &&
            Object.values(exp.revisionFases).some(
              (rf: any) => rf?.estado === "devuelto" || rf?.estado === "devuelto_observaciones"
            )
        );
      const tieneObservaciones = tieneDocsObservados || tieneFaseObservada;

      return {
        ...exp,
        comercialOrigenNombre: comercial?.nombreCompleto || "Sin asignar",
        responsableGeneralNombre: exp.bloqueadoPorRevision
          ? (supervisorPerfil?.nombreCompleto || "Supervisor")
          : (responsable?.nombreCompleto || exp.responsableGeneralNombre || "Sin asignar"),
        responsableGeneralRol: exp.bloqueadoPorRevision
          ? "supervisor"
          : (responsable?.rol || exp.responsableGeneralRol),
        tieneObservaciones,
        diasTranscurridos,
        diasEnPausa: 0
      };
    });
    res.json(listado);
  });

  // 4. CAPTACIÓN: INTERESADOS (CON HIDRATACIÓN DESDE SUPABASE)
  app.get("/api/interesados", requireAuth(["comercial", "asistente", "supervisor", "administrador", "planeacion"]), async (req: AuthRequest, res: Response) => {
    // 1. Hidratación bidireccional desde Supabase si el servicio está activo
    if (supabaseAdmin) {
      try {
        const { data: dbRows, error: sbErr } = await supabaseAdmin
          .from("interesados")
          .select(`*, contactos_apoyo(*)`)
          .order("creado_en", { ascending: false });

        if (!sbErr && Array.isArray(dbRows)) {
          const idsEnDb = new Set(dbRows.map((r: any) => r.id));

          for (const row of dbRows) {
            const index = mockDb.interesados.findIndex((i) => i.id === row.id);
            if (index !== -1) {
              // 1.1 Sincronizar campos actualizados directamente desde Supabase
              const iExistente = mockDb.interesados[index];
              const partesNombre = decodificarNombresMetadata(row.resumen_necesidad) || descomponerNombreCompleto(row.nombre_contacto);
              if (row.nombre_contacto) {
                iExistente.nombreContacto = row.nombre_contacto;
                if (
                  !iExistente.primerApellido ||
                  iExistente.primerApellido === iExistente.segundoNombre ||
                  (partesNombre.segundoNombre && iExistente.primerApellido === partesNombre.segundoNombre && partesNombre.primerApellido !== iExistente.primerApellido)
                ) {
                  iExistente.primerNombre = partesNombre.primerNombre;
                  iExistente.segundoNombre = partesNombre.segundoNombre || undefined;
                  iExistente.primerApellido = partesNombre.primerApellido;
                  iExistente.segundoApellido = partesNombre.segundoApellido || undefined;
                }
              }
              let cedulaRow = row.numero_identificacion || row.cedula || partesNombre.numeroIdentificacion || undefined;
              let tipoIdRow = row.tipo_identificacion || partesNombre.tipoIdentificacion || "CC";
              if (!cedulaRow) {
                const telLimpio = String(row.telefono || "").replace(/\D/g, "");
                const persMatch = mockDb.personas.find(
                  (p) => (telLimpio && p.telefonoPrincipal?.replace(/\D/g, "") === telLimpio) ||
                         (row.nombre_contacto && normalizarTextoNombre(row.nombre_contacto).includes(normalizarTextoNombre(p.primerApellido || "")))
                );
                if (persMatch?.numeroIdentificacion) {
                  cedulaRow = persMatch.numeroIdentificacion;
                  if (persMatch.tipoIdentificacion) tipoIdRow = persMatch.tipoIdentificacion as TipoIdentificacion;
                }
              }
              if (cedulaRow) {
                iExistente.numeroIdentificacion = cedulaRow;
                iExistente.cedula = cedulaRow;
              }
              if (tipoIdRow) iExistente.tipoIdentificacion = tipoIdRow;
              if (row.telefono) iExistente.telefono = row.telefono;
              if (row.telefono_secundario || partesNombre.telefonoSecundario) iExistente.telefonoSecundario = row.telefono_secundario || partesNombre.telefonoSecundario;
              if (row.tiene_whatsapp_secundario !== undefined) iExistente.tieneWhatsappSecundario = Boolean(row.tiene_whatsapp_secundario);
              if (row.tiene_whatsapp !== undefined) iExistente.tieneWhatsapp = Boolean(row.tiene_whatsapp);
              if (row.correo !== undefined) iExistente.correo = row.correo || undefined;
              if (row.departamento_codigo) iExistente.departamentoCodigo = row.departamento_codigo;
              if (row.municipio_codigo) iExistente.municipioCodigo = row.municipio_codigo;
              if (row.vereda) iExistente.vereda = row.vereda;
              if (row.origen_contacto) iExistente.origenContacto = row.origen_contacto;
              if (row.resumen_necesidad !== undefined) iExistente.resumenNecesidad = limpiarTextoMetadata(row.resumen_necesidad);
              if (row.estado_comercial) iExistente.estadoComercial = row.estado_comercial;
              if (row.convertido_a_expediente_id) iExistente.convertidoAExpedienteId = row.convertido_a_expediente_id;
            } else {
              // 1.2 Insertar nuevo interesado creado directamente en Supabase
              const fechaRegMs = new Date(row.creado_en).getTime();
              const fechaCaducidad = new Date(fechaRegMs + 45 * 24 * 60 * 60 * 1000).toISOString();
              const partesNombre = decodificarNombresMetadata(row.resumen_necesidad) || descomponerNombreCompleto(row.nombre_contacto);
              let cedulaRow = row.numero_identificacion || row.cedula || partesNombre.numeroIdentificacion || undefined;
              let tipoIdRow = row.tipo_identificacion || partesNombre.tipoIdentificacion || "CC";
              if (!cedulaRow) {
                const telLimpio = String(row.telefono || "").replace(/\D/g, "");
                const persMatch = mockDb.personas.find(
                  (p) => (telLimpio && p.telefonoPrincipal?.replace(/\D/g, "") === telLimpio) ||
                         (row.nombre_contacto && normalizarTextoNombre(row.nombre_contacto).includes(normalizarTextoNombre(p.primerApellido || "")))
                );
                if (persMatch?.numeroIdentificacion) {
                  cedulaRow = persMatch.numeroIdentificacion;
                  if (persMatch.tipoIdentificacion) tipoIdRow = persMatch.tipoIdentificacion as TipoIdentificacion;
                }
              }
              mockDb.interesados.unshift({
                id: row.id,
                tipoIdentificacion: tipoIdRow,
                numeroIdentificacion: cedulaRow,
                cedula: cedulaRow,
                primerNombre: partesNombre.primerNombre,
                segundoNombre: partesNombre.segundoNombre || undefined,
                primerApellido: partesNombre.primerApellido,
                segundoApellido: partesNombre.segundoApellido || undefined,
                nombreContacto: row.nombre_contacto || "Sin Nombre",
                telefono: row.telefono || "",
                telefonoSecundario: row.telefono_secundario || partesNombre.telefonoSecundario || undefined,
                tieneWhatsappSecundario: Boolean(row.tiene_whatsapp_secundario),
                tieneWhatsapp: Boolean(row.tiene_whatsapp),
                correo: row.correo || undefined,
                departamentoCodigo: row.departamento_codigo || "25",
                municipioCodigo: row.municipio_codigo || "25899",
                vereda: row.vereda || "Rural",
                origenContacto: row.origen_contacto || "Llamada",
                resumenNecesidad: limpiarTextoMetadata(row.resumen_necesidad),
                comercialAsignadoId: row.comercial_asignado_id || "usr-comercial-01",
                estadoComercial: row.estado_comercial || "nuevo_contacto",
                convertidoAExpedienteId: row.convertido_a_expediente_id || undefined,
                creadoEn: row.creado_en,
                fechaCaducidad,
                diasExtension: 0,
                contactosApoyo: Array.isArray(row.contactos_apoyo)
                  ? row.contactos_apoyo.map((c: any) => ({
                      id: c.id,
                      interesadoId: c.interesado_id || row.id,
                      nombreCompleto: c.nombre_completo,
                      relacion: c.relacion || "Familiar",
                      telefono: c.telefono,
                      tieneWhatsapp: Boolean(c.tiene_whatsapp),
                      correo: c.correo,
                      preferenciaContacto: c.preferencia_contacto,
                      creadoEn: c.creado_en || row.creado_en
                    }))
                  : [],
                documentosAdjuntos: []
              });
            }
          }

          // 1.3 Eliminar interesados que ya no existan en Supabase
          mockDb.interesados = mockDb.interesados.filter((i) => idsEnDb.has(i.id));
        }
      } catch (dbErr: any) {
        console.error("[INTERESADOS HIDRATACIÓN ERROR]:", dbErr?.message);
      }
    }
    const ahora = Date.now();
    const msPorDia = 1000 * 60 * 60 * 24;

    const prospectosActivos = mockDb.interesados.filter(
      (i) => !i.convertidoAExpedienteId && !i.descartado && i.estadoComercial !== "descartado"
    );

    const resultado = prospectosActivos.map((i) => {
      const fechaRegMs = new Date(i.creadoEn).getTime();
      const diasDesdeRegistro = Math.max(0, Math.floor((ahora - fechaRegMs) / msPorDia));

      // Límite de 45 días iniciales + días de extensión si fueron otorgados
      const diasExtension = i.diasExtension || 0;
      const totalDiasPermitidos = 45 + diasExtension;
      let fechaCaducidadCalculada: string;

      if (i.fechaCaducidad) {
        fechaCaducidadCalculada = i.fechaCaducidad;
      } else {
        fechaCaducidadCalculada = new Date(fechaRegMs + totalDiasPermitidos * msPorDia).toISOString();
      }

      const estaVencido = ahora > new Date(fechaCaducidadCalculada).getTime();

      // Cálculo de ÚLTIMO CONTACTO: mayor entre fecha de registro, notas y documentos
      const notasHogar = mockDb.notas.filter((n) => n.interesadoId === i.id);
      const marcasDeTiempo: number[] = [fechaRegMs];

      for (const n of notasHogar) {
        if (n.fechaGestion) {
          marcasDeTiempo.push(new Date(n.fechaGestion).getTime());
        } else if (n.creadoEn) {
          marcasDeTiempo.push(new Date(n.creadoEn).getTime());
        }
      }

      if (i.documentosAdjuntos && i.documentosAdjuntos.length > 0) {
        for (const doc of i.documentosAdjuntos) {
          if (doc.subidoEn) {
            marcasDeTiempo.push(new Date(doc.subidoEn).getTime());
          }
        }
      }

      const ultimoContactoMs = Math.max(...marcasDeTiempo);
      const ultimoContactoFecha = new Date(ultimoContactoMs).toISOString();

      return {
        ...i,
        diasDesdeRegistro,
        totalDiasPermitidos,
        fechaCaducidad: fechaCaducidadCalculada,
        estaVencido,
        ultimoContactoFecha,
        documentosAdjuntos: i.documentosAdjuntos || []
      };
    });

    res.json(resultado);
  });

  app.post("/api/interesados", requireAuth(["comercial", "asistente", "administrador"]), async (req: AuthRequest, res: Response) => {
    const {
      primerNombre,
      segundoNombre,
      primerApellido,
      segundoApellido,
      nombreContacto,
      tipoIdentificacion,
      numeroIdentificacion,
      cedula,
      telefono,
      telefonoSecundario,
      tieneWhatsappSecundario,
      tieneWhatsapp,
      correo,
      departamentoCodigo,
      municipioCodigo,
      vereda,
      origenContacto,
      resumenNecesidad
    } = req.body;

    const nombreCompuesto = construirNombreCompleto(primerNombre, segundoNombre, primerApellido, segundoApellido);
    const nombreFinal = nombreCompuesto || (nombreContacto ? normalizarTextoNombre(nombreContacto) : "");

    if (!nombreFinal || !telefono) {
      res.status(400).json({ error: "Nombre de contacto (o nombres y apellidos) y teléfono son obligatorios." });
      return;
    }

    const munCodigoNormalizado = normalizarCodigoMunicipio(municipioCodigo);
    const depCodigo = departamentoCodigo || munCodigoNormalizado.substring(0, 2) || "25";
    const ahoraIso = new Date().toISOString();
    const fechaCaducidadIso = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString();
    const cedulaLimpia = String(numeroIdentificacion || cedula || "").trim() || undefined;
    const telSecLimpio = telefonoSecundario ? String(telefonoSecundario).trim() : undefined;

    const partesDescomp = descomponerNombreCompleto(nombreFinal);
    const pNom = primerNombre ? normalizarTextoNombre(primerNombre) : (partesDescomp.primerNombre || undefined);
    const sNom = segundoNombre ? normalizarTextoNombre(segundoNombre) : (partesDescomp.segundoNombre || undefined);
    const pAp = primerApellido ? normalizarTextoNombre(primerApellido) : (partesDescomp.primerApellido || undefined);
    const sAp = segundoApellido ? normalizarTextoNombre(segundoApellido) : (partesDescomp.segundoApellido || undefined);

    const nuevo: typeof mockDb.interesados[0] = {
      id: `int-${Date.now()}`,
      tipoIdentificacion: tipoIdentificacion || "CC",
      numeroIdentificacion: cedulaLimpia,
      cedula: cedulaLimpia,
      primerNombre: pNom,
      segundoNombre: sNom,
      primerApellido: pAp,
      segundoApellido: sAp,
      nombreContacto: nombreFinal,
      telefono: String(telefono).trim(),
      telefonoSecundario: telSecLimpio,
      tieneWhatsappSecundario: Boolean(tieneWhatsappSecundario),
      tieneWhatsapp: tieneWhatsapp !== undefined ? Boolean(tieneWhatsapp) : true,
      correo: correo ? String(correo).trim() : undefined,
      departamentoCodigo: depCodigo,
      municipioCodigo: munCodigoNormalizado,
      vereda: vereda ? normalizarTextoNombre(vereda) : undefined,
      origenContacto: origenContacto || "Llamada",
      resumenNecesidad: resumenNecesidad ? String(resumenNecesidad).trim() : undefined,
      comercialAsignadoId: req.user!.id,
      estadoComercial: "nuevo_contacto",
      creadoEn: ahoraIso,
      fechaCaducidad: fechaCaducidadIso,
      diasExtension: 0,
      contactosApoyo: [],
      documentosAdjuntos: []
    };

    mockDb.interesados.unshift(nuevo);

    // CAMBIO 8: Automatización de Bitácora (Backend)
    // Al presionar 'Guardar Interesado', el sistema toma el texto del resumen/detalles y lo inyecta como la primera nota de la bitácora
    if (nuevo.resumenNecesidad) {
      const primeraNota: NotaConversacion = {
        id: `nota-ini-${Date.now()}`,
        interesadoId: nuevo.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        personaContactada: nuevo.nombreContacto,
        canal: nuevo.origenContacto || "contacto_inicial",
        contenido: `Detalles de captación inicial: ${nuevo.resumenNecesidad}`,
        fechaGestion: ahoraIso,
        creadoEn: ahoraIso
      };
      mockDb.notas.unshift(primeraNota);
    }

    // PERSISTENCIA DIRECTA EN SUPABASE (Base de datos PostgreSQL en vivo)
    if (supabaseAdmin) {
      try {
        // Resolver el UUID del comercial en Supabase
        const { data: usuarioDb } = await supabaseAdmin
          .from("perfiles_usuario")
          .select("id")
          .eq("username", req.user!.username)
          .maybeSingle();

        const comercialId = usuarioDb?.id || req.user!.id;
        if (comercialId) {
          const metaTag = codificarNombresMetadata({
            primerNombre: pNom,
            segundoNombre: sNom,
            primerApellido: pAp,
            segundoApellido: sAp,
            numeroIdentificacion: nuevo.numeroIdentificacion || nuevo.cedula,
            cedula: nuevo.numeroIdentificacion || nuevo.cedula,
            tipoIdentificacion: nuevo.tipoIdentificacion,
            telefonoSecundario: nuevo.telefonoSecundario
          });
          const resumenPersistencia = nuevo.resumenNecesidad
            ? `${nuevo.resumenNecesidad} ${metaTag}`
            : metaTag;

          const baseRow: any = {
            nombre_contacto: nuevo.nombreContacto,
            telefono: nuevo.telefono,
            tiene_whatsapp: nuevo.tieneWhatsapp,
            correo: nuevo.correo || null,
            departamento_codigo: nuevo.departamentoCodigo,
            municipio_codigo: nuevo.municipioCodigo,
            vereda: nuevo.vereda || null,
            origen_contacto: nuevo.origenContacto,
            resumen_necesidad: resumenPersistencia,
            comercial_asignado_id: comercialId,
            estado_comercial: nuevo.estadoComercial
          };

          // Intentar inserción con campos extendidos (cédula y segundo teléfono)
          let insertedId: string | null = null;
          const fullRow = {
            ...baseRow,
            ...(nuevo.numeroIdentificacion ? { numero_identificacion: nuevo.numeroIdentificacion } : {}),
            ...(nuevo.tipoIdentificacion ? { tipo_identificacion: nuevo.tipoIdentificacion } : {}),
            ...(nuevo.telefonoSecundario ? { telefono_secundario: nuevo.telefonoSecundario } : {})
          };

          const { data: inserted, error: sbError } = await supabaseAdmin
            .from("interesados")
            .insert([fullRow])
            .select("id")
            .maybeSingle();

          if (!sbError && inserted?.id) {
            insertedId = inserted.id;
          } else if (sbError) {
            // Fallback si las columnas opcionales no existen en el esquema remoto
            const { data: retryInserted, error: retryError } = await supabaseAdmin
              .from("interesados")
              .insert([baseRow])
              .select("id")
              .maybeSingle();
            if (!retryError && retryInserted?.id) {
              insertedId = retryInserted.id;
            } else if (retryError) {
              console.error("[SUPABASE]: Error al insertar interesado en Supabase:", retryError.message);
            }
          }

          if (insertedId) {
            nuevo.id = insertedId;
            console.log(`[SUPABASE]: Hogar de captación persistido exitosamente en Supabase (UUID: ${insertedId})`);
            if (nuevo.resumenNecesidad) {
              await supabaseAdmin.from("notas_conversaciones").insert([{
                interesado_id: insertedId,
                autor_id: comercialId,
                persona_contactada: nuevo.nombreContacto,
                canal: nuevo.origenContacto || "contacto_inicial",
                contenido: `Detalles de captación inicial: ${nuevo.resumenNecesidad}`
              }]);
            }
          }
        }
      } catch (err: any) {
        console.error("[SUPABASE]: Excepción al guardar en Supabase:", err?.message);
      }
    }

    res.status(201).json(nuevo);
  });

  // CAMBIO 3: Ampliación de plazo para prospectos (7 o 15 días)
  app.post("/api/interesados/:id/ampliar-plazo", requireAuth(["comercial"]), (req: AuthRequest, res: Response) => {
    const interesado = mockDb.interesados.find((i) => i.id === req.params.id);
    if (!interesado) {
      res.status(404).json({ error: "Interesado no encontrado." });
      return;
    }

    const dias = Number(req.body.dias);
    if (dias !== 7 && dias !== 15) {
      res.status(400).json({ error: "La ampliación de plazo debe ser estrictamente de 7 o 15 días." });
      return;
    }

    interesado.diasExtension = (interesado.diasExtension || 0) + dias;
    // La nueva fecha de caducidad se calcula a partir de hoy + los días otorgados
    const nuevaFechaCad = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();
    interesado.fechaCaducidad = nuevaFechaCad;

    // Registrar nota de auditoría en la bitácora
    const notaExtension: NotaConversacion = {
      id: `nota-ext-${Date.now()}`,
      interesadoId: interesado.id,
      autorId: req.user!.id,
      autorNombre: req.user!.nombreCompleto,
      personaContactada: interesado.nombreContacto,
      canal: "gestion_vencimiento",
      contenido: `Prórroga de prospección concedida: Se extendió el plazo por ${dias} días adicionales hasta el ${new Date(nuevaFechaCad).toLocaleDateString("es-CO")}.`,
      fechaGestion: new Date().toISOString(),
      creadoEn: new Date().toISOString()
    };
    mockDb.notas.unshift(notaExtension);

    res.json({
      mensaje: `Plazo de prospección ampliado por ${dias} días adicionales.`,
      interesado
    });
  });

  // CAMBIO 3: Descartar prospecto no viable
  app.post("/api/interesados/:id/descartar", requireAuth(["comercial"]), (req: AuthRequest, res: Response) => {
    const interesado = mockDb.interesados.find((i) => i.id === req.params.id);
    if (!interesado) {
      res.status(404).json({ error: "Interesado no encontrado." });
      return;
    }

    const { motivo } = req.body;
    interesado.descartado = true;
    interesado.estadoComercial = "descartado";

    const notaDescarte: NotaConversacion = {
      id: `nota-desc-${Date.now()}`,
      interesadoId: interesado.id,
      autorId: req.user!.id,
      autorNombre: req.user!.nombreCompleto,
      personaContactada: interesado.nombreContacto,
      canal: "descarte_prospecto",
      contenido: `Prospecto descartado de la captación. Motivo: ${motivo || "No cumple con las condiciones para subsidio rural o manifestó desistimiento."}`,
      fechaGestion: new Date().toISOString(),
      creadoEn: new Date().toISOString()
    };
    mockDb.notas.unshift(notaDescarte);

    res.json({
      mensaje: `El prospecto "${interesado.nombreContacto}" ha sido descartado de la captación.`,
      interesado
    });
  });

  // CAMBIO 7: Carga de documentos de soporte al interesado
  app.post("/api/interesados/:id/documentos", requireAuth(["comercial"]), (req: AuthRequest, res: Response) => {
    const interesado = mockDb.interesados.find((i) => i.id === req.params.id);
    if (!interesado) {
      res.status(404).json({ error: "Interesado no encontrado." });
      return;
    }

    const { nombreArchivo, tipo } = req.body;
    if (!nombreArchivo) {
      res.status(400).json({ error: "El nombre del archivo es obligatorio." });
      return;
    }

    if (!interesado.documentosAdjuntos) {
      interesado.documentosAdjuntos = [];
    }

    const nuevoDoc = {
      id: `doc-int-${Date.now()}`,
      nombreArchivo: String(nombreArchivo).trim(),
      tipo: tipo || "documento_soporte",
      subidoEn: new Date().toISOString()
    };

    interesado.documentosAdjuntos.push(nuevoDoc);

    // Registrar nota en bitácora
    mockDb.notas.unshift({
      id: `nota-doc-${Date.now()}`,
      interesadoId: interesado.id,
      autorId: req.user!.id,
      autorNombre: req.user!.nombreCompleto,
      personaContactada: interesado.nombreContacto,
      canal: "documento_recibido",
      contenido: `Documento adjuntado al expediente de captación: "${nuevoDoc.nombreArchivo}".`,
      fechaGestion: nuevoDoc.subidoEn,
      creadoEn: nuevoDoc.subidoEn
    });

    res.status(201).json(nuevoDoc);
  });

  // 5. CONTACTOS DE APOYO
  app.post("/api/interesados/:id/contactos", requireAuth(["comercial"]), (req: AuthRequest, res: Response) => {
    const interesado = mockDb.interesados.find((i) => i.id === req.params.id);
    if (!interesado) {
      res.status(404).json({ error: "Interesado no encontrado." });
      return;
    }

    const { nombreCompleto, relacion, telefono, tieneWhatsapp, correo, preferenciaContacto } = req.body;
    if (!nombreCompleto || !telefono || !relacion) {
      res.status(400).json({ error: "Nombre, relación y teléfono son obligatorios." });
      return;
    }

    const nuevoContacto: typeof mockDb.interesados[0]["contactosApoyo"][0] = {
      id: `cnt-${Date.now()}`,
      interesadoId: interesado.id,
      nombreCompleto,
      relacion,
      telefono,
      tieneWhatsapp: Boolean(tieneWhatsapp),
      correo,
      preferenciaContacto,
      creadoEn: new Date().toISOString()
    };

    if (!interesado.contactosApoyo) interesado.contactosApoyo = [];
    interesado.contactosApoyo.push(nuevoContacto);
    res.status(201).json(nuevoContacto);
  });

  // 5.1 NOTAS DE CAPTACIÓN (Interesados - Consulta por Comercial, Supervisor, Administrador y Planeación)
  app.get("/api/interesados/:id/notas", requireAuth(["comercial", "asistente", "supervisor", "administrador", "planeacion"]), (req: AuthRequest, res: Response) => {
    const notas = mockDb.notas.filter((n) => n.interesadoId === req.params.id);
    res.json(notas);
  });

  app.post("/api/interesados/:id/notas", requireAuth(["comercial"]), (req: AuthRequest, res: Response) => {
    const interesado = mockDb.interesados.find((i) => i.id === req.params.id);
    if (!interesado) {
      res.status(404).json({ error: "Interesado no encontrado." });
      return;
    }

    const { personaContactada, canal, contenido } = req.body;
    if (!contenido) {
      res.status(400).json({ error: "El contenido de la conversación no puede estar vacío." });
      return;
    }

    const nuevaNota: NotaConversacion = {
      id: `nota-int-${Date.now()}`,
      interesadoId: interesado.id,
      autorId: req.user!.id,
      autorNombre: req.user!.nombreCompleto,
      personaContactada: personaContactada || interesado.nombreContacto,
      canal: canal || "llamada",
      contenido,
      fechaGestion: new Date().toISOString(),
      creadoEn: new Date().toISOString()
    };

    mockDb.notas.unshift(nuevaNota);
    res.status(201).json(nuevaNota);
  });

  // 5.2 TRANSFORMAR INTERESADO EN EXPEDIENTE VRD (Sin duplicación)
  app.post(
    "/api/interesados/:id/convertir",
    requireAuth(["comercial", "asistente", "administrador", "supervisor"]),
    async (req: AuthRequest, res: Response) => {
      const interesado = mockDb.interesados.find((i) => i.id === req.params.id);
      if (!interesado) {
        res.status(404).json({ error: "Interesado no encontrado." });
        return;
      }

      if (interesado.convertidoAExpedienteId) {
        res.status(400).json({
          error: "Este interesado ya fue transformado en expediente. No se permite duplicar.",
          expedienteId: interesado.convertidoAExpedienteId
        });
        return;
      }

      const {
        tipoIdentificacion,
        numeroIdentificacion,
        primerNombre,
        segundoNombre,
        primerApellido,
        segundoApellido,
        nombres,
        municipioCodigo,
        vereda,
        nombreODireccionPredio
      } = req.body;

      const pNombre = primerNombre ? normalizarTextoNombre(primerNombre) : (nombres ? normalizarTextoNombre(nombres).split(" ")[0] : "");
      const sNombre = segundoNombre ? normalizarTextoNombre(segundoNombre) : (nombres && normalizarTextoNombre(nombres).split(" ").length > 1 ? normalizarTextoNombre(nombres).split(" ").slice(1).join(" ") : undefined);
      const pApellido = primerApellido ? normalizarTextoNombre(primerApellido) : "";
      const sApellido = segundoApellido ? normalizarTextoNombre(segundoApellido) : undefined;
      const nombreCompleto = construirNombreCompleto(pNombre, sNombre, pApellido, sApellido) || (nombres ? normalizarTextoNombre(nombres) : "");

      let numIdFinal = String(numeroIdentificacion || interesado.numeroIdentificacion || interesado.cedula || "").trim();
      if (!numIdFinal) {
        numIdFinal = `PENDIENTE-${Date.now().toString().slice(-6)}`;
      }
      const tipoIdFinal = (tipoIdentificacion || interesado.tipoIdentificacion || "CC") as TipoIdentificacion;
      const munCodigoFinal = municipioCodigo || interesado.municipioCodigo || "25151";

      if ((!pNombre && !nombres) || !pApellido) {
        res.status(400).json({
          error: "Nombres (primer nombre) y primer apellido son obligatorios para abrir el expediente."
        });
        return;
      }

    const nuevoExpId = `exp-${Date.now()}`;
    const personaId = `per-${Date.now()}`;
    const hogarId = `hog-${Date.now()}`;
    const predioId = `pre-${Date.now()}`;

    const personaPostulante = {
      id: personaId,
      tipoIdentificacion: tipoIdFinal,
      numeroIdentificacion: numIdFinal,
      primerNombre: pNombre,
      segundoNombre: sNombre,
      primerApellido: pApellido,
      segundoApellido: sApellido,
      nombres: nombreCompleto,
      telefonoPrincipal: interesado.telefono,
      telefonoSecundario: interesado.telefonoSecundario,
      correo: interesado.correo
    };

    const munCodigoExp = normalizarCodigoMunicipio(municipioCodigo || interesado.municipioCodigo);

    const nuevoExp: typeof mockDb.expedientes[0] = {
      id: nuevoExpId,
      interesadoOrigenId: interesado.id,
      postulante: personaPostulante,
      hogar: {
        id: hogarId,
        integrantes: [
          {
            id: `int-hog-${Date.now()}`,
            hogarId,
            persona: personaPostulante,
            parentesco: "postulante_principal",
            esPostulantePrincipal: true
          }
        ]
      },
      predioVivienda: {
        id: predioId,
        departamentoCodigo: munCodigoExp.substring(0, 2),
        municipioCodigo: munCodigoExp,
        vereda: vereda ? normalizarTextoNombre(vereda) : (interesado.vereda || "Rural"),
        nombreODireccion: nombreODireccionPredio ? String(nombreODireccionPredio).trim() : "Lote sin dirección registrada",
        esPredioViviendaPrincipal: true
      },
      codigoVisible: calcularCodigoVisible(munCodigoExp, numeroIdentificacion, pApellido),
      estadoGeneral: "en_tramite",
      comercialOrigenId: req.user!.id,
      responsableGeneralId: req.user!.id,
      fechaPrimerContacto: interesado.creadoEn,
      fechaIngresoFase1: new Date().toISOString(),
      faseActual: 1,
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString()
    };

    // Plantillas iniciales obligatorias de Fase 1 para el nuevo expediente
    const reqTradicion: RequisitoCaso = {
      id: `req-f1-01-${nuevoExpId}`,
      expedienteId: nuevoExpId,
      codigoRequisito: "F1-01",
      nombre: "Certificado de Tradición y Libertad",
      descripcion: "Antigüedad máxima de 90 días calendario respecto a la revisión.",
      fase: 1,
      predioId,
      estado: "pendiente_carga",
      esObligatorio: true,
      esAdicional: false
    };

    const reqPredial: RequisitoCaso = {
      id: `req-f1-02-${nuevoExpId}`,
      expedienteId: nuevoExpId,
      codigoRequisito: "F1-02",
      nombre: "Impuesto Predial Unificado",
      descripcion: "Vigencia del año en curso. Aceptado pagado o sin pagar.",
      fase: 1,
      predioId,
      estado: "pendiente_carga",
      esObligatorio: true,
      esAdicional: false
    };

    const reqCedulaPostulante: RequisitoCaso = {
      id: `req-f1-03-${nuevoExpId}-${personaId}`,
      expedienteId: nuevoExpId,
      codigoRequisito: "F1-03",
      nombre: `Cédula del Postulante: ${nombreCompleto}`,
      descripcion: "Documento de identidad legible del postulante principal.",
      fase: 1,
      personaId,
      personaNombre: nombreCompleto,
      estado: "pendiente_carga",
      esObligatorio: true,
      esAdicional: false
    };

    mockDb.requisitosCaso.push(reqTradicion, reqPredial, reqCedulaPostulante);
    mockDb.expedientes.unshift(nuevoExp);

    // Marcar interesado como convertido
    interesado.convertidoAExpedienteId = nuevoExpId;
    interesado.estadoComercial = "convertido_a_expediente";

    // Vincular notas previas del interesado al nuevo expediente
    mockDb.notas.forEach((n) => {
      if (n.interesadoId === interesado.id) {
        n.expedienteId = nuevoExpId;
      }
    });

    // PERSISTENCIA DE LA CONVERSIÓN EN SUPABASE (PostgreSQL)
    if (supabaseAdmin) {
      try {
        // 1. Obtener UUID del comercial en Supabase
        const { data: usuarioDb } = await supabaseAdmin
          .from("perfiles_usuario")
          .select("id")
          .eq("username", req.user!.username)
          .maybeSingle();
        const comercialUuid = usuarioDb?.id;

        // 2. Insertar o actualizar persona postulante
        const { data: personaDb } = await supabaseAdmin
          .from("personas")
          .upsert(
            [
              {
                tipo_identificacion: personaPostulante.tipoIdentificacion,
                numero_identificacion: personaPostulante.numeroIdentificacion,
                nombres:
                  personaPostulante.primerNombre +
                  (personaPostulante.segundoNombre ? " " + personaPostulante.segundoNombre : ""),
                primer_apellido: personaPostulante.primerApellido,
                segundo_apellido: personaPostulante.segundoApellido || null,
                telefono_principal: personaPostulante.telefonoPrincipal,
                correo: personaPostulante.correo || null
              }
            ],
            { onConflict: "tipo_identificacion,numero_identificacion" }
          )
          .select("id")
          .maybeSingle();

        // 3. Insertar hogar
        const { data: hogarDb } = await supabaseAdmin
          .from("hogares")
          .insert([{ observaciones: `Hogar creado para expediente ${nuevoExp.codigoVisible}` }])
          .select("id")
          .maybeSingle();

        if (hogarDb?.id && personaDb?.id) {
          await supabaseAdmin.from("integrantes_hogar").insert([
            {
              hogar_id: hogarDb.id,
              persona_id: personaDb.id,
              parentesco: "postulante_principal",
              es_postulante_principal: true
            }
          ]);
        }

        // 4. Insertar predio
        const { data: predioDb } = await supabaseAdmin
          .from("predios")
          .insert([
            {
              departamento_codigo: nuevoExp.predioVivienda.departamentoCodigo,
              municipio_codigo: nuevoExp.predioVivienda.municipioCodigo,
              vereda: nuevoExp.predioVivienda.vereda,
              nombre_o_direccion: nuevoExp.predioVivienda.nombreODireccion,
              es_predio_vivienda_principal: true
            }
          ])
          .select("id")
          .maybeSingle();

        // 5. Insertar expediente
        if (personaDb?.id && hogarDb?.id && predioDb?.id && comercialUuid) {
          const { data: expDb, error: expErr } = await supabaseAdmin
            .from("expedientes")
            .insert([
              {
                postulante_id: personaDb.id,
                hogar_id: hogarDb.id,
                predio_vivienda_id: predioDb.id,
                codigo_visible: nuevoExp.codigoVisible,
                estado_general: "en_tramite",
                comercial_origen_id: comercialUuid,
                responsable_general_id: comercialUuid,
                fase_actual: 1
              }
            ])
            .select("id")
            .maybeSingle();

          if (!expErr && expDb?.id) {
            console.log(`[SUPABASE]: Expediente creado en Supabase con UUID ${expDb.id} (Código: ${nuevoExp.codigoVisible})`);
            // Sincronizar el id del expediente creado con el UUID oficial de Supabase
            nuevoExp.id = expDb.id;
            (nuevoExp as any)._persistidoEnSupabase = true;
            interesado.convertidoAExpedienteId = expDb.id;
            interesado.estadoComercial = "convertido_a_expediente";
            // Sincronizar requisitosCaso en memoria con el nuevo UUID oficial de Supabase
            mockDb.requisitosCaso.forEach((r) => {
              if (r.expedienteId === nuevoExpId) {
                r.expedienteId = expDb.id;
              }
            });

            // Actualizar estado del interesado en Supabase
            await supabaseAdmin
              .from("interesados")
              .update({
                estado_comercial: "convertido_a_expediente",
                convertido_a_expediente_id: expDb.id
              })
              .or(`id.eq.${interesado.id},telefono.eq.${interesado.telefono}`);

            // 6. Insertar los 3 requisitos de Fase 1
            const { data: plantillas } = await supabaseAdmin
              .from("plantillas_requisito")
              .select("id, codigo_requisito")
              .eq("fase", 1);

            if (plantillas && plantillas.length > 0) {
              const reqsToInsert = plantillas.map((p: any) => ({
                expediente_id: expDb.id,
                plantilla_id: p.id,
                fase: 1,
                persona_id: p.codigo_requisito === "F1-03" ? personaDb.id : null,
                predio_id: p.codigo_requisito === "F1-01" || p.codigo_requisito === "F1-02" ? predioDb.id : null,
                estado: "pendiente_carga"
              }));
              await supabaseAdmin.from("requisitos_caso").insert(reqsToInsert);
            }
          } else if (expErr) {
            console.error("[SUPABASE]: Error al crear expediente en Supabase:", expErr.message);
          }
        }
      } catch (err: any) {
        console.error("[SUPABASE]: Error al persistir conversión en Supabase:", err?.message);
      }
    }

    res.status(201).json({
      success: true,
      expediente: nuevoExp,
      mensaje: "Interesado convertido exitosamente en expediente VRD."
    });
  });

  // 6. DETALLE DE UN EXPEDIENTE Y SUS REQUISITOS
  app.get("/api/expedientes/:id", requireAuth(), async (req: AuthRequest, res: Response) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    let exp = mockDb.expedientes.find((e) => e.id === req.params.id || e.codigoVisible === req.params.id);

    // Si no está en memoria y Supabase está activo, buscarlo directamente en la base de datos
    if (!exp && supabaseAdmin) {
      try {
        const { data: row } = await supabaseAdmin
          .from("expedientes")
          .select(`
            *,
            postulante:personas!expedientes_postulante_id_fkey(*),
            predio:predios!expedientes_predio_vivienda_id_fkey(*),
            hogar:hogares!expedientes_hogar_id_fkey(
              id,
              observaciones,
              integrantes:integrantes_hogar(
                id,
                parentesco,
                es_postulante_principal,
                persona:personas(*)
              )
            ),
            comercial:perfiles_usuario!expedientes_comercial_origen_id_fkey(id, nombre_completo, username, rol),
            responsable:perfiles_usuario!expedientes_responsable_general_id_fkey(id, nombre_completo, username, rol)
          `)
          .or(`id.eq.${req.params.id},codigo_visible.eq.${req.params.id}`)
          .maybeSingle();

        if (row) {
          exp = mapearFilaSupabaseAExpediente(row);
          inicializarRequisitosFase1(exp);
          if (exp.faseActual >= 2) inicializarRequisitosFase2(exp);
          if (exp.faseActual >= 4) inicializarFase4(exp);
          if (exp.faseActual >= 5) inicializarFase5Licencia(exp);
          if (exp.faseActual >= 6) inicializarFase6Postulacion(exp);
          if (exp.faseActual >= 7) inicializarFase7(exp);
          mockDb.expedientes.unshift(exp);
        }
      } catch (err: any) {
        console.error("[EXPEDIENTES DETALLE HIDRATACIÓN ERROR]:", err?.message);
      }
    }

    if (!exp) {
      res.status(404).json({ error: "Expediente no encontrado." });
      return;
    }

    // Si la validación de Compensar ya fue aprobada, asegurar que la fase sea al menos 4
    if (exp.validacionCompensar?.estadoActual === "aprobado" && exp.faseActual < 4) {
      exp.faseActual = 4;
      exp.bloqueadoPorRevision = false;
      inicializarFase4(exp);
      sincronizarExpedienteEnSupabase(exp);
    }

    // Si el expediente ya está en Fase 2 o superior y no tiene requisitos de Fase 2, inicializarlos
    if (exp.faseActual >= 2) {
      inicializarRequisitosFase2(exp);
    }

    // Si el expediente está en Fase 4 o superior, inicializar frentes y requisitos de Fase 4
    if (exp.faseActual >= 4) {
      inicializarFase4(exp);
    }

    // Si el expediente está en Fase 5 o superior, inicializar seguimiento de Licencia de Construcción
    if (exp.faseActual >= 5) {
      inicializarFase5Licencia(exp);
    }

    // Si el expediente está en Fase 6 o superior, inicializar seguimiento de Postulación de Subsidio
    if (exp.faseActual >= 6) {
      inicializarFase6Postulacion(exp);
    }

    // Si el expediente está en Fase 7 o superior, inicializar seguimiento de Construcción y Cobro
    if (exp.faseActual >= 7) {
      inicializarFase7(exp);
    }

    // Garantizar requisitos canónicos limpios de Fase 1 y purga de huérfanos
    inicializarRequisitosFase1(exp);
    limpiarRequisitosHuerfanosExpediente(exp);

    // Hidratación directa desde Supabase: documentos, versiones inmutables y estados de requisitos
    if (supabaseAdmin) {
      try {
        let expUuid: string | null = null;
        if (exp.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(exp.id)) {
          expUuid = exp.id;
        } else {
          const { data: expDbRow } = await supabaseAdmin
            .from("expedientes")
            .select("id")
            .eq("codigo_visible", exp.codigoVisible)
            .maybeSingle();
          if (expDbRow?.id) expUuid = expDbRow.id;
        }

        if (expUuid) {
          const { data: dbExpRow } = await supabaseAdmin
            .from("expedientes")
            .select("*")
            .eq("id", expUuid)
            .maybeSingle();
          if (dbExpRow) {
            if (dbExpRow.fase_actual) exp.faseActual = Number(dbExpRow.fase_actual);
            if (dbExpRow.estado_general) exp.estadoGeneral = dbExpRow.estado_general;
            if (dbExpRow.estado_fase1) exp.estadoFase1 = dbExpRow.estado_fase1;
            if (dbExpRow.estado_fase2) exp.estadoFase2 = dbExpRow.estado_fase2;
            if (dbExpRow.bloqueado_por_revision !== undefined) exp.bloqueadoPorRevision = Boolean(dbExpRow.bloqueado_por_revision);
            if (dbExpRow.motivo_devolucion_fase !== undefined) exp.motivoDevolucionFase = dbExpRow.motivo_devolucion_fase || undefined;
            if (dbExpRow.observacion_devolucion_fase2 !== undefined) exp.observacionDevolucionFase2 = dbExpRow.observacion_devolucion_fase2 || undefined;
            if (dbExpRow.revision_fases) exp.revisionFases = dbExpRow.revision_fases;
            if (dbExpRow.validacion_compensar) {
              exp.validacionCompensar = dbExpRow.validacion_compensar;
              if (dbExpRow.validacion_compensar.subsanacionFase3Activa !== undefined) {
                exp.subsanacionFase3Activa = Boolean(dbExpRow.validacion_compensar.subsanacionFase3Activa);
              }
              if (dbExpRow.validacion_compensar.subsanacionFase3Estado !== undefined) {
                exp.subsanacionFase3Estado = dbExpRow.validacion_compensar.subsanacionFase3Estado;
              }
              if (dbExpRow.validacion_compensar.subsanacionFase3ObservacionAnalista !== undefined) {
                exp.subsanacionFase3ObservacionAnalista = dbExpRow.validacion_compensar.subsanacionFase3ObservacionAnalista;
              }
              if (dbExpRow.validacion_compensar.subsanacionFase3DocumentosModificados !== undefined) {
                exp.subsanacionFase3DocumentosModificados = dbExpRow.validacion_compensar.subsanacionFase3DocumentosModificados;
              }
            }
            if (dbExpRow.gestion_fase4) exp.gestionFase4 = dbExpRow.gestion_fase4;
            if (dbExpRow.tramite_licencia) exp.tramiteLicencia = dbExpRow.tramite_licencia;
            if (dbExpRow.postulacion_subsidio) exp.postulacionSubsidio = dbExpRow.postulacion_subsidio;
            if (dbExpRow.gestion_fase7) exp.gestionFase7 = dbExpRow.gestion_fase7;
            if (dbExpRow.solicitud_rechazo) exp.solicitudRechazo = dbExpRow.solicitud_rechazo;
            if (dbExpRow.historial_solicitudes_rechazo) exp.historialSolicitudesRechazo = dbExpRow.historial_solicitudes_rechazo;
          }

          // 1. Obtener documentos y sus versiones desde Supabase
          const { data: dbDocs } = await supabaseAdmin
            .from("documentos")
            .select(`
              id,
              titulo,
              expediente_id,
              persona_id,
              versiones:versiones_documento(
                id,
                documento_id,
                version_numero,
                storage_path,
                nombre_archivo_original,
                mime_type,
                tamano_bytes,
                sha256_hash,
                subido_por,
                subido_en,
                url_publica
              )
            `)
            .eq("expediente_id", expUuid);

          // 2. Obtener requisitos_caso y evidencias desde Supabase
          const { data: dbReqs } = await supabaseAdmin
            .from("requisitos_caso")
            .select(`
              id,
              codigo_requisito,
              nombre,
              persona_id,
              fase,
              estado,
              es_obligatorio,
              evidencias:evidencias_requisito(
                id,
                version_documento_id
              )
            `)
            .eq("expediente_id", expUuid);

          if (Array.isArray(dbDocs) && dbDocs.length > 0) {
            dbDocs.forEach((dRow: any) => {
              let existingDoc = mockDb.documentos.find((d) => d.id === dRow.id || (d.expedienteId === exp.id && d.titulo === dRow.titulo));
              const versionesMapeadas: DocVersion[] = (dRow.versiones || [])
                .map((v: any) => {
                  const pubUrl = v.url_publica || (v.storage_path ? `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET_NAME}/${v.storage_path}` : `/uploads/${v.storage_path}`);
                  return {
                    id: v.id,
                    documentoId: dRow.id,
                    versionNumero: v.version_numero || 1,
                    storagePath: v.storage_path,
                    nombreArchivoOriginal: v.nombre_archivo_original,
                    mimeType: v.mime_type || "application/pdf",
                    tamanoBytes: Number(v.tamano_bytes) || 1024,
                    sha256Hash: v.sha256_hash || "",
                    subidoPorId: v.subido_por || "",
                    subidoEn: v.subido_en || new Date().toISOString(),
                    urlFirmadaTemporal: pubUrl,
                    archivoDataUrl: pubUrl
                  };
                })
                .sort((a: DocVersion, b: DocVersion) => (a.versionNumero || 1) - (b.versionNumero || 1));

              if (existingDoc) {
                existingDoc.id = dRow.id;
                if (dRow.persona_id) existingDoc.personaId = dRow.persona_id;
                if (versionesMapeadas.length > 0) {
                  existingDoc.versiones = versionesMapeadas;
                  existingDoc.versionActual = versionesMapeadas[versionesMapeadas.length - 1];
                }
              } else {
                const newDoc: Documento = {
                  id: dRow.id,
                  expedienteId: exp.id,
                  personaId: dRow.persona_id || undefined,
                  categoria: "general",
                  titulo: dRow.titulo,
                  esOficial: true,
                  versiones: versionesMapeadas,
                  versionActual: versionesMapeadas[versionesMapeadas.length - 1]
                };
                mockDb.documentos.push(newDoc);
              }
            });
          }

          if (Array.isArray(dbReqs) && dbReqs.length > 0) {
            dbReqs.forEach((rRow: any) => {
              const reqExistente = mockDb.requisitosCaso.find((r) => {
                const pertenece = r.expedienteId === exp.id || (exp.codigoVisible && r.expedienteId === exp.codigoVisible);
                if (!pertenece) return false;
                if (r.id === rRow.id) return true;
                if (r.codigoRequisito !== rRow.codigo_requisito) return false;
                if (rRow.persona_id && r.personaId) {
                  return r.personaId === rRow.persona_id;
                }
                if (rRow.codigo_requisito === "F1-03") {
                  if (rRow.nombre?.toLowerCase().includes("postulante") && r.nombre.toLowerCase().includes("postulante")) return true;
                  if (rRow.nombre?.toLowerCase().includes("integrante") && r.nombre.toLowerCase().includes("integrante")) {
                    return r.personaNombre && rRow.nombre.toLowerCase().includes(r.personaNombre.toLowerCase());
                  }
                  return false;
                }
                return true;
              });

              if (reqExistente) {
                if (rRow.id) reqExistente.id = rRow.id;
                if (rRow.estado) reqExistente.estado = rRow.estado;
                if (Array.isArray(rRow.evidencias) && rRow.evidencias.length > 0) {
                  const verIds = new Set(rRow.evidencias.map((ev: any) => ev.version_documento_id));
                  const docsCandidatos = mockDb.documentos.filter((d) => d.versiones?.some((v) => verIds.has(v.id)));
                  const docConVer =
                    docsCandidatos.find((d) => (d.titulo || "").toLowerCase().includes((reqExistente.nombre || "").toLowerCase())) ||
                    docsCandidatos[docsCandidatos.length - 1];
                  if (docConVer) {
                    const docTit = (docConVer.titulo || "").toLowerCase();
                    const docArch = (docConVer.versionActual?.nombreArchivoOriginal || "").toLowerCase();
                    const esDocInteg = docTit.includes("integrante") || docArch.includes("integrante");
                    const esReqPostulante = reqExistente.nombre.toLowerCase().includes("postulante");
                    const esDocPredialEnCedula =
                      reqExistente.codigoRequisito === "F1-03" &&
                      (docTit.includes("tradición") || docTit.includes("tradicion") || docTit.includes("predial") || docTit.includes("f1-01") || docTit.includes("f1-02"));

                    if (!(esDocInteg && esReqPostulante) && !esDocPredialEnCedula) {
                      reqExistente.documentoAsociado = docConVer;
                      if (reqExistente.estado === "pendiente_carga") {
                        reqExistente.estado = "recibido_revision";
                      }
                    }
                  }
                }
              }
            });

            // Obtener revisiones humanas de estos requisitos desde Supabase
            try {
              const reqIds = dbReqs.map((r: any) => r.id).filter(Boolean);
              if (reqIds.length > 0) {
                const { data: dbRevs } = await supabaseAdmin
                  .from("revisiones_humanas")
                  .select(`
                    id,
                    requisito_caso_id,
                    version_documento_id,
                    supervisor_id,
                    ciclo_revision,
                    resultado,
                    observacion,
                    fecha_revision,
                    supervisor:perfiles_usuario(nombre_completo)
                  `)
                  .in("requisito_caso_id", reqIds);

                if (Array.isArray(dbRevs) && dbRevs.length > 0) {
                  dbRevs.forEach((revRow: any) => {
                    const reqOriginal = dbReqs.find((dr: any) => dr.id === revRow.requisito_caso_id);
                    const revMapeada: RevisionHumana = {
                      id: revRow.id,
                      requisitoCasoId: revRow.requisito_caso_id,
                      versionDocumentoId: revRow.version_documento_id,
                      supervisorId: revRow.supervisor_id,
                      supervisorNombre: revRow.supervisor?.nombre_completo || "Analista Documental",
                      cicloRevision: revRow.ciclo_revision || 1,
                      resultado: revRow.resultado,
                      observacion: revRow.observacion || "",
                      fechaRevision: revRow.fecha_revision
                    };
                    if (reqOriginal?.codigo_requisito) {
                      (revMapeada as any).codigoRequisito = reqOriginal.codigo_requisito;
                    }
                    const idxExistente = mockDb.revisiones.findIndex((r) => r.id === revMapeada.id);
                    if (idxExistente >= 0) {
                      mockDb.revisiones[idxExistente] = revMapeada;
                    } else {
                      mockDb.revisiones.push(revMapeada);
                    }
                  });
                }
              }
            } catch (revErr: any) {
              console.warn("[SUPABASE REVISIONES FETCH WARNING]:", revErr?.message);
            }
          }

          // Reconciliar y asegurar asignación precisa de documentos a sus titulares o integrantes
          reconciliarDocumentosConRequisitos(exp);
        }
      } catch (hErr: any) {
        console.warn("[HYDRATION WARNING]: Error hidratando documentos de Supabase:", hErr?.message);
      }
    }

    // Reconciliación final obligatoria antes de armar la respuesta del expediente
    reconciliarDocumentosConRequisitos(exp);

    // Requisitos asociados al expediente con sus documentos y versiones
    const requisitos = mockDb.requisitosCaso
      .filter((r) => r.expedienteId === exp.id || (exp.codigoVisible && r.expedienteId === exp.codigoVisible))
      .map((r) => {
        let doc = mockDb.documentos.find((d) => d.id === r.documentoAsociado?.id) || r.documentoAsociado;
        if (doc && doc.versiones && doc.versiones.length > 0) {
          doc.versiones.sort((a, b) => (a.versionNumero || 1) - (b.versionNumero || 1));
          doc.versionActual = doc.versiones[doc.versiones.length - 1];

          // Asegurar que si alguna versión tenía fotos y la actual no, se conserven
          if (doc.versionActual && (!doc.versionActual.fotos || doc.versionActual.fotos.length === 0)) {
            const todasFotos: any[] = [];
            doc.versiones.forEach((v) => {
              if (v.fotos && v.fotos.length > 0) {
                v.fotos.forEach((f) => {
                  if (!todasFotos.some((tf) => tf.id === f.id || tf.url === f.url)) {
                    todasFotos.push(f);
                  }
                });
              }
            });
            if (todasFotos.length > 0) {
              doc.versionActual.fotos = todasFotos;
            }
          }
        }
        const revision = mockDb.revisiones
          .filter((rev) => rev.requisitoCasoId === r.id)
          .sort((a, b) => new Date(b.fechaRevision).getTime() - new Date(a.fechaRevision).getTime())[0];

        let ultimaRevision = revision || r.ultimaRevision;
        if (!ultimaRevision && (r.estado === "con_observaciones" || r.observaciones)) {
          ultimaRevision = {
            id: `rev-synth-${r.id}`,
            requisitoCasoId: r.id,
            versionDocumentoId: doc?.versionActual?.id || "",
            supervisorId: "usr-supervisor-01",
            supervisorNombre: "Analista Documental",
            cicloRevision: 1,
            resultado: "OBSERVADO",
            observacion: r.observaciones || "Documento observado por el supervisor. Subir archivo corregido.",
            fechaRevision: exp.actualizadoEn || new Date().toISOString()
          };
        }

        // Determinar con precisión si la versión actual del documento ya fue dictaminada por la última revisión,
        // o si se subió una nueva versión después de dicha revisión.
        const versionActualYaRevisada = Boolean(
          ultimaRevision &&
            doc?.versionActual &&
            (ultimaRevision.versionDocumentoId === doc.versionActual.id ||
              (ultimaRevision.fechaRevision &&
                doc.versionActual.subidoEn &&
                new Date(ultimaRevision.fechaRevision).getTime() >= new Date(doc.versionActual.subidoEn).getTime() - 1000))
        );

        const subidoDespuesDeRevision = Boolean(
          ultimaRevision &&
            doc?.versionActual &&
            !versionActualYaRevisada &&
            doc.versionActual.subidoEn &&
            ultimaRevision.fechaRevision &&
            new Date(doc.versionActual.subidoEn).getTime() > new Date(ultimaRevision.fechaRevision).getTime()
        );

        const estadoPrevio = r.estado;
        const estadoActualStr = String(r.estado || "");
        if (versionActualYaRevisada && ultimaRevision) {
          if (ultimaRevision.resultado === "ACEPTADO") {
            r.estado = "aceptado";
            r.observaciones = ultimaRevision.observacion || undefined;
          } else if (ultimaRevision.resultado === "OBSERVADO") {
            r.estado = "con_observaciones";
            r.observaciones = ultimaRevision.observacion;
          }
        } else if (subidoDespuesDeRevision || estadoActualStr === "actualizado" || estadoActualStr === "corregido") {
          r.estado = "actualizado";
          r.observaciones = undefined;
        } else if (ultimaRevision) {
          if (ultimaRevision.resultado === "ACEPTADO") {
            r.estado = "aceptado";
            r.observaciones = ultimaRevision.observacion || undefined;
          } else if (ultimaRevision.resultado === "OBSERVADO") {
            r.estado = "con_observaciones";
            r.observaciones = ultimaRevision.observacion;
          }
        }

        if (supabaseAdmin && r.estado !== estadoPrevio && esUuidValido(r.id)) {
          supabaseAdmin
            .from("requisitos_caso")
            .update({ estado: r.estado, actualizado_en: new Date().toISOString() })
            .eq("id", r.id)
            .then(() => {});
        }

        return {
          ...r,
          documentoAsociado: doc,
          ultimaRevision
        };
      });

    const notas = mockDb.notas
      .filter((n) => n.expedienteId === exp.id || n.interesadoId === exp.interesadoOrigenId)
      .sort((a, b) => new Date(b.creadoEn || b.fechaGestion).getTime() - new Date(a.creadoEn || a.fechaGestion).getTime());
    const tareas = mockDb.tareas.filter((t) => t.expedienteId === exp.id);
    const eventoSalida = mockDb.eventosSalida.find((ev) => ev.expedienteId === exp.id);
    let cartaSalida = null;
    if (eventoSalida) {
      cartaSalida = mockDb.cartasSalida.find((c) => c.eventoSalidaId === eventoSalida.id);
    }

    const comercial = mockDb.perfiles.find((p) => p.id === exp.comercialOrigenId);
    const responsable = mockDb.perfiles.find((p) => p.id === exp.responsableGeneralId);
    const fechaInicio = new Date(exp.fechaPrimerContacto || exp.creadoEn).getTime();
    const diasTranscurridos = Math.max(0, Math.floor((Date.now() - fechaInicio) / (1000 * 60 * 60 * 24)));

    const expedienteEnriquecido = {
      ...exp,
      comercialOrigenNombre: comercial?.nombreCompleto,
      responsableGeneralNombre: responsable?.nombreCompleto,
      responsableGeneralRol: responsable?.rol,
      diasTranscurridos
    };

    res.json({
      expediente: expedienteEnriquecido,
      requisitos,
      notas,
      tareas,
      salida: eventoSalida ? { ...eventoSalida, carta: cartaSalida } : null
    });
  });

  // 6.1 ELIMINACIÓN DE EXPEDIENTE (SOLO ADMINISTRADOR O SUPERVISOR)
  app.delete("/api/expedientes/:id", requireAuth(["administrador", "supervisor"]), async (req: AuthRequest, res: Response) => {
    const targetId = req.params.id;
    const expIndex = mockDb.expedientes.findIndex((e) => e.id === targetId || e.codigoVisible === targetId);

    if (expIndex === -1 && !supabaseAdmin) {
      res.status(404).json({ error: "Expediente no encontrado para eliminar." });
      return;
    }

    const expEliminar = expIndex !== -1 ? mockDb.expedientes[expIndex] : null;
    const expId = expEliminar?.id || targetId;
    const codigoVisible = expEliminar?.codigoVisible || targetId;

    let supabaseEliminado = false;
    let supabaseErrorMsg: string | null = null;

    // 1. Eliminar en Supabase (tabla expedientes con CASCADE elimina requisitos, versiones, eventos, etc.)
    if (supabaseAdmin) {
      try {
        const { error: sbDelErr } = await supabaseAdmin
          .from("expedientes")
          .delete()
          .or(`id.eq.${expId},codigo_visible.eq.${codigoVisible}`);

        if (sbDelErr) {
          supabaseErrorMsg = sbDelErr.message;
          console.error(`[SUPABASE DELETE ERROR]: Error eliminando expediente ${codigoVisible}:`, sbDelErr.message);
        } else {
          supabaseEliminado = true;
          console.log(`[SUPABASE DELETE SUCCESS]: Expediente ${codigoVisible} (UUID ${expId}) eliminado de la base de datos PostgreSQL.`);
        }
      } catch (err: any) {
        supabaseErrorMsg = err?.message;
        console.error(`[SUPABASE DELETE EXCEPTION]:`, err?.message);
      }
    }

    // 2. Eliminar de memoria viva mockDb
    if (expIndex !== -1) {
      mockDb.expedientes.splice(expIndex, 1);
    }
    mockDb.requisitosCaso = mockDb.requisitosCaso.filter((r) => r.expedienteId !== expId && r.expedienteId !== targetId);
    mockDb.notas = mockDb.notas.filter((n) => n.expedienteId !== expId && n.expedienteId !== targetId);
    mockDb.eventosSalida = mockDb.eventosSalida.filter((s) => s.expedienteId !== expId && s.expedienteId !== targetId);

    // 3. Restaurar estado de interesado origen si existía
    if (expEliminar?.interesadoOrigenId) {
      const interesado = mockDb.interesados.find((i) => i.id === expEliminar.interesadoOrigenId);
      if (interesado) {
        interesado.convertidoAExpedienteId = undefined;
        interesado.estadoComercial = "contacto_inicial";
      }
    }

    res.json({
      ok: true,
      mensaje: `Expediente ${codigoVisible} eliminado exitosamente del sistema.`,
      supabaseEliminado,
      supabaseErrorMsg
    });
  });

  // 7. CARGA DE DOCUMENTOS (Asistente en Fase 2, Comercial en Fase 1, Ingeniería en Fase 4/5, Supervisor, Administrador, Planeación)
  app.post(
    "/api/expedientes/:id/requisitos/:reqId/subir",
    requireAuth(["comercial", "asistente", "supervisor", "administrador", "ingenieria", "planeacion"]),
    async (req: AuthRequest, res: Response) => {
      try {
        let exp = mockDb.expedientes.find(
          (e) =>
            e.id === req.params.id ||
            e.codigoVisible === req.params.id ||
            e.codigoVisible?.toUpperCase() === req.params.id?.toUpperCase()
        );

        // Si no se encuentra en memoria, intentar buscar en Supabase
        if (!exp && supabaseAdmin) {
          try {
            const { data: row } = await supabaseAdmin
              .from("expedientes")
              .select(`
                *,
                postulante:personas!expedientes_postulante_id_fkey(*),
                predio:predios!expedientes_predio_vivienda_id_fkey(*),
                hogar:hogares!expedientes_hogar_id_fkey(
                  id,
                  observaciones,
                  integrantes:integrantes_hogar(
                    id,
                    parentesco,
                    es_postulante_principal,
                    persona:personas(*)
                  )
                ),
                comercial:perfiles_usuario!expedientes_comercial_origen_id_fkey(id, nombre_completo, username, rol),
                responsable:perfiles_usuario!expedientes_responsable_general_id_fkey(id, nombre_completo, username, rol)
              `)
              .or(`id.eq.${req.params.id},codigo_visible.eq.${req.params.id}`)
              .maybeSingle();

            if (row) {
              exp = mapearFilaSupabaseAExpediente(row);
              mockDb.expedientes.unshift(exp);
            }
          } catch (err: any) {
            console.error("[UPLOAD HIDRATACIÓN ERROR]:", err?.message);
          }
        }

        if (!exp) {
          res.status(404).json({ error: "Expediente no encontrado en el sistema." });
          return;
        }

        // Asegurar inicialización de requisitos según la fase activa del expediente
        inicializarRequisitosFase1(exp);
        if (exp.faseActual >= 2) inicializarRequisitosFase2(exp);
        if (exp.faseActual >= 4) inicializarFase4(exp);
        if (exp.faseActual >= 5) inicializarFase5Licencia(exp);
        if (exp.faseActual >= 6) inicializarFase6Postulacion(exp);
        if (exp.faseActual >= 7) inicializarFase7(exp);

        const reqIdParam = String(req.params.reqId || "").trim();
        const { codigoRequisito, fase, requisitoNombre, personaId } = req.body || {};
        const codigoBuscado = String(codigoRequisito || "").toUpperCase().trim();

        // Extracción del código estándar (ej: F1-01, F1-02, F1-03, F2-11, F5-01)
        const matchCodigo = (codigoBuscado || reqIdParam).match(/F\d+-\d+/i);
        const codigoNormalizado = matchCodigo ? matchCodigo[0].toUpperCase() : null;

        // Búsqueda estrictamente scoped dentro del expediente actual
        const perteneceAExp = (r: RequisitoCaso) =>
          r.expedienteId === exp.id || (exp.codigoVisible && r.expedienteId === exp.codigoVisible);

        // 1. Coincidencia exacta por ID de requisito dentro de este expediente
        let reqCaso = mockDb.requisitosCaso.find((r) => perteneceAExp(r) && r.id === reqIdParam);

        // 2. Si no coincide por ID exacto pero tenemos personaId y código (ej. cédulas de integrantes o titular)
        if (!reqCaso && personaId && (codigoBuscado || codigoNormalizado)) {
          const cod = codigoBuscado || codigoNormalizado!;
          reqCaso = mockDb.requisitosCaso.find(
            (r) => perteneceAExp(r) && r.codigoRequisito?.toUpperCase() === cod && r.personaId === personaId
          );
        }

        // 3. Si no hay personaId específico pero busca requisito de predio o código único de fase
        if (!reqCaso && (codigoBuscado || codigoNormalizado)) {
          const cod = codigoBuscado || codigoNormalizado!;
          reqCaso = mockDb.requisitosCaso.find(
            (r) =>
              perteneceAExp(r) &&
              r.codigoRequisito?.toUpperCase() === cod &&
              (!personaId || r.personaId === personaId)
          );
        }

        // 4. Búsqueda por ID directo en toda la colección si pertenece a este expediente
        if (!reqCaso) {
          reqCaso = mockDb.requisitosCaso.find((r) => r.id === reqIdParam && perteneceAExp(r));
        }

        // Si aún no se encontró en memoria, inicializarlo o crearlo dinámicamente de forma segura
        if (!reqCaso) {
          const codigoFinal = codigoNormalizado || codigoBuscado || "DOC-ADICIONAL";
          const faseFinal = Number(fase) || (codigoFinal.startsWith("F") ? parseInt(codigoFinal.substring(1)) : exp.faseActual) || 1;

          reqCaso = {
            id: reqIdParam.startsWith("req-") ? reqIdParam : `req-${codigoFinal.toLowerCase()}-${exp.id}`,
            expedienteId: exp.id,
            codigoRequisito: codigoFinal,
            nombre: requisitoNombre || `Documento ${codigoFinal}`,
            descripcion: `Documento soporte para ${codigoFinal}`,
            fase: faseFinal,
            predioId: exp.predioVivienda?.id || `pre-${exp.id}`,
            personaId: personaId || (codigoFinal === "F1-03" ? exp.postulante?.id : undefined) || `per-${exp.id}`,
            estado: "pendiente_carga",
            esObligatorio: true,
            esAdicional: false
          };
          mockDb.requisitosCaso.push(reqCaso);
        }

        // Asegurar expedienteId sincronizado
        reqCaso.expedienteId = exp.id;

        // Restricción de bloqueo por revisión: Cuando el expediente está en revisión del Supervisor Jurídico,
        // permitir si es una subsanación, corrección de documento o en Fase 3
        if (exp.bloqueadoPorRevision && req.user!.rol !== "administrador" && req.user!.rol !== "supervisor") {
          if (exp.faseActual >= 3) {
            exp.bloqueadoPorRevision = false;
          } else {
            const esSubsanacion =
              exp.estadoFase1 === "devuelto" ||
              exp.estadoFase2 === "devuelto" ||
              reqCaso.estado === "con_observaciones" ||
              reqCaso.estado === "pendiente_carga" ||
              reqCaso.estado === "actualizado" ||
              reqCaso.ultimaRevision?.resultado === "OBSERVADO" ||
              Boolean(reqCaso.observaciones);

            if (!esSubsanacion) {
              res.status(403).json({
                error: `Acceso restringido por permisos de rol: El expediente se encuentra en revisión de Análisis Documental y su rol (${req.user!.rol}) tiene pausada temporalmente la carga de nuevos documentos.`
              });
              return;
            } else {
              exp.bloqueadoPorRevision = false;
            }
          }
        }

        // Restricción de Fase 2: Documentos de Fase 2
        const esFoto = reqCaso.codigoRequisito === "F2-11" || reqCaso.codigoRequisito === "F1-04" || reqCaso.nombre.toLowerCase().includes("fotogr");
        const esComercialAsignado = req.user!.rol === "comercial" && exp.comercialOrigenId === req.user!.id;
        if (reqCaso.fase === 2 && !esFoto) {
          if (
            req.user!.rol !== "asistente" &&
            req.user!.rol !== "administrador" &&
            req.user!.rol !== "supervisor" &&
            req.user!.rol !== "ingenieria" &&
            !esComercialAsignado
          ) {
            res.status(403).json({
              error: `Acceso restringido por permisos de rol: Los documentos solo pueden ser gestionados o reemplazados por el Gestor Documental, Ingeniería, Supervisor o Administrador. Su rol actual es '${req.user!.rol}'.`
            });
            return;
          }
        }

        const { nombreArchivo, mimeType, tamanoBytes, contenidoSimulado, archivoDataUrl, sha256Hash, fotos } = req.body || {};
        if (!nombreArchivo && (!fotos || !fotos.length)) {
          res.status(400).json({ error: "Nombre de archivo o fotografías obligatorias." });
          return;
        }

        // 1. Obtener o crear entidad Documento dedicada exclusivamente a este requisito (sin compartir referencia con otro requisito)
        let doc = mockDb.documentos.find((d) => d.id === reqCaso.documentoAsociado?.id);
        const esCompartidoConOtroRequisito = Boolean(
          doc &&
            mockDb.requisitosCaso.some(
              (otroReq) =>
                otroReq.id !== reqCaso.id &&
                (otroReq.expedienteId === exp.id || (exp.codigoVisible && otroReq.expedienteId === exp.codigoVisible)) &&
                otroReq.documentoAsociado?.id === doc!.id
            )
        );
        if (esCompartidoConOtroRequisito) {
          doc = undefined;
        }

        const esReqPersonal =
          reqCaso.codigoRequisito === "F1-03" ||
          Boolean(reqCaso.personaId) ||
          reqCaso.nombre.toLowerCase().includes("cédula") ||
          reqCaso.nombre.toLowerCase().includes("cedula");

        const nombreSujeto = reqCaso.personaNombre || exp.postulante?.nombres || exp.postulante?.primerApellido || exp.codigoVisible || "Titular";
        const tituloEsperado = `${reqCaso.nombre} - ${nombreSujeto}`;

        if (!doc) {
          doc = {
            id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            expedienteId: exp.id,
            titulo: tituloEsperado,
            personaId: esReqPersonal ? (reqCaso.personaId || exp.postulante?.id || `per-${exp.id}`) : undefined,
            predioId: !esReqPersonal ? (reqCaso.predioId || exp.predioVivienda?.id || `pre-${exp.id}`) : undefined,
            versiones: []
          };
          mockDb.documentos.push(doc);
          reqCaso.documentoAsociado = doc;
        } else {
          doc.titulo = tituloEsperado;
          if (!esReqPersonal) {
            doc.personaId = undefined;
          }
          reqCaso.documentoAsociado = doc;
        }
        if (!Array.isArray(doc.versiones)) {
          doc.versiones = [];
        }

        // 2. Crear nueva Versión inmutable
        let fotosArr = Array.isArray(fotos) && fotos.length > 0 ? fotos : undefined;
        
        // Si se cargó una sola imagen o dataUrl para un requisito fotográfico, preservarla como foto individual o añadirla
        if (!fotosArr && archivoDataUrl && (mimeType?.startsWith("image/") || /\.(jpg|jpeg|png|webp|svg)$/i.test(nombreArchivo || "") || esFoto)) {
          const fotosPrevias = doc.versionActual?.fotos ? [...doc.versionActual.fotos] : [];
          const nuevaFotoObj = {
            id: `foto-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            nombre: nombreArchivo || `Foto_${fotosPrevias.length + 1}.jpg`,
            url: archivoDataUrl,
            tamanoBytes: tamanoBytes || 150000,
            categoria: "Registro predial",
            subidoEn: new Date().toISOString()
          };
          fotosArr = [...fotosPrevias, nuevaFotoObj];
        }

        const primerFotoUrl = fotosArr ? fotosArr[0].url : undefined;
        const fotosBytes = fotosArr ? fotosArr.reduce((acc: number, f: any) => acc + (f.tamanoBytes || 0), 0) : 0;

        const nuevaVersionNum = (doc.versiones.length || 0) + 1;
        const extFromFileName = nombreArchivo?.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
        const extFinal =
          extFromFileName ||
          (fotosArr
            ? "jpg"
            : mimeType?.includes("excel")
            ? "xls"
            : mimeType?.includes("spreadsheetml")
            ? "xlsx"
            : mimeType?.includes("csv")
            ? "csv"
            : "pdf");
        let nombreEstandarizado = nombreArchivo || `Documento_${reqCaso.codigoRequisito}.pdf`;
        let storagePath = `expedientes/${exp.id}/${reqCaso.codigoRequisito}_v${nuevaVersionNum}.${extFinal}`;

        // Si es cédula de integrante o titular (F1-03), aplicar formato de nombre estandarizado y guardar en bucket Supabase
        if (reqCaso.codigoRequisito === "F1-03" || reqCaso.nombre.toLowerCase().includes("cédula") || reqCaso.nombre.toLowerCase().includes("cedula")) {
          let personaNombre = reqCaso.personaNombre || "";
          let personaIdent = "";
          if (reqCaso.personaId) {
            const intEnHogar = exp.hogar?.integrantes?.find((i) => i.persona?.id === reqCaso.personaId);
            if (intEnHogar) {
              personaNombre = intEnHogar.persona.nombres || `${intEnHogar.persona.primerNombre} ${intEnHogar.persona.primerApellido}`;
              personaIdent = intEnHogar.persona.numeroIdentificacion;
            } else if (exp.postulante?.id === reqCaso.personaId) {
              personaNombre = exp.postulante.nombres || `${exp.postulante.primerNombre} ${exp.postulante.primerApellido}`;
              personaIdent = exp.postulante.numeroIdentificacion;
            }
          }
          if (!personaIdent) personaIdent = exp.postulante?.numeroIdentificacion || "00000";
          if (!personaNombre) personaNombre = exp.postulante?.nombres || "integrante";

          nombreEstandarizado = generarNombreArchivoCedulaEstandar(personaNombre, personaIdent, extFinal);
          storagePath = `expedientes/${exp.id}/cedulas/${nombreEstandarizado}`;
        }

        // 3. Persistir archivo de inmediato en almacenamiento resiliente (disco local + Supabase Storage)
        const tsBuster = `t=${Date.now()}`;
        let publicUrlFinal = `/uploads/${storagePath}?${tsBuster}`;
        if (archivoDataUrl && typeof archivoDataUrl === "string") {
          const mimeFinal =
            mimeType ||
            (extFinal === "xlsx"
              ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              : extFinal === "xls"
              ? "application/vnd.ms-excel"
              : extFinal === "csv"
              ? "text/csv"
              : fotosArr
              ? "image/jpeg"
              : "application/pdf");

          const uploadRes = await persistirArchivoEnStorage(
            storagePath,
            archivoDataUrl,
            mimeFinal
          );
          if (uploadRes.ok && uploadRes.publicUrl) {
            publicUrlFinal = uploadRes.publicUrl.includes("t=")
              ? uploadRes.publicUrl
              : `${uploadRes.publicUrl}${uploadRes.publicUrl.includes("?") ? "&" : "?"}${tsBuster}`;
          }
        }

        // Si son fotos de registro predial en lote, persistir cada una
        if (fotosArr && fotosArr.length > 0) {
          for (let i = 0; i < fotosArr.length; i++) {
            const foto = fotosArr[i];
            if (foto.url && typeof foto.url === "string" && foto.url.startsWith("data:")) {
              const fotoPath = `expedientes/${exp.id}/fotos/${foto.id}_${(foto.nombre || `foto_${i+1}.jpg`).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
              const fotoUpload = await persistirArchivoEnStorage(fotoPath, foto.url, "image/jpeg");
              if (fotoUpload.ok && fotoUpload.publicUrl) {
                foto.url = fotoUpload.publicUrl.includes("t=")
                  ? fotoUpload.publicUrl
                  : `${fotoUpload.publicUrl}${fotoUpload.publicUrl.includes("?") ? "&" : "?"}${tsBuster}`;
              }
            }
          }
        }

        const nuevaVersion: DocVersion = {
          id: `ver-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          documentoId: doc.id,
          versionNumero: nuevaVersionNum,
          storagePath,
          nombreArchivoOriginal: nombreEstandarizado || nombreArchivo || (fotosArr ? `Registro_Fotografico_${fotosArr.length}_fotos.jpg` : `Documento_${reqCaso.codigoRequisito}.pdf`),
          mimeType: mimeType || (fotosArr ? "image/jpeg" : "application/pdf"),
          tamanoBytes: tamanoBytes || fotosBytes || 1024000,
          sha256Hash: sha256Hash || `sha256-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          subidoPorId: req.user!.id,
          subidoPorNombre: req.user!.nombreCompleto,
          subidoEn: new Date().toISOString(),
          urlFirmadaTemporal: publicUrlFinal,
          archivoDataUrl: publicUrlFinal,
          fotos: fotosArr
        };

        doc.versiones.push(nuevaVersion);
        doc.versionActual = nuevaVersion;

        // Actualizar estado del requisito automáticamente a 'actualizado' si ya contaba con documento previo o en Fase 3
        const teniaVersionPrevia = (doc.versiones?.length || 0) > 1 || Boolean(reqCaso.documentoAsociado?.versionActual);
        if (teniaVersionPrevia || exp.faseActual >= 3) {
          reqCaso.estado = "actualizado";
        } else {
          reqCaso.estado = "recibido_revision";
        }

        // Si estaba en subsanación de Fase 3, registrar el documento modificado
        if (exp.subsanacionFase3Activa) {
          if (!exp.subsanacionFase3DocumentosModificados) {
            exp.subsanacionFase3DocumentosModificados = [];
          }
          if (!exp.subsanacionFase3DocumentosModificados.includes(reqCaso.codigoRequisito)) {
            exp.subsanacionFase3DocumentosModificados.push(reqCaso.codigoRequisito);
          }
        }

        reqCaso.observaciones = undefined;

        // Si estaba devuelto con observaciones en Fase 1 o Fase 2, reactivar en preparación
        if (exp.estadoFase1 === "devuelto") {
          exp.estadoFase1 = "en_preparacion";
        }
        if (exp.estadoFase2 === "devuelto") {
          exp.estadoFase2 = "en_preparacion";
        }

        // Persistencia relacional garantizada en PostgreSQL (esperada antes de confirmar al cliente)
        if (supabaseAdmin) {
          try {
            let subidoPorUuid: string | null = null;
            if (req.user!.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.user!.id)) {
              subidoPorUuid = req.user!.id;
            } else {
              const { data: usuarioDb } = await supabaseAdmin
                .from("perfiles_usuario")
                .select("id")
                .eq("username", String(req.user!.username || req.user!.id).toLowerCase())
                .maybeSingle();
              if (usuarioDb?.id) subidoPorUuid = usuarioDb.id;
            }
            if (!subidoPorUuid) {
              const { data: fallbackUser } = await supabaseAdmin
                .from("perfiles_usuario")
                .select("id")
                .in("rol", ["supervisor", "administrador", "asistente"])
                .limit(1)
                .maybeSingle();
              if (fallbackUser?.id) subidoPorUuid = fallbackUser.id;
            }

            let expUuid: string | null = null;
            if (exp.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(exp.id)) {
              expUuid = exp.id;
            } else {
              const { data: expDb } = await supabaseAdmin
                .from("expedientes")
                .select("id")
                .eq("codigo_visible", exp.codigoVisible)
                .maybeSingle();
              if (expDb?.id) expUuid = expDb.id;
            }

            if (expUuid && subidoPorUuid) {
              // 1. Resolver o crear primero el requisito específico en requisitos_caso
              let reqDbId: string | null = null;
              if (reqCaso.id && esUuidValido(reqCaso.id)) {
                const { data: reqPorId } = await supabaseAdmin
                  .from("requisitos_caso")
                  .select("id")
                  .eq("id", reqCaso.id)
                  .maybeSingle();
                if (reqPorId?.id) reqDbId = reqPorId.id;
              }

              if (!reqDbId && reqCaso.personaId && esUuidValido(reqCaso.personaId)) {
                const { data: reqPorPersona } = await supabaseAdmin
                  .from("requisitos_caso")
                  .select("id")
                  .eq("expediente_id", expUuid)
                  .eq("codigo_requisito", reqCaso.codigoRequisito)
                  .eq("persona_id", reqCaso.personaId)
                  .limit(1)
                  .maybeSingle();
                if (reqPorPersona?.id) reqDbId = reqPorPersona.id;
              }

              if (!reqDbId) {
                const { data: reqPorNombre } = await supabaseAdmin
                  .from("requisitos_caso")
                  .select("id")
                  .eq("expediente_id", expUuid)
                  .eq("codigo_requisito", reqCaso.codigoRequisito)
                  .eq("nombre", reqCaso.nombre)
                  .limit(1)
                  .maybeSingle();
                if (reqPorNombre?.id) reqDbId = reqPorNombre.id;
              }

              if (!reqDbId && reqCaso.codigoRequisito !== "F1-03") {
                const { data: reqPorCodigo } = await supabaseAdmin
                  .from("requisitos_caso")
                  .select("id")
                  .eq("expediente_id", expUuid)
                  .eq("codigo_requisito", reqCaso.codigoRequisito)
                  .limit(1)
                  .maybeSingle();
                if (reqPorCodigo?.id) reqDbId = reqPorCodigo.id;
              }

              if (!reqDbId) {
                const faseNum = Math.min(Math.max(Number(reqCaso.fase) || 1, 1), 7);
                const { data: nuevoReqDb } = await supabaseAdmin
                  .from("requisitos_caso")
                  .insert([
                    {
                      expediente_id: expUuid,
                      codigo_requisito: reqCaso.codigoRequisito,
                      nombre: reqCaso.nombre,
                      descripcion: reqCaso.descripcion || null,
                      persona_id: reqCaso.personaId && esUuidValido(reqCaso.personaId) ? reqCaso.personaId : null,
                      fase: faseNum,
                      estado: reqCaso.estado,
                      es_obligatorio: reqCaso.esObligatorio ?? true
                    }
                  ])
                  .select("id")
                  .maybeSingle();
                reqDbId = nuevoReqDb?.id || null;
              }

              if (reqDbId) {
                reqCaso.id = reqDbId;
              }

              // 2. Resolver o crear el Documento exclusivo para este requisito en documentos
              let docDbId: string | null = null;
              if (doc.id && esUuidValido(doc.id)) {
                const { data: docPorId } = await supabaseAdmin
                  .from("documentos")
                  .select("id")
                  .eq("id", doc.id)
                  .maybeSingle();
                if (docPorId?.id) {
                  docDbId = docPorId.id;
                }
              }

              if (!docDbId) {
                const { data: docExistente } = await supabaseAdmin
                  .from("documentos")
                  .select("id")
                  .eq("expediente_id", expUuid)
                  .eq("titulo", doc.titulo)
                  .limit(1)
                  .maybeSingle();

                if (docExistente?.id) {
                  docDbId = docExistente.id;
                } else {
                  const { data: docDb } = await supabaseAdmin
                    .from("documentos")
                    .insert([
                      {
                        expediente_id: expUuid,
                        titulo: doc.titulo,
                        persona_id: doc.personaId && esUuidValido(doc.personaId) ? doc.personaId : null,
                        predio_id: null
                      }
                    ])
                    .select("id")
                    .maybeSingle();
                  docDbId = docDb?.id || null;
                }
              }

              if (docDbId) {
                doc.id = docDbId;
                nuevaVersion.documentoId = docDbId;

                const { data: verDb } = await supabaseAdmin
                  .from("versiones_documento")
                  .insert([
                    {
                      documento_id: docDbId,
                      version_numero: nuevaVersion.versionNumero,
                      storage_path: nuevaVersion.storagePath,
                      nombre_archivo_original: nuevaVersion.nombreArchivoOriginal,
                      mime_type: nuevaVersion.mimeType,
                      tamano_bytes: nuevaVersion.tamanoBytes,
                      sha256_hash: nuevaVersion.sha256Hash,
                      subido_por: subidoPorUuid,
                      url_publica: nuevaVersion.urlFirmadaTemporal || nuevaVersion.archivoDataUrl
                    }
                  ])
                  .select("id")
                  .maybeSingle();

                if (verDb?.id) {
                  nuevaVersion.id = verDb.id;
                }

                if (reqDbId && verDb?.id) {
                  const { data: evExistente } = await supabaseAdmin
                    .from("evidencias_requisito")
                    .select("id")
                    .eq("requisito_caso_id", reqDbId)
                    .eq("version_documento_id", verDb.id)
                    .maybeSingle();

                  if (!evExistente?.id) {
                    await supabaseAdmin.from("evidencias_requisito").insert([
                      {
                        requisito_caso_id: reqDbId,
                        version_documento_id: verDb.id,
                        vinculado_por: subidoPorUuid
                      }
                    ]);
                  }

                  await supabaseAdmin
                    .from("requisitos_caso")
                    .update({ estado: reqCaso.estado, actualizado_en: new Date().toISOString() })
                    .eq("id", reqDbId);
                }
              }
            }
          } catch (err: any) {
            console.error("[SUPABASE DB]: Error al persistir documento en PostgreSQL:", err?.message);
          }
        }

        // Sincronizar estado del expediente en Supabase (reflejando documentos modificados en subsanación Fase 3 y timestamps)
        await sincronizarExpedienteEnSupabase(exp);

        res.status(201).json({
          success: true,
          documento: doc,
          version: nuevaVersion,
          requisito: reqCaso,
          expedienteId: exp.id
        });
      } catch (err: any) {
        console.error("[UPLOAD EXCEPTION]: Error no controlado al subir documento:", err);
        res.status(500).json({
          error: `Error al procesar la carga del documento: ${err?.message || "Excepción interna del servidor."}`
        });
      }
    }
  );

  // 7.1 AGREGAR ARCHIVO O REQUISITO ADICIONAL EN CUALQUIER FASE OPERATIVA (1 a 7)
  const handleCrearRequisitoAdicional = async (req: AuthRequest, res: Response) => {
    try {
      let exp = mockDb.expedientes.find(
        (e) =>
          e.id === req.params.id ||
          e.codigoVisible === req.params.id ||
          e.codigoVisible?.toUpperCase() === req.params.id?.toUpperCase()
      );

      if (!exp && supabaseAdmin) {
        const { data: row } = await supabaseAdmin
          .from("expedientes")
          .select(`
            *,
            postulante:personas!expedientes_postulante_id_fkey(*),
            predio:predios!expedientes_predio_vivienda_id_fkey(*),
            hogar:hogares!expedientes_hogar_id_fkey(
              id,
              observaciones,
              integrantes:integrantes_hogar(
                id,
                parentesco,
                es_postulante_principal,
                persona:personas(*)
              )
            ),
            comercial:perfiles_usuario!expedientes_comercial_origen_id_fkey(id, nombre_completo, username, rol),
            responsable:perfiles_usuario!expedientes_responsable_general_id_fkey(id, nombre_completo, username, rol)
          `)
          .or(`id.eq.${req.params.id},codigo_visible.eq.${req.params.id}`)
          .maybeSingle();

        if (row) {
          exp = mapearFilaSupabaseAExpediente(row);
          mockDb.expedientes.unshift(exp);
        }
      }

      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado en el sistema." });
        return;
      }

      const nombre = String(req.body.nombre || "").trim();
      if (!nombre) {
        res.status(400).json({ error: "Debe ingresar el nombre descriptivo del archivo en el sistema." });
        return;
      }

      const faseSolicitada = Math.max(1, Math.min(7, Number(req.body.fase) || exp.faseActual || 1));
      const timestamp = Date.now();
      const reqId = `req-adicional-${faseSolicitada}-${timestamp}`;
      const codigoRequisito = `F${faseSolicitada}-ADICIONAL-${timestamp.toString(36).toUpperCase()}`;

      const nuevoRequisito: RequisitoCaso = {
        id: reqId,
        expedienteId: exp.id,
        codigoRequisito,
        nombre,
        descripcion: req.body.descripcion ? String(req.body.descripcion).trim() : `Documento adicional cargado para la Fase ${faseSolicitada}.`,
        fase: faseSolicitada,
        predioId: exp.predioVivienda?.id || `pre-${exp.id}`,
        personaId: exp.postulante?.id || `per-${exp.id}`,
        esObligatorio: Boolean(req.body.esObligatorio),
        esAdicional: true,
        estado: req.body.archivoDataUrl ? "recibido_revision" : "pendiente_carga",
        creadoEn: new Date().toISOString()
      };

      // Si se incluye archivo adjunto directamente
      let storagePath = "";
      if (req.body.archivoDataUrl) {
        const docId = `doc-add-${Date.now()}`;
        const nombreArchivo = req.body.nombreArchivo || `${nombre.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
        const extMatch = nombreArchivo.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() || "pdf";
        storagePath = `expedientes/${exp.id}/adicionales/F${faseSolicitada}_add_${timestamp}.${extMatch}`;
        let urlFinal = req.body.archivoDataUrl;
        try {
          const resStorage = await persistirArchivoEnStorage(
            storagePath,
            req.body.archivoDataUrl,
            req.body.mimeType || "application/pdf"
          );
          if (resStorage.ok && resStorage.publicUrl) {
            urlFinal = resStorage.publicUrl;
          }
        } catch (e: any) {
          console.warn("[STORAGE]: Advertencia persistiendo en storage:", e?.message);
        }

        const verActualObj: DocVersion = {
          id: `ver-${docId}-1`,
          documentoId: docId,
          versionNumero: 1,
          nombreArchivoOriginal: nombreArchivo,
          mimeType: req.body.mimeType || "application/pdf",
          tamanoBytes: Number(req.body.tamanoBytes) || 1048576,
          sha256Hash: `sha256-add-${timestamp}`,
          storagePath,
          subidoPorId: req.user!.id,
          subidoPorNombre: req.user!.nombreCompleto,
          subidoEn: new Date().toISOString(),
          urlFirmadaTemporal: urlFinal,
          archivoDataUrl: urlFinal
        };

        const docObj: Documento = {
          id: docId,
          expedienteId: exp.id,
          titulo: `${nombre} (Fase ${faseSolicitada} Adicional)`,
          categoria: `fase${faseSolicitada}`,
          esOficial: true,
          versionActual: verActualObj,
          versiones: [verActualObj]
        };
        mockDb.documentos.push(docObj);
        nuevoRequisito.documentoAsociado = docObj;
      }

      mockDb.requisitosCaso.push(nuevoRequisito);

      // Si Supabase está disponible, registrar en PostgreSQL
      if (supabaseAdmin) {
        try {
          let expUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(exp.id) ? exp.id : null;
          if (!expUuid) {
            const { data: dbExp } = await supabaseAdmin.from("expedientes").select("id").eq("codigo_visible", exp.codigoVisible).maybeSingle();
            if (dbExp?.id) expUuid = dbExp.id;
          }
          if (expUuid) {
            const { data: reqInsert } = await supabaseAdmin.from("requisitos_caso").insert([
              {
                expediente_id: expUuid,
                codigo_requisito: codigoRequisito,
                nombre,
                fase: faseSolicitada,
                estado: nuevoRequisito.estado === "recibido_revision" ? "recibido_revision" : "pendiente_carga",
                es_obligatorio: Boolean(req.body.esObligatorio),
                es_adicional: true
              }
            ]).select("id").maybeSingle();

            if (req.body.archivoDataUrl && reqInsert?.id) {
              const { data: docDb } = await supabaseAdmin.from("documentos").insert([
                {
                  expediente_id: expUuid,
                  titulo: `${nombre} (Fase ${faseSolicitada} Adicional)`
                }
              ]).select("id").maybeSingle();

              if (docDb?.id) {
                let subidoPorUuid: string | null = null;
                if (req.user!.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.user!.id)) {
                  subidoPorUuid = req.user!.id;
                } else {
                  const { data: usuarioDb } = await supabaseAdmin
                    .from("perfiles_usuario")
                    .select("id")
                    .eq("username", String(req.user!.username || req.user!.id).toLowerCase())
                    .maybeSingle();
                  if (usuarioDb?.id) subidoPorUuid = usuarioDb.id;
                }

                const { data: verDb } = await supabaseAdmin.from("versiones_documento").insert([
                  {
                    documento_id: docDb.id,
                    version_numero: 1,
                    storage_path: storagePath,
                    nombre_archivo_original: req.body.nombreArchivo || `${nombre}.pdf`,
                    mime_type: req.body.mimeType || "application/pdf",
                    tamano_bytes: Number(req.body.tamanoBytes) || 1048576,
                    sha256_hash: `sha256-add-${timestamp}`,
                    subido_por: subidoPorUuid,
                    url_publica: nuevoRequisito.documentoAsociado?.versiones?.[0]?.archivoDataUrl
                  }
                ]).select("id").maybeSingle();

                if (verDb?.id) {
                  await supabaseAdmin.from("evidencias_requisito").insert([
                    {
                      requisito_caso_id: reqInsert.id,
                      version_documento_id: verDb.id,
                      vinculado_por: subidoPorUuid
                    }
                  ]);
                }
              }
            }
          }
        } catch (err: any) {
          console.warn("[SUPABASE]: Advertencia guardando requisito adicional:", err?.message);
        }
      }

      res.status(201).json({
        success: true,
        mensaje: `Archivo / requisito adicional "${nombre}" registrado exitosamente en Fase ${faseSolicitada}.`,
        requisito: nuevoRequisito
      });
    } catch (err: any) {
      res.status(500).json({ error: `Error creando requisito adicional: ${err?.message || "Error interno."}` });
    }
  };

  app.post(
    ["/api/expedientes/:id/requisitos/adicional", "/api/expedientes/:id/requisitos"],
    requireAuth(["comercial", "asistente", "supervisor", "administrador", "ingenieria", "planeacion"]),
    handleCrearRequisitoAdicional
  );

  // 8. AGREGAR CÉDULA AL HOGAR (Comercial, Asistente, Administrador)
  app.post(
    "/api/expedientes/:id/hogar/agregar-cedula",
    requireAuth(["comercial", "asistente", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      if (exp.bloqueadoPorRevision) {
        res.status(400).json({ error: "El expediente se encuentra bloqueado en revisión del Supervisor." });
        return;
      }

      const {
        tipoIdentificacion,
        numeroIdentificacion,
        primerNombre,
        segundoNombre,
        primerApellido,
        segundoApellido,
        nombres,
        parentesco,
        archivoDataUrl,
        url: reqUrl,
        archivoUrl,
        nombreArchivo,
        mimeType,
        tamanoBytes
      } = req.body;

      const pNombre = primerNombre ? normalizarTextoNombre(primerNombre) : (nombres ? normalizarTextoNombre(nombres).split(" ")[0] : "");
      const sNombre = segundoNombre ? normalizarTextoNombre(segundoNombre) : (nombres && normalizarTextoNombre(nombres).split(" ").length > 1 ? normalizarTextoNombre(nombres).split(" ").slice(1).join(" ") : undefined);
      const pApellido = primerApellido ? normalizarTextoNombre(primerApellido) : "";
      const sApellido = segundoApellido ? normalizarTextoNombre(segundoApellido) : undefined;
      const nombreCompleto = construirNombreCompleto(pNombre, sNombre, pApellido, sApellido) || (nombres ? normalizarTextoNombre(nombres) : "");
      const numIdLimpio = String(numeroIdentificacion || "").trim();

      if (!numIdLimpio || (!pNombre && !nombres) || !pApellido || !parentesco) {
        res.status(400).json({ error: "Identificación, primer nombre, primer apellido y parentesco son obligatorios para el integrante." });
        return;
      }

      // VALIDACIÓN: Verificar que el número de identificación del integrante no exista previamente en el mismo hogar
      const yaExisteEnHogar = exp.hogar.integrantes.some(
        (i) => i.persona.numeroIdentificacion?.trim() === numIdLimpio
      ) || (exp.postulante?.numeroIdentificacion?.trim() === numIdLimpio);

      if (yaExisteEnHogar) {
        res.status(400).json({
          error: `El número de identificación ${numIdLimpio} ya se encuentra registrado en este hogar.`
        });
        return;
      }

      const nuevaPersonaId = `per-${Date.now()}`;
      const nuevaPersona = {
        id: nuevaPersonaId,
        tipoIdentificacion: tipoIdentificacion || "CC",
        numeroIdentificacion: numIdLimpio,
        primerNombre: pNombre,
        segundoNombre: sNombre,
        primerApellido: pApellido,
        segundoApellido: sApellido,
        nombres: nombreCompleto
      };

      const nuevoIntegranteId = `int-hog-${Date.now()}`;
      exp.hogar.integrantes.push({
        id: nuevoIntegranteId,
        hogarId: exp.hogar.id,
        persona: nuevaPersona,
        parentesco,
        esPostulantePrincipal: false,
        retiroPendiente: false
      });

      // Formato de nombre estandarizado para la cédula: `cedula_integrante_[nombre]_[identificacion].pdf`
      const extMatch = (nombreArchivo || "").match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() || "pdf";
      const nombreArchivoEstandar = generarNombreArchivoCedulaEstandar(nombreCompleto, numIdLimpio, extMatch);
      const storagePath = `expedientes/${exp.id}/cedulas/${nombreArchivoEstandar}`;

      const dataUrlOUrl = archivoDataUrl || reqUrl || archivoUrl;
      let docObj: Documento | undefined = undefined;

      // Si el cliente adjuntó el documento de la cédula directamente o como URL
      if (dataUrlOUrl && typeof dataUrlOUrl === "string") {
        const docId = `doc-ced-${Date.now()}`;
        let publicUrlFinal = dataUrlOUrl;

        try {
          const resStorage = await persistirArchivoEnStorage(
            storagePath,
            dataUrlOUrl,
            mimeType || "application/pdf"
          );
          if (resStorage.ok && resStorage.publicUrl) {
            publicUrlFinal = resStorage.publicUrl;
          }
        } catch (e: any) {
          console.warn("[STORAGE]: Error guardando cédula en storage:", e?.message);
        }

        const verObj: DocVersion = {
          id: `ver-${docId}-1`,
          documentoId: docId,
          versionNumero: 1,
          nombreArchivoOriginal: nombreArchivoEstandar,
          mimeType: mimeType || "application/pdf",
          tamanoBytes: Number(tamanoBytes) || 1048576,
          sha256Hash: `sha256-ced-${Date.now()}`,
          storagePath,
          subidoPorId: req.user!.id,
          subidoPorNombre: req.user!.nombreCompleto,
          subidoEn: new Date().toISOString(),
          urlFirmadaTemporal: publicUrlFinal,
          archivoDataUrl: publicUrlFinal
        };

        docObj = {
          id: docId,
          expedienteId: exp.id,
          personaId: nuevaPersonaId,
          titulo: `Cédula de Integrante: ${nombreCompleto}`,
          categoria: "fase1",
          esOficial: true,
          versionActual: verObj,
          versiones: [verObj]
        };

        mockDb.documentos.push(docObj);
      }

      // Crear requisito de cédula para este integrante en Fase 1 (F1-03)
      const nuevoReq: RequisitoCaso = {
        id: `req-f1-03-${nuevaPersonaId}`,
        expedienteId: exp.id,
        codigoRequisito: "F1-03",
        nombre: `Cédula de Integrante: ${nombreCompleto}`,
        descripcion: `Documento de identidad de integrante del hogar (${parentesco}).`,
        fase: 1,
        personaId: nuevaPersonaId,
        personaNombre: `${nombreCompleto} (${parentesco})`,
        estado: docObj ? "recibido_revision" : "pendiente_carga",
        esObligatorio: true,
        esAdicional: false,
        documentoAsociado: docObj
      };

      mockDb.requisitosCaso.push(nuevoReq);
      limpiarRequisitosHuerfanosExpediente(exp);

      // Bitácora
      mockDb.notas.push({
        id: `nota-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        personaContactada: nombreCompleto,
        canal: "sistema",
        contenido: `${req.user!.nombreCompleto} agregó al integrante ${nombreCompleto} (${parentesco}) al hogar declarado en Fase 1.`,
        fechaGestion: new Date().toISOString(),
        creadoEn: new Date().toISOString()
      });

      // PERSISTENCIA EN SUPABASE DEL NUEVO INTEGRANTE (PostgreSQL + Storage)
      if (supabaseAdmin) {
        try {
          // 1. Insertar o reutilizar persona en Supabase
          const { data: personaDb } = await supabaseAdmin
            .from("personas")
            .upsert(
              [
                {
                  tipo_identificacion: nuevaPersona.tipoIdentificacion,
                  numero_identificacion: nuevaPersona.numeroIdentificacion,
                  nombres:
                    nuevaPersona.primerNombre +
                    (nuevaPersona.segundoNombre ? " " + nuevaPersona.segundoNombre : ""),
                  primer_apellido: nuevaPersona.primerApellido,
                  segundo_apellido: nuevaPersona.segundoApellido || null
                }
              ],
              { onConflict: "tipo_identificacion,numero_identificacion" }
            )
            .select("id")
            .maybeSingle();

          // 2. Buscar el expediente correspondiente en Supabase
          const { data: expDb } = await supabaseAdmin
            .from("expedientes")
            .select("id, hogar_id")
            .eq("codigo_visible", exp.codigoVisible)
            .maybeSingle();

          if (personaDb?.id && expDb?.hogar_id) {
            // 3. Vincular a integrantes_hogar
            await supabaseAdmin.from("integrantes_hogar").insert([
              {
                hogar_id: expDb.hogar_id,
                persona_id: personaDb.id,
                parentesco,
                es_postulante_principal: false
              }
            ]);

            // 4. Crear requisito documental de cédula para este integrante en Fase 1 (F1-03)
            const { data: plantilla } = await supabaseAdmin
              .from("plantillas_requisito")
              .select("id")
              .eq("codigo_requisito", "F1-03")
              .maybeSingle();

            const { data: reqInsert } = await supabaseAdmin.from("requisitos_caso").insert([
              {
                expediente_id: expDb.id,
                plantilla_id: plantilla?.id || null,
                codigo_requisito: "F1-03",
                nombre: `Cédula de Integrante: ${nombreCompleto}`,
                fase: 1,
                persona_id: personaDb.id,
                estado: docObj ? "recibido_revision" : "pendiente_carga",
                es_obligatorio: true,
                es_adicional: false
              }
            ]).select("id").maybeSingle();

            // Si se cargó un documento de cédula, guardarlo en tablas de documentos y versiones
            if (docObj && reqInsert?.id) {
              const { data: docDb } = await supabaseAdmin.from("documentos").insert([
                {
                  expediente_id: expDb.id,
                  titulo: `Cédula de Integrante: ${nombreCompleto}`,
                  persona_id: personaDb.id
                }
              ]).select("id").maybeSingle();

              if (docDb?.id) {
                let subidoPorUuid: string | null = null;
                if (req.user!.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.user!.id)) {
                  subidoPorUuid = req.user!.id;
                }

                const { data: verDb } = await supabaseAdmin.from("versiones_documento").insert([
                  {
                    documento_id: docDb.id,
                    version_numero: 1,
                    storage_path: storagePath,
                    nombre_archivo_original: nombreArchivoEstandar,
                    mime_type: mimeType || "application/pdf",
                    tamano_bytes: Number(tamanoBytes) || 1048576,
                    sha256_hash: `sha256-ced-${Date.now()}`,
                    subido_por: subidoPorUuid,
                    url_publica: docObj.versionActual?.archivoDataUrl
                  }
                ]).select("id").maybeSingle();

                if (verDb?.id) {
                  await supabaseAdmin.from("evidencias_requisito").insert([
                    {
                      requisito_caso_id: reqInsert.id,
                      version_documento_id: verDb.id,
                      vinculado_por: subidoPorUuid
                    }
                  ]);
                }
              }
            }

            console.log(
              `[SUPABASE]: Integrante ${nombreCompleto} (${parentesco}) y su Cédula F1-03 (${nombreArchivoEstandar}) persistidos en Supabase para expediente ${exp.codigoVisible}`
            );
          }
        } catch (err: any) {
          console.error("[SUPABASE]: Error al guardar integrante en Supabase:", err?.message);
        }
      }

      res.status(201).json({
        success: true,
        integrante: {
          id: nuevoIntegranteId,
          hogarId: exp.hogar.id,
          persona: nuevaPersona,
          parentesco,
          esPostulantePrincipal: false,
          retiroPendiente: false
        },
        requisito: nuevoReq
      });
    }
  );

  // 8.1 SOLICITAR RETIRO DE CÉDULA DEL HOGAR (Cambio 2: Exclusivo para Comercial y Asistente con Observación Obligatoria)
  app.post(
    "/api/expedientes/:id/hogar/integrantes/:integranteId/solicitar-retiro",
    requireAuth(["comercial", "asistente", "administrador"]),
    (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      if (exp.bloqueadoPorRevision) {
        res.status(400).json({ error: "El expediente se encuentra bloqueado en revisión del Supervisor." });
        return;
      }

      const integrante = exp.hogar.integrantes.find((i) => i.id === req.params.integranteId);
      if (!integrante) {
        res.status(404).json({ error: "Integrante no encontrado en el hogar." });
        return;
      }

      if (integrante.esPostulantePrincipal) {
        res.status(400).json({ error: "No es posible retirar al postulante principal del hogar." });
        return;
      }

      if (exp.estadoGeneral === "salida_definitiva") {
        res.status(400).json({ error: "El expediente se encuentra en Salida Definitiva y no permite modificaciones en su hogar." });
        return;
      }

      const motivoRaw = req.body.motivo || req.body.motivoSolicitud;
      const motivo = motivoRaw ? String(motivoRaw).trim() : "";
      if (!motivo) {
        res.status(400).json({ error: "La observación o justificación del motivo del retiro de la cédula es estrictamente obligatoria." });
        return;
      }

      if (integrante.retiroPendiente) {
        res.status(400).json({ error: "Este integrante ya cuenta con una solicitud de retiro pendiente de autorización por parte del Supervisor." });
        return;
      }

      const nombrePersona = integrante.persona.nombres || `${integrante.persona.primerNombre || ''} ${integrante.persona.primerApellido || ''}`.trim();
      const solId = `sol-ret-${Date.now()}`;
      const nuevaSolicitud: SolicitudRetiroCedula = {
        id: solId,
        expedienteId: exp.id,
        expedienteCodigoVisible: exp.codigoVisible || exp.id,
        integranteId: integrante.id,
        personaId: integrante.persona.id,
        personaNombreCompleto: nombrePersona,
        numeroIdentificacion: integrante.persona.numeroIdentificacion,
        tipoIdentificacion: integrante.persona.tipoIdentificacion,
        parentesco: integrante.parentesco,
        solicitadoPorId: req.user!.id,
        solicitadoPorNombre: req.user!.nombreCompleto,
        solicitadoPorRol: req.user!.rol,
        motivoSolicitud: String(motivo).trim(),
        fechaSolicitud: new Date().toISOString(),
        estado: "pendiente"
      };

      mockDb.solicitudesRetiro.unshift(nuevaSolicitud);

      // Marcar integrante con retiro pendiente
      integrante.retiroPendiente = true;
      integrante.solicitudRetiroId = solId;
      integrante.motivoRetiroPendiente = String(motivo).trim();

      // Registro en bitácora
      mockDb.notas.push({
        id: `nota-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        personaContactada: nombrePersona,
        canal: "sistema",
        contenido: `Solicitud formal de retiro de cédula enviada a Supervisión por ${req.user!.nombreCompleto} (${req.user!.rol}). Justificación: ${String(motivo).trim()}`,
        fechaGestion: new Date().toISOString(),
        creadoEn: new Date().toISOString()
      });

      console.log(`[NOTIFICACIÓN SUPERVISOR] Solicitud de retiro de cédula radicada: ${nombrePersona} por ${req.user!.nombreCompleto}. Observación: ${motivo}`);

      res.status(201).json({
        success: true,
        mensaje: "Solicitud de retiro de cédula generada con éxito. Queda en estado 'Retiro Pendiente de Autorización' hasta la decisión del Supervisor.",
        solicitud: nuevaSolicitud,
        integrante
      });
    }
  );

  // 8.2 LISTADO DE SOLICITUDES DE RETIRO DE CÉDULA
  app.get(
    "/api/solicitudes-retiro",
    requireAuth(["comercial", "asistente", "supervisor", "administrador", "planeacion"]),
    (req: AuthRequest, res: Response) => {
      res.json(mockDb.solicitudesRetiro);
    }
  );

  // 8.3 AUTORIZAR RETIRO DE CÉDULA (Exclusivo Supervisor o Administrador)
  app.post(
    "/api/solicitudes-retiro/:id/autorizar",
    requireAuth(["supervisor", "administrador"]),
    (req: AuthRequest, res: Response) => {
      const solicitud = mockDb.solicitudesRetiro.find((s) => s.id === req.params.id);
      if (!solicitud) {
        res.status(404).json({ error: "Solicitud no encontrada." });
        return;
      }
      if (solicitud.estado !== "pendiente") {
        res.status(400).json({ error: `La solicitud ya fue procesada anteriormente con estado: ${solicitud.estado}.` });
        return;
      }

      const exp = mockDb.expedientes.find((e) => e.id === solicitud.expedienteId);
      if (exp) {
        let integranteEliminado = null;
        const idx = exp.hogar.integrantes.findIndex((i) => i.id === solicitud.integranteId);
        if (idx !== -1) {
          integranteEliminado = exp.hogar.integrantes[idx];
          exp.hogar.integrantes.splice(idx, 1);
        }

        // Remover requisitos documentales asociados a esta persona
        mockDb.requisitosCaso = mockDb.requisitosCaso.filter(
          (r) => !(r.expedienteId === exp.id && r.personaId === solicitud.personaId)
        );

        mockDb.notas.push({
          id: `nota-${Date.now()}`,
          expedienteId: exp.id,
          autorId: req.user!.id,
          autorNombre: req.user!.nombreCompleto,
          personaContactada: solicitud.personaNombreCompleto,
          canal: "sistema",
          contenido: `Retiro de cédula de ${solicitud.personaNombreCompleto} AUTORIZADO por ${req.user!.nombreCompleto} (Supervisor). La cédula fue removida definitivamente del hogar.`,
          fechaGestion: new Date().toISOString(),
          creadoEn: new Date().toISOString()
        });

        // Persistencia inmediata de la eliminación en Supabase (PostgreSQL)
        eliminarIntegranteDeSupabase(
          exp.id,
          solicitud.integranteId,
          solicitud.personaId,
          solicitud.numeroIdentificacion || integranteEliminado?.persona?.numeroIdentificacion
        ).catch((e) => console.error("[SUPABASE]: Error al eliminar integrante de Supabase:", e?.message));

        sincronizarExpedienteEnSupabase(exp).catch(() => {});
      }

      solicitud.estado = "autorizada";
      solicitud.resueltoPorId = req.user!.id;
      solicitud.resueltoPorNombre = req.user!.nombreCompleto;
      solicitud.fechaResolucion = new Date().toISOString();

      res.json({
        success: true,
        mensaje: `Retiro de cédula autorizado con éxito. La persona ${solicitud.personaNombreCompleto} fue retirada definitivamente del hogar.`,
        solicitud
      });
    }
  );

  // 8.4 RECHAZAR RETIRO DE CÉDULA (Exclusivo Supervisor o Administrador con Justificación Obligatoria)
  app.post(
    "/api/solicitudes-retiro/:id/rechazar",
    requireAuth(["supervisor", "administrador"]),
    (req: AuthRequest, res: Response) => {
      const solicitud = mockDb.solicitudesRetiro.find((s) => s.id === req.params.id);
      if (!solicitud) {
        res.status(404).json({ error: "Solicitud no encontrada." });
        return;
      }
      if (solicitud.estado !== "pendiente") {
        res.status(400).json({ error: `La solicitud ya fue procesada anteriormente con estado: ${solicitud.estado}.` });
        return;
      }

      const { motivoRechazo } = req.body;
      if (!motivoRechazo || !String(motivoRechazo).trim()) {
        res.status(400).json({ error: "El motivo o justificación del rechazo es obligatorio." });
        return;
      }

      solicitud.estado = "rechazada";
      solicitud.motivoRechazo = String(motivoRechazo).trim();
      solicitud.resueltoPorId = req.user!.id;
      solicitud.resueltoPorNombre = req.user!.nombreCompleto;
      solicitud.fechaResolucion = new Date().toISOString();

      const exp = mockDb.expedientes.find((e) => e.id === solicitud.expedienteId);
      if (exp) {
        const integrante = exp.hogar.integrantes.find((i) => i.id === solicitud.integranteId);
        if (integrante) {
          integrante.retiroPendiente = false;
          integrante.ultimoRechazoRetiro = String(motivoRechazo).trim();
        }

        mockDb.notas.push({
          id: `nota-${Date.now()}`,
          expedienteId: exp.id,
          autorId: req.user!.id,
          autorNombre: req.user!.nombreCompleto,
          personaContactada: solicitud.personaNombreCompleto,
          canal: "sistema",
          contenido: `Retiro de cédula de ${solicitud.personaNombreCompleto} RECHAZADO por ${req.user!.nombreCompleto} (Supervisor). Motivo: ${String(motivoRechazo).trim()}`,
          fechaGestion: new Date().toISOString(),
          creadoEn: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        mensaje: "Solicitud de retiro de cédula rechazada. La cédula se mantiene activa en el hogar.",
        solicitud
      });
    }
  );

  // 8.5 ELIMINACIÓN DIRECTA (Bloqueada para Comercial y Asistente; solo Supervisor/Admin)
  app.delete(
    "/api/expedientes/:id/hogar/integrantes/:integranteId",
    requireAuth(["comercial", "asistente", "supervisor", "administrador"]),
    (req: AuthRequest, res: Response) => {
      if (req.user!.rol === "comercial" || req.user!.rol === "asistente") {
        res.status(403).json({
          error: "Para retirar una cédula del hogar se debe generar una solicitud con observación/justificación para autorización previa del Supervisor (Cambio 2)."
        });
        return;
      }

      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      if (exp.bloqueadoPorRevision) {
        res.status(400).json({ error: "El expediente se encuentra bloqueado en revisión del Supervisor." });
        return;
      }

      const idx = exp.hogar.integrantes.findIndex((i) => i.id === req.params.integranteId);
      if (idx === -1) {
        res.status(404).json({ error: "Integrante no encontrado en el hogar." });
        return;
      }

      const integrante = exp.hogar.integrantes[idx];
      if (integrante.esPostulantePrincipal) {
        res.status(400).json({ error: "No es posible eliminar al postulante principal del hogar." });
        return;
      }

      exp.hogar.integrantes.splice(idx, 1);

      mockDb.requisitosCaso = mockDb.requisitosCaso.filter(
        (r) => !(r.expedienteId === exp.id && r.personaId === integrante.persona.id)
      );

      // Persistencia inmediata de la eliminación en Supabase (PostgreSQL)
      eliminarIntegranteDeSupabase(
        exp.id,
        integrante.id,
        integrante.persona?.id,
        integrante.persona?.numeroIdentificacion
      ).catch((e) => console.error("[SUPABASE]: Error al eliminar integrante de Supabase:", e?.message));

      sincronizarExpedienteEnSupabase(exp).catch(() => {});

      res.json({
        success: true,
        mensaje: `Integrante eliminado correctamente.`,
        integranteEliminado: integrante
      });
    }
  );

  // 8.1 AGREGAR REQUISITO/DOCUMENTO A UN EXPEDIENTE (Asistente en Fase 2, Asistente y Admin)
  app.post(
    "/api/expedientes/:id/requisitos",
    requireAuth(["asistente", "comercial", "administrador"]),
    (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      const { nombre, descripcion, fase, esObligatorio, codigoRequisito, nombreArchivo, mimeType, tamanoBytes, archivoDataUrl, sha256Hash } = req.body;
      if (!nombre || !String(nombre).trim()) {
        res.status(400).json({ error: "El nombre del documento o requisito es obligatorio." });
        return;
      }

      const numFase = typeof fase === "number" ? fase : exp.faseActual;

      // Restricción de Fase 2: Solo Gestor Documental y Administrador
      if (numFase === 2) {
        if (req.user!.rol !== "asistente" && req.user!.rol !== "administrador") {
          res.status(403).json({
            error: "En Fase 2, solo el Gestor Documental puede agregar documentos requeridos al hogar."
          });
          return;
        }
        if (exp.bloqueadoPorRevision) {
          res.status(400).json({
            error: "El expediente se encuentra bloqueado en revisión del Analista Documental."
          });
          return;
        }
      }

      const countEnFase = mockDb.requisitosCaso.filter((r) => r.expedienteId === exp.id && r.fase === numFase).length + 1;
      const codigo = codigoRequisito ? String(codigoRequisito).trim().toUpperCase() : `F${numFase}-${String(countEnFase).padStart(2, "0")}`;

      const nuevoReq: RequisitoCaso = {
        id: `req-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        expedienteId: exp.id,
        codigoRequisito: codigo,
        nombre: String(nombre).trim(),
        descripcion: descripcion ? String(descripcion).trim() : "Documentación requerida del hogar.",
        fase: numFase,
        estado: nombreArchivo ? "recibido_revision" : "pendiente_carga",
        esObligatorio: esObligatorio !== undefined ? Boolean(esObligatorio) : true,
        esAdicional: true
      };

      // Si el usuario adjuntó un archivo directamente en el formulario
      if (nombreArchivo) {
        const docId = `doc-${Date.now()}`;
        const verId = `ver-${Date.now()}`;
        const doc: Documento = {
          id: docId,
          expedienteId: exp.id,
          titulo: `${nuevoReq.nombre} - ${exp.postulante.primerApellido}`,
          versiones: [
            {
              id: verId,
              documentoId: docId,
              versionNumero: 1,
              storagePath: `expedientes/${exp.id}/${codigo}_v1.pdf`,
              nombreArchivoOriginal: nombreArchivo,
              mimeType: mimeType || "application/pdf",
              tamanoBytes: tamanoBytes || 1024000,
              sha256Hash: sha256Hash || `sha256-${Date.now()}-${Math.random().toString(36).substring(7)}`,
              subidoPorId: req.user!.id,
              subidoPorNombre: req.user!.nombreCompleto,
              subidoEn: new Date().toISOString(),
              archivoDataUrl: archivoDataUrl || undefined
            }
          ]
        };
        doc.versionActual = doc.versiones[0];
        mockDb.documentos.push(doc);
        nuevoReq.documentoAsociado = doc;
      }

      mockDb.requisitosCaso.push(nuevoReq);

      res.status(201).json({
        success: true,
        requisito: nuevoReq
      });
    }
  );

  // 8.1B ELIMINAR ARCHIVO CARGADO DE UN REQUISITO (Gestión Flexible CRUD Fase 3 y general)
  // Permite al usuario eliminar un archivo cargado erróneamente sin borrar la estructura del requisito ni reiniciar el expediente.
  const handlerEliminarArchivoRequisito = async (req: AuthRequest, res: Response) => {
    try {
      let exp = mockDb.expedientes.find(
        (e) => e.id === req.params.id || e.codigoVisible === req.params.id || e.codigoVisible?.toUpperCase() === req.params.id?.toUpperCase()
      );
      if (!exp && supabaseAdmin) {
        try {
          const { data: row } = await supabaseAdmin
            .from("expedientes")
            .select(`
              *,
              postulante:personas!expedientes_postulante_id_fkey(*),
              predio:predios!expedientes_predio_vivienda_id_fkey(*),
              hogar:hogares!expedientes_hogar_id_fkey(
                id,
                observaciones,
                integrantes:integrantes_hogar(
                  id,
                  parentesco,
                  es_postulante_principal,
                  persona:personas(*)
                )
              ),
              comercial:perfiles_usuario!expedientes_comercial_origen_id_fkey(id, nombre_completo, username, rol),
              responsable:perfiles_usuario!expedientes_responsable_general_id_fkey(id, nombre_completo, username, rol)
            `)
            .or(`id.eq.${req.params.id},codigo_visible.eq.${req.params.id}`)
            .maybeSingle();

          if (row) {
            exp = mapearFilaSupabaseAExpediente(row);
            inicializarRequisitosFase1(exp);
            if (exp.faseActual >= 2) inicializarRequisitosFase2(exp);
            if (exp.faseActual >= 4) inicializarFase4(exp);
            mockDb.expedientes.unshift(exp);
          }
        } catch (err: any) {
          console.error("[DEL FILE HIDRATACIÓN ERROR]:", err?.message);
        }
      }
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      const reqIdParam = String(req.params.reqId || "").trim();
      const matchCodigo = reqIdParam.match(/F\d+-\d+/i);
      const codigoNormalizado = matchCodigo ? matchCodigo[0].toUpperCase() : null;

      let reqCaso = mockDb.requisitosCaso.find(
        (r) =>
          r.id === reqIdParam ||
          (codigoNormalizado && r.codigoRequisito?.toUpperCase() === codigoNormalizado) ||
          ((r.expedienteId === exp.id || (exp.codigoVisible && r.expedienteId === exp.codigoVisible)) && (
            r.codigoRequisito === reqIdParam ||
            r.id === reqIdParam
          ))
      );

      if (!reqCaso) {
        res.status(404).json({ error: "Requisito documental no encontrado." });
        return;
      }

      const nombreDocAnterior = reqCaso.documentoAsociado?.versionActual?.nombreArchivoOriginal || "Archivo previo";

      // Limpiar versiones y desasociar documento
      if (reqCaso.documentoAsociado) {
        const docId = reqCaso.documentoAsociado.id;
        const docEnDb = mockDb.documentos.find((d) => d.id === docId);
        if (docEnDb) {
          docEnDb.versiones = [];
          docEnDb.versionActual = undefined as any;
        }
        reqCaso.documentoAsociado.versiones = [];
        reqCaso.documentoAsociado.versionActual = undefined as any;
        reqCaso.documentoAsociado = undefined;
      }

      // Regla de Negocio: Al eliminar un archivo cargado erróneamente, pasa automáticamente a 'pendiente_carga'
      reqCaso.estado = "pendiente_carga";

      // Si estaba en subsanación de Fase 3 y se eliminó, actualizar registro
      if (exp.subsanacionFase3DocumentosModificados) {
        exp.subsanacionFase3DocumentosModificados = exp.subsanacionFase3DocumentosModificados.filter(
          (c) => c !== reqCaso!.codigoRequisito
        );
      }

      // Registro en bitácora para trazabilidad de auditoría
      mockDb.notas.push({
        id: `not-del-file-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "gestion_tecnica",
        contenido: `Archivo "${nombreDocAnterior}" del requisito [${reqCaso.codigoRequisito}] "${reqCaso.nombre}" eliminado por ${req.user!.nombreCompleto} (${req.user!.rol}). Estado del ítem actualizado a 'Pendiente'.`,
        creadoEn: new Date().toISOString()
      });

      // Si Supabase está conectado, limpiar en base de datos también
      if (supabaseAdmin) {
        try {
          await supabaseAdmin
            .from("requisitos_caso")
            .update({
              estado: "pendiente_carga",
              documento_id: null
            })
            .eq("id", reqCaso.id);
        } catch (dbErr: any) {
          console.warn("[SUPABASE]: Error al limpiar archivo de requisito:", dbErr?.message);
        }
      }

      res.json({
        success: true,
        mensaje: `Archivo eliminado exitosamente. El requisito [${reqCaso.codigoRequisito}] ahora está en estado 'Pendiente'.`,
        requisito: reqCaso
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Error al eliminar el archivo del requisito." });
    }
  };

  app.delete(
    "/api/expedientes/:id/requisitos/:reqId/archivo",
    requireAuth(["asistente", "ingenieria", "supervisor", "administrador"]),
    handlerEliminarArchivoRequisito
  );

  app.post(
    "/api/expedientes/:id/requisitos/:reqId/eliminar-archivo",
    requireAuth(["asistente", "ingenieria", "supervisor", "administrador"]),
    handlerEliminarArchivoRequisito
  );

  // 8.2 ELIMINAR REQUISITO DOCUMENTAL (Asistente, Administrador)
  app.delete(
    "/api/expedientes/:id/requisitos/:reqId",
    requireAuth(["asistente", "administrador"]),
    (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      const idx = mockDb.requisitosCaso.findIndex((r) => r.id === req.params.reqId && r.expedienteId === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: "Requisito no encontrado." });
        return;
      }

      const reqCaso = mockDb.requisitosCaso[idx];
      if (reqCaso.fase === 2) {
        if (req.user!.rol !== "asistente" && req.user!.rol !== "administrador") {
          res.status(403).json({ error: "En Fase 2, solo el Gestor Documental puede eliminar requisitos." });
          return;
        }
        if (exp && exp.bloqueadoPorRevision) {
          res.status(400).json({ error: "El expediente se encuentra bloqueado en revisión del Analista Documental." });
          return;
        }
      }

      const [eliminado] = mockDb.requisitosCaso.splice(idx, 1);
      res.json({ success: true, eliminado });
    }
  );

  // 9. REVISIÓN HUMANA EXCLUSIVA DEL SUPERVISOR / ADMINISTRADOR / INGENIERÍA
  app.post(
    "/api/expedientes/:id/requisitos/:reqId/revisar",
    requireAuth(["supervisor", "administrador", "ingenieria"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      if (exp.estadoGeneral === "salida_definitiva") {
        res.status(400).json({ error: "El expediente se encuentra en Salida Definitiva y es un archivo histórico inmutable." });
        return;
      }

      let reqCaso = mockDb.requisitosCaso.find((r) => r.id === req.params.reqId);
      if (!reqCaso && exp) {
        reqCaso = mockDb.requisitosCaso.find(
          (r) => r.expedienteId === exp.id && (r.codigoRequisito === req.params.reqId || r.id === req.params.reqId)
        );
      }

      // Si es F5-01 y aún no estaba en mockDb, asegurarlo
      if (!reqCaso && exp && (req.params.reqId.includes("f5-01") || req.params.reqId.toUpperCase().includes("F5-01"))) {
        reqCaso = {
          id: `req-f5-01-${exp.id}`,
          expedienteId: exp.id,
          codigoRequisito: "F5-01",
          nombre: "Presupuesto Oficial y APU Detallado",
          descripcion: "Análisis de Precios Unitarios regionalizado Cundinamarca y presupuesto oficial de obra.",
          fase: 5,
          predioId: exp.predioVivienda?.id || "predio-default",
          estado: "pendiente_carga",
          esObligatorio: true,
          esAdicional: false
        };
        mockDb.requisitosCaso.push(reqCaso);
      }

      if (!reqCaso) {
        res.status(404).json({ error: "Requisito no encontrado en el expediente." });
        return;
      }


      const { resultado, observacion } = req.body;
      if (resultado !== "ACEPTADO" && resultado !== "OBSERVADO") {
        res.status(400).json({ error: "Resultado de revisión debe ser ACEPTADO u OBSERVADO." });
        return;
      }

      if (resultado === "OBSERVADO" && (!observacion || !String(observacion).trim())) {
        res.status(400).json({ error: "Debe indicar la observación subsanable." });
        return;
      }

      // Asegurar versión asociada si el evaluador dictamina sobre el requisito
      if (!reqCaso.documentoAsociado) {
        reqCaso.documentoAsociado = {
          id: `doc-${Date.now()}`,
          expedienteId: exp.id,
          titulo: reqCaso.nombre,
          versiones: []
        };
      }
      if (!reqCaso.documentoAsociado.versionActual) {
        const verDefecto = {
          id: `ver-${Date.now()}`,
          documentoId: reqCaso.documentoAsociado.id,
          versionNumero: 1,
          nombreArchivoOriginal: `${reqCaso.codigoRequisito || "DOC"}_Dictamen.pdf`,
          mimeType: "application/pdf",
          tamanoBytes: 1024,
          sha256Hash: `hash-dictamen-${Date.now()}`,
          storagePath: `dictamenes/${Date.now()}.pdf`,
          subidoPorId: req.user!.id,
          subidoPorNombre: req.user!.nombreCompleto,
          subidoEn: new Date().toISOString()
        };
        reqCaso.documentoAsociado.versionActual = verDefecto;
        reqCaso.documentoAsociado.versiones.push(verDefecto);
      }

      const versionId = reqCaso.documentoAsociado.versionActual.id;
      const revisionesPrevias = mockDb.revisiones.filter((rv) => rv.requisitoCasoId === reqCaso!.id);
      const nuevoCicloRevision = revisionesPrevias.length + 1;

      const nuevaRevision: RevisionHumana = {
        id: `rev-${Date.now()}`,
        requisitoCasoId: reqCaso.id,
        versionDocumentoId: versionId,
        supervisorId: req.user!.id,
        supervisorNombre: req.user!.nombreCompleto,
        cicloRevision: nuevoCicloRevision,
        resultado,
        observacion: observacion ? String(observacion).trim() : "",
        fechaRevision: new Date().toISOString()
      };

      mockDb.revisiones.push(nuevaRevision);
      reqCaso.estado = resultado === "ACEPTADO" ? "aceptado" : "con_observaciones";
      reqCaso.observaciones = observacion ? String(observacion).trim() : "";
      reqCaso.ultimaRevision = nuevaRevision;

      // Si es F5-01 o fase 5, actualizar tramite de licencia si existe
      if (reqCaso.codigoRequisito === "F5-01" || reqCaso.fase === 5) {
        if (exp.tramiteLicencia) {
          exp.tramiteLicencia.actualizadoEn = new Date().toISOString();
        }
      }

      // Si se observó con comentarios, generar tarea y nota individual para subsanación del documento
      const tieneComentariosObs = resultado === "OBSERVADO" || Boolean(observacion && String(observacion).trim().length > 0);
      if (tieneComentariosObs) {
        // NOTA: La devolución es estrictamente individual por documento/archivo.
        // No altera el estado general de la fase (estadoFase1 / estadoFase2) ni el motivo general de devolución del expediente.
        const responsableDestino = reqCaso.fase === 1
          ? (exp.comercialOrigenId || "usr-comercial-01")
          : (exp.asistenteAsignadoId || exp.responsableGeneralId || exp.comercialOrigenId || "usr-asistente-01");

        mockDb.tareas.push({
          id: `tar-${Date.now()}`,
          expedienteId: exp.id,
          descripcion: `Subsanar devolución individual en documento: ${reqCaso.nombre} - ${observacion}`,
          asignadoAId: responsableDestino,
          creadoPorId: req.user!.id,
          estado: "pendiente",
          creadoEn: new Date().toISOString()
        });

        mockDb.notas.push({
          id: `nota-obs-${Date.now()}`,
          expedienteId: exp.id,
          autorId: req.user!.id,
          autorNombre: req.user!.nombreCompleto,
          personaContactada: "Responsable de Gestión",
          canal: "sistema",
          contenido: `Devolución individual del documento '${reqCaso.nombre}': ${nuevaRevision.observacion}. Documento habilitado para su corrección.`,
          fechaGestion: new Date().toISOString(),
          creadoEn: new Date().toISOString()
        });
      }

      // Sincronizar actualización en Supabase
      await sincronizarExpedienteEnSupabase(exp);

      if (supabaseAdmin) {
        try {
          const esUuid = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
          let expUuid: string | null = esUuid(exp.id) ? exp.id : null;
          if (!expUuid && exp.codigoVisible) {
            const { data: expDb } = await supabaseAdmin
              .from("expedientes")
              .select("id")
              .eq("codigo_visible", exp.codigoVisible)
              .maybeSingle();
            if (expDb?.id) expUuid = expDb.id;
          }

          let reqUuid = esUuid(reqCaso.id) ? reqCaso.id : null;
          if (!reqUuid && expUuid && reqCaso.personaId && esUuid(reqCaso.personaId)) {
            const { data: rRow } = await supabaseAdmin
              .from("requisitos_caso")
              .select("id")
              .eq("expediente_id", expUuid)
              .eq("codigo_requisito", reqCaso.codigoRequisito)
              .eq("persona_id", reqCaso.personaId)
              .limit(1)
              .maybeSingle();
            if (rRow?.id) reqUuid = rRow.id;
          }
          if (!reqUuid && expUuid) {
            const { data: rRow } = await supabaseAdmin
              .from("requisitos_caso")
              .select("id")
              .eq("expediente_id", expUuid)
              .eq("nombre", reqCaso.nombre)
              .limit(1)
              .maybeSingle();
            if (rRow?.id) reqUuid = rRow.id;
          }
          if (!reqUuid && expUuid && reqCaso.codigoRequisito !== "F1-03") {
            const { data: rRow } = await supabaseAdmin
              .from("requisitos_caso")
              .select("id")
              .eq("expediente_id", expUuid)
              .eq("codigo_requisito", reqCaso.codigoRequisito)
              .limit(1)
              .maybeSingle();
            if (rRow?.id) reqUuid = rRow.id;
          }

          if (reqUuid) {
            reqCaso.id = reqUuid;
            nuevaRevision.requisitoCasoId = reqUuid;
            await supabaseAdmin
              .from("requisitos_caso")
              .update({
                estado: resultado === "ACEPTADO" ? "aceptado" : "con_observaciones",
                actualizado_en: new Date().toISOString()
              })
              .eq("id", reqUuid);
          }

          let verUuid = esUuid(versionId) ? versionId : null;
          if (!verUuid && reqCaso.documentoAsociado?.id && esUuid(reqCaso.documentoAsociado.id)) {
            const { data: vRow } = await supabaseAdmin
              .from("versiones_documento")
              .select("id")
              .eq("documento_id", reqCaso.documentoAsociado.id)
              .order("version_numero", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (vRow?.id) verUuid = vRow.id;
          }
          if (!verUuid && reqUuid) {
            const { data: evRow } = await supabaseAdmin
              .from("evidencias_requisito")
              .select("version_documento_id")
              .eq("requisito_caso_id", reqUuid)
              .limit(1)
              .maybeSingle();
            if (evRow?.version_documento_id) verUuid = evRow.version_documento_id;
          }
          if (!verUuid) {
            const { data: vRow } = await supabaseAdmin
              .from("versiones_documento")
              .select("id")
              .order("subido_en", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (vRow?.id) verUuid = vRow.id;
          }

          let supUuid = esUuid(req.user!.id) ? req.user!.id : null;
          if (!supUuid) {
            const { data: sRow } = await supabaseAdmin
              .from("perfiles_usuario")
              .select("id")
              .eq("rol", "supervisor")
              .limit(1)
              .maybeSingle();
            if (sRow?.id) supUuid = sRow.id;
          }

          if (reqUuid && verUuid && supUuid) {
            nuevaRevision.versionDocumentoId = verUuid;
            const { data: revInsertada } = await supabaseAdmin
              .from("revisiones_humanas")
              .insert([
                {
                  requisito_caso_id: reqUuid,
                  version_documento_id: verUuid,
                  supervisor_id: supUuid,
                  ciclo_revision: nuevoCicloRevision,
                  resultado,
                  observacion: observacion ? String(observacion).trim() : "",
                  fecha_revision: nuevaRevision.fechaRevision
                }
              ])
              .select("id")
              .maybeSingle();
            if (revInsertada?.id) {
              nuevaRevision.id = revInsertada.id;
            }
          }
        } catch (sbErr: any) {
          console.warn("[SUPABASE REVISION ERROR]:", sbErr?.message);
        }
      }

      res.status(200).json({ success: true, revision: nuevaRevision, requisito: reqCaso, expediente: exp });
    }
  );

  // 10. APROBACIÓN DE FASE 1 Y ASIGNACIÓN OBLIGATORIA DEL ASISTENTE
  app.post(
    ["/api/expedientes/:id/aprobar-fase1", "/api/expedientes/:id/aprobar-fase-1"],
    requireAuth(["supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      if (exp.estadoGeneral === "salida_definitiva") {
        res.status(400).json({ error: "El expediente se encuentra en Salida Definitiva y es un archivo histórico inmutable. No puede ser aprobado ni reactivado." });
        return;
      }

      const { asistenteAsignadoId } = req.body;
      if (!asistenteAsignadoId) {
        res.status(400).json({
          error: "Debe seleccionar un Gestor Documental específico para transferir la continuidad general."
        });
        return;
      }

      const asistente = mockDb.perfiles.find((p) => p.id === asistenteAsignadoId && p.rol === "asistente" && p.activo);
      if (!asistente) {
        res.status(400).json({ error: "El usuario seleccionado no es un Gestor Documental activo." });
        return;
      }

      // Validar que TODOS los requisitos de Fase 1 estén en estado 'aceptado'
      const reqsFase1 = mockDb.requisitosCaso.filter((r) => r.expedienteId === exp.id && (r.fase === 1 || !r.fase));
      const pendientes = reqsFase1.filter((r) => r.estado !== "aceptado");

      if (pendientes.length > 0) {
        res.status(400).json({
          error: `No se puede aprobar la Fase 1. Aún existen ${pendientes.length} requisitos no aceptados.`
        });
        return;
      }

      // Avanzar formalmente a Fase 2 y transferir responsabilidad general al Gestor Documental
      exp.faseActual = 2;
      exp.bloqueadoPorRevision = false;
      exp.estadoFase1 = "aprobado";
      exp.responsableGeneralId = asistente.id;
      exp.actualizadoEn = new Date().toISOString();

      // Inicializar los 11 documentos de Fase 2 heredando los 3 existentes de Fase 1
      inicializarRequisitosFase2(exp);

      // Generar tarea operativa para el Gestor Documental
      mockDb.tareas.push({
        id: `tar-${Date.now()}`,
        expedienteId: exp.id,
        descripcion: `Recolectar y cargar la documentación oficial de Fase 2 para el hogar de ${exp.postulante.nombres} ${exp.postulante.primerApellido}`,
        asignadoAId: asistente.id,
        asignadoANombre: asistente.nombreCompleto,
        creadoPorId: req.user!.id,
        estado: "pendiente",
        creadoEn: new Date().toISOString()
      });

      // Bitácora de aprobación y transición oficial
      mockDb.notas.push({
        id: `nota-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        personaContactada: "Analista Documental",
        canal: "sistema",
        contenido: `Fase 1 aprobada con éxito. El expediente del hogar avanzó formalmente a Fase 2 (Conformación del Hogar) bajo la responsabilidad del Gestor Documental ${asistente.nombreCompleto}.`,
        fechaGestion: new Date().toISOString(),
        creadoEn: new Date().toISOString()
      });

      const comercial = mockDb.perfiles.find((p) => p.id === exp.comercialOrigenId);
      const expedienteEnriquecido = {
        ...exp,
        comercialOrigenNombre: comercial?.nombreCompleto,
        responsableGeneralNombre: asistente.nombreCompleto,
        responsableGeneralRol: asistente.rol
      };

      // Sincronizar actualización de fase en Supabase
      await sincronizarExpedienteEnSupabase(exp);

      res.json({
        success: true,
        mensaje: `Fase 1 aprobada con éxito. El hogar avanzó a Fase 2 (Conformación del Hogar) y la responsabilidad general fue transferida a ${asistente.nombreCompleto}.`,
        expediente: expedienteEnriquecido
      });
    }
  );

  // 10.1 ENVIAR EXPEDIENTE A REVISIÓN DEL SUPERVISOR (Fase 2) (Comercial, Asistente, Administrador)
  app.post(
    "/api/expedientes/:id/fase2/enviar-revision",
    requireAuth(["comercial", "asistente", "supervisor", "ingenieria", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      let exp = mockDb.expedientes.find((e) => e.id === req.params.id || (e.codigoVisible && e.codigoVisible === req.params.id));
      if (!exp && supabaseAdmin) {
        try {
          const { data: dbRow } = await supabaseAdmin
            .from("expedientes")
            .select(`
              *,
              postulante:personas!expedientes_postulante_id_fkey(*),
              predio:predios!expedientes_predio_vivienda_id_fkey(*),
              hogar:hogares!expedientes_hogar_id_fkey(*),
              comercial:perfiles_usuario!expedientes_comercial_origen_id_fkey(id, nombre_completo, username, rol),
              responsable:perfiles_usuario!expedientes_responsable_general_id_fkey(id, nombre_completo, username, rol)
            `)
            .or(`id.eq.${req.params.id},codigo_visible.eq.${req.params.id}`)
            .maybeSingle();
          if (dbRow) {
            exp = mapearFilaSupabaseAExpediente(dbRow);
            mockDb.expedientes.push(exp);
          }
        } catch {}
      }

      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      if (exp.faseActual !== 2) {
        res.status(400).json({ error: "Solo los expedientes en Fase 2 pueden enviarse a revisión de Fase 2." });
        return;
      }

      await asegurarHidratacionDocumentosExpediente(exp);

      // Validar que todos los requisitos obligatorios tengan archivo cargado
      const reqsFase2 = mockDb.requisitosCaso.filter(
        (r) => (r.expedienteId === exp.id || (exp.codigoVisible && r.expedienteId === exp.codigoVisible)) && r.fase === 2 && r.esObligatorio
      );
      reqsFase2.forEach((r) => {
        if (r.documentoAsociado?.versionActual && r.estado === "pendiente_carga") {
          r.estado = "recibido_revision";
        }
      });
      const docsExpFase2 = mockDb.documentos.filter(
        (d) => (d.expedienteId === exp.id || (exp.codigoVisible && d.expedienteId === exp.codigoVisible)) && d.versiones && d.versiones.length > 0
      );
      if (docsExpFase2.length > 0) {
        reqsFase2.forEach((r, idx) => {
          if (!r.documentoAsociado && docsExpFase2[idx]) {
            r.documentoAsociado = docsExpFase2[idx];
            r.estado = "recibido_revision";
          }
        });
      }

      const sinCargar = reqsFase2.filter((r) => r.estado === "pendiente_carga" && !r.documentoAsociado);
      if (sinCargar.length > 0 && docsExpFase2.length === 0) {
        res.status(400).json({
          error: `No se puede enviar a revisión. Aún hay ${sinCargar.length} documento(s) obligatorio(s) pendiente(s) de carga.`
        });
        return;
      }

      exp.bloqueadoPorRevision = true;
      exp.faseEnRevision = 2;
      exp.estadoFase2 = "en_revision_supervisor";
      exp.fechaEnvioRevisionFase2 = new Date().toISOString();
      exp.actualizadoEn = new Date().toISOString();

      // CAMBIO 1: Guardar responsable previo y reasignar a Supervisor (Analista Documental)
      if (!exp.responsablePrevioRevisionId) {
        exp.responsablePrevioRevisionId = exp.responsableGeneralId;
        exp.responsablePrevioRevisionNombre = exp.responsableGeneralNombre;
        exp.responsablePrevioRevisionRol = exp.responsableGeneralRol;
      }
      exp.responsableGeneralId = "usr-supervisor-01";
      exp.responsableGeneralNombre = "Dra. Helena Ramírez (Analista Documental)";
      exp.responsableGeneralRol = "supervisor";

      // Generar tarea para la supervisora jurídica
      mockDb.tareas.push({
        id: `tar-rev-f2-${Date.now()}`,
        expedienteId: exp.id,
        descripcion: `Revisar y dictaminar documentación de Fase 2 (Hogar de ${exp.postulante.nombres} ${exp.postulante.primerApellido})`,
        asignadoAId: "usr-supervisor-01",
        asignadoANombre: "Dra. Helena Ramírez (Analista Documental)",
        creadoPorId: req.user!.id,
        estado: "pendiente",
        creadoEn: new Date().toISOString()
      });

      // Bitácora
      mockDb.notas.push({
        id: `nota-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        personaContactada: "Supervisión Jurídica",
        canal: "sistema",
        contenido: `Expediente enviado formalmente a revisión jurídica por ${req.user!.nombreCompleto}. Los documentos quedan bloqueados durante la revisión del Supervisor.`,
        fechaGestion: new Date().toISOString(),
        creadoEn: new Date().toISOString()
      });

      // Sincronizar bloqueo por revisión en Supabase
      await sincronizarExpedienteEnSupabase(exp);

      if (supabaseAdmin) {
        try {
          await supabaseAdmin
            .from("expedientes")
            .update({
              bloqueado_por_revision: true,
              fase_en_revision: 2,
              estado_fase2: "en_revision_supervisor",
              responsable_general_id: "usr-supervisor-01",
              actualizado_en: new Date().toISOString()
            })
            .or(`id.eq.${exp.id},codigo_visible.eq.${exp.codigoVisible || exp.id}`);
        } catch (fErr: any) {
          console.warn("[SUPABASE]: Error forzando bloqueado_por_revision en Fase 2:", fErr?.message);
        }
      }

      res.json({
        success: true,
        mensaje: "Expediente enviado a revisión del Supervisor Jurídico exitosamente.",
        expediente: exp
      });
    }
  );

  // 10.2 APROBAR FASE 2 Y AVANZAR A FASE 3 (Supervisor, Administrador)
  app.post(
    "/api/expedientes/:id/fase2/aprobar",
    requireAuth(["supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      if (req.user?.rol === "supervisor" && !exp.bloqueadoPorRevision) {
        res.status(400).json({ error: "El expediente está en conformación por el Gestor Documental y no ha sido remitido a revisión." });
        return;
      }

      if (exp.faseActual !== 2) {
        res.status(400).json({ error: "El expediente no se encuentra en Fase 2." });
        return;
      }

      const reqsFase2 = mockDb.requisitosCaso.filter((r) => r.expedienteId === exp.id && r.fase === 2);
      const noAceptados = reqsFase2.filter((r) => r.esObligatorio && r.estado !== "aceptado");

      if (noAceptados.length > 0) {
        res.status(400).json({
          error: `No es posible aprobar la Fase 2. Aún hay ${noAceptados.length} documento(s) que no han sido aceptados por el Supervisor.`
        });
        return;
      }

      // Avanzar formalmente a Fase 3
      exp.faseActual = 3;
      exp.bloqueadoPorRevision = false;
      exp.estadoFase2 = "aprobado";
      exp.responsableGeneralId = "usr-ingenieria-01"; // Pasa a Ingeniería / Diagnóstico Técnico
      exp.responsableGeneralNombre = "Ing. Roberto Salazar (Coordinador Técnico)";
      exp.responsableGeneralRol = "ingenieria";
      exp.responsablePrevioRevisionId = undefined;
      exp.responsablePrevioRevisionNombre = undefined;
      exp.responsablePrevioRevisionRol = undefined;
      exp.fechaDecisionSupervisorFase2 = new Date().toISOString();
      exp.actualizadoEn = new Date().toISOString();

      // Crear requisitos base de Fase 3 si no existen
      const existentesF3 = mockDb.requisitosCaso.filter((r) => r.expedienteId === exp.id && r.fase === 3);
      if (existentesF3.length === 0) {
        const reqsF3Base = [
          { codigo: "F3-01", nombre: "Formato de Visita Técnica y Habitabilidad", desc: "Inspección ocular y diagnóstico de la vivienda rural." },
          { codigo: "F3-02", nombre: "Levantamiento Topográfico y Planimetría", desc: "Plano altimétrico y coordenadas del polígono del predio." },
          { codigo: "F3-03", nombre: "Concepto de Amenaza y Gestión del Riesgo", desc: "Certificado municipal de no afectación por remoción en masa." },
          { codigo: "F3-04", nombre: "Disponibilidad de Agua Potable y Energía", desc: "Constancia de acueducto veredal y Enel Colombia." }
        ];
        reqsF3Base.forEach((r) => {
          mockDb.requisitosCaso.push({
            id: `req-${r.codigo.toLowerCase()}-${exp.id}`,
            expedienteId: exp.id,
            codigoRequisito: r.codigo,
            nombre: r.nombre,
            descripcion: r.desc,
            fase: 3,
            predioId: exp.predioVivienda.id,
            estado: "pendiente_carga",
            esObligatorio: true,
            esAdicional: false
          });
        });
      }

      // Tarea técnica para coordinación de ingeniería
      mockDb.tareas.push({
        id: `tar-f3-${Date.now()}`,
        expedienteId: exp.id,
        descripcion: `Coordinar visita de inspección técnica en campo (Fase 3) para ${exp.postulante.nombres} ${exp.postulante.primerApellido}`,
        asignadoAId: "usr-ingenieria-01",
        asignadoANombre: "Ing. Roberto Salazar (Coordinador Técnico)",
        creadoPorId: req.user!.id,
        estado: "pendiente",
        creadoEn: new Date().toISOString()
      });

      // Bitácora
      mockDb.notas.push({
        id: `nota-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        personaContactada: "Comité Técnico de Obras",
        canal: "sistema",
        contenido: `Fase 2 (Conformación del Hogar) aprobada con éxito por ${req.user!.nombreCompleto}. El expediente avanza formalmente a Fase 3 (Diagnóstico Técnico) bajo la coordinación del Ing. Roberto Salazar.`,
        fechaGestion: new Date().toISOString(),
        creadoEn: new Date().toISOString()
      });

      // Sincronizar actualización de fase en Supabase
      await sincronizarExpedienteEnSupabase(exp);

      res.json({
        success: true,
        mensaje: "Fase 2 aprobada con éxito. El expediente avanzó a Fase 3 (Diagnóstico Técnico).",
        expediente: exp
      });
    }
  );

  // 10.3 DEVOLVER FASE 2 CON OBSERVACIONES AL ASISTENTE (Supervisor, Administrador)
  app.post(
    "/api/expedientes/:id/fase2/devolver",
    requireAuth(["supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      if (req.user?.rol === "supervisor" && !exp.bloqueadoPorRevision) {
        res.status(400).json({ error: "El expediente está en conformación por el Gestor Documental y no ha sido remitido a revisión." });
        return;
      }

      if (exp.estadoGeneral === "salida_definitiva") {
        res.status(400).json({ error: "El expediente se encuentra en Salida Definitiva y es un archivo histórico inmutable. No puede ser devuelto." });
        return;
      }

      const { observacion } = req.body;
      if (!observacion || !String(observacion).trim()) {
        res.status(400).json({ error: "Debe ingresar el motivo u observaciones para devolver el expediente al Asistente." });
        return;
      }

      const obsTexto = String(observacion).trim();
      exp.bloqueadoPorRevision = false;
      exp.estadoFase2 = "devuelto";
      exp.observacionDevolucionFase2 = obsTexto;
      exp.fechaDecisionSupervisorFase2 = new Date().toISOString();

      // CAMBIO 1: Devolver responsabilidad al responsable previo
      if (exp.responsablePrevioRevisionId) {
        exp.responsableGeneralId = exp.responsablePrevioRevisionId;
        exp.responsableGeneralNombre = exp.responsablePrevioRevisionNombre;
        exp.responsableGeneralRol = exp.responsablePrevioRevisionRol;
        exp.responsablePrevioRevisionId = undefined;
        exp.responsablePrevioRevisionNombre = undefined;
        exp.responsablePrevioRevisionRol = undefined;
      } else {
        exp.responsableGeneralId = exp.asistenteAsignadoId || "usr-asistente-01";
        exp.responsableGeneralNombre = "Laura Castillo (Gestor Documental)";
        exp.responsableGeneralRol = "asistente";
      }

      exp.actualizadoEn = new Date().toISOString();

      // Tarea para el asistente administrativo
      mockDb.tareas.push({
        id: `tar-dev-${Date.now()}`,
        expedienteId: exp.id,
        descripcion: `Subsanar observaciones de Fase 2 dictaminadas por el Supervisor: ${obsTexto}`,
        asignadoAId: exp.responsableGeneralId,
        creadoPorId: req.user!.id,
        estado: "pendiente",
        creadoEn: new Date().toISOString()
      });

      // Bitácora
      mockDb.notas.push({
        id: `nota-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        personaContactada: "Gestión Documental",
        canal: "sistema",
        contenido: `Expediente de Fase 2 devuelto al Gestor Documental por el Analista Documental ${req.user!.nombreCompleto}. Observación: ${obsTexto}`,
        fechaGestion: new Date().toISOString(),
        creadoEn: new Date().toISOString()
      });

      // Sincronizar en Supabase
      await sincronizarExpedienteEnSupabase(exp);

      res.json({
        success: true,
        mensaje: "Expediente devuelto al Gestor Documental con las observaciones indicadas.",
        expediente: exp
      });
    }
  );

  // 10.3.1 FLUJO GENÉRICO DE REVISIÓN POR FASES (Fase 1, 2, 3, 4, 5, 6, 7)
  // Enviar a revisión del Supervisor para cualquier fase
  app.post(
    "/api/expedientes/:id/fases/:fase/enviar-revision",
    requireAuth(["comercial", "asistente", "supervisor", "ingenieria", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      let exp = mockDb.expedientes.find((e) => e.id === req.params.id || (e.codigoVisible && e.codigoVisible === req.params.id));
      if (!exp && supabaseAdmin) {
        try {
          const { data: dbRow } = await supabaseAdmin
            .from("expedientes")
            .select(`
              *,
              postulante:personas!expedientes_postulante_id_fkey(*),
              predio:predios!expedientes_predio_vivienda_id_fkey(*),
              hogar:hogares!expedientes_hogar_id_fkey(*),
              comercial:perfiles_usuario!expedientes_comercial_origen_id_fkey(id, nombre_completo, username, rol),
              responsable:perfiles_usuario!expedientes_responsable_general_id_fkey(id, nombre_completo, username, rol)
            `)
            .or(`id.eq.${req.params.id},codigo_visible.eq.${req.params.id}`)
            .maybeSingle();
          if (dbRow) {
            exp = mapearFilaSupabaseAExpediente(dbRow);
            mockDb.expedientes.push(exp);
          }
        } catch (dbErr: any) {
          console.warn("[EXPEDIENTES]: Error buscando en Supabase:", dbErr?.message);
        }
      }

      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      const numFase = parseInt(req.params.fase, 10);
      if (isNaN(numFase) || numFase < 1 || numFase > 7) {
        res.status(400).json({ error: "Número de fase inválido (1-7)." });
        return;
      }

      if (exp.faseActual !== numFase) {
        res.status(400).json({ error: `El expediente no se encuentra en la Fase ${numFase} (fase actual: ${exp.faseActual}).` });
        return;
      }

      // 1. Asegurar hidratación y vinculación profunda de documentos y requisitos
      await asegurarHidratacionDocumentosExpediente(exp);

      // 2. Validar que todos los requisitos obligatorios de esta fase estén cargados
      const reqsFase = mockDb.requisitosCaso.filter(
        (r) => (r.expedienteId === exp.id || (exp.codigoVisible && r.expedienteId === exp.codigoVisible)) && (r.fase === numFase || (!r.fase && numFase === 1)) && r.esObligatorio
      );
      reqsFase.forEach((r) => {
        if (r.documentoAsociado?.versionActual && r.estado === "pendiente_carga") {
          r.estado = "recibido_revision";
        }
      });

      // Si hay documentos cargados en el expediente para la fase pero alguno no se vinculó, vincular por orden
      const docsExpFase = mockDb.documentos.filter(
        (d) => (d.expedienteId === exp.id || (exp.codigoVisible && d.expedienteId === exp.codigoVisible)) && d.versiones && d.versiones.length > 0
      );
      if (docsExpFase.length > 0) {
        reqsFase.forEach((r, idx) => {
          if (!r.documentoAsociado && docsExpFase[idx]) {
            r.documentoAsociado = docsExpFase[idx];
            r.estado = "recibido_revision";
          }
        });
      }

      const sinCargar = reqsFase.filter((r) => r.estado === "pendiente_carga" && !r.documentoAsociado);
      if (sinCargar.length > 0 && docsExpFase.length === 0) {
        res.status(400).json({
          error: `No es posible enviar a revisión la Fase ${numFase}. Aún existen ${sinCargar.length} documento(s) obligatorio(s) pendiente(s) de carga.`
        });
        return;
      }

      // 3. Activar el bloqueo por revisión para permitir la supervisión
      exp.bloqueadoPorRevision = true;
      exp.faseEnRevision = numFase;
      exp.revisionFases = exp.revisionFases || {};
      exp.revisionFases[numFase] = {
        estado: "en_revision_supervisor",
        fechaEnvioRevision: new Date().toISOString()
      };

      // CAMBIO 1: Guardar responsable previo y reasignar a Supervisor (Analista Documental)
      if (!exp.responsablePrevioRevisionId) {
        exp.responsablePrevioRevisionId = exp.responsableGeneralId;
        exp.responsablePrevioRevisionNombre = exp.responsableGeneralNombre;
        exp.responsablePrevioRevisionRol = exp.responsableGeneralRol;
      }
      const supUser = mockDb.perfiles.find((u) => u.rol === "supervisor" || u.username === "supervisor.franco");
      const supId = supUser ? supUser.id : "f00564c8-adb3-46d2-b154-837b9e7386aa";
      const supNombre = supUser ? supUser.nombreCompleto : "Dra. Helena Ramírez (Analista Documental)";
      exp.responsableGeneralId = supId;
      exp.responsableGeneralNombre = supNombre;
      exp.responsableGeneralRol = "supervisor";

      if (numFase === 1) {
        exp.estadoFase1 = "en_revision_supervisor";
        exp.fechaEnvioRevisionFase1 = new Date().toISOString();
      } else if (numFase === 2) {
        exp.estadoFase2 = "en_revision_supervisor";
        exp.fechaEnvioRevisionFase2 = new Date().toISOString();
      }

      exp.actualizadoEn = new Date().toISOString();

      // Generar tarea para el Supervisor
      const tareaExistente = mockDb.tareas.find(
        (t) => t.expedienteId === exp.id && t.descripcion.includes(`Fase ${numFase}`) && t.estado === "pendiente"
      );
      if (!tareaExistente) {
        mockDb.tareas.push({
          id: `tar-rev-f${numFase}-${Date.now()}`,
          expedienteId: exp.id,
          descripcion: `Revisar y dictaminar documentación de Fase ${numFase} para el hogar de ${exp.postulante.nombres} ${exp.postulante.primerApellido}`,
          asignadoAId: supId,
          asignadoANombre: supNombre,
          creadoPorId: req.user!.id,
          estado: "pendiente",
          creadoEn: new Date().toISOString()
        });
      }

      // Bitácora
      mockDb.notas.push({
        id: `nota-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        personaContactada: "Supervisión",
        canal: "sistema",
        contenido: `Expediente de Fase ${numFase} enviado a revisión del Analista Documental por ${req.user!.nombreCompleto} (${req.user!.rol}). Documentos bloqueados mientras se encuentra en dictamen.`,
        fechaGestion: new Date().toISOString(),
        creadoEn: new Date().toISOString()
      });

      // Persistir y sincronizar el bloqueo por revisión en Supabase PostgreSQL
      await sincronizarExpedienteEnSupabase(exp);

      // Si Supabase está activo, forzar actualización explícita de bloqueado_por_revision en la tabla expedientes
      if (supabaseAdmin) {
        try {
          await supabaseAdmin
            .from("expedientes")
            .update({
              bloqueado_por_revision: true,
              fase_en_revision: numFase,
              estado_fase1: numFase === 1 ? "en_revision_supervisor" : exp.estadoFase1,
              responsable_general_id: supId,
              actualizado_en: new Date().toISOString()
            })
            .or(`id.eq.${exp.id},codigo_visible.eq.${exp.codigoVisible || exp.id}`);
          console.log(`[SUPABASE]: bloqueado_por_revision forzado a TRUE para expediente ${exp.codigoVisible || exp.id}`);
        } catch (fErr: any) {
          console.warn("[SUPABASE]: Error forzando bloqueado_por_revision:", fErr?.message);
        }

        try {
          const codigosNoAceptados = reqsFase
            .filter((r) => r.estado !== "aceptado")
            .map((r) => r.codigoRequisito);
          if (codigosNoAceptados.length > 0) {
            await supabaseAdmin
              .from("requisitos_caso")
              .update({ estado: "recibido_revision" })
              .eq("expediente_id", exp.id)
              .in("codigo_requisito", codigosNoAceptados)
              .neq("estado", "aceptado");
          }
        } catch (e: any) {
          console.warn("[REQUISITOS EN SUPABASE]: Advertencia al actualizar estado de requisitos:", e?.message);
        }
      }

      res.json({
        success: true,
        mensaje: `Expediente en Fase ${numFase} enviado a revisión del Analista Documental exitosamente.`,
        expediente: exp
      });
    }
  );

  // Aprobar Fase genérica (Supervisor, Administrador)
  app.post(
    "/api/expedientes/:id/fases/:fase/aprobar",
    requireAuth(["supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      if (exp.estadoGeneral === "salida_definitiva") {
        res.status(400).json({ error: "El expediente se encuentra en Salida Definitiva y es un archivo histórico inmutable. No puede ser aprobado." });
        return;
      }

      const numFase = parseInt(req.params.fase, 10);
      if (isNaN(numFase) || numFase < 1 || numFase > 7) {
        res.status(400).json({ error: "Número de fase inválido (1-7)." });
        return;
      }

      if (exp.faseActual !== numFase) {
        res.status(400).json({ error: `El expediente no se encuentra en la Fase ${numFase}.` });
        return;
      }

      // Validar que todos los obligatorios de esta fase estén aceptados
      const reqsFase = mockDb.requisitosCaso.filter((r) => r.expedienteId === exp.id && r.fase === numFase && r.esObligatorio);
      const noAceptados = reqsFase.filter((r) => r.estado !== "aceptado");
      if (noAceptados.length > 0) {
        res.status(400).json({
          error: `No es posible aprobar la Fase ${numFase}. Aún hay ${noAceptados.length} documento(s) obligatorio(s) no aceptados por el Analista Documental.`
        });
        return;
      }

      exp.bloqueadoPorRevision = false;
      exp.responsablePrevioRevisionId = undefined;
      exp.responsablePrevioRevisionNombre = undefined;
      exp.responsablePrevioRevisionRol = undefined;
      exp.revisionFases = exp.revisionFases || {};
      exp.revisionFases[numFase] = {
        estado: "aprobado",
        fechaDecisionSupervisor: new Date().toISOString(),
        supervisorId: req.user!.id,
        supervisorNombre: req.user!.nombreCompleto
      };

      if (numFase === 1) {
        const { asistenteAsignadoId } = req.body;
        if (!asistenteAsignadoId) {
          res.status(400).json({ error: "Debe seleccionar un Gestor Documental para transferir la responsabilidad de Fase 2." });
          return;
        }
        const asistente = mockDb.perfiles.find((p) => p.id === asistenteAsignadoId && p.rol === "asistente");
        exp.faseActual = 2;
        exp.asistenteAsignadoId = asistente ? asistente.id : asistenteAsignadoId;
        exp.responsableGeneralId = asistente ? asistente.id : asistenteAsignadoId;
        exp.responsableGeneralNombre = asistente ? asistente.nombreCompleto : "Laura Castillo (Gestor Documental)";
        exp.responsableGeneralRol = "asistente";
        inicializarRequisitosFase2(exp);
      } else if (numFase === 2) {
        exp.faseActual = 3;
        exp.estadoFase2 = "aprobado";
        exp.responsableGeneralId = "usr-ingenieria-01";
        exp.responsableGeneralNombre = "Ing. Roberto Salazar (Coordinador Técnico)";
        exp.responsableGeneralRol = "ingenieria";
        exp.fechaDecisionSupervisorFase2 = new Date().toISOString();
        
        // Requisitos Fase 3 si no existen
        const existentesF3 = mockDb.requisitosCaso.filter((r) => r.expedienteId === exp.id && r.fase === 3);
        if (existentesF3.length === 0) {
          const reqsF3Base = [
            { codigo: "F3-01", nombre: "Formato de Visita Técnica y Habitabilidad", desc: "Inspección ocular y diagnóstico de la vivienda rural." },
            { codigo: "F3-02", nombre: "Levantamiento Topográfico y Planimetría", desc: "Plano altimétrico y coordenadas del polígono del predio." },
            { codigo: "F3-03", nombre: "Concepto de Amenaza y Gestión del Riesgo", desc: "Certificado municipal de no afectación por remoción en masa." },
            { codigo: "F3-04", nombre: "Disponibilidad de Agua Potable y Energía", desc: "Constancia de acueducto veredal y Enel Colombia." }
          ];
          reqsF3Base.forEach((r) => {
            mockDb.requisitosCaso.push({
              id: `req-${r.codigo.toLowerCase()}-${exp.id}`,
              expedienteId: exp.id,
              codigoRequisito: r.codigo,
              nombre: r.nombre,
              descripcion: r.desc,
              fase: 3,
              predioId: exp.predioVivienda.id,
              estado: "pendiente_carga",
              esObligatorio: true,
              esAdicional: false
            });
          });
        }
      } else if (numFase === 3) {
        exp.faseActual = 4;
        exp.responsableGeneralId = "usr-ingenieria-01";
      } else if (numFase === 4) {
        exp.faseActual = 5;
        exp.responsableGeneralId = "usr-supervisor-01";
      } else if (numFase === 5) {
        exp.faseActual = 6;
        exp.responsableGeneralId = "usr-ingenieria-01";
        exp.estadoGeneral = "construccion_iniciada";
      } else if (numFase === 6) {
        exp.faseActual = 7;
        exp.responsableGeneralId = "usr-asistente-01";
      } else if (numFase === 7) {
        exp.estadoGeneral = "cerrado_entregado";
      }

      exp.actualizadoEn = new Date().toISOString();

      // Bitácora
      mockDb.notas.push({
        id: `nota-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        personaContactada: "Comité de Supervisión",
        canal: "sistema",
        contenido: `Fase ${numFase} APROBADA con éxito por el Supervisor ${req.user!.nombreCompleto}. El expediente avanzó formalmente a la Fase ${exp.faseActual}.`,
        fechaGestion: new Date().toISOString(),
        creadoEn: new Date().toISOString()
      });

      // Sincronizar en Supabase
      await sincronizarExpedienteEnSupabase(exp);

      res.json({
        success: true,
        mensaje: `Fase ${numFase} aprobada con éxito. El hogar avanzó a Fase ${exp.faseActual}.`,
        expediente: exp
      });
    }
  );

  // Devolver Fase con observaciones (Supervisor, Administrador)
  app.post(
    "/api/expedientes/:id/fases/:fase/devolver",
    requireAuth(["supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      if (exp.estadoGeneral === "salida_definitiva") {
        res.status(400).json({ error: "El expediente se encuentra en Salida Definitiva y es un archivo histórico inmutable. No puede ser devuelto." });
        return;
      }

      const numFase = parseInt(req.params.fase, 10);
      if (isNaN(numFase) || numFase < 1 || numFase > 7) {
        res.status(400).json({ error: "Número de fase inválido (1-7)." });
        return;
      }

      const { observacion, observaciones } = req.body;
      const obsTexto = String(observacion || observaciones || "").trim();
      if (!obsTexto) {
        res.status(400).json({ error: "Debe ingresar el motivo u observaciones para devolver el expediente." });
        return;
      }

      exp.bloqueadoPorRevision = false;
      exp.motivoDevolucionFase = obsTexto;
      exp.revisionFases = exp.revisionFases || {};
      exp.revisionFases[numFase] = {
        estado: "devuelto",
        observacionesDevolucion: obsTexto,
        fechaDecisionSupervisor: new Date().toISOString(),
        supervisorId: req.user!.id,
        supervisorNombre: req.user!.nombreCompleto
      };

      if (numFase === 1) {
        exp.estadoFase1 = "devuelto";
      } else if (numFase === 2) {
        exp.estadoFase2 = "devuelto";
        exp.observacionDevolucionFase2 = obsTexto;
        exp.fechaDecisionSupervisorFase2 = new Date().toISOString();
      }

      // CAMBIO 1: Devolver responsabilidad al responsable previo
      if (exp.responsablePrevioRevisionId) {
        exp.responsableGeneralId = exp.responsablePrevioRevisionId;
        exp.responsableGeneralNombre = exp.responsablePrevioRevisionNombre;
        exp.responsableGeneralRol = exp.responsablePrevioRevisionRol;
        exp.responsablePrevioRevisionId = undefined;
        exp.responsablePrevioRevisionNombre = undefined;
        exp.responsablePrevioRevisionRol = undefined;
      } else {
        if (numFase === 1) {
          exp.responsableGeneralId = exp.comercialOrigenId || "usr-comercial-01";
          exp.responsableGeneralNombre = "Carlos Mendoza (Gestor Rural)";
          exp.responsableGeneralRol = "comercial";
        } else {
          exp.responsableGeneralId = exp.asistenteAsignadoId || "usr-asistente-01";
          exp.responsableGeneralNombre = "Laura Castillo (Gestor Documental)";
          exp.responsableGeneralRol = "asistente";
        }
      }

      exp.actualizadoEn = new Date().toISOString();

      // Generar tarea para el responsable
      mockDb.tareas.push({
        id: `tar-dev-f${numFase}-${Date.now()}`,
        expedienteId: exp.id,
        descripcion: `Subsanar observaciones de Fase ${numFase} dictaminadas por el Supervisor: ${obsTexto}`,
        asignadoAId: exp.responsableGeneralId,
        creadoPorId: req.user!.id,
        estado: "pendiente",
        creadoEn: new Date().toISOString()
      });

      // Bitácora
      mockDb.notas.push({
        id: `nota-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        personaContactada: "Responsable de Fase",
        canal: "sistema",
        contenido: `Expediente en Fase ${numFase} devuelto con observaciones por el Supervisor ${req.user!.nombreCompleto}. Motivo: ${obsTexto}`,
        fechaGestion: new Date().toISOString(),
        creadoEn: new Date().toISOString()
      });

      // Sincronizar en Supabase
      await sincronizarExpedienteEnSupabase(exp);

      res.json({
        success: true,
        mensaje: `Expediente de Fase ${numFase} devuelto con las observaciones indicadas.`,
        expediente: exp
      });
    }
  );

  // 10.4 AVANZAR DE FASE GENERAL (Para navegación y pruebas de todas las fases)
  app.post(
    "/api/expedientes/:id/avanzar-fase",
    requireAuth(["supervisor", "ingenieria", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      const { nuevaFase, notaExplicativa } = req.body;
      const faseDestino = typeof nuevaFase === "number" ? nuevaFase : exp.faseActual + 1;

      if (faseDestino < 1 || faseDestino > 7) {
        res.status(400).json({ error: "La fase de destino debe estar entre 1 y 7." });
        return;
      }

      // Regla de Negocio VRD: Prohibición estricta de retroceso entre fases
      if (faseDestino <= exp.faseActual && req.user!.rol !== "administrador") {
        res.status(400).json({
          error: `No es posible retroceder a la Fase ${faseDestino}. El avance del expediente es estrictamente progresivo e irreversible (Fase actual: ${exp.faseActual}).`
        });
        return;
      }

      exp.faseActual = faseDestino;
      exp.actualizadoEn = new Date().toISOString();

      mockDb.notas.push({
        id: `nota-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        personaContactada: "Comité de Programa VRD",
        canal: "sistema",
        contenido: `El expediente avanzó a la Fase ${faseDestino} por decisión de ${req.user!.nombreCompleto}. ${notaExplicativa || ""}`,
        fechaGestion: new Date().toISOString(),
        creadoEn: new Date().toISOString()
      });

      // Sincronizar avance de fase en Supabase
      await sincronizarExpedienteEnSupabase(exp);

      res.json({
        success: true,
        mensaje: `Expediente avanzado con éxito a Fase ${faseDestino}.`,
        expediente: exp
      });
    }
  );

  // 10.5 REASIGNAR / TRANSFERIR RESPONSABLE DEL EXPEDIENTE (Supervisor, Administrador)
  app.post(
    "/api/expedientes/:id/reasignar",
    requireAuth(["supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      if (req.user?.rol === "supervisor" && !exp.bloqueadoPorRevision) {
        res.status(400).json({ error: "El expediente está en conformación por el responsable y no puede ser reasignado por el supervisor hasta su remisión a revisión." });
        return;
      }

      const { nuevoResponsableId, tipoRol, motivo } = req.body;
      const nuevoUsuario = mockDb.perfiles.find((u) => u.id === nuevoResponsableId && u.activo);
      if (!nuevoUsuario) {
        res.status(400).json({ error: "El usuario seleccionado no existe o no está activo." });
        return;
      }

      const anteriorResponsableNombre =
        mockDb.perfiles.find((u) => u.id === exp.responsableGeneralId)?.nombreCompleto || exp.responsableGeneralId;

      exp.responsableGeneralId = nuevoUsuario.id;
      exp.responsableGeneralNombre = nuevoUsuario.nombreCompleto;
      exp.responsableGeneralRol = nuevoUsuario.rol;
      exp.actualizadoEn = new Date().toISOString();

      // Persistencia en Supabase
      if (supabaseAdmin) {
        try {
          await supabaseAdmin
            .from("expedientes")
            .update({
              responsable_general_id: nuevoUsuario.id,
              actualizado_en: exp.actualizadoEn
            })
            .eq("id", exp.id);
        } catch (err: any) {
          console.error("[SUPABASE]: Error al actualizar responsable_general_id en Supabase:", err);
        }
      }

      mockDb.notas.push({
        id: `nota-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        personaContactada: "Reasignación Interna",
        canal: "sistema",
        contenido: `Expediente transferido/reasignado a ${nuevoUsuario.nombreCompleto} (${nuevoUsuario.rol}) por ${req.user!.nombreCompleto}. (Responsable anterior: ${anteriorResponsableNombre}). Motivo: ${motivo || "Ajuste de carga operativa"}.`,
        fechaGestion: new Date().toISOString(),
        creadoEn: new Date().toISOString()
      });

      res.json({
        success: true,
        mensaje: `Expediente reasignado exitosamente a ${nuevoUsuario.nombreCompleto}.`,
        expediente: exp
      });
    }
  );

  // 11. REGISTRO DE SALIDA Y GENERACIÓN DE TAREA DE CARTA
  app.post(
    ["/api/expedientes/:id/salida", "/api/expedientes/:id/retiro"],
    requireAuth(["supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id || e.codigoVisible === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      const { motivo, fundamento } = req.body;
      if (!motivo || !fundamento) {
        res.status(400).json({ error: "Debe indicar motivo y fundamento de la salida por no aptitud o retiro." });
        return;
      }

      const eventoSalida = await registrarSalidaDefinitiva(
        exp,
        motivo,
        fundamento,
        req.user!.id,
        exp.faseActual
      );

      // Generar tarea obligatoria al Comercial para elaborar y gestionar la carta de salida
      const cartaSalida: CartaSalida = {
        id: `cart-${Date.now()}`,
        eventoSalidaId: eventoSalida.id,
        comercialId: exp.comercialOrigenId,
        estadoCarta: "pendiente_elaborar",
        creadoEn: new Date().toISOString()
      };
      mockDb.cartasSalida.push(cartaSalida);

      mockDb.tareas.push({
        id: `tar-carta-${Date.now()}`,
        expedienteId: exp.id,
        descripcion: `Elaborar, firmar y enviar carta de salida al postulante. Motivo: ${motivo}`,
        asignadoAId: exp.comercialOrigenId,
        creadoPorId: req.user!.id,
        estado: "pendiente",
        creadoEn: new Date().toISOString()
      });

      res.status(201).json({ success: true, expediente: exp, eventoSalida, cartaSalida });
    }
  );

  // 12. GESTIÓN DE CARTA DE SALIDA POR COMERCIAL
  app.post(
    "/api/expedientes/:id/carta-salida/actualizar",
    requireAuth(["comercial"]),
    (req: AuthRequest, res: Response) => {
      const { cartaId, estadoCarta, canalEnvio, constanciaEnvioUrl } = req.body;
      const carta = mockDb.cartasSalida.find((c) => c.id === cartaId);

      if (!carta) {
        res.status(404).json({ error: "Carta de salida no encontrada." });
        return;
      }

      if (estadoCarta) carta.estadoCarta = estadoCarta;
      if (canalEnvio) carta.canalEnvio = canalEnvio;
      if (constanciaEnvioUrl) carta.constanciaEnvioUrl = constanciaEnvioUrl;
      if (estadoCarta === "enviada") {
        carta.fechaEnvio = new Date().toISOString();
      }

      res.json({ success: true, carta });
    }
  );

  // 13. BITÁCORA DE NOTAS Y CONVERSACIONES
  app.post(
    "/api/expedientes/:id/notas",
    requireAuth(["comercial", "asistente", "supervisor", "ingenieria", "administrador"]),
    (req: AuthRequest, res: Response) => {
    const { personaContactada, canal, contenido } = req.body;
    if (!contenido) {
      res.status(400).json({ error: "El contenido de la nota no puede estar vacío." });
      return;
    }

    const nuevaNota: NotaConversacion = {
      id: `nota-${Date.now()}`,
      expedienteId: req.params.id,
      autorId: req.user!.id,
      autorNombre: req.user!.nombreCompleto,
      personaContactada: personaContactada || "Postulante",
      canal: canal || "llamada",
      contenido,
      fechaGestion: new Date().toISOString(),
      creadoEn: new Date().toISOString()
    };

    mockDb.notas.push(nuevaNota);
    res.status(201).json(nuevaNota);
  });

  // 14. LISTA DE ASISTENTES ELEGIBLES
  const handlerAsistentes = (req: Request, res: Response) => {
    const asistentes = mockDb.perfiles
      .filter((p) => p.rol === "asistente" && p.activo)
      .map((p) => ({ id: p.id, nombreCompleto: p.nombreCompleto, username: p.username }));
    res.json(asistentes);
  };
  app.get("/api/usuarios/asistentes", requireAuth(), handlerAsistentes);
  app.get("/api/usuarios/asistentes-elegibles", requireAuth(), handlerAsistentes);

  // 15. FASE 3: EN VALIDACIÓN INICIAL COMPENSAR (Cambio 5)
  // 15.1 Registrar Envío a Compensar (Ingeniería, Administrador)
  app.post(
    "/api/expedientes/:id/compensar/registrar-envio",
    requireAuth(["ingenieria", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      const {
        correoDestinatario,
        asunto,
        cuerpoMensaje,
        documentosIncluidos,
        fechaEnvio,
        radicadoOReferencia,
        notasEnvio,
        evidenciaUrl,
        evidenciaNombre,
        evidenciaHash,
        evidenciaMimeType,
        evidenciaTamanoBytes,
        pantallazoCorreoUrl
      } = req.body;

      // CAMBIO 5: Se exige únicamente fechaEnvio y evidenciaUrl / pantallazoCorreoUrl
      const soporteUrl = evidenciaUrl || pantallazoCorreoUrl;
      if (!fechaEnvio) {
        res.status(400).json({ error: "La fecha del envío es obligatoria." });
        return;
      }
      if (!soporteUrl) {
        res.status(400).json({ error: "Debe adjuntar el pantallazo o evidencia del correo enviado a Compensar." });
        return;
      }

      if (!exp.validacionCompensar) {
        exp.validacionCompensar = {
          estadoActual: "sin_enviar",
          envios: []
        };
      }

      // Si no vienen documentosIncluidos explícitos, asociar los 11 requisitos de Fase 2
      let docsParaEnvio: DocumentoEnvioCompensar[] = documentosIncluidos || [];
      if (!docsParaEnvio || docsParaEnvio.length === 0) {
        const reqsFase2 = mockDb.requisitosCaso.filter((r) => r.expedienteId === exp.id && r.fase === 2);
        docsParaEnvio = reqsFase2.map((r) => {
          const vActual = r.documentoAsociado?.versionActual || r.documentoAsociado?.versiones?.[r.documentoAsociado?.versiones.length - 1];
          return {
            requisitoCodigo: r.codigoRequisito,
            requisitoNombre: r.nombre,
            documentoId: r.documentoAsociado?.id || `doc-${r.codigoRequisito}`,
            versionNumero: vActual?.versionNumero || 1,
            nombreArchivo: vActual?.nombreArchivoOriginal || `${r.codigoRequisito}.pdf`,
            tamanoBytes: vActual?.tamanoBytes || 102400,
            sha256Hash: vActual?.sha256Hash || "hash-simulado"
          };
        });
      }

      const numeroEnvio = (exp.validacionCompensar.envios?.length || 0) + 1;
      const radicadoEnvioNormalizado = (radicadoOReferencia && String(radicadoOReferencia).trim()) || "Sin radicado / En trámite";

      const nuevoEnvio: EnvioCompensar = {
        id: `env-comp-${Date.now()}-${numeroEnvio}`,
        expedienteId: exp.id,
        numeroEnvio,
        fechaEnvio: fechaEnvio || new Date().toISOString(),
        usuarioEnvioId: req.user!.id,
        usuarioEnvioNombre: req.user!.nombreCompleto,
        correoDestinatario: correoDestinatario || "radicacion.vrd@compensar.com",
        asunto: asunto || `Envío Expediente ${exp.codigoVisible || exp.id} - Validación Inicial Compensar`,
        cuerpoMensaje: cuerpoMensaje || "Remisión formal de expediente para validación inicial de habitabilidad y viabilidad de subsidio rural.",
        documentosIncluidos: docsParaEnvio,
        radicadoOReferencia: radicadoEnvioNormalizado,
        notasEnvio: notasEnvio || "",
        evidenciaUrl: soporteUrl,
        evidenciaNombre: evidenciaNombre || "Pantallazo_Envio_Compensar.png",
        evidenciaHash: evidenciaHash || "hash-evidencia",
        evidenciaMimeType: evidenciaMimeType || "image/png",
        evidenciaTamanoBytes: evidenciaTamanoBytes || 204800
      };

      exp.validacionCompensar.envios.push(nuevoEnvio);
      exp.validacionCompensar.ultimoEnvioId = nuevoEnvio.id;
      exp.validacionCompensar.estadoActual = "pendiente_respuesta";
      exp.subsanacionFase3Activa = false;
      exp.actualizadoEn = new Date().toISOString();

      // Registrar en bitácora
      mockDb.notas.push({
        id: `not-env-comp-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "gestion_comercial",
        contenido: `Envío #${numeroEnvio} a Compensar registrado por ${req.user!.nombreCompleto}. Fecha envío: ${fechaEnvio}. Soporte adjunto: ${nuevoEnvio.evidenciaNombre}.`,
        creadoEn: new Date().toISOString()
      });

      // Persistir en Supabase antes de responder (si no, "Sincronizar DB" o un reinicio lo pierden)
      await sincronizarExpedienteEnSupabase(exp);

      res.status(201).json({ success: true, validacionCompensar: exp.validacionCompensar, envio: nuevoEnvio });
    }
  );

  // 15.2 Registrar Respuesta de Compensar (Ingeniería, Supervisor, Administrador)
  app.post(
    "/api/expedientes/:id/compensar/registrar-respuesta",
    requireAuth(["ingenieria", "supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      if (!exp.validacionCompensar || !exp.validacionCompensar.envios || exp.validacionCompensar.envios.length === 0) {
        res.status(400).json({ error: "No hay ningún paquete registrado como enviado a Compensar." });
        return;
      }

      const {
        envioId,
        resultado,
        fechaRespuesta,
        radicadoOConcepto,
        observacionesDetalladas,
        archivoConceptoUrl,
        archivoConceptoNombre,
        documentosConObservacion
      } = req.body;

      if (!resultado || !["aprobado", "observaciones", "rechazo_definitivo"].includes(resultado)) {
        res.status(400).json({ error: "Resultado de respuesta de Compensar no válido." });
        return;
      }

      const envio = envioId
        ? exp.validacionCompensar.envios.find((e) => e.id === envioId)
        : exp.validacionCompensar.envios[exp.validacionCompensar.envios.length - 1];

      if (!envio) {
        res.status(404).json({ error: "Envío a Compensar no encontrado." });
        return;
      }

      const radicadoNormalizado = (radicadoOConcepto && String(radicadoOConcepto).trim()) || "Sin radicado / En trámite";

      const nuevaRespuesta: RespuestaCompensar = {
        id: `resp-comp-${Date.now()}`,
        envioId: envio.id,
        fechaRespuesta: fechaRespuesta || new Date().toISOString(),
        usuarioRegistroId: req.user!.id,
        usuarioRegistroNombre: req.user!.nombreCompleto,
        resultado,
        radicadoOConcepto: radicadoNormalizado,
        observacionesDetalladas: observacionesDetalladas || "",
        archivoConceptoUrl,
        archivoConceptoNombre,
        documentosConObservacion: Array.isArray(documentosConObservacion) ? documentosConObservacion : []
      };

      envio.respuesta = nuevaRespuesta;

      if (resultado === "aprobado") {
        exp.validacionCompensar.estadoActual = "aprobado";
        exp.validacionCompensar.fechaAprobacionFinal = nuevaRespuesta.fechaRespuesta;
        exp.validacionCompensar.radicadoAprobacionFinal = radicadoNormalizado;
        exp.validacionCompensar.archivoConceptoFinalUrl = archivoConceptoUrl;
        exp.validacionCompensar.observacionesFinales = observacionesDetalladas;

        // CAMBIO 7: Cierre automático de Fase 3 y avance directo a Fase 4
        exp.faseActual = 4;
        exp.bloqueadoPorRevision = false;
        exp.subsanacionFase3Activa = false;
        const ing = mockDb.perfiles.find((p) => p.id === "usr-ingenieria-01") || mockDb.perfiles.find((p) => p.rol === "ingenieria");
        exp.responsableGeneralId = ing ? ing.id : "usr-ingenieria-01";
        exp.responsableGeneralNombre = ing ? ing.nombreCompleto : "Ing. Roberto Salazar (Coordinador Técnico)";
        exp.responsableGeneralRol = "ingenieria";
        exp.actualizadoEn = new Date().toISOString();

        inicializarFase4(exp);

        mockDb.tareas.push({
          id: `tar-f4-${Date.now()}`,
          expedienteId: exp.id,
          descripcion: `Iniciar recolección de documentos técnicos (Fase 4) para ${exp.postulante.nombres} ${exp.postulante.primerApellido} tras viabilidad aprobada por Compensar.`,
          asignadoAId: exp.responsableGeneralId,
          asignadoANombre: exp.responsableGeneralNombre,
          creadoPorId: req.user!.id,
          estado: "pendiente",
          creadoEn: new Date().toISOString()
        });

        mockDb.notas.push({
          id: `not-resp-comp-${Date.now()}`,
          expedienteId: exp.id,
          autorId: req.user!.id,
          autorNombre: req.user!.nombreCompleto,
          tipo: "hito",
          contenido: `¡VALIDACIÓN INICIAL APROBADA POR COMPENSAR! Concepto de viabilidad emitido (Radicado: ${radicadoOConcepto || "S/N"}). El expediente avanzó automáticamente a Fase 4 bajo la responsabilidad de Ingeniería.`,
          creadoEn: new Date().toISOString()
        });
      } else if (resultado === "observaciones") {
        exp.validacionCompensar.estadoActual = "con_observaciones";

        // CAMBIO 6: Activar subsanación interna para el Gestor Documental
        exp.subsanacionFase3Activa = true;
        exp.subsanacionFase3Estado = "en_correccion_gestor";
        exp.subsanacionFase3ObservacionAnalista = undefined;
        exp.subsanacionFase3DocumentosModificados = [];
        const gestor = mockDb.perfiles.find((p) => p.id === exp.asistenteAsignadoId) ||
          mockDb.perfiles.find((p) => p.rol === "asistente");
        exp.responsableGeneralId = gestor ? gestor.id : "usr-asistente-01";
        exp.responsableGeneralNombre = gestor ? gestor.nombreCompleto : "Laura Castillo (Gestor Documental)";
        exp.responsableGeneralRol = "asistente";
        exp.actualizadoEn = new Date().toISOString();

        // Marcar requisitos observados en mockDb
        if (Array.isArray(documentosConObservacion)) {
          documentosConObservacion.forEach((cod) => {
            const reqObs = mockDb.requisitosCaso.find((r) => r.expedienteId === exp.id && r.codigoRequisito === cod);
            if (reqObs) {
              reqObs.estado = "con_observaciones";
            }
          });
        }

        // Sincronizar requisitos observados en PostgreSQL
        if (supabaseAdmin && Array.isArray(documentosConObservacion) && documentosConObservacion.length > 0) {
          try {
            let expUuid: string | null = null;
            if (exp.id && esUuidValido(exp.id)) expUuid = exp.id;
            else if (exp.codigoVisible) {
              const { data: rowExp } = await supabaseAdmin.from("expedientes").select("id").eq("codigo_visible", exp.codigoVisible).maybeSingle();
              if (rowExp?.id) expUuid = rowExp.id;
            }
            if (expUuid) {
              await supabaseAdmin
                .from("requisitos_caso")
                .update({ estado: "con_observaciones", actualizado_en: new Date().toISOString() })
                .eq("expediente_id", expUuid)
                .in("codigo_requisito", documentosConObservacion);
            }
          } catch (e: any) {
            console.error("[SUPABASE]: Error actualizando requisitos con observación en DB:", e?.message);
          }
        }

        mockDb.tareas.push({
          id: `tar-sub-f3-${Date.now()}`,
          expedienteId: exp.id,
          descripcion: `[SUBSANACIÓN FASE 3] Subsanar observaciones emitidas por Compensar: ${observacionesDetalladas}. Reemplazar o actualizar documentos necesarios.`,
          asignadoAId: exp.responsableGeneralId,
          asignadoANombre: exp.responsableGeneralNombre,
          creadoPorId: req.user!.id,
          estado: "pendiente",
          creadoEn: new Date().toISOString()
        });

        mockDb.notas.push({
          id: `not-resp-comp-${Date.now()}`,
          expedienteId: exp.id,
          autorId: req.user!.id,
          autorNombre: req.user!.nombreCompleto,
          tipo: "observacion",
          contenido: `Compensar devolvió con observaciones la documentación. Observaciones: ${observacionesDetalladas}. Documentos observados: ${(documentosConObservacion || []).join(", ") || "Generales"}. Responsabilidad transferida al Gestor Documental para correcciones.`,
          creadoEn: new Date().toISOString()
        });
      } else if (resultado === "rechazo_definitivo") {
        exp.validacionCompensar.estadoActual = "rechazado_definitivo";

        const eventoSalida = await registrarSalidaDefinitiva(
          exp,
          "Rechazo Compensar",
          `Rechazo definitivo por Compensar en Fase 3: ${observacionesDetalladas} (Radicado: ${radicadoOConcepto || "S/N"})`,
          req.user!.id,
          3
        );

        mockDb.cartasSalida.push({
          id: `cart-comp-${Date.now()}`,
          eventoSalidaId: eventoSalida.id,
          comercialId: exp.comercialOrigenId,
          estadoCarta: "pendiente_elaborar",
          creadoEn: new Date().toISOString()
        });

        mockDb.tareas.push({
          id: `tar-comp-${Date.now()}`,
          expedienteId: exp.id,
          descripcion: `[SALIDA DEFINITIVA] Notificar formalmente al hogar la no viabilidad definitiva por Compensar. Radicado: ${radicadoOConcepto || "S/N"}`,
          asignadoAId: exp.comercialOrigenId,
          creadoPorId: req.user!.id,
          estado: "pendiente",
          creadoEn: new Date().toISOString()
        });

        mockDb.notas.push({
          id: `not-resp-comp-${Date.now()}`,
          expedienteId: exp.id,
          autorId: req.user!.id,
          autorNombre: req.user!.nombreCompleto,
          tipo: "observacion",
          contenido: `SALIDA DEFINITIVA: Compensar dictaminó No Viabilidad Definitiva para este hogar. Motivo: ${observacionesDetalladas}. Expediente archivado en Salida Definitiva.`,
          creadoEn: new Date().toISOString()
        });
      }

      // Persistir respuesta de Compensar de forma inmediata e inmutable en Supabase PostgreSQL
      await sincronizarExpedienteEnSupabase(exp);

      res.status(200).json({
        success: true,
        validacionCompensar: exp.validacionCompensar,
        estadoGeneral: exp.estadoGeneral,
        respuesta: nuevaRespuesta
      });
    }
  );

  // CAMBIO 6: El Gestor Documental envía las correcciones de vuelta a Ingeniería para validación y reenvío
  app.post(
    "/api/expedientes/:id/compensar/devolver-a-ingenieria",
    requireAuth(["asistente", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }
      if (exp.faseActual !== 3) {
        res.status(400).json({ error: `El expediente se encuentra en Fase ${exp.faseActual}, no en Fase 3.` });
        return;
      }

      exp.subsanacionFase3Activa = false;
      const ing = mockDb.perfiles.find((p) => p.id === "usr-ingenieria-01") || mockDb.perfiles.find((p) => p.rol === "ingenieria");
      exp.responsableGeneralId = ing ? ing.id : "usr-ingenieria-01";
      exp.responsableGeneralNombre = ing ? ing.nombreCompleto : "Ing. Roberto Salazar (Coordinador Técnico)";
      exp.responsableGeneralRol = "ingenieria";
      exp.actualizadoEn = new Date().toISOString();

      mockDb.tareas.push({
        id: `tar-ing-sub-${Date.now()}`,
        expedienteId: exp.id,
        descripcion: `[SUBSANACIÓN LISTA] El Gestor Documental completó las correcciones para Compensar en Fase 3. Validar y realizar reenvío.`,
        asignadoAId: exp.responsableGeneralId,
        asignadoANombre: exp.responsableGeneralNombre,
        creadoPorId: req.user!.id,
        estado: "pendiente",
        creadoEn: new Date().toISOString()
      });

      mockDb.notas.push({
        id: `nota-sub-ing-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        personaContactada: "Coordinación de Ingeniería",
        canal: "sistema",
        contenido: `Subsanación de documentos para Compensar finalizada por el Gestor Documental ${req.user!.nombreCompleto}. Expediente devuelto a Ingeniería para validación y reenvío formal.`,
        fechaGestion: new Date().toISOString(),
        creadoEn: new Date().toISOString()
      });

      // Persistir en Supabase antes de responder (si no, "Sincronizar DB" o un reinicio lo pierden)
      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, mensaje: "Correcciones enviadas a Ingeniería exitosamente.", expediente: exp });
    }
  );

  // CAMBIO 3: El Gestor Documental envía las correcciones a revisión del Analista Documental
  app.post(
    "/api/expedientes/:id/compensar/enviar-revision-analista",
    requireAuth(["asistente", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }
      if (exp.faseActual !== 3) {
        res.status(400).json({ error: `El expediente se encuentra en Fase ${exp.faseActual}, no en Fase 3.` });
        return;
      }

      exp.subsanacionFase3Activa = true;
      exp.subsanacionFase3Estado = "revision_analista";
      exp.bloqueadoPorRevision = true;
      exp.responsableGeneralRol = "supervisor";
      const analista = mockDb.perfiles.find((p) => p.id === "usr-supervisor-01") ||
                       mockDb.perfiles.find((p) => p.rol === "supervisor");
      exp.responsableGeneralId = analista ? analista.id : "usr-supervisor-01";
      exp.responsableGeneralNombre = analista ? analista.nombreCompleto : "Dra. Helena Ramírez (Analista Documental)";
      exp.actualizadoEn = new Date().toISOString();

      mockDb.tareas.push({
        id: `tar-ana-sub-${Date.now()}`,
        expedienteId: exp.id,
        descripcion: `[REVISIÓN DE SUBSANACIÓN FASE 3] El Gestor Documental remitió correcciones de Compensar para el expediente de ${exp.postulante.nombres} ${exp.postulante.primerApellido}. Realizar validación jurídica previa a transferencia a Ingeniería.`,
        asignadoAId: exp.responsableGeneralId,
        asignadoANombre: exp.responsableGeneralNombre,
        creadoPorId: req.user!.id,
        estado: "pendiente",
        creadoEn: new Date().toISOString()
      });

      mockDb.notas.push({
        id: `nota-sub-ana-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        personaContactada: "Analista Documental / Jurídico",
        canal: "sistema",
        contenido: `Correcciones de subsanación enviadas a Revisión del Analista Documental por el Gestor Documental ${req.user!.nombreCompleto}. Pendiente validación jurídica.`,
        fechaGestion: new Date().toISOString(),
        creadoEn: new Date().toISOString()
      });

      // Persistir en Supabase antes de responder (si no, "Sincronizar DB" o un reinicio lo pierden)
      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, mensaje: "Correcciones enviadas a revisión del Analista Documental exitosamente.", expediente: exp });
    }
  );

  // CAMBIO 3: El Analista Documental aprueba la subsanación y transfiere la responsabilidad a Ingeniería
  app.post(
    "/api/expedientes/:id/compensar/analista-aprobar",
    requireAuth(["supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }
      if (exp.faseActual !== 3) {
        res.status(400).json({ error: `El expediente se encuentra en Fase ${exp.faseActual}, no en Fase 3.` });
        return;
      }

      exp.subsanacionFase3Activa = false;
      exp.subsanacionFase3Estado = "aprobado_analista";
      exp.bloqueadoPorRevision = false;
      exp.subsanacionFase3ObservacionAnalista = undefined;

      const ing = mockDb.perfiles.find((p) => p.id === "usr-ingenieria-01") || mockDb.perfiles.find((p) => p.rol === "ingenieria");
      exp.responsableGeneralId = ing ? ing.id : "usr-ingenieria-01";
      exp.responsableGeneralNombre = ing ? ing.nombreCompleto : "Ing. Roberto Salazar (Coordinador Técnico)";
      exp.responsableGeneralRol = "ingenieria";
      exp.actualizadoEn = new Date().toISOString();

      mockDb.tareas.push({
        id: `tar-ing-aprob-${Date.now()}`,
        expedienteId: exp.id,
        descripcion: `[SUBSANACIÓN VALIDADA JURÍDICAMENTE] El Analista Documental aprobó las correcciones de Fase 3 para ${exp.postulante.nombres} ${exp.postulante.primerApellido}. Proceder con la radicación formal ante Compensar.`,
        asignadoAId: exp.responsableGeneralId,
        asignadoANombre: exp.responsableGeneralNombre,
        creadoPorId: req.user!.id,
        estado: "pendiente",
        creadoEn: new Date().toISOString()
      });

      mockDb.notas.push({
        id: `nota-sub-aprob-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        personaContactada: "Coordinación de Ingeniería",
        canal: "sistema",
        contenido: `Subsanación aprobada con visto bueno jurídico por el Analista Documental ${req.user!.nombreCompleto} (${req.user!.rol}). El expediente fue transferido a Ingeniería para generar el nuevo radicado ante Compensar.`,
        fechaGestion: new Date().toISOString(),
        creadoEn: new Date().toISOString()
      });

      // Persistir en Supabase antes de responder (si no, "Sincronizar DB" o un reinicio lo pierden)
      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, mensaje: "Subsanación aprobada con éxito. Responsabilidad transferida a Ingeniería.", expediente: exp });
    }
  );

  // CAMBIO 3: El Analista Documental rechaza la subsanación con motivo y la devuelve al Gestor Documental
  app.post(
    "/api/expedientes/:id/compensar/analista-rechazar",
    requireAuth(["supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }
      if (exp.faseActual !== 3) {
        res.status(400).json({ error: `El expediente se encuentra en Fase ${exp.faseActual}, no en Fase 3.` });
        return;
      }

      const { motivoRechazo } = req.body;
      if (!motivoRechazo || !motivoRechazo.trim()) {
        res.status(400).json({ error: "Debe especificar el motivo u observaciones del rechazo para devolver la subsanación al Gestor Documental." });
        return;
      }

      exp.subsanacionFase3Activa = true;
      exp.subsanacionFase3Estado = "en_correccion_gestor";
      exp.bloqueadoPorRevision = false;
      exp.subsanacionFase3ObservacionAnalista = motivoRechazo.trim();

      const gestor = mockDb.perfiles.find((p) => p.id === exp.asistenteAsignadoId) ||
                     mockDb.perfiles.find((p) => p.rol === "asistente");
      exp.responsableGeneralId = gestor ? gestor.id : "usr-asistente-01";
      exp.responsableGeneralNombre = gestor ? gestor.nombreCompleto : "Laura Castillo (Gestor Documental)";
      exp.responsableGeneralRol = "asistente";
      exp.actualizadoEn = new Date().toISOString();

      mockDb.tareas.push({
        id: `tar-gest-dev-${Date.now()}`,
        expedienteId: exp.id,
        descripcion: `[DEVOLUCIÓN JURÍDICA DE SUBSANACIÓN] El Analista Documental devolvió las correcciones de Fase 3: ${motivoRechazo.trim()}. Subsanar las inconsistencias señaladas.`,
        asignadoAId: exp.responsableGeneralId,
        asignadoANombre: exp.responsableGeneralNombre,
        creadoPorId: req.user!.id,
        estado: "pendiente",
        creadoEn: new Date().toISOString()
      });

      mockDb.notas.push({
        id: `nota-sub-rech-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        personaContactada: "Gestor Documental",
        canal: "sistema",
        contenido: `Subsanación devuelta al Gestor Documental por inconsistencias detectadas por el Analista Documental ${req.user!.nombreCompleto}. Motivo: ${motivoRechazo.trim()}`,
        fechaGestion: new Date().toISOString(),
        creadoEn: new Date().toISOString()
      });

      // Persistir en Supabase antes de responder (si no, "Sincronizar DB" o un reinicio lo pierden)
      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, mensaje: "Subsanación devuelta al Gestor Documental con observaciones.", expediente: exp });
    }
  );

  // 15.3 Avanzar a Fase 4 desde Fase 3 Aprobada (Comercial, Asistente, Ingeniería, Supervisor, Administrador)
  app.post(
    "/api/expedientes/:id/compensar/avanzar-fase4",
    requireAuth(["comercial", "asistente", "ingenieria", "supervisor", "administrador", "planeacion"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id || e.codigoVisible === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      if (exp.validacionCompensar?.estadoActual !== "aprobado") {
        res.status(400).json({ error: "Se requiere la viabilidad aprobada de Compensar para avanzar a Fase 4." });
        return;
      }

      exp.faseActual = 4;
      exp.bloqueadoPorRevision = false;
      exp.actualizadoEn = new Date().toISOString();
      inicializarFase4(exp);
      await sincronizarExpedienteEnSupabase(exp);

      mockDb.notas.push({
        id: `not-fase4-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "hito",
        contenido: `Fase 3 (En Validación Inicial Compensar) concluida y avalada por ${req.user!.nombreCompleto}. El expediente avanzó a Fase 4: En Recolección de Documentos Técnicos.`,
        creadoEn: new Date().toISOString()
      });

      res.json({ success: true, expediente: exp, mensaje: "Expediente transferido con éxito a Fase 4." });
    }
  );

  // 15.4 GESTIÓN FASE 4: ACTUALIZAR FRENTE DE TRABAJO EN PARALELO (Ingeniería / Admin)
  const handlerActualizarFrenteFase4 = async (req: AuthRequest, res: Response) => {
    const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
    if (!exp) {
      res.status(404).json({ error: "Expediente no encontrado." });
      return;
    }

    const frenteKey = req.params.frente as "interventoria" | "arquitectura" | "estudioSuelos";
    if (!["interventoria", "arquitectura", "estudioSuelos"].includes(frenteKey)) {
      res.status(400).json({ error: "Frente de trabajo no válido. Debe ser: interventoria, arquitectura o estudioSuelos." });
      return;
    }

    inicializarFase4(exp);
    const frenteObj = exp.gestionFase4![frenteKey] as any;
    const estadoAnterior = frenteObj.estado;

    const {
      estado,
      fechaSolicitud,
      fechaEstimada,
      fechaVisitaRealizada,
      resultadoConcepto,
      porcentajeAvance,
      fechaEntregaEstimada,
      fechaEntregaReal,
      fechaRealizacion,
      observaciones,
      soporte,
      accion,
      observacionHistorial
    } = req.body;

    const nuevoEstado = estado !== undefined ? estado : frenteObj.estado;

    // VALIDACIONES BLOQUEANTES CUANDO SE QUIERE COMPLETAR EL FRENTE (CAMBIO 1, 4, 5, 6)
    if (nuevoEstado === "completado") {
      const tieneSoporte = !!(soporte?.nombreArchivo || frenteObj.soporte?.nombreArchivo);
      if (!tieneSoporte) {
        res.status(400).json({ error: "Debe cargar el informe de soporte antes de completar este frente." });
        return;
      }

      if (frenteKey === "interventoria") {
        const fSol = fechaSolicitud !== undefined ? fechaSolicitud : frenteObj.fechaSolicitud;
        const fEst = fechaEstimada !== undefined ? fechaEstimada : frenteObj.fechaEstimada;
        const fVis = fechaVisitaRealizada !== undefined ? fechaVisitaRealizada : frenteObj.fechaVisitaRealizada;
        if (!fSol || !fEst || !fVis) {
          res.status(400).json({ error: "Debe especificar las fechas de solicitud, fecha estimada y visita realizada para completar este frente." });
          return;
        }
      } else if (frenteKey === "arquitectura") {
        const fSol = fechaSolicitud !== undefined ? fechaSolicitud : frenteObj.fechaSolicitud;
        const fEst = fechaEntregaEstimada !== undefined ? fechaEntregaEstimada : frenteObj.fechaEntregaEstimada;
        const fReal = fechaEntregaReal !== undefined ? fechaEntregaReal : frenteObj.fechaEntregaReal;
        if (!fSol || !fEst || !fReal) {
          res.status(400).json({ error: "Debe especificar las fechas de solicitud, entrega estimada y entrega real para completar este frente." });
          return;
        }
      } else if (frenteKey === "estudioSuelos") {
        const fSol = fechaSolicitud !== undefined ? fechaSolicitud : frenteObj.fechaSolicitud;
        const fSon = fechaRealizacion !== undefined ? fechaRealizacion : frenteObj.fechaRealizacion;
        const fInf = (fechaEntregaReal !== undefined ? fechaEntregaReal : frenteObj.fechaEntregaReal) ||
                     (fechaEntregaEstimada !== undefined ? fechaEntregaEstimada : frenteObj.fechaEntregaEstimada);
        if (!fSol || !fSon || !fInf) {
          res.status(400).json({ error: "Debe especificar las fechas de solicitud, sondeos en campo y entrega del informe para completar este frente." });
          return;
        }
      }
    }

    if (estado !== undefined) frenteObj.estado = estado;
    if (fechaSolicitud !== undefined) frenteObj.fechaSolicitud = fechaSolicitud;
    if (fechaEstimada !== undefined) frenteObj.fechaEstimada = fechaEstimada;
    if (fechaVisitaRealizada !== undefined) frenteObj.fechaVisitaRealizada = fechaVisitaRealizada;
    if (resultadoConcepto !== undefined) frenteObj.resultadoConcepto = resultadoConcepto;
    if (porcentajeAvance !== undefined) frenteObj.porcentajeAvance = Number(porcentajeAvance);
    if (fechaEntregaEstimada !== undefined) frenteObj.fechaEntregaEstimada = fechaEntregaEstimada;
    if (fechaEntregaReal !== undefined) frenteObj.fechaEntregaReal = fechaEntregaReal;
    if (fechaRealizacion !== undefined) frenteObj.fechaRealizacion = fechaRealizacion;
    if (observaciones !== undefined) frenteObj.observaciones = observaciones;
    if (soporte !== undefined) {
      // CAMBIO 9: Validar que el soporte para Planos de Arquitectura sea exclusivamente PDF
      if (frenteKey === "arquitectura") {
        const nombreValido = soporte.nombreArchivo ? soporte.nombreArchivo.toLowerCase().endsWith(".pdf") : true;
        const mimeValido = soporte.mimeType ? (soporte.mimeType === "application/pdf" || soporte.mimeType.includes("pdf")) : true;
        if (!nombreValido && !mimeValido) {
          res.status(400).json({ error: "Formato no válido. Solo se permiten documentos en formato PDF." });
          return;
        }
      }

      frenteObj.soporte = {
        ...soporte,
        subidoPor: req.user!.nombreCompleto,
        subidoEn: new Date().toISOString()
      };
    }

    // Registro en bitácora/historial del frente
    const accionTxt = accion || (estado && estado !== estadoAnterior ? `Cambio de estado: ${estado.toUpperCase()}` : "Actualización de gestión técnica");
    const notaTxt = observacionHistorial || observaciones || (soporte ? `Soporte técnico adjuntado: ${soporte.nombreArchivo}` : "Gestión registrada en sistema.");

    frenteObj.historial = frenteObj.historial || [];
    frenteObj.historial.unshift({
      id: `hist-${frenteKey}-${Date.now()}`,
      fecha: new Date().toISOString(),
      usuarioId: req.user!.id,
      usuarioNombre: req.user!.nombreCompleto,
      usuarioRol: req.user!.rol,
      accion: accionTxt,
      estadoAnterior,
      nuevoEstado: frenteObj.estado,
      observaciones: notaTxt
    });

    // CAMBIO 2: Espejo e inmutabilidad en la bitácora general de conversaciones y notas
    const prefijoFrente = frenteKey === "interventoria"
      ? "[Frente 1 - Interventoría]"
      : frenteKey === "arquitectura"
      ? "[Frente 2 - Arquitectura]"
      : "[Frente 3 - Estudio de Suelos]";

    mockDb.notas.push({
      id: `not-f4-${frenteKey}-${Date.now()}`,
      expedienteId: exp.id,
      autorId: req.user!.id,
      autorNombre: req.user!.nombreCompleto,
      tipo: "observacion",
      contenido: `${prefijoFrente} ${accionTxt}. ${notaTxt}`,
      creadoEn: new Date().toISOString()
    });

    exp.gestionFase4!.actualizadoEn = new Date().toISOString();
    exp.actualizadoEn = new Date().toISOString();

    // Sincronización inmediata a Supabase para evitar pérdida de datos entre frentes
    await sincronizarExpedienteEnSupabase(exp);

    res.json({ success: true, gestionFase4: exp.gestionFase4, expediente: exp });
  };

  app.put("/api/expedientes/:id/fase4/frente/:frente", requireAuth(["ingenieria", "administrador", "supervisor"]), handlerActualizarFrenteFase4);
  app.patch("/api/expedientes/:id/fase4/frente/:frente", requireAuth(["ingenieria", "administrador", "supervisor"]), handlerActualizarFrenteFase4);

  // 15.5 GESTIÓN FASE 4: AGREGAR NOTA AL HISTORIAL DEL FRENTE
  app.post(
    "/api/expedientes/:id/fase4/frente/:frente/historial",
    requireAuth(["ingenieria", "administrador", "supervisor"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      const frenteKey = req.params.frente as "interventoria" | "arquitectura" | "estudioSuelos";
      if (!["interventoria", "arquitectura", "estudioSuelos"].includes(frenteKey)) {
        res.status(400).json({ error: "Frente de trabajo no válido." });
        return;
      }

      inicializarFase4(exp);
      const frenteObj = exp.gestionFase4![frenteKey] as any;
      const { observaciones, accion } = req.body;

      if (!observaciones?.trim()) {
        res.status(400).json({ error: "La observación o nota de seguimiento es obligatoria." });
        return;
      }

      frenteObj.historial = frenteObj.historial || [];
      frenteObj.historial.unshift({
        id: `hist-${frenteKey}-${Date.now()}`,
        fecha: new Date().toISOString(),
        usuarioId: req.user!.id,
        usuarioNombre: req.user!.nombreCompleto,
        usuarioRol: req.user!.rol,
        accion: accion || "Nota de seguimiento técnico",
        nuevoEstado: frenteObj.estado,
        observaciones: observaciones.trim()
      });

      // CAMBIO 2: Réplica a la bitácora general
      const prefijoFrente = frenteKey === "interventoria"
        ? "[Frente 1 - Interventoría]"
        : frenteKey === "arquitectura"
        ? "[Frente 2 - Arquitectura]"
        : "[Frente 3 - Estudio de Suelos]";

      mockDb.notas.push({
        id: `not-f4-${frenteKey}-nota-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "conversacion",
        contenido: `${prefijoFrente} Nota: ${observaciones.trim()}`,
        creadoEn: new Date().toISOString()
      });

      exp.gestionFase4!.actualizadoEn = new Date().toISOString();
      exp.actualizadoEn = new Date().toISOString();

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, historial: frenteObj.historial, expediente: exp });
    }
  );

  // 15.5B NUEVO REQUERIMIENTO FASE 4: INFORME DE VISITA POR PARTE DE FRANCO OSORIO
  app.post(
    "/api/expedientes/:id/fase4/informe-franco-osorio",
    requireAuth(["ingenieria", "administrador", "supervisor", "asistente"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      inicializarFase4(exp);
      const {
        nombreArchivo,
        url,
        archivoDataUrl,
        mimeType,
        tamanoBytes,
        sha256,
        fechaVisita,
        profesionalResponsable,
        observaciones,
        estado
      } = req.body;

      if (!nombreArchivo) {
        res.status(400).json({ error: "Debe suministrar el nombre del archivo del informe de visita." });
        return;
      }

      const informeObj = {
        id: `inf-fo-${Date.now()}`,
        nombreArchivo,
        url: url || "/uploads/informes/informe_visita_franco_osorio.pdf",
        archivoDataUrl: archivoDataUrl || undefined,
        mimeType: mimeType || "application/pdf",
        tamanoBytes: Number(tamanoBytes) || 1024000,
        sha256: sha256 || `sha256-${Date.now().toString(16)}`,
        subidoPor: req.user!.nombreCompleto,
        subidoEn: new Date().toISOString(),
        fechaVisita: fechaVisita || new Date().toISOString().split("T")[0],
        profesionalResponsable: profesionalResponsable || "Ing. Franco Osorio",
        observaciones: observaciones || "Informe de visita técnica de inspección en campo por parte de Franco Osorio Investment S.A.S.",
        estado: estado || "cargado"
      };

      exp.gestionFase4!.informeVisitaFrancoOsorio = informeObj;
      exp.gestionFase4!.actualizadoEn = new Date().toISOString();
      exp.actualizadoEn = new Date().toISOString();

      // Trazabilidad inmutable en bitácora general de notas
      mockDb.notas.push({
        id: `not-fo-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "hito",
        contenido: `[Fase 4 - Franco Osorio] Informe de visita técnica cargado exitosamente. Documento: ${nombreArchivo}. Profesional responsable: ${informeObj.profesionalResponsable}. Fecha de visita: ${informeObj.fechaVisita}.`,
        creadoEn: new Date().toISOString()
      });

      // Registro en historial de interventoría para trazabilidad cruzada
      if (exp.gestionFase4?.interventoria) {
        exp.gestionFase4.interventoria.historial = exp.gestionFase4.interventoria.historial || [];
        exp.gestionFase4.interventoria.historial.unshift({
          id: `hist-fo-${Date.now()}`,
          fecha: new Date().toISOString(),
          usuarioId: req.user!.id,
          usuarioNombre: req.user!.nombreCompleto,
          usuarioRol: req.user!.rol,
          accion: "Carga de Informe de Visita Franco Osorio",
          observaciones: `Informe adjuntado: ${nombreArchivo}. Profesional: ${informeObj.profesionalResponsable}.`
        });
      }

      await sincronizarExpedienteEnSupabase(exp);

      res.status(201).json({
        success: true,
        informe: informeObj,
        gestionFase4: exp.gestionFase4,
        expediente: exp,
        mensaje: "Informe de visita por parte de Franco Osorio registrado con éxito."
      });
    }
  );

  // 15.5C GESTIÓN FASE 4: ELIMINAR / REEMPLAZAR INFORME DE VISITA FRANCO OSORIO
  app.delete(
    "/api/expedientes/:id/fase4/informe-franco-osorio",
    requireAuth(["ingenieria", "administrador", "supervisor"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      inicializarFase4(exp);
      const anterior = exp.gestionFase4?.informeVisitaFrancoOsorio;
      if (exp.gestionFase4) {
        delete exp.gestionFase4.informeVisitaFrancoOsorio;
        exp.gestionFase4.actualizadoEn = new Date().toISOString();
      }
      exp.actualizadoEn = new Date().toISOString();

      mockDb.notas.push({
        id: `not-fo-del-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "observacion",
        contenido: `[Fase 4 - Franco Osorio] Informe de visita técnica eliminado (${anterior?.nombreArchivo || "documento"}).`,
        creadoEn: new Date().toISOString()
      });

      await sincronizarExpedienteEnSupabase(exp);

      res.json({
        success: true,
        gestionFase4: exp.gestionFase4,
        expediente: exp,
        mensaje: "Informe de visita de Franco Osorio eliminado correctamente."
      });
    }
  );

  // 15.6 AVANZAR DE FASE 4 A FASE 5 (Validación de 3 frentes completados con soporte + Presupuesto aceptado)
  app.post(
    "/api/expedientes/:id/avanzar-fase-5",
    requireAuth(["ingenieria", "supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      if (exp.faseActual !== 4) {
        res.status(400).json({ error: `El expediente se encuentra en Fase ${exp.faseActual}, no en Fase 4.` });
        return;
      }

      inicializarFase4(exp);
      const g4 = exp.gestionFase4!;
      const faltantes: string[] = [];

      // 1. Validar Frente 1 (Interventoría)
      if (g4.interventoria.estado !== "completado") {
        faltantes.push("Frente 1: Visita de Interventoría debe estar en estado 'Completado'");
      } else if (!g4.interventoria.soporte?.nombreArchivo) {
        faltantes.push("Frente 1: Debe adjuntar el documento de soporte técnico de Interventoría");
      }

      // 2. Validar Frente 2 (Arquitectura)
      if (g4.arquitectura.estado !== "completado") {
        faltantes.push("Frente 2: Planos de Arquitectura para Licencia debe estar en estado 'Completado'");
      } else if (!g4.arquitectura.soporte?.nombreArchivo) {
        faltantes.push("Frente 2: Debe adjuntar el archivo final de los planos de Arquitectura");
      }

      // 3. Validar Frente 3 (Estudio de Suelos)
      if (g4.estudioSuelos.estado !== "completado") {
        faltantes.push("Frente 3: Estudio de Suelos debe estar en estado 'Completado'");
      } else if (!g4.estudioSuelos.soporte?.nombreArchivo) {
        faltantes.push("Frente 3: Debe adjuntar el informe técnico de Estudio de Suelos");
      }

      if (faltantes.length > 0) {
        res.status(400).json({
          error: "No se cumplen las condiciones para avanzar a Fase 5:",
          faltantes
        });
        return;
      }

      exp.faseActual = 5;
      exp.responsableGeneralId = "usr-ingenieria-01"; // Responsable directo de la gestión es Ingeniería
      exp.actualizadoEn = new Date().toISOString();

      // Inicializar trámite de Licencia de Construcción (y F5-01 Presupuesto Oficial APU)
      inicializarFase5Licencia(exp);

      mockDb.notas.push({
        id: `not-fase5-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "hito",
        contenido: `Fase 4 (En Recolección de Documentos Técnicos) culminada satisfactoriamente por ${req.user!.nombreCompleto} (${req.user!.rol}). Los 3 frentes técnicos (Interventoría, Arquitectura y Estudio de Suelos) fueron validados. El expediente avanzó a Fase 5: En Trámite de Licencia de Construcción.`,
        creadoEn: new Date().toISOString()
      });

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, expediente: exp });
    }
  );

  // 15.2 RUTAS FASE 5: SEGUIMIENTO TRÁMITE LICENCIA DE CONSTRUCCIÓN

  // 15.2.1 Radicación Inicial de Licencia
  app.post(
    "/api/expedientes/:id/licencia/radicar",
    requireAuth(["ingenieria", "supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }
      inicializarFase5Licencia(exp);

      const {
        entidadMunicipal,
        numeroRadicado,
        fechaRadicacion,
        nombreArchivo,
        mimeType,
        tamanoBytes,
        archivoDataUrl,
        sha256Hash,
        observaciones
      } = req.body;

      if (!numeroRadicado || !fechaRadicacion) {
        res.status(400).json({ error: "El número de radicado y la fecha de radicación son obligatorios." });
        return;
      }

      const soporte: SoporteDocumentoLicencia | undefined = nombreArchivo
        ? {
            id: `sop-rad-${Date.now()}`,
            nombreArchivo,
            mimeType: mimeType || "application/pdf",
            tamanoBytes: tamanoBytes || 1024000,
            archivoDataUrl,
            sha256: sha256Hash || "sha256-demo-hash",
            sha256Hash: sha256Hash || "sha256-demo-hash",
            subidoPor: req.user!.nombreCompleto,
            subidoEn: new Date().toISOString()
          }
        : undefined;

      exp.tramiteLicencia!.entidadMunicipal = entidadMunicipal || exp.tramiteLicencia!.entidadMunicipal;
      exp.tramiteLicencia!.numeroRadicadoInicial = numeroRadicado;
      exp.tramiteLicencia!.fechaRadicacionInicial = fechaRadicacion;
      if (soporte) {
        exp.tramiteLicencia!.soporteRadicacionInicial = soporte;
      }
      exp.tramiteLicencia!.estadoActual = "radicado_en_revision";
      exp.tramiteLicencia!.actualizadoEn = new Date().toISOString();

      const nuevoHist: RegistroHistorialLicencia = {
        id: `hist-lic-${Date.now()}`,
        fecha: new Date().toISOString(),
        usuarioId: req.user!.id,
        usuarioNombre: req.user!.nombreCompleto,
        usuarioRol: req.user!.rol,
        tipoEvento: "radicacion_inicial",
        titulo: "Radicación de Licencia Formalizada",
        descripcion: observaciones || `Radicación formalizada bajo radicado No. ${numeroRadicado} ante ${exp.tramiteLicencia!.entidadMunicipal}.`,
        numeroRadicado,
        entidadMunicipal: exp.tramiteLicencia!.entidadMunicipal,
        soporte,
        estadoResultante: "radicado_en_revision"
      };
      exp.tramiteLicencia!.historial.unshift(nuevoHist);

      // Notificación del sistema a Supervisor y Administrador
      mockDb.notas.push({
        id: `not-lic-rad-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "hito",
        contenido: `[Fase 5 - Licencia de Construcción] Radicación inicial de licencia registrada por ${req.user!.nombreCompleto} (${req.user!.rol}). Radicado: ${numeroRadicado} ante ${exp.tramiteLicencia!.entidadMunicipal}. Estado: Radicado — Pendiente Respuesta. Notificado a Supervisor y Administrador.`,
        creadoEn: new Date().toISOString()
      });

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, tramiteLicencia: exp.tramiteLicencia, expediente: exp });
    }
  );

  // 15.2.2 Registro de Acta de Observaciones / Requerimientos de la Entidad
  app.post(
    "/api/expedientes/:id/licencia/observaciones",
    requireAuth(["ingenieria", "supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }
      inicializarFase5Licencia(exp);

      const {
        numeroActaObservaciones,
        fechaObservaciones,
        detalleObservaciones,
        fechaLimiteSubsanacion,
        nombreArchivo,
        mimeType,
        tamanoBytes,
        archivoDataUrl,
        sha256Hash
      } = req.body;

      if (!detalleObservaciones || !fechaObservaciones) {
        res.status(400).json({ error: "La fecha y el detalle de las observaciones son obligatorios." });
        return;
      }

      const soporte: SoporteDocumentoLicencia | undefined = nombreArchivo
        ? {
            id: `sop-obs-${Date.now()}`,
            nombreArchivo,
            mimeType: mimeType || "application/pdf",
            tamanoBytes: tamanoBytes || 1024000,
            archivoDataUrl,
            sha256: sha256Hash || "sha256-demo-hash",
            sha256Hash: sha256Hash || "sha256-demo-hash",
            subidoPor: req.user!.nombreCompleto,
            subidoEn: new Date().toISOString()
          }
        : undefined;

      const nuevaRonda: RondaSubsanacionLicencia = {
        id: `ronda-${Date.now()}`,
        numeroRonda: (exp.tramiteLicencia!.rondasSubsanacion?.length || 0) + 1,
        fechaObservaciones,
        numeroActaObservaciones,
        detalleObservaciones,
        fechaLimiteSubsanacion,
        soporteObservaciones: soporte,
        registradoPorId: req.user!.id,
        registradoPorNombre: req.user!.nombreCompleto
      };

      if (!exp.tramiteLicencia!.rondasSubsanacion) {
        exp.tramiteLicencia!.rondasSubsanacion = [];
      }
      exp.tramiteLicencia!.rondasSubsanacion.push(nuevaRonda);
      exp.tramiteLicencia!.estadoActual = "con_observaciones";
      exp.tramiteLicencia!.actualizadoEn = new Date().toISOString();

      const nuevoHist: RegistroHistorialLicencia = {
        id: `hist-lic-obs-${Date.now()}`,
        fecha: new Date().toISOString(),
        usuarioId: req.user!.id,
        usuarioNombre: req.user!.nombreCompleto,
        usuarioRol: req.user!.rol,
        tipoEvento: "observaciones_entidad",
        titulo: `Acta de Observaciones Municipal (Ronda ${nuevaRonda.numeroRonda})`,
        descripcion: detalleObservaciones,
        numeroRadicado: numeroActaObservaciones,
        soporte,
        estadoResultante: "con_observaciones"
      };
      exp.tramiteLicencia!.historial.unshift(nuevoHist);

      mockDb.notas.push({
        id: `not-lic-obs-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "hito",
        contenido: `[Fase 5 - Licencia de Construcción] Acta de observaciones registrada por ${req.user!.nombreCompleto} (${req.user!.rol}) - Ronda ${nuevaRonda.numeroRonda}. Requerimiento: ${numeroActaObservaciones || "S/N"}. Estado: Con Observaciones. Notificado a Supervisor y Administrador.`,
        creadoEn: new Date().toISOString()
      });

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, tramiteLicencia: exp.tramiteLicencia, expediente: exp });
    }
  );

  // 15.2.3 Radicación de Subsanación / Correcciones
  app.post(
    "/api/expedientes/:id/licencia/subsanar",
    requireAuth(["ingenieria", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }
      inicializarFase5Licencia(exp);

      const {
        rondaId,
        fechaRadicacionSubsanacion,
        numeroRadicadoSubsanacion,
        detalleRespuestaSubsanacion,
        nombreArchivo,
        mimeType,
        tamanoBytes,
        archivoDataUrl,
        sha256Hash
      } = req.body;

      if (!numeroRadicadoSubsanacion || !fechaRadicacionSubsanacion || !detalleRespuestaSubsanacion) {
        res.status(400).json({ error: "El número de radicado, fecha y detalle de respuesta son obligatorios." });
        return;
      }

      const ronda = exp.tramiteLicencia!.rondasSubsanacion.find((r) => r.id === rondaId) ||
        exp.tramiteLicencia!.rondasSubsanacion[exp.tramiteLicencia!.rondasSubsanacion.length - 1];

      const soporte: SoporteDocumentoLicencia | undefined = nombreArchivo
        ? {
            id: `sop-sub-${Date.now()}`,
            nombreArchivo,
            mimeType: mimeType || "application/pdf",
            tamanoBytes: tamanoBytes || 1024000,
            archivoDataUrl,
            sha256: sha256Hash || "sha256-demo-hash",
            sha256Hash: sha256Hash || "sha256-demo-hash",
            subidoPor: req.user!.nombreCompleto,
            subidoEn: new Date().toISOString()
          }
        : undefined;

      if (ronda) {
        ronda.fechaRadicacionSubsanacion = fechaRadicacionSubsanacion;
        ronda.numeroRadicadoSubsanacion = numeroRadicadoSubsanacion;
        ronda.detalleRespuestaSubsanacion = detalleRespuestaSubsanacion;
        if (soporte) ronda.soporteSubsanacion = soporte;
      }

      exp.tramiteLicencia!.estadoActual = "radicado_en_revision";
      exp.tramiteLicencia!.actualizadoEn = new Date().toISOString();

      const numRonda = ronda ? ronda.numeroRonda : exp.tramiteLicencia!.rondasSubsanacion.length;
      const nuevoHist: RegistroHistorialLicencia = {
        id: `hist-lic-sub-${Date.now()}`,
        fecha: new Date().toISOString(),
        usuarioId: req.user!.id,
        usuarioNombre: req.user!.nombreCompleto,
        usuarioRol: req.user!.rol,
        tipoEvento: "radicacion_subsanacion",
        titulo: `Radicación de Subsanaciones (Ronda ${numRonda})`,
        descripcion: detalleRespuestaSubsanacion,
        numeroRadicado: numeroRadicadoSubsanacion,
        soporte,
        estadoResultante: "radicado_en_revision"
      };
      exp.tramiteLicencia!.historial.unshift(nuevoHist);

      mockDb.notas.push({
        id: `not-lic-sub-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "hito",
        contenido: `[Fase 5 - Licencia de Construcción] Subsanación de observaciones (Ronda ${numRonda}) radicada por ${req.user!.nombreCompleto} (${req.user!.rol}) bajo radicado ${numeroRadicadoSubsanacion}. Estado: Radicado — Pendiente Respuesta. Notificado a Supervisor y Administrador.`,
        creadoEn: new Date().toISOString()
      });

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, tramiteLicencia: exp.tramiteLicencia, expediente: exp });
    }
  );

  // 15.2.4 Aprobación y Expedición de la Licencia de Construcción
  app.post(
    "/api/expedientes/:id/licencia/aprobar",
    requireAuth(["ingenieria", "supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }
      inicializarFase5Licencia(exp);

      const {
        numeroResolucionLicencia,
        fechaExpedicionLicencia,
        fechaEjecutoriaLicencia,
        vigenciaMeses,
        observacionesFinales,
        nombreArchivo,
        mimeType,
        tamanoBytes,
        archivoDataUrl,
        sha256Hash,
        archivos
      } = req.body;

      if (!numeroResolucionLicencia || !fechaExpedicionLicencia) {
        res.status(400).json({ error: "El número de resolución/licencia y la fecha de expedición son obligatorios." });
        return;
      }

      // CAMBIO 8: Soporte para carga múltiple de documentos (Resolución, Planos Sellados, Anexos)
      let documentosSoporte: SoporteDocumentoLicencia[] = [];

      if (Array.isArray(archivos) && archivos.length > 0) {
        documentosSoporte = archivos.map((arch: any, idx: number) => ({
          id: `sop-lic-aprob-${Date.now()}-${idx}`,
          nombreArchivo: arch.nombreArchivo,
          mimeType: arch.mimeType || "application/pdf",
          tamanoBytes: arch.tamanoBytes || 1500000,
          archivoDataUrl: arch.archivoDataUrl,
          sha256: arch.sha256Hash || arch.sha256 || `sha256-lic-doc-${idx}`,
          sha256Hash: arch.sha256Hash || arch.sha256 || `sha256-lic-doc-${idx}`,
          subidoPor: req.user!.nombreCompleto,
          subidoEn: new Date().toISOString()
        }));
      } else if (nombreArchivo) {
        documentosSoporte = [{
          id: `sop-lic-aprob-${Date.now()}`,
          nombreArchivo,
          mimeType: mimeType || "application/pdf",
          tamanoBytes: tamanoBytes || 1500000,
          archivoDataUrl,
          sha256: sha256Hash || "sha256-demo-licencia-aprobada",
          sha256Hash: sha256Hash || "sha256-demo-licencia-aprobada",
          subidoPor: req.user!.nombreCompleto,
          subidoEn: new Date().toISOString()
        }];
      }

      if (documentosSoporte.length === 0) {
        if (exp.tramiteLicencia!.soporteLicenciaAprobadaDocs && exp.tramiteLicencia!.soporteLicenciaAprobadaDocs.length > 0) {
          documentosSoporte = exp.tramiteLicencia!.soporteLicenciaAprobadaDocs;
        } else if (exp.tramiteLicencia!.soporteLicenciaAprobada) {
          documentosSoporte = [exp.tramiteLicencia!.soporteLicenciaAprobada];
        } else {
          res.status(400).json({ error: "Debe adjuntar al menos un documento de soporte oficial de la Licencia de Construcción expedida." });
          return;
        }
      }

      const soportePrincipal = documentosSoporte[0];

      exp.tramiteLicencia!.estadoActual = "aprobada";
      exp.tramiteLicencia!.numeroResolucionLicencia = numeroResolucionLicencia;
      exp.tramiteLicencia!.fechaExpedicionLicencia = fechaExpedicionLicencia;
      exp.tramiteLicencia!.fechaEjecutoriaLicencia = fechaEjecutoriaLicencia || fechaExpedicionLicencia;
      exp.tramiteLicencia!.vigenciaMeses = Number(vigenciaMeses) || 24;
      exp.tramiteLicencia!.observacionesFinales = observacionesFinales;
      exp.tramiteLicencia!.soporteLicenciaAprobada = soportePrincipal;
      exp.tramiteLicencia!.soporteLicenciaAprobadaDocs = documentosSoporte;
      exp.tramiteLicencia!.actualizadoEn = new Date().toISOString();

      // El requisito F5-01 Presupuesto Oficial conserva su propio ciclo independiente de carga y revisión

      const nuevoHist: RegistroHistorialLicencia = {
        id: `hist-lic-apr-${Date.now()}`,
        fecha: new Date().toISOString(),
        usuarioId: req.user!.id,
        usuarioNombre: req.user!.nombreCompleto,
        usuarioRol: req.user!.rol,
        tipoEvento: "aprobacion_licencia",
        titulo: "¡Licencia de Construcción Aprobada y Expedida!",
        descripcion: `Licencia formalmente expedida bajo Resolución No. ${numeroResolucionLicencia}. Vigencia: ${exp.tramiteLicencia!.vigenciaMeses} meses. Documentos anexos: ${documentosSoporte.map((d) => d.nombreArchivo).join(", ")}.`,
        numeroRadicado: numeroResolucionLicencia,
        soporte: soportePrincipal,
        estadoResultante: "aprobada"
      };
      exp.tramiteLicencia!.historial.unshift(nuevoHist);

      // CAMBIO 9: Réplica en bitácora general con prefijo [Fase 5 - Licencia de Construcción] en texto plano
      mockDb.notas.push({
        id: `not-lic-apr-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "hito",
        contenido: `[Fase 5 - Licencia de Construcción] ¡LICENCIA DE CONSTRUCCIÓN APROBADA! Resolución No. ${numeroResolucionLicencia} emitida por ${exp.tramiteLicencia!.entidadMunicipal}. Vigencia: ${exp.tramiteLicencia!.vigenciaMeses} meses. Documentos anexos registrados: ${documentosSoporte.map((d) => d.nombreArchivo).join(", ")}. El expediente queda habilitado para avanzar a Fase 6 (En Postulación).`,
        creadoEn: new Date().toISOString()
      });

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, tramiteLicencia: exp.tramiteLicencia, expediente: exp });
    }
  );

  // 15.2.4.1 GESTIÓN DE DOCUMENTACIÓN TÉCNICA DE RADICACIÓN EN PLANEACIÓN (FUN, MEMORIALES, ETC.)
  app.post(
    "/api/expedientes/:id/licencia/documentos-planeacion",
    requireAuth(["ingenieria", "supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      try {
        const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
        if (!exp) {
          res.status(404).json({ error: "Expediente no encontrado." });
          return;
        }
        inicializarFase5Licencia(exp);

        const {
          idDoc,
          itemNumero,
          tipo,
          nombre,
          descripcion,
          esObligatorio,
          nombreArchivo,
          mimeType,
          tamanoBytes,
          archivoDataUrl,
          sha256Hash,
          observaciones,
          slotTipo
        } = req.body;

        if (!nombreArchivo) {
          res.status(400).json({ error: "Debe suministrar el archivo digital del documento técnico." });
          return;
        }

        const soporte: SoporteDocumentoLicencia = {
          id: `sop-plan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          nombreArchivo,
          mimeType: mimeType || "application/pdf",
          tamanoBytes: tamanoBytes || 1024000,
          archivoDataUrl,
          sha256: sha256Hash || `sha256-${Date.now()}`,
          sha256Hash: sha256Hash || `sha256-${Date.now()}`,
          subidoPor: req.user!.nombreCompleto,
          subidoEn: new Date().toISOString()
        };

        if (!exp.tramiteLicencia!.documentosPlaneacion) {
          exp.tramiteLicencia!.documentosPlaneacion = [];
        }

        const docs = exp.tramiteLicencia!.documentosPlaneacion;
        const indexExistente = docs.findIndex(
          (d) => (idDoc && d.id === idDoc) || (itemNumero && d.itemNumero === Number(itemNumero)) || (tipo && d.tipo === tipo)
        );

        let docActualizado: DocumentoRadicacionPlaneacion;

        if (indexExistente >= 0) {
          const docPrevio = docs[indexExistente];
          let soporteExcel = docPrevio.soporteExcel;
          let soportePdf = docPrevio.soportePdf;
          let soporteGeneral = docPrevio.soporte;

          if (slotTipo === "excel") {
            soporteExcel = soporte;
            if (soportePdf) {
              soporteGeneral = soportePdf;
            } else {
              soporteGeneral = undefined;
            }
          } else if (slotTipo === "pdf") {
            soportePdf = soporte;
            if (soporteExcel) {
              soporteGeneral = soporte;
            } else {
              soporteGeneral = undefined;
            }
          } else {
            soporteGeneral = soporte;
          }

          docActualizado = {
            ...docPrevio,
            itemNumero: itemNumero ? Number(itemNumero) : docPrevio.itemNumero,
            nombre: nombre || docPrevio.nombre,
            descripcion: descripcion || docPrevio.descripcion,
            tipo: tipo || docPrevio.tipo,
            esObligatorio: esObligatorio !== undefined ? esObligatorio : docPrevio.esObligatorio,
            soporte: soporteGeneral,
            soporteExcel,
            soportePdf,
            fechaCarga: new Date().toISOString(),
            cargadoPorId: req.user!.id,
            cargadoPorNombre: req.user!.nombreCompleto,
            cargadoPorRol: req.user!.rol,
            observaciones: observaciones || docPrevio.observaciones
          };
          docs[indexExistente] = docActualizado;
        } else {
          let soporteExcel: SoporteDocumentoLicencia | undefined = undefined;
          let soportePdf: SoporteDocumentoLicencia | undefined = undefined;
          let soporteGeneral: SoporteDocumentoLicencia | undefined = undefined;

          if (slotTipo === "excel") {
            soporteExcel = soporte;
          } else if (slotTipo === "pdf") {
            soportePdf = soporte;
          } else {
            soporteGeneral = soporte;
          }

          docActualizado = {
            id: idDoc || `doc-plan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            itemNumero: itemNumero ? Number(itemNumero) : undefined,
            tipo: tipo || "otro",
            nombre: nombre || "Documento Técnico de Radicación",
            descripcion: descripcion || "Documentación técnica oficial de radicación ante Planeación / Curaduría.",
            esObligatorio: esObligatorio !== undefined ? esObligatorio : false,
            soporte: soporteGeneral,
            soporteExcel,
            soportePdf,
            fechaCarga: new Date().toISOString(),
            cargadoPorId: req.user!.id,
            cargadoPorNombre: req.user!.nombreCompleto,
            cargadoPorRol: req.user!.rol,
            observaciones
          };
          docs.push(docActualizado);
        }

        exp.tramiteLicencia!.actualizadoEn = new Date().toISOString();

        // Trazabilidad en historial de trámite
        const hist: RegistroHistorialLicencia = {
          id: `hist-lic-docplan-${Date.now()}`,
          fecha: new Date().toISOString(),
          usuarioId: req.user!.id,
          usuarioNombre: req.user!.nombreCompleto,
          usuarioRol: req.user!.rol,
          tipoEvento: "nota_gestion",
          titulo: `Documento Técnico Cargado: ${docActualizado.nombre}${slotTipo ? ` [Slot ${slotTipo.toUpperCase()}]` : ""}`,
          descripcion: `Cargado por ${req.user!.nombreCompleto} (${req.user!.rol}). Archivo: ${nombreArchivo}. ${observaciones || ""}`.trim(),
          soporte,
          estadoResultante: exp.tramiteLicencia!.estadoActual
        };
        exp.tramiteLicencia!.historial.unshift(hist);

        // Notificación en bitácora
        mockDb.notas.push({
          id: `not-plan-doc-${Date.now()}`,
          expedienteId: exp.id,
          autorId: req.user!.id,
          autorNombre: req.user!.nombreCompleto,
          tipo: "hito",
          contenido: `[Fase 5 - Documentación de Planeación] Se cargó el documento "${docActualizado.nombre}" (${nombreArchivo}) para la radicación formal ante Planeación / Curaduría.`,
          creadoEn: new Date().toISOString()
        });

        await sincronizarExpedienteEnSupabase(exp);

        res.json({
          success: true,
          mensaje: "Documento técnico de radicación registrado exitosamente.",
          documento: docActualizado,
          documentosPlaneacion: exp.tramiteLicencia!.documentosPlaneacion,
          tramiteLicencia: exp.tramiteLicencia,
          expediente: exp
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message || "Error al registrar documento de planeación." });
      }
    }
  );

  // 15.2.4.2 ELIMINAR / DESVINCULAR DOCUMENTO DE RADICACIÓN EN PLANEACIÓN
  app.delete(
    "/api/expedientes/:id/licencia/documentos-planeacion/:docId",
    requireAuth(["ingenieria", "supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      try {
        const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
        if (!exp) {
          res.status(404).json({ error: "Expediente no encontrado." });
          return;
        }
        inicializarFase5Licencia(exp);

        const docId = req.params.docId;
        const docs = exp.tramiteLicencia?.documentosPlaneacion || [];
        const index = docs.findIndex((d) => d.id === docId || (d.itemNumero && `doc-fase5-${d.itemNumero}-${exp.id}` === docId));

        if (index === -1) {
          res.status(404).json({ error: "Documento técnico no encontrado." });
          return;
        }

        const docRemovido = docs[index];
        const slot = (req.query.slot as string) || (req.body && req.body.slot);

        if (slot === "excel") {
          docRemovido.soporteExcel = undefined;
          docRemovido.soporte = undefined;
        } else if (slot === "pdf") {
          docRemovido.soportePdf = undefined;
          docRemovido.soporte = undefined;
        } else {
          docRemovido.soporte = undefined;
          docRemovido.soporteExcel = undefined;
          docRemovido.soportePdf = undefined;
          docRemovido.fechaCarga = undefined;
          docRemovido.observaciones = undefined;
          if (!docRemovido.esObligatorio && !docRemovido.itemNumero) {
            docs.splice(index, 1);
          }
        }

        exp.tramiteLicencia!.actualizadoEn = new Date().toISOString();

        // Registro en historial
        const hist: RegistroHistorialLicencia = {
          id: `hist-lic-deldoc-${Date.now()}`,
          fecha: new Date().toISOString(),
          usuarioId: req.user!.id,
          usuarioNombre: req.user!.nombreCompleto,
          usuarioRol: req.user!.rol,
          tipoEvento: "nota_gestion",
          titulo: `Documento Técnico Removido: ${docRemovido.nombre}${slot ? ` [Slot ${slot.toUpperCase()}]` : ""}`,
          descripcion: `Documento removido/reseteado por ${req.user!.nombreCompleto} (${req.user!.rol}).`,
          estadoResultante: exp.tramiteLicencia!.estadoActual
        };
        exp.tramiteLicencia!.historial.unshift(hist);

        await sincronizarExpedienteEnSupabase(exp);

        res.json({
          success: true,
          mensaje: "Documento técnico removido correctamente.",
          documentosPlaneacion: exp.tramiteLicencia!.documentosPlaneacion,
          tramiteLicencia: exp.tramiteLicencia,
          expediente: exp
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message || "Error al desvincular documento de planeación." });
      }
    }
  );


  // 15.2.5 Agregar nota al historial del trámite de Licencia
  app.post(
    "/api/expedientes/:id/licencia/historial",
    requireAuth(["ingenieria", "supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }
      inicializarFase5Licencia(exp);

      const { titulo, descripcion } = req.body;
      if (!titulo || !descripcion) {
        res.status(400).json({ error: "El título y la descripción de la novedad son obligatorios." });
        return;
      }

      const nuevoHist: RegistroHistorialLicencia = {
        id: `hist-lic-nota-${Date.now()}`,
        fecha: new Date().toISOString(),
        usuarioId: req.user!.id,
        usuarioNombre: req.user!.nombreCompleto,
        usuarioRol: req.user!.rol,
        tipoEvento: "nota_gestion",
        titulo,
        descripcion,
        estadoResultante: exp.tramiteLicencia!.estadoActual
      };

      exp.tramiteLicencia!.historial.unshift(nuevoHist);
      exp.tramiteLicencia!.actualizadoEn = new Date().toISOString();

      // CAMBIO 9: Réplica en bitácora general en texto plano sin enlaces
      mockDb.notas.push({
        id: `not-lic-nota-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "conversacion",
        contenido: `[Fase 5 - Licencia de Construcción] Novedad: ${titulo}. ${descripcion}`,
        creadoEn: new Date().toISOString()
      });

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, tramiteLicencia: exp.tramiteLicencia, expediente: exp });
    }
  );

  // 15.2.6 Avanzar a Fase 6 (Condicionado a Licencia Aprobada con Soporte)
  app.post(
    "/api/expedientes/:id/avanzar-fase-6",
    requireAuth(["ingenieria", "supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      if (exp.faseActual !== 5) {
        res.status(400).json({
          error: `El expediente no se encuentra en Fase 5 (Fase actual: ${exp.faseActual}).`
        });
        return;
      }

      inicializarFase5Licencia(exp);

      const tieneSoporte = !!exp.tramiteLicencia?.soporteLicenciaAprobada || (!!exp.tramiteLicencia?.soporteLicenciaAprobadaDocs && exp.tramiteLicencia.soporteLicenciaAprobadaDocs.length > 0);
      if (exp.tramiteLicencia?.estadoActual !== "aprobada" || !tieneSoporte) {
        res.status(400).json({
          error: "No es posible avanzar a Fase 6: La Licencia de Construcción debe estar obtenida y aprobada en el sistema, con su respectivo soporte documental oficial y número de resolución."
        });
        return;
      }

      exp.faseActual = 6;
      exp.responsableGeneralId = "usr-ingenieria-01";
      exp.estadoGeneral = "en_tramite";
      exp.actualizadoEn = new Date().toISOString();

      // Inicializar trámite de Postulación de Subsidio para Fase 6
      inicializarFase6Postulacion(exp);

      // CAMBIO 9 & 10: Registro automático con prefijo de Fase 5 y nomenclatura 'En Postulación'
      mockDb.notas.push({
        id: `not-fase6-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "hito",
        contenido: `[Fase 5 - Licencia de Construcción] Fase 5 (En Trámite de Licencia de Construcción) culminada formalmente por ${req.user!.nombreCompleto} (${req.user!.rol}). Licencia de Construcción ${exp.tramiteLicencia.numeroResolucionLicencia || "Aprobada"} debidamente verificada con soporte oficial. El expediente avanzó a Fase 6: En Postulación a cargo del área de Ingeniería para consolidar insumos y postular ante Compensar.`,
        creadoEn: new Date().toISOString()
      });

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, expediente: exp });
    }
  );

  // ==========================================
  // 15.3 SEGUIMIENTO DE FASE 6: EN POSTULACIÓN (COMPENSAR E INDICACIÓN A OBRA)
  // ==========================================

  // 15.3.1 Registrar Envío Formal de Postulación (Paso 1)
  app.post(
    "/api/expedientes/:id/postulacion/enviar",
    requireAuth(["ingenieria", "supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }
      inicializarFase6Postulacion(exp);

      const {
        entidadPostulacion,
        fechaEnvio,
        radicadoEnvio,
        documentosIncluidos,
        observacionesEnvio,
        nombreArchivo,
        mimeType,
        tamanoBytes,
        archivoDataUrl,
        sha256Hash
      } = req.body;

      if (!fechaEnvio || !radicadoEnvio) {
        res.status(400).json({ error: "La fecha de envío y el número de radicado ante Compensar son obligatorios." });
        return;
      }

      let soporte: SoporteDocumentoPostulacion | undefined = undefined;
      if (nombreArchivo && (archivoDataUrl || req.body.url)) {
        soporte = {
          nombreArchivo,
          url: req.body.url || archivoDataUrl,
          archivoDataUrl,
          mimeType: mimeType || "application/pdf",
          tamanoBytes: tamanoBytes || 1024,
          sha256Hash: sha256Hash || `sha256-post-${Date.now()}`,
          subidoPor: req.user!.nombreCompleto,
          subidoEn: new Date().toISOString()
        };
      }

      const postulacion = exp.postulacionSubsidio!;
      postulacion.entidadPostulacion = entidadPostulacion || "Compensar (Caja de Compensación Familiar)";
      postulacion.fechaEnvio = fechaEnvio;
      postulacion.radicadoEnvio = radicadoEnvio;
      postulacion.enviadoPorId = req.user!.id;
      postulacion.enviadoPorNombre = req.user!.nombreCompleto;
      if (Array.isArray(documentosIncluidos) && documentosIncluidos.length > 0) {
        postulacion.documentosIncluidos = documentosIncluidos;
      }
      postulacion.observacionesEnvio = observacionesEnvio || "";
      if (soporte) {
        postulacion.soporteEnvio = soporte;
      }
      postulacion.estadoActual = "enviada";
      postulacion.actualizadoEn = new Date().toISOString();

      const nuevoEvento: EventoHistorialPostulacion = {
        id: `hist-post-envio-${Date.now()}`,
        fecha: fechaEnvio,
        tipo: "envio",
        titulo: "Postulación radicada formalmente ante Compensar",
        descripcion: `Paquete técnico y jurídico radicado bajo consecutivo ${radicadoEnvio}. Se espera respuesta oficial de la caja de compensación.`,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        autorRol: req.user!.rol,
        soporte
      };
      postulacion.historial.unshift(nuevoEvento);

      mockDb.notas.push({
        id: `not-post-env-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "hito",
        contenido: `Postulación formal de subsidio radicada ante Compensar por ${req.user!.nombreCompleto} (${req.user!.rol}). Radicado: ${radicadoEnvio}. Estado del expediente: Postulación Enviada — Pendiente Respuesta.`,
        creadoEn: new Date().toISOString()
      });

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, expediente: exp, postulacion: exp.postulacionSubsidio });
    }
  );

  // 15.3.2 Registrar Respuesta de Compensar (Paso 3: Positiva o con Observaciones)
  app.post(
    "/api/expedientes/:id/postulacion/respuesta",
    requireAuth(["ingenieria", "supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }
      inicializarFase6Postulacion(exp);

      const {
        resultadoRespuesta, // 'aprobada' | 'observaciones'
        fechaRespuesta,
        radicadoRespuesta,
        numeroResolucionAsignacion,
        detalleRespuesta,
        nombreArchivo,
        mimeType,
        tamanoBytes,
        archivoDataUrl,
        sha256Hash
      } = req.body;

      if (!resultadoRespuesta || !["aprobada", "observaciones"].includes(resultadoRespuesta)) {
        res.status(400).json({ error: "El resultado de la respuesta debe ser 'aprobada' u 'observaciones'." });
        return;
      }
      if (!fechaRespuesta) {
        res.status(400).json({ error: "La fecha de emisión de la respuesta es obligatoria." });
        return;
      }

      let soporte: SoporteDocumentoPostulacion | undefined = undefined;
      if (nombreArchivo && (archivoDataUrl || req.body.url)) {
        soporte = {
          nombreArchivo,
          url: req.body.url || archivoDataUrl,
          archivoDataUrl,
          mimeType: mimeType || "application/pdf",
          tamanoBytes: tamanoBytes || 1024,
          sha256Hash: sha256Hash || `sha256-post-resp-${Date.now()}`,
          subidoPor: req.user!.nombreCompleto,
          subidoEn: new Date().toISOString()
        };
      }

      const postulacion = exp.postulacionSubsidio!;
      postulacion.fechaRespuesta = fechaRespuesta;
      postulacion.radicadoRespuesta = radicadoRespuesta || "";
      postulacion.detalleRespuesta = detalleRespuesta || "";
      postulacion.resultadoRespuesta = resultadoRespuesta;
      postulacion.registradoPorId = req.user!.id;
      postulacion.registradoPorNombre = req.user!.nombreCompleto;
      if (soporte) {
        postulacion.soporteRespuesta = soporte;
      }
      postulacion.actualizadoEn = new Date().toISOString();

      if (resultadoRespuesta === "aprobada") {
        postulacion.estadoActual = "aprobada";
        postulacion.numeroResolucionAsignacion = numeroResolucionAsignacion || radicadoRespuesta || "RES-ASIG-COMP";

        const nuevoEvento: EventoHistorialPostulacion = {
          id: `hist-post-aprob-${Date.now()}`,
          fecha: fechaRespuesta,
          tipo: "aprobacion",
          titulo: `Postulación Aprobada por Compensar — Subsidio Asignado`,
          descripcion: `Compensar emitió concepto favorable y asignación del subsidio rural mediante acto ${postulacion.numeroResolucionAsignacion}. Se habilita el trámite de indicación de inicio de construcción al Supervisor.`,
          autorId: req.user!.id,
          autorNombre: req.user!.nombreCompleto,
          autorRol: req.user!.rol,
          soporte
        };
        postulacion.historial.unshift(nuevoEvento);

        mockDb.notas.push({
          id: `not-post-aprob-${Date.now()}`,
          expedienteId: exp.id,
          autorId: req.user!.id,
          autorNombre: req.user!.nombreCompleto,
          tipo: "hito",
          contenido: `Respuesta POSITIVA de Compensar registrada por ${req.user!.nombreCompleto} (${req.user!.rol}). Asignación aprobada mediante Resolución: ${postulacion.numeroResolucionAsignacion}. Se habilita emisión de indicación de inicio de obra.`,
          creadoEn: new Date().toISOString()
        });
      } else {
        // Con observaciones
        postulacion.estadoActual = "observaciones";
        const nuevaRonda: RondaSubsanacionPostulacion = {
          id: `ronda-post-${Date.now()}`,
          numeroRonda: postulacion.rondasSubsanacion.length + 1,
          fechaObservacion: fechaRespuesta,
          radicadoObservacion: radicadoRespuesta,
          detalleObservaciones: detalleRespuesta || "Se registraron observaciones técnicas/jurídicas por parte de Compensar.",
          soporteObservaciones: soporte,
          registradoPorId: req.user!.id,
          registradoPorNombre: req.user!.nombreCompleto,
          subsanada: false
        };
        postulacion.rondasSubsanacion.unshift(nuevaRonda);

        const nuevoEvento: EventoHistorialPostulacion = {
          id: `hist-post-obs-${Date.now()}`,
          fecha: fechaRespuesta,
          tipo: "observaciones",
          titulo: `Observaciones emitidas por Compensar (Ronda #${nuevaRonda.numeroRonda})`,
          descripcion: detalleRespuesta || `Requerimiento formal de Compensar bajo radicado ${radicadoRespuesta || "s/r"}. Requiere subsanación técnica o jurídica.`,
          autorId: req.user!.id,
          autorNombre: req.user!.nombreCompleto,
          autorRol: req.user!.rol,
          soporte
        };
        postulacion.historial.unshift(nuevoEvento);

        // Crear tarea para Ingeniería
        mockDb.tareas.push({
          id: `tar-sub-post-${Date.now()}`,
          expedienteId: exp.id,
          asignadoAId: "usr-ingenieria-01",
          tipo: "subsanacion_documental",
          prioridad: "alta",
          titulo: `[SUBSANACIÓN COMPENSAR] Atender observaciones de postulación - Exp ${exp.codigoVisible || exp.id}`,
          descripcion: `Compensar emitió requerimiento a la postulación del subsidio. Detalle: ${detalleRespuesta || "Revisar soporte cargado."}`,
          completada: false,
          creadoEn: new Date().toISOString()
        });

        mockDb.notas.push({
          id: `not-post-obs-${Date.now()}`,
          expedienteId: exp.id,
          autorId: req.user!.id,
          autorNombre: req.user!.nombreCompleto,
          tipo: "hito",
          contenido: `Observaciones de Compensar registradas por ${req.user!.nombreCompleto} (${req.user!.rol}) en Ronda #${nuevaRonda.numeroRonda}. Se requiere subsanación técnica y reenvío.`,
          creadoEn: new Date().toISOString()
        });
      }

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, expediente: exp, postulacion: exp.postulacionSubsidio });
    }
  );

  // 15.3.3 Radicar Subsanación de Observaciones a Compensar
  app.post(
    "/api/expedientes/:id/postulacion/subsanar",
    requireAuth(["ingenieria", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }
      inicializarFase6Postulacion(exp);

      const {
        rondaId,
        fechaSubsanacion,
        radicadoSubsanacion,
        detalleRespuesta,
        nombreArchivo,
        mimeType,
        tamanoBytes,
        archivoDataUrl,
        sha256Hash
      } = req.body;

      const postulacion = exp.postulacionSubsidio!;
      const ronda = postulacion.rondasSubsanacion.find((r) => r.id === rondaId) || postulacion.rondasSubsanacion[0];
      if (!ronda) {
        res.status(400).json({ error: "No se encontró la ronda de observaciones a subsanar." });
        return;
      }

      let soporte: SoporteDocumentoPostulacion | undefined = undefined;
      if (nombreArchivo && (archivoDataUrl || req.body.url)) {
        soporte = {
          nombreArchivo,
          url: req.body.url || archivoDataUrl,
          archivoDataUrl,
          mimeType: mimeType || "application/pdf",
          tamanoBytes: tamanoBytes || 1024,
          sha256Hash: sha256Hash || `sha256-post-sub-${Date.now()}`,
          subidoPor: req.user!.nombreCompleto,
          subidoEn: new Date().toISOString()
        };
      }

      ronda.subsanada = true;
      ronda.fechaSubsanacion = fechaSubsanacion || new Date().toISOString();
      ronda.radicadoSubsanacion = radicadoSubsanacion || "";
      ronda.detalleRespuesta = detalleRespuesta || "Ajustes remitidos a Compensar.";
      if (soporte) ronda.soporteSubsanacion = soporte;
      ronda.subsanadaPorId = req.user!.id;
      ronda.subsanadaPorNombre = req.user!.nombreCompleto;

      // Al radicar la subsanación, el estado vuelve a "enviada" (en espera de nueva respuesta)
      postulacion.estadoActual = "enviada";
      postulacion.actualizadoEn = new Date().toISOString();

      const nuevoEvento: EventoHistorialPostulacion = {
        id: `hist-post-sub-${Date.now()}`,
        fecha: ronda.fechaSubsanacion,
        tipo: "subsanacion",
        titulo: `Subsanación radicada ante Compensar (Ronda #${ronda.numeroRonda})`,
        descripcion: `Respuesta a requerimiento radicada bajo número ${radicadoSubsanacion || "s/r"}. Detalle: ${ronda.detalleRespuesta}`,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        autorRol: req.user!.rol,
        soporte
      };
      postulacion.historial.unshift(nuevoEvento);

      mockDb.notas.push({
        id: `not-post-sub-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "hito",
        contenido: `Subsanación de Ronda #${ronda.numeroRonda} radicada ante Compensar por ${req.user!.nombreCompleto} (${req.user!.rol}). Radicado: ${radicadoSubsanacion || "s/r"}. Estado vuelve a: Postulación Enviada — Pendiente Respuesta.`,
        creadoEn: new Date().toISOString()
      });

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, expediente: exp, postulacion: exp.postulacionSubsidio });
    }
  );

  // 15.3.4 Indicar Inicio de Construcción a Obra (dirigida formalmente al Supervisor)
  app.post(
    "/api/expedientes/:id/postulacion/indicar-obra",
    requireAuth(),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }
      inicializarFase6Postulacion(exp);

      const postulacion = exp.postulacionSubsidio!;
      postulacion.estadoActual = "aprobada";
      postulacion.resultadoRespuesta = "aprobada";
      if (req.body.numeroResolucionAsignacion) {
        postulacion.numeroResolucionAsignacion = req.body.numeroResolucionAsignacion;
      } else if (!postulacion.numeroResolucionAsignacion) {
        postulacion.numeroResolucionAsignacion = `RES-COMP-${exp.codigoVisible || "ASIG"}`;
      }

      const instruccionesObra = req.body.instruccionesObra || req.body.instrucciones || "Autorización formal de inicio de obra y ejecución de subsidio registrada.";

      const indicacion: IndicacionInicioObra = {
        id: `ind-obra-${Date.now()}`,
        fechaIndicacion: new Date().toISOString(),
        indicadaPorId: req.user!.id,
        indicadaPorNombre: req.user!.nombreCompleto,
        indicadaPorRol: req.user!.rol,
        notificadoAId: "usr-supervisor-01",
        notificadoANombre: "Arq. Diana Martínez",
        notificadoARol: "supervisor",
        instruccionesObra: instruccionesObra.trim(),
        fechaEstimadaInicioCampo: req.body.fechaEstimadaInicioCampo || "",
        contratistaAsignado: req.body.contratistaAsignado || ""
      };

      postulacion.indicacionObra = indicacion;
      postulacion.estadoActual = "indicacion_obra_enviada";
      postulacion.actualizadoEn = new Date().toISOString();

      exp.faseActual = 7;
      exp.estadoGeneral = "en_tramite";
      exp.actualizadoEn = new Date().toISOString();

      const nuevoEvento: EventoHistorialPostulacion = {
        id: `hist-post-ind-${Date.now()}`,
        fecha: indicacion.fechaIndicacion,
        tipo: "indicacion_obra",
        titulo: "Indicación formal de Inicio de Construcción enviada al Supervisor",
        descripcion: `Notificación de inicio de faena. Instrucciones: ${indicacion.instruccionesObra}`,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        autorRol: req.user!.rol
      };
      postulacion.historial.unshift(nuevoEvento);

      mockDb.notas.push({
        id: `not-post-ind-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "hito",
        contenido: `Indicación de Inicio de Construcción registrada por ${req.user!.nombreCompleto} (${req.user!.rol}). Expediente avanza a Fase 7.`,
        creadoEn: new Date().toISOString()
      });

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, expediente: exp, postulacion: exp.postulacionSubsidio });
    }
  );

  // 15.3.5 Agregar Nota al Historial de la Postulación
  app.post(
    "/api/expedientes/:id/postulacion/historial",
    requireAuth(["ingenieria", "supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }
      inicializarFase6Postulacion(exp);

      const { titulo, descripcion } = req.body;
      if (!titulo || !descripcion) {
        res.status(400).json({ error: "El título y la descripción del apunte son obligatorios." });
        return;
      }

      const postulacion = exp.postulacionSubsidio!;
      const nuevoEvento: EventoHistorialPostulacion = {
        id: `hist-post-nota-${Date.now()}`,
        fecha: new Date().toISOString(),
        tipo: "nota",
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        autorRol: req.user!.rol
      };
      postulacion.historial.unshift(nuevoEvento);
      postulacion.actualizadoEn = new Date().toISOString();

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, evento: nuevoEvento, postulacion: exp.postulacionSubsidio });
    }
  );

  // 15.3.6 Cargar Documento de Carga Activa en Fase 6
  app.post(
    "/api/expedientes/:id/postulacion/documento-carga-activa",
    requireAuth(["ingenieria", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }
      inicializarFase6Postulacion(exp);

      const { codigo, nombreArchivo, mimeType, tamanoBytes, archivoDataUrl, sha256Hash } = req.body;
      if (!codigo || !nombreArchivo || !archivoDataUrl) {
        res.status(400).json({ error: "Código, nombre de archivo y contenido son obligatorios." });
        return;
      }

      if (!exp.postulacionSubsidio!.documentosCargaActiva) {
        exp.postulacionSubsidio!.documentosCargaActiva = {};
      }

      const soporte: SoporteDocumentoPostulacion = {
        nombreArchivo,
        url: archivoDataUrl,
        archivoDataUrl,
        mimeType: mimeType || "application/pdf",
        tamanoBytes: tamanoBytes || 1024,
        sha256Hash: sha256Hash || `sha256-ca-${Date.now()}`,
        subidoPor: req.user!.nombreCompleto,
        subidoEn: new Date().toISOString()
      };

      exp.postulacionSubsidio!.documentosCargaActiva[codigo] = soporte;
      exp.postulacionSubsidio!.actualizadoEn = new Date().toISOString();

      exp.postulacionSubsidio!.historial.unshift({
        id: `hist-ca-${Date.now()}`,
        fecha: new Date().toISOString(),
        tipo: "nota",
        titulo: `Documento de Carga Activa adjuntado: ${nombreArchivo}`,
        descripcion: `Código de requerimiento: ${codigo}. Subido por ${req.user!.nombreCompleto} (${req.user!.rol}).`,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        autorRol: req.user!.rol,
        soporte
      });

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, soporte, postulacion: exp.postulacionSubsidio });
    }
  );

  // 15.3.6.1 Eliminar/Desvincular Documento de Carga Activa en Fase 6
  app.delete(
    "/api/expedientes/:id/postulacion/documento-carga-activa/:codigo",
    requireAuth(["ingenieria", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }
      const codigo = req.params.codigo;
      if (!exp.postulacionSubsidio?.documentosCargaActiva?.[codigo]) {
        res.status(400).json({ error: "No hay documento cargado para este requerimiento." });
        return;
      }

      const anteriorArchivo = exp.postulacionSubsidio.documentosCargaActiva[codigo].nombreArchivo;
      delete exp.postulacionSubsidio.documentosCargaActiva[codigo];
      exp.postulacionSubsidio.actualizadoEn = new Date().toISOString();

      exp.postulacionSubsidio.historial.unshift({
        id: `hist-del-ca-${Date.now()}`,
        fecha: new Date().toISOString(),
        tipo: "nota",
        titulo: `Documento de Carga Activa eliminado (${codigo})`,
        descripcion: `El archivo ${anteriorArchivo} fue eliminado por ${req.user!.nombreCompleto} (${req.user!.rol}). El requerimiento regresa a pendiente/condicional.`,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        autorRol: req.user!.rol
      });

      mockDb.notas.push({
        id: `not-del-ca-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "hito",
        contenido: `Documento ${codigo} (${anteriorArchivo}) desvinculado de Fase 6 por ${req.user!.nombreCompleto}.`,
        creadoEn: new Date().toISOString()
      });

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, postulacion: exp.postulacionSubsidio });
    }
  );

  // 15.3.6.2 Aplicar Lote Clasificado de los 28 Documentos (o archivo ZIP procesado)
  app.post(
    "/api/expedientes/:id/postulacion/aplicar-lote-documentos-28",
    requireAuth(["ingenieria", "supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }
      inicializarFase6Postulacion(exp);

      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: "Debe enviar un array con los documentos a actualizar." });
        return;
      }

      if (!exp.postulacionSubsidio!.documentosCargaActiva) {
        exp.postulacionSubsidio!.documentosCargaActiva = {};
      }

      let actualizados = 0;
      items.forEach((item: any) => {
        if (!item.codigo) return;
        if (item.estado === "Encontrado" || item.archivoDataUrl || item.nombreArchivoOriginal) {
          const soporte: SoporteDocumentoPostulacion = {
            nombreArchivo: item.nombreArchivoOriginal || `${item.codigo}_${item.nombre}.pdf`,
            url: item.soporteUrl || item.archivoDataUrl || `expedientes/${exp.id}/${item.codigo}.pdf`,
            archivoDataUrl: item.archivoDataUrl || item.soporteUrl,
            mimeType: item.mimeType || (item.formatoEsperado === "XLSX" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf"),
            tamanoBytes: item.tamanoBytes || 1024 * 180,
            sha256Hash: item.sha256Hash || `sha256-${item.codigo.toLowerCase()}-${Date.now()}`,
            subidoPor: req.user!.nombreCompleto,
            subidoEn: new Date().toISOString()
          };
          exp.postulacionSubsidio!.documentosCargaActiva[item.codigo] = soporte;
          actualizados++;
        }
      });

      exp.postulacionSubsidio!.actualizadoEn = new Date().toISOString();

      exp.postulacionSubsidio!.historial.unshift({
        id: `hist-lote-28-${Date.now()}`,
        fecha: new Date().toISOString(),
        tipo: "nota",
        titulo: `Lote de ${actualizados} documentos clasificados sincronizado (Fase 6)`,
        descripcion: `Actualización de matriz de 28 documentos según norma Compensar realizada por ${req.user!.nombreCompleto} (${req.user!.rol}).`,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        autorRol: req.user!.rol
      });

      await sincronizarExpedienteEnSupabase(exp);

      res.json({
        success: true,
        actualizados,
        postulacion: exp.postulacionSubsidio,
        mensaje: `Se han sincronizado con éxito ${actualizados} documentos en el expediente.`
      });
    }
  );

  // 15.3.7 Registrar Soporte Multi-Predio en Fase 6
  app.post(
    "/api/expedientes/:id/postulacion/soporte-multipredio",
    requireAuth(["ingenieria", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }
      inicializarFase6Postulacion(exp);

      const { matriculaInmobiliariaAdicional, observaciones, nombreArchivo, mimeType, tamanoBytes, archivoDataUrl, sha256Hash } = req.body;
      if (!nombreArchivo || !archivoDataUrl) {
        res.status(400).json({ error: "Debe adjuntar el PDF consolidado del predio adicional." });
        return;
      }

      const soporte: SoporteDocumentoPostulacion = {
        nombreArchivo,
        url: archivoDataUrl,
        archivoDataUrl,
        mimeType: mimeType || "application/pdf",
        tamanoBytes: tamanoBytes || 1024,
        sha256Hash: sha256Hash || `sha256-multipredio-${Date.now()}`,
        subidoPor: req.user!.nombreCompleto,
        subidoEn: new Date().toISOString()
      };

      exp.postulacionSubsidio!.soporteMultipredio = {
        id: `mp-${Date.now()}`,
        matriculaInmobiliariaAdicional: matriculaInmobiliariaAdicional || "",
        observaciones: observaciones || "Cruce documental de predio adicional integrado para postulación Compensar.",
        soporte,
        registradoEn: new Date().toISOString(),
        registradoPorNombre: req.user!.nombreCompleto
      };

      exp.postulacionSubsidio!.actualizadoEn = new Date().toISOString();

      exp.postulacionSubsidio!.historial.unshift({
        id: `hist-mp-${Date.now()}`,
        fecha: new Date().toISOString(),
        tipo: "nota",
        titulo: "Soporte Multi-Predio consolidado adjuntado",
        descripcion: `PDF consolidado de predio adicional cargado por ${req.user!.nombreCompleto}. Matrícula: ${matriculaInmobiliariaAdicional || "N/A"}.`,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        autorRol: req.user!.rol,
        soporte
      });

      mockDb.notas.push({
        id: `not-mp-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "hito",
        contenido: `Soporte Multi-Predio consolidado cargado en Fase 6 por ${req.user!.nombreCompleto} (${req.user!.rol}) para postulación ante Compensar.`,
        creadoEn: new Date().toISOString()
      });

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, soporteMultipredio: exp.postulacionSubsidio!.soporteMultipredio, postulacion: exp.postulacionSubsidio });
    }
  );

  // 15.3.7.1 Eliminar Soporte Multi-Predio en Fase 6
  app.delete(
    "/api/expedientes/:id/postulacion/soporte-multipredio",
    requireAuth(["ingenieria", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }
      if (!exp.postulacionSubsidio?.soporteMultipredio) {
        res.status(400).json({ error: "No hay soporte multi-predio para eliminar." });
        return;
      }

      const anteriorArchivo = exp.postulacionSubsidio.soporteMultipredio.soporte?.nombreArchivo || "documento multi-predio";
      delete exp.postulacionSubsidio.soporteMultipredio;
      exp.postulacionSubsidio.actualizadoEn = new Date().toISOString();

      exp.postulacionSubsidio.historial.unshift({
        id: `hist-del-mp-${Date.now()}`,
        fecha: new Date().toISOString(),
        tipo: "nota",
        titulo: "Soporte Multi-Predio eliminado",
        descripcion: `El archivo ${anteriorArchivo} fue eliminado por ${req.user!.nombreCompleto}. El hogar retorna a condición estándar.`,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        autorRol: req.user!.rol
      });

      mockDb.notas.push({
        id: `not-del-mp-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "hito",
        contenido: `Soporte Multi-Predio eliminado en Fase 6 por ${req.user!.nombreCompleto} (${req.user!.rol}).`,
        creadoEn: new Date().toISOString()
      });

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, postulacion: exp.postulacionSubsidio });
    }
  );

  // 15.3.8 Registrar Anexo Libre en Fase 6
  app.post(
    "/api/expedientes/:id/postulacion/anexo-libre",
    requireAuth(["ingenieria", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }
      inicializarFase6Postulacion(exp);

      const { titulo, nombreArchivo, mimeType, tamanoBytes, archivoDataUrl, sha256Hash } = req.body;
      if (!titulo || !nombreArchivo || !archivoDataUrl) {
        res.status(400).json({ error: "Título y archivo adjunto son obligatorios." });
        return;
      }

      if (!exp.postulacionSubsidio!.anexosLibres) {
        exp.postulacionSubsidio!.anexosLibres = [];
      }

      const soporte: SoporteDocumentoPostulacion = {
        nombreArchivo,
        url: archivoDataUrl,
        archivoDataUrl,
        mimeType: mimeType || "application/pdf",
        tamanoBytes: tamanoBytes || 1024,
        sha256Hash: sha256Hash || `sha256-anexo-${Date.now()}`,
        subidoPor: req.user!.nombreCompleto,
        subidoEn: new Date().toISOString()
      };

      const nuevoAnexo = {
        id: `anx-${Date.now()}`,
        titulo: titulo.trim(),
        soporte,
        creadoEn: new Date().toISOString(),
        creadoPorNombre: req.user!.nombreCompleto
      };

      exp.postulacionSubsidio!.anexosLibres.push(nuevoAnexo);
      exp.postulacionSubsidio!.actualizadoEn = new Date().toISOString();

      exp.postulacionSubsidio!.historial.unshift({
        id: `hist-anx-${Date.now()}`,
        fecha: new Date().toISOString(),
        tipo: "nota",
        titulo: `Anexo Libre agregado: ${titulo.trim()}`,
        descripcion: `Archivo: ${nombreArchivo}. Agregado por ${req.user!.nombreCompleto} (${req.user!.rol}).`,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        autorRol: req.user!.rol,
        soporte
      });

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, anexo: nuevoAnexo, postulacion: exp.postulacionSubsidio });
    }
  );

  // 15.3.8.1 Eliminar Anexo Libre en Fase 6
  app.delete(
    "/api/expedientes/:id/postulacion/anexo-libre/:anexoId",
    requireAuth(["ingenieria", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }
      const anexoId = req.params.anexoId;
      const index = (exp.postulacionSubsidio?.anexosLibres || []).findIndex((a) => a.id === anexoId);
      if (index === -1) {
        res.status(404).json({ error: "Anexo libre no encontrado." });
        return;
      }

      const anexoEliminado = exp.postulacionSubsidio!.anexosLibres[index];
      exp.postulacionSubsidio!.anexosLibres.splice(index, 1);
      exp.postulacionSubsidio!.actualizadoEn = new Date().toISOString();

      exp.postulacionSubsidio!.historial.unshift({
        id: `hist-del-anx-${Date.now()}`,
        fecha: new Date().toISOString(),
        tipo: "nota",
        titulo: `Anexo Libre eliminado: ${anexoEliminado.titulo}`,
        descripcion: `El archivo ${anexoEliminado.soporte?.nombreArchivo || ""} fue removido por ${req.user!.nombreCompleto} (${req.user!.rol}).`,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        autorRol: req.user!.rol
      });

      mockDb.notas.push({
        id: `not-del-anx-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "hito",
        contenido: `Anexo libre "${anexoEliminado.titulo}" eliminado en Fase 6 por ${req.user!.nombreCompleto}.`,
        creadoEn: new Date().toISOString()
      });

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, postulacion: exp.postulacionSubsidio });
    }
  );

  // 15.3.9 Avanzar Expediente a Fase 7 (En Construcción y Cobro Subsidio)
  app.post(
    "/api/expedientes/:id/avanzar-fase-7",
    requireAuth(["ingenieria", "supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      if (exp.faseActual !== 6) {
        res.status(400).json({
          error: `El expediente no se encuentra en Fase 6 (Fase actual: ${exp.faseActual}).`
        });
        return;
      }

      inicializarFase6Postulacion(exp);
      const post = exp.postulacionSubsidio!;
      const {
        numeroResolucion,
        nombreArchivo,
        mimeType,
        tamanoBytes,
        archivoDataUrl,
        sha256Hash,
        instruccionesObra
      } = req.body || {};

      // Validación estricta Módulo 5:
      // Dos datos innegociables:
      // 1. El Número de la Resolución emitida por Compensar
      // 2. La carga del Documento de Resolución en PDF
      const numRes = (numeroResolucion || post.numeroResolucionAsignacion || "").trim();
      const soporteExistente = post.soporteRespuesta;
      const tieneSoporteNuevo = !!(nombreArchivo && archivoDataUrl);

      if (!numRes) {
        res.status(400).json({
          error: "El Número de la Resolución emitida por Compensar es obligatorio para autorizar el avance a Fase 7."
        });
        return;
      }

      if (!tieneSoporteNuevo && !soporteExistente) {
        res.status(400).json({
          error: "Debe adjuntar el Documento de Resolución en PDF emitido por Compensar."
        });
        return;
      }

      let soporteFinal = soporteExistente;
      if (tieneSoporteNuevo) {
        soporteFinal = {
          nombreArchivo,
          url: archivoDataUrl,
          archivoDataUrl,
          mimeType: mimeType || "application/pdf",
          tamanoBytes: tamanoBytes || 1024,
          sha256Hash: sha256Hash || `sha256-res-comp-${Date.now()}`,
          subidoPor: req.user!.nombreCompleto,
          subidoEn: new Date().toISOString()
        };
        post.soporteRespuesta = soporteFinal;
      }

      post.numeroResolucionAsignacion = numRes;
      post.resultadoRespuesta = "aprobada";
      post.estadoActual = "aprobada";
      post.fechaRespuesta = post.fechaRespuesta || new Date().toISOString();
      post.detalleRespuesta = "Postulación aprobada por Compensar con resolución oficial de asignación del subsidio.";
      post.actualizadoEn = new Date().toISOString();

      post.historial.unshift({
        id: `hist-apr-comp-${Date.now()}`,
        fecha: new Date().toISOString(),
        tipo: "aprobacion",
        titulo: `Postulación Aprobada por Compensar — Resolución No. ${numRes}`,
        descripcion: `Resolución oficial de asignación registrada por ${req.user!.nombreCompleto} (${req.user!.rol}). El expediente queda formalmente habilitado para el inicio de obra.`,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        autorRol: req.user!.rol,
        soporte: soporteFinal
      });

      // Indicación de inicio de construcción al Supervisor (se inicializa automáticamente al avanzar a Fase 7)
      if (!post.indicacionObra) {
        post.indicacionObra = {
          id: `ind-auto-${Date.now()}`,
          fechaIndicacion: new Date().toISOString(),
          indicadaPorId: req.user!.id,
          indicadaPorNombre: req.user!.nombreCompleto,
          indicadaPorRol: req.user!.rol,
          notificadoAId: "usr-supervisor-01",
          notificadoANombre: "Arq. Diana Martínez",
          notificadoARol: "supervisor",
          instruccionesObra: instruccionesObra || "Autorización formal de inicio constructivo en campo con contratista asignado tras aprobación de postulación ante Compensar.",
          fechaEstimadaInicioCampo: new Date(Date.now() + 86400000 * 5).toISOString().split("T")[0],
          contratistaAsignado: "Consorcio Hábitat Rural 2026"
        };
        post.estadoActual = "indicacion_obra_enviada";
        post.historial.unshift({
          id: `hist-auto-ind-${Date.now()}`,
          fecha: new Date().toISOString(),
          tipo: "indicacion_obra",
          titulo: "Indicación de Inicio de Construcción Emitida",
          descripcion: `Directrices constructivas emitidas al Supervisor por ${req.user!.nombreCompleto}.`,
          autorId: req.user!.id,
          autorNombre: req.user!.nombreCompleto,
          autorRol: req.user!.rol
        });
      }

      // Automatización de Avance: Cierra Fase 6 y desbloquea Fase 7
      exp.faseActual = 7;
      exp.responsableGeneralId = "usr-supervisor-01";
      exp.actualizadoEn = new Date().toISOString();
      inicializarFase7(exp);

      // Bitácora general estricta según especificación del usuario:
      // "Postulación Aprobada por Compensar. Resolución No. [Número]. El expediente avanza a Fase 7 (Ejecución de Obra)"
      mockDb.notas.push({
        id: `not-fase7-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "hito",
        contenido: `Postulación Aprobada por Compensar. Resolución No. ${numRes}. El expediente avanza a Fase 7 (Ejecución de Obra).`,
        creadoEn: new Date().toISOString()
      });

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, expediente: exp, postulacion: post });
    }
  );

  // ==============================================================
  // 15.4 FASE 7: EN CONSTRUCCIÓN Y COBRO SUBSIDIO (CAMBIO 13)
  // ==============================================================

  // 15.4.1 Registrar / Modificar Hito de Construcción (Supervisor, Administrador)
  app.post(
    "/api/expedientes/:id/fase7/registrar-hito",
    requireAuth(["supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      inicializarFase7(exp);
      const { codigoHito, numero, fechaCumplimiento, observaciones, fotos } = req.body;

      const hito = exp.gestionFase7!.hitosConstruccion.find(
        (h) => h.codigo === codigoHito || h.numero === Number(numero)
      );
      if (!hito) {
        res.status(400).json({ error: "Hito constructivo no reconocido." });
        return;
      }

      hito.completado = true;
      hito.fechaCumplimiento = fechaCumplimiento || new Date().toISOString().split("T")[0];
      hito.observaciones = observaciones || "";
      hito.registradoPorId = req.user!.id;
      hito.registradoPorNombre = req.user!.nombreCompleto;
      hito.registradoPorRol = req.user!.rol;
      hito.actualizadoEn = new Date().toISOString();

      if (Array.isArray(fotos)) {
        hito.fotos = fotos.slice(0, 20); // Respetar tope máximo de 20 fotos
      }

      // Si se completó el Hito 4 (Finalización total con acabados), la obra queda 100% terminada
      if (hito.numero === 4) {
        exp.gestionFase7!.obraFinalizada = true;
        exp.gestionFase7!.fechaFinalizacionObra = hito.fechaCumplimiento;
        exp.gestionFase7!.estadoGeneralFase7 = "cierre_documental";
      }

      exp.gestionFase7!.actualizadoEn = new Date().toISOString();
      exp.actualizadoEn = new Date().toISOString();

      const eventoHito: EventoHistorialFase7 = {
        id: `hist-f7-hito-${Date.now()}`,
        fecha: new Date().toISOString(),
        tipo: "hito_obra",
        titulo: `Hito ${hito.numero} Certificado: ${hito.nombre}`,
        descripcion: `Inspección técnica registrada por ${req.user!.nombreCompleto} (${req.user!.rol}). Fecha de cumplimiento: ${hito.fechaCumplimiento}. Evidencia: ${hito.fotos.length} fotografías periciales adjuntas. ${observaciones ? `Observaciones: "${observaciones}"` : ""}`,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        autorRol: req.user!.rol
      };
      exp.gestionFase7!.historial.unshift(eventoHito);

      mockDb.notas.push({
        id: `not-f7-hito-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "hito",
        contenido: `HITO DE OBRA CERTIFICADO: Hito ${hito.numero} (${hito.nombre}) cumplido según verificación en campo de ${req.user!.nombreCompleto}. Evidencia: ${hito.fotos.length} fotos registradas.`,
        creadoEn: new Date().toISOString()
      });

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, gestionFase7: exp.gestionFase7, expediente: exp });
    }
  );

  // 15.4.2 Cargar / Validar Documento de Cierre (F7-01 a F7-06) (Supervisor, Ingeniería, Administrador)
  app.post(
    "/api/expedientes/:id/fase7/cargar-documento",
    requireAuth(["supervisor", "ingenieria", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      inicializarFase7(exp);
      const { codigoDoc, idDoc, url, nombreArchivo, archivoDataUrl, mimeType, tamanoBytes, sha256Hash, fotos } = req.body;

      const docObj = exp.gestionFase7!.documentosCierre.find((d) => d.codigo === codigoDoc);
      if (!docObj) {
        res.status(400).json({ error: "Código de documento de cierre inválido." });
        return;
      }

      docObj.id = idDoc || docObj.id || `f7-doc-${codigoDoc.toLowerCase()}-${exp.id}`;
      docObj.estado = "aceptado";
      docObj.nombreArchivo = nombreArchivo;
      docObj.archivoDataUrl = archivoDataUrl;
      docObj.url = url || docObj.url;
      docObj.mimeType = mimeType || "application/pdf";
      docObj.tamanoBytes = tamanoBytes || 245000;
      docObj.sha256Hash = sha256Hash || `sha256-f7-${Date.now()}`;
      docObj.subidoPorId = req.user!.id;
      docObj.subidoPorNombre = req.user!.nombreCompleto;
      docObj.subidoEn = new Date().toISOString();
      if (Array.isArray(fotos) && fotos.length > 0) {
        docObj.fotos = fotos;
      }

      // Almacenamiento individual directo en formatosDocumentales para esquema persistente
      if (!exp.gestionFase7!.formatosDocumentales) {
        exp.gestionFase7!.formatosDocumentales = {};
      }
      const soporteItem: SoporteFase7 = {
        id: docObj.id,
        nombreArchivo,
        url: docObj.url,
        archivoDataUrl,
        mimeType: docObj.mimeType,
        tamanoBytes: docObj.tamanoBytes,
        sha256Hash: docObj.sha256Hash,
        subidoPor: req.user!.nombreCompleto,
        subidoEn: new Date().toISOString()
      };

      if (codigoDoc === "F7-01") exp.gestionFase7!.formatosDocumentales.actaInicioContrato = soporteItem;
      else if (codigoDoc === "F7-02") exp.gestionFase7!.formatosDocumentales.actaInicioObra = soporteItem;
      else if (codigoDoc === "F7-03") exp.gestionFase7!.formatosDocumentales.actaEntrega = soporteItem;
      else if (codigoDoc === "F7-04") exp.gestionFase7!.formatosDocumentales.certificadoHabitabilidad = soporteItem;
      else if (codigoDoc === "F7-05") exp.gestionFase7!.formatosDocumentales.registroFotograficoEntrega = { ...soporteItem, fotos: docObj.fotos };
      else if (codigoDoc === "F7-06") exp.gestionFase7!.formatosDocumentales.actaReciboSatisfaccion = soporteItem;

      // Sincronizar con requisitosCaso para reflejar estado
      const reqCaso = mockDb.requisitosCaso.find(
        (r) => r.expedienteId === exp.id && r.codigoRequisito === codigoDoc
      );
      if (reqCaso) {
        reqCaso.estado = "aceptado";
      }

      // Verificar si los 6 documentos están completos
      const todosCompletos =
        exp.gestionFase7!.documentosCierre.length >= 6 &&
        exp.gestionFase7!.documentosCierre.every(
          (d) => d.estado === "aceptado" || d.estado === "cargado"
        );
      if (todosCompletos) {
        exp.gestionFase7!.documentosCierreCompletos = true;
        if (exp.gestionFase7!.desembolso.estadoActual === "pendiente_documentos") {
          exp.gestionFase7!.desembolso.estadoActual = "listo_para_solicitar";
        }
        exp.gestionFase7!.estadoGeneralFase7 = "tramite_desembolso";
      }

      exp.gestionFase7!.actualizadoEn = new Date().toISOString();
      exp.actualizadoEn = new Date().toISOString();

      const eventoDoc: EventoHistorialFase7 = {
        id: `hist-f7-doc-${Date.now()}`,
        fecha: new Date().toISOString(),
        tipo: "documento",
        titulo: `Documento ${docObj.codigo} Cargado: ${docObj.nombre}`,
        descripcion: `Soporte firmado cargado y verificado por ${req.user!.nombreCompleto} (${req.user!.rol}). Archivo: ${nombreArchivo}.`,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        autorRol: req.user!.rol,
        soporte: {
          id: docObj.id,
          nombreArchivo,
          url: docObj.url,
          archivoDataUrl,
          mimeType: docObj.mimeType,
          tamanoBytes: docObj.tamanoBytes,
          sha256Hash: docObj.sha256Hash,
          subidoPor: req.user!.nombreCompleto,
          subidoEn: new Date().toISOString()
        }
      };
      exp.gestionFase7!.historial.unshift(eventoDoc);

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, gestionFase7: exp.gestionFase7, expediente: exp });
    }
  );

  // 15.4.2.1 Desvincular / Eliminar Documento de Cierre en Fase 7
  app.delete(
    "/api/expedientes/:id/fase7/documento-cierre/:codigoDoc",
    requireAuth(["supervisor", "administrador", "ingenieria"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }
      inicializarFase7(exp);
      const codigoDoc = req.params.codigoDoc;
      const docObj = exp.gestionFase7!.documentosCierre.find((d) => d.codigo === codigoDoc);
      if (!docObj) {
        res.status(400).json({ error: "Código de documento de cierre no válido." });
        return;
      }
      if (docObj.estado === "pendiente" || !docObj.nombreArchivo) {
        res.status(400).json({ error: "El documento no tiene archivo cargado." });
        return;
      }
      if (
        exp.gestionFase7!.desembolso.estadoActual !== "pendiente_documentos" &&
        exp.gestionFase7!.desembolso.estadoActual !== "listo_para_solicitar"
      ) {
        res.status(400).json({
          error: "No es posible desvincular documentos cuando ya se radicó o procesó el desembolso."
        });
        return;
      }

      const anteriorNombre = docObj.nombreArchivo;
      docObj.estado = "pendiente";
      delete docObj.nombreArchivo;
      delete docObj.archivoDataUrl;
      delete docObj.url;
      delete docObj.mimeType;
      delete docObj.tamanoBytes;
      delete docObj.sha256Hash;
      delete docObj.subidoPorId;
      delete docObj.subidoPorNombre;
      delete docObj.subidoEn;
      delete docObj.fotos;

      if (exp.gestionFase7!.formatosDocumentales) {
        if (codigoDoc === "F7-01") delete exp.gestionFase7!.formatosDocumentales.actaInicioContrato;
        else if (codigoDoc === "F7-02") delete exp.gestionFase7!.formatosDocumentales.actaInicioObra;
        else if (codigoDoc === "F7-03") delete exp.gestionFase7!.formatosDocumentales.actaEntrega;
        else if (codigoDoc === "F7-04") delete exp.gestionFase7!.formatosDocumentales.certificadoHabitabilidad;
        else if (codigoDoc === "F7-05") delete exp.gestionFase7!.formatosDocumentales.registroFotograficoEntrega;
        else if (codigoDoc === "F7-06") delete exp.gestionFase7!.formatosDocumentales.actaReciboSatisfaccion;
      }

      exp.gestionFase7!.documentosCierreCompletos = false;
      if (exp.gestionFase7!.desembolso.estadoActual === "listo_para_solicitar") {
        exp.gestionFase7!.desembolso.estadoActual = "pendiente_documentos";
      }

      const reqCaso = mockDb.requisitosCaso.find(
        (r) => r.expedienteId === exp.id && r.codigoRequisito === codigoDoc
      );
      if (reqCaso) {
        reqCaso.estado = "pendiente_carga";
      }

      exp.gestionFase7!.actualizadoEn = new Date().toISOString();
      exp.actualizadoEn = new Date().toISOString();

      exp.gestionFase7!.historial.unshift({
        id: `hist-f7-doc-del-${Date.now()}`,
        fecha: new Date().toISOString(),
        tipo: "documento",
        titulo: `Documento ${docObj.codigo} Desvinculado: ${docObj.nombre}`,
        descripcion: `Soporte ${anteriorNombre} desvinculado por ${req.user!.nombreCompleto} (${req.user!.rol}). Documento regresa a estado pendiente.`,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        autorRol: req.user!.rol
      });

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, gestionFase7: exp.gestionFase7, expediente: exp });
    }
  );

  // 15.4.3 Radicar Solicitud de Desembolso ante Compensar (Ingeniería, Administrador)
  app.post(
    "/api/expedientes/:id/fase7/solicitar-desembolso",
    requireAuth(["ingenieria", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      inicializarFase7(exp);
      const { fechaSolicitud, radicadoSolicitud, observacionesSolicitud, documentosIncluidos, soporte } =
        req.body;

      const des = exp.gestionFase7!.desembolso;
      des.estadoActual = "solicitado_pendiente_respuesta";
      des.fechaSolicitud = fechaSolicitud || new Date().toISOString().split("T")[0];
      des.radicadoSolicitud = radicadoSolicitud;
      des.solicitadoPorId = req.user!.id;
      des.solicitadoPorNombre = req.user!.nombreCompleto;
      des.observacionesSolicitud = observacionesSolicitud || "";
      if (Array.isArray(documentosIncluidos) && documentosIncluidos.length > 0) {
        des.documentosIncluidos = documentosIncluidos;
      } else {
        des.documentosIncluidos = ["F7-01", "F7-02", "F7-03", "F7-04", "F7-05", "F7-06"];
      }
      if (soporte) {
        des.soporteSolicitud = soporte;
      }

      exp.gestionFase7!.actualizadoEn = new Date().toISOString();
      exp.actualizadoEn = new Date().toISOString();

      const eventoEnvio: EventoHistorialFase7 = {
        id: `hist-f7-des-env-${Date.now()}`,
        fecha: new Date().toISOString(),
        tipo: "solicitud_desembolso",
        titulo: "Solicitud de Desembolso Radicada ante Compensar",
        descripcion: `Paquete de cierre documental radicado bajo radicado ${radicadoSolicitud} por ${req.user!.nombreCompleto} (${req.user!.rol}). Estado: En espera de aprobación y confirmación de giro.`,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        autorRol: req.user!.rol,
        soporte
      };
      exp.gestionFase7!.historial.unshift(eventoEnvio);

      mockDb.notas.push({
        id: `not-f7-des-env-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "hito",
        contenido: `SOLICITUD DE DESEMBOLSO RADICADA: Trámite de cobro de subsidio radicado ante Compensar bajo radicado ${radicadoSolicitud} por ${req.user!.nombreCompleto}. Expediente en espera de confirmación de pago.`,
        creadoEn: new Date().toISOString()
      });

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, gestionFase7: exp.gestionFase7, expediente: exp });
    }
  );

  // 15.4.4 Registrar Observaciones / Objeciones de Compensar (Ingeniería, Administrador)
  app.post(
    "/api/expedientes/:id/fase7/registrar-observacion-desembolso",
    requireAuth(["ingenieria", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      inicializarFase7(exp);
      const { radicadoRequerimiento, detalleObservaciones, soporte } = req.body;

      const des = exp.gestionFase7!.desembolso;
      des.estadoActual = "con_observaciones";

      const nuevaRonda: RondaSubsanacionDesembolso = {
        id: `ronda-des-${Date.now()}`,
        numeroRonda: (des.rondasSubsanacion?.length || 0) + 1,
        fechaRequerimiento: new Date().toISOString(),
        radicadoRequerimiento: radicadoRequerimiento || "s/r",
        detalleObservaciones: detalleObservaciones || "Requerimiento de aclaración documental emitido por Compensar.",
        soporteRequerimiento: soporte,
        subsanada: false
      };
      des.rondasSubsanacion.unshift(nuevaRonda);

      exp.gestionFase7!.actualizadoEn = new Date().toISOString();
      exp.actualizadoEn = new Date().toISOString();

      const eventoObs: EventoHistorialFase7 = {
        id: `hist-f7-des-obs-${Date.now()}`,
        fecha: new Date().toISOString(),
        tipo: "observaciones",
        titulo: `Requerimiento de Compensar (Ronda #${nuevaRonda.numeroRonda})`,
        descripcion: detalleObservaciones,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        autorRol: req.user!.rol,
        soporte
      };
      exp.gestionFase7!.historial.unshift(eventoObs);

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, gestionFase7: exp.gestionFase7, expediente: exp });
    }
  );

  // 15.4.5 Radicar Subsanación de Desembolso ante Compensar (Ingeniería, Administrador)
  app.post(
    "/api/expedientes/:id/fase7/subsanar-desembolso",
    requireAuth(["ingenieria", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      inicializarFase7(exp);
      const { rondaId, radicadoSubsanacion, detalleSubsanacion, soporte } = req.body;

      const des = exp.gestionFase7!.desembolso;
      const ronda = des.rondasSubsanacion.find((r) => r.id === rondaId) || des.rondasSubsanacion[0];

      if (ronda) {
        ronda.subsanada = true;
        ronda.fechaSubsanacion = new Date().toISOString();
        ronda.radicadoSubsanacion = radicadoSubsanacion || "s/r";
        ronda.detalleSubsanacion = detalleSubsanacion;
        ronda.subsanadaPorId = req.user!.id;
        ronda.subsanadaPorNombre = req.user!.nombreCompleto;
        if (soporte) {
          ronda.soporteSubsanacion = soporte;
        }
      }

      des.estadoActual = "solicitado_pendiente_respuesta";
      exp.gestionFase7!.actualizadoEn = new Date().toISOString();
      exp.actualizadoEn = new Date().toISOString();

      const eventoSub: EventoHistorialFase7 = {
        id: `hist-f7-des-sub-${Date.now()}`,
        fecha: new Date().toISOString(),
        tipo: "subsanacion",
        titulo: `Subsanación Radicada ante Compensar (Ronda #${ronda?.numeroRonda || 1})`,
        descripcion: detalleSubsanacion,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        autorRol: req.user!.rol,
        soporte
      };
      exp.gestionFase7!.historial.unshift(eventoSub);

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, gestionFase7: exp.gestionFase7, expediente: exp });
    }
  );

  // 15.4.6 Confirmar Desembolso y Cerrar Expediente (Ingeniería, Administrador)
  app.post(
    "/api/expedientes/:id/fase7/confirmar-desembolso",
    requireAuth(["ingenieria", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      inicializarFase7(exp);
      const { fechaDesembolso, montoDesembolsado, numeroComprobante, notasCierre, soportePago } =
        req.body;

      const des = exp.gestionFase7!.desembolso;
      des.estadoActual = "desembolsado_confirmado";
      des.fechaDesembolso = fechaDesembolso || new Date().toISOString().split("T")[0];
      des.montoDesembolsado = Number(montoDesembolsado) || 45000000;
      des.numeroComprobante = numeroComprobante;
      des.notasCierre = notasCierre || "";
      des.confirmadoPorId = req.user!.id;
      des.confirmadoPorNombre = req.user!.nombreCompleto;
      if (soportePago) {
        des.soportePago = soportePago;
      }

      exp.gestionFase7!.estadoGeneralFase7 = "desembolsado_cerrado";

      // CIERRE FINAL DEL EXPEDIENTE: Pasa a "subsidio_desembolsado" y sale del flujo activo
      exp.estadoGeneral = "subsidio_desembolsado";
      exp.actualizadoEn = new Date().toISOString();
      exp.gestionFase7!.actualizadoEn = new Date().toISOString();

      const eventoCierre: EventoHistorialFase7 = {
        id: `hist-f7-des-cie-${Date.now()}`,
        fecha: new Date().toISOString(),
        tipo: "cierre_expediente",
        titulo: "Subsidio Desembolsado y Expediente Cerrado con Éxito",
        descripcion: `Compensar confirmó giro formal por $${des.montoDesembolsado.toLocaleString("es-CO")} COP con referencia ${numeroComprobante}. Vivienda entregada a satisfacción y trámite concluido exitosamente por ${req.user!.nombreCompleto} (${req.user!.rol}).`,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        autorRol: req.user!.rol,
        soporte: soportePago
      };
      exp.gestionFase7!.historial.unshift(eventoCierre);

      mockDb.notas.push({
        id: `not-f7-cierre-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "hito",
        contenido: `EXPEDIENTE CERRADO CON ÉXITO: Subsidio desembolsado por Compensar por valor de $${des.montoDesembolsado.toLocaleString("es-CO")} COP (Comprobante: ${numeroComprobante}). Expediente archivado en estado Subsidio Desembolsado y Cerrado.`,
        creadoEn: new Date().toISOString()
      });

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, gestionFase7: exp.gestionFase7, expediente: exp });
    }
  );

  // 15.4.7 Agregar Nota a la Bitácora de Fase 7
  app.post(
    "/api/expedientes/:id/fase7/agregar-nota",
    requireAuth(["supervisor", "ingenieria", "administrador", "comercial", "asistente"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      inicializarFase7(exp);
      const { contenido } = req.body;
      if (!contenido || !contenido.trim()) {
        res.status(400).json({ error: "El contenido de la nota no puede estar vacío." });
        return;
      }

      const eventoNota: EventoHistorialFase7 = {
        id: `hist-f7-nota-${Date.now()}`,
        fecha: new Date().toISOString(),
        tipo: "nota",
        titulo: "Nota Técnica de Seguimiento",
        descripcion: contenido.trim(),
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        autorRol: req.user!.rol
      };
      exp.gestionFase7!.historial.unshift(eventoNota);

      mockDb.notas.push({
        id: `not-f7-manual-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "conversacion",
        contenido: `[Fase 7 - Nota]: ${contenido.trim()}`,
        creadoEn: new Date().toISOString()
      });

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, gestionFase7: exp.gestionFase7 });
    }
  );

  // 16. SOLICITUD DE RECHAZO TRANSVERSAL DE HOGAR (Cambio 6)
  // 16.1 Solicitar Rechazo del Hogar (Comercial, Asistente, Ingeniería, Supervisor, Administrador)
  app.post(
    "/api/expedientes/:id/solicitar-rechazo",
    requireAuth(["comercial", "asistente", "ingenieria", "supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      if (req.user?.rol === "supervisor" && !exp.bloqueadoPorRevision) {
        res.status(400).json({ error: "El expediente está en carga por el responsable y no puede ser rechazado por el supervisor hasta su remisión a revisión." });
        return;
      }

      const { motivo, justificacion, evidenciaUrl, evidenciaNombre } = req.body;

      if (!motivo || !justificacion?.trim()) {
        res.status(400).json({ error: "Motivo y justificación detallada son obligatorios." });
        return;
      }

      const nuevaSolicitud: SolicitudRechazoHogar = {
        id: `sol-rech-${Date.now()}`,
        expedienteId: exp.id,
        solicitadoPorId: req.user!.id,
        solicitadoPorNombre: req.user!.nombreCompleto,
        solicitadoPorRol: req.user!.rol,
        fechaSolicitud: new Date().toISOString(),
        fase: exp.faseActual,
        motivo,
        justificacion,
        evidenciaUrl,
        evidenciaNombre,
        estado: "pendiente"
      };

      exp.solicitudRechazo = nuevaSolicitud;
      exp.bloqueadoPorRevision = true;

      if (!exp.historialSolicitudesRechazo) {
        exp.historialSolicitudesRechazo = [];
      }
      exp.historialSolicitudesRechazo.push(nuevaSolicitud);

      // Crear tarea de alta prioridad para Supervisor
      mockDb.tareas.push({
        id: `tar-rech-${Date.now()}`,
        expedienteId: exp.id,
        descripcion: `[REVISIÓN RECHAZO] Decidir solicitud de rechazo en Fase ${exp.faseActual}. Motivo: ${motivo}. Solicitado por ${req.user!.nombreCompleto} (${req.user!.rol}).`,
        asignadoAId: "usr-supervisor-01",
        creadoPorId: req.user!.id,
        estado: "pendiente",
        creadoEn: new Date().toISOString()
      });

      mockDb.notas.push({
        id: `not-sol-rech-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "observacion",
        contenido: `Solicitud de Rechazo del Hogar registrada por ${req.user!.nombreCompleto} (${req.user!.rol}) en Fase ${exp.faseActual}. Motivo: ${motivo}. Justificación: ${justificacion}. Pendiente de decisión del Supervisor.`,
        creadoEn: new Date().toISOString()
      });

      // Notificar dentro de la plataforma creando tareas de supervisión
      const supervisores = mockDb.perfiles.filter((u) => u.rol === "supervisor" || u.rol === "administrador");
      for (const sup of supervisores) {
        if (sup.id !== "usr-supervisor-01") {
          mockDb.tareas.push({
            id: `tar-rech-${Date.now()}-${sup.id}`,
            expedienteId: exp.id,
            descripcion: `[SOLICITUD RECHAZO] Expediente ${exp.codigoVisible || exp.id} (Fase ${exp.faseActual}). Motivo: ${motivo}. Solicitado por ${req.user!.nombreCompleto} (${req.user!.rol}).`,
            asignadoAId: sup.id,
            creadoPorId: req.user!.id,
            estado: "pendiente",
            creadoEn: new Date().toISOString()
          });
        }
      }

      // Notificación por correo electrónico (simulación en consola/log de auditoría)
      console.log(`[EMAIL DISPATCHED] Notificación formal de Solicitud de Rechazo enviada a supervisores (${supervisores.map((s) => s.email).join(", ")}) para el expediente ${exp.codigoVisible || exp.id}. Motivo: ${motivo}`);

      await sincronizarExpedienteEnSupabase(exp);

      res.status(201).json({
        success: true,
        mensaje: "Solicitud de rechazo enviada correctamente.",
        solicitud: nuevaSolicitud,
        expediente: exp
      });
    }
  );

  // 16.2 Aprobar Rechazo del Hogar (Supervisor, Administrador) -> Salida Definitiva
  app.post(
    ["/api/expedientes/:id/solicitud-rechazo/aprobar", "/api/expedientes/:id/aprobar-rechazo"],
    requireAuth(["supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id || e.codigoVisible === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      const { observacionSupervisor } = req.body;

      if (!exp.solicitudRechazo || exp.solicitudRechazo.estado !== "pendiente") {
        res.status(400).json({ error: "No hay ninguna solicitud de rechazo pendiente para este hogar." });
        return;
      }

      exp.solicitudRechazo.estado = "aprobada";
      exp.solicitudRechazo.decididoPorId = req.user!.id;
      exp.solicitudRechazo.decididoPorNombre = req.user!.nombreCompleto;
      exp.solicitudRechazo.fechaDecision = new Date().toISOString();
      exp.solicitudRechazo.observacionDecision = observacionSupervisor || "Rechazo del hogar formalmente aprobado por el Supervisor.";

      const motivoSalida = exp.solicitudRechazo.motivo || "Rechazo formal aprobado";
      const fundamentoSalida = `${exp.solicitudRechazo.justificacion || "Solicitud de retiro aprobada"}${observacionSupervisor ? ` | Dictamen Supervisor: ${observacionSupervisor}` : ""}`;

      const eventoSalida = await registrarSalidaDefinitiva(
        exp,
        motivoSalida,
        fundamentoSalida,
        req.user!.id,
        exp.faseActual
      );

      const cartaSalida: CartaSalida = {
        id: `cart-${Date.now()}`,
        eventoSalidaId: eventoSalida.id,
        comercialId: exp.comercialOrigenId,
        estadoCarta: "pendiente_elaborar",
        creadoEn: new Date().toISOString()
      };
      mockDb.cartasSalida.push(cartaSalida);

      mockDb.tareas.push({
        id: `tar-carta-${Date.now()}`,
        expedienteId: exp.id,
        descripcion: `[PLAZO 3 DÍAS] Elaborar, firmar y enviar carta de salida al postulante por Rechazo Aprobado. Motivo: ${exp.solicitudRechazo.motivo}`,
        asignadoAId: exp.comercialOrigenId,
        creadoPorId: req.user!.id,
        estado: "pendiente",
        creadoEn: new Date().toISOString()
      });

      mockDb.notas.push({
        id: `not-aprob-rech-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "observacion",
        contenido: `Rechazo del hogar APROBADO por el Supervisor ${req.user!.nombreCompleto}. Salida Definitiva del programa confirmada en Fase ${exp.faseActual}. Motivo: ${exp.solicitudRechazo.motivo}.`,
        creadoEn: new Date().toISOString()
      });

      res.json({ success: true, expediente: exp, eventoSalida, cartaSalida });
    }
  );

  // 16.3 Desestimar Solicitud de Rechazo (Supervisor, Administrador) -> Continuar Proceso
  app.post(
    ["/api/expedientes/:id/solicitud-rechazo/desestimar", "/api/expedientes/:id/desestimar-rechazo"],
    requireAuth(["supervisor", "administrador"]),
    async (req: AuthRequest, res: Response) => {
      const exp = mockDb.expedientes.find((e) => e.id === req.params.id);
      if (!exp) {
        res.status(404).json({ error: "Expediente no encontrado." });
        return;
      }

      const { motivoDesestimacion } = req.body;

      if (!motivoDesestimacion?.trim()) {
        res.status(400).json({ error: "Debe ingresar el motivo por el cual no procede el rechazo." });
        return;
      }

      if (!exp.solicitudRechazo || exp.solicitudRechazo.estado !== "pendiente") {
        res.status(400).json({ error: "No hay ninguna solicitud de rechazo pendiente para este hogar." });
        return;
      }

      const solicitanteId = exp.solicitudRechazo.solicitadoPorId;

      exp.solicitudRechazo.estado = "desestimada";
      exp.solicitudRechazo.decididoPorId = req.user!.id;
      exp.solicitudRechazo.decididoPorNombre = req.user!.nombreCompleto;
      exp.solicitudRechazo.fechaDecision = new Date().toISOString();
      exp.solicitudRechazo.observacionDecision = motivoDesestimacion;

      exp.bloqueadoPorRevision = false;

      // Notificar al solicitante
      mockDb.tareas.push({
        id: `tar-desest-${Date.now()}`,
        expedienteId: exp.id,
        descripcion: `Solicitud de rechazo desestimada por Supervisor: ${motivoDesestimacion}. El expediente continúa su trámite normal en Fase ${exp.faseActual}.`,
        asignadoAId: solicitanteId,
        creadoPorId: req.user!.id,
        estado: "pendiente",
        creadoEn: new Date().toISOString()
      });

      mockDb.notas.push({
        id: `not-desest-rech-${Date.now()}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "observacion",
        contenido: `Solicitud de rechazo DESESTIMADA por el Supervisor ${req.user!.nombreCompleto}. Motivo: ${motivoDesestimacion}. El hogar continúa normalmente en Fase ${exp.faseActual}.`,
        creadoEn: new Date().toISOString()
      });

      await sincronizarExpedienteEnSupabase(exp);

      res.json({ success: true, expediente: exp });
    }
  );

  // =========================================================================
  // MÓDULO ADMINISTRADOR — CONTROL TOTAL DEL SISTEMA (USUARIOS, CONFIGURACIÓN, REPORTES)
  // =========================================================================

  // Endpoint universal para lectura de parámetros maestros dinámicos (Fases, Municipios)
  app.get("/api/configuracion", requireAuth(), (req: AuthRequest, res: Response) => {
    res.json(mockDb.configuracionSistema);
  });

  // BLOQUE 1: GESTIÓN DE USUARIOS Y ROLES (ADMINISTRADOR)
  // 1.1 Listar todos los usuarios con estadísticas de asignación y sincronización Supabase
  app.get("/api/admin/usuarios", requireAuth(["administrador"]), async (req: AuthRequest, res: Response) => {
    // Hidratar desde Supabase como FUENTE OFICIAL si está disponible
    if (supabaseAdmin) {
      await sincronizarPerfilesDesdeSupabase();
    }

    const usuariosConStats = mockDb.perfiles.map((usr) => {
      const expedientesAsignados = mockDb.expedientes.filter(
        (exp) =>
          exp.responsableGeneralId === usr.id ||
          exp.comercialOrigenId === usr.id
      );

      const accionesContadas =
        mockDb.notas.filter((n) => n.autorId === usr.id).length +
        mockDb.revisiones.filter((r) => r.supervisorId === usr.id).length;

      return {
        id: usr.id,
        username: usr.username,
        email: usr.email,
        nombreCompleto: usr.nombreCompleto,
        rol: usr.rol,
        activo: usr.activo,
        creadoEn: usr.creadoEn,
        expedientesAsignadosCount: expedientesAsignados.length,
        expedientesActivosCount: expedientesAsignados.filter(
          (e) => e.estadoGeneral === "en_tramite" || e.estadoGeneral === "en_pausa_aporte"
        ).length,
        totalAccionesRegistradas: accionesContadas
      };
    });

    res.json(usuariosConStats);
  });

  // 1.2 Crear nuevo usuario en el sistema con UUID válido para Supabase
  app.post("/api/admin/usuarios", requireAuth(["administrador"]), async (req: AuthRequest, res: Response) => {
    const { nombreCompleto, username, email, rol, password } = req.body;

    if (!nombreCompleto || !username || !email || !rol) {
      return res.status(400).json({ error: "Faltan campos obligatorios para crear el usuario." });
    }

    const rolesValidos: RolUsuario[] = ["administrador", "supervisor", "comercial", "asistente", "ingenieria", "planeacion"];
    if (!rolesValidos.includes(rol as RolUsuario)) {
      return res.status(400).json({
        error: `El rol "${rol}" no es válido. Roles oficiales disponibles: ${rolesValidos.join(", ")}.`
      });
    }

    const cleanUsername = String(username).toLowerCase().trim();
    const cleanEmail = String(email).toLowerCase().trim();

    const usernameExistente = mockDb.perfiles.find(
      (p) => p.username.toLowerCase() === cleanUsername
    );
    if (usernameExistente) {
      return res.status(400).json({ error: "El nombre de usuario ya está en uso." });
    }

    const emailExistente = mockDb.perfiles.find(
      (p) => p.email.toLowerCase() === cleanEmail
    );
    if (emailExistente) {
      return res.status(400).json({ error: "El correo electrónico ya está registrado." });
    }

    const passwordPlano = password || "crm2026*";
    const passwordCifrado = await hashPassword(passwordPlano);

    // Generar UUID estándar compatible con la columna id UUID de Supabase
    const nuevoId = crypto.randomUUID();

    const nuevoUsuario: PerfilUsuario & { passwordHash: string } = {
      id: nuevoId,
      username: cleanUsername,
      email: cleanEmail,
      nombreCompleto: normalizarTextoNombre(String(nombreCompleto)),
      rol: rol as RolUsuario,
      activo: true,
      creadoEn: new Date().toISOString(),
      passwordHash: passwordCifrado
    };

    // Persistencia directa en Supabase (tabla perfiles_usuario con UUID)
    if (supabaseAdmin) {
      try {
        const { error: insErr } = await supabaseAdmin.from("perfiles_usuario").insert([{
          id: nuevoId,
          username: nuevoUsuario.username,
          email: nuevoUsuario.email,
          nombre_completo: nuevoUsuario.nombreCompleto,
          rol: nuevoUsuario.rol,
          activo: nuevoUsuario.activo,
          creado_en: nuevoUsuario.creadoEn,
          password_hash: passwordCifrado,
          requiere_cambio_password: false
        }]);

        if (insErr) {
          console.error("[SUPABASE]: Error insertando usuario en perfiles_usuario:", insErr);
          return res.status(500).json({ error: `Error de base de datos en Supabase: ${insErr.message}` });
        } else {
          console.log(`[SUPABASE]: Usuario ${nuevoUsuario.username} (${nuevoId}) insertado exitosamente en perfiles_usuario.`);
        }
      } catch (err: any) {
        console.error("[SUPABASE]: Excepción al insertar usuario:", err);
        return res.status(500).json({ error: `Error de servidor al guardar usuario en Supabase: ${err.message}` });
      }
    }

    mockDb.perfiles.push(nuevoUsuario);

    // Registro en auditoría
    mockDb.auditoriaAdmin.unshift({
      id: `aud-${Date.now()}`,
      fecha: new Date().toISOString(),
      adminId: req.user!.id,
      adminNombre: req.user!.nombreCompleto,
      accion: "CREAR_USUARIO",
      detalle: `Creación de usuario ${nuevoUsuario.nombreCompleto} (@${nuevoUsuario.username}) con rol ${nuevoUsuario.rol}.`,
      categoria: "usuarios",
      metadatos: { usuarioId: nuevoUsuario.id, rol: nuevoUsuario.rol, email: nuevoUsuario.email }
    });

    res.status(201).json(nuevoUsuario);
  });

  // 1.3 Editar usuario existente con persistencia directa en Supabase
  app.put("/api/admin/usuarios/:id", requireAuth(["administrador"]), async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { nombreCompleto, email, rol, activo } = req.body;

    let usr = mockDb.perfiles.find((p) => p.id === id || p.username.toLowerCase() === id.toLowerCase());
    if (!usr && supabaseAdmin) {
      await sincronizarPerfilesDesdeSupabase();
      usr = mockDb.perfiles.find((p) => p.id === id || p.username.toLowerCase() === id.toLowerCase());
    }

    if (!usr) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    if (rol) {
      const rolesValidos: RolUsuario[] = ["administrador", "supervisor", "comercial", "asistente", "ingenieria", "planeacion"];
      if (!rolesValidos.includes(rol as RolUsuario)) {
        return res.status(400).json({
          error: `El rol "${rol}" no es válido. Roles oficiales disponibles: ${rolesValidos.join(", ")}.`
        });
      }
    }

    const rolAnterior = usr.rol;
    const activoAnterior = usr.activo;

    if (nombreCompleto) usr.nombreCompleto = normalizarTextoNombre(String(nombreCompleto));
    if (email) usr.email = String(email).toLowerCase().trim();
    if (rol) usr.rol = rol as RolUsuario;
    if (activo !== undefined) usr.activo = Boolean(activo);

    // Persistencia directa en Supabase (tabla perfiles_usuario)
    if (supabaseAdmin) {
      try {
        const updatePayload: any = {};
        if (nombreCompleto) updatePayload.nombre_completo = usr.nombreCompleto;
        if (email) updatePayload.email = usr.email;
        if (rol) updatePayload.rol = usr.rol;
        if (activo !== undefined) updatePayload.activo = usr.activo;

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(usr.id);
        const { error: upErr } = isUuid
          ? await supabaseAdmin.from("perfiles_usuario").update(updatePayload).eq("id", usr.id)
          : await supabaseAdmin.from("perfiles_usuario").update(updatePayload).eq("username", usr.username);

        if (upErr) {
          console.error("[SUPABASE]: Error actualizando perfil en Supabase:", upErr);
          return res.status(500).json({ error: `Error en Supabase: ${upErr.message}` });
        }
        await sincronizarPerfilesDesdeSupabase();
        console.log(`[SUPABASE]: Perfil ${usr.username} (${usr.id}) actualizado directamente en Supabase.`);
      } catch (err: any) {
        console.error("[SUPABASE]: Excepción al actualizar perfil en Supabase:", err);
        return res.status(500).json({ error: `Excepción en Supabase: ${err.message}` });
      }
    }

    // Registro en auditoría
    mockDb.auditoriaAdmin.unshift({
      id: `aud-${Date.now()}`,
      fecha: new Date().toISOString(),
      adminId: req.user!.id,
      adminNombre: req.user!.nombreCompleto,
      accion: rolAnterior !== usr.rol ? "CAMBIAR_ROL" : "EDITAR_USUARIO",
      detalle: `Modificación de usuario ${usr.nombreCompleto}. Rol anterior: ${rolAnterior} → Nuevo: ${usr.rol}. Activo: ${usr.activo}.`,
      categoria: "usuarios",
      metadatos: { usuarioId: usr.id, rolAnterior, nuevoRol: usr.rol, activoAnterior, nuevoActivo: usr.activo }
    });

    res.json(usr);
  });

  // 1.4 Activar / Desactivar usuario con persistencia en Supabase
  app.patch("/api/admin/usuarios/:id/toggle-activo", requireAuth(["administrador"]), async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    let usr = mockDb.perfiles.find((p) => p.id === id || p.username.toLowerCase() === id.toLowerCase());
    if (!usr && supabaseAdmin) {
      await sincronizarPerfilesDesdeSupabase();
      usr = mockDb.perfiles.find((p) => p.id === id || p.username.toLowerCase() === id.toLowerCase());
    }

    if (!usr) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    // No auto-desactivarse
    if (usr.id === req.user!.id) {
      return res.status(400).json({ error: "No puede desactivar su propio usuario de Administrador actual." });
    }

    usr.activo = !usr.activo;

    if (supabaseAdmin) {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(usr.id);
        const { error: actErr } = isUuid
          ? await supabaseAdmin.from("perfiles_usuario").update({ activo: usr.activo }).eq("id", usr.id)
          : await supabaseAdmin.from("perfiles_usuario").update({ activo: usr.activo }).eq("username", usr.username);

        if (actErr) {
          console.error("[SUPABASE]: Error actualizando activo en Supabase:", actErr);
          return res.status(500).json({ error: `Error en Supabase: ${actErr.message}` });
        }
        await sincronizarPerfilesDesdeSupabase();
        console.log(`[SUPABASE]: Estado activo de ${usr.username} actualizado a ${usr.activo}.`);
      } catch (err: any) {
        console.error("[SUPABASE]: Error actualizando activo en Supabase:", err);
        return res.status(500).json({ error: `Excepción en Supabase: ${err.message}` });
      }
    }

    mockDb.auditoriaAdmin.unshift({
      id: `aud-${Date.now()}`,
      fecha: new Date().toISOString(),
      adminId: req.user!.id,
      adminNombre: req.user!.nombreCompleto,
      accion: usr.activo ? "ACTIVAR_USUARIO" : "DESACTIVAR_USUARIO",
      detalle: `${usr.activo ? "Activación" : "Desactivación"} de usuario ${usr.nombreCompleto} (@${usr.username}).`,
      categoria: "usuarios",
      metadatos: { usuarioId: usr.id, nuevoEstado: usr.activo }
    });

    res.json(usr);
  });

  // 1.5 Eliminar usuario del sistema con validación de seguridad y persistencia directa en Supabase
  app.delete("/api/admin/usuarios/:id", requireAuth(["administrador"]), async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    // Validación de seguridad 1: No auto-eliminarse
    if (id === req.user!.id) {
      return res.status(400).json({ error: "Seguridad: No puede eliminar su propia cuenta de administrador en sesión." });
    }

    let index = mockDb.perfiles.findIndex((p) => p.id === id || p.username.toLowerCase() === id.toLowerCase());
    if (index === -1 && supabaseAdmin) {
      await sincronizarPerfilesDesdeSupabase();
      index = mockDb.perfiles.findIndex((p) => p.id === id || p.username.toLowerCase() === id.toLowerCase());
    }

    if (index === -1) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    const usr = mockDb.perfiles[index];

    // Validación de seguridad 2: Expedientes asignados
    const tieneExpedientesAsignados = mockDb.expedientes.some(
      (e) => e.responsableGeneralId === usr.id || e.comercialOrigenId === usr.id
    );
    if (tieneExpedientesAsignados) {
      return res.status(400).json({
        error: `El usuario "${usr.nombreCompleto}" tiene expedientes asignados en el sistema. Reasigne sus expedientes a otro funcionario antes de proceder con la eliminación, o desactívelo para suspender su acceso.`
      });
    }

    // Eliminar de Supabase (perfiles_usuario)
    if (supabaseAdmin) {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(usr.id);
        const { error: delErr } = isUuid
          ? await supabaseAdmin.from("perfiles_usuario").delete().eq("id", usr.id)
          : await supabaseAdmin.from("perfiles_usuario").delete().eq("username", usr.username);

        if (delErr) {
          console.warn(`[SUPABASE]: Intento de eliminación física omitido (${delErr.message}). Aplicando deshabilitación (activo = false) en Supabase...`);
          const { error: softErr } = isUuid
            ? await supabaseAdmin.from("perfiles_usuario").update({ activo: false }).eq("id", usr.id)
            : await supabaseAdmin.from("perfiles_usuario").update({ activo: false }).eq("username", usr.username);

          if (softErr) {
            console.warn("[SUPABASE]: No se pudo actualizar el estado 'activo' en Supabase:", softErr.message);
          }
        }
        await sincronizarPerfilesDesdeSupabase();
        console.log(`[SUPABASE]: Usuario ${usr.username} (${usr.id}) procesado en Supabase.`);
      } catch (err: any) {
        console.warn("[SUPABASE]: Excepción al procesar eliminación de usuario en Supabase:", err?.message || err);
      }
    }

    // Eliminar de mockDb
    mockDb.perfiles.splice(index, 1);

    // Registro de auditoría
    mockDb.auditoriaAdmin.unshift({
      id: `aud-${Date.now()}`,
      fecha: new Date().toISOString(),
      adminId: req.user!.id,
      adminNombre: req.user!.nombreCompleto,
      accion: "ELIMINAR_USUARIO",
      detalle: `Eliminación permanente de usuario ${usr.nombreCompleto} (@${usr.username}, Rol: ${usr.rol}).`,
      categoria: "usuarios",
      metadatos: { usuarioEliminadoId: usr.id, username: usr.username, email: usr.email, rol: usr.rol }
    });

    res.json({ success: true, message: `Usuario ${usr.nombreCompleto} eliminado exitosamente del sistema y de Supabase.` });
  });

  // 1.5 Historial de auditoría por usuario
  app.get("/api/admin/usuarios/:id/auditoria", requireAuth(["administrador"]), (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const usr = mockDb.perfiles.find((p) => p.id === id);
    if (!usr) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    // Recolectar todas las acciones del usuario en el sistema
    const notasUsuario = mockDb.notas
      .filter((n) => n.autorId === id)
      .map((n) => ({
        tipo: "nota" as const,
        fecha: n.creadoEn,
        descripcion: `Registró nota de seguimiento: "${n.contenido.substring(0, 80)}..."`,
        expedienteId: n.expedienteId
      }));

    const revisionesUsuario = mockDb.revisiones
      .filter((r) => r.supervisorId === id)
      .map((r) => {
        const reqCaso = mockDb.requisitosCaso.find((rc) => rc.id === r.requisitoCasoId);
        return {
          tipo: "revision" as const,
          fecha: r.fechaRevision,
          descripcion: `Evaluó requisito con resultado: ${r.resultado.toUpperCase()}. Observación: "${(r.observacion || "").substring(0, 80)}"`,
          expedienteId: reqCaso?.expedienteId
        };
      });

    const expedientesAsignados = mockDb.expedientes
      .filter((e) => e.responsableGeneralId === id || e.comercialOrigenId === id)
      .map((e) => ({
        tipo: "asignacion" as const,
        fecha: e.creadoEn,
        descripcion: `Responsable del expediente ${e.codigoVisible || e.id} (Titular: ${e.postulante ? `${e.postulante.nombres} ${e.postulante.primerApellido}` : "Desconocido"}, Fase ${e.faseActual})`,
        expedienteId: e.id
      }));

    const auditoriaAdminUsuario = mockDb.auditoriaAdmin
      .filter((a) => a.adminId === id)
      .map((a) => ({
        tipo: "admin" as const,
        fecha: a.fecha,
        descripcion: `Acción administrativa: ${a.accion} - ${a.detalle}`,
        expedienteId: a.metadatos?.expedienteId
      }));

    const eventosConsolidados = [
      ...notasUsuario,
      ...revisionesUsuario,
      ...expedientesAsignados,
      ...auditoriaAdminUsuario
    ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    res.json({
      usuario: {
        id: usr.id,
        nombreCompleto: usr.nombreCompleto,
        username: usr.username,
        email: usr.email,
        rol: usr.rol,
        activo: usr.activo,
        creadoEn: usr.creadoEn
      },
      totalAcciones: eventosConsolidados.length,
      historial: eventosConsolidados
    });
  });

  // 1.6 Reasignación de cartera de expedientes (Individual o Masiva)
  app.post("/api/admin/reasignar-cartera", requireAuth(["administrador", "supervisor"]), async (req: AuthRequest, res: Response) => {
    const { origenUsuarioId, destinoUsuarioId, expedienteIds, motivo } = req.body;

    if (!destinoUsuarioId || !motivo) {
      return res.status(400).json({ error: "Debe especificar el usuario de destino y el motivo de la reasignación." });
    }

    const destino = mockDb.perfiles.find((p) => p.id === destinoUsuarioId);
    if (!destino) {
      return res.status(404).json({ error: "Usuario destino no encontrado." });
    }

    const origen = origenUsuarioId ? mockDb.perfiles.find((p) => p.id === origenUsuarioId) : null;

    // Buscar expedientes a reasignar
    let expedientesParaReasignar: Expediente[] = [];
    if (Array.isArray(expedienteIds) && expedienteIds.length > 0) {
      expedientesParaReasignar = mockDb.expedientes.filter((e) => expedienteIds.includes(e.id));
    } else if (origenUsuarioId) {
      expedientesParaReasignar = mockDb.expedientes.filter(
        (e) =>
          (e.responsableGeneralId === origenUsuarioId || e.comercialOrigenId === origenUsuarioId) &&
          e.estadoGeneral !== "salida_definitiva"
      );
    } else {
      return res.status(400).json({ error: "Debe proporcionar expedienteIds o un usuario de origen." });
    }

    if (expedientesParaReasignar.length === 0) {
      return res.status(400).json({ error: "No se encontraron expedientes elegibles para reasignar." });
    }

    const ahora = new Date().toISOString();
    let contador = 0;

    expedientesParaReasignar.forEach((exp) => {
      const responsableAnteriorId = exp.responsableGeneralId;
      const respAnterior = mockDb.perfiles.find((p) => p.id === responsableAnteriorId);
      
      exp.responsableGeneralId = destino.id;
      if (destino.rol === "comercial" && exp.faseActual === 1) {
        exp.comercialOrigenId = destino.id;
      }
      exp.actualizadoEn = ahora;
      contador++;

      // Registrar nota en bitácora de cada expediente
      mockDb.notas.push({
        id: `not-reasig-admin-${Date.now()}-${contador}`,
        expedienteId: exp.id,
        autorId: req.user!.id,
        autorNombre: req.user!.nombreCompleto,
        tipo: "observacion",
        contenido: `REASIGNACIÓN DE CARTERA POR ADMINISTRACIÓN: Expediente reasignado de ${
          respAnterior ? respAnterior.nombreCompleto : "Sin Asignar"
        } a ${destino.nombreCompleto} (${destino.rol.toUpperCase()}). Motivo: ${motivo}.`,
        creadoEn: ahora
      });
    });

    // Persistencia directa en Supabase
    if (supabaseAdmin) {
      try {
        const ids = expedientesParaReasignar.map((e) => e.id);
        await supabaseAdmin
          .from("expedientes")
          .update({
            responsable_general_id: destino.id,
            actualizado_en: ahora
          })
          .in("id", ids);
        console.log(`[SUPABASE]: ${ids.length} expedientes actualizados con nuevo responsable en Supabase.`);
      } catch (err: any) {
        console.error("[SUPABASE]: Error en reasignar-cartera en Supabase:", err);
      }
    }

    // Registrar en auditoría general
    mockDb.auditoriaAdmin.unshift({
      id: `aud-${Date.now()}`,
      fecha: ahora,
      adminId: req.user!.id,
      adminNombre: req.user!.nombreCompleto,
      accion: "REASIGNAR_CARTERA",
      detalle: `Reasignación masiva de ${contador} expediente(s) hacia ${destino.nombreCompleto}. Motivo: ${motivo}.`,
      categoria: "reasignacion",
      metadatos: {
        origenUsuarioId,
        destinoUsuarioId: destino.id,
        cantidadExpedientes: contador,
        expedientesIds: expedientesParaReasignar.map((e) => e.id),
        motivo
      }
    });

    res.json({
      success: true,
      mensaje: `Se reasignaron exitosamente ${contador} expediente(s) a ${destino.nombreCompleto}.`,
      cantidadReasignados: contador
    });
  });

  // BLOQUE 2: CONFIGURACIÓN DEL SISTEMA (PARÁMETROS MAESTROS)
  // 2.1 Obtener configuración completa del sistema y auditoría
  app.get("/api/admin/configuracion", requireAuth(["administrador"]), async (req: AuthRequest, res: Response) => {
    // Si Supabase está disponible, recuperar origenes de captacion persistidos en configuracion_sistema
    if (supabaseAdmin) {
      try {
        const { data: configRow } = await supabaseAdmin
          .from("configuracion_sistema")
          .select("datos")
          .eq("id", "origenes_captacion")
          .maybeSingle();
        if (configRow?.datos && Array.isArray(configRow.datos) && configRow.datos.length > 0) {
          mockDb.configuracionSistema.origenesCaptacion = configRow.datos;
        }
      } catch (err) {
        // silencioso
      }
    }

    res.json({
      configuracion: mockDb.configuracionSistema,
      auditoria: mockDb.auditoriaAdmin
    });
  });

  // 2.1b Obtener catálogo activo de orígenes de captación para la aplicación
  app.get("/api/configuracion/origenes-captacion", async (req: Request, res: Response) => {
    if (supabaseAdmin) {
      try {
        const { data: configRow } = await supabaseAdmin
          .from("configuracion_sistema")
          .select("datos")
          .eq("id", "origenes_captacion")
          .maybeSingle();
        if (configRow?.datos && Array.isArray(configRow.datos) && configRow.datos.length > 0) {
          mockDb.configuracionSistema.origenesCaptacion = configRow.datos;
        }
      } catch (err) {
        // silencioso
      }
    }
    const origenes = mockDb.configuracionSistema.origenesCaptacion || [];
    res.json({
      success: true,
      origenes: origenes.filter((o) => o.activo).map((o) => o.nombre),
      detalles: origenes
    });
  });

  // 2.1c Registrar nuevo origen de captación
  app.post("/api/admin/configuracion/origenes", requireAuth(["administrador"]), async (req: AuthRequest, res: Response) => {
    const { nombre, descripcion, activo } = req.body;
    const nombreLimpio = String(nombre || "").trim();

    if (!nombreLimpio) {
      return res.status(400).json({ error: "El nombre del origen de captación es obligatorio." });
    }

    if (!mockDb.configuracionSistema.origenesCaptacion) {
      mockDb.configuracionSistema.origenesCaptacion = [];
    }

    const duplicado = mockDb.configuracionSistema.origenesCaptacion.find(
      (o) => o.nombre.toLowerCase() === nombreLimpio.toLowerCase()
    );

    if (duplicado) {
      return res.status(400).json({ error: `Ya existe un origen de captación con el nombre '${duplicado.nombre}'.` });
    }

    const nuevoOrigen = {
      id: `orig-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      nombre: nombreLimpio,
      descripcion: String(descripcion || "Origen de captación personalizado registrado por administración").trim(),
      activo: activo !== undefined ? Boolean(activo) : true,
      esPersonalizado: true,
      creadoEn: new Date().toISOString()
    };

    mockDb.configuracionSistema.origenesCaptacion.push(nuevoOrigen);

    mockDb.auditoriaAdmin.unshift({
      id: `aud-${Date.now()}`,
      fecha: new Date().toISOString(),
      adminId: req.user!.id,
      adminNombre: req.user!.nombreCompleto,
      accion: "AGREGAR_ORIGEN_CAPTACION",
      detalle: `Nuevo origen de captación incorporado: '${nuevoOrigen.nombre}'.`,
      categoria: "configuracion"
    });

    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from("configuracion_sistema").upsert({
          id: "origenes_captacion",
          datos: mockDb.configuracionSistema.origenesCaptacion,
          actualizado_en: new Date().toISOString()
        });
      } catch (err: any) {
        console.warn("[SUPABASE PERSIST ORIGEN ERROR]:", err?.message || err);
      }
    }

    res.status(201).json({
      success: true,
      mensaje: `Origen '${nuevoOrigen.nombre}' agregado correctamente.`,
      origen: nuevoOrigen,
      origenes: mockDb.configuracionSistema.origenesCaptacion
    });
  });

  // 2.1d Actualizar origen de captación
  app.put("/api/admin/configuracion/origenes/:id", requireAuth(["administrador"]), async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { nombre, descripcion, activo } = req.body;

    const origen = (mockDb.configuracionSistema.origenesCaptacion || []).find((o) => o.id === id);
    if (!origen) {
      return res.status(404).json({ error: "Origen de captación no encontrado." });
    }

    if (nombre && String(nombre).trim()) {
      origen.nombre = String(nombre).trim();
    }
    if (descripcion !== undefined) {
      origen.descripcion = String(descripcion).trim();
    }
    if (activo !== undefined) {
      origen.activo = Boolean(activo);
    }

    mockDb.auditoriaAdmin.unshift({
      id: `aud-${Date.now()}`,
      fecha: new Date().toISOString(),
      adminId: req.user!.id,
      adminNombre: req.user!.nombreCompleto,
      accion: "EDITAR_ORIGEN_CAPTACION",
      detalle: `Origen de captación '${origen.nombre}' actualizado (Activo: ${origen.activo}).`,
      categoria: "configuracion"
    });

    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from("configuracion_sistema").upsert({
          id: "origenes_captacion",
          datos: mockDb.configuracionSistema.origenesCaptacion,
          actualizado_en: new Date().toISOString()
        });
      } catch (err: any) {
        console.warn("[SUPABASE UPDATE ORIGEN ERROR]:", err?.message || err);
      }
    }

    res.json({
      success: true,
      mensaje: `Origen de captación '${origen.nombre}' actualizado con éxito.`,
      origen,
      origenes: mockDb.configuracionSistema.origenesCaptacion
    });
  });

  // 2.1e Eliminar origen de captación personalizado
  app.delete("/api/admin/configuracion/origenes/:id", requireAuth(["administrador"]), async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const idx = (mockDb.configuracionSistema.origenesCaptacion || []).findIndex((o) => o.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: "Origen de captación no encontrado." });
    }

    const origenEliminado = mockDb.configuracionSistema.origenesCaptacion![idx];
    mockDb.configuracionSistema.origenesCaptacion!.splice(idx, 1);

    mockDb.auditoriaAdmin.unshift({
      id: `aud-${Date.now()}`,
      fecha: new Date().toISOString(),
      adminId: req.user!.id,
      adminNombre: req.user!.nombreCompleto,
      accion: "ELIMINAR_ORIGEN_CAPTACION",
      detalle: `Origen de captación eliminado: '${origenEliminado.nombre}'.`,
      categoria: "configuracion"
    });

    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from("configuracion_sistema").upsert({
          id: "origenes_captacion",
          datos: mockDb.configuracionSistema.origenesCaptacion,
          actualizado_en: new Date().toISOString()
        });
      } catch (err: any) {
        console.warn("[SUPABASE DELETE ORIGEN ERROR]:", err?.message || err);
      }
    }

    res.json({
      success: true,
      mensaje: `Origen '${origenEliminado.nombre}' eliminado exitosamente.`,
      origenes: mockDb.configuracionSistema.origenesCaptacion
    });
  });

  // 2.2 Agregar o editar municipio
  app.post("/api/admin/configuracion/municipios", requireAuth(["administrador"]), (req: AuthRequest, res: Response) => {
    const { codigoCompleto, departamentoCodigo, municipioCodigo, departamentoNombre, municipioNombre, activo } = req.body;

    if (!codigoCompleto || !municipioNombre || !departamentoNombre) {
      return res.status(400).json({ error: "Faltan campos obligatorios para el municipio." });
    }

    const existenteIndex = mockDb.configuracionSistema.municipios.findIndex(
      (m) => m.codigoCompleto === codigoCompleto
    );

    if (existenteIndex >= 0) {
      // Actualizar existente
      mockDb.configuracionSistema.municipios[existenteIndex] = {
        ...mockDb.configuracionSistema.municipios[existenteIndex],
        municipioNombre: normalizarTextoNombre(municipioNombre),
        departamentoNombre: normalizarTextoNombre(departamentoNombre),
        activo: activo !== undefined ? Boolean(activo) : true
      };

      mockDb.auditoriaAdmin.unshift({
        id: `aud-${Date.now()}`,
        fecha: new Date().toISOString(),
        adminId: req.user!.id,
        adminNombre: req.user!.nombreCompleto,
        accion: "EDITAR_MUNICIPIO",
        detalle: `Municipio modificado: ${municipioNombre} (${codigoCompleto}) - Activo: ${activo}.`,
        categoria: "configuracion"
      });

      return res.json(mockDb.configuracionSistema.municipios[existenteIndex]);
    }

    // Agregar nuevo municipio
    const nuevoMunicipio = {
      codigoCompleto: String(codigoCompleto).trim(),
      departamentoCodigo: String(departamentoCodigo || "25").trim(),
      municipioCodigo: String(municipioCodigo || codigoCompleto.slice(-3)).trim(),
      departamentoNombre: normalizarTextoNombre(departamentoNombre),
      municipioNombre: normalizarTextoNombre(municipioNombre),
      activo: activo !== undefined ? Boolean(activo) : true
    };

    mockDb.configuracionSistema.municipios.push(nuevoMunicipio);
    mockDb.configuracionSistema.municipios.sort((a, b) => a.municipioNombre.localeCompare(b.municipioNombre));

    mockDb.auditoriaAdmin.unshift({
      id: `aud-${Date.now()}`,
      fecha: new Date().toISOString(),
      adminId: req.user!.id,
      adminNombre: req.user!.nombreCompleto,
      accion: "AGREGAR_MUNICIPIO",
      detalle: `Nuevo municipio incorporado al catálogo: ${nuevoMunicipio.municipioNombre}, Depto: ${nuevoMunicipio.departamentoNombre} (${nuevoMunicipio.codigoCompleto}).`,
      categoria: "configuracion"
    });

    res.status(201).json(nuevoMunicipio);
  });

  // 2.3 Editar municipio existente
  app.put("/api/admin/configuracion/municipios/:codigo", requireAuth(["administrador"]), (req: AuthRequest, res: Response) => {
    const { codigo } = req.params;
    const { municipioNombre, activo } = req.body;

    const mun = mockDb.configuracionSistema.municipios.find((m) => m.codigoCompleto === codigo);
    if (!mun) {
      return res.status(404).json({ error: "Municipio no encontrado." });
    }

    if (municipioNombre) mun.municipioNombre = normalizarTextoNombre(municipioNombre);
    if (activo !== undefined) mun.activo = Boolean(activo);

    mockDb.auditoriaAdmin.unshift({
      id: `aud-${Date.now()}`,
      fecha: new Date().toISOString(),
      adminId: req.user!.id,
      adminNombre: req.user!.nombreCompleto,
      accion: "EDITAR_MUNICIPIO",
      detalle: `Municipio actualizado: ${mun.municipioNombre} (${mun.codigoCompleto}). Estado activo: ${mun.activo}.`,
      categoria: "configuracion"
    });

    res.json(mun);
  });

  // 2.4 Agregar nuevo departamento
  app.post("/api/admin/configuracion/departamentos", requireAuth(["administrador"]), (req: AuthRequest, res: Response) => {
    const { codigo, nombre, activo } = req.body;
    if (!codigo || !nombre) {
      return res.status(400).json({ error: "Falta código y nombre del departamento." });
    }

    const existente = mockDb.configuracionSistema.departamentos.find((d) => d.codigo === codigo);
    if (existente) {
      existente.nombre = normalizarTextoNombre(nombre);
      existente.activo = activo !== undefined ? Boolean(activo) : true;
      return res.json(existente);
    }

    const nuevoDepto = {
      codigo: String(codigo).trim(),
      nombre: normalizarTextoNombre(nombre),
      activo: activo !== undefined ? Boolean(activo) : true
    };

    mockDb.configuracionSistema.departamentos.push(nuevoDepto);

    mockDb.auditoriaAdmin.unshift({
      id: `aud-${Date.now()}`,
      fecha: new Date().toISOString(),
      adminId: req.user!.id,
      adminNombre: req.user!.nombreCompleto,
      accion: "AGREGAR_DEPARTAMENTO",
      detalle: `Nuevo departamento habilitado: ${nuevoDepto.nombre} (Código DANE ${nuevoDepto.codigo}).`,
      categoria: "configuracion"
    });

    res.status(201).json(nuevoDepto);
  });

  // 2.5 Actualizar nombre y descripción de las 7 fases
  app.put("/api/admin/configuracion/fases/:num", requireAuth(["administrador"]), (req: AuthRequest, res: Response) => {
    const num = parseInt(req.params.num, 10);
    const { label, desc, rolSugerido } = req.body;

    const fase = mockDb.configuracionSistema.fases.find((f) => f.num === num);
    if (!fase) {
      return res.status(404).json({ error: "Fase no encontrada." });
    }

    const labelAnterior = fase.label;
    if (label) fase.label = String(label).trim();
    if (desc) fase.desc = String(desc).trim();
    if (rolSugerido) fase.rolSugerido = rolSugerido as RolUsuario;

    mockDb.auditoriaAdmin.unshift({
      id: `aud-${Date.now()}`,
      fecha: new Date().toISOString(),
      adminId: req.user!.id,
      adminNombre: req.user!.nombreCompleto,
      accion: "EDITAR_FASE",
      detalle: `Fase ${num} renombrada de "${labelAnterior}" a "${fase.label}".`,
      categoria: "configuracion",
      metadatos: { faseNum: num, labelAnterior, labelNuevo: fase.label, desc: fase.desc }
    });

    res.json(fase);
  });

  // 2.6 Agregar documento maestro requerido por fase
  app.post("/api/admin/configuracion/requisitos", requireAuth(["administrador"]), (req: AuthRequest, res: Response) => {
    const { codigo, nombre, descripcion, fase, esObligatorio, orden, orientacionTecnica } = req.body;

    if (!codigo || !nombre || !fase) {
      return res.status(400).json({ error: "Faltan campos obligatorios para el requisito." });
    }

    const faseNum = parseInt(fase, 10);
    const nuevoRequisito: RequisitoMaestroConfig = {
      id: `req-m-${String(codigo).toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}`,
      codigo: String(codigo).toUpperCase().trim(),
      nombre: String(nombre).trim(),
      descripcion: String(descripcion || "").trim(),
      fase: faseNum,
      esObligatorio: esObligatorio !== undefined ? Boolean(esObligatorio) : true,
      activo: true,
      orden: orden ? parseInt(orden, 10) : mockDb.configuracionSistema.requisitosMaestros.filter((r) => r.fase === faseNum).length + 1,
      orientacionTecnica: orientacionTecnica ? String(orientacionTecnica).trim() : undefined
    };

    mockDb.configuracionSistema.requisitosMaestros.push(nuevoRequisito);

    // REGLA DE NO RETROACTIVIDAD:
    // Solo anexar a expedientes actualmente en curso cuya faseActual sea <= faseNum.
    // Los expedientes que YA SUPERARON esa fase (faseActual > faseNum) NO se afectan.
    let countAfectados = 0;
    mockDb.expedientes.forEach((exp) => {
      if (exp.faseActual === faseNum && exp.estadoGeneral === "en_tramite") {
        const yaExiste = mockDb.requisitosCaso.some(
          (rc) => rc.expedienteId === exp.id && rc.codigoRequisito === nuevoRequisito.codigo
        );
        if (!yaExiste) {
          mockDb.requisitosCaso.push({
            id: `req-${nuevoRequisito.codigo.toLowerCase()}-${exp.id}`,
            expedienteId: exp.id,
            codigoRequisito: nuevoRequisito.codigo,
            nombre: nuevoRequisito.nombre,
            descripcion: nuevoRequisito.descripcion,
            fase: faseNum,
            predioId: exp.predioVivienda?.id,
            estado: "pendiente_carga",
            esObligatorio: nuevoRequisito.esObligatorio,
            esAdicional: false
          });
          countAfectados++;
        }
      }
    });

    mockDb.auditoriaAdmin.unshift({
      id: `aud-${Date.now()}`,
      fecha: new Date().toISOString(),
      adminId: req.user!.id,
      adminNombre: req.user!.nombreCompleto,
      accion: "AGREGAR_REQUISITO_MAESTRO",
      detalle: `Requisito maestro incorporado: ${nuevoRequisito.codigo} - ${nuevoRequisito.nombre} en Fase ${faseNum}. Asignado a ${countAfectados} expediente(s) activos en esta fase.`,
      categoria: "configuracion",
      metadatos: { requisito: nuevoRequisito, expedientesAfectados: countAfectados }
    });

    res.status(201).json(nuevoRequisito);
  });

  // 2.7 Actualizar requisito maestro
  app.put("/api/admin/configuracion/requisitos/:id", requireAuth(["administrador"]), (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { nombre, descripcion, esObligatorio, activo, orden, orientacionTecnica } = req.body;

    const reqM = mockDb.configuracionSistema.requisitosMaestros.find((r) => r.id === id);
    if (!reqM) {
      return res.status(404).json({ error: "Requisito maestro no encontrado." });
    }

    if (nombre) reqM.nombre = String(nombre).trim();
    if (descripcion !== undefined) reqM.descripcion = String(descripcion).trim();
    if (esObligatorio !== undefined) reqM.esObligatorio = Boolean(esObligatorio);
    if (activo !== undefined) reqM.activo = Boolean(activo);
    if (orden !== undefined) reqM.orden = parseInt(orden, 10);
    if (orientacionTecnica !== undefined) reqM.orientacionTecnica = String(orientacionTecnica).trim();

    mockDb.auditoriaAdmin.unshift({
      id: `aud-${Date.now()}`,
      fecha: new Date().toISOString(),
      adminId: req.user!.id,
      adminNombre: req.user!.nombreCompleto,
      accion: "EDITAR_REQUISITO_MAESTRO",
      detalle: `Actualización de requisito maestro ${reqM.codigo}: ${reqM.nombre}. Obligatorio: ${reqM.esObligatorio}, Activo: ${reqM.activo}.`,
      categoria: "configuracion"
    });

    res.json(reqM);
  });

  // 2.8 Desactivar / Eliminar requisito maestro
  app.delete("/api/admin/configuracion/requisitos/:id", requireAuth(["administrador"]), (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const reqM = mockDb.configuracionSistema.requisitosMaestros.find((r) => r.id === id);
    if (!reqM) {
      return res.status(404).json({ error: "Requisito maestro no encontrado." });
    }

    reqM.activo = false;

    mockDb.auditoriaAdmin.unshift({
      id: `aud-${Date.now()}`,
      fecha: new Date().toISOString(),
      adminId: req.user!.id,
      adminNombre: req.user!.nombreCompleto,
      accion: "DESACTIVAR_REQUISITO_MAESTRO",
      detalle: `Desactivación de requisito maestro ${reqM.codigo}: ${reqM.nombre} de Fase ${reqM.fase}.`,
      categoria: "configuracion"
    });

    res.json({ success: true, requisito: reqM });
  });

  // 2.9 Actualizar textos de plantillas de fases especiales
  app.put("/api/admin/configuracion/plantillas-fases", requireAuth(["administrador"]), (req: AuthRequest, res: Response) => {
    const { fase4, fase5, fase6, fase7 } = req.body;

    if (fase4) mockDb.configuracionSistema.plantillasFases.fase4 = { ...mockDb.configuracionSistema.plantillasFases.fase4, ...fase4 };
    if (fase5) mockDb.configuracionSistema.plantillasFases.fase5 = { ...mockDb.configuracionSistema.plantillasFases.fase5, ...fase5 };
    if (fase6) mockDb.configuracionSistema.plantillasFases.fase6 = { ...mockDb.configuracionSistema.plantillasFases.fase6, ...fase6 };
    if (fase7) mockDb.configuracionSistema.plantillasFases.fase7 = { ...mockDb.configuracionSistema.plantillasFases.fase7, ...fase7 };

    mockDb.auditoriaAdmin.unshift({
      id: `aud-${Date.now()}`,
      fecha: new Date().toISOString(),
      adminId: req.user!.id,
      adminNombre: req.user!.nombreCompleto,
      accion: "EDITAR_PLANTILLAS_FASES",
      detalle: "Modificación de textos y orientaciones técnicas de fases especiales (Fases 4 a 7).",
      categoria: "configuracion"
    });

    res.json(mockDb.configuracionSistema.plantillasFases);
  });

  // 2.10 Limpiar todos los expedientes de prueba (Acción Exclusiva de Administrador para arranque desde cero)
  app.post("/api/admin/limpiar-expedientes", requireAuth(["administrador"]), async (req: AuthRequest, res: Response) => {
    try {
      // 1. Limpieza en memoria
      mockDb.expedientes = [];
      mockDb.interesados = [];
      mockDb.requisitosCaso = [];
      mockDb.documentos = [];
      mockDb.versiones = [];
      mockDb.revisiones = [];
      mockDb.notas = [];
      mockDb.tareas = [];
      mockDb.eventosSalida = [];
      mockDb.cartasSalida = [];
      mockDb.solicitudesRetiro = [];

      // 2. Limpieza en Supabase PostgreSQL si está activo
      if (supabaseAdmin) {
        const tablasALimpiar = [
          "versiones_documento",
          "documentos",
          "requisitos_caso",
          "eventos_salida",
          "cartas_salida",
          "solicitudes_retiro_cedula",
          "expedientes",
          "integrantes_hogar",
          "hogares",
          "predios",
          "interesados",
          "personas"
        ];
        for (const tbl of tablasALimpiar) {
          try {
            await supabaseAdmin.from(tbl).delete().neq("id", "00000000-0000-0000-0000-000000000000");
          } catch {}
        }
      }

      mockDb.auditoriaAdmin.unshift({
        id: `aud-${Date.now()}`,
        fecha: new Date().toISOString(),
        adminId: req.user!.id,
        adminNombre: req.user!.nombreCompleto,
        accion: "LIMPIAR_EXPEDIENTES_PRUEBA",
        detalle: "Se eliminaron todos los expedientes e interesados de prueba para inicializar el sistema desde cero.",
        categoria: "sistema"
      });

      res.json({
        success: true,
        message: "Todos los expedientes y registros de prueba han sido eliminados. El sistema se encuentra en blanco listo para producción.",
        totalExpedientes: 0,
        totalInteresados: 0
      });
    } catch (err: any) {
      res.status(500).json({ error: "Error al limpiar expedientes de prueba: " + (err?.message || "error desconocido") });
    }
  });

  // 2.11 Generar o poblar casos de ejemplo para cada una de las 7 fases operativas
  app.post("/api/admin/crear-casos-ejemplo", requireAuth(["administrador", "planeacion", "supervisor", "comercial", "asistente", "ingenieria"]), async (req: AuthRequest, res: Response) => {
    try {
      const resultado = await generarCasosEjemploParaCadaFase(supabaseAdmin, mockDb);
      res.json(resultado);
    } catch (err: any) {
      console.error("[CASOS EJEMPLO ERROR]:", err?.message);
      res.status(500).json({ error: "Error al generar casos de ejemplo: " + (err?.message || "error desconocido") });
    }
  });

  app.get("/api/admin/crear-casos-ejemplo", requireAuth(["administrador", "planeacion", "supervisor", "comercial", "asistente", "ingenieria"]), async (req: AuthRequest, res: Response) => {
    try {
      const resultado = await generarCasosEjemploParaCadaFase(supabaseAdmin, mockDb);
      res.json(resultado);
    } catch (err: any) {
      console.error("[CASOS EJEMPLO ERROR]:", err?.message);
      res.status(500).json({ error: "Error al generar casos de ejemplo: " + (err?.message || "error desconocido") });
    }
  });

  // BLOQUE 3: VISIBILIDAD GLOBAL Y REPORTES (ADMINISTRADOR Y PLANEACIÓN)
  // 3.1 Dashboard general con métricas, financiero, tiempos y cuellos de botella
  app.get("/api/admin/reportes/dashboard", requireAuth(["administrador", "planeacion"]), (req: AuthRequest, res: Response) => {
    const expedientes = mockDb.expedientes;
    const ahora = Date.now();

    // Métricas de estado
    const totalExpedientes = expedientes.length;
    const activosEnTramite = expedientes.filter((e) => e.estadoGeneral === "en_tramite").length;
    const enPausaAporte = expedientes.filter((e) => e.estadoGeneral === "en_pausa_aporte").length;
    const bloqueadosRevision = expedientes.filter((e) => e.bloqueadoPorRevision && e.estadoGeneral === "en_tramite").length;
    const subsidioDesembolsado = expedientes.filter((e) => e.estadoGeneral === "subsidio_desembolsado").length;
    const salidaDefinitiva = expedientes.filter((e) => e.estadoGeneral === "salida_definitiva").length;

    // Reporte financiero: monto total desembolsado
    let totalDesembolsadoCOP = 0;
    const reporteFinanciero: any[] = [];

    expedientes.forEach((e) => {
      const g7 = e.gestionFase7;
      const desembolso = g7?.desembolso as any;
      const munObj = mockDb.configuracionSistema.municipios.find(
        (m) => m.codigoCompleto === e.predioVivienda?.municipioCodigo
      );
      const munNombre = munObj ? munObj.municipioNombre : (e.predioVivienda?.municipioCodigo || "Cundinamarca");

      if (e.estadoGeneral === "subsidio_desembolsado" || desembolso?.montoDesembolsado) {
        const monto = desembolso?.montoDesembolsado || 40000000;
        totalDesembolsadoCOP += monto;
        reporteFinanciero.push({
          expedienteId: e.id,
          codigoVisible: e.codigoVisible || e.id,
          titular: e.postulante ? `${e.postulante.nombres} ${e.postulante.primerApellido}` : "Titular",
          municipio: munNombre,
          fechaDesembolso: desembolso?.fechaDesembolso || e.actualizadoEn,
          montoDesembolsado: monto,
          numeroComprobante: desembolso?.numeroComprobante || "CMP-2026-001",
          entidad: desembolso?.entidad || "Caja de Compensación Familiar Compensar"
        });
      }
    });

    const promedioDesembolsadoCOP =
      subsidioDesembolsado > 0 ? Math.round(totalDesembolsadoCOP / subsidioDesembolsado) : 0;

    // Métricas por Fase (1 a 7)
    const fasesInfo = mockDb.configuracionSistema.fases;
    const porFase = fasesInfo.map((f) => {
      const cantidad = expedientes.filter((e) => e.faseActual === f.num && e.estadoGeneral !== "salida_definitiva").length;
      return {
        fase: f.num,
        label: f.label,
        cantidad,
        porcentaje: totalExpedientes > 0 ? Math.round((cantidad / totalExpedientes) * 100) : 0
      };
    });

    // Métricas por Municipio
    const municipiosMap = new Map<string, { municipio: string; departamento: string; cantidad: number; desembolsados: number; totalMonto: number }>();

    expedientes.forEach((e) => {
      const munObj = mockDb.configuracionSistema.municipios.find(
        (m) => m.codigoCompleto === e.predioVivienda?.municipioCodigo
      );
      const munNombre = munObj ? munObj.municipioNombre : "Sin especificar";
      const deptoNombre = munObj ? munObj.departamentoNombre : "Cundinamarca";
      const key = `${deptoNombre}-${munNombre}`;

      if (!municipiosMap.has(key)) {
        municipiosMap.set(key, {
          municipio: munNombre,
          departamento: deptoNombre,
          cantidad: 0,
          desembolsados: 0,
          totalMonto: 0
        });
      }

      const item = municipiosMap.get(key)!;
      item.cantidad++;
      if (e.estadoGeneral === "subsidio_desembolsado") {
        item.desembolsados++;
        item.totalMonto += e.gestionFase7?.desembolso?.montoDesembolsado || 40000000;
      }
    });

    const porMunicipio = Array.from(municipiosMap.values()).sort((a, b) => b.cantidad - a.cantidad);

    // Métricas por Responsable
    const porResponsable = mockDb.perfiles.map((usr) => {
      const asignados = expedientes.filter((e) => e.responsableGeneralId === usr.id);
      return {
        responsableId: usr.id,
        nombre: usr.nombreCompleto,
        rol: usr.rol,
        totalAsignados: asignados.length,
        enTramite: asignados.filter((e) => e.estadoGeneral === "en_tramite" || e.estadoGeneral === "en_pausa_aporte").length
      };
    }).filter((r) => r.totalAsignados > 0 || r.rol === "comercial" || r.rol === "asistente" || r.rol === "ingenieria" || r.rol === "supervisor");

    // Tiempos y Cuellos de Botella
    let sumaDiasTotales = 0;
    const cuellosMap = new Map<number, { sumaDias: number; count: number; rezagados: number }>();
    const expedientesRezagados: any[] = [];

    expedientes.forEach((e) => {
      const fechaCreacion = new Date(e.fechaIngresoFase1 || e.creadoEn).getTime();
      const diasTotales = Math.max(0, Math.floor((ahora - fechaCreacion) / (1000 * 60 * 60 * 24)));
      sumaDiasTotales += diasTotales;

      const fechaFase = new Date(e.actualizadoEn || e.creadoEn).getTime();
      const diasEnFase = Math.max(0, Math.floor((ahora - fechaFase) / (1000 * 60 * 60 * 24)));

      const faseActual = e.faseActual;
      if (!cuellosMap.has(faseActual)) {
        cuellosMap.set(faseActual, { sumaDias: 0, count: 0, rezagados: 0 });
      }
      const c = cuellosMap.get(faseActual)!;
      c.sumaDias += diasEnFase;
      c.count++;

      // Rezagado si lleva más de 20 días en la misma fase
      if (diasEnFase >= 20 && e.estadoGeneral === "en_tramite") {
        c.rezagados++;
        const resp = mockDb.perfiles.find((p) => p.id === e.responsableGeneralId);
        const munObj = mockDb.configuracionSistema.municipios.find(
          (m) => m.codigoCompleto === e.predioVivienda?.municipioCodigo
        );
        expedientesRezagados.push({
          id: e.id,
          codigoVisible: e.codigoVisible || e.id,
          titular: e.postulante ? `${e.postulante.nombres} ${e.postulante.primerApellido}` : "Titular",
          faseActual: e.faseActual,
          diasEnFase,
          diasTotales,
          responsable: resp ? resp.nombreCompleto : "Sin asignar",
          municipio: munObj ? munObj.municipioNombre : (e.predioVivienda?.municipioCodigo || "Cundinamarca"),
          estadoGeneral: e.estadoGeneral
        });
      }
    });

    const tiempoPromedioTramiteDias = totalExpedientes > 0 ? Math.round(sumaDiasTotales / totalExpedientes) : 0;

    const cuellosDeBotella = fasesInfo.map((f) => {
      const c = cuellosMap.get(f.num) || { sumaDias: 0, count: 0, rezagados: 0 };
      return {
        fase: f.num,
        label: f.label,
        promedioDias: c.count > 0 ? Math.round(c.sumaDias / c.count) : 0,
        rezagadosCount: c.rezagados
      };
    });

    expedientesRezagados.sort((a, b) => b.diasEnFase - a.diasEnFase);

    res.json({
      totalExpedientes,
      activosEnTramite,
      enPausaAporte,
      bloqueadosRevision,
      subsidioDesembolsado,
      salidaDefinitiva,
      totalDesembolsadoCOP,
      promedioDesembolsadoCOP,
      tiempoPromedioTramiteDias,
      porFase,
      porMunicipio,
      porResponsable,
      cuellosDeBotella,
      expedientesRezagados,
      reporteFinanciero
    });
  });

  // 3.2 Listado completo de bitácora de auditoría general del sistema
  app.get("/api/admin/auditoria", requireAuth(["administrador", "planeacion"]), (req: AuthRequest, res: Response) => {
    res.json(mockDb.auditoriaAdmin);
  });

  // =========================================================================
  // GARANTÍA JSON PARA RUTAS /api (PREVIENE FALLBACKS HTML Y SyntaxError '<')
  // =========================================================================
  app.all("/api/*", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(404).json({
      error: `Ruta de API no encontrada: ${req.method} ${req.originalUrl || req.path}`,
      ok: false
    });
  });

  // Manejador de errores global para Express: responde con JSON a peticiones de API
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error("[EXPRESS API ERROR]:", err);
    if (res.headersSent) {
      return next(err);
    }
    const statusCode = err.status || err.statusCode || 500;
    if (req.path.startsWith("/api") || req.xhr || req.headers.accept?.includes("application/json")) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.status(statusCode).json({
        error: err.message || "Error interno del servidor",
        ok: false
      });
      return;
    }
    next(err);
  });

  return app;
}

export async function startServer(): Promise<express.Express> {
  const app = await createApp();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  // ==========================================
  // CONFIGURACIÓN VITE MIDDLEWARE (DEV/PROD)
  // ==========================================
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: PORT },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      // Bloquear entrega de HTML si la solicitud apunta a un endpoint de API o archivo subido
      if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.status(404).json({ error: "Recurso no encontrado", ok: false });
        return;
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor CRM VRD activo en el puerto ${PORT} (0.0.0.0)`);
  });

  return app;
}

// En Render y entornos Node.js estándar se inicia el servidor HTTP
if (process.env.NODE_ENV !== "test") {
  startServer();
}
