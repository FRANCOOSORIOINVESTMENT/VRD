import bcrypt from "bcryptjs";
import { PerfilUsuario, RolUsuario } from "../types";

/**
 * CONFIGURACIÓN DE SEGURIDAD PARA CIFRADO BCRYPT
 * Se define un factor de coste (salt rounds) de 10, equilibrando seguridad criptográfica y rendimiento.
 */
const SALT_ROUNDS = 10;

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
 * Si el hash almacenado es un hash bcrypt válido ($2a$, $2b$, $2y$), usa bcrypt.compare.
 * Provee tolerancia a contraseñas heredadas durante la ventana de migración.
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

  if (esBcrypt) {
    return await bcrypt.compare(passwordPlana.trim(), hashAlmacenado);
  }

  // Fallback temporal de migración si el registro aún no fue actualizado a bcrypt
  return passwordPlana.trim() === hashAlmacenado.trim();
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

  if (passwordPlana.length < 6) {
    throw new Error("La contraseña inicial debe tener al menos 6 caracteres.");
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
