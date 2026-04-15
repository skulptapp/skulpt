import React, { FC, useMemo } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useShallow } from 'zustand/react/shallow';

import { Box } from '@/components/primitives/box';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';
import { useRestStore } from '@/stores/rest';
import { ExerciseSetSelect } from '@/db/schema';
import { useRunningWorkoutTicker } from '@/hooks/use-running-workout';
import { formatRestTime } from '@/helpers/rest';

interface RestProps {
    workoutExerciseId?: string;
    set: ExerciseSetSelect;
    initialSeconds: number;
}

const styles = StyleSheet.create((theme) => ({
    restContainer: (isTimerActive: boolean) => ({
        backgroundColor: isTimerActive ? theme.colors.lime[400] : 'transparent',
        paddingHorizontal: theme.space(2),
        paddingVertical: theme.space(0.5),
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
        minWidth: theme.space(8),
        minHeight: theme.space(4),
    }),
    restValue: (isTimerActive: boolean) => ({
        fontWeight: isTimerActive
            ? theme.fontWeight.semibold.fontWeight
            : theme.fontWeight.default.fontWeight,
        fontSize: theme.fontSize.sm.fontSize,
        color: isTimerActive ? theme.colors.neutral[950] : theme.colors.neutral[400],
    }),
}));

const Rest: FC<RestProps> = ({ workoutExerciseId, set, initialSeconds }) => {
    const { open } = useRestStore(
        useShallow((state) => ({
            open: state.open,
        })),
    );

    const { runningWorkoutRestingSet, restRemainingSeconds } = useRunningWorkoutTicker();

    const remainingSeconds = useMemo(() => {
        if (set.id === runningWorkoutRestingSet?.id) return restRemainingSeconds;
        return null;
    }, [set.id, runningWorkoutRestingSet?.id, restRemainingSeconds]);

    const display = useMemo(() => {
        return formatRestTime(set, initialSeconds, remainingSeconds);
    }, [set, initialSeconds, remainingSeconds]);

    const handleRest = () => {
        open({ workoutExerciseId, setId: set.id, changeType: 'after_set' });
    };

    return (
        <Pressable onPress={handleRest}>
            <Box style={styles.restContainer(!!remainingSeconds)}>
                {set.restTime != null && (
                    <Text style={styles.restValue(!!remainingSeconds)}>{display}</Text>
                )}
            </Box>
        </Pressable>
    );
};

export { Rest };
