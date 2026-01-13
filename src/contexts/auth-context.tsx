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
  const currentUserIdRef = useRef<string | null>(null);
  
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

  useEffect(() => {
    // Evitar inicialização dupla
    if (initRef.current) return;
    initRef.current = true;
    
    let isMounted = true;
    console.log("[Auth] Initializing auth provider");

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log("[Auth] Session found, loading user data");
          setStoreSession(session);
          const result = await loadUserData(session.user.id);
          
          if (isMounted && result) {
            setUser(result.userProfile);
            setStoreUser(result.userProfile);
            setUserFarms(result.farms);
            currentUserIdRef.current = result.userProfile.id;
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
          currentUserIdRef.current = null;
          clearAuth();
          setLoading(false);
          setInitialized(true);
          return;
        }
        
        // Apenas processar SIGNED_IN
        if (event === "SIGNED_IN" && session?.user) {
          // Proteção: só recarregar se for um usuário diferente ou se não houver usuário carregado
          if (session.user.id === currentUserIdRef.current && user) {
            console.log("[Auth] Same user already loaded, skipping data reload");
            return;
          }
          
          console.log("[Auth] User signed in, loading data");
          setLoading(true);
          
          try {
            const result = await loadUserData(session.user.id);
            
            if (isMounted && result) {
              setUser(result.userProfile);
              setStoreUser(result.userProfile);
              setUserFarms(result.farms);
              currentUserIdRef.current = result.userProfile.id;
            } else if (isMounted) {
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

    return () => {
      isMounted = false;
      subscription.unsubscribe();
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
