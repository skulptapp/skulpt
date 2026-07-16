import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { ExerciseScreen } from '@/screens';

const ExerciseRoute = () => {
    useAnalyticsScreen('exercise_detail');

    return <ExerciseScreen />;
};

export default ExerciseRoute;
