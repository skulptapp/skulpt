import { Stack } from '@/navigators/stack';
import { WorkoutExerciseScreen } from '@/screens';
import { useWorkoutExerciseScreen } from '@/screens/workouts/exercise/hooks';

export default function WorkoutExerciseRoute() {
    const { options } = useWorkoutExerciseScreen();

    return (
        <>
            <Stack.Screen options={options} />
            <WorkoutExerciseScreen />
        </>
    );
}
