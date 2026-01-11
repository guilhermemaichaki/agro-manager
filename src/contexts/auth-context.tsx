"use client";

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/app-store";
import {
  getCurrentUserProfile,
  getUserFarms,
  getFarmMember,
} from "@/lib/auth-helpers";
import type { UserProfile, Farm, FarmMember } from "@/types/schema";

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  initialized: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  initialized: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const hasHandledInitialSessionRef = useRef(false);
  const router = useRouter();
  const {
    setUser: setStoreUser,
    setSession: setStoreSession,
    setUserFarms,
    setCurrentFarmMember,
    selectedFarmId,
  } = useAppStore();

  useEffect(() => {
    // Timeout de segurança: se após 5 segundos não inicializou, forçar inicialização
    const timeoutId = setTimeout(() => {
      if (!hasHandledInitialSessionRef.current) {
        console.warn("Auth initialization timeout - forcing initialization");
        setLoading(false);
        setInitialized(true);
        hasHandledInitialSessionRef.current = true;
      }
    }, 5000);

    // Verificar sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeoutId);
      setStoreSession(session);
      if (session?.user) {
        loadUserData();
      } else {
        setLoading(false);
        setInitialized(true);
      }
      hasHandledInitialSessionRef.current = true;
    }).catch((error) => {
      clearTimeout(timeoutId);
      console.error("Error getting session:", error);
      setLoading(false);
      setInitialized(true);
      hasHandledInitialSessionRef.current = true;
    });

    return () => {
      clearTimeout(timeoutId);
    };

    // Listener para mudanças de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setStoreSession(session);
      
      // Ignorar INITIAL_SESSION após já ter sido processado na inicialização
      if (event === "INITIAL_SESSION" && hasHandledInitialSessionRef.current) {
        return;
      }
      
      // Não recarregar dados do usuário em eventos de token refresh
      // Apenas atualizar a sessão
      if (event === "TOKEN_REFRESHED") {
        return;
      }
      
      if (session?.user) {
        await loadUserData();
      } else {
        // Só limpar usuário se não for INITIAL_SESSION (que já foi processado no getSession)
        if (event !== "INITIAL_SESSION") {
          setUser(null);
          setStoreUser(null);
          setUserFarms([]);
          setCurrentFarmMember(null);
        }
        setLoading(false);
        setInitialized(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Carregar dados do membro quando a fazenda selecionada mudar
  useEffect(() => {
    if (selectedFarmId && user) {
      loadFarmMember(selectedFarmId);
    } else {
      setCurrentFarmMember(null);
    }
  }, [selectedFarmId, user]);

  async function loadUserData() {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/67851273-1af3-4d79-b55e-b02d35463fd9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth-context.tsx:87',message:'loadUserData started',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
    // #endregion
    try {
      setLoading(true);
      const userProfile = await getCurrentUserProfile();
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/67851273-1af3-4d79-b55e-b02d35463fd9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth-context.tsx:91',message:'loadUserData - userProfile loaded',data:{hasProfile:!!userProfile},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
      if (userProfile) {
        setUser(userProfile);
        setStoreUser(userProfile);
        
        const farms = await getUserFarms();
        setUserFarms(farms);
        
        if (selectedFarmId) {
          await loadFarmMember(selectedFarmId);
        }
      }
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/67851273-1af3-4d79-b55e-b02d35463fd9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth-context.tsx:103',message:'loadUserData error',data:{errorMessage:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
      console.error("Error loading user data:", error);
    } finally {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/67851273-1af3-4d79-b55e-b02d35463fd9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth-context.tsx:107',message:'loadUserData finally - setting loading false',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
      setLoading(false);
      setInitialized(true);
    }
  }

  async function loadFarmMember(farmId: string) {
    try {
      const member = await getFarmMember(farmId);
      setCurrentFarmMember(member);
    } catch (error) {
      console.error("Error loading farm member:", error);
      setCurrentFarmMember(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, initialized }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
