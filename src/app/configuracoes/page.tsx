"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações da aplicação
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Em Desenvolvimento</CardTitle>
          <CardDescription>
            Esta página está em desenvolvimento e estará disponível em breve.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            As configurações do sistema estarão disponíveis aqui.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
