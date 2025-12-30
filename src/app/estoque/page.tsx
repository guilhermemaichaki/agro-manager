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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { StockMovement, Product, StockMovementType } from "@/types/schema";
import { supabase } from "@/lib/supabase";

// Schema de validação para entrada de estoque
const stockEntrySchema = z.object({
  product_id: z.string().min(1, "Produto é obrigatório"),
  movement_date: z.string().min(1, "Data é obrigatória"),
  quantity: z.number().positive("Quantidade deve ser maior que zero"),
  unit_price: z.number().positive("Preço unitário deve ser maior que zero"),
  supplier: z.string().optional(),
});

type StockEntryFormValues = z.infer<typeof stockEntrySchema>;

// Tipos para API
interface CreateStockEntryInput {
  product_id: string;
  movement_date: string;
  quantity: number;
  unit_price: number;
  supplier?: string;
}

interface UpdateStockEntryInput extends Partial<CreateStockEntryInput> {
  id: string;
}

// Interface para saldo de estoque
interface StockBalance {
  product_id: string;
  product_name: string;
  unit: string;
  balance: number;
  average_price: number;
  predicted_quantity: number;
  categories: string[]; // Array de nomes de categorias
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

// Função para buscar movimentações de estoque
async function fetchStockMovements(): Promise<StockMovement[]> {
  const { data, error } = await supabase
    .from("stock_movements")
    .select(`
      *,
      product:products(*)
    `)
    .order("movement_date", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar movimentações: ${error.message}`);
  }

  return data || [];
}

// Função para buscar aplicações planejadas
async function fetchPlannedApplications(): Promise<Map<string, number>> {
  const { data: applications, error } = await supabase
    .from("applications")
    .select(`
      id,
      application_products:application_products(
        product_id,
        quantity_used
      )
    `)
    .in("status", ["PLANNED", "planned"]);

  if (error || !applications) {
    return new Map();
  }

  // Agrupa por produto e soma as quantidades
  const plannedMap = new Map<string, number>();

  applications.forEach((app) => {
    const products = app.application_products as Array<{ product_id: string; quantity_used: number }> | null;
    if (products) {
      products.forEach((ap) => {
        const current = plannedMap.get(ap.product_id) || 0;
        plannedMap.set(ap.product_id, current + (ap.quantity_used || 0));
      });
    }
  });

  return plannedMap;
}

// Função para calcular saldo de estoque
async function fetchStockBalance(): Promise<StockBalance[]> {
  const [movements, products, plannedMap] = await Promise.all([
    fetchStockMovements(),
    fetchProducts(),
    fetchPlannedApplications(),
  ]);

  // Cria um mapa de produtos para facilitar busca
  const productsMap = new Map(products.map((p) => [p.id, p]));

  // Agrupa movimentações por produto e calcula saldo e média ponderada
  const balanceMap = new Map<string, { 
    entries: number; 
    exits: number;
    totalValue: number; // soma(quantity × unit_price) para entradas
    totalQuantity: number; // soma(quantity) para entradas
  }>();

  movements.forEach((movement) => {
    const productId = movement.product_id;
    const quantity = movement.quantity;
    const type = movement.movement_type;

    if (!balanceMap.has(productId)) {
      balanceMap.set(productId, { entries: 0, exits: 0, totalValue: 0, totalQuantity: 0 });
    }

    const balance = balanceMap.get(productId)!;
    // Suporta tanto o enum quanto strings diretas (para compatibilidade)
    if (type === "entry" || (type as string) === "IN") {
      balance.entries += quantity;
      // Calcula valor total para média ponderada (apenas entradas)
      const unitPrice = movement.unit_price || 0;
      balance.totalValue += quantity * unitPrice;
      balance.totalQuantity += quantity;
    } else if (type === "exit" || (type as string) === "OUT") {
      balance.exits += quantity;
    }
  });

  // Buscar categorias de todos os produtos de uma vez
  const productIds = Array.from(balanceMap.keys());
  const { data: productCategoriesData } = await supabase
    .from("product_categories")
    .select(`
      product_id,
      category:categories(name)
    `)
    .in("product_id", productIds.length > 0 ? productIds : ["00000000-0000-0000-0000-000000000000"]);

  // Criar mapa de categorias por produto
  const categoriesMap = new Map<string, string[]>();
  productCategoriesData?.forEach((item: any) => {
    const productId = item.product_id;
    const categoryName = item.category?.name;
    if (categoryName) {
      if (!categoriesMap.has(productId)) {
        categoriesMap.set(productId, []);
      }
      categoriesMap.get(productId)!.push(categoryName);
    }
  });

  // Converte para array de StockBalance
  const balances: StockBalance[] = Array.from(balanceMap.entries()).map(
    ([productId, balance]) => {
      const product = productsMap.get(productId);
      const currentBalance = balance.entries - balance.exits;
      
      // Calcula média ponderada
      const averagePrice = balance.totalQuantity > 0 
        ? balance.totalValue / balance.totalQuantity 
        : 0;

      // Calcula quantidade prevista
      const plannedQuantity = plannedMap.get(productId) || 0;
      const predictedQuantity = currentBalance - plannedQuantity;

      // Buscar categorias do produto
      const productCategories = categoriesMap.get(productId) || [];

      return {
        product_id: productId,
        product_name: product?.name || "Produto não encontrado",
        unit: product?.unit || "-",
        balance: currentBalance,
        average_price: averagePrice,
        predicted_quantity: predictedQuantity,
        categories: productCategories,
      };
    }
  );

  // Adiciona produtos sem movimentações (saldo zero)
  products.forEach((product) => {
    if (!balanceMap.has(product.id)) {
      const plannedQuantity = plannedMap.get(product.id) || 0;
      const productCategories = categoriesMap.get(product.id) || [];
      balances.push({
        product_id: product.id,
        product_name: product.name,
        unit: product.unit,
        balance: 0,
        average_price: 0,
        predicted_quantity: 0 - plannedQuantity,
        categories: productCategories,
      });
    }
  });

  // Ordena por nome do produto
  return balances.sort((a, b) => a.product_name.localeCompare(b.product_name));
}

// Função para buscar apenas entradas (para a aba 2)
async function fetchStockEntries(): Promise<(StockMovement & { product_categories?: Array<{ category: { name: string } }> })[]> {
  const { data, error } = await supabase
    .from("stock_movements")
    .select(`
      *,
      product:products(
        *,
        product_categories:product_categories(
          category:categories(name)
        )
      )
    `)
    .in("movement_type", ["entry", "IN"])
    .order("movement_date", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar entradas: ${error.message}`);
  }

