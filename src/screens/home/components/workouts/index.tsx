import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';

import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { WorkoutSelect } from '@/db/schema';
import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { WorkoutGroup } from '@/helpers/workouts';
import { useRunningWorkoutStatic, useRunningWorkoutTicker } from '@/hooks/use-running-workout';
import type { WorkoutOverviewMetaMap } from '@/hooks/use-workouts';
import { Pushes } from '@/components/promo/pushes';

import { WorkoutCard } from '../workout-card';
import { Header } from '../header';
import { WeekStats } from '../week';

type WorkoutSectionType = 'in_progress' | 'planned' | 'completed';

type CardItem = {
    type: 'card';
    key: string;
    workout: WorkoutSelect;
    section: WorkoutSectionType;
    isFirstInSection: boolean;
};

type PlannedHeaderItem = {
    type: 'planned_header';
    key: string;
    title: string;
    hasTopSpacing: boolean;
};

type CompletedHeaderItem = {
    type: 'completed_header';
    key: string;
    title: string;
    workoutsCount: number;
    hasTopSpacing: boolean;
};

type WorkoutsListItem = CardItem | PlannedHeaderItem | CompletedHeaderItem;

const COMPLETED_WEEKS_PAGE_SIZE = 5;

interface WorkoutsProps {
    workouts: WorkoutSelect[];
    firstWeekday: number;
    inProgressWorkouts: WorkoutSelect[];
    plannedWorkouts: WorkoutSelect[];
    completedGroups: WorkoutGroup[];
    workoutsOverviewMeta: WorkoutOverviewMetaMap;
}

