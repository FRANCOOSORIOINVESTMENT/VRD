import { createClient, SupabaseClient } from "@supabase/supabase-js";

// CRM VRD — FRANCO OSORIO INVESTMENT S.A.S.
// MÓDULO DE CONFIGURACIÓN Y CLIENTE SUPABASE

export const APP_MODE = process.env.APP_MODE || "mock";
export const isMockMode = APP_MODE !== "supabase";

// Soporte para nombres recomendados actuales (SUPABASE_PUBLISHABLE_KEY y SUPABASE_SECRET_KEY)
// con retrocompatibilidad para SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let clientPublic: SupabaseClient | null = null;
let clientAdmin: SupabaseClient | null = null;

if (!isMockMode) {
  // Validación estricta en MODO SUPABASE: no se permite fallback silencioso
  const missing: string[] = [];
  if (!supabaseUrl) missing.push("SUPABASE_URL");
  if (!supabasePublishableKey) missing.push("SUPABASE_PUBLISHABLE_KEY (o SUPABASE_ANON_KEY)");
  if (!supabaseSecretKey) missing.push("SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY)");

  if (missing.length > 0) {
    const errorMsg = `[ERROR FATAL DE INICIALIZACIÓN]: APP_MODE está configurado en 'supabase', pero faltan variables obligatorias: ${missing.join(", ")}. El servidor no puede iniciar en modo Supabase con configuración incompleta.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  clientPublic = createClient(supabaseUrl, supabasePublishableKey);
  clientAdmin = createClient(supabaseUrl, supabaseSecretKey);
  console.log("[INFO]: CRM VRD inicializado en MODO SUPABASE (PostgreSQL + RLS + Storage)");
} else {
  console.log("[INFO]: CRM VRD inicializado en MODO DEMOSTRACIÓN (Mock en memoria — Datos ficticios no persistentes)");
}

export const supabasePublic = clientPublic;
export const supabaseAdmin = clientAdmin;