  return data || [];
}

// Função para criar entrada de estoque
async function createStockEntry(data: CreateStockEntryInput): Promise<StockMovement> {
  const { data: newEntry, error } = await supabase
    .from("stock_movements")
    .insert({
      product_id: data.product_id,
      movement_type: "entry" as StockMovementType,
      quantity: data.quantity,
      unit_price: data.unit_price,
      movement_date: data.movement_date,
      notes: data.supplier || null,
    } as any)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar entrada: ${error.message}`);
  }

  if (!newEntry) {
    throw new Error("Entrada não foi criada");
  }

  return newEntry as StockMovement;
}

// Função para atualizar entrada de estoque
async function updateStockEntry(data: UpdateStockEntryInput): Promise<StockMovement> {
  const { id, ...updateData } = data;

  const updatePayload: Record<string, any> = {};
  if (updateData.product_id !== undefined) updatePayload.product_id = updateData.product_id;
  if (updateData.quantity !== undefined) updatePayload.quantity = updateData.quantity;
  if (updateData.unit_price !== undefined) updatePayload.unit_price = updateData.unit_price;
  if (updateData.movement_date !== undefined) updatePayload.movement_date = updateData.movement_date;
  if (updateData.supplier !== undefined) updatePayload.notes = updateData.supplier || null;

  const { data: updatedEntry, error } = await supabase
    .from("stock_movements")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar entrada: ${error.message}`);
  }

  if (!updatedEntry) {
    throw new Error("Entrada não foi atualizada");
  }

  return updatedEntry as StockMovement;
}

