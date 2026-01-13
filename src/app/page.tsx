"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Package,
  Calendar,
  SprayCan,
  MapPin,
  ArrowDownCircle,
  ArrowUpCircle,
  Building2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/app-store";
import type { Application, StockMovement, Field, Product } from "@/types/schema";

// Interface para dados do dashboard
interface DashboardData {
  totalProducts: number;
  plannedApplications: number;
  completedApplications: number;
  activeFields: number;
  upcomingApplications: Application[];
  recentMovements: StockMovement[];
}

// Função para buscar todos os dados do dashboard em paralelo
async function getDashboardData(farmId: string | null): Promise<DashboardData | null> {
  // Se não há fazenda selecionada, retornar null
  if (!farmId) {
    return null;
  }
  
  const [
    productsResult,
    plannedAppsResult,
    completedAppsResult,
    fieldsResult,
    upcomingAppsResult,
    movementsResult,
  ] = await Promise.all([
    // Total de produtos (filtrado por farm_id)
    supabase.from("products").select("id", { count: "exact", head: true }).eq("farm_id", farmId),
    // Aplicações planejadas (filtrado por farm_id)
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("farm_id", farmId)
      .in("status", ["PLANNED", "planned"]),
    // Aplicações realizadas (filtrado por farm_id)
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("farm_id", farmId)
      .in("status", ["DONE", "completed", "done"]),
    // Talhões ativos (filtrado por farm_id)
    supabase.from("fields").select("id", { count: "exact", head: true }).eq("farm_id", farmId),
    // Próximas 5 aplicações planejadas (filtrado por farm_id)
    supabase
      .from("applications")
      .select(`
        *,
        field:fields(*),
        harvest_year:harvest_years(*)
      `)
      .eq("farm_id", farmId)
      .in("status", ["PLANNED", "planned"])
      .order("application_date", { ascending: true })
      .limit(5),
    // Últimas 5 movimentações de estoque (filtrado por farm_id)
    supabase
      .from("stock_movements")
      .select(`
        *,
        product:products(*)
      `)
      .eq("farm_id", farmId)
      .order("movement_date", { ascending: false })
      .limit(5),
  ]);

  return {
    totalProducts: productsResult.count || 0,
    plannedApplications: plannedAppsResult.count || 0,
    completedApplications: completedAppsResult.count || 0,
    activeFields: fieldsResult.count || 0,
    upcomingApplications: (upcomingAppsResult.data || []) as Application[],
    recentMovements: (movementsResult.data || []) as StockMovement[],
  };
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

// Função para obter data de hoje formatada
function getTodayDate(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Função para formatar tipo de movimentação
function formatMovementType(type: string): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (type === "entry" || type === "IN") {
    return { label: "Entrada", variant: "default" };
  }
  return { label: "Saída", variant: "destructive" };
}

export default function DashboardPage() {
  const { selectedFarmId } = useAppStore();
  
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ["dashboard", selectedFarmId],
    queryFn: () => getDashboardData(selectedFarmId),
    enabled: !!selectedFarmId, // Só executa se houver fazenda selecionada
  });

  // Se não há fazenda selecionada, mostrar mensagem
  if (!selectedFarmId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Visão Geral da Fazenda</h1>
          <p className="text-muted-foreground capitalize">{getTodayDate()}</p>
        </div>
        
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Selecione uma Fazenda</h2>
            <p className="text-muted-foreground text-center max-w-md">
              Para visualizar os dados do dashboard, selecione uma fazenda no menu superior 
              ou cadastre uma nova fazenda clicando em &quot;+ Cadastrar Fazenda&quot;.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Visão Geral da Fazenda</h1>
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Visão Geral da Fazenda</h1>
          <p className="text-muted-foreground">
            Erro ao carregar dados: {error instanceof Error ? error.message : "Erro desconhecido"}
          </p>
        </div>
      </div>
    );
  }

  const data = dashboardData || {
    totalProducts: 0,
    plannedApplications: 0,
    completedApplications: 0,
    activeFields: 0,
    upcomingApplications: [],
    recentMovements: [],
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Visão Geral da Fazenda</h1>
        <p className="text-muted-foreground capitalize">{getTodayDate()}</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalProducts}</div>
            <p className="text-xs text-muted-foreground">Defensivos cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aplicações Planejadas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.plannedApplications}</div>
            <p className="text-xs text-muted-foreground">Aplicações agendadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aplicações Realizadas</CardTitle>
            <SprayCan className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.completedApplications}</div>
            <p className="text-xs text-muted-foreground">Aplicações concluídas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Talhões Ativos</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.activeFields}</div>
            <p className="text-xs text-muted-foreground">Talhões cadastrados</p>
          </CardContent>
        </Card>
      </div>

      {/* Painel Principal */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Próximas Atividades */}
        <Card>
          <CardHeader>
            <CardTitle>Próximas Atividades</CardTitle>
            <CardDescription>
              Próximas 5 aplicações planejadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.upcomingApplications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma atividade recente
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Talhão</TableHead>
                    <TableHead>Safra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.upcomingApplications.map((application) => {
                    const field = application.field as Field | undefined;
                    const harvestYear = application.harvest_year as any;
                    return (
                      <TableRow key={application.id}>
                        <TableCell className="font-medium">
                          {formatDate(application.application_date)}
                        </TableCell>
                        <TableCell>{field?.name || "-"}</TableCell>
                        <TableCell>{harvestYear?.name || "-"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Últimas Movimentações de Estoque */}
        <Card>
          <CardHeader>
            <CardTitle>Últimas Movimentações de Estoque</CardTitle>
            <CardDescription>
              Últimas 5 entradas ou saídas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentMovements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma atividade recente
              </p>
            ) : (
              <div className="space-y-3">
                {data.recentMovements.map((movement) => {
                  const product = movement.product as Product | undefined;
                  const movementType = formatMovementType(movement.movement_type as string);
                  return (
                    <div
                      key={movement.id}
                      className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {product?.name || "Produto não encontrado"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(movement.movement_date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={movementType.variant}>
                          {movementType.label === "Entrada" ? (
                            <ArrowDownCircle className="mr-1 h-3 w-3" />
                          ) : (
                            <ArrowUpCircle className="mr-1 h-3 w-3" />
                          )}
                          {movementType.label}
                        </Badge>
                        <span className="text-sm font-medium">
                          {movement.quantity.toFixed(2)} {product?.unit || ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
    </div>
  );
}
