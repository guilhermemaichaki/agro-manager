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
import type { Field, FieldCrop, Culture, CropYear } from "@/types/schema";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/app-store";

const fieldCropSchema = z.object({
  culture_id: z.string().min(1, "Cultura é obrigatória"),
  cycle: z.enum(["Verão", "Safrinha", "Inverno", "Único"]),
});

const planningSchema = z.object({
  field_id: z.string().min(1, "Talhão é obrigatório"),
  crops: z.array(fieldCropSchema).min(1, "Adicione pelo menos uma cultura"),
});

type PlanningFormValues = z.infer<typeof planningSchema>;

interface CreateFieldCropInput {
  field_id: string;
  crop_year_id: string;
  culture_id: string;
  cycle: string;
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

async function fetchFieldCrops(fieldId: string, cropYearId: string): Promise<FieldCrop[]> {
  const { data, error } = await supabase
    .from("field_crops")
    .select(`
      *,
      culture:cultures(*)
    `)
    .eq("field_id", fieldId)
    .eq("crop_year_id", cropYearId);

  if (error) {
    throw new Error(`Erro ao buscar planejamento: ${error.message}`);
  }

  return data || [];
}

async function fetchAllFieldCrops(cropYearId: string, farmId: string | null): Promise<FieldCrop[]> {
  let query = supabase
    .from("field_crops")
    .select(`
      *,
      field:fields(*),
      culture:cultures(*)
    `)
    .eq("crop_year_id", cropYearId);

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
      crop_year_id: data.crop_year_id,
      culture_id: data.culture_id,
      cycle: data.cycle,
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
  const { selectedFarmId, selectedCropYearId } = useAppStore();

  const { data: fields = [] } = useQuery({
    queryKey: ["fields", selectedFarmId],
    queryFn: () => fetchFields(selectedFarmId),
    enabled: !!selectedFarmId,
  });

  const { data: cultures = [] } = useQuery({
    queryKey: ["cultures"],
    queryFn: fetchCultures,
  });

  const { data: fieldCrops = [], isLoading } = useQuery({
    queryKey: ["field_crops", selectedCropYearId, selectedFarmId],
    queryFn: () => fetchAllFieldCrops(selectedCropYearId!, selectedFarmId),
    enabled: !!selectedCropYearId,
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
    if (!selectedCropYearId) {
      alert("Selecione uma safra no header");
      return;
    }

    // Criar cada cultura planejada
    data.crops.forEach((crop) => {
      createMutation.mutate({
        field_id: data.field_id,
        crop_year_id: selectedCropYearId,
        culture_id: crop.culture_id,
        cycle: crop.cycle,
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

  if (!selectedCropYearId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Planejamento de Safra</h1>
          <p className="text-muted-foreground">
            Selecione uma safra no header para visualizar o planejamento
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
                Adicione culturas planejadas para um talhão
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
                      <h4 className="text-sm font-medium">Culturas Planejadas</h4>
                      <p className="text-xs text-muted-foreground">
                        Adicione as culturas e ciclos planejados
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => appendCrop({ culture_id: "", cycle: "Verão" })}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Cultura
                    </Button>
                  </div>

                  {cropFields.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma cultura adicionada
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {cropFields.map((field, index) => (
                        <div key={field.id} className="flex gap-2 items-end">
                          <FormField
                            control={form.control}
                            name={`crops.${index}.culture_id`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Cultura</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione" />
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
                            name={`crops.${index}.cycle`}
                            render={({ field }) => (
                              <FormItem className="w-40">
                                <FormLabel>Ciclo</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="Verão">Verão</SelectItem>
                                    <SelectItem value="Safrinha">Safrinha</SelectItem>
                                    <SelectItem value="Inverno">Inverno</SelectItem>
                                    <SelectItem value="Único">Único</SelectItem>
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
                    <div className="flex gap-2">
                      {crops.map((crop) => {
                        const culture = crop.culture as Culture | undefined;
                        return (
                          <Badge key={crop.id} variant="secondary" className="gap-1">
                            {culture?.name || "Cultura"} ({crop.cycle})
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 ml-1"
                              onClick={() => handleDelete(crop.id)}
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

