import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// CRM VRD — FRANCO OSORIO INVESTMENT S.A.S.
// CONFIGURACIÓN OFICIAL DEL CLIENTE SUPABASE (DATABASE & STORAGE)

dotenv.config({ override: true });

// 1. Limpieza y normalización de la URL base
const normalizeUrl = (rawUrl?: string): string => {
  if (!rawUrl) return "https://dcelksfchabhrlevlfah.supabase.co";
  return rawUrl.trim().replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
};

const supabaseUrl: string = normalizeUrl(process.env.SUPABASE_URL);

// 2. Extracción de claves: service_role para operaciones backend privilegiadas, anon como respaldo
const supabaseServiceKey: string =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_B8tc_3lQWCKeBJ3camRySQ_yZAVTqLw";

const supabaseAnonKey: string =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  supabaseServiceKey;

if (!supabaseUrl) {
  console.warn("[SUPABASE CONFIG]: Advertencia: SUPABASE_URL no está definida en las variables de entorno.");
}

/**
 * Cliente con privilegios administrativos (service_role) para el backend Node.js.
 * Utilizado para consultar sin restricciones de RLS interno, gestionar Storage y ejecutar auditoría.
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

/**
 * Cliente con clave pública (anon) para operaciones que simulen el contexto del cliente web.
 */
export const supabasePublic: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false
  }
});

/**
 * Nombre del bucket maestro de Supabase Storage para alojar los expedientes y planos.
 */
export const STORAGE_BUCKET_NAME = "expedientes-archivos";

/**
 * Utilidad de arranque: Verifica la existencia del bucket de Storage y reporta su estado.
 */
export async function verificarBucketStorage(): Promise<{ existe: boolean; mensaje: string }> {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      return { existe: false, mensaje: `Error listando buckets: ${error.message}` };
    }
    const existe = Boolean(buckets?.some((b) => b.name === STORAGE_BUCKET_NAME));
    if (!existe) {
      // Intentar crear el bucket si no existe
      const { error: createError } = await supabase.storage.createBucket(STORAGE_BUCKET_NAME, {
        public: true,
        fileSizeLimit: 25 * 1024 * 1024 // 25 MB
      });
      if (createError) {
        return {
          existe: false,
          mensaje: `Bucket '${STORAGE_BUCKET_NAME}' no existe. Crear manualmente en Supabase Dashboard: ${createError.message}`
        };
      }
      return { existe: true, mensaje: `Bucket '${STORAGE_BUCKET_NAME}' creado exitosamente.` };
    }
    return { existe: true, mensaje: `Bucket '${STORAGE_BUCKET_NAME}' verificado y disponible.` };
  } catch (err: any) {
    return { existe: false, mensaje: `Excepción verificando bucket: ${err?.message}` };
  }
}

/**
 * Sube un archivo (Buffer o DataURL Base64) directamente al bucket 'expedientes-archivos' de Supabase Storage.
 * Genera la URL pública accesible y garantiza persistencia permanente en la nube.
 */
export async function persistirArchivoEnStorage(
  storagePath: string,
  bufferOrDataUrl: Buffer | string,
  mimeType: string = "application/pdf"
): Promise<{ ok: boolean; publicUrl?: string; storagePath?: string; error?: string }> {
  try {
    let buffer: Buffer;
    let contentType = mimeType;

    if (Buffer.isBuffer(bufferOrDataUrl)) {
      buffer = bufferOrDataUrl;
    } else if (typeof bufferOrDataUrl === "string") {
      if (bufferOrDataUrl.startsWith("data:")) {
        const match = bufferOrDataUrl.match(/^data:(.+?);base64,(.+)$/);
        if (match) {
          contentType = match[1] || mimeType;
          buffer = Buffer.from(match[2], "base64");
        } else {
          buffer = Buffer.from(bufferOrDataUrl, "base64");
        }
      } else {
        buffer = Buffer.from(bufferOrDataUrl, "base64");
      }
    } else {
      return { ok: false, error: "Formato de archivo no soportado." };
    }

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType,
        upsert: true
      });

    if (uploadError) {
      console.error(`[STORAGE ERROR]: Error al subir archivo a '${STORAGE_BUCKET_NAME}/${storagePath}':`, uploadError.message);
      return { ok: false, error: uploadError.message };
    }

    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET_NAME)
      .getPublicUrl(storagePath);

    const publicUrl = urlData?.publicUrl || "";
    console.log(`[STORAGE SUCCESS]: Archivo guardado en Supabase Storage: ${storagePath} -> ${publicUrl}`);

    return {
      ok: true,
      publicUrl,
      storagePath
    };
  } catch (err: any) {
    console.error(`[STORAGE EXCEPTION]: Excepción al subir a Supabase Storage:`, err?.message);
    return { ok: false, error: err?.message || "Excepción de red en Storage" };
  }
}

export default supabase;
