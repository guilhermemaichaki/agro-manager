"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, FileText, CheckCircle, List, Filter, Eye, ArrowDown } from "lucide-react";
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
import { Label } from "@/components/ui/label";
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
  Culture,
  Machinery,
  PracticalRecipe,
} from "@/types/schema";
import { supabase } from "@/lib/supabase";
import { Checkbox } from "@/components/ui/checkbox";

// Schema de validação para produto da aplicação
const applicationProductSchema = z.object({
  product_id: z.string().min(1, "Produto é obrigatório"),
  dosage: z.number().positive("Dosagem deve ser maior que zero"),
  dosage_unit: z.enum(["L/ha", "mL/ha", "kg/ha"]),
  quantity_used: z.number().positive("Quantidade deve ser maior que zero"),
  cost: z.number().optional(), // Custo da aplicação
});

// Schema de validação para aplicação
const applicationSchema = z.object({
  name: z.string().min(1, "Nome da aplicação é obrigatório"),
  harvest_year_id: z.string().min(1, "Ano Safra é obrigatório"),
  field_id: z.string().min(1, "Talhão é obrigatório"),
  field_crop_id: z.string().min(1, "Cultura/Ciclo é obrigatório"),
  is_partial: z.boolean(), // Aplicação parcial
  partial_area: z.number().optional(), // Área em hectares para aplicação parcial
  application_date: z.string().min(1, "Data é obrigatória"),
  status: z.enum(["planned", "completed", "cancelled", "PLANNED", "DONE", "CANCELED"]),
  notes: z.string().optional(),
  products: z.array(applicationProductSchema).min(1, "Adicione pelo menos um produto"),
});

type ApplicationFormValues = z.infer<typeof applicationSchema>;

// Tipos para API
interface CreateApplicationInput {
  name: string; // Nome da aplicação
  harvest_year_id: string;
  field_id: string;
  field_crop_id: string;
  application_date: string;
  status: string;
  notes?: string;
  is_partial?: boolean;
  partial_area?: number;
  products: ApplicationProductInput[];
}

interface ApplicationProductInput {
  product_id: string;
  dosage: number;
  dosage_unit: string;
  quantity_used: number;
  cost?: number;
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
  // Primeiro buscar os crops do ano safra
  const { data: crops, error: cropsError } = await supabase
    .from("crops")
    .select("id")
    .eq("harvest_year_id", harvestYearId);

  if (cropsError || !crops || crops.length === 0) {
    return [];
  }

  const cropIds = crops.map((c) => c.id);

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
    throw new Error(`Erro ao buscar culturas planejadas: ${error.message}`);
  }

  return data || [];
}

// Função para buscar maquinários (apenas pulverizadores)
async function fetchMachineries(): Promise<Machinery[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Buscar maquinários - permitir sem autenticação (user_id pode ser null)
  const query = supabase
    .from("machineries")
    .select("*")
    .eq("type", "pulverizador")
    .order("name", { ascending: true });

  // Se houver usuário autenticado, filtrar por user_id, senão buscar todos
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

// Função para buscar receitas práticas de uma aplicação
async function fetchPracticalRecipes(applicationId: string): Promise<PracticalRecipe[]> {
  const { data, error } = await supabase
    .from("practical_recipes")
    .select(`
      *,
      practical_recipe_products:practical_recipe_products(*)
    `)
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true });

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
  // Obter usuário atual (se houver)
  const { data: { user } } = await supabase.auth.getUser();
  const createdBy = user?.id || null;

  // Criar a receita prática
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

  // Criar os produtos da receita
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
      // Rollback: deletar a receita se houver erro ao inserir produtos
      await supabase.from("practical_recipes").delete().eq("id", recipe.id);
      throw new Error(`Erro ao criar produtos da receita: ${productsError.message}`);
    }
  }

  // Buscar receita completa com produtos
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
  }>,
  notes: string | null = null
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
      practical_recipe_products:practical_recipe_products(*)
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

// Função para buscar preço médio de um produto
async function getProductAveragePrice(productId: string): Promise<number> {
  const { data: movements, error } = await supabase
    .from("stock_movements")
    .select("quantity, unit_price, movement_type")
    .eq("product_id", productId);

  if (error) {
    console.error("Erro ao buscar movimentações:", error);
    return 0;
  }

  let totalValue = 0;
  let totalQuantity = 0;

  movements?.forEach((movement) => {
    // Apenas entradas contam para o preço médio
    if (movement.movement_type === "entry" || (movement.movement_type as string) === "IN") {
      const quantity = movement.quantity || 0;
      const unitPrice = movement.unit_price || 0;
      totalValue += quantity * unitPrice;
      totalQuantity += quantity;
    }
  });

  return totalQuantity > 0 ? totalValue / totalQuantity : 0;
}

