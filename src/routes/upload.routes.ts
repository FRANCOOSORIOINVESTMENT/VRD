import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { supabase, STORAGE_BUCKET_NAME } from "../config/supabase";

const router = Router();

// ============================================================================
// CONFIGURACIÓN DE MULTER Y VALIDACIONES DE ALMACENAMIENTO (HASTA 2 GB & CHUNKED UPLOAD)
// ============================================================================

// Soporte oficial para archivos pesados (ej. Estudio de Suelos de más de 82 páginas, planos arquitectónicos en alta resolución)
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 Gigabytes (2 GB)

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
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "text/csv",
  "application/csv",
  "application/octet-stream"
];

const EXTENSIONES_PERMITIDAS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".xlsm",
  ".csv"
];

// Configuración de almacenamiento en disco para subida directa de archivos pesados sin saturar RAM
const uploadsTempDir = path.join(process.cwd(), "public", "uploads", "temp_chunks");
if (!fs.existsSync(uploadsTempDir)) {
  fs.mkdirSync(uploadsTempDir, { recursive: true });
}

// Memory storage para chunks o archivos moderados
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
          `Tipo de archivo no permitido (${file.mimetype || ext}). Se admiten archivos PDF (.pdf), hojas de cálculo Excel (.xlsx, .xls, .csv), imágenes (.jpg, .jpeg, .png, .webp) o documentos (.docx).`
        )
      );
    }
  }
});

// Middleware para atrapar errores de Multer
export const handleMulterErrors = (err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({
        ok: false,
        error: "El archivo supera el tamaño máximo permitido de 2 Gigabytes (2 GB)."
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

// ============================================================================
// CHUNKED UPLOAD: CARGA POR PARTES DE DOCUMENTOS PESADOS (ESTUDIO DE SUELOS)
// Permite subir archivos de más de 82 páginas (hasta 2 GB) en bloques de 5MB
// ============================================================================

router.post(
  "/upload-chunk",
  upload.single("chunk"),
  handleMulterErrors,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const uploadId = String(req.body.uploadId || req.body.upload_id || "").trim();
      const chunkIndex = parseInt(String(req.body.chunkIndex ?? req.body.chunk_index ?? "0"), 10);
      const totalChunks = parseInt(String(req.body.totalChunks ?? req.body.total_chunks ?? "1"), 10);
      const fileName = String(req.body.fileName || req.body.file_name || "documento_pesado.pdf").trim();
      const mimeType = String(req.body.mimeType || req.body.mime_type || "application/pdf").trim();
      const expedienteId = String(req.body.expedienteId || req.body.expediente_id || "general").trim();
      const seccion = String(req.body.seccion || "estudio_suelos").trim();

      if (!uploadId) {
        res.status(400).json({ ok: false, error: "El identificador de carga uploadId es requerido." });
        return;
      }

      // Obtener buffer del chunk (ya sea por Multer o por base64 en req.body)
      let chunkBuffer: Buffer | null = null;
      if (req.file) {
        chunkBuffer = req.file.buffer;
      } else if (req.body.chunkData) {
        const rawBase64 = String(req.body.chunkData).replace(/^data:.*?;base64,/, "");
        chunkBuffer = Buffer.from(rawBase64, "base64");
      }

      if (!chunkBuffer || chunkBuffer.length === 0) {
        res.status(400).json({ ok: false, error: `No se recibió contenido para el bloque ${chunkIndex + 1} de ${totalChunks}.` });
        return;
      }

      const sessionDir = path.join(uploadsTempDir, uploadId);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      const chunkFilePath = path.join(sessionDir, `part_${String(chunkIndex).padStart(5, "0")}.part`);
      fs.writeFileSync(chunkFilePath, chunkBuffer);

      // Verificar cuántos chunks se han recibido
      const existingParts = fs.readdirSync(sessionDir).filter((f) => f.startsWith("part_") && f.endsWith(".part"));

      if (existingParts.length < totalChunks) {
        // Bloque recibido exitosamente, aún faltan partes
        res.json({
          ok: true,
          completado: false,
          chunkIndex,
          totalChunks,
          partesRecibidas: existingParts.length,
          porcentaje: Math.round((existingParts.length / totalChunks) * 100)
        });
        return;
      }

      // TODAS LAS PARTES RECIBIDAS: Ensamblaje en orden secuencial
      existingParts.sort();
      const nombreLimpio = sanitizarNombreArchivo(fileName);
      const timestamp = Date.now();
      const storagePath = `expedientes/${expedienteId}/${seccion}_${timestamp}_${nombreLimpio}`;

      const localUploadsDir = path.join(process.cwd(), "public", "uploads");
      const localFilePath = path.join(localUploadsDir, storagePath);
      const localDir = path.dirname(localFilePath);
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }

      const writeStream = fs.createWriteStream(localFilePath);
      const hash = crypto.createHash("sha256");
      let totalBytesWritten = 0;

      for (const partFileName of existingParts) {
        const partPath = path.join(sessionDir, partFileName);
        const partBuf = fs.readFileSync(partPath);
        hash.update(partBuf);
        writeStream.write(partBuf);
        totalBytesWritten += partBuf.length;
      }
      writeStream.end();

      const sha256Hash = hash.digest("hex");
      let publicUrl = `/uploads/${storagePath.replace(/\\/g, "/")}`;

      // Limpieza segura de los chunks temporales
      try {
        for (const partFileName of existingParts) {
          fs.unlinkSync(path.join(sessionDir, partFileName));
        }
        fs.rmdirSync(sessionDir);
      } catch (cleanErr) {
        console.warn("[CHUNK CLEANUP WARN]:", cleanErr);
      }

      // Sincronización asíncrona hacia Supabase Storage si el archivo es menor a 50MB o lectura en buffer
      try {
        if (totalBytesWritten <= 50 * 1024 * 1024) {
          const assembledBuffer = fs.readFileSync(localFilePath);
          const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKET_NAME)
            .upload(storagePath, assembledBuffer, {
              contentType: mimeType,
              upsert: true
            });
          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from(STORAGE_BUCKET_NAME)
              .getPublicUrl(storagePath);
            if (urlData?.publicUrl) {
              publicUrl = urlData.publicUrl;
            }
          }
        }
      } catch (storageErr: any) {
        console.warn("[STORAGE ASSEMBLE WARN]:", storageErr?.message);
      }

      console.log(`[CHUNKED UPLOAD COMPLETE]: Archivo pesado "${fileName}" (${(totalBytesWritten / 1024 / 1024).toFixed(2)} MB) ensamblado exitosamente.`);

      res.status(201).json({
        ok: true,
        completado: true,
        mensaje: "Archivo pesado ensamblado y persistido exitosamente.",
        data: {
          storagePath,
          url: publicUrl,
          publicUrl,
          nombreArchivoOriginal: fileName,
          nombreSanitizado: nombreLimpio,
          mimeType,
          tamanoBytes: totalBytesWritten,
          sha256Hash,
          expedienteId,
          subidoEn: new Date().toISOString()
        }
      });
    } catch (err: any) {
      console.error("[CHUNKED UPLOAD ERROR]:", err);
      res.status(500).json({ ok: false, error: `Error en ensamblaje de archivo: ${err?.message || err}` });
    }
  }
);

export default router;
