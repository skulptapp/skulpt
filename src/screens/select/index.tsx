import { FC, useCallback, useDeferredValue, useMemo, useState } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { router, useLocalSearchParams } from 'expo-router';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { Search } from '@/screens/exercises/exercises/components/search';
import { useExercisesList, useMergeExercise } from '@/hooks/use-exercises';
import { ExercisesListContainer } from '@/screens/exercises/exercises/components/list/container';
import { Button } from '@/components/buttons/base';
import {
    useCreateWorkoutExercise,
    useCreateExerciseSet,
    useWorkoutGroups,
    useCreateWorkoutGroup,
} from '@/hooks/use-workouts';
import { getLastExerciseSetsByExerciseId } from '@/crud/exercise';
import { ExerciseSetSelect } from '@/db/schema';
import { CreateButton } from '@/components/buttons/create';
import { FilterButton } from '@/components/buttons/filter';
import { useEditor } from '@/hooks/use-editor';
import { useAnalytics } from '@/hooks/use-analytics';
import { useFilterStore, hasActiveFilters } from '@/stores/filter';
import { useShallow } from 'zustand/shallow';

type SelectedList = string[];

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        paddingTop: rt.insets.top,
    },
    contentWrapper: {
        flexGrow: 1,
    },
    header: {
        paddingHorizontal: theme.space(4),
        paddingTop: theme.space(3),
        paddingBottom: theme.space(2),
        backgroundColor: theme.colors.background,
        gap: theme.space(2),
    },
    listContainer: {
        flex: 1,
    },
    contentContainer: (selected: boolean) => ({
        paddingBottom: rt.insets.bottom + (selected ? theme.space(20) : 0),
    }),
    selectCircle: (selected: boolean) => ({
        width: theme.space(5),
        height: theme.space(5),
        borderRadius: theme.space(5),
        borderWidth: 2,
        borderColor: selected ? theme.colors.typography : theme.colors.border,
        backgroundColor: selected ? theme.colors.typography : 'transparent',
    }),
    headerContentContainer: {
        paddingBottom: theme.space(2),
        justifyContent: 'space-between',
    },
    headerLeftContentContainer: {
        flex: 1,
        alignItems: 'flex-start',
    },
    headerRightContentContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: theme.space(2.5),
    },
    headerTitleContainer: {
        flexGrow: 1,
        alignItems: 'center',
    },
    bottomActionsContainer: {
        position: 'absolute',
        bottom: 0,
        paddingHorizontal: theme.space(4),
        paddingBottom: theme.space(5) + rt.insets.bottom,
        width: '100%',
    },
    createButton: {
        width: theme.space(6),
        height: theme.space(6),
        backgroundColor: theme.colors.background,
    },
    filterButton: {
        paddingTop: theme.space(0),
    },
    filterDot: {
        right: 0,
    },
}));

