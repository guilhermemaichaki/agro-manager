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
import type { Farm } from "@/types/schema";
import { supabase } from "@/lib/supabase";

const farmSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
});

type FarmFormValues = z.infer<typeof farmSchema>;

interface CreateFarmInput {
  name: string;
  description?: string;
}

interface UpdateFarmInput extends Partial<CreateFarmInput> {
  id: string;
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

export default function FazendasPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
  const queryClient = useQueryClient();

  const { data: farms = [], isLoading, error: fetchError } = useQuery({
    queryKey: ["farms"],
    queryFn: fetchFarms,
  });

  const createMutation = useMutation({
    mutationFn: createFarm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farms"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      alert(`Erro ao criar fazenda: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateFarm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farms"] });
      setIsDialogOpen(false);
      setEditingFarm(null);
      form.reset();
    },
    onError: (error: Error) => {
      alert(`Erro ao atualizar fazenda: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFarm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farms"] });
    },
    onError: (error: Error) => {
      alert(`Erro ao deletar fazenda: ${error.message}`);
    },
  });

  const form = useForm<FarmFormValues>({
    resolver: zodResolver(farmSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const onSubmit = (data: FarmFormValues) => {
    if (editingFarm) {
      updateMutation.mutate({ id: editingFarm.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (farm: Farm) => {
    setEditingFarm(farm);
    form.reset({
      name: farm.name,
      description: farm.description || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta fazenda?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingFarm(null);
      form.reset();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fazendas</h1>
          <p className="text-muted-foreground">Gerencie as fazendas cadastradas</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
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
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
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
                  control={form.control}
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
                    onClick={() => handleOpenChange(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingFarm ? "Salvar Alterações" : "Cadastrar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Fazendas</CardTitle>
          <CardDescription>{farms.length} fazenda(s) cadastrada(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {fetchError ? (
            <div className="py-8 text-center text-destructive">
              Erro ao carregar fazendas:{" "}
              {fetchError instanceof Error ? fetchError.message : "Erro desconhecido"}
            </div>
          ) : isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Carregando fazendas...
            </div>
          ) : farms.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhuma fazenda cadastrada. Clique em "Nova Fazenda" para começar.
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
                {farms.map((farm) => (
                  <TableRow key={farm.id}>
                    <TableCell className="font-medium">{farm.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {farm.description || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(farm)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(farm.id)}
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

