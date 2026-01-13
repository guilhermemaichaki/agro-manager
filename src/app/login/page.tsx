"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { signIn } from "@/lib/auth-helpers";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Verificar mensagens na URL
  useEffect(() => {
    const message = searchParams.get("message");
    const errorParam = searchParams.get("error");
    
    if (message) {
      setSuccessMessage(decodeURIComponent(message));
    }
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: LoginFormValues) {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      
      const { error: signInError } = await signIn(data.email, data.password);
      
      if (signInError) {
        // Traduzir mensagens de erro comuns
        let errorMessage = signInError.message || "Erro ao fazer login. Verifique suas credenciais.";
        if (errorMessage.includes("Email not confirmed")) {
          errorMessage = "Email não confirmado. Verifique sua caixa de entrada e clique no link de confirmação.";
        } else if (errorMessage.includes("Invalid login credentials")) {
          errorMessage = "Email ou senha incorretos.";
        }
        setError(errorMessage);
        return;
      }
      
      // O AuthGuard irá redirecionar automaticamente quando detectar o usuário logado
      // Não precisamos fazer redirecionamento manual aqui
    } catch (err) {
      setError("Erro inesperado ao fazer login. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Agro Manager</CardTitle>
          <CardDescription className="text-center">
            Faça login em sua conta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {successMessage && (
                <div className="rounded-md bg-green-50 p-3 text-sm text-green-800 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{successMessage}</span>
                </div>
              )}
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}
              
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="seu@email.com"
                        {...field}
                        disabled={loading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                        disabled={loading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex items-center justify-between">
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  Esqueceu sua senha?
                </Link>
              </div>
              
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? "Entrando..." : "Entrar"}
              </Button>
              
              <div className="text-center text-sm">
                <span className="text-muted-foreground">Não tem uma conta? </span>
                <Link
                  href="/signup"
                  className="text-primary hover:underline font-medium"
                >
                  Criar conta
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
