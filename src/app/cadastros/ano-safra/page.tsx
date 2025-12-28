"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { HarvestYear, HarvestCycle } from "@/types/schema";
import { supabase } from "@/lib/supabase";

// Schema de validação
const harvestYearSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  start_date: z.string().min(1, "Data de início é obrigatória"),
  end_date: z.string().min(1, "Data de fim é obrigatória"),
  cycles: z.array(z.string().min(1, "Nome do ciclo é obrigatório")).min(1, "Adicione pelo menos um ciclo"),
}).refine((data) => {
  const start = new Date(data.start_date);
  const end = new Date(data.end_date);
  return end >= start;
}, {
  message: "Data de fim deve ser posterior à data de início",
  path: ["end_date"],
});

type HarvestYearFormValues = z.infer<typeof harvestYearSchema>;

// Tipos para API
interface CreateHarvestYearInput {
  name: string;
  start_date: string;
  end_date: string;
  cycles: string[];
}

interface UpdateHarvestYearInput {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  cycles: string[];
}

// Funções de API usando Supabase
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

async function fetchHarvestCycles(harvestYearId: string): Promise<HarvestCycle[]> {
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

async function createHarvestYear(data: CreateHarvestYearInput): Promise<HarvestYear> {
  // Criar harvest_year primeiro
  const { data: newHarvestYear, error: yearError } = await supabase
    .from("harvest_years")
    .insert({
      name: data.name,
      start_date: data.start_date,
      end_date: data.end_date,
    } as any)
    .select()
    .single();

  if (yearError || !newHarvestYear) {
    throw new Error(`Erro ao criar safra: ${yearError?.message || "Safra não foi criada"}`);
  }

  // Criar todos os ciclos
  if (data.cycles.length > 0) {
    const cyclesToInsert = data.cycles.map((cycleName) => ({
      harvest_year_id: newHarvestYear.id,
      name: cycleName,
    }));

    const { error: cyclesError } = await supabase
      .from("harvest_cycles")
      .insert(cyclesToInsert as any);

    if (cyclesError) {
      // Se falhar ao criar ciclos, tentar deletar o harvest_year criado
      await supabase.from("harvest_years").delete().eq("id", newHarvestYear.id);
      throw new Error(`Erro ao criar ciclos: ${cyclesError.message}`);
    }
  }

  return newHarvestYear as HarvestYear;
}

async function updateHarvestYear(data: UpdateHarvestYearInput): Promise<HarvestYear> {
  const { id, cycles, ...updateData } = data;

  // Atualizar harvest_year
  const { data: updatedHarvestYear, error: yearError } = await supabase
    .from("harvest_years")
    .update(updateData as any)
    .eq("id", id)
    .select()
    .single();

  if (yearError || !updatedHarvestYear) {
    throw new Error(`Erro ao atualizar safra: ${yearError?.message || "Safra não foi atualizada"}`);
  }

  // Buscar ciclos existentes
  const existingCycles = await fetchHarvestCycles(id);
  const existingCycleNames = existingCycles.map((c) => c.name);

  // Deletar ciclos que não estão mais na lista
  const cyclesToDelete = existingCycles.filter((c) => !cycles.includes(c.name));
  if (cyclesToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("harvest_cycles")
      .delete()
      .in("id", cyclesToDelete.map((c) => c.id));

    if (deleteError) {
      throw new Error(`Erro ao deletar ciclos: ${deleteError.message}`);
    }
  }

  // Adicionar novos ciclos
  const cyclesToAdd = cycles.filter((name) => !existingCycleNames.includes(name));
  if (cyclesToAdd.length > 0) {
    const cyclesToInsert = cyclesToAdd.map((cycleName) => ({
      harvest_year_id: id,
      name: cycleName,
    }));

    const { error: insertError } = await supabase
      .from("harvest_cycles")
      .insert(cyclesToInsert as any);

    if (insertError) {
      throw new Error(`Erro ao adicionar ciclos: ${insertError.message}`);
    }
  }

  return updatedHarvestYear as HarvestYear;
}

async function deleteHarvestYear(id: string): Promise<void> {
  // Deletar ciclos primeiro (devido à foreign key)
  await supabase.from("harvest_cycles").delete().eq("harvest_year_id", id);

  // Deletar harvest_year
  const { error } = await supabase.from("harvest_years").delete().eq("id", id);

  if (error) {
    throw new Error(`Erro ao deletar safra: ${error.message}`);
  }
}

// Função para formatar data para exibição (DD/MM/YYYY)
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Função para converter data ISO para formato do input (YYYY-MM-DD)
function formatDateForInput(dateString: string): string {
  const date = new Date(dateString);
  return date.toISOString().split("T")[0];
}

const DEFAULT_CYCLES = ["Verão", "Inverno", "Safrinha"];

export default function AnoSafraPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHarvestYear, setEditingHarvestYear] = useState<HarvestYear | null>(null);
  const [customCycleInput, setCustomCycleInput] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const queryClient = useQueryClient();

  // Query para buscar safras
  const { data: harvestYears = [], isLoading, error: fetchError } = useQuery({
    queryKey: ["harvest_years"],
    queryFn: fetchHarvestYears,
  });

  // Query para buscar ciclos do ano sendo editado
  const { data: existingCycles = [] } = useQuery({
    queryKey: ["harvest_cycles", editingHarvestYear?.id],
    queryFn: () => editingHarvestYear ? fetchHarvestCycles(editingHarvestYear.id) : Promise.resolve([]),
    enabled: !!editingHarvestYear,
  });

  // Mutation para criar safra
  const createMutation = useMutation({
    mutationFn: createHarvestYear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["harvest_years"] });
      queryClient.invalidateQueries({ queryKey: ["harvest_cycles"] });
      setIsDialogOpen(false);
      form.reset();
      setShowCustomInput(false);
      setCustomCycleInput("");
    },
    onError: (error: Error) => {
      alert(`Erro ao criar safra: ${error.message}`);
    },
  });

  // Mutation para atualizar safra
  const updateMutation = useMutation({
    mutationFn: updateHarvestYear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["harvest_years"] });
      queryClient.invalidateQueries({ queryKey: ["harvest_cycles"] });
      setIsDialogOpen(false);
      setEditingHarvestYear(null);
      form.reset();
      setShowCustomInput(false);
      setCustomCycleInput("");
    },
    onError: (error: Error) => {
      alert(`Erro ao atualizar safra: ${error.message}`);
    },
  });

  // Mutation para deletar safra
  const deleteMutation = useMutation({
    mutationFn: deleteHarvestYear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["harvest_years"] });
      queryClient.invalidateQueries({ queryKey: ["harvest_cycles"] });
    },
    onError: (error: Error) => {
      alert(`Erro ao deletar safra: ${error.message}`);
    },
  });

  const form = useForm<HarvestYearFormValues>({
    resolver: zodResolver(harvestYearSchema),
    defaultValues: {
      name: "",
      start_date: "",
      end_date: "",
      cycles: DEFAULT_CYCLES,
    },
  });

  const { fields: cycleFields, append: appendCycle, remove: removeCycle } = useFieldArray({
    control: form.control,
    // @ts-ignore - TypeScript inference issue with react-hook-form
    name: "cycles",
  });

  const onSubmit = (data: HarvestYearFormValues) => {
    if (editingHarvestYear) {
      updateMutation.mutate({ id: editingHarvestYear.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = async (harvestYear: HarvestYear) => {
    setEditingHarvestYear(harvestYear);
    const cycles = await fetchHarvestCycles(harvestYear.id);
    const cycleNames = cycles.map((c) => c.name);
    
    form.reset({
      name: harvestYear.name,
      start_date: formatDateForInput(harvestYear.start_date),
      end_date: formatDateForInput(harvestYear.end_date),
      cycles: cycleNames.length > 0 ? cycleNames : DEFAULT_CYCLES,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta safra? Todos os ciclos associados também serão deletados.")) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingHarvestYear(null);
      form.reset({
        name: "",
        start_date: "",
        end_date: "",
        cycles: DEFAULT_CYCLES,
      });
      setShowCustomInput(false);
      setCustomCycleInput("");
    }
  };

  const handleAddCustomCycle = () => {
    if (customCycleInput.trim()) {
      const trimmed = customCycleInput.trim();
      const currentCycles = form.getValues("cycles");
      if (!currentCycles.includes(trimmed)) {
        appendCycle(trimmed);
        setCustomCycleInput("");
        setShowCustomInput(false);
      } else {
        alert("Este ciclo já foi adicionado");
      }
    }
  };

  const toggleDefaultCycle = (cycleName: string, checked: boolean) => {
    const currentCycles = form.getValues("cycles");
    if (checked) {
      if (!currentCycles.includes(cycleName)) {
        appendCycle(cycleName);
      }
    } else {
      const index = currentCycles.indexOf(cycleName);
      if (index > -1) {
        removeCycle(index);
      }
    }
  };

  // Função para formatar período
  const formatPeriod = (harvestYear: HarvestYear) => {
    const start = formatDate(harvestYear.start_date);
    const end = formatDate(harvestYear.end_date);
    return `${start} até ${end}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ano Safra</h1>
          <p className="text-muted-foreground">
            Gerencie os anos safra cadastrados
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Safra
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingHarvestYear ? "Editar Safra" : "Nova Safra"}
              </DialogTitle>
              <DialogDescription>
                {editingHarvestYear
                  ? "Atualize as informações da safra"
                  : "Preencha os dados para cadastrar uma nova safra"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Safra</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 2024/2025" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Início</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="end_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Fim</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        A data de fim deve ser posterior à data de início
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4 border-t pt-4">
                  <div>
                    <FormLabel className="text-base font-semibold">
                      Quais safras farão parte deste ano?
                    </FormLabel>
                    <FormDescription className="mt-1">
                      Selecione os ciclos padrão ou adicione ciclos personalizados
                    </FormDescription>
                  </div>

                  <div className="space-y-2">
                    {DEFAULT_CYCLES.map((cycleName) => {
                      const isChecked = form.watch("cycles").includes(cycleName);
                      return (
                        <div key={cycleName} className="flex items-center space-x-2">
                          <Checkbox
                            id={cycleName}
                            checked={isChecked}
                            onCheckedChange={(checked) =>
                              toggleDefaultCycle(cycleName, checked as boolean)
                            }
                          />
                          <label
                            htmlFor={cycleName}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {cycleName}
                          </label>
                        </div>
                      );
                    })}
                  </div>

                  {cycleFields.map((field, index) => {
                    const cycleName = form.watch(`cycles.${index}`);
                    const isDefault = DEFAULT_CYCLES.includes(cycleName);
                    if (isDefault) return null;

                    return (
                      <div key={field.id} className="flex items-center gap-2">
                        <Input
                          value={cycleName}
                          readOnly
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCycle(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}

                  {showCustomInput ? (
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Ex: Feijão das Águas"
                        value={customCycleInput}
                        onChange={(e) => setCustomCycleInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCustomCycle();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddCustomCycle}
                      >
                        Adicionar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setShowCustomInput(false);
                          setCustomCycleInput("");
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
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Personalizada
                    </Button>
                  )}

                  <FormField
                    control={form.control}
                    name="cycles"
                    render={() => (
                      <FormItem>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                  >
                    {editingHarvestYear ? "Salvar Alterações" : "Cadastrar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Safras</CardTitle>
          <CardDescription>
            {harvestYears.length} safra(s) cadastrada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fetchError ? (
            <div className="py-8 text-center text-destructive">
              Erro ao carregar safras:{" "}
              {fetchError instanceof Error ? fetchError.message : "Erro desconhecido"}
            </div>
          ) : isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Carregando safras...
            </div>
          ) : harvestYears.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhuma safra cadastrada. Clique em "Nova Safra" para começar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {harvestYears.map((harvestYear) => (
                  <TableRow key={harvestYear.id}>
                    <TableCell className="font-medium">
                      {harvestYear.name}
                    </TableCell>
                    <TableCell>{formatPeriod(harvestYear)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(harvestYear)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(harvestYear.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
