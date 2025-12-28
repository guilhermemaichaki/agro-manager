"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Farm, HarvestYear, HarvestCycle, Field } from "@/types/schema";

async function fetchFarms(): Promise<Farm[]> {
  const { data, error } = await supabase
    .from("farms")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar fazendas: ${error.message}`);
  }

  return data || [];
}

async function fetchHarvestYears(): Promise<HarvestYear[]> {
  const { data, error } = await supabase
    .from("harvest_years")
    .select("*")
    .order("start_date", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar safras: ${error.message}`);
  }

  return data || [];
}

async function fetchHarvestCycles(harvestYearId: string | null): Promise<HarvestCycle[]> {
  if (!harvestYearId) return [];

  const { data, error } = await supabase
    .from("harvest_cycles")
    .select("*")
    .eq("harvest_year_id", harvestYearId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar ciclos: ${error.message}`);
  }

  return data || [];
}

async function fetchFields(
  farmId: string | null,
  harvestCycleId: string | null
): Promise<Field[]> {
  if (!farmId) return [];

  let query = supabase
    .from("fields")
    .select("*")
    .eq("farm_id", farmId)
    .order("name", { ascending: true });

  // Se há ciclo selecionado, filtrar apenas talhões que têm planejamento naquele ciclo
  if (harvestCycleId) {
    const { data: fieldCrops } = await supabase
      .from("field_crops")
      .select("field_id")
      .eq("harvest_cycle_id", harvestCycleId);

    if (fieldCrops && fieldCrops.length > 0) {
      const fieldIds = fieldCrops.map((fc) => fc.field_id);
      query = query.in("id", fieldIds);
    } else {
      // Se não há planejamentos, retornar array vazio
      return [];
    }
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao buscar talhões: ${error.message}`);
  }

  return data || [];
}

export function Header() {
  const {
    selectedFarmId,
    selectedHarvestYearId,
    selectedHarvestCycleId,
    selectedFieldId,
    setSelectedFarmId,
    setSelectedHarvestYearId,
    setSelectedHarvestCycleId,
    setSelectedFieldId,
  } = useAppStore();

  const { data: farms = [], isLoading: isLoadingFarms } = useQuery({
    queryKey: ["farms"],
    queryFn: fetchFarms,
  });

  const { data: harvestYears = [], isLoading: isLoadingHarvestYears } = useQuery({
    queryKey: ["harvest_years"],
    queryFn: fetchHarvestYears,
  });

  const { data: harvestCycles = [], isLoading: isLoadingHarvestCycles } = useQuery({
    queryKey: ["harvest_cycles", selectedHarvestYearId],
    queryFn: () => fetchHarvestCycles(selectedHarvestYearId),
    enabled: !!selectedHarvestYearId,
  });

  const { data: fields = [], isLoading: isLoadingFields } = useQuery({
    queryKey: ["fields", selectedFarmId, selectedHarvestCycleId],
    queryFn: () => fetchFields(selectedFarmId, selectedHarvestCycleId),
    enabled: !!selectedFarmId,
  });

  // Reset cycle e field quando harvest year muda
  useEffect(() => {
    if (selectedHarvestYearId) {
      // O reset já é feito no store quando setSelectedHarvestYearId é chamado
    }
  }, [selectedHarvestYearId]);

  const selectedFarm = farms.find((f) => f.id === selectedFarmId);
  const selectedHarvestYear = harvestYears.find((hy) => hy.id === selectedHarvestYearId);
  const selectedHarvestCycle = harvestCycles.find((hc) => hc.id === selectedHarvestCycleId);
  const selectedField = fields.find((f) => f.id === selectedFieldId);

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
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecione o ano safra">
                  {selectedHarvestYear?.name || "Selecione o ano safra"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {harvestYears.map((harvestYear) => (
                  <SelectItem key={harvestYear.id} value={harvestYear.id}>
                    {harvestYear.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedHarvestYearId && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Safra/Ciclo:</label>
              <Select
                value={selectedHarvestCycleId || ""}
                onValueChange={(value) => setSelectedHarvestCycleId(value || null)}
                disabled={!selectedHarvestYearId || isLoadingHarvestCycles}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Selecione o ciclo">
                    {selectedHarvestCycle?.name || "Selecione o ciclo"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {harvestCycles.map((cycle) => (
                    <SelectItem key={cycle.id} value={cycle.id}>
                      {cycle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedFarmId && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Talhão:</label>
              <Select
                value={selectedFieldId || ""}
                onValueChange={(value) => setSelectedFieldId(value || null)}
                disabled={!selectedFarmId || isLoadingFields}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Selecione o talhão">
                    {selectedField?.name || "Selecione o talhão"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {fields.map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
