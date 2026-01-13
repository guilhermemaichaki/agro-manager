import { supabase } from "./supabase";
import type { UserProfile, Farm, FarmMember, UserRole } from "@/types/schema";

/**
 * Verifica se o usuário está autenticado
 */
export async function isAuthenticated(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return !!session;
}

/**
 * Obtém o usuário atual
 */
export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Obtém o perfil do usuário atual (cria se não existir)
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  // Tentar buscar perfil existente
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Se encontrou, retornar
  if (data) return data as UserProfile;

  // Se não encontrou (PGRST116 = no rows), tentar criar perfil
  if (error?.code === "PGRST116") {
    console.log("[Auth] Profile not found, attempting to create...");
    
    const fullName = user.user_metadata?.full_name || 
                     user.user_metadata?.name || 
                     user.email?.split("@")[0] || 
                     "Usuário";
    
    const { data: newProfile, error: insertError } = await supabase
      .from("user_profiles")
      .insert({
        id: user.id,
        email: user.email || "",
        full_name: fullName,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao criar perfil:", insertError);
      
      // Se erro for de permissão (RLS), retornar um perfil temporário
      // para que o usuário possa pelo menos ver a interface
      if (insertError.code === "42501" || insertError.message?.includes("policy")) {
        console.warn("[Auth] RLS blocking profile creation, using temporary profile");
        return {
          id: user.id,
          email: user.email || "",
          full_name: fullName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as UserProfile;
      }
      
      return null;
    }

    console.log("[Auth] Profile created successfully");
    return newProfile as UserProfile;
  }

  // Outro erro (não PGRST116)
  if (error) {
    console.error("[Auth] Error fetching profile:", error);
  }

  return null;
}

/**
 * Obtém todas as fazendas acessíveis pelo usuário
 */
export async function getUserFarms(): Promise<Farm[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("farm_members")
    .select("farm:farms(*)")
    .eq("user_id", user.id)
    .not("accepted_at", "is", null);

  if (error || !data) return [];
  return data.map((item: any) => item.farm).filter(Boolean) as Farm[];
}

/**
 * Obtém o membro da fazenda do usuário atual
 */
export async function getFarmMember(
  farmId: string
): Promise<FarmMember | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("farm_members")
    .select("*")
    .eq("farm_id", farmId)
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .single();

  if (error || !data) return null;
  return data as FarmMember;
}

/**
 * Verifica se o usuário tem permissão na fazenda
 */
export async function hasFarmPermission(
  farmId: string,
  permission: "view" | "create" | "update" | "delete" | "manage_users" | "manage_farm"
): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const { data, error } = await supabase.rpc("has_farm_permission", {
    p_farm_id: farmId,
    p_user_id: user.id,
    p_permission: permission,
  });

  if (error || data === null) return false;
  return data as boolean;
}

/**
 * Obtém o role do usuário na fazenda
 */
export async function getUserFarmRole(farmId: string): Promise<UserRole | null> {
  const member = await getFarmMember(farmId);
  return member?.role || null;
}

/**
 * Fazer login
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

/**
 * Fazer logout
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Solicitar reset de senha
 */
export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return { data, error };
}

/**
 * Atualizar senha
 */
export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  return { data, error };
}

/**
 * Criar conta
 */
export async function signUp(email: string, password: string, fullName?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName || "",
      },
    },
  });
  return { data, error };
}
