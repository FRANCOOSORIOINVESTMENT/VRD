import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import { supabase, STORAGE_BUCKET_NAME } from "../config/supabase";

const router = Router();

// ============================================================================
// CONFIGURACIÓN DE MULTER Y VALIDACIONES DE ALMACENAMIENTO (25 MB & MIME TYPES)
// ============================================================================

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // Límite estricto: 25 Megabytes

const MIME_TYPES_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp"
];

const EXTENSIONES_PERMITIDAS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];

// Configuración de almacenamiento en memoria para procesar buffers directamente a Supabase Storage
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeValido = MIME_TYPES_PERMITIDOS.includes(file.mimetype.toLowerCase());
    const extValida = EXTENSIONES_PERMITIDAS.includes(ext);

    if (mimeValido && extValida) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Tipo de archivo no permitido (${file.mimetype}). Solo se admiten archivos PDF (.pdf) e imágenes (.jpg, .jpeg, .png, .webp).`
        )
      );
    }
  }
});

// Middleware para atrapar errores de Multer (ej. archivo mayor a 25MB)
export const handleMulterErrors = (err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({
        ok: false,
        error: "El archivo supera el tamaño máximo permitido de 25 Megabytes (25 MB)."
      });
      return;
    }
    res.status(400).json({ ok: false, error: `Error en la carga de archivos: ${err.message}` });
    return;
  }
  if (err) {
    res.status(400).json({ ok: false, error: err.message || "Error al procesar el archivo." });
    return;
  }
  next();
};

/**
 * Normaliza y sanea el nombre del archivo para rutas seguras en la nube.
 */
function sanitizarNombreArchivo(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remueve acentos
    .replace(/[^a-zA-Z0-9._-]/g, "_") // Reemplaza caracteres especiales
    .replace(/_+/g, "_");
}

// ============================================================================
// ENDPOINT: POST /api/documentos/upload
// ============================================================================
router.post(
  "/upload",
  upload.single("archivo"),
  handleMulterErrors,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({
          ok: false,
          error: "No se ha proporcionado ningún archivo para subir. Utilice el campo 'archivo'."
        });
        return;
      }

      // Parámetros de contexto
      const expedienteId = String(req.body.expedienteId || req.body.expediente_id || "general").trim();
      const codigoRequisito = String(req.body.codigoRequisito || req.body.codigo_requisito || "DOC").trim();

      // 1. Cálculo del Hash criptográfico SHA-256 para auditoría de integridad inmutable
      const sha256Hash = crypto.createHash("sha256").update(file.buffer).digest("hex");

      // 2. Estructuración de la ruta del archivo en Supabase Storage
      const timestamp = Date.now();
      const nombreLimpio = sanitizarNombreArchivo(file.originalname);
      const storagePath = `expedientes/${expedienteId}/${codigoRequisito}_${timestamp}_${nombreLimpio}`;

      // 3. Subida directa del Buffer binario a Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET_NAME)
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (uploadError) {
        console.error("[STORAGE ERROR]: Fallo al depositar archivo en Supabase Storage:", uploadError.message);
        res.status(500).json({
          ok: false,
          error: `Error al almacenar el archivo en Supabase Storage: ${uploadError.message}. Verifique que el bucket '${STORAGE_BUCKET_NAME}' exista.`
        });
        return;
      }

      // 4. Obtención de la URL pública y URL de descarga
      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET_NAME)
        .getPublicUrl(storagePath);

      const publicUrl = urlData?.publicUrl || "";

      res.status(201).json({
        ok: true,
        mensaje: "Archivo cargado y persistido exitosamente en Supabase Storage.",
        data: {
          storagePath,
          url: publicUrl,
          publicUrl,
          nombreArchivoOriginal: file.originalname,
          nombreSanitizado: nombreLimpio,
          mimeType: file.mimetype,
          tamanoBytes: file.size,
          sha256Hash,
          expedienteId,
          subidoEn: new Date().toISOString()
        }
      });
    } catch (err: any) {
      console.error("[UPLOAD EXCEPTION]:", err);
      res.status(500).json({
        ok: false,
        error: `Excepción interna al procesar subida de archivo: ${err?.message || err}`
      });
    }
  }
);

export default router;
