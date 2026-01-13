"use client";

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const initRef = useRef(false);
  const userRef = useRef<UserProfile | null>(null);
  
  const {
    setUser: setStoreUser,
    setSession: setStoreSession,
    setUserFarms,
    setCurrentFarmMember,
    setSelectedFarmId,
    clearAuth,
    checkAndClearForNewUser,
  } = useAppStore();

  // Função principal para carregar dados do usuário
  async function loadUserData(userId: string) {
    console.log("[Auth] Loading user data for:", userId);
    
    try {
      const userProfile = await getCurrentUserProfile();
      
      if (!userProfile) {
        console.warn("[Auth] No profile found for user");
        return null;
      }
      
      // Verificar se é um usuário diferente e limpar dados antigos
      checkAndClearForNewUser(userProfile.id);
      
      // Carregar fazendas
      let farms: Farm[] = [];
      try {
        farms = await getUserFarms();
        console.log("[Auth] Loaded farms:", farms.length);
      } catch (e) {
        console.error("[Auth] Error loading farms:", e);
      }
      
      // Validar fazenda selecionada
      const selectedFarmId = useAppStore.getState().selectedFarmId;
      if (selectedFarmId && !farms.some(f => f.id === selectedFarmId)) {
        console.log("[Auth] Selected farm not found in user farms, clearing");
        setSelectedFarmId(null);
      }
      
      return { userProfile, farms };
    } catch (error) {
      console.error("[Auth] Error loading user data:", error);
      return null;
    }
  }

  // Função para verificar e atualizar sessão
  async function refreshSessionIfNeeded() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error("[Auth] Error getting session:", error);
        return false;
      }
      
      // Se não há sessão, não há o que fazer
      if (!session) {
        return false;
      }
      
      // Verificar se a sessão está próxima de expirar (menos de 5 minutos)
      const expiresAt = session.expires_at;
      if (expiresAt) {
        const expiresIn = expiresAt - Math.floor(Date.now() / 1000);
        if (expiresIn < 300) { // Menos de 5 minutos
          console.log("[Auth] Session expiring soon, refreshing...");
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            console.error("[Auth] Error refreshing session:", refreshError);
            return false;
          }
          
          if (refreshedSession) {
            setStoreSession(refreshedSession);
            return true;
          }
        }
      }
      
      setStoreSession(session);
      return true;
    } catch (error) {
      console.error("[Auth] Error in refreshSessionIfNeeded:", error);
      return false;
    }
  }

  useEffect(() => {
    // Evitar inicialização dupla
    if (initRef.current) return;
    initRef.current = true;
    
    let isMounted = true;
    console.log("[Auth] Initializing auth provider");

    async function init() {
      try {
        // Verificar e atualizar sessão se necessário
        const hasValidSession = await refreshSessionIfNeeded();
        
        if (!isMounted) return;
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log("[Auth] Session found, loading user data");
          const result = await loadUserData(session.user.id);
          
          if (isMounted && result) {
            setUser(result.userProfile);
            userRef.current = result.userProfile;
            setStoreUser(result.userProfile);
            setUserFarms(result.farms);
          }
        } else {
          console.log("[Auth] No session found");
        }
      } catch (error) {
        console.error("[Auth] Init error:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    }

    init();

    // Listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("[Auth] Auth state changed:", event);
        
        if (!isMounted) return;
        
        setStoreSession(session);
        
        // Ignorar eventos que não precisam de ação
        if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
          return;
        }
        
        if (event === "SIGNED_OUT") {
          console.log("[Auth] User signed out, clearing state");
          setUser(null);
          userRef.current = null;
          clearAuth();
          setLoading(false);
          setInitialized(true);
          return;
        }
        
        // Apenas processar SIGNED_IN (não INITIAL_SESSION)
        if (event === "SIGNED_IN" && session?.user) {
          console.log("[Auth] User signed in, loading data");
          setLoading(true);
          
          try {
            const result = await loadUserData(session.user.id);
            
            if (isMounted && result) {
              setUser(result.userProfile);
              userRef.current = result.userProfile;
              setStoreUser(result.userProfile);
              setUserFarms(result.farms);
            } else if (isMounted) {
              // Se não conseguiu carregar dados, ainda finaliza o loading
              console.warn("[Auth] Failed to load user data, but finishing initialization");
            }
          } catch (error) {
            console.error("[Auth] Error in SIGNED_IN handler:", error);
          } finally {
            if (isMounted) {
              setLoading(false);
              setInitialized(true);
            }
          }
        }
      }
    );

    // Listener para quando a página volta ao foco (resolve problema de reload infinito)
    const handleVisibilityChange = async () => {
      if (!isMounted) return;
      
      // Quando a página volta a ficar visível
      if (document.visibilityState === "visible") {
        console.log("[Auth] Page became visible, checking session...");
        
        // Verificar se há sessão e se está válida
        const hasValidSession = await refreshSessionIfNeeded();
        
        if (hasValidSession) {
          const { data: { session } } = await supabase.auth.getSession();
          
          // Se há sessão mas não há usuário carregado, recarregar
          if (session?.user && !userRef.current) {
            console.log("[Auth] Session exists but no user loaded, reloading...");
            setLoading(true);
            
            try {
              const result = await loadUserData(session.user.id);
              if (isMounted && result) {
                setUser(result.userProfile);
                userRef.current = result.userProfile;
                setStoreUser(result.userProfile);
                setUserFarms(result.farms);
              }
            } catch (error) {
              console.error("[Auth] Error reloading user data:", error);
            } finally {
              if (isMounted) {
                setLoading(false);
                setInitialized(true);
              }
            }
          }
        } else {
          // Se não há sessão válida e há usuário, limpar estado
          if (userRef.current) {
            console.log("[Auth] No valid session but user exists, clearing...");
            setUser(null);
            userRef.current = null;
            clearAuth();
            setLoading(false);
            setInitialized(true);
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Carregar dados do membro quando fazenda mudar
  useEffect(() => {
    const selectedFarmId = useAppStore.getState().selectedFarmId;
    if (selectedFarmId && user) {
      getFarmMember(selectedFarmId)
        .then(member => setCurrentFarmMember(member))
        .catch(() => setCurrentFarmMember(null));
    } else {
      setCurrentFarmMember(null);
    }
  }, [useAppStore.getState().selectedFarmId, user]);

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
