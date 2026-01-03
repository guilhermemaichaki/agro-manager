"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import type { PracticalRecipe, Application, Product } from "@/types/schema";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

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

export default function RelatorioCarregamentoPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = params.id as string;

  const { data: application, isLoading: isLoadingApp, error: appError } = useQuery({
    queryKey: ["application", applicationId],
    queryFn: () => fetchApplication(applicationId),
    enabled: !!applicationId,
  });

  const { data: practicalRecipes = [], isLoading: isLoadingRecipes, error: recipesError } = useQuery({
    queryKey: ["practical_recipes", applicationId],
    queryFn: () => fetchPracticalRecipes(applicationId),
    enabled: !!applicationId,
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoadingApp || isLoadingRecipes) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-muted-foreground">Carregando relatório...</p>
      </div>
    );
  }

  if (appError || recipesError || !application) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-destructive">
              Erro ao carregar relatório: {appError instanceof Error ? appError.message : recipesError instanceof Error ? recipesError.message : "Erro desconhecido"}
            </p>
            <div className="mt-4 text-center">
              <Link href={`/aplicacoes/${applicationId}`}>
                <Button variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calcular total de bombas
  const totalBombs = practicalRecipes.reduce((sum, recipe) => {
    return sum + (recipe.multiplier || 1);
  }, 0);

  // Preparar produtos da aplicação (similar à tabela do print 2)
  const applicationProducts = (application.application_products || []).map((ap: any) => ({
    product: ap.product as Product,
    dosage: ap.dosage || 0,
    dosage_unit: ap.dosage_unit || "L/ha",
    quantity_used: ap.quantity_used || 0,
  }));

  return (
    <div className="container mx-auto p-6 print:p-4">
      {/* Botões de ação - ocultos na impressão */}
      <div className="mb-6 flex gap-4 print:hidden">
        <Link href={`/aplicacoes/${applicationId}`}>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>
        <Button onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimir
        </Button>
      </div>

      {/* Conteúdo do Relatório - visível na impressão */}
      <Card className="print:border-0 print:shadow-none">
        <CardHeader className="print:pb-2">
          <CardTitle className="text-2xl text-center">Relatório para carregamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Informações no topo */}
          <div className="border-b pb-4 space-y-2">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Aplicação: </span>
                <span className="font-medium">{application.name || "N/A"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Quantidade de bombas necessárias: </span>
                <span className="font-medium text-lg">{totalBombs.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Tabela de Produtos */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Produtos para Carregamento</h3>
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
          </div>
        </CardContent>
      </Card>

      {/* Estilos para impressão */}
      <style jsx global>{`
        @media print {
          body {
            background: white;
          }
          .print\\:hidden {
            display: none;
          }
          .print\\:border-0 {
            border: none;
          }
          .print\\:shadow-none {
            box-shadow: none;
          }
          .print\\:pb-2 {
            padding-bottom: 0.5rem;
          }
          .print\\:p-4 {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
