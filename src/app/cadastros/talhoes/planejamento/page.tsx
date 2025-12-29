"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Field, FieldCrop, Culture, Crop } from "@/types/schema";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/app-store";

const fieldCropSchema = z.object({
  crop_id: z.string().min(1, "Safra é obrigatória"),
});

const planningSchema = z.object({
  field_id: z.string().min(1, "Talhão é obrigatório"),
  crops: z.array(fieldCropSchema).min(1, "Adicione pelo menos uma safra"),
});

type PlanningFormValues = z.infer<typeof planningSchema>;

interface CreateFieldCropInput {
  field_id: string;
  crop_id: string;
}

async function fetchFields(farmId: string | null): Promise<Field[]> {
  let query = supabase.from("fields").select("*");

  if (farmId) {
    query = query.eq("farm_id", farmId);
  }

  const { data, error } = await query.order("name", { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar talhões: ${error.message}`);
  }

  return data || [];
}

async function fetchCrops(harvestYearId: string | null, farmId: string | null): Promise<Crop[]> {
  if (!harvestYearId) return [];

  let query = supabase
    .from("crops")
    .select(`
      *,
      culture:cultures(*)
    `)
    .eq("harvest_year_id", harvestYearId);

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar safras: ${error.message}`);
  }

  if (!data) return [];

  // Se há farmId, filtrar apenas crops que têm field_crops em talhões dessa fazenda
  if (farmId) {
    const cropsWithFields = await Promise.all(
      data.map(async (crop) => {
        const { data: fieldCrops } = await supabase
          .from("field_crops")
          .select("field:fields!inner(farm_id)")
          .eq("crop_id", crop.id)
          .eq("field.farm_id", farmId);
        
        if (fieldCrops && fieldCrops.length > 0) {
          return crop;
        }
        return null;
      })
    );
    
    return cropsWithFields.filter((c): c is Crop => c !== null);
  }

  return data as Crop[];
}

async function fetchFieldCrops(harvestYearId: string | null, farmId: string | null): Promise<FieldCrop[]> {
  if (!harvestYearId) return [];

  // Buscar crops do ano safra
  const { data: crops } = await supabase
    .from("crops")
    .select("id")
    .eq("harvest_year_id", harvestYearId);

  if (!crops || crops.length === 0) {
    return [];
  }

  const cropIds = crops.map((c) => c.id);

  let query = supabase
    .from("field_crops")
    .select(`
      *,
      field:fields(*),
      crop:crops(
        *,
        culture:cultures(*)
      )
    `)
    .in("crop_id", cropIds);

  if (farmId) {
    query = query.eq("field.farm_id", farmId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao buscar planejamento: ${error.message}`);
  }

  return data || [];
}

async function createFieldCrop(data: CreateFieldCropInput): Promise<FieldCrop> {
  const { data: newCrop, error } = await supabase
    .from("field_crops")
    .insert({
      field_id: data.field_id,
      crop_id: data.crop_id,
      status: "PLANNED",
      date_planted: null,
      date_harvest_prediction: null,
    } as any)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar planejamento: ${error.message}`);
  }

  if (!newCrop) {
    throw new Error("Planejamento não foi criado");
  }

  return newCrop as FieldCrop;
}

async function deleteFieldCrop(id: string): Promise<void> {
  const { error } = await supabase.from("field_crops").delete().eq("id", id);

  if (error) {
    throw new Error(`Erro ao deletar planejamento: ${error.message}`);
  }
}

