"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleAuthCallback = async () => {
      const code = searchParams.get("code");
      
      if (code) {
        // Trocar código por sessão
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        
        if (!error) {
          // Sucesso - redirecionar para dashboard
          router.push("/");
        } else {
          // Erro - redirecionar para login
          router.push("/login?error=auth_failed");
        }
      } else {
        // Sem código - verificar se já está autenticado
        const {
          data: { session },
        } = await supabase.auth.getSession();
        
        if (session) {
          router.push("/");
        } else {
          router.push("/login");
        }
      }
    };

    handleAuthCallback();
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Processando autenticação...</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Aguarde enquanto verificamos sua identidade.
        </p>
      </div>
    </div>
  );
}
