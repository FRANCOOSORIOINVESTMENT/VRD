import { Router, Request, Response } from "express";
import { supabase } from "../config/supabase";
import { mockDb } from "../server/mockDb";
import { Interesado, ContactoApoyo } from "../types";
import { descomponerNombreCompleto } from "../utils/normalizacion";

const router = Router();

// ============================================================================
// ENDPOINT: GET /api/interesados (Hidratación directa desde Supabase PostgreSQL)
// ============================================================================
router.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    // 1. Consulta relacional a la tabla interesados con contactos de apoyo vinculados
    const { data: dbRows, error } = await supabase
      .from("interesados")
      .select(`
        *,
        contactos_apoyo(*)
      `)
      .order("creado_en", { ascending: false });

    if (error) {
      console.warn("[INTERESADOS]: Error al consultar Supabase relacional, reintentando consulta directa:", error.message);
      
      const { data: directRows, error: directError } = await supabase
        .from("interesados")
        .select("*")
        .order("creado_en", { ascending: false });

      if (directError) {
        console.error("[INTERESADOS DB ERROR]:", directError.message);
        // Fallback a memoria si la base remota no responde
        res.status(200).json(mockDb.interesados);
        return;
      }

      if (!directRows || directRows.length === 0) {
        res.status(200).json(mockDb.interesados);
        return;
      }
    }

    if (dbRows && dbRows.length > 0) {
      // 2. Mapeo a la estructura tipada Interesado[]
      const interesadosHidratados: Interesado[] = dbRows.map((row: any) => {
        const contactos: ContactoApoyo[] = Array.isArray(row.contactos_apoyo)
          ? row.contactos_apoyo.map((c: any) => ({
              id: c.id,
              interesadoId: c.interesado_id || row.id,
              nombreCompleto: c.nombre_completo || "",
              relacion: c.relacion || "Familiar",
              telefono: c.telefono || "",
              tieneWhatsapp: Boolean(c.tiene_whatsapp),
              correo: c.correo,
              preferenciaContacto: c.preferencia_contacto,
              creadoEn: c.creado_en || row.creado_en
            }))
          : [];

        // Calcular caducidad estándar a 45 días
        const fechaCreacionMs = new Date(row.creado_en).getTime();
        const fechaCaducidad = new Date(fechaCreacionMs + 45 * 24 * 60 * 60 * 1000).toISOString();

        const partesNombre = descomponerNombreCompleto(row.nombre_contacto);
        return {
          id: row.id,
          primerNombre: partesNombre.primerNombre,
          segundoNombre: partesNombre.segundoNombre || undefined,
          primerApellido: partesNombre.primerApellido,
          segundoApellido: partesNombre.segundoApellido || undefined,
          nombreContacto: row.nombre_contacto || "Sin Nombre Registrado",
          telefono: row.telefono || "",
          tieneWhatsapp: Boolean(row.tiene_whatsapp),
          correo: row.correo || undefined,
          departamentoCodigo: row.departamento_codigo || "25",
          municipioCodigo: row.municipio_codigo || "25899",
          vereda: row.vereda || "Rural",
          origenContacto: row.origen_contacto || "Llamada",
          resumenNecesidad: row.resumen_necesidad || "",
          comercialAsignadoId: row.comercial_asignado_id || "usr-comercial-01",
          estadoComercial: row.estado_comercial || "nuevo_contacto",
          convertidoAExpedienteId: row.convertido_a_expediente_id || undefined,
          creadoEn: row.creado_en,
          fechaCaducidad,
          diasExtension: 0,
          contactosApoyo: contactos,
          documentosAdjuntos: []
        } as Interesado;
      });

      // 3. Sincronizar memoria para evitar inconsistencias de red
      mockDb.interesados = interesadosHidratados;

      res.status(200).json(interesadosHidratados);
      return;
    }

    // Si la tabla remota no tiene filas aún, responder con la lista en memoria
    res.status(200).json(mockDb.interesados);
  } catch (err: any) {
    console.error("[INTERESADOS EXCEPTION]:", err);
    res.status(500).json({
      error: "Error interno del servidor al consultar la base de datos de interesados.",
      detalle: err?.message || err
    });
  }
});

export default router;
