import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserProfile, Farm, FarmMember, UserRole } from "@/types/schema";

interface AppState {
  // Seleção de fazenda e safra
  selectedFarmId: string | null;
  selectedHarvestYearId: string | null;
  selectedHarvestCycleId: string | null;
  
  // Autenticação
  user: UserProfile | null;
  session: any | null;
  userFarms: Farm[];
  currentFarmMember: FarmMember | null;
  
  // ID do último usuário logado (para detectar troca de usuário)
  lastUserId: string | null;
  
  // Setters
  setSelectedFarmId: (farmId: string | null) => void;
  setSelectedHarvestYearId: (harvestYearId: string | null) => void;
  setSelectedHarvestCycleId: (harvestCycleId: string | null) => void;
  setUser: (user: UserProfile | null) => void;
  setSession: (session: any | null) => void;
  setUserFarms: (farms: Farm[]) => void;
  setCurrentFarmMember: (member: FarmMember | null) => void;
  clearAuth: () => void;
  
  // Verificar e limpar se usuário mudou
  checkAndClearForNewUser: (userId: string) => boolean;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      selectedFarmId: null,
      selectedHarvestYearId: null,
      selectedHarvestCycleId: null,
      user: null,
      session: null,
      userFarms: [],
      currentFarmMember: null,
      lastUserId: null,
      
      setSelectedFarmId: (farmId) => set({ selectedFarmId: farmId }),
      setSelectedHarvestYearId: (harvestYearId) => {
        set({ selectedHarvestYearId: harvestYearId });
        // Reset cycle when harvest year changes
        set({ selectedHarvestCycleId: null });
      },
      setSelectedHarvestCycleId: (harvestCycleId) => set({ selectedHarvestCycleId: harvestCycleId }),
      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      setUserFarms: (farms) => set({ userFarms: farms }),
      setCurrentFarmMember: (member) => set({ currentFarmMember: member }),
      clearAuth: () => set({ 
        user: null, 
        session: null, 
        userFarms: [], 
        currentFarmMember: null,
        selectedFarmId: null,
        selectedHarvestYearId: null,
        selectedHarvestCycleId: null,
        lastUserId: null,
      }),
      
      // Verifica se é um usuário diferente e limpa os dados se for
      checkAndClearForNewUser: (userId: string) => {
        const { lastUserId } = get();
        if (lastUserId && lastUserId !== userId) {
          // Usuário diferente - limpar seleções anteriores
          set({
            selectedFarmId: null,
            selectedHarvestYearId: null,
            selectedHarvestCycleId: null,
            userFarms: [],
            currentFarmMember: null,
            lastUserId: userId,
          });
          return true; // Indica que houve troca de usuário
        }
        // Mesmo usuário ou primeiro login
        set({ lastUserId: userId });
        return false;
      },
    }),
    {
      name: "agro-manager-storage",
      partialize: (state) => ({
        selectedFarmId: state.selectedFarmId,
        selectedHarvestYearId: state.selectedHarvestYearId,
        selectedHarvestCycleId: state.selectedHarvestCycleId,
        lastUserId: state.lastUserId, // Persistir para detectar troca de usuário
      }),
    }
  )
);

