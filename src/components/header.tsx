"use client";

import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Farm, CropYear } from "@/types/schema";

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

async function fetchCropYears(): Promise<CropYear[]> {
  const { data, error } = await supabase
    .from("crop_years")
    .select("*")
    .order("start_date", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar safras: ${error.message}`);
  }

  return data || [];
}

export function Header() {
  const { selectedFarmId, selectedCropYearId, setSelectedFarmId, setSelectedCropYearId } =
    useAppStore();

  const { data: farms = [], isLoading: isLoadingFarms } = useQuery({
    queryKey: ["farms"],
    queryFn: fetchFarms,
  });

  const { data: cropYears = [], isLoading: isLoadingCropYears } = useQuery({
    queryKey: ["crop_years"],
    queryFn: fetchCropYears,
  });

  const selectedFarm = farms.find((f) => f.id === selectedFarmId);
  const selectedCropYear = cropYears.find((cy) => cy.id === selectedCropYearId);

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center gap-4 px-6">
        <div className="flex flex-1 items-center gap-4">
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
            <label className="text-sm font-medium">Safra:</label>
            <Select
              value={selectedCropYearId || ""}
              onValueChange={(value) => setSelectedCropYearId(value || null)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecione a safra">
                  {selectedCropYear?.name || "Selecione a safra"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {cropYears.map((cropYear) => (
                  <SelectItem key={cropYear.id} value={cropYear.id}>
                    {cropYear.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}

