import { FC, useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { useWorkouts, useWorkoutsOverviewMeta } from '@/hooks/use-workouts';
import { useEditor } from '@/hooks/use-editor';
import { useUser } from '@/hooks/use-user';
import { getPlannedWorkouts, groupWorkoutsByWeek, getInProgressWorkouts } from '@/helpers/workouts';
import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';
import { Box } from '@/components/primitives/box';

import { Header, Workouts } from './components';
import { Button } from '@/components/buttons/base';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
    },
    empty: {
        ...theme.screenContentPadding('root'),
        flex: 1,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: theme.space(8),
        paddingBottom: rt.insets.bottom + theme.space(25),
        gap: theme.space(8),
    },
    emptyContent: {
        justifyContent: 'center',
        alignItems: 'center',
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
    emptyButtonContainer: {
        width: '100%',
    },
    buttonTitle: {
        fontSize: theme.fontSize.default.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: rt.themeName === 'dark' ? theme.colors.neutral[950] : theme.colors.white,
        textAlign: 'center',
    },
    buttonDescription: {
        fontSize: theme.fontSize.xs.fontSize,
        textAlign: 'center',
        marginTop: -theme.space(1),
        color: rt.themeName === 'dark' ? theme.colors.neutral[950] : theme.colors.white,
        opacity: 0.8,
    },
}));

const HomeScreen: FC = () => {
    const { navigate } = useEditor();
    const { t, i18n } = useTranslation(['screens']);
    const { user } = useUser();

    const { data: workouts, isLoading } = useWorkouts();
    const workoutIds = useMemo(() => (workouts ?? []).map((workout) => workout.id), [workouts]);
    const { data: workoutsOverviewMeta = {} } = useWorkoutsOverviewMeta(workoutIds);

    const handleCreateWorkout = useCallback(() => {
        navigate({ type: 'workout__create' });
    }, [navigate]);

    const { inProgressWorkouts, plannedWorkouts, completedGroups, hasWorkouts } = useMemo(() => {
        const workoutsList = workouts ?? [];
        const inProgress = getInProgressWorkouts(workoutsList);
        const planned = getPlannedWorkouts(workoutsList);
        const completed = groupWorkoutsByWeek(workoutsList, i18n.language, user?.firstWeekday || 2);
        const hasAny = inProgress.length > 0 || planned.length > 0 || completed.length > 0;

        return {
            inProgressWorkouts: inProgress,
            plannedWorkouts: planned,
            completedGroups: completed,
            hasWorkouts: hasAny,
        };
    }, [workouts, i18n.language, user?.firstWeekday]);

    if (isLoading || !workouts) {
        return null;
    }

    const ButtonContent: FC = () => (
        <VStack>
            <Text style={styles.buttonTitle}>
                {t('home.empty.button.title', { ns: 'screens' })}
            </Text>
            <Text style={styles.buttonDescription}>
                {t('home.empty.button.description', { ns: 'screens' })}
            </Text>
        </VStack>
    );

    if (!hasWorkouts) {
        return (
            <VStack style={styles.empty}>
                <Header />
                <VStack style={styles.emptyContainer}>
                    <VStack style={styles.emptyContent}>
                        <Box>
                            <Text style={styles.emptyTitle}>
                                {t('home.empty.title', { ns: 'screens' })}
                            </Text>
                        </Box>
                        <Box>
                            <Text style={styles.emptyDescription}>
                                {t('home.empty.description', { ns: 'screens' })}
                            </Text>
                        </Box>
                    </VStack>
                    <Box style={styles.emptyButtonContainer}>
                        <Button size="lg" onPress={handleCreateWorkout} title={<ButtonContent />} />
                    </Box>
                </VStack>
            </VStack>
        );
    }

    return (
        <Box style={styles.container}>
            <Workouts
                workouts={workouts}
                firstWeekday={user?.firstWeekday || 2}
                inProgressWorkouts={inProgressWorkouts}
                plannedWorkouts={plannedWorkouts}
                completedGroups={completedGroups}
                workoutsOverviewMeta={workoutsOverviewMeta}
            />
        </Box>
    );
};

export default HomeScreen;
