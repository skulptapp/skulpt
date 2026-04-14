import { create } from 'zustand';

type State = {
    workoutId: string | null;
};

type Actions = {
    start: (workoutId: string) => void;
    clear: () => void;
};

const initial: State = {
    workoutId: null,
};

export const useSupersetEditStore = create<State & Actions>()((set) => ({
    ...initial,
    start: (workoutId) => set({ workoutId }),
    clear: () => set(initial),
}));