const SelectExercisesScreen: FC = () => {
    const { t } = useTranslation(['common', 'screens']);

    const { workoutId, merge, sourceExerciseId } = useLocalSearchParams<{
        workoutId?: string;
        merge?: string;
        sourceExerciseId?: string;
    }>();

    const isMergeMode = merge === 'true' && !!sourceExerciseId;

    const filterState = useFilterStore(
        useShallow((s) => ({
            ownership: s.ownership,
            category: s.category,
            tracking: s.tracking,
            primaryMuscle: s.primaryMuscle,
        })),
    );
    const filters = useMemo(
        () => ({
            ownership: filterState.ownership,
            category: filterState.category,
            tracking: filterState.tracking,
            primaryMuscle: filterState.primaryMuscle,
        }),
        [
            filterState.ownership,
            filterState.category,
            filterState.tracking,
            filterState.primaryMuscle,
        ],
    );

    const { data: rawExercises, isLoading, isFetching, error } = useExercisesList(filters);
    const { data: existingGroups } = useWorkoutGroups(workoutId || '');

    const createWorkoutExercise = useCreateWorkoutExercise();
    const createWorkoutGroup = useCreateWorkoutGroup();
    const createExerciseSet = useCreateExerciseSet();
    const mergeExercise = useMergeExercise();

    const [query, setQuery] = useState('');
    const deferredQuery = useDeferredValue(query);
    const [selected, setSelected] = useState<SelectedList>([]);
    const [submitting, setSubmitting] = useState(false);

    const { theme } = useUnistyles();

    const { navigate } = useEditor();
    const { track } = useAnalytics();

    // Filter out source exercise in merge mode
    const filteredExercises = useMemo(() => {
        if (!isMergeMode || !rawExercises) return rawExercises;
        return rawExercises.filter((e) => e.id !== sourceExerciseId);
    }, [rawExercises, isMergeMode, sourceExerciseId]);

    const hasSelected = selected.length > 0;
    const contentContainerStyle = useMemo(
        () => styles.contentContainer(hasSelected),
        [hasSelected],
    );

    const toggle = useCallback(
        (exerciseId: string) => {
            if (isMergeMode) {
                // Single select in merge mode
                setSelected((prev) => (prev.includes(exerciseId) ? [] : [exerciseId]));
            } else {
                setSelected((prev) =>
                    prev.includes(exerciseId)
                        ? prev.filter((id) => id !== exerciseId)
                        : [...prev, exerciseId],
                );
            }
        },
        [isMergeMode],
    );

    const handleCancel = useCallback(() => {
        router.back();
    }, []);

    const handleMerge = useCallback(async () => {
        if (!sourceExerciseId || selected.length !== 1 || submitting) return;

        try {
            setSubmitting(true);
            const targetId = selected[0];
            await mergeExercise.mutateAsync({ sourceId: sourceExerciseId, targetId });
            router.dismiss();
            router.replace(`/exercises/${targetId}`);
        } finally {
            setSubmitting(false);
        }
    }, [sourceExerciseId, selected, submitting, mergeExercise]);

    const handleAdd = useCallback(async () => {
        if (!workoutId || selected.length === 0 || submitting) return;

        try {
            setSubmitting(true);
            const currentMaxGroupOrder = (existingGroups || []).reduce(
                (max, g) => (g.order > max ? g.order : max),
                -1,
            );
            let nextGroupOrder = currentMaxGroupOrder + 1;

            const exerciseMap = new Map((rawExercises || []).map((e) => [e.id, e]));

            const uniqueExerciseIds = Array.from(new Set(selected));
            const prevSetsByExerciseId: Record<string, ExerciseSetSelect[]> = {};

            await Promise.all(
                uniqueExerciseIds.map(async (exerciseId) => {
                    prevSetsByExerciseId[exerciseId] =
                        await getLastExerciseSetsByExerciseId(exerciseId);
                }),
            );

            for (let idx = 0; idx < selected.length; idx += 1) {
                const exerciseId = selected[idx];
                const singleGroup = await createWorkoutGroup.mutateAsync({
                    workoutId,
                    type: 'single',
                    order: nextGroupOrder++,
                    notes: null,
                });
                const groupId = singleGroup.id;
                const orderInGroup = 0;

                const created = await createWorkoutExercise.mutateAsync({
                    workoutId,
                    exerciseId,
                    groupId,
                    orderInGroup: orderInGroup ?? 0,
                });

                const prevSets = prevSetsByExerciseId[exerciseId];
                if (prevSets && prevSets.length > 0) {
                    await Promise.all(
                        prevSets.map((s, orderIndex) =>
                            createExerciseSet.mutateAsync({
                                workoutExerciseId: created.id,
                                order: orderIndex,
                                type: s.type,
                                weight: s.weight ?? null,
                                reps: s.reps ?? null,
                                time: s.time ?? null,
                                distance: s.distance ?? null,
                                rpe: s.rpe ?? null,
                                restTime: s.restTime ?? null,
                                round: orderIndex,
                            }),
                        ),
                    );
                } else {
                    const ex = exerciseMap.get(exerciseId);
                    const tracks = ex?.tracking || [];
                    await createExerciseSet.mutateAsync({
                        workoutExerciseId: created.id,
                        order: 0,
                        type: 'working',
                        weight: tracks.includes('weight') ? 0 : null,
                        reps: tracks.includes('reps') ? 0 : null,
                        time: tracks.includes('time') ? 0 : null,
                        distance: tracks.includes('distance') ? 0 : null,
                        rpe: null,
                        restTime: null,
                        round: 0,
                    });
                }
            }

            track('workout:exercise_add', {
                workoutId,
                exerciseCount: selected.length,
            });

            router.back();
        } finally {
            setSubmitting(false);
        }
    }, [
        workoutId,
        selected,
        createWorkoutExercise,
        submitting,
        rawExercises,
        createExerciseSet,
        existingGroups,
        createWorkoutGroup,
        track,
    ]);

    const handleExerciseCreate = useCallback(() => {
        navigate({ type: 'exercise__create' });
    }, [navigate]);

    const handleFilterOpen = useCallback(() => {
        router.navigate('/filter');
    }, []);

    const headerTitle = isMergeMode ? t('merge', { ns: 'common' }) : t('add', { ns: 'common' });

    const actionButtonTitle = isMergeMode
        ? t('merge', { ns: 'common' })
        : t('add', { ns: 'common' });

    const handleAction = isMergeMode ? handleMerge : handleAdd;

    return (
        <Box style={styles.container}>
            <Box style={styles.header}>
                <HStack style={styles.headerContentContainer}>
                    <Box style={styles.headerLeftContentContainer}>
                        <Button
                            type="link"
                            title={t('cancel', { ns: 'common' })}
                            onPress={handleCancel}
                        />
                    </Box>
                    <Box style={styles.headerTitleContainer}>
                        <Text fontWeight="bold">{headerTitle}</Text>
                    </Box>
                    <HStack style={styles.headerRightContentContainer}>
                        <FilterButton
                            onPress={handleFilterOpen}
                            active={hasActiveFilters(filterState)}
                            containerStyle={[styles.createButton, styles.filterButton]}
                            dotStyle={styles.filterDot}
                            iconColor={theme.colors.typography}
                            iconSize={theme.space(5)}
                        />
                        {!isMergeMode && (
                            <CreateButton
                                onPressHandler={handleExerciseCreate}
                                containerStyle={styles.createButton}
                                iconColor={theme.colors.typography}
                                iconSize={theme.space(6)}
                            />
                        )}
                    </HStack>
                </HStack>
                <Search
                    value={query}
                    onChange={setQuery}
                    placeholder={t('placeholder.search', { ns: 'common' })}
                />
            </Box>
            <ExercisesListContainer
                mode="select"
                rawExercises={filteredExercises}
                query={deferredQuery}
                isLoading={isLoading || isFetching}
                error={error}
                extraData={selected}
                selected={selected}
                onToggle={toggle}
                contentContainerStyle={contentContainerStyle}
            />
            {selected.length > 0 && (
                <Box style={styles.bottomActionsContainer}>
                    <Button
                        onPress={handleAction}
                        title={actionButtonTitle}
                        disabled={submitting}
                        loading={submitting}
                    />
                </Box>
            )}
        </Box>
    );
};

export default SelectExercisesScreen;
