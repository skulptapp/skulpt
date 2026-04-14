import { create } from 'zustand';

export type ExerciseOwnershipFilter = 'all' | 'mine' | 'system';

type FilterState = {
    ownership: ExerciseOwnershipFilter;
    category: string[] | null;
    tracking: string[][] | null;
    primaryMuscle: string[] | null;
};

type FilterActions = {
    setOwnership: (ownership: ExerciseOwnershipFilter) => void;
    setCategory: (category: string[] | null) => void;
    setTracking: (tracking: string[][] | null) => void;
    setPrimaryMuscle: (primaryMuscle: string[] | null) => void;
    reset: () => void;
};

const initial: FilterState = {
    ownership: 'all',
    category: null,
    tracking: null,
    primaryMuscle: null,
};

export const useFilterStore = create<FilterState & FilterActions>()((set) => ({
    ...initial,
    setOwnership: (ownership) => set({ ownership }),
    setCategory: (category) => set({ category }),
    setTracking: (tracking) => set({ tracking }),
    setPrimaryMuscle: (primaryMuscle) => set({ primaryMuscle }),
    reset: () => set(initial),
}));

export const hasActiveFilters = (state: FilterState): boolean =>
    state.ownership !== 'all' ||
    (state.category !== null && state.category.length > 0) ||
    (state.tracking !== null && state.tracking.length > 0) ||
    (state.primaryMuscle !== null && state.primaryMuscle.length > 0);
