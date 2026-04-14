import { FC, useMemo } from 'react';
import dayjs from 'dayjs';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { ScrollView } from '@/components/primitives/scrollview';
import { CloseButton } from '@/components/buttons/close';
import { Title } from '@/components/typography/title';
import type { WorkoutSelect } from '@/db/schema';
import { useWorkoutDayHealthStats, useWorkoutDaySummary } from '@/hooks/use-workouts';
import { useUser } from '@/hooks/use-user';
import { Stats } from '@/screens/workouts/workout/components/stats';

type DaySummaryParam = {
    date?: string | string[];
};

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        justifyContent: 'flex-end',
        height: theme.screenHeaderHeight(),
        paddingHorizontal: theme.space(4),
    },
    headerRow: {
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitleContainer: {
        minWidth: 0,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    content: {
        ...theme.screenContentPadding('child'),
        paddingHorizontal: theme.space(4),
        gap: theme.space(5),
    },
    healthStatsContainer: {
        marginHorizontal: 0,
        paddingTop: 0,
        paddingBottom: theme.space(1),
    },
}));

const normalizeDateKey = (value: string | string[] | undefined): string => {
    if (Array.isArray(value)) return value[0] ?? '';
    return value ?? '';
};

const isDateKeyValid = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const capitalizeFirst = (value: string): string => {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
};

const DaySummaryScreen: FC = () => {
    const { t } = useTranslation(['common', 'screens']);
    const { user } = useUser();
    const { date } = useLocalSearchParams<DaySummaryParam>();

    const dateKey = useMemo(() => normalizeDateKey(date), [date]);
    const validDateKey = useMemo(() => (isDateKeyValid(dateKey) ? dateKey : ''), [dateKey]);

    const summary = useWorkoutDaySummary(validDateKey);
    const healthStats = useWorkoutDayHealthStats(validDateKey);

    const headerTitle = useMemo(() => {
        if (!validDateKey) return t('results.daySummary.title', { ns: 'screens' });
        return capitalizeFirst(dayjs(validDateKey).format('D MMMM YYYY'));
    }, [t, validDateKey]);

    const healthWorkout = useMemo<WorkoutSelect>(() => {
        const baseDate = validDateKey ? dayjs(validDateKey) : dayjs();
        const completedAt = baseDate.endOf('day').toDate();
        const duration = Math.max(0, summary.totalWorkoutDurationSeconds);
        const startedAt = new Date(completedAt.getTime() - duration * 1000);
        const startAt = baseDate.startOf('day').toDate();

        return {
            id: `day-summary-${validDateKey || 'unknown'}`,
            name: t('results.daySummary.title', { ns: 'screens' }),
            status: 'completed',
            startAt,
            startedAt,
            completedAt,
            duration,
            remind: null,
            userId: user?.id || 'day-summary',
            createdAt: startAt,
            updatedAt: completedAt,
        };
    }, [summary.totalWorkoutDurationSeconds, t, user?.id, validDateKey]);

    const workoutSummaryMetrics = useMemo(
        () => ({
            workoutsCount: summary.workoutsCount,
            workoutDurationSeconds: summary.totalWorkoutDurationSeconds,
            totalSetTimeSeconds: summary.totalSetTimeSeconds,
            totalRestTimeSeconds: summary.totalRestTimeSeconds,
            volume: summary.volume,
            exercisesCount: summary.exercisesCount,
            setsCount: summary.setsCount,
            repsCount: summary.repsCount,
        }),
        [summary],
    );

    const handleClose = () => {
        router.back();
    };

    return (
        <Box style={styles.container}>
            <Box style={styles.header}>
                <HStack style={styles.headerRow}>
                    <Box style={styles.headerTitleContainer}>
                        <Title type="h2">{headerTitle}</Title>
                    </Box>
                    <CloseButton onPressHandler={handleClose} />
                </HStack>
            </Box>
            <ScrollView contentContainerStyle={styles.content}>
                <Stats
                    workout={healthWorkout}
                    healthStats={healthStats}
                    workoutStats={workoutSummaryMetrics}
                    forceShowLocomotionMetrics={summary.hasLocomotionMetricsSource}
                    containerStyle={styles.healthStatsContainer}
                    zonePercentageTotalSeconds={summary.totalWorkoutDurationSeconds}
                />
            </ScrollView>
        </Box>
    );
};

export default DaySummaryScreen;
