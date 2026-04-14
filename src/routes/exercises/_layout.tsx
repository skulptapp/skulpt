import React from 'react';

import { Stack } from '@/navigators/stack';
import { useExerciseScreen } from '@/screens/exercises/exercise/hooks';

export default function ExercisesLayout() {
    const exercise = useExerciseScreen();

    return (
        <Stack>
            <Stack.Screen {...exercise} />
        </Stack>
    );
}
