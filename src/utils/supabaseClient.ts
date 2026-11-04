import { createClient, SupabaseClient } from "@supabase/supabase-js";

// CRM VRD — FRANCO OSORIO INVESTMENT S.A.S.
// CLIENTE OFICIAL SUPABASE PARA EL NAVEGADOR / FRONTEND

export const SUPABASE_PROJECT_ID =
  import.meta.env.VITE_SUPABASE_PROJECT_ID || "dcelksfchabhrlevlfah";

const rawUrl =
  import.meta.env.VITE_SUPABASE_URL || "https://dcelksfchabhrlevlfah.supabase.co";

export const SUPABASE_URL = rawUrl
  .trim()
  .replace(/\/rest\/v1\/?$/i, "")
  .replace(/\/+$/, "");

export const SUPABASE_REST_URL = `${SUPABASE_URL}/rest/v1/`;

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_B8tc_3lQWCKeBJ3camRySQ_yZAVTqLw";

let client: SupabaseClient | null = null;

try {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
  }
} catch (err) {
  console.error("[ERROR]: No se pudo instanciar cliente frontend de Supabase:", err);
}

export const supabase = client;

export async function pingSupabaseFrontend(): Promise<{
  ok: boolean;
  statusText: string;
  projectId: string;
  url: string;
  restUrl: string;
}> {
  try {
    const res = await fetch(`${SUPABASE_REST_URL}perfiles_usuario?select=id&limit=1`, {
      method: "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    return {
      ok: res.ok || res.status === 200 || res.status === 206 || res.status === 404,
      statusText: `HTTP ${res.status} ${res.statusText}`,
      projectId: SUPABASE_PROJECT_ID,
      url: SUPABASE_URL,
      restUrl: SUPABASE_REST_URL
    };
  } catch (err: any) {
    return {
      ok: false,
      statusText: err?.message || "Error al contactar Supabase REST",
      projectId: SUPABASE_PROJECT_ID,
      url: SUPABASE_URL,
      restUrl: SUPABASE_REST_URL
    };
  }
}
