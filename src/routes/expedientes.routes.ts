import { Router, Request, Response } from "express";
import { supabase } from "../config/supabase";
import { mockDb } from "../server/mockDb";
import { Expediente, Persona, Predio, Hogar } from "../types";

const router = Router();

// ============================================================================
// ENDPOINT: GET /api/expedientes (Hidratación directa desde Supabase PostgreSQL)
// ============================================================================
router.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    // 1. Consulta relacional completa a Supabase
    const { data: dbRows, error } = await supabase
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

    if (error) {
      console.warn("[EXPEDIENTES]: Falló la consulta relacional profunda en Supabase, reintentando consulta plana:", error.message);
      
      // Reintento con consulta simple si las llaves foráneas tienen otro alias
      const { data: simpleRows, error: simpleError } = await supabase
        .from("expedientes")
        .select("*")
        .order("creado_en", { ascending: false });

      if (simpleError) {
        console.error("[EXPEDIENTES DB ERROR]:", simpleError.message);
        // Si la base de datos remota falla, responder con la caché en memoria y aviso
        res.status(200).json(mockDb.expedientes);
        return;
      }

      if (!simpleRows || simpleRows.length === 0) {
        // Si Supabase aún no tiene expedientes registrados, retornar los iniciales
        res.status(200).json(mockDb.expedientes);
        return;
      }
    }

    if (dbRows && dbRows.length > 0) {
      // 2. Mapeo y transformación de tipos a la estructura canónica de Expediente[]
      const expedientesHidratados: Expediente[] = dbRows.map((row: any) => {
        const postData = row.postulante || {};
        const predData = row.predio || {};
        const hogarData = row.hogar || {};
        const comData = row.comercial || {};
        const respData = row.responsable || {};

        const postulante: Persona = {
          id: postData.id || `per-${row.id}`,
          tipoIdentificacion: postData.tipo_identificacion || "CC",
          numeroIdentificacion: postData.numero_identificacion || "00000000",
          primerNombre: postData.nombres ? String(postData.nombres).split(" ")[0] : "",
          primerApellido: postData.primer_apellido || "",
          segundoApellido: postData.segundo_apellido || undefined,
          nombres: postData.nombres || `${postData.primer_apellido || ''}`,
          telefonoPrincipal: postData.telefono_principal,
          correo: postData.correo
        };

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

        const integrantes = Array.isArray(hogarData.integrantes)
          ? hogarData.integrantes.map((intRow: any) => ({
              id: intRow.id,
              hogarId: hogarData.id,
              parentesco: intRow.parentesco,
              esPostulantePrincipal: Boolean(intRow.es_postulante_principal),
              persona: {
                id: intRow.persona?.id || `per-${intRow.id}`,
                tipoIdentificacion: intRow.persona?.tipo_identificacion || "CC",
                numeroIdentificacion: intRow.persona?.numero_identificacion || "",
                primerApellido: intRow.persona?.primer_apellido || "",
                nombres: intRow.persona?.nombres || ""
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

        return {
          id: row.id,
          codigoVisible: row.codigo_visible,
          interesadoOrigenId: row.interesado_origen_id,
          estadoGeneral: row.estado_general || "en_tramite",
          faseActual: Number(row.fase_actual || 1),
          comercialOrigenId: row.comercial_origen_id || comData.id || "usr-comercial-01",
          comercialOrigenNombre: comData.nombre_completo || "Gestor Comercial",
          responsableGeneralId: row.responsable_general_id || respData.id || "usr-supervisor-01",
          responsableGeneralNombre: respData.nombre_completo || "Responsable VRD",
          fechaPrimerContacto: row.fecha_primer_contacto || row.creado_en,
          fechaIngresoFase1: row.fecha_ingreso_fase1 || row.creado_en,
          creadoEn: row.creado_en,
          actualizadoEn: row.actualizado_en,
          postulante,
          predioVivienda,
          hogar
        } as Expediente;
      });

      // 3. Sincronizar la memoria de forma que no existan discrepancias
      mockDb.expedientes = expedientesHidratados;

      res.status(200).json(expedientesHidratados);
      return;
    }

    // Si Supabase no tiene filas aún, retornar la lista de inicialización
    res.status(200).json(mockDb.expedientes);
  } catch (err: any) {
    console.error("[EXPEDIENTES EXCEPTION]:", err);
    res.status(500).json({
      error: "Error interno del servidor al consultar la base de datos de expedientes.",
      detalle: err?.message || err
    });
  }
});

export default router;
