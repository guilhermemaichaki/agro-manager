"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import type { Culture } from "@/types/schema";
import { cn } from "@/lib/utils";

// Culturas pré-definidas com ícones
const PREDEFINED_CULTURES = [
  { name: "Soja", icon: "🌱" },
  { name: "Milho", icon: "🌽" },
  { name: "Trigo", icon: "🌾" },
  { name: "Algodão", icon: "☁️" },
  { name: "Café", icon: "☕" },
  { name: "Cana-de-açúcar", icon: "🎋" },
  { name: "Feijão", icon: "🫘" },
  { name: "Arroz", icon: "🌾" },
  { name: "Tomate", icon: "🍅" },
  { name: "Batata", icon: "🥔" },
];

interface CultureSelectorProps {
  value: string;
  onChange: (cultureId: string) => void;
  error?: string;
}

async function fetchCultures(): Promise<Culture[]> {
  const { data, error } = await supabase
    .from("cultures")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar culturas: ${error.message}`);
  }

  return data || [];
}

async function createCulture(name: string): Promise<Culture> {
  const { data: newCulture, error } = await supabase
    .from("cultures")
    .insert({
      name: name,
    } as any)
    .select()
    .single();

  if (error || !newCulture) {
    throw new Error(`Erro ao criar cultura: ${error?.message || "Cultura não foi criada"}`);
  }

  return newCulture as Culture;
}

export function CultureSelector({ value, onChange, error }: CultureSelectorProps) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customCultureName, setCustomCultureName] = useState("");
  const queryClient = useQueryClient();

  const { data: existingCultures = [] } = useQuery({
    queryKey: ["cultures"],
    queryFn: fetchCultures,
  });

  const createCultureMutation = useMutation({
    mutationFn: createCulture,
    onSuccess: (newCulture) => {
      queryClient.invalidateQueries({ queryKey: ["cultures"] });
      onChange(newCulture.id);
      setCustomCultureName("");
      setShowCustomInput(false);
    },
    onError: (error: Error) => {
      alert(`Erro ao criar cultura: ${error.message}`);
    },
  });

  // Combinar culturas pré-definidas com as existentes no banco
  // Primeiro, mapear culturas pré-definidas para usar IDs existentes se disponíveis
  const predefinedWithIds = PREDEFINED_CULTURES.map((predef) => {
    const existing = existingCultures.find((c) => c.name.toLowerCase() === predef.name.toLowerCase());
    return {
      id: existing?.id || null,
      name: predef.name,
      icon: predef.icon,
      isPredefined: true,
    };
  });

  // Depois, adicionar culturas existentes que não estão na lista pré-definida
  const customCultures = existingCultures
    .filter((c) => !PREDEFINED_CULTURES.some((p) => p.name.toLowerCase() === c.name.toLowerCase()))
    .map((c) => ({
      id: c.id,
      name: c.name,
      icon: "🌿",
      isPredefined: false,
    }));

  const allCultures = [...predefinedWithIds, ...customCultures];

  const handleCustomCultureSubmit = () => {
    if (customCultureName.trim()) {
      createCultureMutation.mutate(customCultureName.trim());
    }
  };

  const handleCultureClick = async (culture: { id: string | null; name: string; icon: string }) => {
    if (culture.id) {
      // Cultura já existe no banco, apenas selecionar
      onChange(culture.id);
    } else {
      // Cultura pré-definida que não existe no banco, criar e selecionar
      createCultureMutation.mutate(culture.name);
    }
  };

  const selectedCulture = allCultures.find((c) => c.id === value) || 
    existingCultures.find((c) => c.id === value) ||
    (value ? { id: value, name: "Cultura selecionada", icon: "🌿" } : null);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {allCultures.map((culture) => {
          const isSelected = culture.id === value;
          return (
              <Card
                key={culture.id || culture.name}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary"
                    : "hover:border-primary/50"
                )}
                onClick={() => handleCultureClick(culture)}
              >
              <CardContent className="p-3 flex flex-col items-center gap-2">
                <span className="text-2xl">{culture.icon}</span>
                <span className="text-xs font-medium text-center">{culture.name}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {showCustomInput ? (
        <div className="flex gap-2">
          <Input
            placeholder="Digite o nome da cultura"
            value={customCultureName}
            onChange={(e) => setCustomCultureName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCustomCultureSubmit();
              }
            }}
            disabled={createCultureMutation.isPending}
          />
          <Button
            type="button"
            onClick={handleCustomCultureSubmit}
            disabled={!customCultureName.trim() || createCultureMutation.isPending}
          >
            Adicionar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setShowCustomInput(false);
              setCustomCultureName("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowCustomInput(true)}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar outra cultura
        </Button>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {selectedCulture && (
        <div className="text-sm text-muted-foreground">
          Cultura selecionada: <span className="font-medium">{selectedCulture.name}</span>
        </div>
      )}
    </div>
  );
}
