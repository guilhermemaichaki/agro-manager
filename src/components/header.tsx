"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/app-store";
import { useAuth } from "@/contexts/auth-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, User, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { signOut } from "@/lib/auth-helpers";
import type { Farm, HarvestYear } from "@/types/schema";

async function fetchFarms(): Promise<Farm[]> {
  // Buscar fazendas através de farm_members
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("farm_members")
    .select(`
      farm:farms(*)
    `)
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar fazendas: ${error.message}`);
  }

  return (data || []).map((item: any) => item.farm).filter(Boolean) as Farm[];
}

async function fetchHarvestYears(farmId: string | null): Promise<HarvestYear[]> {
  let query = supabase
    .from("harvest_years")
    .select("*")
    .order("start_date", { ascending: false });

  if (farmId) {
    query = query.eq("farm_id", farmId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao buscar safras: ${error.message}`);
  }

  return data || [];
}

export function Header() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    selectedFarmId,
    selectedHarvestYearId,
    setSelectedFarmId,
    setSelectedHarvestYearId,
    currentFarmMember,
  } = useAppStore();

  const { data: farms = [], isLoading: isLoadingFarms } = useQuery({
    queryKey: ["user-farms"],
    queryFn: fetchFarms,
    enabled: !!user,
  });

  const { data: harvestYears = [], isLoading: isLoadingHarvestYears } = useQuery({
    queryKey: ["harvest_years", selectedFarmId],
    queryFn: () => fetchHarvestYears(selectedFarmId),
    enabled: !!selectedFarmId,
  });

  const selectedFarm = farms.find((f) => f.id === selectedFarmId);
  const selectedHarvestYear = harvestYears.find((hy) => hy.id === selectedHarvestYearId);

  const handleLogout = async () => {
    await signOut();
    // O onAuthStateChange no AuthProvider vai limpar o estado
    // e o AuthGuard vai redirecionar para /login automaticamente
  };

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center gap-4 px-6">
        <div className="flex flex-1 items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Fazenda:</label>
            <Select
              value={selectedFarmId || ""}
              onValueChange={(value) => setSelectedFarmId(value || null)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecione a fazenda">
                  {selectedFarm?.name || "Selecione a fazenda"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {farms.map((farm) => (
                  <SelectItem key={farm.id} value={farm.id}>
                    {farm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {farms.length === 0 && !isLoadingFarms && (
              <Link href="/cadastros/fazendas">
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Cadastrar Fazenda
                </Button>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Ano Safra:</label>
            <Select
              value={selectedHarvestYearId || ""}
              onValueChange={(value) => setSelectedHarvestYearId(value || null)}
              disabled={!selectedFarmId || isLoadingHarvestYears}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecione o ano safra">
                  {selectedHarvestYear?.name || "Selecione o ano safra"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {harvestYears.length === 0 && selectedFarmId ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    Nenhum ano safra cadastrado
                  </div>
                ) : (
                  harvestYears.map((harvestYear) => (
                    <SelectItem key={harvestYear.id} value={harvestYear.id}>
                      {harvestYear.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user.full_name || "Usuário"}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {selectedFarm && (currentFarmMember?.role === "owner" || currentFarmMember?.role === "admin") && (
                <Link href={`/fazendas/${selectedFarm.id}/usuarios`}>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Gerenciar Usuários</span>
                  </DropdownMenuItem>
                </Link>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
