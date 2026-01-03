"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Trash2, FileText, CheckCircle, List, ArrowLeft, FileBarChart } from "lucide-react";
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
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, X } from "lucide-react";
import type {
  Application,
  Product,
  Field,
  HarvestYear,
  Machinery,
  PracticalRecipe,
  FieldCrop,
  Culture,
} from "@/types/schema";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// Schema de validação para produto da aplicação
const applicationProductSchema = z.object({
  product_id: z.string().min(1, "Produto é obrigatório"),
  dosage: z.number().positive("Dosagem deve ser maior que zero"),
  dosage_unit: z.enum(["L/ha", "mL/ha", "kg/ha"]),
  quantity_used: z.number().positive("Quantidade deve ser maior que zero"),
  cost: z.number().optional(),
});

// Schema de validação para aplicação
const applicationSchema = z.object({
  name: z.string().min(1, "Nome da aplicação é obrigatório"),
  harvest_year_id: z.string().min(1, "Ano Safra é obrigatório"),
  field_id: z.string().min(1, "Talhão é obrigatório"),
  field_crop_id: z.string().min(1, "Cultura/Ciclo é obrigatório"),
  is_partial: z.boolean(),
  partial_area: z.number().optional(),
  application_date: z.string().min(1, "Data é obrigatória"),
  status: z.enum(["planned", "completed", "cancelled", "PLANNED", "DONE", "CANCELED"]),
  notes: z.string().optional(),
  products: z.array(applicationProductSchema).min(1, "Adicione pelo menos um produto"),
});

type ApplicationFormValues = z.infer<typeof applicationSchema>;

// Funções auxiliares
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

async function fetchFieldCrops(fieldId: string, harvestYearId: string): Promise<FieldCrop[]> {
  const { data: crops, error: cropsError } = await supabase
    .from("crops")
    .select("id")
    .eq("harvest_year_id", harvestYearId);

  if (cropsError || !crops) {
    return [];
  }

  const cropIds = crops.map((c) => c.id);
  if (cropIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("field_crops")
    .select(`
      *,
      crop:crops(
        *,
        culture:cultures(*)
      )
    `)
    .eq("field_id", fieldId)
    .in("crop_id", cropIds);

  if (error) {
    return [];
  }

  return data || [];
}

async function createApplication(data: {
  name: string;
  harvest_year_id: string;
  field_id: string;
  field_crop_id: string;
  application_date: string;
  status: string;
  notes?: string;
  is_partial?: boolean;
  partial_area?: number;
  products: Array<{
    product_id: string;
    dosage: number;
    dosage_unit: string;
    quantity_used: number;
    cost?: number;
  }>;
}): Promise<Application> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id || "";

  const { data: newApplication, error } = await supabase
    .from("applications")
    .insert({
      name: data.name,
      harvest_year_id: data.harvest_year_id,
      field_id: data.field_id,
      field_crop_id: data.field_crop_id,
      application_date: data.application_date,
      status: data.status,
      notes: data.notes || null,
      is_partial: data.is_partial || false,
      partial_area: data.partial_area || null,
      user_id: userId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar aplicação: ${error.message}`);
  }

  if (data.products && data.products.length > 0) {
    const applicationProducts = data.products.map((product) => ({
      application_id: newApplication.id,
      product_id: product.product_id,
      dosage: product.dosage,
      dosage_unit: product.dosage_unit,
      quantity_used: product.quantity_used,
      cost: product.cost || 0,
    }));

    const { error: productsError } = await supabase
      .from("application_products")
      .insert(applicationProducts);

    if (productsError) {
      throw new Error(`Erro ao criar produtos da aplicação: ${productsError.message}`);
    }
  }

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

// Função para buscar aplicação individual
async function fetchApplication(id: string): Promise<Application> {
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
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(`Erro ao buscar aplicação: ${error.message}`);
  }

  return data as Application;
}

// Função para buscar maquinários
async function fetchMachineries(): Promise<Machinery[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const query = supabase
    .from("machineries")
    .select("*")
    .eq("type", "pulverizador")
    .order("name", { ascending: true });

  if (user) {
    query.eq("user_id", user.id);
  } else {
    query.is("user_id", null);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao buscar maquinários: ${error.message}`);
  }

  return data || [];
}

