"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

const publicRoutes = ["/login", "/signup", "/forgot-password", "/reset-password", "/auth/callback"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, initialized } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [forceInitialized, setForceInitialized] = useState(false);

  // Timeout de segurança: se após 10 segundos não inicializou, forçar inicialização
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!initialized) {
        console.warn("AuthGuard: Initialization timeout - forcing initialization");
        setForceInitialized(true);
      }
    }, 10000);

    return () => clearTimeout(timeoutId);
  }, [initialized]);

  useEffect(() => {
    const isInitialized = initialized || forceInitialized;
    if (!isInitialized || loading) {
      return;
    }

    const isPublicRoute = publicRoutes.some((route) => pathname?.startsWith(route));

    if (!user && !isPublicRoute) {
      router.push("/login");
    } else if (user && pathname === "/login") {
      router.push("/");
    }
  }, [user, loading, initialized, forceInitialized, pathname, router]);

  // Mostrar loading enquanto verifica autenticação
  const isInitialized = initialized || forceInitialized;
  if (!isInitialized || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Se está em rota pública, mostrar conteúdo
  const isPublicRoute = publicRoutes.some((route) => pathname?.startsWith(route));
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Se não está autenticado, não mostrar conteúdo (redirecionamento já foi feito)
  if (!user) {
    return null;
  }

  // Usuário autenticado e não é rota pública
  return <>{children}</>;
}
