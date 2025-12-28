import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  selectedFarmId: string | null;
  selectedCropYearId: string | null;
  setSelectedFarmId: (farmId: string | null) => void;
  setSelectedCropYearId: (cropYearId: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedFarmId: null,
      selectedCropYearId: null,
      setSelectedFarmId: (farmId) => set({ selectedFarmId: farmId }),
      setSelectedCropYearId: (cropYearId) => set({ selectedCropYearId: cropYearId }),
    }),
    {
      name: "agro-manager-storage",
    }
  )
);

