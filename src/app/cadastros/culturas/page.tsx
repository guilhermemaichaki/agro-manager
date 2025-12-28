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
import type { Culture } from "@/types/schema";
import { supabase } from "@/lib/supabase";

const cultureSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
});

type CultureFormValues = z.infer<typeof cultureSchema>;

interface CreateCultureInput {
  name: string;
  description?: string;
}

interface UpdateCultureInput extends Partial<CreateCultureInput> {
  id: string;
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

async function createCulture(data: CreateCultureInput): Promise<Culture> {
  const { data: newCulture, error } = await supabase
    .from("cultures")
    .insert({
      name: data.name,
      description: data.description || null,
    } as any)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar cultura: ${error.message}`);
  }

  if (!newCulture) {
    throw new Error("Cultura não foi criada");
  }

  return newCulture as Culture;
}

async function updateCulture(data: UpdateCultureInput): Promise<Culture> {
  const { id, ...updateData } = data;

  const updatePayload: Record<string, any> = {};
  if (updateData.name !== undefined) updatePayload.name = updateData.name;
  if (updateData.description !== undefined)
    updatePayload.description = updateData.description || null;
  updatePayload.updated_at = new Date().toISOString();

  const { data: updatedCulture, error } = await supabase
    .from("cultures")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar cultura: ${error.message}`);
  }

  if (!updatedCulture) {
    throw new Error("Cultura não foi atualizada");
  }

  return updatedCulture as Culture;
}

async function deleteCulture(id: string): Promise<void> {
  const { error } = await supabase.from("cultures").delete().eq("id", id);

  if (error) {
    throw new Error(`Erro ao deletar cultura: ${error.message}`);
  }
}

export default function CulturasPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCulture, setEditingCulture] = useState<Culture | null>(null);
  const queryClient = useQueryClient();

  const { data: cultures = [], isLoading, error: fetchError } = useQuery({
    queryKey: ["cultures"],
    queryFn: fetchCultures,
  });

  const createMutation = useMutation({
    mutationFn: createCulture,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cultures"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      alert(`Erro ao criar cultura: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateCulture,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cultures"] });
      setIsDialogOpen(false);
      setEditingCulture(null);
      form.reset();
    },
    onError: (error: Error) => {
      alert(`Erro ao atualizar cultura: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCulture,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cultures"] });
    },
    onError: (error: Error) => {
      alert(`Erro ao deletar cultura: ${error.message}`);
    },
  });

  const form = useForm<CultureFormValues>({
    resolver: zodResolver(cultureSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const onSubmit = (data: CultureFormValues) => {
    if (editingCulture) {
      updateMutation.mutate({ id: editingCulture.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (culture: Culture) => {
    setEditingCulture(culture);
    form.reset({
      name: culture.name,
      description: culture.description || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta cultura?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingCulture(null);
      form.reset();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Culturas</h1>
          <p className="text-muted-foreground">Gerencie as culturas cadastradas</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Cultura
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingCulture ? "Editar Cultura" : "Nova Cultura"}
              </DialogTitle>
              <DialogDescription>
                {editingCulture
                  ? "Atualize as informações da cultura"
                  : "Preencha os dados para cadastrar uma nova cultura"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Cultura</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Soja, Milho, Trigo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição (Opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descrição da cultura..."
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
                    onClick={() => handleOpenChange(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingCulture ? "Salvar Alterações" : "Cadastrar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Culturas</CardTitle>
          <CardDescription>{cultures.length} cultura(s) cadastrada(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {fetchError ? (
            <div className="py-8 text-center text-destructive">
              Erro ao carregar culturas:{" "}
              {fetchError instanceof Error ? fetchError.message : "Erro desconhecido"}
            </div>
          ) : isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Carregando culturas...
            </div>
          ) : cultures.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhuma cultura cadastrada. Clique em "Nova Cultura" para começar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cultures.map((culture) => (
                  <TableRow key={culture.id}>
                    <TableCell className="font-medium">{culture.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {culture.description || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(culture)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(culture.id)}
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

