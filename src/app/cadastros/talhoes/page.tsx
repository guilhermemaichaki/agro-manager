"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Calendar } from "lucide-react";
import Link from "next/link";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Field, Farm, SubField } from "@/types/schema";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/app-store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

// Schema de validação
const subFieldSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  area_hectares: z.number().positive("Área deve ser maior que zero"),
});

const fieldSchema = z.object({
  farm_id: z.string().min(1, "Fazenda é obrigatória"),
  name: z.string().min(1, "Nome é obrigatório"),
  area_hct: z.number().positive("Área deve ser maior que zero"),
  sub_fields: z.array(subFieldSchema).optional(),
});

type FieldFormValues = z.infer<typeof fieldSchema>;

// Tipos para API
interface CreateFieldInput {
  farm_id: string;
  name: string;
  area_hct: number;
  sub_fields?: Array<{ name: string; area_hectares: number }>;
}

interface UpdateFieldInput extends Partial<CreateFieldInput> {
  id: string;
}

// Funções de API usando Supabase
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

async function fetchFields(farmId?: string | null): Promise<Field[]> {
  let query = supabase.from("fields").select(`
    *,
    farm:farms(*),
    sub_fields:sub_fields(*)
  `);

  if (farmId) {
    query = query.eq("farm_id", farmId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar talhões: ${error.message}`);
  }

  return data || [];
}

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

async function createField(data: CreateFieldInput): Promise<Field> {
  // 1. Criar talhão
  const { data: newField, error: fieldError } = await supabase
    .from("fields")
    .insert({
      farm_id: data.farm_id,
      name: data.name,
      area_hct: data.area_hct,
    } as any)
    .select()
    .single();

  if (fieldError) {
    throw new Error(`Erro ao criar talhão: ${fieldError.message}`);
  }

  if (!newField) {
    throw new Error("Talhão não foi criado");
  }

  // 2. Criar sub-talhões se houver
  if (data.sub_fields && data.sub_fields.length > 0) {
    const subFieldsData = data.sub_fields.map((sf) => ({
      field_id: newField.id,
      name: sf.name,
      area_hectares: sf.area_hectares,
    }));

    const { error: subFieldsError } = await supabase
      .from("sub_fields")
      .insert(subFieldsData as any);

    if (subFieldsError) {
      // Se falhar, tenta deletar o talhão criado
      await supabase.from("fields").delete().eq("id", newField.id);
      throw new Error(`Erro ao criar sub-talhões: ${subFieldsError.message}`);
    }
  }

  // Buscar talhão completo com relacionamentos
  const { data: fullField, error: fetchError } = await supabase
    .from("fields")
    .select(`
      *,
      farm:farms(*),
      sub_fields:sub_fields(*)
    `)
    .eq("id", newField.id)
    .single();

  if (fetchError || !fullField) {
    return newField as Field;
  }

  return fullField as Field;
}

async function updateField(data: UpdateFieldInput): Promise<Field> {
  const { id, sub_fields, ...updateData } = data;

  // Prepara o objeto de atualização
  const updatePayload: Record<string, any> = {};
  if (updateData.farm_id !== undefined) updatePayload.farm_id = updateData.farm_id;
  if (updateData.name !== undefined) updatePayload.name = updateData.name;
  if (updateData.area_hct !== undefined) updatePayload.area_hct = updateData.area_hct;
  updatePayload.updated_at = new Date().toISOString();

  // 1. Atualizar talhão
  const { error: fieldError } = await supabase
    .from("fields")
    .update(updatePayload)
    .eq("id", id);

  if (fieldError) {
    throw new Error(`Erro ao atualizar talhão: ${fieldError.message}`);
  }

  // 2. Atualizar sub-talhões se fornecidos
  if (sub_fields !== undefined) {
    // Deletar sub-talhões antigos
    await supabase.from("sub_fields").delete().eq("field_id", id);

    // Inserir novos sub-talhões
    if (sub_fields.length > 0) {
      const subFieldsData = sub_fields.map((sf) => ({
        field_id: id,
        name: sf.name,
        area_hectares: sf.area_hectares,
      }));

      const { error: subFieldsError } = await supabase
        .from("sub_fields")
        .insert(subFieldsData as any);

      if (subFieldsError) {
        throw new Error(`Erro ao atualizar sub-talhões: ${subFieldsError.message}`);
      }
    }
  }

  // Buscar talhão atualizado
  const { data: updatedField, error: fetchError } = await supabase
    .from("fields")
    .select(`
      *,
      farm:farms(*),
      sub_fields:sub_fields(*)
    `)
    .eq("id", id)
    .single();

  if (fetchError || !updatedField) {
    throw new Error("Talhão não foi atualizado");
  }

  return updatedField as Field;
}

async function deleteField(id: string): Promise<void> {
  const { error } = await supabase.from("fields").delete().eq("id", id);

  if (error) {
    throw new Error(`Erro ao deletar talhão: ${error.message}`);
  }
}

export default function TalhoesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const queryClient = useQueryClient();
  const { selectedFarmId } = useAppStore();

  // Query para buscar fazendas
  const { data: farms = [] } = useQuery({
    queryKey: ["farms"],
    queryFn: fetchFarms,
  });

  // Query para buscar talhões (filtrado por fazenda se selecionada)
  const { data: fields = [], isLoading, error: fetchError } = useQuery({
    queryKey: ["fields", selectedFarmId],
    queryFn: () => fetchFields(selectedFarmId),
  });

  // Mutation para criar talhão
  const createMutation = useMutation({
    mutationFn: createField,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fields"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      alert(`Erro ao criar talhão: ${error.message}`);
    },
  });

  // Mutation para atualizar talhão
  const updateMutation = useMutation({
    mutationFn: updateField,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fields"] });
      setIsDialogOpen(false);
      setEditingField(null);
      form.reset();
    },
    onError: (error: Error) => {
      alert(`Erro ao atualizar talhão: ${error.message}`);
    },
  });

  // Mutation para deletar talhão
  const deleteMutation = useMutation({
    mutationFn: deleteField,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fields"] });
    },
    onError: (error: Error) => {
      alert(`Erro ao deletar talhão: ${error.message}`);
    },
  });

  const form = useForm<FieldFormValues>({
    resolver: zodResolver(fieldSchema),
    defaultValues: {
      farm_id: selectedFarmId || "",
      name: "",
      area_hct: 0,
      sub_fields: [],
    },
  });

  const { fields: subFieldFields, append: appendSubField, remove: removeSubField } = useFieldArray({
    control: form.control,
    name: "sub_fields",
  });

  const onSubmit = (data: FieldFormValues) => {
    if (editingField) {
      updateMutation.mutate({ id: editingField.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = async (field: Field) => {
    setEditingField(field);
    // Buscar sub-talhões
    const subFields = await fetchSubFields(field.id);
    // Usa area_hct se existir, senão tenta area_hectares (do schema)
    const area = (field as any).area_hct ?? field.area_hectares ?? 0;
    form.reset({
      farm_id: field.farm_id || "",
      name: field.name,
      area_hct: area,
      sub_fields: subFields.map((sf) => ({
        name: sf.name,
        area_hectares: sf.area_hectares,
      })),
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este talhão?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingField(null);
      form.reset();
    }
  };

  // Função para formatar área
  const formatArea = (field: Field) => {
    // Tenta area_hct primeiro (nome usado no banco), senão usa area_hectares (do schema)
    const area = (field as any).area_hct ?? field.area_hectares ?? 0;
    return `${Number(area).toFixed(1)} ha`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Talhões</h1>
          <p className="text-muted-foreground">
            Gerencie os talhões cadastrados
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/cadastros/talhoes/planejamento">
            <Button variant="outline">
              <Calendar className="mr-2 h-4 w-4" />
              Planejamento de Safra
            </Button>
          </Link>
          <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Talhão
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingField ? "Editar Talhão" : "Novo Talhão"}
              </DialogTitle>
              <DialogDescription>
                {editingField
                  ? "Atualize as informações do talhão"
                  : "Preencha os dados para cadastrar um novo talhão"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="farm_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fazenda</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a fazenda" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {farms.map((farm) => (
                            <SelectItem key={farm.id} value={farm.id}>
                              {farm.name}
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
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Talhão</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Talhão 01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="area_hct"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Área (Hectares)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="Ex: 15.5"
                          value={field.value || ""}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            field.onChange(isNaN(value) ? 0 : value);
                          }}
                          onBlur={field.onBlur}
                        />
                      </FormControl>
                      <FormDescription>
                        Área do talhão em hectares (permitir decimais)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Seção de Sub-talhões */}
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">Sub-talhões</h4>
                      <p className="text-xs text-muted-foreground">
                        Adicione sub-áreas dentro deste talhão
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => appendSubField({ name: "", area_hectares: 0 })}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Sub-talhão
                    </Button>
                  </div>

                  {subFieldFields.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum sub-talhão adicionado
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {subFieldFields.map((field, index) => (
                        <div key={field.id} className="flex gap-2 items-end">
                          <FormField
                            control={form.control}
                            name={`sub_fields.${index}.name`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Nome</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ex: Sub-talhão A" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`sub_fields.${index}.area_hectares`}
                            render={({ field }) => (
                              <FormItem className="w-32">
                                <FormLabel>Tamanho (ha)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.1"
                                    placeholder="0.0"
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
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSubField(index)}
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
                    {editingField ? "Salvar Alterações" : "Cadastrar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Talhões</CardTitle>
          <CardDescription>
            {fields.length} talhão(ões) cadastrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fetchError ? (
            <div className="py-8 text-center text-destructive">
              Erro ao carregar talhões:{" "}
              {fetchError instanceof Error ? fetchError.message : "Erro desconhecido"}
            </div>
          ) : isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Carregando talhões...
            </div>
          ) : fields.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhum talhão cadastrado. Clique em "Novo Talhão" para começar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fazenda</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field) => {
                  const farm = field.farm as Farm | undefined;
                  return (
                    <TableRow key={field.id}>
                      <TableCell className="text-muted-foreground">
                        {farm?.name || "-"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {field.name}
                      </TableCell>
                      <TableCell>{formatArea(field)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(field)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(field.id)}
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

