import { FC } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { ExerciseSelect } from '@/db/schema';
import type { ExerciseHistoryItem } from '@/crud/exercise';
import { WorkoutGroup } from './workout-group';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        paddingHorizontal: theme.space(4),
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: theme.space(8),
        paddingTop: theme.space(10),
        paddingBottom: rt.insets.bottom === 0 ? theme.space(10) : rt.insets.bottom,
        gap: theme.space(2),
    },
    emptyTitle: {
        color: theme.colors.typography,
        fontSize: theme.fontSize.xl.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
    },
    emptyDescription: {
        color: theme.colors.typography,
        opacity: 0.6,
        textAlign: 'center',
    },
    historyContainer: {
        gap: theme.space(5),
    },
}));

interface HistoryProps {
    history: ExerciseHistoryItem[];
    exercise: ExerciseSelect;
}

export const History: FC<HistoryProps> = ({ history, exercise }) => {
    const { t } = useTranslation(['screens']);

    if (history.length === 0) {
        return (
            <VStack style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>
                    {t('exercise.history.empty.title', { ns: 'screens' })}
                </Text>
                <Text style={styles.emptyDescription}>
                    {t('exercise.history.empty.description', { ns: 'screens' })}
                </Text>
            </VStack>
        );
    }

    return (
        <Box style={styles.container}>
            <VStack style={styles.historyContainer}>
                {history.map((item) => (
                    <WorkoutGroup
                        key={item.workoutExercise.id}
                        workout={item.workout}
                        sets={item.sets}
                        exercise={exercise}
                    />
                ))}
            </VStack>
        </Box>
    );
};
