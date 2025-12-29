"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/app-store";
import type { Crop, Culture, Field } from "@/types/schema";

const cropSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  culture_id: z.string().min(1, "Cultura é obrigatória"),
  variety: z.string().optional(),
  cycle: z.string().min(1, "Ciclo é obrigatório"),
  estimated_start_date: z.string().optional(),
  estimated_end_date: z.string().optional(),
  field_ids: z.array(z.string()).min(1, "Selecione pelo menos um talhão"),
});

type CropFormValues = z.infer<typeof cropSchema>;

interface CropWithCount extends Crop {
  field_count: number;
}

async function fetchCrops(harvestYearId: string | null, farmId: string | null): Promise<CropWithCount[]> {
  if (!harvestYearId) return [];

  let query = supabase
    .from("crops")
    .select(`
      *,
      culture:cultures(*),
      harvest_year:harvest_years(*)
    `)
    .eq("harvest_year_id", harvestYearId);

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar safras: ${error.message}`);
  }

  if (!data) return [];

  // Buscar contagem de talhões vinculados e filtrar por farm_id se necessário
  const cropsWithCount = await Promise.all(
    data.map(async (crop) => {
      let fieldCropsQuery = supabase
        .from("field_crops")
        .select("field_id, field:fields!inner(farm_id)")
        .eq("crop_id", crop.id);

      if (farmId) {
        fieldCropsQuery = fieldCropsQuery.eq("field.farm_id", farmId);
      }

      const { data: fieldCrops } = await fieldCropsQuery;
      return {
        ...crop,
        field_count: fieldCrops?.length || 0,
      } as CropWithCount;
    })
  );

  // Filtrar apenas crops que têm talhões da fazenda selecionada
  if (farmId) {
    return cropsWithCount.filter((crop) => crop.field_count > 0);
  }

  return cropsWithCount;
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

async function fetchFields(farmId: string | null): Promise<Field[]> {
  if (!farmId) return [];

  const { data, error } = await supabase
    .from("fields")
    .select("*")
    .eq("farm_id", farmId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar talhões: ${error.message}`);
  }

  return data || [];
}

async function createCropWithFieldCrops(
  data: CropFormValues & { harvest_year_id: string }
): Promise<void> {
  // 1. Criar crop
  const { data: newCrop, error: cropError } = await supabase
    .from("crops")
    .insert({
      harvest_year_id: data.harvest_year_id,
      name: data.name,
      culture_id: data.culture_id,
      variety: data.variety || null,
      cycle: data.cycle,
      estimated_start_date: data.estimated_start_date || null,
      estimated_end_date: data.estimated_end_date || null,
    } as any)
    .select()
    .single();

  if (cropError || !newCrop) {
    throw new Error(`Erro ao criar safra: ${cropError?.message || "Erro desconhecido"}`);
  }

  // 2. Criar field_crops para cada talhão selecionado
  const fieldCropsData = data.field_ids.map((fieldId) => ({
    field_id: fieldId,
    crop_id: newCrop.id,
    status: "PLANNED" as const,
    date_planted: null,
    date_harvest_prediction: data.estimated_end_date || null,
  }));

  const { error: fieldCropsError } = await supabase
    .from("field_crops")
    .insert(fieldCropsData as any);

  if (fieldCropsError) {
    // Rollback: deletar crop criado
    await supabase.from("crops").delete().eq("id", newCrop.id);
    throw new Error(`Erro ao vincular talhões: ${fieldCropsError.message}`);
  }
}

