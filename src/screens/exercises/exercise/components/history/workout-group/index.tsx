import { FC } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import dayjs from 'dayjs';

import { Box } from '@/components/primitives/box';
import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { ExerciseSelect, ExerciseSetSelect, WorkoutSelect } from '@/db/schema';
import { SetItem } from '../set-item';
import { ChevronRight } from 'lucide-react-native';
import { Pressable } from '@/components/primitives/pressable';
import { router } from 'expo-router';

const styles = StyleSheet.create((theme, rt) => ({
    headerContainer: {
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
    },
    header: {
        paddingBottom: theme.space(2),
    },
    chevronContainer: {
        width: theme.space(6),
        marginTop: -theme.space(1.5),
    },
    workoutName: {
        color: theme.colors.typography,
        opacity: 0.6,
        fontSize: theme.fontSize.sm.fontSize,
        fontWeight: theme.fontWeight.default.fontWeight,
    },
    workoutDate: {
        color: theme.colors.typography,
        fontSize: theme.fontSize.lg.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
    },
    setsContainer: {
        gap: 0,
    },
}));

interface WorkoutGroupProps {
    workout: WorkoutSelect;
    sets: ExerciseSetSelect[];
    exercise: ExerciseSelect;
}

const formatWorkoutDate = (workout: WorkoutSelect): string => {
    const date = workout.completedAt || workout.startedAt || workout.createdAt;
    return dayjs(date).format('LL');
};

export const WorkoutGroup: FC<WorkoutGroupProps> = ({ workout, sets, exercise }) => {
    const { theme } = useUnistyles();

    const handlePress = () => {
        router.navigate(`/workout/${workout.id}`);
    };

    return (
        <Box>
            <HStack style={styles.headerContainer}>
                <Box style={styles.header}>
                    <Text style={styles.workoutDate}>{formatWorkoutDate(workout)}</Text>
                    <Text style={styles.workoutName}>{workout.name}</Text>
                </Box>
                <Pressable style={styles.chevronContainer} onPress={handlePress}>
                    <ChevronRight size={theme.space(6)} color={theme.colors.typography} />
                </Pressable>
            </HStack>
            <Box style={styles.headerDivider} />
            <VStack style={styles.setsContainer}>
                {sets.map((set) => (
                    <SetItem key={set.id} set={set} exercise={exercise} />
                ))}
            </VStack>
        </Box>
    );
};
