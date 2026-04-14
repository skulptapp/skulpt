import { FC } from 'react';

import { useEditorStore } from '@/stores/editor';

import ExerciseEditor from '../exercises/editor';
import MeasurementEditor from '../measurements/editor';
import WorkoutEditor from '../workouts/editor';

const Editor: FC = () => {
    const state = useEditorStore((state) => state);

    switch (state.type) {
        case 'exercise__create':
            return <ExerciseEditor />;
        case 'exercise__edit':
            return <ExerciseEditor {...state.payload} />;
        case 'workout__create':
            return <WorkoutEditor />;
        case 'workout__edit':
            return <WorkoutEditor {...state.payload} />;
        case 'measurement__create':
            return <MeasurementEditor />;
        default:
            return null;
    }
};

export default Editor;
