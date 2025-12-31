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
import type { PracticalRecipe, Application, Machinery, Product } from "@/types/schema";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

async function fetchPracticalRecipe(id: string): Promise<PracticalRecipe> {
  const { data, error } = await supabase
    .from("practical_recipes")
    .select(`
      *,
      machinery:machineries(*),
      application:applications(
        *,
        field:fields(*),
        harvest_year:harvest_years(*)
      ),
      practical_recipe_products:practical_recipe_products(
        *,
        product:products(*)
      )
    `)
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(`Erro ao buscar receita prática: ${error.message}`);
  }

  return data as PracticalRecipe;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR");
}

export default function ReceitaPraticaPage() {
  const params = useParams();
  const router = useRouter();
  const recipeId = params.id as string;

  const { data: recipe, isLoading, error } = useQuery({
    queryKey: ["practical_recipe", recipeId],
    queryFn: () => fetchPracticalRecipe(recipeId),
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-muted-foreground">Carregando receita prática...</p>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-destructive">
              Erro ao carregar receita prática: {error instanceof Error ? error.message : "Erro desconhecido"}
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

  const application = recipe.application as Application;
  const machinery = recipe.machinery as Machinery;
  const field = application?.field as any;
  const harvestYear = application?.harvest_year as any;

  return (
    <div className="container mx-auto p-6 print:p-4">
      {/* Botões de ação - ocultos na impressão */}
      <div className="mb-6 flex gap-4 print:hidden">
        <Link href="/aplicacoes">
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

      {/* Conteúdo da Receita - visível na impressão */}
      <Card className="print:border-0 print:shadow-none">
        <CardHeader className="print:pb-2">
          <CardTitle className="text-2xl text-center">Receita Prática de Aplicação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Informações da Aplicação */}
          <div className="grid grid-cols-2 gap-4 border-b pb-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Data da Aplicação</p>
              <p className="text-lg">{formatDate(application?.application_date || "")}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Talhão</p>
              <p className="text-lg">{field?.name || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Ano Safra</p>
              <p className="text-lg">{harvestYear?.name || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Data de Geração</p>
              <p className="text-lg">{formatDate(recipe.created_at)}</p>
            </div>
          </div>

          {/* Informações do Maquinário */}
          <div className="grid grid-cols-2 gap-4 border-b pb-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Maquinário</p>
              <p className="text-lg">{machinery?.name || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Capacidade do Tanque</p>
              <p className="text-lg">{machinery?.tank_capacity_liters.toFixed(0) || "N/A"} L</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Percentual Usado</p>
              <p className="text-lg">{recipe.capacity_used_percent.toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Litros de Calda</p>
              <p className="text-lg">
                {recipe.liters_of_solution
                  ? recipe.liters_of_solution.toFixed(2)
                  : ((machinery?.tank_capacity_liters || 0) * recipe.capacity_used_percent) / 100}{" "}
                L
              </p>
            </div>
          </div>

          {/* Configurações */}
          <div className="grid grid-cols-2 gap-4 border-b pb-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Taxa de Aplicação</p>
              <p className="text-lg">{recipe.application_rate_liters_per_hectare.toFixed(2)} L/ha</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Área</p>
              <p className="text-lg">{recipe.area_hectares?.toFixed(2) || "N/A"} ha</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Multiplicador</p>
              <p className="text-lg">{recipe.multiplier}x</p>
            </div>
          </div>

          {/* Tabela de Produtos */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Produtos</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Dosagem</TableHead>
                  <TableHead>Quantidade na Receita</TableHead>
                  <TableHead>Quantidade Restante</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipe.practical_recipe_products?.map((prp: any) => {
                  const product = prp.product as Product;
                  return (
                    <TableRow key={prp.id}>
                      <TableCell className="font-medium">{product?.name || "Produto"}</TableCell>
                      <TableCell>{prp.dosage.toFixed(2)}</TableCell>
                      <TableCell className="font-medium">
                        {prp.quantity_in_recipe.toFixed(2)}
                      </TableCell>
                      <TableCell
                        className={
                          prp.remaining_quantity < 0
                            ? "text-red-600 font-medium"
                            : "text-muted-foreground"
                        }
                      >
                        {prp.remaining_quantity.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
