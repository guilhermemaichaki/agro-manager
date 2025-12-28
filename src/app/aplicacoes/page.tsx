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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type {
  Application,
  ApplicationProduct,
  Product,
  Field,
  HarvestYear,
  ApplicationStatus,
  FieldCrop,
  SubField,
  Culture,
  HarvestCycle,
} from "@/types/schema";
import { supabase } from "@/lib/supabase";
import { Checkbox } from "@/components/ui/checkbox";

// Schema de validação para produto da aplicação
const applicationProductSchema = z.object({
  product_id: z.string().min(1, "Produto é obrigatório"),
  dosage: z.number().positive("Dosagem deve ser maior que zero"),
  dosage_unit: z.enum(["L/ha", "mL/ha", "kg/ha"]),
  quantity_used: z.number().positive("Quantidade deve ser maior que zero"),
});

// Schema de validação para aplicação
const applicationSchema = z.object({
  harvest_year_id: z.string().min(1, "Ano Safra é obrigatório"),
  field_id: z.string().min(1, "Talhão é obrigatório"),
  field_crop_id: z.string().optional(), // Cultura/Ciclo planejado
  is_partial: z.boolean().optional(), // Aplicação parcial
  sub_field_ids: z.array(z.string()).optional(), // Sub-talhões selecionados
  application_date: z.string().min(1, "Data é obrigatória"),
  status: z.enum(["planned", "completed", "cancelled", "PLANNED", "DONE", "CANCELED"]),
  notes: z.string().optional(),
  products: z.array(applicationProductSchema).min(1, "Adicione pelo menos um produto"),
});

type ApplicationFormValues = z.infer<typeof applicationSchema>;

// Tipos para API
interface CreateApplicationInput {
  harvest_year_id: string;
  field_id: string;
  application_date: string;
  status: string;
  notes?: string;
  products: ApplicationProductInput[];
}

interface ApplicationProductInput {
  product_id: string;
  dosage: number;
  dosage_unit: string;
  quantity_used: number;
}

interface UpdateApplicationInput extends Partial<CreateApplicationInput> {
  id: string;
}

// Função para buscar aplicações
async function fetchApplications(): Promise<Application[]> {
  const { data, error } = await supabase
    .from("applications")
    .select(`
      *,
      field:fields(*),
      harvest_year:harvest_years(*),
      application_products:application_products(
        *,
        product:products(*)
      )
    `)
    .order("application_date", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar aplicações: ${error.message}`);
  }

  return data || [];
}

// Função para buscar anos safra
async function fetchHarvestYears(): Promise<HarvestYear[]> {
  const { data, error } = await supabase
    .from("harvest_years")
    .select("*")
    .order("start_date", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar anos safra: ${error.message}`);
  }

  return data || [];
}

// Função para buscar talhões
async function fetchFields(): Promise<Field[]> {
  const { data, error } = await supabase
    .from("fields")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar talhões: ${error.message}`);
  }

  return data || [];
}

// Função para buscar produtos
async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar produtos: ${error.message}`);
  }

  return data || [];
}

// Função para buscar field_crops (culturas planejadas) por talhão e ano safra
async function fetchFieldCrops(fieldId: string, harvestYearId: string): Promise<FieldCrop[]> {
  // Primeiro buscar os ciclos do ano safra
  const { data: cycles, error: cyclesError } = await supabase
    .from("harvest_cycles")
    .select("id")
    .eq("harvest_year_id", harvestYearId);

  if (cyclesError || !cycles || cycles.length === 0) {
    return [];
  }

  const cycleIds = cycles.map((c) => c.id);

  const { data, error } = await supabase
    .from("field_crops")
    .select(`
      *,
      culture:cultures(*),
      harvest_cycle:harvest_cycles(*)
    `)
    .eq("field_id", fieldId)
    .in("harvest_cycle_id", cycleIds);

  if (error) {
    throw new Error(`Erro ao buscar culturas planejadas: ${error.message}`);
  }

  return data || [];
}

