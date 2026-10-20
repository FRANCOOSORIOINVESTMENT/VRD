import bcrypt from "bcryptjs";
import crypto from "crypto";
import { PerfilUsuario, RolUsuario } from "../types";

/**
 * CONFIGURACIÓN DE SEGURIDAD PARA CIFRADO BCRYPT
 * Se define un factor de coste (salt rounds) de 10, equilibrando seguridad criptográfica y rendimiento.
 */
const SALT_ROUNDS = 10;

/** Longitud mínima de contraseña para cuentas nuevas. */
export const LONGITUD_MINIMA_PASSWORD = 8;

/**
 * Cifra una contraseña en texto plano utilizando bcryptjs con salt de 10 rondas.
 * @param passwordPlana Contraseña en texto plano a cifrar.
 * @returns Hash seguro en formato modular de bcrypt ($2a$10$...).
 */
export async function hashPassword(passwordPlana: string): Promise<string> {
  if (!passwordPlana || passwordPlana.trim().length === 0) {
    throw new Error("La contraseña no puede estar vacía.");
  }
  return await bcrypt.hash(passwordPlana.trim(), SALT_ROUNDS);
}

/**
 * Compara una contraseña ingresada en texto plano contra el hash almacenado.
 * Solo acepta hashes bcrypt válidos ($2a$, $2b$, $2y$). Si el hash almacenado
 * no es bcrypt (vacío, nulo o texto plano heredado), la comparación SIEMPRE falla:
 * ya no existe el fallback de contraseñas en texto plano.
 *
 * @param passwordPlana Contraseña ingresada por el usuario en el formulario.
 * @param hashAlmacenado Hash seguro almacenado en la base de datos.
 * @returns true si la contraseña coincide, false de lo contrario.
 */
export async function comparePassword(
  passwordPlana: string,
  hashAlmacenado: string
): Promise<boolean> {
  if (!passwordPlana || !hashAlmacenado) {
    return false;
  }

  const esBcrypt = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hashAlmacenado);
  if (!esBcrypt) {
    return false;
  }

  return await bcrypt.compare(passwordPlana.trim(), hashAlmacenado);
}

// ============================================================================
// SESIONES FIRMADAS (HMAC-SHA256)
// El valor de la cookie/token ya NO es el ID del usuario en texto plano:
// es un token firmado con SESSION_SECRET que incluye fecha de expiración.
// Sin conocer el secreto del servidor no se puede fabricar ni modificar.
// ============================================================================

/** Duración de la sesión (8 horas, igual que la cookie). */
export const DURACION_SESION_MS = 8 * 60 * 60 * 1000;

let secretoSesionCache: string | null = null;

function obtenerSecretoSesion(): string {
  if (secretoSesionCache) return secretoSesionCache;

  const desdeEntorno = (process.env.SESSION_SECRET || "").trim();
  if (desdeEntorno.length >= 32) {
    secretoSesionCache = desdeEntorno;
    return secretoSesionCache;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET no está configurado (o tiene menos de 32 caracteres). " +
        "Defínelo en las variables de entorno antes de iniciar en producción. " +
        "Puedes generarlo con: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
    );
  }

  // Desarrollo: secreto aleatorio por proceso (las sesiones se invalidan al reiniciar).
  console.warn(
    "[SEGURIDAD]: SESSION_SECRET no definido. Usando un secreto temporal solo para desarrollo."
  );
  secretoSesionCache = crypto.randomBytes(48).toString("hex");
  return secretoSesionCache;
}

/**
 * Verifica al iniciar el servidor que exista un secreto de sesión válido.
 * En producción lanza un error si falta, para fallar rápido en el despliegue.
 */
export function asegurarSecretoSesion(): void {
  obtenerSecretoSesion();
}

function firmar(payloadB64: string): string {
  return crypto
    .createHmac("sha256", obtenerSecretoSesion())
    .update(payloadB64)
    .digest("base64url");
}

/**
 * Genera un token de sesión firmado para un usuario.
 * Formato: base64url(JSON{sub, exp}) + "." + base64url(HMAC)
 */
export function firmarTokenSesion(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: Date.now() + DURACION_SESION_MS })
  ).toString("base64url");
  return `${payload}.${firmar(payload)}`;
}

/**
 * Verifica un token de sesión. Devuelve el ID de usuario si la firma es válida
 * y no ha expirado; de lo contrario devuelve null.
 */
export function verificarTokenSesion(token: unknown): string | null {
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) return null;

  const partes = token.split(".");
  if (partes.length !== 2) return null;
  const [payloadB64, firmaRecibida] = partes;

  const firmaEsperada = firmar(payloadB64);
  const a = Buffer.from(firmaRecibida);
  const b = Buffer.from(firmaEsperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const datos = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
    if (typeof datos?.sub !== "string" || typeof datos?.exp !== "number") return null;
    if (datos.exp < Date.now()) return null;
    return datos.sub;
  } catch {
    return null;
  }
}

/**
 * Parámetros para la creación de un nuevo usuario corporativo en el sistema.
 */
export interface ParametrosCreacionUsuario {
  username: string;
  email: string;
  nombreCompleto: string;
  rol: RolUsuario;
  passwordPlana: string;
  requiereCambioPassword?: boolean;
}

/**
 * Script de Utilidad: Prepara y cifra un nuevo usuario para su inserción en la Base de Datos.
 * Aplica bcrypt, normalización de nombre/usuario y marca obligatoria de cambio de contraseña
 * en el primer inicio de sesión.
 *
 * @param datos Parámetros del nuevo usuario a provisionar.
 * @returns Objeto estructurado PerfilUsuario con password_hash y requiere_cambio_password.
 */
export async function crearUsuarioInicial(
  datos: ParametrosCreacionUsuario
): Promise<PerfilUsuario & { password_hash: string; passwordHash: string; requiere_cambio_password: boolean; requiereCambioPassword: boolean }> {
  const {
    username,
    email,
    nombreCompleto,
    rol,
    passwordPlana,
    requiereCambioPassword = true
  } = datos;

  if (!username || !email || !nombreCompleto || !rol || !passwordPlana) {
    throw new Error("Todos los campos (username, email, nombreCompleto, rol, passwordPlana) son obligatorios.");
  }

  if (passwordPlana.length < LONGITUD_MINIMA_PASSWORD) {
    throw new Error(`La contraseña inicial debe tener al menos ${LONGITUD_MINIMA_PASSWORD} caracteres.`);
  }

  // Cifrado de la contraseña con bcrypt (10 rondas de salt)
  const password_hash = await hashPassword(passwordPlana);
  const idGenerado = `usr-${username.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString(36)}`;
  const fechaIso = new Date().toISOString();

  return {
    id: idGenerado,
    username: username.toLowerCase().trim(),
    email: email.toLowerCase().trim(),
    nombreCompleto: nombreCompleto.trim(),
    rol,
    activo: true,
    creadoEn: fechaIso,
    password_hash,
    passwordHash: password_hash,
    requiere_cambio_password: requiereCambioPassword,
    requiereCambioPassword: requiereCambioPassword
  };
}