const styles = StyleSheet.create((theme, rt) => ({
    listContainer: {
        flex: 1,
    },
    listContent: {
        ...theme.screenContentPadding('root'),
        paddingBottom: rt.insets.bottom + theme.space(4),
    },
    headerContent: {
        gap: theme.space(5),
        paddingBottom: theme.space(5),
    },
    sectionHeaderContainer: (hasTopSpacing: boolean) => ({
        paddingHorizontal: theme.space(4),
        marginTop: hasTopSpacing ? theme.space(6) : 0,
    }),
    sectionHeader: {
        fontSize: theme.fontSize.xl.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    completedHeaderContainer: (hasTopSpacing: boolean) => ({
        marginTop: hasTopSpacing ? theme.space(6) : 0,
        gap: theme.space(3),
    }),
    workoutsStatsContainer: {
        paddingHorizontal: theme.space(4),
    },
    workoutsCountContainer: {
        backgroundColor: theme.colors.foreground,
        paddingHorizontal: theme.space(3),
        paddingVertical: theme.space(1),
        borderRadius: theme.radius.full,
    },
    workoutsCount: {
        fontSize: theme.fontSize.sm.fontSize,
        color: theme.colors.typography,
        fontWeight: theme.fontWeight.medium.fontWeight,
    },
    cardContainer: (isFirstInSection: boolean, section: WorkoutSectionType) => ({
        paddingHorizontal: theme.space(4),
        marginTop: isFirstInSection
            ? section === 'in_progress'
                ? 0
                : theme.space(3)
            : theme.space(2),
    }),
}));

export const Workouts: FC<WorkoutsProps> = ({
    workouts,
    firstWeekday,
    inProgressWorkouts,
    plannedWorkouts,
    completedGroups,
    workoutsOverviewMeta,
}) => {
    const { t } = useTranslation(['screens']);
    const router = useRouter();
    const { runningWorkout } = useRunningWorkoutStatic();
    const { elapsedFormated } = useRunningWorkoutTicker();
    const [visibleCompletedWeeksCount, setVisibleCompletedWeeksCount] =
        useState(COMPLETED_WEEKS_PAGE_SIZE);

    useEffect(() => {
        setVisibleCompletedWeeksCount(COMPLETED_WEEKS_PAGE_SIZE);
    }, [completedGroups]);

    const visibleCompletedGroups = useMemo(
        () => completedGroups.slice(0, visibleCompletedWeeksCount),
        [completedGroups, visibleCompletedWeeksCount],
    );
    const hasMoreCompletedWeeks = visibleCompletedWeeksCount < completedGroups.length;

    const handleWorkoutPress = useCallback(
        (workoutId: string) => {
            router.navigate(`/workout/${workoutId}`);
        },
        [router],
    );

    const handleEndReached = useCallback(() => {
        if (!hasMoreCompletedWeeks) {
            return;
        }

        setVisibleCompletedWeeksCount((prev) =>
            Math.min(prev + COMPLETED_WEEKS_PAGE_SIZE, completedGroups.length),
        );
    }, [completedGroups.length, hasMoreCompletedWeeks]);

    const listItems = useMemo<WorkoutsListItem[]>(() => {
        const items: WorkoutsListItem[] = [];

        if (inProgressWorkouts.length > 0) {
            inProgressWorkouts.forEach((workout, index) => {
                items.push({
                    type: 'card',
                    key: `in-progress-card-${workout.id}`,
                    workout,
                    section: 'in_progress',
                    isFirstInSection: index === 0,
                });
            });
        }

        if (plannedWorkouts.length > 0) {
            items.push({
                type: 'planned_header',
                key: 'planned-header',
                title: t('home.planned', { ns: 'screens' }),
                hasTopSpacing: items.length > 0,
            });

            plannedWorkouts.forEach((workout, index) => {
                items.push({
                    type: 'card',
                    key: `planned-card-${workout.id}`,
                    workout,
                    section: 'planned',
                    isFirstInSection: index === 0,
                });
            });
        }

        visibleCompletedGroups.forEach((group) => {
            items.push({
                type: 'completed_header',
                key: `completed-header-${group.id}`,
                title: group.title,
                workoutsCount: group.workouts.length,
                hasTopSpacing: items.length > 0,
            });

            group.workouts.forEach((workout, index) => {
                items.push({
                    type: 'card',
                    key: `completed-card-${group.id}-${workout.id}`,
                    workout,
                    section: 'completed',
                    isFirstInSection: index === 0,
                });
            });
        });

        return items;
    }, [inProgressWorkouts, plannedWorkouts, visibleCompletedGroups, t]);

    const renderHeader = useCallback(
        () => (
            <VStack style={styles.headerContent}>
                <Header />
                <WeekStats workouts={workouts} firstWeekday={firstWeekday} />
                <Pushes />
            </VStack>
        ),
        [firstWeekday, workouts],
    );

    const renderItem = useCallback(
        ({ item }: { item: WorkoutsListItem }) => {
            if (item.type === 'planned_header') {
                return (
                    <Box style={styles.sectionHeaderContainer(item.hasTopSpacing)}>
                        <Text style={styles.sectionHeader}>{item.title}</Text>
                    </Box>
                );
            }

            if (item.type === 'completed_header') {
                return (
                    <VStack style={styles.completedHeaderContainer(item.hasTopSpacing)}>
                        <Box style={styles.sectionHeaderContainer(false)}>
                            <Text style={styles.sectionHeader}>{item.title}</Text>
                        </Box>
                        <HStack style={styles.workoutsStatsContainer}>
                            <Box style={styles.workoutsCountContainer}>
                                <Text style={styles.workoutsCount}>
                                    {t('home.workoutsCount', {
                                        ns: 'screens',
                                        count: item.workoutsCount,
                                    })}
                                </Text>
                            </Box>
                        </HStack>
                    </VStack>
                );
            }

            const activeElapsedFormatted =
                item.section === 'in_progress' && item.workout.id === runningWorkout?.id
                    ? elapsedFormated
                    : null;

            return (
                <Box style={styles.cardContainer(item.isFirstInSection, item.section)}>
                    <WorkoutCard
                        workout={item.workout}
                        onPress={handleWorkoutPress}
                        activeElapsedFormatted={activeElapsedFormatted}
                        overviewMeta={workoutsOverviewMeta[item.workout.id]}
                    />
                </Box>
            );
        },
        [elapsedFormated, handleWorkoutPress, runningWorkout?.id, t, workoutsOverviewMeta],
    );

    return (
        <FlashList
            data={listItems}
            renderItem={renderItem}
            keyExtractor={(item) => item.key}
            getItemType={(item) => item.type}
            drawDistance={320}
            ListHeaderComponent={renderHeader}
            contentContainerStyle={styles.listContent}
            style={styles.listContainer}
            showsVerticalScrollIndicator={false}
            extraData={`${runningWorkout?.id || ''}:${elapsedFormated}`}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.15}
        />
    );
};
