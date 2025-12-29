"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Farm, HarvestYear } from "@/types/schema";
import { supabase } from "@/lib/supabase";
import { FarmCard } from "@/components/farm-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Schema para fazenda
const farmSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
});

type FarmFormValues = z.infer<typeof farmSchema>;

// Schema para ano safra (sem ciclos)
const harvestYearSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  start_date: z.string().min(1, "Data de início é obrigatória"),
  end_date: z.string().min(1, "Data de fim é obrigatória"),
}).refine((data) => {
  const start = new Date(data.start_date);
  const end = new Date(data.end_date);
  return end >= start;
}, {
  message: "Data de fim deve ser posterior à data de início",
  path: ["end_date"],
});

type HarvestYearFormValues = z.infer<typeof harvestYearSchema>;

interface CreateFarmInput {
  name: string;
  description?: string;
}

interface UpdateFarmInput extends Partial<CreateFarmInput> {
  id: string;
}

interface CreateHarvestYearInput {
  farm_id: string;
  name: string;
  start_date: string;
  end_date: string;
}

interface UpdateHarvestYearInput {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

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

async function fetchHarvestYears(farmId: string): Promise<HarvestYear[]> {
  const { data, error } = await supabase
    .from("harvest_years")
    .select("*")
    .eq("farm_id", farmId)
    .order("start_date", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar anos safra: ${error.message}`);
  }

  return data || [];
}

async function createFarm(data: CreateFarmInput): Promise<Farm> {
  const { data: newFarm, error } = await supabase
    .from("farms")
    .insert({
      name: data.name,
      description: data.description || null,
    } as any)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar fazenda: ${error.message}`);
  }

  if (!newFarm) {
    throw new Error("Fazenda não foi criada");
  }

  return newFarm as Farm;
}

