import { create } from 'zustand';

type ExerciseCreate = {
    type: 'exercise__create';
};

type ExerciseEdit = {
    type: 'exercise__edit';
    payload: {
        exerciseId: string;
    };
};

type WorkoutCreate = {
    type: 'workout__create';
};

type WorkoutEdit = {
    type: 'workout__edit';
    payload: {
        workoutId: string;
    };
};

type MeasurementCreate = {
    type: 'measurement__create';
};

type Unknown = {
    type: 'unknown';
};

export type EditorState = {
    title?: string;
    description?: string;
} & (ExerciseCreate | ExerciseEdit | WorkoutCreate | WorkoutEdit | MeasurementCreate | Unknown);

type EditorActions = {
    setState: (state: EditorState) => void;
    resetState: () => void;
};

const initial: EditorState = {
    type: 'unknown',
};

export const useEditorStore = create<EditorState & EditorActions>()((set, get) => ({
    ...initial,
    setState: (state) => set(state),
    resetState: () => set(initial),
}));
