import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  selectedFarmId: string | null;
  selectedHarvestYearId: string | null;
  selectedHarvestCycleId: string | null;
  selectedFieldId: string | null;
  setSelectedFarmId: (farmId: string | null) => void;
  setSelectedHarvestYearId: (harvestYearId: string | null) => void;
  setSelectedHarvestCycleId: (harvestCycleId: string | null) => void;
  setSelectedFieldId: (fieldId: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedFarmId: null,
      selectedHarvestYearId: null,
      selectedHarvestCycleId: null,
      selectedFieldId: null,
      setSelectedFarmId: (farmId) => set({ selectedFarmId: farmId }),
      setSelectedHarvestYearId: (harvestYearId) => {
        set({ selectedHarvestYearId: harvestYearId });
        // Reset cycle and field when harvest year changes
        set({ selectedHarvestCycleId: null, selectedFieldId: null });
      },
      setSelectedHarvestCycleId: (harvestCycleId) => {
        set({ selectedHarvestCycleId: harvestCycleId });
        // Reset field when cycle changes
        set({ selectedFieldId: null });
      },
      setSelectedFieldId: (fieldId) => set({ selectedFieldId: fieldId }),
    }),
    {
      name: "agro-manager-storage",
    }
  )
);

