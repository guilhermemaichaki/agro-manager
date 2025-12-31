"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Upload, Image as ImageIcon } from "lucide-react";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Machinery, CreateMachineryInput, UpdateMachineryInput } from "@/types/schema";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

// Schema de validação
const machinerySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(["pulverizador", "drone", "aviao"], {
    required_error: "Tipo é obrigatório",
  }),
  tank_capacity_liters: z.number().positive("Capacidade deve ser maior que zero"),
  photo_url: z.string().optional(),
});

type MachineryFormValues = z.infer<typeof machinerySchema>;

// Funções de API usando Supabase
async function fetchMachineries(): Promise<Machinery[]> {
  // Remover verificação de autenticação - deixar RLS lidar com isso
  const { data, error } = await supabase
    .from("machineries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar maquinários: ${error.message}`);
  }

  return data || [];
}

async function createMachinery(data: CreateMachineryInput): Promise<Machinery> {
  // Tentar obter usuário atual, mas não falhar se não houver
  // As políticas RLS vão lidar com a autorização
  const { data: { user } } = await supabase.auth.getUser();

  // Preparar dados para inserção
  // Se houver usuário, usar user_id, senão deixar NULL
  const insertData: any = {
    ...data,
    user_id: user?.id || null, // Permitir NULL se não houver usuário
  };

  const { data: newMachinery, error } = await supabase
    .from("machineries")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar maquinário: ${error.message}`);
  }

  return newMachinery as Machinery;
}

async function updateMachinery(data: UpdateMachineryInput): Promise<Machinery> {
  const { id, ...updateData } = data;

  const { data: updatedMachinery, error } = await supabase
    .from("machineries")
    .update({
      ...updateData,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar maquinário: ${error.message}`);
  }

  return updatedMachinery as Machinery;
}

async function deleteMachinery(id: string): Promise<void> {
  const { error } = await supabase.from("machineries").delete().eq("id", id);

  if (error) {
    throw new Error(`Erro ao excluir maquinário: ${error.message}`);
  }
}

// Função para fazer upload de foto
async function uploadMachineryPhoto(file: File, machineryId: string): Promise<string> {
  const fileExt = file.name.split(".").pop();
  const fileName = `${machineryId}-${Date.now()}.${fileExt}`;
  // Usar caminho público sem user_id para evitar problemas de autenticação
  const filePath = `public/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("machinery-photos")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true, // Permitir sobrescrever se já existir
    });

  if (uploadError) {
    throw new Error(`Erro ao fazer upload da foto: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("machinery-photos").getPublicUrl(filePath);

  return publicUrl;
}

