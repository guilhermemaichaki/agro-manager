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
import type { Product, CreateProductInput, UpdateProductInput, Category } from "@/types/schema";
import { supabase } from "@/lib/supabase";
import { CategorySelector } from "@/components/category-selector";

// Schema de validação
const productSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  company: z.string().min(1, "Empresa é obrigatória"),
  active_principle: z.string().min(1, "Princípio ativo é obrigatório"),
  unit: z.string().min(1, "Unidade é obrigatória"),
  description: z.string().optional(),
  category_ids: z.array(z.string()).optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

// Função para sincronizar categorias do produto
async function syncProductCategories(productId: string, categoryIds: string[]): Promise<void> {
  // Deletar categorias antigas
  await supabase.from("product_categories").delete().eq("product_id", productId);

  // Inserir novas categorias
  if (categoryIds && categoryIds.length > 0) {
    const productCategories = categoryIds.map((categoryId) => ({
      product_id: productId,
      category_id: categoryId,
    }));

    const { error } = await supabase.from("product_categories").insert(productCategories as any);

    if (error) {
      throw new Error(`Erro ao sincronizar categorias: ${error.message}`);
    }
  }
}

// Função para buscar categorias de um produto
async function fetchProductCategories(productId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from("product_categories")
    .select("category_id, category:categories(*)")
    .eq("product_id", productId);

  if (error) {
    throw new Error(`Erro ao buscar categorias do produto: ${error.message}`);
  }

  return (data || []).map((item: any) => item.category).filter(Boolean);
}

// Funções de API usando Supabase
async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select(`
      *,
      product_categories:product_categories(
        category:categories(*)
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar produtos: ${error.message}`);
  }

  // Transformar os dados para incluir categorias no formato esperado
  return (data || []).map((product: any) => ({
    ...product,
    categories: (product.product_categories || []).map((pc: any) => pc.category).filter(Boolean),
  }));
}

async function createProduct(data: CreateProductInput): Promise<Product> {
  const { category_ids, ...productData } = data;

  const { data: newProduct, error } = await supabase
    .from("products")
    .insert({
      name: productData.name,
      company: productData.company,
      active_principle: productData.active_principle,
      unit: productData.unit,
      description: productData.description || null,
    } as any)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar produto: ${error.message}`);
  }

  if (!newProduct) {
    throw new Error("Produto não foi criado");
  }

  // Sincronizar categorias
  if (category_ids && category_ids.length > 0) {
    await syncProductCategories(newProduct.id, category_ids);
  }

  // Buscar produto completo com categorias
  const { data: fullProduct } = await supabase
    .from("products")
    .select(`
      *,
      product_categories:product_categories(
        category:categories(*)
      )
    `)
    .eq("id", newProduct.id)
    .single();

  if (fullProduct) {
    return {
      ...fullProduct,
      categories: (fullProduct.product_categories || []).map((pc: any) => pc.category).filter(Boolean),
    } as Product;
  }

  return newProduct as Product;
}

async function updateProduct(data: UpdateProductInput): Promise<Product> {
  const { id, category_ids, ...updateData } = data;

  // Prepara o objeto de atualização
  const updatePayload: Record<string, any> = {};
  if (updateData.name !== undefined) updatePayload.name = updateData.name;
  if (updateData.company !== undefined) updatePayload.company = updateData.company;
  if (updateData.active_principle !== undefined) updatePayload.active_principle = updateData.active_principle;
  if (updateData.unit !== undefined) updatePayload.unit = updateData.unit;
  if (updateData.description !== undefined) updatePayload.description = updateData.description || null;
  updatePayload.updated_at = new Date().toISOString();

  const { data: updatedProduct, error } = await supabase
    .from("products")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar produto: ${error.message}`);
  }

  if (!updatedProduct) {
    throw new Error("Produto não foi atualizado");
  }

  // Sincronizar categorias se fornecidas
  if (category_ids !== undefined) {
    await syncProductCategories(id, category_ids || []);
  }

  // Buscar produto completo com categorias
  const { data: fullProduct } = await supabase
    .from("products")
    .select(`
      *,
      product_categories:product_categories(
        category:categories(*)
      )
    `)
    .eq("id", id)
    .single();

  if (fullProduct) {
    return {
      ...fullProduct,
      categories: (fullProduct.product_categories || []).map((pc: any) => pc.category).filter(Boolean),
    } as Product;
  }

  return updatedProduct as Product;
}

async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    throw new Error(`Erro ao deletar produto: ${error.message}`);
  }
}

export default function ProdutosPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const queryClient = useQueryClient();

  // Query para buscar produtos
  const { data: products = [], isLoading, error: fetchError } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });

  // Mutation para criar produto
  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      alert(`Erro ao criar produto: ${error.message}`);
    },
  });

  // Mutation para atualizar produto
  const updateMutation = useMutation({
    mutationFn: updateProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsDialogOpen(false);
      setEditingProduct(null);
      form.reset();
    },
    onError: (error: Error) => {
      alert(`Erro ao atualizar produto: ${error.message}`);
    },
  });

  // Mutation para deletar produto
  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: Error) => {
      alert(`Erro ao deletar produto: ${error.message}`);
    },
  });

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      company: "",
      active_principle: "",
      unit: "",
      description: "",
      category_ids: [],
    },
  });

  const onSubmit = (data: ProductFormValues) => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = async (product: Product) => {
    setEditingProduct(product);
    
    // Buscar categorias do produto
    const categories = await fetchProductCategories(product.id);
    const categoryIds = categories.map((cat) => cat.id);

    form.reset({
      name: product.name,
      company: product.company,
      active_principle: product.active_principle,
      unit: product.unit,
      description: product.description || "",
      category_ids: categoryIds,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este produto?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingProduct(null);
      form.reset();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">
            Gerencie os defensivos agrícolas cadastrados
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "Editar Produto" : "Novo Produto"}
              </DialogTitle>
              <DialogDescription>
                {editingProduct
                  ? "Atualize as informações do produto"
                  : "Preencha os dados para cadastrar um novo produto"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Roundup Original" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empresa</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Bayer" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="active_principle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Princípio Ativo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Glifosato" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unidade</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: L, kg" {...field} />
                      </FormControl>
                      <FormDescription>
                        Unidade de medida (litros, quilogramas, etc.)
                      </FormDescription>
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
                        <Input
                          placeholder="Ex: Herbicida não seletivo"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category_ids"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <FormControl>
                        <CategorySelector
                          value={field.value || []}
                          onChange={field.onChange}
                          error={form.formState.errors.category_ids?.message}
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
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                  >
                    {editingProduct ? "Salvar Alterações" : "Cadastrar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Produtos</CardTitle>
          <CardDescription>
            {products.length} produto(s) cadastrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fetchError ? (
            <div className="py-8 text-center text-destructive">
              Erro ao carregar produtos:{" "}
              {fetchError instanceof Error ? fetchError.message : "Erro desconhecido"}
            </div>
          ) : isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Carregando produtos...
            </div>
          ) : products.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Nenhum produto cadastrado. Clique em "Novo Produto" para começar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Princípio Ativo</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      {product.name}
                    </TableCell>
                    <TableCell>{product.company}</TableCell>
                    <TableCell>{product.active_principle}</TableCell>
                    <TableCell>{product.unit}</TableCell>
                    <TableCell>
                      {product.categories && product.categories.length > 0
                        ? product.categories.map((cat) => cat.name).join(", ")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.description || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(product)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(product.id)}
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

