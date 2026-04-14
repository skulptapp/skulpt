import { create } from 'zustand';
import { produce } from 'immer';

type WorkoutMenu = {
    type: 'workout__menu';
    title?: string;
    showCloseButton?: boolean;
    payload: {
        workoutId: string;
    };
};

type Workoutrepeat = {
    type: 'workout__repeat';
    title?: string;
    showCloseButton?: boolean;
    payload: {
        workoutId: string;
    };
};

type ExerciseMenu = {
    type: 'exercise__menu';
    title?: string;
    showCloseButton?: boolean;
    payload: {
        exerciseId: string;
    };
};

type SetMenu = {
    type: 'set__menu';
    title?: string;
    showCloseButton?: boolean;
    payload: {
        setId: string;
        workoutExerciseId: string;
        setType: 'working' | 'warmup' | 'dropset' | 'failure';
    };
};

type State =
    | {
          type: undefined;
          title?: string;
          showCloseButton?: boolean;
          payload?: object;
      }
    | WorkoutMenu
    | Workoutrepeat
    | ExerciseMenu
    | SetMenu;

type OpenPropsType = WorkoutMenu | Workoutrepeat | ExerciseMenu | SetMenu;

type Actions = {
    open: (props: OpenPropsType) => void;
    close: () => void;
};

const initial: State = {
    type: undefined,
    title: undefined,
    showCloseButton: undefined,
    payload: undefined,
};

export const useActionsStore = create<State & Actions>()((set) => ({
    ...initial,
    open: ({ type, title, showCloseButton, payload }) =>
        set(
            produce((state) => {
                state.type = type;
                state.title = title;
                state.showCloseButton = showCloseButton;
                state.payload = payload;
            }),
        ),
    close: () => {
        set(initial);
    },
}));
