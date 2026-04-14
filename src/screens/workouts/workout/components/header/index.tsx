import { FC, useMemo } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Title } from '@/components/typography/title';
import { Box } from '@/components/primitives/box';
import { useLocalSearchParams } from 'expo-router';
import { useWorkout } from '@/hooks/use-workouts';
import { useRunningWorkoutTicker } from '@/hooks/use-running-workout';
import { Text } from '@/components/primitives/text';
import { useSupersetEditStore } from '@/stores/superset-edit';

const styles = StyleSheet.create((theme) => ({
    container: {
        paddingHorizontal: theme.space(4),
        backgroundColor: theme.colors.lime[400],
        paddingBottom: theme.space(5),
    },
    stateContainer: {
        position: 'relative',
        marginTop: theme.headerContentTopOffset(theme.space(11)),
        marginBottom: theme.space(3.5),
        justifyContent: 'center',
        alignItems: 'center',
        height: theme.space(11),
    },
    state: {
        fontSize: theme.fontSize.sm.fontSize,
        fontWeight: theme.fontWeight.medium.fontWeight,
        color: theme.colors.neutral[950],
    },
    title: {
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.neutral[950],
    },
    stateTitle: {
        fontWeight: theme.fontWeight.semibold.fontWeight,
        fontSize: theme.fontSize.default.fontSize,
        color: theme.colors.neutral[950],
    },
}));

export const Header: FC = () => {
    const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
    const { t } = useTranslation(['common', 'screens']);

    const { data: workout } = useWorkout(workoutId);

    const { elapsedSeconds, elapsedFormated } = useRunningWorkoutTicker();

    const isEditMode = useSupersetEditStore((state) => state.workoutId === workoutId);

    const title = useMemo(() => {
        if (isEditMode) {
            return t('workout.supersets.edit', { ns: 'screens' });
        }
        if (workout?.status === 'in_progress' && elapsedSeconds > 0) {
            return elapsedFormated;
        }
        if (workout?.status) {
            return t(`workoutStatus.${workout?.status}`, { ns: 'common' });
        }
        return null;
    }, [isEditMode, workout?.status, elapsedSeconds, elapsedFormated, t]);

    return (
        <Box style={styles.container}>
            <Box style={styles.stateContainer}>
                {title && <Text style={styles.stateTitle}>{title}</Text>}
            </Box>
            <Title type="h3" style={styles.title}>
                {workout?.name}
            </Title>
        </Box>
    );
};
