import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import os from "os";
import fs from "fs";
import { supabase, STORAGE_BUCKET_NAME } from "../config/supabase";

const router = Router();

// ============================================================================
// CONFIGURACIÓN DE MULTER Y VALIDACIONES DE ALMACENAMIENTO
// ============================================================================

// Subida directa: archivos de hasta 25 MB (se mantienen en memoria).
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

// Subida por bloques (documentos pesados, ej. Estudio de Suelos):
// cada bloque pesa como máximo 10 MB y el archivo ensamblado no puede superar 500 MB.
const MAX_CHUNK_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_CHUNKED_BYTES = 500 * 1024 * 1024;
const MAX_TOTAL_CHUNKS = 200;

const MIME_TYPES_PERMITIDOS = [
  "application/pdf",
  "application/x-pdf",
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "text/csv",
  "application/csv",
  // Algunos navegadores envían este tipo genérico; se acepta SOLO si la extensión es válida.
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

const MENSAJE_TIPO_NO_PERMITIDO =
  "Tipo de archivo no permitido. Se admiten archivos PDF (.pdf), hojas de cálculo Excel (.xlsx, .xls, .csv), imágenes (.jpg, .jpeg, .png, .webp) o documentos (.doc, .docx).";

function extensionPermitida(nombre: string): boolean {
  return EXTENSIONES_PERMITIDAS.includes(path.extname(nombre || "").toLowerCase());
}

// Directorio temporal para bloques, FUERA de la carpeta pública de archivos.
const uploadsTempDir = path.join(os.tmpdir(), "vrd_upload_chunks");
if (!fs.existsSync(uploadsTempDir)) {
  fs.mkdirSync(uploadsTempDir, { recursive: true });
}

// Directorio base de archivos persistidos localmente.
const localUploadsDir = path.resolve(process.cwd(), "public", "uploads");

// El archivo debe tener extensión permitida Y un MIME permitido (antes bastaba con uno de los dos).
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const mime = (file.mimetype || "").toLowerCase();
  if (extensionPermitida(file.originalname) && MIME_TYPES_PERMITIDOS.includes(mime)) {
    cb(null, true);
  } else {
    cb(new Error(MENSAJE_TIPO_NO_PERMITIDO));
  }
};

const uploadSimple = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter
});

// Los bloques se envían con nombre/MIME arbitrarios (ej. "blob"), así que solo se limita el tamaño.
// La extensión del archivo final se valida con el campo fileName al ensamblar.
const uploadBloque = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CHUNK_SIZE_BYTES, files: 1 }
});

// Middleware para atrapar errores de Multer
export const handleMulterErrors = (err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({
        ok: false,
        error: "El archivo (o bloque) supera el tamaño máximo permitido."
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

// ============================================================================
// UTILIDADES DE SEGURIDAD PARA RUTAS Y NOMBRES
// ============================================================================

/**
 * Normaliza y sanea el nombre del archivo para rutas seguras en la nube.
 */
function sanitizarNombreArchivo(nombre: string): string {
  const limpio = String(nombre || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remueve acentos
    .replace(/[^a-zA-Z0-9._-]/g, "_") // Reemplaza caracteres especiales
    .replace(/_+/g, "_")
    .replace(/^\.+/, "_"); // Evita archivos ocultos o ".."
  return limpio.slice(-120) || "archivo";
}

/**
 * Sanea un identificador que se usará como segmento de ruta (expedienteId, codigoRequisito,
 * uploadId, seccion). Solo letras, números, guion y guion bajo: impide "../" y separadores.
 */
function sanearSegmento(valor: unknown, porDefecto: string): string {
  const limpio = String(valor ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80);
  return limpio || porDefecto;
}

/**
 * Garantiza que la ruta resuelta quede dentro de la carpeta base indicada.
 */
function rutaDentroDe(base: string, ruta: string): boolean {
  const resuelta = path.resolve(ruta);
  return resuelta === base || resuelta.startsWith(base + path.sep);
}

// ============================================================================
// ENDPOINT: POST /api/documentos/upload
// ============================================================================
router.post(
  "/upload",
  uploadSimple.single("archivo"),
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

      // Parámetros de contexto (saneados: se usan como parte de la ruta en disco)
      const expedienteId = sanearSegmento(req.body.expedienteId || req.body.expediente_id, "general");
      const codigoRequisito = sanearSegmento(req.body.codigoRequisito || req.body.codigo_requisito, "DOC");

      // 1. Cálculo del Hash criptográfico SHA-256 para auditoría de integridad inmutable
      const sha256Hash = crypto.createHash("sha256").update(file.buffer).digest("hex");

      // 2. Estructuración de la ruta del archivo
      const timestamp = Date.now();
      const nombreLimpio = sanitizarNombreArchivo(file.originalname);
      const storagePath = `expedientes/${expedienteId}/${codigoRequisito}_${timestamp}_${nombreLimpio}`;

      // 3. Persistir primero copia local
      const localFilePath = path.join(localUploadsDir, storagePath);
      if (!rutaDentroDe(localUploadsDir, localFilePath)) {
        res.status(400).json({ ok: false, error: "Ruta de archivo no válida." });
        return;
      }
      fs.mkdirSync(path.dirname(localFilePath), { recursive: true });
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
        error: "Error interno al procesar la subida del archivo."
      });
    }
  }
);