// Função para buscar sub-talhões
async function fetchSubFields(fieldId: string): Promise<SubField[]> {
  const { data, error } = await supabase
    .from("sub_fields")
    .select("*")
    .eq("field_id", fieldId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar sub-talhões: ${error.message}`);
  }

  return data || [];
}

// Função para criar aplicação
async function createApplication(data: CreateApplicationInput): Promise<Application> {
  // Normaliza o status para o formato do banco
  let statusValue = data.status;
  if (statusValue === "planned") statusValue = "PLANNED";
  if (statusValue === "completed" || statusValue === "done") statusValue = "DONE";
  if (statusValue === "cancelled" || statusValue === "canceled") statusValue = "CANCELED";

  // 1. Salvar aplicação
  const { data: newApplication, error: appError } = await supabase
    .from("applications")
    .insert({
      harvest_year_id: data.harvest_year_id,
      field_id: data.field_id,
      application_date: data.application_date,
      status: statusValue,
      notes: data.notes || null,
    } as any)
    .select()
    .single();

  if (appError) {
    throw new Error(`Erro ao criar aplicação: ${appError.message}`);
  }

  if (!newApplication) {
    throw new Error("Aplicação não foi criada");
  }

  // 2. Salvar produtos da aplicação
  if (data.products && data.products.length > 0) {
    const applicationProducts = data.products.map((product) => ({
      application_id: newApplication.id,
      product_id: product.product_id,
      dosage: product.dosage,
      quantity_used: product.quantity_used,
    }));

    const { error: productsError } = await supabase
      .from("application_products")
      .insert(applicationProducts as any);

    if (productsError) {
      // Se falhar ao inserir produtos, tenta deletar a aplicação criada
      await supabase.from("applications").delete().eq("id", newApplication.id);
      throw new Error(`Erro ao salvar produtos: ${productsError.message}`);
    }
  }

  // Buscar aplicação completa com relacionamentos
  const { data: fullApplication, error: fetchError } = await supabase
    .from("applications")
    .select(`
      *,
      field:fields(*),
      harvest_year:harvest_years(*),
      application_products:application_products(
        *,
        product:products(*)
      )
    `)
    .eq("id", newApplication.id)
    .single();

  if (fetchError || !fullApplication) {
    return newApplication as Application;
  }

  return fullApplication as Application;
}

// Função para atualizar aplicação
async function updateApplication(data: UpdateApplicationInput): Promise<Application> {
  const { id, products, ...updateData } = data;

  // Normaliza o status se fornecido
  let statusValue = updateData.status;
  if (statusValue) {
    if (statusValue === "planned") statusValue = "PLANNED";
    if (statusValue === "completed" || statusValue === "done") statusValue = "DONE";
    if (statusValue === "cancelled" || statusValue === "canceled") statusValue = "CANCELED";
  }

  const updatePayload: Record<string, any> = {};
  if (updateData.harvest_year_id !== undefined) updatePayload.harvest_year_id = updateData.harvest_year_id;
  if (updateData.field_id !== undefined) updatePayload.field_id = updateData.field_id;
  if (updateData.application_date !== undefined)
    updatePayload.application_date = updateData.application_date;
  if (statusValue !== undefined) updatePayload.status = statusValue;
  if (updateData.notes !== undefined) updatePayload.notes = updateData.notes || null;
  updatePayload.updated_at = new Date().toISOString();

  // 1. Atualizar aplicação
  const { error: appError } = await supabase
    .from("applications")
    .update(updatePayload)
    .eq("id", id);

  if (appError) {
    throw new Error(`Erro ao atualizar aplicação: ${appError.message}`);
  }

  // 2. Se produtos foram fornecidos, atualizar lista de produtos
  if (products && products.length > 0) {
    // Deletar produtos antigos
    await supabase.from("application_products").delete().eq("application_id", id);

    // Inserir novos produtos
    const applicationProducts = products.map((product) => ({
      application_id: id,
      product_id: product.product_id,
      dosage: product.dosage,
      quantity_used: product.quantity_used,
    }));

    const { error: productsError } = await supabase
      .from("application_products")
      .insert(applicationProducts as any);

    if (productsError) {
      throw new Error(`Erro ao atualizar produtos: ${productsError.message}`);
    }
  }

  // Buscar aplicação atualizada
  const { data: updatedApplication, error: fetchError } = await supabase
    .from("applications")
    .select(`
      *,
      field:fields(*),
      harvest_year:harvest_years(*),
      application_products:application_products(
        *,
        product:products(*)
      )
    `)
    .eq("id", id)
    .single();

  if (fetchError || !updatedApplication) {
    throw new Error("Aplicação não foi atualizada");
  }

  return updatedApplication as Application;
}

// Função para deletar aplicação
async function deleteApplication(id: string): Promise<void> {
  // Deletar produtos primeiro (devido à foreign key)
  await supabase.from("application_products").delete().eq("application_id", id);

  // Deletar aplicação
  const { error } = await supabase.from("applications").delete().eq("id", id);

  if (error) {
    throw new Error(`Erro ao deletar aplicação: ${error.message}`);
  }
}

// Função para formatar data
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Função para formatar status
function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    planned: "Planejado",
    PLANNED: "Planejado",
    completed: "Realizado",
    DONE: "Realizado",
    done: "Realizado",
    cancelled: "Cancelado",
    CANCELED: "Cancelado",
    canceled: "Cancelado",
  };
  return statusMap[status] || status;
}

// Função para converter data ISO para formato do input
function formatDateForInput(dateString: string): string {
  const date = new Date(dateString);
  return date.toISOString().split("T")[0];
}

export default function AplicacoesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingApplication, setEditingApplication] = useState<Application | null>(null);
  const queryClient = useQueryClient();

  // Queries
  const { data: applications = [], isLoading, error: fetchError } = useQuery({
    queryKey: ["applications"],
    queryFn: fetchApplications,
  });

  const { data: harvestYears = [] } = useQuery({
    queryKey: ["harvest_years"],
    queryFn: fetchHarvestYears,
  });

  const { data: fields = [] } = useQuery({
    queryKey: ["fields"],
    queryFn: fetchFields,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      alert(`Erro ao criar aplicação: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      setIsDialogOpen(false);
      setEditingApplication(null);
      form.reset();
    },
    onError: (error: Error) => {
      alert(`Erro ao atualizar aplicação: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (error: Error) => {
      alert(`Erro ao deletar aplicação: ${error.message}`);
    },
  });

  const form = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      harvest_year_id: "",
      field_id: "",
      field_crop_id: "",
      is_partial: false,
      sub_field_ids: [],
      application_date: "",
      status: "planned",
      notes: "",
      products: [],
    },
  });

  // Buscar field_crops quando talhão e ano safra forem selecionados
  const selectedFieldId = form.watch("field_id");
  const selectedHarvestYearId = form.watch("harvest_year_id");
  const isPartial = form.watch("is_partial");

  const { data: fieldCrops = [] } = useQuery({
    queryKey: ["field_crops", selectedFieldId, selectedHarvestYearId],
    queryFn: () => fetchFieldCrops(selectedFieldId, selectedHarvestYearId),
    enabled: !!selectedFieldId && !!selectedHarvestYearId,
  });

  const { data: subFields = [] } = useQuery({
    queryKey: ["sub_fields", selectedFieldId],
    queryFn: () => fetchSubFields(selectedFieldId),
    enabled: !!selectedFieldId && !!isPartial,
  });

  const { fields: productFields, append, remove } = useFieldArray({
    control: form.control,
    name: "products",
  });

  const onSubmit = (data: ApplicationFormValues) => {
    if (editingApplication) {
      updateMutation.mutate({ id: editingApplication.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (application: Application) => {
    setEditingApplication(application);
    
    // Normaliza status para o formato do formulário
    let statusValue = application.status as string;
    if (statusValue === "PLANNED") statusValue = "planned";
    if (statusValue === "DONE") statusValue = "completed";
    if (statusValue === "CANCELED") statusValue = "cancelled";

    // Prepara produtos
    const applicationProducts = (application.application_products || []).map((ap) => ({
      product_id: ap.product_id,
      dosage: ap.dosage,
      dosage_unit: "L/ha" as const, // Default, pode ser ajustado se houver no banco
      quantity_used: ap.quantity_used,
    }));

    form.reset({
      harvest_year_id: application.harvest_year_id,
      field_id: application.field_id,
      application_date: formatDateForInput(application.application_date),
      status: statusValue as any,
      notes: application.notes || "",
      products: applicationProducts,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta aplicação?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingApplication(null);
      form.reset();
    }
  };

  const addProduct = () => {
    append({
      product_id: "",
      dosage: 0,
      dosage_unit: "L/ha",
      quantity_used: 0,
    });
  };

  // Função para calcular quantidade total baseada na área do talhão
  const calculateQuantity = (fieldId: string, dosage: number, index: number) => {
    const field = fields.find((f) => f.id === fieldId);
    if (field && dosage > 0) {
      const area = (field as any).area_hct ?? field.area_hectares ?? 0;
      const quantity = dosage * area;
      form.setValue(`products.${index}.quantity_used`, quantity);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Aplicações</h1>
          <p className="text-muted-foreground">
            Gerencie as aplicações de defensivos agrícolas
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Aplicação
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingApplication ? "Editar Aplicação" : "Nova Aplicação"}
              </DialogTitle>
              <DialogDescription>
                {editingApplication
                  ? "Atualize as informações da aplicação"
                  : "Preencha os dados para cadastrar uma nova aplicação"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Cabeçalho */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Informações Gerais</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="harvest_year_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ano Safra</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o ano safra" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {harvestYears.map((harvestYear) => (
                                <SelectItem key={harvestYear.id} value={harvestYear.id}>
                                  {harvestYear.name}
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
                  </div>

                  {/* Cultura/Ciclo Planejado */}
                  {selectedFieldId && selectedHarvestYearId && fieldCrops.length > 0 && (
                    <FormField
                      control={form.control}
                      name="field_crop_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cultura/Ciclo</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a cultura/ciclo planejado" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {fieldCrops.map((fieldCrop) => {
                                const culture = fieldCrop.culture as Culture | undefined;
                                const harvestCycle = fieldCrop.harvest_cycle as HarvestCycle | undefined;
                                return (
                                  <SelectItem key={fieldCrop.id} value={fieldCrop.id}>
                                    {culture?.name || "Cultura"} - {harvestCycle?.name || "Ciclo"}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Aplicação Parcial */}
                  {selectedFieldId && (
                    <FormField
                      control={form.control}
                      name="is_partial"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Aplicação Parcial?</FormLabel>
                            <p className="text-sm text-muted-foreground">
                              Marque se a aplicação será apenas em sub-talhões específicos
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Sub-talhões (aparece apenas se aplicação parcial estiver marcada) */}
                  {isPartial && subFields.length > 0 && (
                    <FormField
                      control={form.control}
                      name="sub_field_ids"
                      render={() => (
                        <FormItem>
                          <div className="mb-4">
                            <FormLabel className="text-base">Sub-talhões</FormLabel>
                            <p className="text-sm text-muted-foreground">
                              Selecione os sub-talhões onde a aplicação será realizada
                            </p>
                          </div>
                          {subFields.map((subField) => (
                            <FormField
                              key={subField.id}
                              control={form.control}
                              name="sub_field_ids"
                              render={({ field }) => {
                                return (
                                  <FormItem
                                    key={subField.id}
                                    className="flex flex-row items-start space-x-3 space-y-0"
                                  >
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(subField.id)}
                                        onCheckedChange={(checked) => {
                                          return checked
                                            ? field.onChange([...(field.value || []), subField.id])
                                            : field.onChange(
                                                field.value?.filter((value) => value !== subField.id)
                                              );
                                        }}
                                      />
                                    </FormControl>
                                    <FormLabel className="font-normal">
                                      {subField.name} ({subField.area_hectares.toFixed(1)} ha)
                                    </FormLabel>
                                  </FormItem>
                                );
                              }}
                            />
                          ))}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="application_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data Planejada</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="planned">Planejado</SelectItem>
                              <SelectItem value="completed">Realizado</SelectItem>
                              <SelectItem value="cancelled">Cancelado</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Observações sobre a aplicação..."
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Lista de Produtos */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Produtos</h3>
                    <Button type="button" variant="outline" onClick={addProduct}>
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Produto
                    </Button>
                  </div>

                  {productFields.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg">
                      Nenhum produto adicionado. Clique em "Adicionar Produto" para começar.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {productFields.map((field, index) => (
                        <Card key={field.id}>
                          <CardContent className="pt-6">
                            <div className="grid grid-cols-12 gap-4 items-end">
                              <FormField
                                control={form.control}
                                name={`products.${index}.product_id`}
                                render={({ field }) => (
                                  <FormItem className="col-span-4">
                                    <FormLabel>Produto</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {products.map((product) => (
                                          <SelectItem key={product.id} value={product.id}>
                                            {product.name}
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
                                name={`products.${index}.dosage`}
                                render={({ field }) => (
                                  <FormItem className="col-span-2">
                                    <FormLabel>Dosagem</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.5"
                                        value={field.value || ""}
                                        onChange={(e) => {
                                          const value = parseFloat(e.target.value);
                                          field.onChange(isNaN(value) ? 0 : value);
                                          // Calcula quantidade automaticamente
                                          const fieldId = form.watch("field_id");
                                          if (fieldId && value > 0) {
                                            calculateQuantity(fieldId, value, index);
                                          }
                                        }}
                                        onBlur={field.onBlur}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`products.${index}.dosage_unit`}
                                render={({ field }) => (
                                  <FormItem className="col-span-2">
                                    <FormLabel>Unidade</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="L/ha">L/ha</SelectItem>
                                        <SelectItem value="mL/ha">mL/ha</SelectItem>
                                        <SelectItem value="kg/ha">kg/ha</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`products.${index}.quantity_used`}
                                render={({ field }) => (
                                  <FormItem className="col-span-3">
                                    <FormLabel>Quantidade Total</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={field.value || ""}
                                        onChange={(e) => {
                                          const value = parseFloat(e.target.value);
                                          field.onChange(isNaN(value) ? 0 : value);
                                        }}
                                        onBlur={field.onBlur}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <div className="col-span-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => remove(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
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
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingApplication ? "Salvar Alterações" : "Cadastrar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Aplicações</CardTitle>
          <CardDescription>
            {applications.length} aplicação(ões) cadastrada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fetchError ? (
            <div className="py-8 text-center text-destructive">
              Erro ao carregar aplicações:{" "}
              {fetchError instanceof Error ? fetchError.message : "Erro desconhecido"}
            </div>
          ) : isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Carregando aplicações...
            </div>
          ) : applications.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhuma aplicação cadastrada. Clique em "Nova Aplicação" para começar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Talhão</TableHead>
                  <TableHead>Safra</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((application) => {
                  const field = application.field as Field | undefined;
                  const harvestYear = application.harvest_year as HarvestYear | undefined;
                  return (
                    <TableRow key={application.id}>
                      <TableCell>{formatDate(application.application_date)}</TableCell>
                      <TableCell className="font-medium">
                        {field?.name || "Talhão não encontrado"}
                      </TableCell>
                      <TableCell>{harvestYear?.name || "Ano Safra não encontrado"}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            (application.status as string) === "PLANNED" ||
                            (application.status as string) === "planned"
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                              : (application.status as string) === "DONE" ||
                                  (application.status as string) === "completed" ||
                                  (application.status as string) === "done"
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          }`}
                        >
                          {formatStatus(application.status as string)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(application)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(application.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
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

