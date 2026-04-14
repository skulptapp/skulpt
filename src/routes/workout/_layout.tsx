import React from 'react';

import { useScreen } from '@/hooks/use-screen';
import { Stack } from '@/navigators/stack';
import { useWorkoutScreen } from '@/screens/workouts/workout/hooks';
import { useWorkoutExerciseScreen } from '@/screens/workouts/exercise/hooks';

export default function WorkoutLayout() {
    const { options } = useScreen();

    const workout = useWorkoutScreen();
    const workoutExercise = useWorkoutExerciseScreen();

    return (
        <Stack
            screenOptions={{
                ...options,
                headerShown: false,
            }}
        >
            <Stack.Screen {...workout} />
            <Stack.Screen {...workoutExercise} />
        </Stack>
    );
}
