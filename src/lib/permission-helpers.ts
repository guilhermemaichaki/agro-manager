import { useAppStore } from "@/store/app-store";
import { hasFarmPermission } from "./auth-helpers";
import type { UserRole } from "@/types/schema";

/**
 * Hook para verificar se o usuário tem permissão na fazenda atual
 */
export async function checkPermission(
  permission: "view" | "create" | "update" | "delete" | "manage_users" | "manage_farm"
): Promise<boolean> {
  const { selectedFarmId } = useAppStore.getState();
  if (!selectedFarmId) return false;
  
  return await hasFarmPermission(selectedFarmId, permission);
}

/**
 * Verifica se o role tem permissão específica
 */
export function roleHasPermission(
  role: UserRole | null,
  permission: "view" | "create" | "update" | "delete" | "manage_users" | "manage_farm"
): boolean {
  if (!role) return false;

  switch (permission) {
    case "view":
      return true; // Todos podem visualizar
    case "create":
      return ["owner", "admin", "manager", "operator"].includes(role);
    case "update":
      return ["owner", "admin", "manager"].includes(role);
    case "delete":
      return ["owner", "admin"].includes(role);
    case "manage_users":
      return ["owner", "admin"].includes(role);
    case "manage_farm":
      return role === "owner";
    default:
      return false;
  }
}
