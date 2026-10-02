import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

// CRM VRD — FRANCO OSORIO INVESTMENT S.A.S.
// MÓDULO DE CONFIGURACIÓN Y CLIENTE SUPABASE

export const SUPABASE_PROJECT_ID = process.env.SUPABASE_PROJECT_ID || "dcelksfchabhrlevlfah";

// Normalización de URL base (remueve /rest/v1 o /rest/v1/ y barras finales si vienen incluidas)
const normalizeUrl = (raw: string) => {
  return raw.trim().replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
};

const rawUrl = process.env.SUPABASE_URL || "https://dcelksfchabhrlevlfah.supabase.co";
export const supabaseUrl = normalizeUrl(rawUrl);
export const supabaseRestUrl = `${supabaseUrl}/rest/v1/`;

export const supabasePublishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_B8tc_3lQWCKeBJ3camRySQ_yZAVTqLw";

export const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  supabasePublishableKey;

export const APP_MODE = process.env.APP_MODE || "supabase";
export const isMockMode = APP_MODE === "mock" && !process.env.SUPABASE_URL;

let clientPublic: SupabaseClient | null = null;
let clientAdmin: SupabaseClient | null = null;

try {
  if (supabaseUrl && supabasePublishableKey) {
    clientPublic = createClient(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: false }
    });
    clientAdmin = createClient(supabaseUrl, supabaseSecretKey || supabasePublishableKey, {
      auth: { persistSession: false }
    });
    console.log(`[INFO]: CRM VRD conectado a SUPABASE (Proyecto: ${SUPABASE_PROJECT_ID}, URL: ${supabaseUrl}, REST: ${supabaseRestUrl})`);
  } else {
    console.log("[INFO]: CRM VRD inicializado en MODO DEMOSTRACIÓN (Mock en memoria)");
  }
} catch (err) {
  console.error("[ERROR]: No se pudo instanciar el cliente de Supabase:", err);
}

export const supabasePublic = clientPublic;
export const supabaseAdmin = clientAdmin;

export async function testSupabaseConnection(): Promise<{
  ok: boolean;
  message: string;
  projectId: string;
  url: string;
  restUrl: string;
  details?: any;
}> {
  if (!clientPublic) {
    return {
      ok: false,
      message: "Cliente Supabase no inicializado",
      projectId: SUPABASE_PROJECT_ID,
      url: supabaseUrl,
      restUrl: supabaseRestUrl
    };
  }

  try {
    // Probar conexión contra la API REST de Supabase
    const { data, error } = await clientPublic.from("perfiles_usuario").select("count").limit(1);
    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("Could not find the table")) {
        return {
          ok: true,
          message: "Conexión a Supabase REST API exitosa (Tablas pendientes de ejecutar migración SQL)",
          projectId: SUPABASE_PROJECT_ID,
          url: supabaseUrl,
          restUrl: supabaseRestUrl,
          details: { code: error.code, tablesPending: true }
        };
      }
      return {
        ok: false,
        message: `Error Supabase: ${error.message}`,
        projectId: SUPABASE_PROJECT_ID,
        url: supabaseUrl,
        restUrl: supabaseRestUrl,
        details: error
      };
    }

    return {
      ok: true,
      message: "Conexión y tablas de Supabase verificadas correctamente",
      projectId: SUPABASE_PROJECT_ID,
      url: supabaseUrl,
      restUrl: supabaseRestUrl,
      details: data
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || "Excepción al contactar Supabase",
      projectId: SUPABASE_PROJECT_ID,
      url: supabaseUrl,
      restUrl: supabaseRestUrl
    };
  }
}