// ============================================================================
// CHUNKED UPLOAD: CARGA POR PARTES DE DOCUMENTOS PESADOS (ESTUDIO DE SUELOS)
// Permite subir archivos grandes (hasta 500 MB) en bloques de hasta 10 MB
// ============================================================================

router.post(
  "/upload-chunk",
  uploadBloque.single("chunk"),
  handleMulterErrors,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const uploadId = sanearSegmento(req.body.uploadId || req.body.upload_id, "");
      const chunkIndex = parseInt(String(req.body.chunkIndex ?? req.body.chunk_index ?? "0"), 10);
      const totalChunks = parseInt(String(req.body.totalChunks ?? req.body.total_chunks ?? "1"), 10);
      const fileName = String(req.body.fileName || req.body.file_name || "documento_pesado.pdf").trim();
      const mimeType = String(req.body.mimeType || req.body.mime_type || "application/pdf").trim();
      const expedienteId = sanearSegmento(req.body.expedienteId || req.body.expediente_id, "general");
      const seccion = sanearSegmento(req.body.seccion, "estudio_suelos");

      if (!uploadId) {
        res.status(400).json({ ok: false, error: "El identificador de carga uploadId es requerido." });
        return;
      }

      if (
        !Number.isInteger(chunkIndex) ||
        !Number.isInteger(totalChunks) ||
        totalChunks < 1 ||
        totalChunks > MAX_TOTAL_CHUNKS ||
        chunkIndex < 0 ||
        chunkIndex >= totalChunks
      ) {
        res.status(400).json({ ok: false, error: "Parámetros de bloque no válidos (chunkIndex / totalChunks)." });
        return;
      }

      if (!extensionPermitida(fileName)) {
        res.status(400).json({ ok: false, error: MENSAJE_TIPO_NO_PERMITIDO });
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

      if (chunkBuffer.length > MAX_CHUNK_SIZE_BYTES) {
        res.status(400).json({ ok: false, error: "El bloque supera el tamaño máximo permitido." });
        return;
      }

      const sessionDir = path.join(uploadsTempDir, uploadId);
      if (!rutaDentroDe(uploadsTempDir, sessionDir)) {
        res.status(400).json({ ok: false, error: "Identificador de carga no válido." });
        return;
      }
      fs.mkdirSync(sessionDir, { recursive: true });

      const chunkFilePath = path.join(sessionDir, `part_${String(chunkIndex).padStart(5, "0")}.part`);
      fs.writeFileSync(chunkFilePath, chunkBuffer);

      // Verificar cuántos chunks se han recibido
      const existingParts = fs
        .readdirSync(sessionDir)
        .filter((f) => f.startsWith("part_") && f.endsWith(".part"));

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

      const localFilePath = path.join(localUploadsDir, storagePath);
      if (!rutaDentroDe(localUploadsDir, localFilePath)) {
        res.status(400).json({ ok: false, error: "Ruta de archivo no válida." });
        return;
      }
      fs.mkdirSync(path.dirname(localFilePath), { recursive: true });

      // Validar tamaño total antes de ensamblar
      let totalBytes = 0;
      for (const partFileName of existingParts) {
        totalBytes += fs.statSync(path.join(sessionDir, partFileName)).size;
      }
      if (totalBytes > MAX_TOTAL_CHUNKED_BYTES) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        res.status(400).json({ ok: false, error: "El archivo ensamblado supera el tamaño máximo permitido (500 MB)." });
        return;
      }

      const writeStream = fs.createWriteStream(localFilePath);
      const hash = crypto.createHash("sha256");
      let totalBytesWritten = 0;

      for (const partFileName of existingParts) {
        const partBuf = fs.readFileSync(path.join(sessionDir, partFileName));
        hash.update(partBuf);
        if (!writeStream.write(partBuf)) {
          await new Promise<void>((resolve) => writeStream.once("drain", () => resolve()));
        }
        totalBytesWritten += partBuf.length;
      }

      // Esperar a que el archivo termine de escribirse en disco antes de continuar
      await new Promise<void>((resolve, reject) => {
        writeStream.once("finish", () => resolve());
        writeStream.once("error", reject);
        writeStream.end();
      });

      const sha256Hash = hash.digest("hex");
      let publicUrl = `/uploads/${storagePath.replace(/\\/g, "/")}`;

      // Limpieza segura de los chunks temporales
      try {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      } catch (cleanErr) {
        console.warn("[CHUNK CLEANUP WARN]:", cleanErr);
      }

      // Sincronización hacia Supabase Storage si el archivo es menor a 50MB
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

      console.log(`[CHUNKED UPLOAD COMPLETE]: Archivo pesado "${nombreLimpio}" (${(totalBytesWritten / 1024 / 1024).toFixed(2)} MB) ensamblado exitosamente.`);

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
      res.status(500).json({ ok: false, error: "Error interno en el ensamblaje del archivo." });
    }
  }
);

export default router;