// Função para criar aplicação
async function createApplication(data: CreateApplicationInput): Promise<Application> {
  // Normaliza o status para o formato do banco
  let statusValue = data.status;
  if (statusValue === "planned") statusValue = "PLANNED";
  if (statusValue === "completed" || statusValue === "done") statusValue = "DONE";
  if (statusValue === "cancelled" || statusValue === "canceled") statusValue = "CANCELED";

  const isCreatingAsDone = statusValue === "DONE";

  // Se está criando como DONE, verificar estoque primeiro
  if (isCreatingAsDone && data.products && data.products.length > 0) {
    const productsToCheck = data.products.map((p) => ({ 
      product_id: p.product_id, 
      quantity_used: p.quantity_used 
    }));
    await checkStockAvailability("", productsToCheck); // ID vazio pois é nova aplicação
  }

  // 1. Salvar aplicação
  const { data: newApplication, error: appError } = await supabase
    .from("applications")
    .insert({
      name: data.name,
      harvest_year_id: data.harvest_year_id,
      field_id: data.field_id,
      field_crop_id: data.field_crop_id || null,
      application_date: data.application_date,
      status: statusValue,
      notes: data.notes || null,
      is_partial: data.is_partial || false,
      partial_area: data.partial_area || null,
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

    // 3. Se criou como DONE, criar movimentações de saída no estoque
    if (isCreatingAsDone) {
      const exitMovements = data.products.map((ap) => ({
        product_id: ap.product_id,
        movement_type: "exit" as const,
        quantity: ap.quantity_used || 0,
        reference_id: newApplication.id,
        reference_type: "application" as const,
        movement_date: data.application_date,
        notes: `Saída por aplicação ${newApplication.id}`,
      }));

      const { error: movementsError } = await supabase
        .from("stock_movements")
        .insert(exitMovements as any);

      if (movementsError) {
        // Rollback: deletar aplicação e produtos
        await supabase.from("application_products").delete().eq("application_id", newApplication.id);
        await supabase.from("applications").delete().eq("id", newApplication.id);
        throw new Error(`Erro ao criar movimentações de estoque: ${movementsError.message}`);
      }
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

// Função para verificar disponibilidade de estoque
async function checkStockAvailability(applicationId: string, applicationProducts: Array<{ product_id: string; quantity_used: number }>): Promise<void> {
  // Buscar todas as movimentações de estoque
  const { data: movements, error: movementsError } = await supabase
    .from("stock_movements")
    .select("*");

  if (movementsError) {
    throw new Error(`Erro ao buscar movimentações: ${movementsError.message}`);
  }

  // Buscar todas as aplicações planejadas (exceto a atual)
  const { data: plannedApps, error: appsError } = await supabase
    .from("applications")
    .select(`
      id,
      application_products:application_products(
        product_id,
        quantity_used
      )
    `)
    .in("status", ["PLANNED", "planned"])
    .neq("id", applicationId);

  if (appsError) {
    throw new Error(`Erro ao buscar aplicações planejadas: ${appsError.message}`);
  }

  // Buscar todos os produtos necessários de uma vez
  const productIds = applicationProducts.map((ap) => ap.product_id);
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, unit")
    .in("id", productIds);

  if (productsError) {
    throw new Error(`Erro ao buscar produtos: ${productsError.message}`);
  }

  const productsMap = new Map(products?.map((p) => [p.id, p]) || []);

  // Calcular estoque atual e quantidade prevista por produto
  const stockMap = new Map<string, { current: number; planned: number }>();

  // Calcular estoque atual (entradas - saídas)
  movements?.forEach((movement) => {
    const productId = movement.product_id;
    const quantity = movement.quantity;
    const type = movement.movement_type;

    if (!stockMap.has(productId)) {
      stockMap.set(productId, { current: 0, planned: 0 });
    }

    const stock = stockMap.get(productId)!;
    if (type === "entry" || (type as string) === "IN") {
      stock.current += quantity;
    } else if (type === "exit" || (type as string) === "OUT") {
      stock.current -= quantity;
    }
  });

  // Calcular quantidade prevista (subtrair aplicações planejadas)
  plannedApps?.forEach((app) => {
    const products = app.application_products as Array<{ product_id: string; quantity_used: number }> | null;
    if (products) {
      products.forEach((ap) => {
        const stock = stockMap.get(ap.product_id);
        if (stock) {
          stock.planned += ap.quantity_used || 0;
        } else {
          stockMap.set(ap.product_id, { current: 0, planned: ap.quantity_used || 0 });
        }
      });
    }
  });

  // Verificar se há estoque suficiente para cada produto da aplicação
  const errors: string[] = [];
  applicationProducts.forEach((ap) => {
    const stock = stockMap.get(ap.product_id) || { current: 0, planned: 0 };
    const predictedQuantity = stock.current - stock.planned;
    const requiredQuantity = ap.quantity_used || 0;

    if (predictedQuantity < requiredQuantity) {
      const product = productsMap.get(ap.product_id);
      const productName = product?.name || "Produto";
      const unit = product?.unit || "";
      errors.push(
        `${productName}: Quantidade disponível: ${predictedQuantity.toFixed(2)} ${unit}, Quantidade necessária: ${requiredQuantity.toFixed(2)} ${unit}`
      );
    }
  });

  if (errors.length > 0) {
    throw new Error(
      `Não há produto suficiente no estoque para realizar esta aplicação.\n\n${errors.join("\n")}`
    );
  }
}

// Função para atualizar aplicação
async function updateApplication(data: UpdateApplicationInput): Promise<Application> {
  // Extrair id e products explicitamente usando destructuring para garantir que não sejam incluídos no updatePayload
  const { id, products, ...updateData } = data;

  // Buscar aplicação atual para verificar status anterior
  const { data: currentApplication, error: fetchCurrentError } = await supabase
    .from("applications")
    .select(`
      *,
      application_products:application_products(
        *,
        product_id,
        dosage,
        quantity_used
      )
    `)
    .eq("id", id)
    .single();

  if (fetchCurrentError || !currentApplication) {
    throw new Error("Erro ao buscar aplicação atual");
  }

  const currentStatus = currentApplication.status as string;
  const isChangingToDone = 
    (currentStatus === "PLANNED" || currentStatus === "planned") &&
    (updateData.status === "completed" || updateData.status === "done" || updateData.status === "DONE");

  // Se está mudando para DONE, verificar estoque
  if (isChangingToDone) {
    // Usar produtos fornecidos ou produtos atuais da aplicação
    const productsToCheck = products && products.length > 0
      ? products.map((p) => ({ product_id: p.product_id, quantity_used: p.quantity_used }))
      : (currentApplication.application_products as Array<{ product_id: string; quantity_used: number }> || []);

    if (productsToCheck.length > 0) {
      await checkStockAvailability(id, productsToCheck);
    }
  }

  // Normaliza o status se fornecido
  let statusValue = updateData.status;
  if (statusValue) {
    if (statusValue === "planned") statusValue = "PLANNED";
    if (statusValue === "completed" || statusValue === "done") statusValue = "DONE";
    if (statusValue === "cancelled" || statusValue === "canceled") statusValue = "CANCELED";
  }

  // Construir updatePayload apenas com campos permitidos (sem products ou id)
  const updatePayload: {
    name?: string;
    harvest_year_id?: string;
    field_id?: string;
    field_crop_id?: string | null;
    application_date?: string;
    status?: string;
    notes?: string | null;
    is_partial?: boolean;
    partial_area?: number | null;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };
  
  if (updateData.name !== undefined) updatePayload.name = updateData.name;
  if (updateData.harvest_year_id !== undefined) updatePayload.harvest_year_id = updateData.harvest_year_id;
  if (updateData.field_id !== undefined) updatePayload.field_id = updateData.field_id;
  if (updateData.field_crop_id !== undefined) updatePayload.field_crop_id = updateData.field_crop_id || null;
  if (updateData.application_date !== undefined) updatePayload.application_date = updateData.application_date;
  if (statusValue !== undefined) updatePayload.status = statusValue;
  if (updateData.notes !== undefined) updatePayload.notes = updateData.notes || null;
  if (updateData.is_partial !== undefined) updatePayload.is_partial = updateData.is_partial;
  if (updateData.partial_area !== undefined) updatePayload.partial_area = updateData.partial_area || null;

  // 1. Atualizar aplicação - Construir objeto manualmente SEM products ou id
  // Usar uma lista explícita de campos permitidos para garantir que nada mais seja incluído
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
  
  const finalPayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  
  // Adicionar apenas campos permitidos que existem em updatePayload
  for (const field of allowedFields) {
    if (field === 'updated_at') continue; // já foi adicionado
    if (field === 'status' && statusValue !== undefined) {
      finalPayload[field] = statusValue;
    } else if (updatePayload[field] !== undefined) {
      finalPayload[field] = updatePayload[field];
    }
  }
  
  // Garantir que products e id NÃO estejam no payload (segurança extra)
  delete (finalPayload as any).products;
  delete (finalPayload as any).id;
  
  // Criar um novo objeto limpo usando JSON para garantir que não há propriedades ocultas
  const cleanPayload = JSON.parse(JSON.stringify(finalPayload));
  delete (cleanPayload as any).products;
  delete (cleanPayload as any).id;
  
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

  // 3. Se mudou para DONE, criar movimentações de saída no estoque
  if (isChangingToDone) {
    const productsToDeduct = products && products.length > 0
      ? products
      : (currentApplication.application_products as Array<{ product_id: string; quantity_used: number }> || []);

    if (productsToDeduct.length > 0) {
      const exitMovements = productsToDeduct.map((ap) => ({
        product_id: ap.product_id,
        movement_type: "exit" as const,
        quantity: ap.quantity_used || 0,
        reference_id: id,
        reference_type: "application" as const,
        movement_date: updateData.application_date || currentApplication.application_date,
        notes: `Saída por aplicação ${id}`,
      }));

      const { error: movementsError } = await supabase
        .from("stock_movements")
        .insert(exitMovements as any);

      if (movementsError) {
        // Rollback: reverter status da aplicação
        await supabase
          .from("applications")
          .update({ status: currentStatus })
          .eq("id", id);
        throw new Error(`Erro ao criar movimentações de estoque: ${movementsError.message}`);
      }
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

export default function AplicacoesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingApplication, setEditingApplication] = useState<Application | null>(null);
  const [isRecipeDialogOpen, setIsRecipeDialogOpen] = useState(false);
  const [recipeApplication, setRecipeApplication] = useState<Application | null>(null);
  const [isViewRecipesDialogOpen, setIsViewRecipesDialogOpen] = useState(false);
  const [viewRecipesApplication, setViewRecipesApplication] = useState<Application | null>(null);
  const [isFiltersDialogOpen, setIsFiltersDialogOpen] = useState(false);
  const [filters, setFilters] = useState<{
    name?: string;
    date?: string;
    fieldIds?: string[];
    harvestYearIds?: string[];
    statuses?: string[];
  }>({});
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const queryClient = useQueryClient();
  const router = useRouter();

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
      queryClient.invalidateQueries({ queryKey: ["stock_balance"] });
      queryClient.invalidateQueries({ queryKey: ["stock_entries"] });
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
      queryClient.invalidateQueries({ queryKey: ["stock_balance"] });
      queryClient.invalidateQueries({ queryKey: ["stock_entries"] });
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

  // Buscar field_crops quando talhão e ano safra forem selecionados
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

  // Estado local para armazenar valores de dosagem como string durante a digitação
  const [dosageInputs, setDosageInputs] = useState<Record<number, string>>({});

  // Estados para receita prática (criação)
  const [selectedMachineryId, setSelectedMachineryId] = useState<string>("");
  const [capacityUsedPercent, setCapacityUsedPercent] = useState<number>(100);
  const [applicationRate, setApplicationRate] = useState<number>(0);
  const [calculationMode, setCalculationMode] = useState<"liters" | "area">("liters");
  const [litersOfSolution, setLitersOfSolution] = useState<number>(0);
  const [areaHectares, setAreaHectares] = useState<number>(0);
  const [multiplier, setMultiplier] = useState<number>(1);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [recipeNotes, setRecipeNotes] = useState<string>("");

  // Estados para edição de receita prática
  const [isEditRecipeDialogOpen, setIsEditRecipeDialogOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<PracticalRecipe | null>(null);
  const [editSelectedMachineryId, setEditSelectedMachineryId] = useState<string>("");
  const [editCapacityUsedPercent, setEditCapacityUsedPercent] = useState<number>(100);
  const [editApplicationRate, setEditApplicationRate] = useState<number>(0);
  const [editCalculationMode, setEditCalculationMode] = useState<"liters" | "area">("liters");
  const [editLitersOfSolution, setEditLitersOfSolution] = useState<number>(0);
  const [editAreaHectares, setEditAreaHectares] = useState<number>(0);
  const [editMultiplier, setEditMultiplier] = useState<number>(1);
  const [editRecipeNotes, setEditRecipeNotes] = useState<string>("");

  // Query para buscar maquinários - sempre habilitada para garantir que os dados estejam disponíveis
  const { data: machineries = [] } = useQuery({
    queryKey: ["machineries"],
    queryFn: fetchMachineries,
  });

  // Query para buscar receitas práticas existentes
  const { data: existingRecipes = [] } = useQuery({
    queryKey: ["practical_recipes", recipeApplication?.id],
    queryFn: () => fetchPracticalRecipes(recipeApplication!.id),
    enabled: !!recipeApplication && isRecipeDialogOpen,
  });

  const onSubmit = (data: ApplicationFormValues) => {
    if (editingApplication) {
      // Criar objeto de update sem products no spread
      const { products, ...dataWithoutProducts } = data;
      const updateData: UpdateApplicationInput = {
        id: editingApplication.id,
        ...dataWithoutProducts,
        products: products, // Incluir products separadamente para que updateApplication possa processá-lo
      };
      updateMutation.mutate(updateData);
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
    const applicationProducts = (application.application_products || []).map((ap: any) => {
      return {
        product_id: ap.product_id,
        dosage: ap.dosage || 0, // Default para 0 se não existir
        dosage_unit: (ap.dosage_unit || "L/ha") as "L/ha" | "mL/ha" | "kg/ha", // Default, pode ser ajustado se houver no banco
        quantity_used: ap.quantity_used || 0,
        cost: 0, // Será calculado automaticamente se necessário
      };
    });

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

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta aplicação?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleGenerateRecipe = (application: Application) => {
    setRecipeApplication(application);
    setIsRecipeDialogOpen(true);
  };

  const handleMarkAsDone = async (application: Application) => {
    if (confirm("Tem certeza que deseja marcar esta aplicação como realizada?")) {
      updateMutation.mutate({
        id: application.id,
        status: "DONE",
      });
    }
  };

  const handleViewRecipes = (application: Application) => {
    setViewRecipesApplication(application);
    setIsViewRecipesDialogOpen(true);
  };

  // Query para buscar receitas práticas da aplicação selecionada
  const { data: practicalRecipes = [] } = useQuery({
    queryKey: ["practical_recipes", viewRecipesApplication?.id],
    queryFn: () => fetchPracticalRecipes(viewRecipesApplication!.id),
    enabled: !!viewRecipesApplication?.id,
  });

  // Inicializar produtos selecionados quando recipeApplication muda
  useEffect(() => {
    if (recipeApplication?.application_products) {
      const productIds = (recipeApplication.application_products as any[]).map((ap: any) => {
        const product = ap.product as Product;
        return product?.id;
      }).filter(Boolean);
      setSelectedProducts(new Set(productIds));
    } else {
      setSelectedProducts(new Set());
    }
  }, [recipeApplication]);

  // Função para calcular área restante
  const calculateRemainingArea = (application: Application, recipes: PracticalRecipe[]): number => {
    const totalArea = application.is_partial && application.partial_area 
      ? application.partial_area 
      : ((application.field as Field)?.area_hectares || 0);
    
    const usedArea = recipes.reduce((sum, recipe) => {
      return sum + (recipe.area_hectares || 0) * (recipe.multiplier || 1);
    }, 0);
    
    return Math.max(0, totalArea - usedArea);
  };

  // Função para filtrar aplicações
  const filterApplications = (apps: Application[]): Application[] => {
    return apps.filter((app) => {
      // Filtro por nome
      if (filters.name && filters.name.trim() !== "") {
        const nameMatch = app.name?.toLowerCase().includes(filters.name.toLowerCase());
        if (!nameMatch) return false;
      }

      // Filtro por data
      if (filters.date) {
        const appDate = formatDateForInput(app.application_date);
        if (appDate !== filters.date) return false;
      }

      // Filtro por talhão
      if (filters.fieldIds && filters.fieldIds.length > 0) {
        if (!filters.fieldIds.includes(app.field_id)) return false;
      }

      // Filtro por safra
      if (filters.harvestYearIds && filters.harvestYearIds.length > 0) {
        if (!filters.harvestYearIds.includes(app.harvest_year_id)) return false;
      }

      // Filtro por status
      if (filters.statuses && filters.statuses.length > 0) {
        const appStatus = app.status as string;
        const normalizedStatus = appStatus === "PLANNED" || appStatus === "planned" ? "planned"
          : appStatus === "DONE" || appStatus === "completed" || appStatus === "done" ? "completed"
          : "cancelled";
        if (!filters.statuses.includes(normalizedStatus)) return false;
      }

      return true;
    });
  };

  // Aplicar filtros
  const filteredApplications = filterApplications(applications);

  // Função para ordenar
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Se já está ordenando por esta coluna, inverte a direção
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Nova coluna: define direção padrão
      // Texto: asc (A-Z), Data: desc (mais recente primeiro)
      const isTextColumn = column === "name" || column === "field" || column === "status";
      setSortColumn(column);
      setSortDirection(isTextColumn ? "asc" : "desc");
    }
  };

  // Ordenar dados
  const sortedApplications = useMemo(() => {
    if (!sortColumn) return filteredApplications;

    return [...filteredApplications].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case "name":
          aValue = a.name || "";
          bValue = b.name || "";
          break;
        case "date":
          aValue = new Date(a.application_date).getTime();
          bValue = new Date(b.application_date).getTime();
          break;
        case "field":
          const aField = a.field as Field | undefined;
          const bField = b.field as Field | undefined;
          aValue = aField?.name || "";
          bValue = bField?.name || "";
          break;
        case "status":
          aValue = formatStatus(a.status as string);
          bValue = formatStatus(b.status as string);
          break;
        default:
          return 0;
      }

      // Comparação
      let comparison = 0;
      if (typeof aValue === "string" && typeof bValue === "string") {
        comparison = aValue.localeCompare(bValue, "pt-BR");
      } else {
        comparison = aValue - bValue;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredApplications, sortColumn, sortDirection]);

  // Handler para editar receita prática
  const handleEditRecipe = (recipe: PracticalRecipe) => {
    setEditingRecipe(recipe);
    setEditSelectedMachineryId(recipe.machinery_id);
    setEditCapacityUsedPercent(recipe.capacity_used_percent);
    setEditApplicationRate(recipe.application_rate_liters_per_hectare);
    setEditCalculationMode(recipe.liters_of_solution ? "liters" : "area");
    setEditLitersOfSolution(recipe.liters_of_solution || 0);
    setEditAreaHectares(recipe.area_hectares || 0);
    setEditMultiplier(recipe.multiplier || 1);
    setEditRecipeNotes(recipe.notes || "");
    setIsEditRecipeDialogOpen(true);
  };

  // Handler para excluir receita prática
  const handleDeleteRecipe = async (recipeId: string) => {
    if (confirm("Tem certeza que deseja excluir esta receita prática?")) {
      try {
        await deletePracticalRecipe(recipeId);
        queryClient.invalidateQueries({ queryKey: ["practical_recipes"] });
        if (viewRecipesApplication) {
          queryClient.invalidateQueries({ queryKey: ["practical_recipes", viewRecipesApplication.id] });
        }
      } catch (error: any) {
        alert(`Erro ao excluir receita prática: ${error.message}`);
      }
    }
  };

  // Mutation para atualizar receita prática
  const updateRecipeMutation = useMutation({
    mutationFn: (params: {
      recipeId: string;
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
      notes?: string | null;
    }) => updatePracticalRecipe(params.recipeId, params.machineryId, params.capacityUsedPercent, params.applicationRate, params.litersOfSolution, params.areaHectares, params.multiplier, params.products, params.notes || null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practical_recipes"] });
      if (viewRecipesApplication) {
        queryClient.invalidateQueries({ queryKey: ["practical_recipes", viewRecipesApplication.id] });
      }
      setIsEditRecipeDialogOpen(false);
      setEditingRecipe(null);
    },
    onError: (error: Error) => {
      alert(`Erro ao atualizar receita prática: ${error.message}`);
    },
  });

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingApplication(null);
      // Limpar estado local de dosagem
      setDosageInputs({});
      // Resetar formulário para valores padrão vazios
      form.reset({
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
      });
    } else {
      // Quando abrir o dialog, garantir que está vazio se não for edição
      if (!editingApplication) {
        // Limpar estado local de dosagem
        setDosageInputs({});
        form.reset({
          harvest_year_id: "",
          field_id: "",
          field_crop_id: "",
          is_partial: false,
          partial_area: undefined,
          application_date: "",
          status: "planned",
          notes: "",
          products: [],
        });
      }
    }
  };

  const addProduct = () => {
    const newIndex = productFields.length;
    append({
      product_id: "",
      dosage: 0,
      dosage_unit: "L/ha",
      quantity_used: 0,
      cost: undefined,
    });
    // Limpar estado local de dosagem para o novo produto
    setDosageInputs(prev => {
      const newState = { ...prev };
      delete newState[newIndex];
      return newState;
    });
  };

  // Função para obter a área efetiva (talhão ou área parcial)
  const getEffectiveArea = (fieldId: string): number => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return 0;

    const isPartial = form.watch("is_partial");
    const partialArea = form.watch("partial_area");

    let area = (field as any).area_hct ?? field.area_hectares ?? 0;

    // Se for aplicação parcial e houver área parcial definida, usar essa área
    if (isPartial && partialArea && partialArea > 0) {
      area = partialArea;
    }

    return area;
  };

  // Função para calcular quantidade total baseada na área do talhão ou área parcial
  const calculateQuantity = async (fieldId: string, dosage: number, index: number) => {
    if (dosage <= 0) return;
    const area = getEffectiveArea(fieldId);
    if (area <= 0) return;
    
    const quantity = formatToTwoDecimals(dosage * area);
    form.setValue(`products.${index}.quantity_used`, quantity);
    
    // Recalcular custo após calcular quantidade
    const productId = form.watch(`products.${index}.product_id`);
    if (productId && quantity > 0) {
      await calculateCost(productId, quantity, index);
    }
  };

  // Função para calcular dosagem baseada na quantidade
  const calculateDosage = async (fieldId: string, quantity: number, index: number) => {
    if (quantity <= 0) return;
    const area = getEffectiveArea(fieldId);
    if (area <= 0) return;
    
    const dosage = formatToTwoDecimals(quantity / area);
    form.setValue(`products.${index}.dosage`, dosage);
    
    // Recalcular custo após calcular dosagem
    const productId = form.watch(`products.${index}.product_id`);
    if (productId && quantity > 0) {
      await calculateCost(productId, quantity, index);
    }
  };

  // Função para formatar número com máximo 2 casas decimais
  const formatToTwoDecimals = (value: number): number => {
    return Math.round(value * 100) / 100;
  };

  // Função para calcular custo baseado na quantidade e preço médio
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
                                  // Se desmarcar, limpar área parcial
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
                      {/* Campo de Área Parcial - aparece apenas se aplicação parcial estiver marcada */}
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
                                        // Validar que não excede área total
                                        if (value > maxArea) {
                                          form.setError("partial_area", {
                                            type: "manual",
                                            message: `A área não pode ser maior que a área total do talhão (${maxArea.toFixed(2)} ha)`,
                                          });
                                        } else {
                                          form.clearErrors("partial_area");
                                          // Arredondar para 2 casas decimais
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
                                        // Quando produto é selecionado, calcular custo se houver quantidade
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
                                  // Usar estado local se existir, senão usar valor do form
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
                                            // Permitir apenas números, vírgula e ponto
                                            inputValue = inputValue.replace(/[^0-9,.]/g, '');
                                            
                                            // Atualizar estado local imediatamente para permitir digitação livre
                                            setDosageInputs(prev => ({ ...prev, [index]: inputValue }));
                                            
                                            // Se campo estiver vazio, limpar estado local e form
                                            if (inputValue === "") {
                                              setDosageInputs(prev => {
                                                const newState = { ...prev };
                                                delete newState[index];
                                                return newState;
                                              });
                                              field.onChange(0);
                                              return;
                                            }
                                            
                                            // Substituir vírgula por ponto para processamento
                                            const normalizedValue = inputValue.replace(',', '.');
                                            
                                            // Se o valor é apenas "0." ou "0,", manter como string e não converter ainda
                                            if (normalizedValue === "0." || normalizedValue === "0," || normalizedValue === "0") {
                                              // Não converter para número ainda, deixar o usuário continuar digitando
                                              return;
                                            }
                                            
                                            const value = parseFloat(normalizedValue);
                                            
                                            if (!isNaN(value) && value >= 0) {
                                              // Limitar a 2 casas decimais
                                              const formattedValue = formatToTwoDecimals(value);
                                              field.onChange(formattedValue);
                                              // Atualizar estado local com valor formatado
                                              setDosageInputs(prev => ({ ...prev, [index]: formattedValue.toString().replace('.', ',') }));
                                              // Calcula quantidade automaticamente
                                              const fieldId = form.watch("field_id");
                                              if (fieldId && formattedValue > 0) {
                                                calculateQuantity(fieldId, formattedValue, index);
                                              }
                                            }
                                          }}
                                          onBlur={(e) => {
                                            // Garantir que ao sair do campo, o valor está formatado
                                            const normalizedValue = e.target.value.replace(',', '.');
                                            const value = parseFloat(normalizedValue);
                                            if (!isNaN(value) && value >= 0) {
                                              const formattedValue = formatToTwoDecimals(value);
                                              field.onChange(formattedValue);
                                              // Atualizar estado local com valor formatado
                                              setDosageInputs(prev => ({ ...prev, [index]: formattedValue.toString().replace('.', ',') }));
                                            } else {
                                              field.onChange(0);
                                              // Limpar estado local
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
                                          // Permitir apenas números, vírgula e ponto
                                          inputValue = inputValue.replace(/[^0-9,.]/g, '');
                                          
                                          // Se campo estiver vazio, permitir
                                          if (inputValue === "") {
                                            field.onChange(0);
                                            return;
                                          }
                                          
                                          const normalizedValue = inputValue.replace(',', '.');
                                          const value = parseFloat(normalizedValue);
                                          if (!isNaN(value) && value >= 0) {
                                            const formattedValue = formatToTwoDecimals(value);
                                            field.onChange(formattedValue);
                                            // Calcula dosagem automaticamente quando quantidade muda
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
                                    // Limpar estado local ao remover produto
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de Aplicações</CardTitle>
              <CardDescription>
                {(() => {
                  const hasActiveFilters = Object.keys(filters).some(key => {
                    const value = filters[key as keyof typeof filters];
                    if (value === undefined) return false;
                    if (Array.isArray(value)) return value.length > 0;
                    return value !== "";
                  });
                  return hasActiveFilters 
                    ? `${filteredApplications.length} de ${applications.length} aplicação(ões) filtrada(s)`
                    : `${applications.length} aplicação(ões) cadastrada(s)`;
                })()}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFiltersDialogOpen(true)}
              className="h-8 w-8 p-0"
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
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
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center gap-1">
                      Nome
                      {sortColumn === "name" && (
                        <ArrowDown className={`h-3 w-3 text-muted-foreground ${sortDirection === "asc" ? "rotate-180" : ""}`} />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("date")}
                  >
                    <div className="flex items-center gap-1">
                      Data
                      {sortColumn === "date" && (
                        <ArrowDown className={`h-3 w-3 text-muted-foreground ${sortDirection === "asc" ? "rotate-180" : ""}`} />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("field")}
                  >
                    <div className="flex items-center gap-1">
                      Talhão
                      {sortColumn === "field" && (
                        <ArrowDown className={`h-3 w-3 text-muted-foreground ${sortDirection === "asc" ? "rotate-180" : ""}`} />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center gap-1">
                      Status
                      {sortColumn === "status" && (
                        <ArrowDown className={`h-3 w-3 text-muted-foreground ${sortDirection === "asc" ? "rotate-180" : ""}`} />
                      )}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedApplications.map((application) => {
                  const field = application.field as Field | undefined;
                  const harvestYear = application.harvest_year as HarvestYear | undefined;
                  return (
                    <TableRow 
                      key={application.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/aplicacoes/${application.id}`)}
                    >
                      <TableCell className="font-medium">
                        {application.name || "Sem nome"}
                      </TableCell>
                      <TableCell>{formatDate(application.application_date)}</TableCell>
                      <TableCell className="font-medium">
                        {field?.name || "Talhão não encontrado"}
                      </TableCell>
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
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Gerar Receita Prática */}
      <Dialog open={isRecipeDialogOpen} onOpenChange={setIsRecipeDialogOpen}>
        <DialogContent className="max-w-[95vw] min-w-[1400px] max-h-[90vh] overflow-y-auto w-[95vw]">
          <DialogHeader>
            <DialogTitle>Gerar Receita Prática</DialogTitle>
            <DialogDescription>
              Configure os parâmetros para gerar a receita prática de aplicação
            </DialogDescription>
          </DialogHeader>
          {recipeApplication && (
            <div className="space-y-6">
              {/* Informações da Aplicação */}
              <div className="border-b pb-4">
                <p className="text-sm font-medium">
                  Aplicação: {formatDate(recipeApplication.application_date)} -{" "}
                  {(recipeApplication.field as Field)?.name}
                </p>
                {(() => {
                  const field = recipeApplication.field as Field | undefined;
                  const totalArea = recipeApplication.is_partial && recipeApplication.partial_area 
                    ? recipeApplication.partial_area 
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
                      const field = recipeApplication.field as Field | undefined;
                      const totalArea = recipeApplication.is_partial && recipeApplication.partial_area 
                        ? recipeApplication.partial_area 
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
              {recipeApplication.application_products &&
                recipeApplication.application_products.length > 0 &&
                areaHectares > 0 && (
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
                          {recipeApplication.application_products.map((ap: any) => {
                            const product = ap.product as Product;
                            const productId = product?.id;
                            const isSelected = productId ? selectedProducts.has(productId) : false;
                            const dosage = ap.dosage || 0;
                            const totalQuantity = ap.quantity_used || 0;
                            const areaInRecipe = areaHectares * multiplier;
                            const quantityInRecipe = dosage * areaInRecipe;
                            
                            // Calcular quantidade restante (acumulativa)
                            const totalUsedInPreviousRecipes = existingRecipes.reduce((sum, recipe) => {
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
                              <TableRow key={ap.id} className={!isSelected ? "opacity-50" : ""}>
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
                    setRecipeApplication(null);
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
                    if (!recipeApplication || !selectedMachineryId) return;

                    // Validar se os litros de calda não excedem a capacidade do tanque
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
                      const productsToSave = (recipeApplication.application_products || [])
                        .filter((ap: any) => {
                          const product = ap.product as Product;
                          return product?.id && selectedProducts.has(product.id);
                        })
                        .map((ap: any) => {
                          const product = ap.product as Product;
                          const dosage = ap.dosage || 0;
                          const areaInRecipe = areaHectares * multiplier;
                          const quantityInRecipe = dosage * areaInRecipe;
                          
                          // Calcular quantidade restante (acumulativa)
                          const totalUsedInPreviousRecipes = existingRecipes.reduce((sum, recipe) => {
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

                      const newRecipe = await createPracticalRecipe(
                        recipeApplication.id,
                        selectedMachineryId,
                        100, // Sempre usar 100% da capacidade
                        applicationRate,
                        calculationMode === "liters" ? litersOfSolution : null,
                        calculationMode === "area" ? areaHectares : null,
                        multiplier,
                        productsToSave,
                        recipeNotes || null
                      );

                      queryClient.invalidateQueries({ queryKey: ["practical_recipes"] });
                      setIsRecipeDialogOpen(false);
                      setRecipeApplication(null);
                      setSelectedMachineryId("");
                      setCapacityUsedPercent(100);
                      setApplicationRate(0);
                      setCalculationMode("liters");
                      setLitersOfSolution(0);
                      setAreaHectares(0);
                      setMultiplier(1);
                      
                      // Redirecionar para página de visualização
                      router.push(`/aplicacoes/receitas/${newRecipe.id}`);
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
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receitas Práticas</DialogTitle>
            {viewRecipesApplication && (
              <DialogDescription asChild>
                <span>Aplicação: {viewRecipesApplication.name}</span>
              </DialogDescription>
            )}
          </DialogHeader>
          {viewRecipesApplication && (
            <div className="space-y-4">
              {/* Card informativo com área restante */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Área sem receita</p>
                      <p className="text-2xl font-bold">
                        {calculateRemainingArea(viewRecipesApplication, practicalRecipes).toFixed(2)} ha
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
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog para Editar Receita Prática */}
      <Dialog open={isEditRecipeDialogOpen} onOpenChange={setIsEditRecipeDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Receita Prática</DialogTitle>
            <DialogDescription>
              Edite as configurações da receita prática
            </DialogDescription>
          </DialogHeader>
          {editingRecipe && viewRecipesApplication && (
            <div className="space-y-6">
              {/* Informações da Aplicação */}
              <div className="border-b pb-4">
                <p className="text-sm font-medium">
                  Aplicação: {viewRecipesApplication.name} - {formatDate(viewRecipesApplication.application_date)}
                </p>
              </div>

              {/* Seção 1: Seleção do Maquinário */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Seleção do Maquinário</h3>
                <div>
                  <Label htmlFor="edit-machinery-select">Pulverizador</Label>
                  <Select
                    value={editSelectedMachineryId}
                    onValueChange={(value) => {
                      setEditSelectedMachineryId(value);
                      const machinery = machineries.find((m) => m.id === value);
                      if (machinery) {
                        // Usar capacidade total do tanque
                        const liters = machinery.tank_capacity_liters;
                        if (editCalculationMode === "liters") {
                          setEditLitersOfSolution(liters);
                          if (editApplicationRate > 0) {
                            setEditAreaHectares(liters / editApplicationRate);
                          }
                        }
                      }
                    }}
                  >
                    <SelectTrigger id="edit-machinery-select">
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
                {editSelectedMachineryId && (
                  <div>
                    <Label>Capacidade de Calda</Label>
                    <p className="text-sm font-medium mt-2">
                      {machineries.find((m) => m.id === editSelectedMachineryId)?.tank_capacity_liters.toFixed(0)} L
                    </p>
                  </div>
                )}
              </div>

              {/* Seção 2: Configuração da Calda */}
              {editSelectedMachineryId && (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-lg font-semibold">Configuração da Calda</h3>
                  
                  <div>
                    <Label htmlFor="edit-application-rate">Taxa de Aplicação (L/ha)</Label>
                    <Input
                      id="edit-application-rate"
                      type="number"
                      min="0"
                      step="0.1"
                      value={editApplicationRate || ""}
                      onChange={(e) => {
                        const rate = parseFloat(e.target.value) || 0;
                        setEditApplicationRate(rate);
                        if (rate > 0) {
                          if (editCalculationMode === "liters" && editLitersOfSolution > 0) {
                            setEditAreaHectares(editLitersOfSolution / rate);
                          } else if (editCalculationMode === "area" && editAreaHectares > 0) {
                            setEditLitersOfSolution(editAreaHectares * rate);
                          }
                        }
                      }}
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-calculation-mode">Modo de Cálculo</Label>
                    <Select
                      value={editCalculationMode}
                      onValueChange={(value: "liters" | "area") => {
                        setEditCalculationMode(value);
                      }}
                    >
                      <SelectTrigger id="edit-calculation-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="liters">Definir Litros de Calda → Calcular Área</SelectItem>
                        <SelectItem value="area">Definir Área → Calcular Litros de Calda</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {editCalculationMode === "liters" ? (
                    <div>
                      <Label htmlFor="edit-liters-solution">Litros de Calda</Label>
                      <Input
                        id="edit-liters-solution"
                        type="number"
                        min="0"
                        step="0.1"
                        value={editLitersOfSolution || ""}
                        onChange={(e) => {
                          const liters = parseFloat(e.target.value) || 0;
                          setEditLitersOfSolution(liters);
                          if (editApplicationRate > 0 && liters > 0) {
                            setEditAreaHectares(liters / editApplicationRate);
                          }
                        }}
                      />
                      {editApplicationRate > 0 && editLitersOfSolution > 0 && (() => {
                        const machinery = machineries.find((m) => m.id === editSelectedMachineryId);
                        const totalCapacity = machinery?.tank_capacity_liters || 0;
                        const exceedsCapacity = editLitersOfSolution > totalCapacity;
                        return (
                          <p className={`text-sm mt-1 ${exceedsCapacity ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                            Área calculada: {editAreaHectares.toFixed(2)} ha
                            {exceedsCapacity && (
                              <span className="block mt-1">⚠️ Litros de calda ({editLitersOfSolution.toFixed(2)} L) excedem a capacidade do tanque ({totalCapacity.toFixed(0)} L). Deve ser menor ou igual.</span>
                            )}
                          </p>
                        );
                      })()}
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="edit-area-hectares">Área (ha)</Label>
                      <Input
                        id="edit-area-hectares"
                        type="number"
                        min="0"
                        step="0.01"
                        value={editAreaHectares || ""}
                        onChange={(e) => {
                          const area = parseFloat(e.target.value) || 0;
                          setEditAreaHectares(area);
                          if (editApplicationRate > 0 && area > 0) {
                            setEditLitersOfSolution(area * editApplicationRate);
                          }
                        }}
                      />
                      {editApplicationRate > 0 && editAreaHectares > 0 && (() => {
                        const machinery = machineries.find((m) => m.id === editSelectedMachineryId);
                        const capacity = machinery?.tank_capacity_liters || 0;
                        const calculatedLiters = editAreaHectares * editApplicationRate;
                        const exceedsCapacity = calculatedLiters > capacity;
                        return (
                          <p className={`text-sm mt-1 ${exceedsCapacity ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                            Litros de calda necessários: {calculatedLiters.toFixed(2)} L
                            {exceedsCapacity && (
                              <span className="block mt-1">⚠️ Excede a capacidade do maquinário ({capacity.toFixed(0)} L). Deve ser menor ou igual.</span>
                            )}
                          </p>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Seção 3: Quantidade de Bombas */}
              {editSelectedMachineryId && editAreaHectares > 0 && (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-lg font-semibold">Quantidade de bombas</h3>
                  <div>
                    <Label htmlFor="edit-multiplier">Para quantas bombas do pulverizador você quer aplicar essa receita?</Label>
                    <Input
                      id="edit-multiplier"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={editMultiplier === 0 ? "" : editMultiplier}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "") {
                          setEditMultiplier(0);
                          return;
                        }
                        const mult = parseFloat(value);
                        if (!isNaN(mult)) {
                          setEditMultiplier(Math.max(0.01, mult));
                        }
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        if (value === "" || parseFloat(value) < 0.01) {
                          setEditMultiplier(1);
                        }
                      }}
                    />
                    {(() => {
                      const field = viewRecipesApplication?.field as Field | undefined;
                      const totalArea = viewRecipesApplication?.is_partial && viewRecipesApplication?.partial_area 
                        ? viewRecipesApplication.partial_area 
                        : (field?.area_hectares || 0);
                      
                      if (totalArea > 0 && editAreaHectares > 0) {
                        const recommendedBombs = totalArea / editAreaHectares;
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
              {viewRecipesApplication.application_products &&
                viewRecipesApplication.application_products.length > 0 &&
                editAreaHectares > 0 && (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="text-lg font-semibold">Produtos da Aplicação</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Dosagem</TableHead>
                          <TableHead>Quantidade Total</TableHead>
                          <TableHead>Quantidade na Receita</TableHead>
                          <TableHead>Quantidade Restante</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewRecipesApplication.application_products.map((ap: any) => {
                          const product = ap.product as Product;
                          const dosage = ap.dosage || 0;
                          const totalQuantity = ap.quantity_used || 0;
                          const areaInRecipe = editAreaHectares * editMultiplier;
                          const quantityInRecipe = dosage * areaInRecipe;
                          
                          // Calcular quantidade restante (excluindo a receita atual da soma)
                          const totalUsedInOtherRecipes = practicalRecipes
                            .filter((r) => r.id !== editingRecipe.id)
                            .reduce((sum, recipe) => {
                              const recipeProduct = recipe.practical_recipe_products?.find(
                                (prp: any) => prp.product_id === product.id
                              );
                              if (recipeProduct) {
                                return sum + (recipeProduct.quantity_in_recipe || 0);
                              }
                              return sum;
                            }, 0);
                          
                          const remainingQuantity = totalQuantity - totalUsedInOtherRecipes - quantityInRecipe;

                          return (
                            <TableRow key={ap.id}>
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
                )}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditRecipeDialogOpen(false);
                    setEditingRecipe(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    if (!editingRecipe || !viewRecipesApplication || !editSelectedMachineryId || editAreaHectares <= 0 || editApplicationRate <= 0) {
                      return;
                    }

                    // Validar se os litros de calda não excedem a capacidade do tanque
                    const machinery = machineries.find((m) => m.id === editSelectedMachineryId);
                    if (machinery) {
                      const totalCapacity = machinery.tank_capacity_liters;
                      const calculatedLiters = editCalculationMode === "liters" 
                        ? editLitersOfSolution 
                        : (editAreaHectares * editApplicationRate);
                      
                      if (calculatedLiters > totalCapacity) {
                        alert(`Erro: Os litros de calda necessários (${calculatedLiters.toFixed(2)} L) excedem a capacidade do tanque (${totalCapacity.toFixed(0)} L). Deve ser menor ou igual.`);
                        return;
                      }
                    }

                    try {
                      // Preparar produtos para salvar
                      const productsToSave = (viewRecipesApplication.application_products || []).map((ap: any) => {
                        const product = ap.product as Product;
                        const dosage = ap.dosage || 0;
                        const areaInRecipe = editAreaHectares * editMultiplier;
                        const quantityInRecipe = dosage * areaInRecipe;
                        
                        // Calcular quantidade restante (excluindo a receita atual)
                        const totalUsedInOtherRecipes = practicalRecipes
                          .filter((r) => r.id !== editingRecipe.id)
                          .reduce((sum, recipe) => {
                            const recipeProduct = recipe.practical_recipe_products?.find(
                              (prp: any) => prp.product_id === product.id
                            );
                            if (recipeProduct) {
                              return sum + (recipeProduct.quantity_in_recipe || 0);
                            }
                            return sum;
                          }, 0);
                        
                        const totalQuantity = ap.quantity_used || 0;
                        const remainingQuantity = totalQuantity - totalUsedInOtherRecipes - quantityInRecipe;

                        return {
                          product_id: product.id,
                          dosage: dosage,
                          quantity_in_recipe: quantityInRecipe,
                          remaining_quantity: remainingQuantity,
                        };
                      });

                      await updateRecipeMutation.mutateAsync({
                        recipeId: editingRecipe.id,
                        machineryId: editSelectedMachineryId,
                        capacityUsedPercent: 100, // Sempre usar 100% da capacidade
                        applicationRate: editApplicationRate,
                        litersOfSolution: editCalculationMode === "liters" ? editLitersOfSolution : null,
                        areaHectares: editCalculationMode === "area" ? editAreaHectares : null,
                        multiplier: editMultiplier,
                        products: productsToSave,
                        notes: editRecipeNotes || null,
                      });
                    } catch (error: any) {
                      alert(`Erro ao atualizar receita prática: ${error.message}`);
                    }
                  }}
                  disabled={!editSelectedMachineryId || editAreaHectares <= 0 || editApplicationRate <= 0 || updateRecipeMutation.isPending}
                >
                  {updateRecipeMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Filtros */}
      <Dialog open={isFiltersDialogOpen} onOpenChange={setIsFiltersDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Filtros</DialogTitle>
            <DialogDescription>
              Selecione os filtros para filtrar a lista de aplicações
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Filtro por Nome */}
            <div>
              <Label htmlFor="filter-name">Nome</Label>
              <Input
                id="filter-name"
                placeholder="Buscar por nome..."
                value={filters.name || ""}
                onChange={(e) => setFilters({ ...filters, name: e.target.value })}
              />
            </div>

            {/* Filtro por Data */}
            <div>
              <Label htmlFor="filter-date">Data</Label>
              <Input
                id="filter-date"
                type="date"
                value={filters.date || ""}
                onChange={(e) => setFilters({ ...filters, date: e.target.value })}
              />
            </div>

            {/* Filtro por Talhão */}
            <div>
              <Label>Talhão</Label>
              <div className="space-y-2 mt-2 max-h-40 overflow-y-auto border rounded-md p-2">
                {fields.map((field) => (
                  <div key={field.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`filter-field-${field.id}`}
                      checked={filters.fieldIds?.includes(field.id) || false}
                      onCheckedChange={(checked) => {
                        const currentIds = filters.fieldIds || [];
                        if (checked) {
                          setFilters({ ...filters, fieldIds: [...currentIds, field.id] });
                        } else {
                          setFilters({ ...filters, fieldIds: currentIds.filter((id) => id !== field.id) });
                        }
                      }}
                    />
                    <Label
                      htmlFor={`filter-field-${field.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {field.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Filtro por Safra */}
            <div>
              <Label>Safra</Label>
              <div className="space-y-2 mt-2 max-h-40 overflow-y-auto border rounded-md p-2">
                {harvestYears.map((harvestYear) => (
                  <div key={harvestYear.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`filter-harvest-year-${harvestYear.id}`}
                      checked={filters.harvestYearIds?.includes(harvestYear.id) || false}
                      onCheckedChange={(checked) => {
                        const currentIds = filters.harvestYearIds || [];
                        if (checked) {
                          setFilters({ ...filters, harvestYearIds: [...currentIds, harvestYear.id] });
                        } else {
                          setFilters({ ...filters, harvestYearIds: currentIds.filter((id) => id !== harvestYear.id) });
                        }
                      }}
                    />
                    <Label
                      htmlFor={`filter-harvest-year-${harvestYear.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {harvestYear.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Filtro por Status */}
            <div>
              <Label>Status</Label>
              <div className="space-y-2 mt-2">
                {[
                  { value: "planned", label: "Planejado" },
                  { value: "completed", label: "Realizado" },
                  { value: "cancelled", label: "Cancelado" },
                ].map((status) => (
                  <div key={status.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`filter-status-${status.value}`}
                      checked={filters.statuses?.includes(status.value) || false}
                      onCheckedChange={(checked) => {
                        const currentStatuses = filters.statuses || [];
                        if (checked) {
                          setFilters({ ...filters, statuses: [...currentStatuses, status.value] });
                        } else {
                          setFilters({ ...filters, statuses: currentStatuses.filter((s) => s !== status.value) });
                        }
                      }}
                    />
                    <Label
                      htmlFor={`filter-status-${status.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {status.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFilters({});
                setIsFiltersDialogOpen(false);
              }}
            >
              Limpar Filtros
            </Button>
            <Button onClick={() => setIsFiltersDialogOpen(false)}>
              Aplicar Filtros
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