export default function MaquinariosPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMachinery, setEditingMachinery] = useState<Machinery | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const queryClient = useQueryClient();

  // Remover verificação de autenticação - não é necessária se outras páginas não usam

  const form = useForm<MachineryFormValues>({
    resolver: zodResolver(machinerySchema),
    defaultValues: {
      name: "",
      type: "pulverizador",
      tank_capacity_liters: 0,
      photo_url: "",
    },
  });

  const { data: machineries = [], isLoading } = useQuery({
    queryKey: ["machineries"],
    queryFn: fetchMachineries,
  });

  const createMutation = useMutation({
    mutationFn: createMachinery,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machineries"] });
      setIsDialogOpen(false);
      form.reset();
      setEditingMachinery(null);
    },
    onError: (error: Error) => {
      alert(`Erro ao criar maquinário: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateMachinery,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machineries"] });
      setIsDialogOpen(false);
      form.reset();
      setEditingMachinery(null);
    },
    onError: (error: Error) => {
      alert(`Erro ao atualizar maquinário: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMachinery,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machineries"] });
    },
    onError: (error: Error) => {
      alert(`Erro ao excluir maquinário: ${error.message}`);
    },
  });

  const onSubmit = async (data: MachineryFormValues) => {
    if (editingMachinery) {
      updateMutation.mutate({ id: editingMachinery.id, ...data });
    } else {
      // Se houver foto para upload, criar primeiro sem foto e depois fazer upload
      const photoInput = document.getElementById("photo-upload") as HTMLInputElement;
      const photoFile = photoInput?.files?.[0];
      
      if (photoFile) {
        // Criar maquinário sem foto primeiro
        createMutation.mutate(
          { ...data, photo_url: undefined },
          {
            onSuccess: async (newMachinery) => {
              // Fazer upload da foto após criar
              setUploadingPhoto(true);
              try {
                const photoUrl = await uploadMachineryPhoto(photoFile, newMachinery.id);
                // Atualizar o maquinário com a URL da foto
                await updateMachinery({ id: newMachinery.id, photo_url: photoUrl });
                queryClient.invalidateQueries({ queryKey: ["machineries"] });
              } catch (error: any) {
                alert(`Erro ao fazer upload da foto: ${error.message}`);
              } finally {
                setUploadingPhoto(false);
              }
            },
          }
        );
      } else {
        createMutation.mutate(data);
      }
    }
  };

  const handleEdit = (machinery: Machinery) => {
    setEditingMachinery(machinery);
    form.reset({
      name: machinery.name,
      type: machinery.type,
      tank_capacity_liters: machinery.tank_capacity_liters,
      photo_url: machinery.photo_url || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este maquinário?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingMachinery(null);
      form.reset();
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Se estiver editando, fazer upload imediatamente
    if (editingMachinery) {
      setUploadingPhoto(true);
      try {
        const photoUrl = await uploadMachineryPhoto(file, editingMachinery.id);
        form.setValue("photo_url", photoUrl);
        // Atualizar o maquinário com a nova foto
        await updateMachinery({ id: editingMachinery.id, photo_url: photoUrl });
        queryClient.invalidateQueries({ queryKey: ["machineries"] });
      } catch (error: any) {
        alert(`Erro ao fazer upload: ${error.message}`);
      } finally {
        setUploadingPhoto(false);
      }
    } else {
      // Se estiver criando, apenas armazenar o arquivo para upload após criação
      // A foto será enviada no onSubmit após criar o maquinário
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      pulverizador: "Pulverizador",
      drone: "Drone",
      aviao: "Avião",
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Maquinários</h1>
          <p className="text-muted-foreground">
            Gerencie seus maquinários de pulverização
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Maquinário
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingMachinery ? "Editar Maquinário" : "Novo Maquinário"}
              </DialogTitle>
              <DialogDescription>
                {editingMachinery
                  ? "Atualize as informações do maquinário"
                  : "Cadastre um novo maquinário de pulverização"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Maquinário</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Pulverizador John Deere 4730" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pulverizador">Pulverizador</SelectItem>
                          <SelectItem value="drone">Drone</SelectItem>
                          <SelectItem value="aviao">Avião</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tank_capacity_liters"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacidade do Tanque (Litros)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="1000"
                          value={field.value || ""}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            field.onChange(isNaN(value) ? 0 : value);
                          }}
                          onBlur={field.onBlur}
                        />
                      </FormControl>
                      <FormDescription>
                        Capacidade total do tanque de calda em litros
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="photo_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Foto do Maquinário</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          {field.value && (
                            <div className="relative w-full h-48 rounded-lg overflow-hidden border">
                              <Image
                                src={field.value}
                                alt="Foto do maquinário"
                                fill
                                className="object-cover"
                              />
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoUpload}
                              disabled={uploadingPhoto}
                              className="hidden"
                              id="photo-upload"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => document.getElementById("photo-upload")?.click()}
                              disabled={uploadingPhoto}
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              {uploadingPhoto ? "Enviando..." : "Enviar Foto"}
                            </Button>
                            {field.value && (
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                  field.onChange("");
                                }}
                              >
                                Remover Foto
                              </Button>
                            )}
                          </div>
                        </div>
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
                    {editingMachinery ? "Salvar Alterações" : "Cadastrar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Maquinários</CardTitle>
          <CardDescription>
            {machineries.length} maquinário(s) cadastrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : machineries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum maquinário cadastrado. Clique em "Novo Maquinário" para começar.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {machineries.map((machinery) => (
                <Card key={machinery.id} className="overflow-hidden">
                  <div className="relative w-full h-48 bg-muted">
                    {machinery.photo_url ? (
                      <Image
                        src={machinery.photo_url}
                        alt={machinery.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <ImageIcon className="h-16 w-16 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg mb-1">{machinery.name}</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      {getTypeLabel(machinery.type)}
                    </p>
                    <p className="text-sm font-medium">
                      Capacidade: {machinery.tank_capacity_liters.toFixed(0)} L
                    </p>
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(machinery)}
                        className="flex-1"
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(machinery.id)}
                        className="flex-1"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Excluir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
