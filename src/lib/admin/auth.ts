"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isSupabaseAuthConfigured } from "@/lib/supabase-auth-config";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

type AdminRole = "SUPERADMIN" | "CONTENT_MANAGER";

type AdminRow = {
  id: string;
  email: string;
  role: AdminRole;
  auth_user_id: string | null;
};

export type CurrentAdmin = {
  id: string;
  email: string;
  role: AdminRole;
};

export type LoginState = {
  error?: string;
};

function isAdminRole(value: unknown): value is AdminRole {
  return value === "SUPERADMIN" || value === "CONTENT_MANAGER";
}

function mapAdminRow(row: AdminRow | null): CurrentAdmin | null {
  if (!row || !isAdminRole(row.role)) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    role: row.role,
  };
}

async function getDomainAdminByAuthUserId(
  supabase: Awaited<ReturnType<typeof createSupabaseAuthServerClient>>,
  authUserId: string
) {
  const { data, error } = await supabase
    .from("admins")
    .select("id,email,role,auth_user_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle<AdminRow>();

  if (error) {
    console.error("Не удалось получить доменного администратора", error);
    return null;
  }

  return mapAdminRow(data);
}

export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  // Админские страницы должны оставаться привязанными к request cookies даже без env на build.
  await cookies();

  if (!isSupabaseAuthConfigured()) {
    return null;
  }

  const supabase = await createSupabaseAuthServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const authUserId = data?.claims?.sub;

  if (error || typeof authUserId !== "string") {
    return null;
  }

  return getDomainAdminByAuthUserId(supabase, authUserId);
}

export async function requireAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  return admin;
}

export async function loginAdmin(
  _previousState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Введите email и пароль" };
  }

  if (!isSupabaseAuthConfigured()) {
    return { error: "Supabase Auth не настроен" };
  }

  const supabase = await createSupabaseAuthServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: "Неверный email или пароль" };
  }

  const admin = await getDomainAdminByAuthUserId(supabase, data.user.id);

  if (!admin) {
    await supabase.auth.signOut({ scope: "local" });
    return { error: "У пользователя нет роли администратора" };
  }

  redirect("/admin");
}

export async function logoutAdmin() {
  if (isSupabaseAuthConfigured()) {
    const supabase = await createSupabaseAuthServerClient();
    await supabase.auth.signOut({ scope: "local" });
  }

  redirect("/admin/login");
}