async function updateFarm(data: UpdateFarmInput): Promise<Farm> {
  const { id, ...updateData } = data;

  const updatePayload: Record<string, any> = {};
  if (updateData.name !== undefined) updatePayload.name = updateData.name;
  if (updateData.description !== undefined) updatePayload.description = updateData.description || null;
  updatePayload.updated_at = new Date().toISOString();

  const { data: updatedFarm, error } = await supabase
    .from("farms")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar fazenda: ${error.message}`);
  }

  if (!updatedFarm) {
    throw new Error("Fazenda não foi atualizada");
  }

  return updatedFarm as Farm;
}

async function deleteFarm(id: string): Promise<void> {
  const { error } = await supabase.from("farms").delete().eq("id", id);

  if (error) {
    throw new Error(`Erro ao deletar fazenda: ${error.message}`);
  }
}

async function createHarvestYear(data: CreateHarvestYearInput): Promise<HarvestYear> {
  const { data: newHarvestYear, error } = await supabase
    .from("harvest_years")
    .insert({
      farm_id: data.farm_id,
      name: data.name,
      start_date: data.start_date,
      end_date: data.end_date,
    } as any)
    .select()
    .single();

  if (error || !newHarvestYear) {
    throw new Error(`Erro ao criar ano safra: ${error?.message || "Ano safra não foi criado"}`);
  }

  return newHarvestYear as HarvestYear;
}

async function updateHarvestYear(data: UpdateHarvestYearInput): Promise<HarvestYear> {
  const { id, ...updateData } = data;

  const { data: updatedHarvestYear, error } = await supabase
    .from("harvest_years")
    .update(updateData as any)
    .eq("id", id)
    .select()
    .single();

  if (error || !updatedHarvestYear) {
    throw new Error(`Erro ao atualizar ano safra: ${error?.message || "Ano safra não foi atualizado"}`);
  }

  return updatedHarvestYear as HarvestYear;
}

async function deleteHarvestYear(id: string): Promise<void> {
  const { error } = await supabase.from("harvest_years").delete().eq("id", id);

  if (error) {
    throw new Error(`Erro ao deletar ano safra: ${error.message}`);
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateForInput(dateString: string): string {
  const date = new Date(dateString);
  return date.toISOString().split("T")[0];
}

export default function FazendasPage() {
  const [isFarmDialogOpen, setIsFarmDialogOpen] = useState(false);
  const [isAnoSafraDialogOpen, setIsAnoSafraDialogOpen] = useState(false);
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
  const [editingHarvestYear, setEditingHarvestYear] = useState<HarvestYear | null>(null);
  const [selectedFarmForAnoSafra, setSelectedFarmForAnoSafra] = useState<Farm | null>(null);
  const queryClient = useQueryClient();

  const { data: farms = [], isLoading, error: fetchError } = useQuery({
    queryKey: ["farms"],
    queryFn: fetchFarms,
  });

  const { data: harvestYears = [] } = useQuery({
    queryKey: ["harvest_years", selectedFarmForAnoSafra?.id],
    queryFn: () => selectedFarmForAnoSafra ? fetchHarvestYears(selectedFarmForAnoSafra.id) : Promise.resolve([]),
    enabled: !!selectedFarmForAnoSafra && isAnoSafraDialogOpen,
  });

  const farmForm = useForm<FarmFormValues>({
    resolver: zodResolver(farmSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const harvestYearForm = useForm<HarvestYearFormValues>({
    resolver: zodResolver(harvestYearSchema),
    defaultValues: {
      name: "",
      start_date: "",
      end_date: "",
    },
  });

  const createFarmMutation = useMutation({
    mutationFn: createFarm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farms"] });
      setIsFarmDialogOpen(false);
      farmForm.reset();
    },
    onError: (error: Error) => {
      alert(`Erro ao criar fazenda: ${error.message}`);
    },
  });

  const updateFarmMutation = useMutation({
    mutationFn: updateFarm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farms"] });
      setIsFarmDialogOpen(false);
      setEditingFarm(null);
      farmForm.reset();
    },
    onError: (error: Error) => {
      alert(`Erro ao atualizar fazenda: ${error.message}`);
    },
  });

  const deleteFarmMutation = useMutation({
    mutationFn: deleteFarm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farms"] });
    },
    onError: (error: Error) => {
      alert(`Erro ao deletar fazenda: ${error.message}`);
    },
  });

  const createHarvestYearMutation = useMutation({
    mutationFn: createHarvestYear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["harvest_years"] });
      harvestYearForm.reset();
    },
    onError: (error: Error) => {
      alert(`Erro ao criar ano safra: ${error.message}`);
    },
  });

  const updateHarvestYearMutation = useMutation({
    mutationFn: updateHarvestYear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["harvest_years"] });
      setIsAnoSafraDialogOpen(false);
      setEditingHarvestYear(null);
      harvestYearForm.reset();
    },
    onError: (error: Error) => {
      alert(`Erro ao atualizar ano safra: ${error.message}`);
    },
  });

  const deleteHarvestYearMutation = useMutation({
    mutationFn: deleteHarvestYear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["harvest_years"] });
    },
    onError: (error: Error) => {
      alert(`Erro ao deletar ano safra: ${error.message}`);
    },
  });

  const onFarmSubmit = (data: FarmFormValues) => {
    if (editingFarm) {
      updateFarmMutation.mutate({ id: editingFarm.id, ...data });
    } else {
      createFarmMutation.mutate(data);
    }
  };

  const onHarvestYearSubmit = (data: HarvestYearFormValues) => {
    if (!selectedFarmForAnoSafra) return;

    if (editingHarvestYear) {
      updateHarvestYearMutation.mutate({ id: editingHarvestYear.id, ...data });
    } else {
      createHarvestYearMutation.mutate({
        farm_id: selectedFarmForAnoSafra.id,
        ...data,
      });
    }
  };

  const handleEditFarm = (farm: Farm) => {
    setEditingFarm(farm);
    farmForm.reset({
      name: farm.name,
      description: farm.description || "",
    });
    setIsFarmDialogOpen(true);
  };

  const handleDeleteFarm = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta fazenda?")) {
      deleteFarmMutation.mutate(id);
    }
  };

  const handleAnoSafraClick = (farm: Farm) => {
    setSelectedFarmForAnoSafra(farm);
    setEditingHarvestYear(null);
    harvestYearForm.reset({
      name: "",
      start_date: "",
      end_date: "",
    });
    setIsAnoSafraDialogOpen(true);
  };

  const handleEditHarvestYear = (harvestYear: HarvestYear) => {
    setEditingHarvestYear(harvestYear);
    harvestYearForm.reset({
      name: harvestYear.name,
      start_date: formatDateForInput(harvestYear.start_date),
      end_date: formatDateForInput(harvestYear.end_date),
    });
  };

  const handleDeleteHarvestYear = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este ano safra?")) {
      deleteHarvestYearMutation.mutate(id);
    }
  };

  const handleFarmDialogClose = (open: boolean) => {
    setIsFarmDialogOpen(open);
    if (!open) {
      setEditingFarm(null);
      farmForm.reset();
    }
  };

  const handleAnoSafraDialogClose = (open: boolean) => {
    setIsAnoSafraDialogOpen(open);
    if (!open) {
      setEditingHarvestYear(null);
      setSelectedFarmForAnoSafra(null);
      harvestYearForm.reset();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fazendas</h1>
          <p className="text-muted-foreground">Gerencie as fazendas e seus anos safra</p>
        </div>
        <Dialog open={isFarmDialogOpen} onOpenChange={handleFarmDialogClose}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Fazenda
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingFarm ? "Editar Fazenda" : "Nova Fazenda"}
              </DialogTitle>
              <DialogDescription>
                {editingFarm
                  ? "Atualize as informações da fazenda"
                  : "Preencha os dados para cadastrar uma nova fazenda"}
              </DialogDescription>
            </DialogHeader>
            <Form {...farmForm}>
              <form onSubmit={farmForm.handleSubmit(onFarmSubmit)} className="space-y-4">
                <FormField
                  control={farmForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Fazenda</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Fazenda São João" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={farmForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição (Opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descrição da fazenda..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleFarmDialogClose(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createFarmMutation.isPending || updateFarmMutation.isPending}
                  >
                    {editingFarm ? "Salvar Alterações" : "Cadastrar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Modal de Ano Safra */}
      <Dialog open={isAnoSafraDialogOpen} onOpenChange={handleAnoSafraDialogClose}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Anos Safra - {selectedFarmForAnoSafra?.name}
            </DialogTitle>
            <DialogDescription>
              Gerencie os anos safra desta fazenda
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Form {...harvestYearForm}>
              <form onSubmit={harvestYearForm.handleSubmit(onHarvestYearSubmit)} className="space-y-4 border-b pb-4">
                <FormField
                  control={harvestYearForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Ano Safra</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 2024/2025" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={harvestYearForm.control}
                    name="start_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Início</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={harvestYearForm.control}
                    name="end_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Fim</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={createHarvestYearMutation.isPending || updateHarvestYearMutation.isPending}
                >
                  {editingHarvestYear ? "Salvar Alterações" : "Adicionar Ano Safra"}
                </Button>
              </form>
            </Form>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Anos Safra Cadastrados</h3>
              {harvestYears.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  Nenhum ano safra cadastrado para esta fazenda
                </p>
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
                        <TableCell>
                          {formatDate(harvestYear.start_date)} até {formatDate(harvestYear.end_date)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditHarvestYear(harvestYear)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteHarvestYear(harvestYear.id)}
                              disabled={deleteHarvestYearMutation.isPending}
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
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Grid de Cards de Fazendas */}
      {fetchError ? (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            Erro ao carregar fazendas:{" "}
            {fetchError instanceof Error ? fetchError.message : "Erro desconhecido"}
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="py-8 text-center text-muted-foreground">
          Carregando fazendas...
        </div>
      ) : farms.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhuma fazenda cadastrada. Clique em "Nova Fazenda" para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {farms.map((farm) => (
            <FarmCard
              key={farm.id}
              farm={farm}
              onAnoSafraClick={() => handleAnoSafraClick(farm)}
              onEditClick={() => handleEditFarm(farm)}
              onDeleteClick={() => handleDeleteFarm(farm.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
