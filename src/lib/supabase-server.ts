import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const globalForSupabase = globalThis as unknown as {
  gotmedsSupabaseServerClient: SupabaseClient | undefined;
};

export function getSupabaseServerClient() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase read layer не настроен: задайте SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  if (!globalForSupabase.gotmedsSupabaseServerClient) {
    globalForSupabase.gotmedsSupabaseServerClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  return globalForSupabase.gotmedsSupabaseServerClient;
}
