"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Field } from "@/types/schema";
import { supabase } from "@/lib/supabase";

// Schema de validação
const fieldSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  area_hct: z.number().positive("Área deve ser maior que zero"),
});

type FieldFormValues = z.infer<typeof fieldSchema>;

// Tipos para API
interface CreateFieldInput {
  name: string;
  area_hct: number;
}

interface UpdateFieldInput extends Partial<CreateFieldInput> {
  id: string;
}

// Funções de API usando Supabase
async function fetchFields(): Promise<Field[]> {
  const { data, error } = await supabase
    .from("fields")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar talhões: ${error.message}`);
  }

  return data || [];
}

async function createField(data: CreateFieldInput): Promise<Field> {
  const { data: newField, error } = await supabase
    .from("fields")
    .insert({
      name: data.name,
      area_hct: data.area_hct,
    } as any)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar talhão: ${error.message}`);
  }

  if (!newField) {
    throw new Error("Talhão não foi criado");
  }

  return newField as Field;
}

async function updateField(data: UpdateFieldInput): Promise<Field> {
  const { id, ...updateData } = data;

  // Prepara o objeto de atualização
  const updatePayload: Record<string, any> = {};
  if (updateData.name !== undefined) updatePayload.name = updateData.name;
  if (updateData.area_hct !== undefined) updatePayload.area_hct = updateData.area_hct;
  updatePayload.updated_at = new Date().toISOString();

  const { data: updatedField, error } = await supabase
    .from("fields")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar talhão: ${error.message}`);
  }

  if (!updatedField) {
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

  // Query para buscar talhões
  const { data: fields = [], isLoading, error: fetchError } = useQuery({
    queryKey: ["fields"],
    queryFn: fetchFields,
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
      name: "",
      area_hct: 0,
    },
  });

  const onSubmit = (data: FieldFormValues) => {
    if (editingField) {
      updateMutation.mutate({ id: editingField.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (field: Field) => {
    setEditingField(field);
    // Usa area_hct se existir, senão tenta area_hectares (do schema)
    const area = (field as any).area_hct ?? field.area_hectares ?? 0;
    form.reset({
      name: field.name,
      area_hct: area,
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
        <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Talhão
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
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
                  <TableHead>Nome</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field) => (
                  <TableRow key={field.id}>
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

