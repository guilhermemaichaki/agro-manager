"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, ChevronDown, ChevronRight, Search, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/lib/supabase";
import type { Category } from "@/types/schema";
import { cn } from "@/lib/utils";

interface CategorySelectorProps {
  value: string[]; // Array de IDs de categorias selecionadas
  onChange: (categoryIds: string[]) => void;
  error?: string;
}

async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("group_name", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar categorias: ${error.message}`);
  }

  return data || [];
}

async function createCategory(name: string): Promise<Category> {
  const { data: newCategory, error } = await supabase
    .from("categories")
    .insert({
      name: name.trim(),
      type: "custom",
      group_name: "custom",
    } as any)
    .select()
    .single();

  if (error || !newCategory) {
    throw new Error(`Erro ao criar categoria: ${error?.message || "Categoria não foi criada"}`);
  }

  return newCategory as Category;
}

export function CategorySelector({ value = [], onChange, error }: CategorySelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["defensivos", "adjuvantes"])
  );
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const createCategoryMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: (newCategory) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      // Adicionar a nova categoria à seleção
      onChange([...value, newCategory.id]);
      setCustomCategoryName("");
      setShowCustomInput(false);
      // Expandir grupo custom se não estiver expandido
      setExpandedGroups((prev) => new Set([...prev, "custom"]));
    },
    onError: (error: Error) => {
      alert(`Erro ao criar categoria: ${error.message}`);
    },
  });

  // Filtrar categorias baseado na busca
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories;
    const term = searchTerm.toLowerCase();
    return categories.filter((cat) => cat.name.toLowerCase().includes(term));
  }, [categories, searchTerm]);

  // Agrupar categorias
  const groupedCategories = useMemo(() => {
    const groups: Record<string, Category[]> = {
      defensivos: [],
      adjuvantes: [],
      custom: [],
    };

    filteredCategories.forEach((cat) => {
      if (groups[cat.group_name]) {
        groups[cat.group_name].push(cat);
      }
    });

    return groups;
  }, [filteredCategories]);

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  const handleCategoryToggle = (categoryId: string) => {
    const newValue = value.includes(categoryId)
      ? value.filter((id) => id !== categoryId)
      : [...value, categoryId];
    onChange(newValue);
  };

  const handleCustomCategorySubmit = () => {
    if (customCategoryName.trim()) {
      // Verificar se já existe
      const exists = categories.some(
        (cat) => cat.name.toLowerCase() === customCategoryName.trim().toLowerCase()
      );
      if (exists) {
        alert("Esta categoria já existe!");
        return;
      }
      createCategoryMutation.mutate(customCategoryName.trim());
    }
  };

  const selectedCategories = categories.filter((cat) => value.includes(cat.id));

  // Focar no input de busca quando o popover abrir
  useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // Texto do trigger
  const triggerText = useMemo(() => {
    if (selectedCategories.length === 0) {
      return "Selecione a categoria";
    }
    if (selectedCategories.length <= 2) {
      return selectedCategories.map((cat) => cat.name).join(", ");
    }
    return `${selectedCategories.length} categorias selecionadas`;
  }, [selectedCategories]);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-between text-left font-normal",
              !value.length && "text-muted-foreground"
            )}
          >
            <span className="truncate">{triggerText}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
            {/* Campo de busca dentro do dropdown */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Pesquisar categorias"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Toggle Defensivos Agrícolas (simples, sem bordas) */}
            <div>
              <button
                type="button"
                onClick={() => toggleGroup("defensivos")}
                className="w-full flex items-center justify-between py-2 hover:text-primary transition-colors"
              >
                <span className="font-medium">Defensivos Agrícolas</span>
                {expandedGroups.has("defensivos") ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {expandedGroups.has("defensivos") && (
                <div className="pl-4 pt-2 space-y-2">
                  {groupedCategories.defensivos.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      {searchTerm ? "Nenhuma categoria encontrada" : "Nenhuma categoria"}
                    </p>
                  ) : (
                    groupedCategories.defensivos.map((category) => (
                      <div key={category.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`cat-${category.id}`}
                          checked={value.includes(category.id)}
                          onCheckedChange={() => handleCategoryToggle(category.id)}
                        />
                        <Label
                          htmlFor={`cat-${category.id}`}
                          className="text-sm font-normal cursor-pointer flex-1"
                        >
                          {category.name}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Toggle Adjuvantes e Afins (simples, sem bordas) */}
            <div>
              <button
                type="button"
                onClick={() => toggleGroup("adjuvantes")}
                className="w-full flex items-center justify-between py-2 hover:text-primary transition-colors"
              >
                <span className="font-medium">Adjuvantes e Afins</span>
                {expandedGroups.has("adjuvantes") ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {expandedGroups.has("adjuvantes") && (
                <div className="pl-4 pt-2 space-y-2">
                  {groupedCategories.adjuvantes.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      {searchTerm ? "Nenhuma categoria encontrada" : "Nenhuma categoria"}
                    </p>
                  ) : (
                    groupedCategories.adjuvantes.map((category) => (
                      <div key={category.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`cat-${category.id}`}
                          checked={value.includes(category.id)}
                          onCheckedChange={() => handleCategoryToggle(category.id)}
                        />
                        <Label
                          htmlFor={`cat-${category.id}`}
                          className="text-sm font-normal cursor-pointer flex-1"
                        >
                          {category.name}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Toggle Minhas Categorias (aparece apenas se houver categorias customizadas) */}
            {groupedCategories.custom.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => toggleGroup("custom")}
                  className="w-full flex items-center justify-between py-2 hover:text-primary transition-colors"
                >
                  <span className="font-medium">Minhas categorias</span>
                  {expandedGroups.has("custom") ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {expandedGroups.has("custom") && (
                  <div className="pl-4 pt-2 space-y-2">
                    {groupedCategories.custom.map((category) => (
                      <div key={category.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`cat-${category.id}`}
                          checked={value.includes(category.id)}
                          onCheckedChange={() => handleCategoryToggle(category.id)}
                        />
                        <Label
                          htmlFor={`cat-${category.id}`}
                          className="text-sm font-normal cursor-pointer flex-1"
                        >
                          {category.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Botão para criar nova categoria */}
            {showCustomInput ? (
              <div className="flex gap-2 pt-2 border-t">
                <Input
                  placeholder="Digite o nome da categoria"
                  value={customCategoryName}
                  onChange={(e) => setCustomCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCustomCategorySubmit();
                    }
                  }}
                  disabled={createCategoryMutation.isPending}
                />
                <Button
                  type="button"
                  onClick={handleCustomCategorySubmit}
                  disabled={!customCategoryName.trim() || createCategoryMutation.isPending}
                  size="sm"
                >
                  Adicionar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowCustomInput(false);
                    setCustomCategoryName("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCustomInput(true)}
                className="w-full justify-start"
              >
                <Plus className="mr-2 h-4 w-4" />
                Criar nova categoria
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
