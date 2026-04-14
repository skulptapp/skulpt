import { create } from 'zustand';
import { produce } from 'immer';

export type RestChangeType = 'after_set' | 'between_sets' | 'after_exercise' | 'all_intervals';

type State = {
    opened: boolean;
    title?: string;
    changeType: RestChangeType;
    workoutExerciseId?: string;
    setId?: string;
};

type OpenPropsType = {
    title?: string;
    changeType?: RestChangeType;
    workoutExerciseId?: string;
    setId?: string;
};

type Actions = {
    setChangeType: (changeType: RestChangeType) => void;
    open: (props?: OpenPropsType) => void;
    close: () => void;
};

const initial: State = {
    opened: false,
    title: undefined,
    changeType: 'all_intervals',
    workoutExerciseId: undefined,
    setId: undefined,
};

export const useRestStore = create<State & Actions>()((set) => ({
    ...initial,
    setChangeType: (changeType) =>
        set(
            produce((state) => {
                state.changeType = changeType;
            }),
        ),
    open: (props) =>
        set(
            produce((state) => {
                state.opened = true;
                state.title = props?.title;
                state.workoutExerciseId = props?.workoutExerciseId;
                state.setId = props?.setId;
                state.changeType = props?.changeType;
            }),
        ),
    close: () => {
        set(initial);
    },
}));