// Função para deletar entrada de estoque
async function deleteStockEntry(id: string): Promise<void> {
  const { error } = await supabase.from("stock_movements").delete().eq("id", id);

  if (error) {
    throw new Error(`Erro ao deletar entrada: ${error.message}`);
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

// Função para formatar moeda
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function EstoquePage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<StockMovement | null>(null);
  const queryClient = useQueryClient();

  // Query para buscar saldo de estoque (Aba 1)
  const { data: stockBalance = [], isLoading: isLoadingBalance } = useQuery({
    queryKey: ["stock_balance"],
    queryFn: fetchStockBalance,
  });

  // Query para buscar produtos (para o select)
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });

  // Query para buscar entradas (Aba 2)
  const { data: stockEntries = [], isLoading: isLoadingEntries, error: fetchError } = useQuery({
    queryKey: ["stock_entries"],
    queryFn: fetchStockEntries,
  });

  // Mutation para criar entrada
  const createMutation = useMutation({
    mutationFn: createStockEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock_entries"] });
      queryClient.invalidateQueries({ queryKey: ["stock_balance"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      alert(`Erro ao criar entrada: ${error.message}`);
    },
  });

  // Mutation para atualizar entrada
  const updateMutation = useMutation({
    mutationFn: updateStockEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock_entries"] });
      queryClient.invalidateQueries({ queryKey: ["stock_balance"] });
      setIsDialogOpen(false);
      setEditingEntry(null);
      form.reset();
    },
    onError: (error: Error) => {
      alert(`Erro ao atualizar entrada: ${error.message}`);
    },
  });

  // Mutation para deletar entrada
  const deleteMutation = useMutation({
    mutationFn: deleteStockEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock_entries"] });
      queryClient.invalidateQueries({ queryKey: ["stock_balance"] });
    },
    onError: (error: Error) => {
      alert(`Erro ao deletar entrada: ${error.message}`);
    },
  });

  const form = useForm<StockEntryFormValues>({
    resolver: zodResolver(stockEntrySchema),
    defaultValues: {
      product_id: "",
      movement_date: "",
      quantity: 0,
      unit_price: 0,
      supplier: "",
    },
  });

  const onSubmit = (data: StockEntryFormValues) => {
    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (entry: StockMovement) => {
    setEditingEntry(entry);
    form.reset({
      product_id: entry.product_id,
      movement_date: formatDateForInput(entry.movement_date),
      quantity: entry.quantity,
      unit_price: entry.unit_price || 0,
      supplier: entry.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta entrada?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingEntry(null);
      form.reset();
    }
  };

  // Função para converter data ISO para formato do input
  function formatDateForInput(dateString: string): string {
    const date = new Date(dateString);
    return date.toISOString().split("T")[0];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Estoque</h1>
        <p className="text-muted-foreground">
          Controle de entradas e saldo atual de produtos
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="entries">Entradas/Compras</TabsTrigger>
        </TabsList>

        {/* ABA 1: Visão Geral */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Saldo Atual</CardTitle>
              <CardDescription>
                Saldo atualizado de todos os produtos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingBalance ? (
                <div className="py-8 text-center text-muted-foreground">
                  Carregando saldo...
                </div>
              ) : stockBalance.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  Nenhum produto cadastrado.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Valor médio (R$/unidade)</TableHead>
                      <TableHead className="text-right">Quantidade atual</TableHead>
                      <TableHead className="text-right">Quantidade prevista</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockBalance.map((item) => (
                      <TableRow key={item.product_id}>
                        <TableCell className="font-medium">
                          {item.product_name}
                        </TableCell>
                        <TableCell>
                          {item.categories && item.categories.length > 0
                            ? item.categories.join(", ")
                            : "-"}
                        </TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell className="text-right">
                          {item.average_price > 0 
                            ? formatCurrency(item.average_price) 
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.balance.toFixed(2)} {item.unit}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${
                          item.predicted_quantity < 0 ? "text-destructive" : ""
                        }`}>
                          {item.predicted_quantity.toFixed(2)} {item.unit}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 2: Entradas/Compras */}
        <TabsContent value="entries" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Entradas/Compras</h2>
              <p className="text-muted-foreground">
                Histórico de compras e entradas de estoque
              </p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Entrada
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingEntry ? "Editar Entrada" : "Nova Entrada"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingEntry
                      ? "Atualize as informações da entrada"
                      : "Registre uma nova entrada de estoque"}
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="product_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Produto</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um produto" />
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
                      name="movement_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantidade</FormLabel>
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
                      <FormField
                        control={form.control}
                        name="unit_price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Preço Unitário</FormLabel>
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
                    </div>
                    <FormField
                      control={form.control}
                      name="supplier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fornecedor (Opcional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome do fornecedor" {...field} />
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
                        {editingEntry ? "Salvar Alterações" : "Cadastrar"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Entregas/Compras</CardTitle>
              <CardDescription>
                {stockEntries.length} entrada(s) registrada(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {fetchError ? (
                <div className="py-8 text-center text-destructive">
                  Erro ao carregar entradas:{" "}
                  {fetchError instanceof Error ? fetchError.message : "Erro desconhecido"}
                </div>
              ) : isLoadingEntries ? (
                <div className="py-8 text-center text-muted-foreground">
                  Carregando entradas...
                </div>
              ) : stockEntries.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  Nenhuma entrada registrada. Clique em "Nova Entrada" para começar.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data da entrega</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Preço Unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockEntries.map((entry) => {
                      const product = entry.product as any;
                      const productCategories = product?.product_categories || [];
                      const categories = productCategories
                        .map((pc: any) => pc.category?.name)
                        .filter(Boolean);
                      const total = (entry.quantity || 0) * (entry.unit_price || 0);
                      return (
                        <TableRow key={entry.id}>
                          <TableCell>{formatDate(entry.movement_date)}</TableCell>
                          <TableCell className="font-medium">
                            {product?.name || "Produto não encontrado"}
                          </TableCell>
                          <TableCell className="text-right">
                            {entry.quantity.toFixed(2)} {product?.unit || ""}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(entry.unit_price || 0)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(total)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {entry.notes || "-"}
                          </TableCell>
                          <TableCell>
                            {categories.length > 0 ? categories.join(", ") : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(entry)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(entry.id)}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

