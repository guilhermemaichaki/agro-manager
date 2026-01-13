"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCurrentUserProfile } from "@/lib/auth-helpers";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Processando autenticação...");

  useEffect(() => {
    const handleAuthCallback = async () => {
      const code = searchParams.get("code");
      const type = searchParams.get("type");
      
      if (code) {
        // Trocar código por sessão
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        
        if (error) {
          setStatus("error");
          setMessage("Erro na autenticação. Tente novamente.");
          setTimeout(() => router.push("/login?error=auth_failed"), 2000);
          return;
        }
        
        // Se for confirmação de email, mostrar mensagem de sucesso
        if (type === "signup" || type === "email") {
          setStatus("success");
          setMessage("Email confirmado com sucesso! Redirecionando para login...");
          setTimeout(() => router.push("/login?message=Email confirmado! Faça login para continuar."), 2000);
          return;
        }
        
        // Garantir que o perfil existe
        setMessage("Configurando sua conta...");
        await getCurrentUserProfile();
        
        setStatus("success");
        setMessage("Autenticação concluída! Redirecionando...");
        
        // Aguardar um pouco para o AuthProvider processar
        setTimeout(() => router.push("/"), 500);
      } else {
        // Sem código - verificar se já está autenticado
        const { data: { session } } = await supabase.auth.getSession();
        
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
        {status === "processing" && (
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4"></div>
        )}
        {status === "success" && (
          <div className="text-green-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
        {status === "error" && (
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )}
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
