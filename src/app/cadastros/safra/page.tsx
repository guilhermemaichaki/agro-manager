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
import type { CropYear } from "@/types/schema";
import { supabase } from "@/lib/supabase";

// Schema de validação
const cropYearSchema = z.object({
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

type CropYearFormValues = z.infer<typeof cropYearSchema>;

// Tipos para API
interface CreateCropYearInput {
  name: string;
  start_date: string;
  end_date: string;
}

interface UpdateCropYearInput extends Partial<CreateCropYearInput> {
  id: string;
}

// Funções de API usando Supabase
async function fetchCropYears(): Promise<CropYear[]> {
  const { data, error } = await supabase
    .from("crop_years")
    .select("*")
    .order("start_date", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar safras: ${error.message}`);
  }

  return data || [];
}

async function createCropYear(data: CreateCropYearInput): Promise<CropYear> {
  const { data: newCropYear, error } = await supabase
    .from("crop_years")
    .insert({
      name: data.name,
      start_date: data.start_date,
      end_date: data.end_date,
    } as any)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar safra: ${error.message}`);
  }

  if (!newCropYear) {
    throw new Error("Safra não foi criada");
  }

  return newCropYear as CropYear;
}

async function updateCropYear(data: UpdateCropYearInput): Promise<CropYear> {
  const { id, ...updateData } = data;

  // Prepara o objeto de atualização
  const updatePayload: Record<string, any> = {};
  if (updateData.name !== undefined) updatePayload.name = updateData.name;
  if (updateData.start_date !== undefined) updatePayload.start_date = updateData.start_date;
  if (updateData.end_date !== undefined) updatePayload.end_date = updateData.end_date;
  updatePayload.updated_at = new Date().toISOString();

  const { data: updatedCropYear, error } = await supabase
    .from("crop_years")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar safra: ${error.message}`);
  }

  if (!updatedCropYear) {
    throw new Error("Safra não foi atualizada");
  }

  return updatedCropYear as CropYear;
}

async function deleteCropYear(id: string): Promise<void> {
  const { error } = await supabase.from("crop_years").delete().eq("id", id);

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

export default function SafraPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCropYear, setEditingCropYear] = useState<CropYear | null>(null);
  const queryClient = useQueryClient();

  // Query para buscar safras
  const { data: cropYears = [], isLoading, error: fetchError } = useQuery({
    queryKey: ["crop_years"],
    queryFn: fetchCropYears,
  });

  // Mutation para criar safra
  const createMutation = useMutation({
    mutationFn: createCropYear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crop_years"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      alert(`Erro ao criar safra: ${error.message}`);
    },
  });

  // Mutation para atualizar safra
  const updateMutation = useMutation({
    mutationFn: updateCropYear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crop_years"] });
      setIsDialogOpen(false);
      setEditingCropYear(null);
      form.reset();
    },
    onError: (error: Error) => {
      alert(`Erro ao atualizar safra: ${error.message}`);
    },
  });

  // Mutation para deletar safra
  const deleteMutation = useMutation({
    mutationFn: deleteCropYear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crop_years"] });
    },
    onError: (error: Error) => {
      alert(`Erro ao deletar safra: ${error.message}`);
    },
  });

  const form = useForm<CropYearFormValues>({
    resolver: zodResolver(cropYearSchema),
    defaultValues: {
      name: "",
      start_date: "",
      end_date: "",
    },
  });

  const onSubmit = (data: CropYearFormValues) => {
    if (editingCropYear) {
      updateMutation.mutate({ id: editingCropYear.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (cropYear: CropYear) => {
    setEditingCropYear(cropYear);
    form.reset({
      name: cropYear.name,
      start_date: formatDateForInput(cropYear.start_date),
      end_date: formatDateForInput(cropYear.end_date),
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta safra?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingCropYear(null);
      form.reset();
    }
  };

  // Função para formatar período
  const formatPeriod = (cropYear: CropYear) => {
    const start = formatDate(cropYear.start_date);
    const end = formatDate(cropYear.end_date);
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
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingCropYear ? "Editar Safra" : "Nova Safra"}
              </DialogTitle>
              <DialogDescription>
                {editingCropYear
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
                    {editingCropYear ? "Salvar Alterações" : "Cadastrar"}
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
            {cropYears.length} safra(s) cadastrada(s)
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
          ) : cropYears.length === 0 ? (
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
                {cropYears.map((cropYear) => (
                  <TableRow key={cropYear.id}>
                    <TableCell className="font-medium">
                      {cropYear.name}
                    </TableCell>
                    <TableCell>{formatPeriod(cropYear)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(cropYear)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(cropYear.id)}
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

