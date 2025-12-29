import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  selectedFarmId: string | null;
  selectedHarvestYearId: string | null;
  selectedHarvestCycleId: string | null;
  setSelectedFarmId: (farmId: string | null) => void;
  setSelectedHarvestYearId: (harvestYearId: string | null) => void;
  setSelectedHarvestCycleId: (harvestCycleId: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedFarmId: null,
      selectedHarvestYearId: null,
      selectedHarvestCycleId: null,
      setSelectedFarmId: (farmId) => set({ selectedFarmId: farmId }),
      setSelectedHarvestYearId: (harvestYearId) => {
        set({ selectedHarvestYearId: harvestYearId });
        // Reset cycle when harvest year changes
        set({ selectedHarvestCycleId: null });
      },
      setSelectedHarvestCycleId: (harvestCycleId) => set({ selectedHarvestCycleId: harvestCycleId }),
    }),
    {
      name: "agro-manager-storage",
    }
  )
);

