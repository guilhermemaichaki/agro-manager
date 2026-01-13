"use client";

import { useEffect, useRef, startTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

const publicRoutes = ["/login", "/signup", "/forgot-password", "/reset-password", "/auth/callback"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, initialized } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirectedRef = useRef(false);
  const lastPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    // Só processar redirecionamentos após inicialização completa
    if (!initialized || loading) {
      return;
    }

    // Evitar processamento duplicado para o mesmo pathname
    if (lastPathnameRef.current === pathname && hasRedirectedRef.current) {
      return;
    }

    lastPathnameRef.current = pathname;
    const isPublicRoute = publicRoutes.some((route) => pathname?.startsWith(route));

    // Verificação robusta antes de redirecionar
    if (!user && !isPublicRoute) {
      // Evitar múltiplos redirecionamentos
      if (!hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        console.log("[AuthGuard] Redirecting to login - user not authenticated");
        startTransition(() => {
          router.push("/login");
        });
      }
    } else if (user && pathname === "/login") {
      // Evitar múltiplos redirecionamentos
      if (!hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        console.log("[AuthGuard] Redirecting to home - user already authenticated");
        startTransition(() => {
          router.push("/");
        });
      }
    } else {
      // Reset flag quando não há redirecionamento necessário
      hasRedirectedRef.current = false;
    }
  }, [user, loading, initialized, pathname, router]);

  // Reset redirect flag quando pathname muda
  useEffect(() => {
    if (lastPathnameRef.current !== pathname) {
      hasRedirectedRef.current = false;
    }
  }, [pathname]);

  // Mostrar loading enquanto verifica autenticação
  if (!initialized || loading) {
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

  // Se não está autenticado, mostrar loading enquanto redireciona
  // (o redirecionamento já foi iniciado no useEffect acima)
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Redirecionando...</p>
        </div>
      </div>
    );
  }

  // Usuário autenticado e não é rota pública
  return <>{children}</>;
}
