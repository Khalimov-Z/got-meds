import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAuthConfig } from "@/lib/supabase-auth-config";

export async function createSupabaseAuthServerClient() {
  const config = getSupabaseAuthConfig();

  if (!config) {
    throw new Error(
      "Supabase Auth не настроен: задайте NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  const cookieStore = await cookies();

  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // В Server Components запись cookies недоступна; middleware обновит сессию.
        }
      },
    },
  });
}
