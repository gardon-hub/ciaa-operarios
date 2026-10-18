import { createClient } from "@supabase/supabase-js";

// Misma base de datos que CIAA Digital. La clave es la pública (rol «anon»),
// la misma que CIAA Digital publica en el navegador: no da acceso por sí sola;
// lo que cada cuenta puede hacer lo deciden las reglas de la base de datos.
export const SUPABASE_URL = "https://hpzcmgccocdvphccbzib.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwemNtZ2Njb2NkdnBoY2NiemliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MjQwNTEsImV4cCI6MjA5MjIwMDA1MX0.UKNVdjzNCFiB0Hd_EOFPswj-Ro-EWUJXvl2TToMRe3s";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "ciaa-operarios-auth",
  },
});
