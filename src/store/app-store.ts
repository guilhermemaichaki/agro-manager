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
  
  // Setters
  setSelectedFarmId: (farmId: string | null) => void;
  setSelectedHarvestYearId: (harvestYearId: string | null) => void;
  setSelectedHarvestCycleId: (harvestCycleId: string | null) => void;
  setUser: (user: UserProfile | null) => void;
  setSession: (session: any | null) => void;
  setUserFarms: (farms: Farm[]) => void;
  setCurrentFarmMember: (member: FarmMember | null) => void;
  clearAuth: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedFarmId: null,
      selectedHarvestYearId: null,
      selectedHarvestCycleId: null,
      user: null,
      session: null,
      userFarms: [],
      currentFarmMember: null,
      
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
      }),
    }),
    {
      name: "agro-manager-storage",
      partialize: (state) => ({
        selectedFarmId: state.selectedFarmId,
        selectedHarvestYearId: state.selectedHarvestYearId,
        selectedHarvestCycleId: state.selectedHarvestCycleId,
        // Não persistir dados sensíveis de autenticação
      }),
    }
  )
);

