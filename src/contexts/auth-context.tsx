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
import type { UserProfile, Farm } from "@/types/schema";

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

// Função para limpar sessão corrompida
async function clearCorruptedSession() {
  try {
    await supabase.auth.signOut();
  } catch {
    // Ignorar erros ao limpar sessão
  }
  // Limpar localStorage manualmente
  if (typeof window !== "undefined") {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes("supabase") || key.includes("sb-"))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const hasHandledInitialSessionRef = useRef(false);
  const isLoadingUserDataRef = useRef(false);
  const router = useRouter();
  const {
    setUser: setStoreUser,
    setSession: setStoreSession,
    setUserFarms,
    setCurrentFarmMember,
    setSelectedFarmId,
    selectedFarmId,
    clearAuth,
    checkAndClearForNewUser,
  } = useAppStore();

  useEffect(() => {
    let isMounted = true;
    
    // Timeout de segurança: se após 8 segundos não inicializou, forçar inicialização
    const timeoutId = setTimeout(async () => {
      if (!hasHandledInitialSessionRef.current && isMounted) {
        console.warn("Auth initialization timeout - forcing initialization");
        // Se timeout, pode ser sessão corrompida - limpar e continuar
        await clearCorruptedSession();
        setStoreSession(null);
        setUser(null);
        setStoreUser(null);
        setLoading(false);
        setInitialized(true);
        hasHandledInitialSessionRef.current = true;
      }
    }, 8000);

    // Verificar sessão inicial
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        clearTimeout(timeoutId);
        
        if (error) {
          console.error("Error getting session:", error);
          // Sessão pode estar corrompida - limpar
          await clearCorruptedSession();
          setStoreSession(null);
          setLoading(false);
          setInitialized(true);
          hasHandledInitialSessionRef.current = true;
          return;
        }
        
        setStoreSession(session);
        
        if (session?.user) {
          await loadUserData();
        } else {
          setLoading(false);
          setInitialized(true);
        }
        hasHandledInitialSessionRef.current = true;
      } catch (error) {
        if (!isMounted) return;
        clearTimeout(timeoutId);
        console.error("Error initializing auth:", error);
        // Limpar sessão corrompida
        await clearCorruptedSession();
        setStoreSession(null);
        setLoading(false);
        setInitialized(true);
        hasHandledInitialSessionRef.current = true;
      }
    };

    initializeAuth();

    // Listener para mudanças de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      
      setStoreSession(session);
      
      // Ignorar INITIAL_SESSION após já ter sido processado na inicialização
      if (event === "INITIAL_SESSION" && hasHandledInitialSessionRef.current) {
        return;
      }
      
      // Não recarregar dados do usuário em eventos de token refresh
      if (event === "TOKEN_REFRESHED") {
        return;
      }
      
      // Tratar logout
      if (event === "SIGNED_OUT") {
        setUser(null);
        clearAuth(); // Limpa todo o store incluindo farmId
        setLoading(false);
        setInitialized(true);
        return;
      }
      
      if (session?.user) {
        await loadUserData();
      } else {
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

    // Cleanup
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
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
    // Evitar chamadas duplicadas
    if (isLoadingUserDataRef.current) return;
    isLoadingUserDataRef.current = true;
    
    try {
      setLoading(true);
      const userProfile = await getCurrentUserProfile();
      
      if (userProfile) {
        // Verificar se é um usuário diferente do anterior
        // Se for, limpa as seleções para evitar ver dados de outro usuário
        const userChanged = checkAndClearForNewUser(userProfile.id);
        if (userChanged) {
          console.log("User changed - cleared previous selections");
        }
        
        setUser(userProfile);
        setStoreUser(userProfile);
        
        let farms: Farm[] = [];
        try {
          farms = await getUserFarms();
          setUserFarms(farms);
        } catch (farmsError) {
          console.error("Error loading farms:", farmsError);
          setUserFarms([]);
        }
        
        // Validar se o farmId selecionado pertence a este usuário
        const currentSelectedFarmId = useAppStore.getState().selectedFarmId;
        if (currentSelectedFarmId) {
          const farmBelongsToUser = farms.some(f => f.id === currentSelectedFarmId);
          if (!farmBelongsToUser) {
            console.warn("Selected farm does not belong to user - clearing");
            setSelectedFarmId(null);
            setCurrentFarmMember(null);
          } else {
            await loadFarmMember(currentSelectedFarmId);
          }
        }
      } else {
        // Se não conseguiu carregar perfil, pode ser sessão inválida
        console.warn("Could not load user profile - session may be invalid");
        setUser(null);
        setStoreUser(null);
      }
    } catch (error: any) {
      console.error("Error loading user data:", error);
      
      // Se for erro de API key ou sessão, limpar sessão
      if (error?.message?.includes("API key") || error?.status === 406) {
        console.warn("Session appears corrupted - clearing");
        await clearCorruptedSession();
        setUser(null);
        setStoreUser(null);
        setUserFarms([]);
      }
    } finally {
      setLoading(false);
      setInitialized(true);
      isLoadingUserDataRef.current = false;
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
