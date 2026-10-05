import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { supabase, STORAGE_BUCKET_NAME } from "../config/supabase";

const router = Router();

// ============================================================================
// CONFIGURACIÓN DE MULTER Y VALIDACIONES DE ALMACENAMIENTO (25 MB & MIME TYPES)
// ============================================================================

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // Límite estricto: 25 Megabytes

const MIME_TYPES_PERMITIDOS = [
  "application/pdf",
  "application/x-pdf",
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream"
];

const EXTENSIONES_PERMITIDAS = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx"];

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
    const mime = (file.mimetype || "").toLowerCase();
    const mimeValido = MIME_TYPES_PERMITIDOS.includes(mime);
    const extValida = EXTENSIONES_PERMITIDAS.includes(ext);

    // Permitir si la extensión es válida O el mimeType es válido
    if (extValida || mimeValido) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Tipo de archivo no permitido (${file.mimetype || ext}). Solo se admiten archivos PDF (.pdf), imágenes (.jpg, .jpeg, .png, .webp) o documentos (.docx).`
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

      // 2. Estructuración de la ruta del archivo
      const timestamp = Date.now();
      const nombreLimpio = sanitizarNombreArchivo(file.originalname);
      const storagePath = `expedientes/${expedienteId}/${codigoRequisito}_${timestamp}_${nombreLimpio}`;

      // 3. Persistir primero copia local indestructible
      const localUploadsDir = path.join(process.cwd(), "public", "uploads");
      const localFilePath = path.join(localUploadsDir, storagePath);
      const localDir = path.dirname(localFilePath);
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      fs.writeFileSync(localFilePath, file.buffer);
      let publicUrl = `/uploads/${storagePath.replace(/\\/g, "/")}`;

      // 4. Intentar subida a Supabase Storage
      try {
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET_NAME)
          .upload(storagePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from(STORAGE_BUCKET_NAME)
            .getPublicUrl(storagePath);
          if (urlData?.publicUrl) {
            publicUrl = urlData.publicUrl;
          }
        } else {
          console.warn(`[STORAGE WARNING]: No se pudo subir a Supabase Storage (${uploadError.message}). Servido desde almacenamiento local.`);
        }
      } catch (remoteErr: any) {
        console.warn(`[STORAGE WARNING]: Excepción en Supabase Storage (${remoteErr?.message}). Servido desde almacenamiento local.`);
      }

      res.status(201).json({
        ok: true,
        mensaje: "Archivo cargado y persistido exitosamente.",
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
