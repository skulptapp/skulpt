import { FC } from 'react';

import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { ExercisesScreen as BaseExercisesScreen } from '@/screens';

const ExercisesScreen: FC = () => {
    useAnalyticsScreen('exercise_library');

    return <BaseExercisesScreen />;
};

export default ExercisesScreen;