export default function SafrasPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { selectedFarmId, selectedHarvestYearId } = useAppStore();

  const { data: crops = [], isLoading } = useQuery({
    queryKey: ["crops", selectedHarvestYearId, selectedFarmId],
    queryFn: () => fetchCrops(selectedHarvestYearId, selectedFarmId),
    enabled: !!selectedHarvestYearId,
  });

  const { data: cultures = [] } = useQuery({
    queryKey: ["cultures"],
    queryFn: fetchCultures,
  });

  const { data: fields = [] } = useQuery({
    queryKey: ["fields", selectedFarmId],
    queryFn: () => fetchFields(selectedFarmId),
    enabled: !!selectedFarmId,
  });

  const createMutation = useMutation({
    mutationFn: createCropWithFieldCrops,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crops"] });
      queryClient.invalidateQueries({ queryKey: ["field_crops"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      alert(`Erro ao criar safra: ${error.message}`);
    },
  });

  const form = useForm<CropFormValues>({
    resolver: zodResolver(cropSchema),
    defaultValues: {
      name: "",
      culture_id: "",
      variety: "",
      cycle: "",
      estimated_start_date: "",
      estimated_end_date: "",
      field_ids: [],
    },
  });

  const selectedFieldIds = form.watch("field_ids");
  const allFieldsSelected = fields.length > 0 && selectedFieldIds.length === fields.length;

  const handleSelectAll = () => {
    if (allFieldsSelected) {
      form.setValue("field_ids", []);
    } else {
      form.setValue("field_ids", fields.map((f) => f.id));
    }
  };

  const onSubmit = (data: CropFormValues) => {
    if (!selectedHarvestYearId) {
      alert("Selecione um Ano Safra no header antes de criar uma safra.");
      return;
    }

    if (!selectedFarmId) {
      alert("Selecione uma Fazenda no header antes de criar uma safra.");
      return;
    }

    createMutation.mutate({
      ...data,
      harvest_year_id: selectedHarvestYearId,
    });
  };

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      form.reset();
    }
  };

  if (!selectedHarvestYearId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Safras</h1>
          <p className="text-muted-foreground">
            Selecione um ano safra no header para visualizar as safras
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Safras</h1>
          <p className="text-muted-foreground">
            Gerencie o planejamento de safras do ano safra atual
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button disabled={!selectedFarmId || !selectedHarvestYearId}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Safra
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Safra</DialogTitle>
              <DialogDescription>
                Crie uma nova safra e vincule aos talhões da fazenda atual
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
                        <Input placeholder="Ex: Soja 01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="culture_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cultura</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a cultura" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {cultures.map((culture) => (
                            <SelectItem key={culture.id} value={culture.id}>
                              {culture.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="variety"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Variedade (Opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Intacta RR2 PRO" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cycle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ciclo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o ciclo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Verão">Verão</SelectItem>
                          <SelectItem value="Inverno">Inverno</SelectItem>
                          <SelectItem value="Safrinha">Safrinha</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="estimated_start_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Início Janela Ideal</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="estimated_end_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fim Janela Ideal</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">Vínculo em Lote</h4>
                      <p className="text-xs text-muted-foreground">
                        Selecione os talhões da fazenda atual
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                      disabled={fields.length === 0}
                    >
                      {allFieldsSelected ? "Desselecionar Todos" : "Selecionar Todos"}
                    </Button>
                  </div>

                  {fields.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum talhão cadastrado para esta fazenda
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-4">
                      {fields.map((field) => (
                        <FormField
                          key={field.id}
                          control={form.control}
                          name="field_ids"
                          render={() => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={selectedFieldIds.includes(field.id)}
                                  onCheckedChange={(checked) => {
                                    const currentIds = form.getValues("field_ids");
                                    if (checked) {
                                      form.setValue("field_ids", [...currentIds, field.id]);
                                    } else {
                                      form.setValue(
                                        "field_ids",
                                        currentIds.filter((id) => id !== field.id)
                                      );
                                    }
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal cursor-pointer">
                                {field.name}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    Cadastrar
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
            {crops.length} safra(s) planejada(s) para o ano safra atual
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Carregando safras...
            </div>
          ) : crops.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhuma safra cadastrada. Clique em "Nova Safra" para começar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cultura</TableHead>
                  <TableHead>Ciclo</TableHead>
                  <TableHead>Qtd. Talhões Vinculados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {crops.map((crop) => {
                  const culture = crop.culture as Culture | undefined;
                  return (
                    <TableRow key={crop.id}>
                      <TableCell className="font-medium">{crop.name}</TableCell>
                      <TableCell>{culture?.name || "-"}</TableCell>
                      <TableCell>{crop.cycle}</TableCell>
                      <TableCell>{crop.field_count}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
