import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { Stack } from '@/navigators/stack';
import { WorkoutScreen } from '@/screens';
import { useWorkoutScreen } from '@/screens/workouts/workout/hooks';

export default function WorkoutRoute() {
    useAnalyticsScreen('workout');

    const { options } = useWorkoutScreen();

    return (
        <>
            <Stack.Screen options={options} />
            <WorkoutScreen />
        </>
    );
}