// Função para buscar receitas práticas
async function fetchPracticalRecipes(applicationId: string): Promise<PracticalRecipe[]> {
  const { data, error } = await supabase
    .from("practical_recipes")
    .select(`
      *,
      machinery:machineries(*),
      practical_recipe_products:practical_recipe_products(
        *,
        product:products(*)
      )
    `)
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar receitas práticas: ${error.message}`);
  }

  return data || [];
}

// Função para criar receita prática
async function createPracticalRecipe(
  applicationId: string,
  machineryId: string,
  capacityUsedPercent: number,
  applicationRate: number,
  litersOfSolution: number | null,
  areaHectares: number | null,
  multiplier: number,
  products: Array<{
    product_id: string;
    dosage: number;
    quantity_in_recipe: number;
    remaining_quantity: number;
  }>,
  notes: string | null = null
): Promise<PracticalRecipe> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const createdBy = user?.id || null;

  const insertPayload: any = {
    application_id: applicationId,
    machinery_id: machineryId,
    capacity_used_percent: capacityUsedPercent,
    application_rate_liters_per_hectare: applicationRate,
    liters_of_solution: litersOfSolution,
    area_hectares: areaHectares,
    multiplier: multiplier,
    created_by: createdBy,
  };
  // Só adiciona notes se não for null/undefined (temporário até migration ser executada)
  if (notes !== null && notes !== undefined && notes !== "") {
    insertPayload.notes = notes;
  }
  const { data: recipe, error: recipeError } = await supabase
    .from("practical_recipes")
    .insert(insertPayload)
    .select()
    .single();

  if (recipeError || !recipe) {
    throw new Error(`Erro ao criar receita prática: ${recipeError?.message || "Receita não foi criada"}`);
  }

  if (products && products.length > 0) {
    const recipeProducts = products.map((product) => ({
      practical_recipe_id: recipe.id,
      product_id: product.product_id,
      dosage: product.dosage,
      quantity_in_recipe: product.quantity_in_recipe,
      remaining_quantity: product.remaining_quantity,
    }));

    const { error: productsError } = await supabase
      .from("practical_recipe_products")
      .insert(recipeProducts);

    if (productsError) {
      throw new Error(`Erro ao criar produtos da receita: ${productsError.message}`);
    }
  }

  const { data: fullRecipe, error: fetchError } = await supabase
    .from("practical_recipes")
    .select(`
      *,
      practical_recipe_products:practical_recipe_products(*)
    `)
    .eq("id", recipe.id)
    .single();

  if (fetchError || !fullRecipe) {
    return recipe as PracticalRecipe;
  }

  return fullRecipe as PracticalRecipe;
}

// Função para atualizar receita prática
async function updatePracticalRecipe(
  recipeId: string,
  machineryId: string,
  capacityUsedPercent: number,
  applicationRate: number,
  litersOfSolution: number | null,
  areaHectares: number | null,
  multiplier: number,
  products: Array<{
    product_id: string;
    dosage: number;
    quantity_in_recipe: number;
    remaining_quantity: number;
  }>
): Promise<PracticalRecipe> {
  // Atualizar a receita prática
  const updatePayload: any = {
    machinery_id: machineryId,
    capacity_used_percent: capacityUsedPercent,
    application_rate_liters_per_hectare: applicationRate,
    liters_of_solution: litersOfSolution,
    area_hectares: areaHectares,
    multiplier: multiplier,
  };
  // Só adiciona notes se não for null/undefined (temporário até migration ser executada)
  if (notes !== null && notes !== undefined && notes !== "") {
    updatePayload.notes = notes;
  }
  const { data: updatedRecipe, error: recipeError } = await supabase
    .from("practical_recipes")
    .update(updatePayload)
    .eq("id", recipeId)
    .select()
    .single();

  if (recipeError || !updatedRecipe) {
    throw new Error(`Erro ao atualizar receita prática: ${recipeError?.message || "Receita não foi atualizada"}`);
  }

  // Deletar produtos antigos
  const { error: deleteError } = await supabase
    .from("practical_recipe_products")
    .delete()
    .eq("practical_recipe_id", recipeId);

  if (deleteError) {
    throw new Error(`Erro ao deletar produtos antigos: ${deleteError.message}`);
  }

  // Inserir novos produtos
  if (products && products.length > 0) {
    const recipeProducts = products.map((product) => ({
      practical_recipe_id: recipeId,
      product_id: product.product_id,
      dosage: product.dosage,
      quantity_in_recipe: product.quantity_in_recipe,
      remaining_quantity: product.remaining_quantity,
    }));

    const { error: productsError } = await supabase
      .from("practical_recipe_products")
      .insert(recipeProducts);

    if (productsError) {
      throw new Error(`Erro ao atualizar produtos da receita: ${productsError.message}`);
    }
  }

  // Buscar receita completa com produtos
  const { data: fullRecipe, error: fetchError } = await supabase
    .from("practical_recipes")
    .select(`
      *,
      machinery:machineries(*),
      practical_recipe_products:practical_recipe_products(
        *,
        product:products(*)
      )
    `)
    .eq("id", recipeId)
    .single();

  if (fetchError || !fullRecipe) {
    return updatedRecipe as PracticalRecipe;
  }

  return fullRecipe as PracticalRecipe;
}

// Função para deletar receita prática
async function deletePracticalRecipe(recipeId: string): Promise<void> {
  // Deletar produtos primeiro (devido à foreign key)
  const { error: productsError } = await supabase
    .from("practical_recipe_products")
    .delete()
    .eq("practical_recipe_id", recipeId);

  if (productsError) {
    throw new Error(`Erro ao deletar produtos da receita: ${productsError.message}`);
  }

  // Deletar a receita
  const { error: recipeError } = await supabase
    .from("practical_recipes")
    .delete()
    .eq("id", recipeId);

  if (recipeError) {
    throw new Error(`Erro ao deletar receita prática: ${recipeError.message}`);
  }
}

// Função para atualizar aplicação
async function updateApplication(data: {
  id: string;
  name?: string;
  harvest_year_id?: string;
  field_id?: string;
  field_crop_id?: string;
  application_date?: string;
  status?: string;
  notes?: string;
  is_partial?: boolean;
  partial_area?: number;
  products?: Array<{
    product_id: string;
    dosage: number;
    dosage_unit: string;
    quantity_used: number;
    cost?: number;
  }>;
}): Promise<Application> {
  // Extrair id e products explicitamente
  const { id, products, ...updateData } = data;

  // Normalizar status para o formato do banco de dados (maiúsculas)
  let statusValue = updateData.status;
  if (statusValue) {
    if (statusValue === "planned") statusValue = "PLANNED";
    if (statusValue === "completed" || statusValue === "done") statusValue = "DONE";
    if (statusValue === "cancelled" || statusValue === "canceled") statusValue = "CANCELED";
  }

  // Construir payload apenas com campos permitidos (sem products ou id)
  const allowedFields = [
    'name',
    'harvest_year_id',
    'field_id',
    'field_crop_id',
    'application_date',
    'status',
    'notes',
    'is_partial',
    'partial_area',
    'updated_at'
  ] as const;
  
  const cleanPayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  
  // Adicionar apenas campos permitidos que existem em updateData
  for (const field of allowedFields) {
    if (field === 'updated_at') continue; // já foi adicionado
    if (field === 'status' && statusValue !== undefined) {
      cleanPayload[field] = statusValue;
    } else if (updateData[field] !== undefined) {
      cleanPayload[field] = updateData[field];
    }
  }
  
  // Garantir que products e id NÃO estejam no payload
  delete (cleanPayload as any).products;
  delete (cleanPayload as any).id;

  // 1. Atualizar aplicação
  const { error: appError } = await supabase
    .from("applications")
    .update(cleanPayload)
    .eq("id", id);

  if (appError) {
    throw new Error(`Erro ao atualizar aplicação: ${appError.message}`);
  }

  // 2. Se produtos foram fornecidos, atualizar lista de produtos
  if (products && products.length > 0) {
    // Deletar produtos antigos
    const { error: deleteError } = await supabase
      .from("application_products")
      .delete()
      .eq("application_id", id);

    if (deleteError) {
      throw new Error(`Erro ao deletar produtos antigos: ${deleteError.message}`);
    }

    // Inserir novos produtos (apenas com as colunas que existem na tabela)
    const applicationProducts = products.map((product) => ({
      application_id: id,
      product_id: product.product_id,
      dosage: product.dosage,
      quantity_used: product.quantity_used,
      // dosage_unit e cost não existem na tabela application_products
    }));

    const { error: productsError } = await supabase
      .from("application_products")
      .insert(applicationProducts);

    if (productsError) {
      throw new Error(`Erro ao atualizar produtos: ${productsError.message}`);
    }
  }

  // 3. Buscar aplicação atualizada
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
    throw new Error(`Erro ao buscar aplicação atualizada: ${fetchError?.message || "Aplicação não encontrada"}`);
  }

  return updatedApplication as Application;
}

// Função para deletar aplicação
async function deleteApplication(id: string): Promise<void> {
  await supabase.from("application_products").delete().eq("application_id", id);
  const { error } = await supabase.from("applications").delete().eq("id", id);

  if (error) {
    throw new Error(`Erro ao deletar aplicação: ${error.message}`);
  }
}

// Função para formatar data
function formatDate(dateString: string): string {
  if (!dateString) return '';
  
  // Sempre parse como local para evitar problemas de timezone
  // Extrair apenas a parte da data (YYYY-MM-DD) se vier com hora/timezone
  let dateOnly = dateString;
  if (dateString.includes('T')) {
    dateOnly = dateString.split('T')[0];
  }
  if (dateString.includes(' ')) {
    dateOnly = dateString.split(' ')[0];
  }
  
  // Parse como data local (não UTC)
  const [year, month, day] = dateOnly.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    // Fallback para new Date se não conseguir parsear
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  
  const date = new Date(year, month - 1, day); // month é 0-indexed, cria data local
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateForInput(dateString: string): string {
  // Parse a data como local para evitar problemas de timezone
  if (dateString.includes('T')) {
    // Se tem hora, extrair apenas a parte da data
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } else {
    // Se já é só data (YYYY-MM-DD), retornar direto
    return dateString;
  }
}

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const applicationId = params.id as string;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRecipeDialogOpen, setIsRecipeDialogOpen] = useState(false);
  const [isViewRecipesDialogOpen, setIsViewRecipesDialogOpen] = useState(false);
  const [selectedMachineryId, setSelectedMachineryId] = useState("");
  const [capacityUsedPercent, setCapacityUsedPercent] = useState(100);
  const [applicationRate, setApplicationRate] = useState(0);
  const [calculationMode, setCalculationMode] = useState<"liters" | "area">("liters");
  const [litersOfSolution, setLitersOfSolution] = useState(0);
  const [areaHectares, setAreaHectares] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [dosageInputs, setDosageInputs] = useState<Record<number, string>>({});
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [recipeNotes, setRecipeNotes] = useState<string>("");

  // Query para buscar aplicação
  const { data: application, isLoading, error } = useQuery({
    queryKey: ["application", applicationId],
    queryFn: () => fetchApplication(applicationId),
  });

  // Query para buscar maquinários
  const { data: machineries = [] } = useQuery({
    queryKey: ["machineries"],
    queryFn: fetchMachineries,
  });

  // Query para buscar receitas práticas
  const { data: practicalRecipes = [] } = useQuery({
    queryKey: ["practical_recipes", applicationId],
    queryFn: () => fetchPracticalRecipes(applicationId),
    enabled: !!applicationId,
  });

  // Inicializar produtos selecionados quando application muda
  useEffect(() => {
    if (application?.application_products) {
      const productIds = (application.application_products as any[]).map((ap: any) => {
        const product = ap.product as Product;
        return product?.id;
      }).filter(Boolean);
      setSelectedProducts(new Set(productIds));
    } else {
      setSelectedProducts(new Set());
    }
  }, [application]);

  // Queries para o dialog de edição
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

  // Form para edição
  const form = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      name: "",
      harvest_year_id: "",
      field_id: "",
      field_crop_id: "",
      is_partial: false,
      partial_area: undefined,
      application_date: "",
      status: "planned",
      notes: "",
      products: [],
    },
  });

  const selectedFieldId = form.watch("field_id");
  const selectedHarvestYearId = form.watch("harvest_year_id");
  const isPartial = form.watch("is_partial");

  const { data: fieldCrops = [] } = useQuery({
    queryKey: ["field_crops", selectedFieldId, selectedHarvestYearId],
    queryFn: () => fetchFieldCrops(selectedFieldId, selectedHarvestYearId),
    enabled: !!selectedFieldId && !!selectedHarvestYearId,
  });

  const { fields: productFields, append, remove } = useFieldArray({
    control: form.control,
    name: "products",
  });

  // Funções auxiliares para o formulário
  const formatToTwoDecimals = (value: number): number => {
    return Math.round(value * 100) / 100;
  };

  const getProductAveragePrice = async (productId: string): Promise<number> => {
    const { data: movements } = await supabase
      .from("stock_movements")
      .select("quantity, unit_price")
      .eq("product_id", productId)
      .in("movement_type", ["entry", "IN"]);

    if (!movements || movements.length === 0) return 0;

    let totalValue = 0;
    let totalQuantity = 0;

    movements.forEach((movement) => {
      const quantity = movement.quantity || 0;
      const unitPrice = movement.unit_price || 0;
      totalValue += quantity * unitPrice;
      totalQuantity += quantity;
    });

    return totalQuantity > 0 ? totalValue / totalQuantity : 0;
  };

  const getEffectiveArea = (fieldId: string): number => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return 0;

    const isPartialValue = form.watch("is_partial");
    const partialArea = form.watch("partial_area");

    let area = (field as any).area_hct ?? field.area_hectares ?? 0;

    if (isPartialValue && partialArea && partialArea > 0) {
      area = partialArea;
    }

    return area;
  };

  const calculateQuantity = async (fieldId: string, dosage: number, index: number) => {
    if (dosage <= 0) return;
    const area = getEffectiveArea(fieldId);
    if (area <= 0) return;
    
    const quantity = formatToTwoDecimals(dosage * area);
    form.setValue(`products.${index}.quantity_used`, quantity);
    
    const productId = form.watch(`products.${index}.product_id`);
    if (productId && quantity > 0) {
      await calculateCost(productId, quantity, index);
    }
  };

  const calculateDosage = async (fieldId: string, quantity: number, index: number) => {
    if (quantity <= 0) return;
    const area = getEffectiveArea(fieldId);
    if (area <= 0) return;
    
    const dosage = formatToTwoDecimals(quantity / area);
    form.setValue(`products.${index}.dosage`, dosage);
    
    const productId = form.watch(`products.${index}.product_id`);
    if (productId && quantity > 0) {
      await calculateCost(productId, quantity, index);
    }
  };

  const calculateCost = async (productId: string, quantity: number, index: number) => {
    if (!productId || quantity <= 0) {
      form.setValue(`products.${index}.cost`, 0);
      return;
    }
    
    const averagePrice = await getProductAveragePrice(productId);
    if (averagePrice > 0) {
      const cost = formatToTwoDecimals(quantity * averagePrice);
      form.setValue(`products.${index}.cost`, cost);
    } else {
      form.setValue(`products.${index}.cost`, 0);
    }
  };

  const addProduct = () => {
    append({
      product_id: "",
      dosage: 0,
      dosage_unit: "L/ha",
      quantity_used: 0,
      cost: 0,
    });
  };

  const onSubmit = (data: ApplicationFormValues) => {
    updateMutation.mutate({
      id: applicationId,
      ...data,
    });
  };

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      form.reset();
    }
  };

  // Mutation para atualizar aplicação
  const updateMutation = useMutation({
    mutationFn: updateApplication,
    onSuccess: () => {
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["application", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (error: Error) => {
      alert(`Erro ao atualizar aplicação: ${error.message}`);
    },
  });

  // Mutation para deletar aplicação
  const deleteMutation = useMutation({
    mutationFn: deleteApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      router.push("/aplicacoes");
    },
    onError: (error: Error) => {
      alert(`Erro ao deletar aplicação: ${error.message}`);
    },
  });

  // Mutation para criar receita prática
  const createRecipeMutation = useMutation({
    mutationFn: async (params: {
      applicationId: string;
      machineryId: string;
      capacityUsedPercent: number;
      applicationRate: number;
      litersOfSolution: number | null;
      areaHectares: number | null;
      multiplier: number;
      products: Array<{
        product_id: string;
        dosage: number;
        quantity_in_recipe: number;
        remaining_quantity: number;
      }>;
      notes: string | null;
    }) => {
      return createPracticalRecipe(
        params.applicationId,
        params.machineryId,
        params.capacityUsedPercent,
        params.applicationRate,
        params.litersOfSolution,
        params.areaHectares,
        params.multiplier,
        params.products,
        params.notes
      );
    },
    onSuccess: (newRecipe) => {
      queryClient.invalidateQueries({ queryKey: ["practical_recipes", applicationId] });
      setIsRecipeDialogOpen(false);
      setSelectedMachineryId("");
      setCapacityUsedPercent(100);
      setApplicationRate(0);
      setCalculationMode("liters");
      setLitersOfSolution(0);
      setAreaHectares(0);
      setMultiplier(1);
      router.push(`/aplicacoes/receitas/${newRecipe.id}`);
    },
    onError: (error: Error) => {
      alert(`Erro ao gerar receita prática: ${error.message}`);
    },
  });

  const handleGenerateRecipe = () => {
    if (!application) return;
    setIsRecipeDialogOpen(true);
  };

  const handleViewRecipes = () => {
    setIsViewRecipesDialogOpen(true);
  };

  // Handler para editar receita prática
  const handleEditRecipe = (recipe: PracticalRecipe) => {
    // Redirecionar para a página de edição ou abrir dialog de edição
    // Por enquanto, vamos apenas redirecionar para a página de visualização
    router.push(`/aplicacoes/receitas/${recipe.id}`);
  };

  // Handler para excluir receita prática
  const handleDeleteRecipe = async (recipeId: string) => {
    if (confirm("Tem certeza que deseja excluir esta receita prática?")) {
      try {
        await deletePracticalRecipe(recipeId);
        queryClient.invalidateQueries({ queryKey: ["practical_recipes", applicationId] });
      } catch (error: any) {
        alert(`Erro ao excluir receita prática: ${error.message}`);
      }
    }
  };

  const handleMarkAsDone = () => {
    if (!application) return;
    if (confirm("Tem certeza que deseja marcar esta aplicação como realizada?")) {
      updateMutation.mutate({
        id: application.id,
        status: "DONE",
      });
    }
  };

  const handleEdit = () => {
    if (!application) return;

    // Normaliza status para o formato do formulário
    let statusValue = application.status as string;
    if (statusValue === "PLANNED") statusValue = "planned";
    if (statusValue === "DONE") statusValue = "completed";
    if (statusValue === "CANCELED") statusValue = "cancelled";

    // Prepara produtos
    const applicationProducts = (application.application_products || []).map((ap: any) => ({
      product_id: ap.product_id,
      dosage: ap.dosage,
      dosage_unit: (ap.dosage_unit || "L/ha") as "L/ha" | "mL/ha" | "kg/ha",
      quantity_used: ap.quantity_used,
      cost: 0,
    }));

    form.reset({
      name: application.name || "",
      harvest_year_id: application.harvest_year_id,
      field_id: application.field_id,
      field_crop_id: (application as any).field_crop_id || "",
      is_partial: (application as any).is_partial || false,
      partial_area: (application as any).partial_area || undefined,
      application_date: formatDateForInput(application.application_date),
      status: statusValue as any,
      notes: application.notes || "",
      products: applicationProducts,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = () => {
    if (!application) return;
    if (confirm("Tem certeza que deseja excluir esta aplicação?")) {
      deleteMutation.mutate(application.id);
    }
  };

  // Função para calcular área restante
  const calculateRemainingArea = (app: Application, recipes: PracticalRecipe[]): number => {
    const totalArea = app.is_partial && app.partial_area 
      ? app.partial_area 
      : ((app.field as Field)?.area_hectares || 0);
    
    const usedArea = recipes.reduce((sum, recipe) => {
      return sum + (recipe.area_hectares || 0) * (recipe.multiplier || 1);
    }, 0);
    
    return Math.max(0, totalArea - usedArea);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-muted-foreground">Carregando aplicação...</p>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-destructive">
              Erro ao carregar aplicação: {error instanceof Error ? error.message : "Erro desconhecido"}
            </p>
            <div className="mt-4 text-center">
              <Link href="/aplicacoes">
                <Button variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar para Aplicações
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const applicationProducts = (application.application_products || []).map((ap: any) => ({
    product: ap.product as Product,
    dosage: ap.dosage || 0,
    dosage_unit: ap.dosage_unit || "L/ha",
    quantity_used: ap.quantity_used || 0,
  }));

  const field = application.field as Field | undefined;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Botão Voltar */}
      <div>
        <Link href="/aplicacoes">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>
      </div>

      {/* Cabeçalho com Título */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{application.name || "Aplicação"}</h1>
        <p className="text-muted-foreground">
          Detalhes da aplicação
        </p>
      </div>

      {/* Botões de Ação */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={handleGenerateRecipe}
          className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
        >
          <FileText className="h-4 w-4 mr-2" />
          Gerar Receita Prática
        </Button>
        <Button
          variant="outline"
          onClick={handleViewRecipes}
          className="bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
        >
          <List className="h-4 w-4 mr-2" />
          Ver Receitas práticas
        </Button>
        {((application.status as string) === "PLANNED" ||
          (application.status as string) === "planned") && (
          <Button
            variant="outline"
            onClick={handleMarkAsDone}
            className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Marcar como Realizado
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={handleEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {/* Lista de Produtos */}
      <Card>
        <CardHeader>
          <CardTitle>Produtos da Aplicação</CardTitle>
          <CardDescription>
            Lista de produtos com suas respectivas doses e quantidades
          </CardDescription>
        </CardHeader>
        <CardContent>
          {applicationProducts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum produto cadastrado nesta aplicação.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Dosagem</TableHead>
                  <TableHead>Quantidade Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applicationProducts.map((ap, index) => {
                  const product = ap.product as Product;
                  return (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {product?.name || "Produto não encontrado"}
                      </TableCell>
                      <TableCell>
                        {ap.dosage.toFixed(2)} {ap.dosage_unit || "L/ha"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {ap.quantity_used.toFixed(2)} {product?.unit || ""}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Editar Aplicação */}
      <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Aplicação</DialogTitle>
            <DialogDescription>
              Atualize as informações da aplicação
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Cabeçalho */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Informações Gerais</h3>
                
                {/* Nome da Aplicação */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Aplicação</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Aplicação de Herbicida - Soja"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                            {fields.map((fieldItem) => (
                              <SelectItem key={fieldItem.id} value={fieldItem.id}>
                                {fieldItem.name}
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
                              const crop = fieldCrop.crop as any;
                              const culture = crop?.culture as Culture | undefined;
                              const cycle = crop?.cycle || "";
                              return (
                                <SelectItem key={fieldCrop.id} value={fieldCrop.id}>
                                  {culture?.name || "Cultura"} - {cycle || "Ciclo"}
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
                  <>
                    <FormField
                      control={form.control}
                      name="is_partial"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(checked) => {
                                field.onChange(checked);
                                if (!checked) {
                                  form.setValue("partial_area", undefined);
                                }
                              }}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Aplicação Parcial?</FormLabel>
                            <p className="text-sm text-muted-foreground">
                              Marque se a aplicação será em uma área parcial do talhão
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />
                    {isPartial && (
                      <FormField
                        control={form.control}
                        name="partial_area"
                        render={({ field }) => {
                          const selectedField = fields.find((f) => f.id === selectedFieldId);
                          const maxArea = selectedField 
                            ? ((selectedField as any).area_hct ?? selectedField.area_hectares ?? 0)
                            : 0;
                          
                          return (
                            <FormItem>
                              <FormLabel>Área a Aplicar (ha)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={maxArea}
                                  placeholder="0.00"
                                  value={field.value || ""}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    if (!isNaN(value)) {
                                      if (value > maxArea) {
                                        form.setError("partial_area", {
                                          type: "manual",
                                          message: `A área não pode ser maior que a área total do talhão (${maxArea.toFixed(2)} ha)`,
                                        });
                                      } else {
                                        form.clearErrors("partial_area");
                                        field.onChange(Math.round(value * 100) / 100);
                                      }
                                    } else {
                                      field.onChange(undefined);
                                    }
                                  }}
                                  onBlur={field.onBlur}
                                />
                              </FormControl>
                              <FormDescription>
                                Área máxima: {maxArea.toFixed(2)} ha
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    )}
                  </>
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
                                <FormItem className="col-span-3">
                                  <FormLabel>Produto</FormLabel>
                                  <Select 
                                    onValueChange={async (value) => {
                                      field.onChange(value);
                                      const quantity = form.watch(`products.${index}.quantity_used`);
                                      if (value && quantity > 0) {
                                        await calculateCost(value, quantity, index);
                                      }
                                    }} 
                                    value={field.value}
                                  >
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
                              render={({ field }) => {
                                const localValue = dosageInputs[index] !== undefined 
                                  ? dosageInputs[index]
                                  : (field.value !== undefined && field.value !== null && field.value !== 0
                                      ? field.value.toString().replace('.', ',')
                                      : "");
                                
                                return (
                                  <FormItem className="col-span-2">
                                    <FormLabel>Dosagem</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0.5"
                                        value={localValue}
                                        onChange={(e) => {
                                          let inputValue = e.target.value;
                                          inputValue = inputValue.replace(/[^0-9,.]/g, '');
                                          
                                          setDosageInputs(prev => ({ ...prev, [index]: inputValue }));
                                          
                                          if (inputValue === "") {
                                            setDosageInputs(prev => {
                                              const newState = { ...prev };
                                              delete newState[index];
                                              return newState;
                                            });
                                            field.onChange(0);
                                            return;
                                          }
                                          
                                          const normalizedValue = inputValue.replace(',', '.');
                                          
                                          if (normalizedValue === "0." || normalizedValue === "0," || normalizedValue === "0") {
                                            return;
                                          }
                                          
                                          const value = parseFloat(normalizedValue);
                                          
                                          if (!isNaN(value) && value >= 0) {
                                            const formattedValue = formatToTwoDecimals(value);
                                            field.onChange(formattedValue);
                                            setDosageInputs(prev => ({ ...prev, [index]: formattedValue.toString().replace('.', ',') }));
                                            const fieldId = form.watch("field_id");
                                            if (fieldId && formattedValue > 0) {
                                              calculateQuantity(fieldId, formattedValue, index);
                                            }
                                          }
                                        }}
                                        onBlur={(e) => {
                                          const normalizedValue = e.target.value.replace(',', '.');
                                          const value = parseFloat(normalizedValue);
                                          if (!isNaN(value) && value >= 0) {
                                            const formattedValue = formatToTwoDecimals(value);
                                            field.onChange(formattedValue);
                                            setDosageInputs(prev => ({ ...prev, [index]: formattedValue.toString().replace('.', ',') }));
                                          } else {
                                            field.onChange(0);
                                            setDosageInputs(prev => {
                                              const newState = { ...prev };
                                              delete newState[index];
                                              return newState;
                                            });
                                          }
                                          field.onBlur();
                                        }}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                );
                              }}
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
                                <FormItem className="col-span-2">
                                  <FormLabel>Quantidade Total</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      placeholder="0.00"
                                      value={(() => {
                                        const val = field.value;
                                        if (val === undefined || val === null) return "";
                                        if (val === 0) return "";
                                        return val.toString().replace('.', ',');
                                      })()}
                                      onChange={async (e) => {
                                        let inputValue = e.target.value;
                                        inputValue = inputValue.replace(/[^0-9,.]/g, '');
                                        
                                        if (inputValue === "") {
                                          field.onChange(0);
                                          return;
                                        }
                                        
                                        const normalizedValue = inputValue.replace(',', '.');
                                        const value = parseFloat(normalizedValue);
                                        if (!isNaN(value) && value >= 0) {
                                          const formattedValue = formatToTwoDecimals(value);
                                          field.onChange(formattedValue);
                                          const fieldId = form.watch("field_id");
                                          const productId = form.watch(`products.${index}.product_id`);
                                          if (fieldId && formattedValue > 0) {
                                            await calculateDosage(fieldId, formattedValue, index);
                                          } else if (productId && formattedValue > 0) {
                                            await calculateCost(productId, formattedValue, index);
                                          }
                                        }
                                      }}
                                      onBlur={(e) => {
                                        const normalizedValue = e.target.value.replace(',', '.');
                                        const value = parseFloat(normalizedValue);
                                        if (!isNaN(value) && value >= 0) {
                                          field.onChange(formatToTwoDecimals(value));
                                        } else {
                                          field.onChange(0);
                                        }
                                        field.onBlur();
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`products.${index}.cost`}
                              render={({ field }) => (
                                <FormItem className="col-span-2">
                                  <FormLabel>Custo (R$)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="text"
                                      placeholder="0.00"
                                      readOnly
                                      value={field.value !== undefined && field.value !== null 
                                        ? formatToTwoDecimals(field.value).toFixed(2).replace('.', ',')
                                        : "0,00"}
                                      className="bg-muted cursor-not-allowed"
                                    />
                                  </FormControl>
                                  <FormDescription className="text-xs">
                                    Calculado automaticamente
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="col-span-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setDosageInputs(prev => {
                                    const newState = { ...prev };
                                    delete newState[index];
                                    return newState;
                                  });
                                  remove(index);
                                }}
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
                  disabled={updateMutation.isPending}
                >
                  Salvar Alterações
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Gerar Receita Prática */}
      <Dialog open={isRecipeDialogOpen} onOpenChange={setIsRecipeDialogOpen}>
        <DialogContent className="max-w-[95vw] min-w-[1400px] max-h-[90vh] overflow-y-auto w-[95vw]">
          <DialogHeader>
            <DialogTitle>Gerar Receita Prática</DialogTitle>
            <DialogDescription>
              Configure os parâmetros para gerar a receita prática de aplicação
            </DialogDescription>
          </DialogHeader>
          {application && (
            <div className="space-y-6">
              {/* Informações da Aplicação */}
              <div className="border-b pb-4">
                <p className="text-sm font-medium">
                  Aplicação: {formatDate(application.application_date)} - {field?.name}
                </p>
                {(() => {
                  const totalArea = application.is_partial && application.partial_area 
                    ? application.partial_area 
                    : (field?.area_hectares || 0);
                  
                  if (totalArea > 0) {
                    return (
                      <p className="text-sm font-medium mt-1">
                        Área do talhão: {totalArea.toFixed(2)} ha
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Seção 1: Seleção do Maquinário */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Seleção do Maquinário</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="machinery-select">Pulverizador</Label>
                    <Select
                      value={selectedMachineryId}
                      onValueChange={(value) => {
                        setSelectedMachineryId(value);
                        const machinery = machineries.find((m) => m.id === value);
                        if (machinery) {
                          // Usar capacidade total do tanque
                          const liters = machinery.tank_capacity_liters;
                          if (calculationMode === "liters") {
                            setLitersOfSolution(liters);
                            if (applicationRate > 0) {
                              setAreaHectares(liters / applicationRate);
                            }
                          }
                        }
                      }}
                    >
                      <SelectTrigger id="machinery-select">
                        <SelectValue placeholder="Selecione o pulverizador" />
                      </SelectTrigger>
                      <SelectContent>
                        {machineries.map((machinery) => (
                          <SelectItem key={machinery.id} value={machinery.id}>
                            {machinery.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedMachineryId && (
                    <div>
                      <Label>Capacidade de Calda</Label>
                      <p className="text-sm font-medium mt-2">
                        {machineries.find((m) => m.id === selectedMachineryId)?.tank_capacity_liters.toFixed(0)} L
                      </p>
                    </div>
                  )}
                </div>

              </div>

              {/* Seção 2: Configuração da Calda */}
              {selectedMachineryId && (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-lg font-semibold">Configuração da Calda</h3>
                  
                  <div>
                    <Label htmlFor="application-rate">Taxa de Aplicação (L/ha)</Label>
                    <Input
                      id="application-rate"
                      type="number"
                      min="0"
                      step="0.1"
                      value={applicationRate || ""}
                      onChange={(e) => {
                        const rate = parseFloat(e.target.value) || 0;
                        setApplicationRate(rate);
                        if (rate > 0) {
                          if (calculationMode === "liters" && litersOfSolution > 0) {
                            setAreaHectares(litersOfSolution / rate);
                          } else if (calculationMode === "area" && areaHectares > 0) {
                            setLitersOfSolution(areaHectares * rate);
                          }
                        }
                      }}
                    />
                  </div>

                  <div>
                    <Label htmlFor="calculation-mode">Modo de Cálculo</Label>
                    <Select
                      value={calculationMode}
                      onValueChange={(value: "liters" | "area") => {
                        setCalculationMode(value);
                      }}
                    >
                      <SelectTrigger id="calculation-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="liters">Definir Litros de Calda → Calcular Área</SelectItem>
                        <SelectItem value="area">Definir Área → Calcular Litros de Calda</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {calculationMode === "liters" ? (
                    <div>
                      <Label htmlFor="liters-solution">Litros de Calda</Label>
                      <Input
                        id="liters-solution"
                        type="number"
                        min="0"
                        step="0.1"
                        value={litersOfSolution || ""}
                        onChange={(e) => {
                          const liters = parseFloat(e.target.value) || 0;
                          setLitersOfSolution(liters);
                          if (applicationRate > 0 && liters > 0) {
                            setAreaHectares(liters / applicationRate);
                          }
                        }}
                      />
                      {applicationRate > 0 && litersOfSolution > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Área calculada: {areaHectares.toFixed(2)} ha
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="area-hectares">Área (ha)</Label>
                      <Input
                        id="area-hectares"
                        type="number"
                        min="0"
                        step="0.01"
                        value={areaHectares || ""}
                        onChange={(e) => {
                          const area = parseFloat(e.target.value) || 0;
                          setAreaHectares(area);
                          if (applicationRate > 0 && area > 0) {
                            setLitersOfSolution(area * applicationRate);
                          }
                        }}
                      />
                      {applicationRate > 0 && areaHectares > 0 && (() => {
                        const machinery = machineries.find((m) => m.id === selectedMachineryId);
                        const totalCapacity = machinery?.tank_capacity_liters || 0;
                        const calculatedLiters = areaHectares * applicationRate;
                        const exceedsCapacity = calculatedLiters > totalCapacity;
                        return (
                          <p className={`text-sm mt-1 ${exceedsCapacity ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                            Litros de calda necessários: {calculatedLiters.toFixed(2)} L
                            {exceedsCapacity && (
                              <span className="block mt-1">⚠️ Excede a capacidade do tanque ({totalCapacity.toFixed(0)} L). Deve ser menor ou igual.</span>
                            )}
                          </p>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Seção 3: Quantidade de Bombas */}
              {selectedMachineryId && areaHectares > 0 && (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-lg font-semibold">Quantidade de bombas</h3>
                  <div>
                    <Label htmlFor="multiplier">Para quantas bombas do pulverizador você quer aplicar essa receita?</Label>
                    <Input
                      id="multiplier"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={multiplier === 0 ? "" : multiplier}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "") {
                          setMultiplier(0);
                          return;
                        }
                        const mult = parseFloat(value);
                        if (!isNaN(mult)) {
                          setMultiplier(Math.max(0.01, mult));
                        }
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        if (value === "" || parseFloat(value) < 0.01) {
                          setMultiplier(1);
                        }
                      }}
                    />
                    {(() => {
                      const field = application.field as Field | undefined;
                      const totalArea = application.is_partial && application.partial_area 
                        ? application.partial_area 
                        : (field?.area_hectares || 0);
                      
                      if (totalArea > 0 && areaHectares > 0) {
                        const recommendedBombs = totalArea / areaHectares;
                        return (
                          <p className="text-sm text-muted-foreground mt-1">
                            Para essa área serão necessárias {recommendedBombs.toFixed(2)} bombas
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              )}

              {/* Seção 4: Lista de Produtos */}
              {applicationProducts.length > 0 && areaHectares > 0 && (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-lg font-semibold">Produtos da Aplicação</h3>
                  <div className="overflow-x-auto w-full">
                    <Table className="w-full min-w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Incluir</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Dosagem</TableHead>
                          <TableHead>Quantidade Total</TableHead>
                          <TableHead>Quantidade na Receita</TableHead>
                          <TableHead>Quantidade Restante</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {applicationProducts.map((ap, index) => {
                          const product = ap.product as Product;
                          const productId = product?.id;
                          const isSelected = productId ? selectedProducts.has(productId) : false;
                          const dosage = ap.dosage || 0;
                          const totalQuantity = ap.quantity_used || 0;
                          const areaInRecipe = areaHectares * multiplier;
                          const quantityInRecipe = dosage * areaInRecipe;
                          
                          const totalUsedInPreviousRecipes = practicalRecipes.reduce((sum, recipe) => {
                            const recipeProduct = recipe.practical_recipe_products?.find(
                              (prp: any) => prp.product_id === product.id
                            );
                            if (recipeProduct) {
                              return sum + (recipeProduct.quantity_in_recipe || 0);
                            }
                            return sum;
                          }, 0);
                          
                          const remainingQuantity = totalQuantity - totalUsedInPreviousRecipes - quantityInRecipe;

                          return (
                            <TableRow key={index} className={!isSelected ? "opacity-50" : ""}>
                              <TableCell>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => {
                                    if (productId) {
                                      setSelectedProducts((prev) => {
                                        const newSet = new Set(prev);
                                        if (checked) {
                                          newSet.add(productId);
                                        } else {
                                          newSet.delete(productId);
                                        }
                                        return newSet;
                                      });
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{product?.name || "Produto"}</TableCell>
                              <TableCell>
                                {dosage.toFixed(2)} {ap.dosage_unit || "L/ha"}
                              </TableCell>
                              <TableCell>{totalQuantity.toFixed(2)}</TableCell>
                              <TableCell className="font-medium">
                                {quantityInRecipe.toFixed(2)}
                              </TableCell>
                              <TableCell
                                className={
                                  remainingQuantity < 0
                                    ? "text-red-600 font-medium"
                                    : "text-muted-foreground"
                                }
                              >
                                {remainingQuantity.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    </div>
                  </div>
                )}

              {/* Campo de Observações */}
              <div className="space-y-4 border-t pt-4">
                <Label htmlFor="recipe-notes">Observações (Opcional)</Label>
                <Textarea
                  id="recipe-notes"
                  placeholder="Adicione observações sobre esta receita prática (opcional)"
                  value={recipeNotes}
                  onChange={(e) => setRecipeNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsRecipeDialogOpen(false);
                    setSelectedMachineryId("");
                    setCapacityUsedPercent(100);
                    setApplicationRate(0);
                    setCalculationMode("liters");
                    setLitersOfSolution(0);
                    setAreaHectares(0);
                    setMultiplier(1);
                    setSelectedProducts(new Set());
                    setRecipeNotes("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    if (!application || !selectedMachineryId) return;

                    const machinery = machineries.find((m) => m.id === selectedMachineryId);
                    if (machinery) {
                      const totalCapacity = machinery.tank_capacity_liters;
                      const calculatedLiters = calculationMode === "liters" 
                        ? litersOfSolution 
                        : (areaHectares * applicationRate);
                      
                      if (calculatedLiters > totalCapacity) {
                        alert(`Erro: Os litros de calda necessários (${calculatedLiters.toFixed(2)} L) excedem a capacidade do tanque (${totalCapacity.toFixed(0)} L). Deve ser menor ou igual.`);
                        return;
                      }
                    }

                    // Validar se há pelo menos um produto selecionado
                    if (selectedProducts.size === 0) {
                      alert("Selecione pelo menos um produto para incluir na receita.");
                      return;
                    }

                    try {
                      // Preparar produtos para salvar (apenas os selecionados)
                      const productsToSave = applicationProducts
                        .filter((ap) => {
                          const product = ap.product as Product;
                          return product?.id && selectedProducts.has(product.id);
                        })
                        .map((ap) => {
                          const product = ap.product as Product;
                          const dosage = ap.dosage || 0;
                          const areaInRecipe = areaHectares * multiplier;
                          const quantityInRecipe = dosage * areaInRecipe;
                          
                          const totalUsedInPreviousRecipes = practicalRecipes.reduce((sum, recipe) => {
                            const recipeProduct = recipe.practical_recipe_products?.find(
                              (prp: any) => prp.product_id === product.id
                            );
                            if (recipeProduct) {
                              return sum + (recipeProduct.quantity_in_recipe || 0);
                            }
                            return sum;
                          }, 0);
                          
                          const totalQuantity = ap.quantity_used || 0;
                          const remainingQuantity = totalQuantity - totalUsedInPreviousRecipes - quantityInRecipe;

                          return {
                            product_id: product.id,
                            dosage: dosage,
                            quantity_in_recipe: quantityInRecipe,
                            remaining_quantity: remainingQuantity,
                          };
                        });

                      createRecipeMutation.mutate({
                        applicationId: application.id,
                        machineryId: selectedMachineryId,
                        capacityUsedPercent: 100, // Sempre usar 100% da capacidade
                        applicationRate,
                        litersOfSolution: calculationMode === "liters" ? litersOfSolution : null,
                        areaHectares: calculationMode === "area" ? areaHectares : null,
                        multiplier,
                        products: productsToSave,
                        notes: recipeNotes || null,
                      });
                    } catch (error: any) {
                      alert(`Erro ao gerar receita prática: ${error.message}`);
                    }
                  }}
                  disabled={!selectedMachineryId || areaHectares <= 0 || applicationRate <= 0}
                >
                  Gerar Receita
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog para Ver Receitas Práticas */}
      <Dialog open={isViewRecipesDialogOpen} onOpenChange={setIsViewRecipesDialogOpen}>
        <DialogContent className="max-w-[95vw] min-w-[1200px] max-h-[90vh] overflow-y-auto w-[95vw]">
          <DialogHeader>
            <DialogTitle>Receitas Práticas</DialogTitle>
            <DialogDescription asChild>
              <span>Aplicação: {application.name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Card informativo com área restante */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Área sem receita</p>
                    <p className="text-2xl font-bold">
                      {calculateRemainingArea(application, practicalRecipes).toFixed(2)} ha
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabela de receitas práticas */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Receitas Criadas</h3>
              {practicalRecipes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma receita prática criada para esta aplicação.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data de Geração</TableHead>
                      <TableHead>Maquinário</TableHead>
                      <TableHead>Área (ha)</TableHead>
                      <TableHead>Litros de Calda</TableHead>
                      <TableHead>Taxa de Aplicação</TableHead>
                      <TableHead>Multiplicador</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {practicalRecipes.map((recipe) => {
                      const machinery = recipe.machinery as Machinery | undefined;
                      return (
                        <TableRow 
                          key={recipe.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/aplicacoes/receitas/${recipe.id}`)}
                        >
                          <TableCell>
                            {formatDate(recipe.created_at)}
                          </TableCell>
                          <TableCell>
                            {machinery?.name || "Maquinário não encontrado"}
                          </TableCell>
                          <TableCell>
                            {(recipe.area_hectares || 0).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {(recipe.liters_of_solution || 0).toFixed(2)} L
                          </TableCell>
                          <TableCell>
                            {recipe.application_rate_liters_per_hectare.toFixed(2)} L/ha
                          </TableCell>
                          <TableCell>
                            {recipe.multiplier}x
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditRecipe(recipe);
                                }}
                                title="Editar receita"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRecipe(recipe.id);
                                }}
                                title="Excluir receita"
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
            </div>

            {/* Botão Relatório de Carregamento */}
            <div className="pt-4 border-t">
              <Link href={`/aplicacoes/${applicationId}/carregamento`}>
                <Button
                  variant="outline"
                  className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200"
                >
                  <FileBarChart className="h-4 w-4 mr-2" />
                  Relatório de carregamento
                </Button>
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