export default function PlanejamentoPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { selectedFarmId, selectedHarvestYearId } = useAppStore();

  const { data: fields = [] } = useQuery({
    queryKey: ["fields", selectedFarmId],
    queryFn: () => fetchFields(selectedFarmId),
    enabled: !!selectedFarmId,
  });

  const { data: crops = [] } = useQuery({
    queryKey: ["crops", selectedHarvestYearId, selectedFarmId],
    queryFn: () => fetchCrops(selectedHarvestYearId, selectedFarmId),
    enabled: !!selectedHarvestYearId,
  });

  const { data: fieldCrops = [], isLoading } = useQuery({
    queryKey: ["field_crops", selectedHarvestYearId, selectedFarmId],
    queryFn: () => fetchFieldCrops(selectedHarvestYearId, selectedFarmId),
    enabled: !!selectedHarvestYearId,
  });

  const createMutation = useMutation({
    mutationFn: createFieldCrop,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["field_crops"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      alert(`Erro ao criar planejamento: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFieldCrop,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["field_crops"] });
    },
    onError: (error: Error) => {
      alert(`Erro ao deletar planejamento: ${error.message}`);
    },
  });

  const form = useForm<PlanningFormValues>({
    resolver: zodResolver(planningSchema),
    defaultValues: {
      field_id: "",
      crops: [],
    },
  });

  const { fields: cropFields, append: appendCrop, remove: removeCrop } = useFieldArray({
    control: form.control,
    name: "crops",
  });

  const onSubmit = (data: PlanningFormValues) => {
    if (!selectedHarvestYearId) {
      alert("Selecione um ano safra no header");
      return;
    }

    if (crops.length === 0) {
      alert("Não há safras cadastradas para este ano safra. Cadastre safras primeiro na página de Safras.");
      return;
    }

    // Criar cada field_crop vinculando o talhão à safra
    data.crops.forEach((crop) => {
      createMutation.mutate({
        field_id: data.field_id,
        crop_id: crop.crop_id,
      });
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja remover este planejamento?")) {
      deleteMutation.mutate(id);
    }
  };

  // Agrupar por talhão
  const groupedByField = fieldCrops.reduce((acc, crop) => {
    const field = crop.field as Field | undefined;
    const fieldId = field?.id || "unknown";
    if (!acc[fieldId]) {
      acc[fieldId] = { field, crops: [] };
    }
    acc[fieldId].crops.push(crop);
    return acc;
  }, {} as Record<string, { field?: Field; crops: FieldCrop[] }>);

  if (!selectedHarvestYearId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Planejamento de Safra</h1>
          <p className="text-muted-foreground">
            Selecione um ano safra no header para visualizar o planejamento
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Planejamento de Safra</h1>
          <p className="text-muted-foreground">
            Gerencie o planejamento de culturas por talhão
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Planejamento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Planejamento</DialogTitle>
              <DialogDescription>
                Vincule safras cadastradas a um talhão
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="field_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Talhão</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o talhão" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {fields.map((field) => (
                            <SelectItem key={field.id} value={field.id}>
                              {field.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">Safras Planejadas</h4>
                      <p className="text-xs text-muted-foreground">
                        Vincule safras cadastradas a este talhão
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (crops.length > 0) {
                          appendCrop({ crop_id: "" });
                        } else {
                          alert("Não há safras cadastradas para este ano safra. Cadastre safras primeiro na página de Safras.");
                        }
                      }}
                      disabled={crops.length === 0}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Safra
                    </Button>
                  </div>

                  {cropFields.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma safra adicionada
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {cropFields.map((field, index) => (
                        <div key={field.id} className="flex gap-2 items-end">
                          <FormField
                            control={form.control}
                            name={`crops.${index}.crop_id`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Safra</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione a safra" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {crops.map((crop) => {
                                      const culture = crop.culture as Culture | undefined;
                                      return (
                                        <SelectItem key={crop.id} value={crop.id}>
                                          {crop.name} - {culture?.name || "Cultura"} ({crop.cycle})
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeCrop(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
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
          <CardTitle>Planejamento por Talhão</CardTitle>
          <CardDescription>
            Culturas planejadas para a safra selecionada
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Carregando planejamento...
            </div>
          ) : Object.keys(groupedByField).length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhum planejamento cadastrado. Clique em "Novo Planejamento" para começar.
            </div>
          ) : (
            <div className="space-y-4">
              {Object.values(groupedByField).map(({ field, crops }) => (
                <div key={field?.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{field?.name || "Talhão desconhecido"}</h3>
                    <div className="flex gap-2 flex-wrap">
                      {crops.map((fieldCrop) => {
                        const crop = fieldCrop.crop as any;
                        const culture = crop?.culture as Culture | undefined;
                        const cycle = crop?.cycle || "";
                        return (
                          <Badge key={fieldCrop.id} variant="secondary" className="gap-1">
                            {crop?.name || "Safra"} - {culture?.name || "Cultura"} ({cycle})
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 ml-1"
                              onClick={() => handleDelete(fieldCrop.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
