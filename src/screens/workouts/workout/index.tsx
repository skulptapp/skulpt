import { FC, useMemo, useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Sortable from 'react-native-sortables';

import { Box } from '@/components/primitives/box';
import { ScrollView } from '@/components/primitives/scrollview';
import {
    useWorkoutExercises,
    useWorkoutWithDetails,
    useDeleteWorkoutExercise,
    useUpdateWorkoutExercise,
    useWorkoutGroups,
    useUpdateWorkoutGroup,
    useDeleteWorkoutGroup,
} from '@/hooks/use-workouts';

import { EmptyState, Header, LoadingState, Actions, EditModeActions, Stats } from './components';
import { WorkoutItem } from './types';
import { Exercise } from './components/exercise';
import { Pushes } from '@/components/promo/pushes';
import { useRunningWorkoutTicker } from '@/hooks/use-running-workout';
import { useAnalytics } from '@/hooks/use-analytics';
import { useWorkoutHealthStats } from '@/hooks/use-workout-health-stats';
import { useUser } from '@/hooks/use-user';
import { WorkoutExerciseSelect } from '@/db/schema/workout';
import { useSupersetEditStore } from '@/stores/superset-edit';
import { useManageCircuitGroups } from './hooks/use-manage-circuit-groups';
import { buildWorkoutMetricsValues } from './components/stats/builders';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
    },
    content: {
        flexGrow: 1,
        paddingBottom: rt.insets.bottom + theme.space(20),
        backgroundColor: theme.colors.background,
    },
    scroll: {
        flex: 1,
    },
    pushes: {
        marginTop: theme.space(5),
        marginBottom: theme.space(2),
    },
}));

type AbsorptionInfo = {
    itemId: string;
    targetGroupId: string;
    oldGroupId: string | null;
} | null;

/**
 * Check if the dragged item landed between two members of a circuit group.
 * If so, absorb the dragged item into that group by mutating idToWE in-place.
 */
const detectAbsorption = (
    data: WorkoutItem[],
    draggedKey: string,
    idToWE: Map<string, WorkoutExerciseSelect>,
    groupTypeMap: Map<string, string>,
): AbsorptionInfo => {
    const draggedWE = idToWE.get(draggedKey);
    if (!draggedWE) return null;

    const dragIdx = data.findIndex((it) => it.id === draggedKey);
    if (dragIdx < 0) return null;

    const leftNeighbor = dragIdx > 0 ? data[dragIdx - 1] : null;
    const rightNeighbor = dragIdx < data.length - 1 ? data[dragIdx + 1] : null;

    if (!leftNeighbor || !rightNeighbor) return null;

    const leftWE = idToWE.get(leftNeighbor.id);
    const rightWE = idToWE.get(rightNeighbor.id);

    if (!leftWE?.groupId || !rightWE?.groupId) return null;

    // Both neighbors must be from the same group
    if (leftWE.groupId !== rightWE.groupId) return null;

    // That group must be a circuit (non-single)
    const targetGroupType = groupTypeMap.get(leftWE.groupId);
    if (targetGroupType === 'single') return null;

    // The dragged item must NOT already be in that group
    if (draggedWE.groupId === leftWE.groupId) return null;

    const targetGroupId = leftWE.groupId;
    const oldGroupId = draggedWE.groupId;

    // Mutate idToWE so coalescence treats this item as a group member
    idToWE.set(draggedKey, { ...draggedWE, groupId: targetGroupId });

    return { itemId: draggedKey, targetGroupId, oldGroupId };
};

/**
 * After a drag, ensure all members of every group stay contiguous.
 * The dragged item's position determines where its group lands.
 * Also absorbs the dragged item into a circuit group if it landed inside one.
 */
const coalesceGroups = (
    data: WorkoutItem[],
    draggedKey: string,
    idToWE: Map<string, WorkoutExerciseSelect>,
    groupTypeMap: Map<string, string>,
): { result: WorkoutItem[]; absorption: AbsorptionInfo } => {
    // Check if dragged item should be absorbed into a circuit group
    const absorption = detectAbsorption(data, draggedKey, idToWE, groupTypeMap);

    const draggedWE = idToWE.get(draggedKey);
    const draggedGroupId = draggedWE?.groupId;

    let result = [...data];

    if (absorption) {
        // Item was absorbed — the target group already has the correct order
        // in data (dragged item is between group members). Skip coalescence
        // for the target group, only fix other groups that got split.
        result = coalesceAllGroups(result, idToWE, absorption.targetGroupId);
    } else {
        if (draggedGroupId) {
            // Only coalesce if the dragged group is actually split
            const groupIndices: number[] = [];
            for (let i = 0; i < result.length; i++) {
                const we = idToWE.get(result[i].id);
                if (we?.groupId === draggedGroupId) groupIndices.push(i);
            }
            const isContiguous =
                groupIndices.length <= 1 ||
                groupIndices.every((idx, k) => k === 0 || idx === groupIndices[k - 1]! + 1);
            if (!isContiguous) {
                result = coalesceGroup(result, draggedGroupId, draggedKey, idToWE);
            }
        }
        result = coalesceAllGroups(result, idToWE, draggedGroupId);
    }

    return { result, absorption };
};

/**
 * Coalesce a specific group around a pivot item (the dragged one).
 * Items with lower orderInGroup go before the pivot, higher go after.
 */
const coalesceGroup = (
    items: WorkoutItem[],
    groupId: string,
    pivotId: string,
    idToWE: Map<string, WorkoutExerciseSelect>,
): WorkoutItem[] => {
    const pivotWE = idToWE.get(pivotId);
    if (!pivotWE) return items;

    // Collect group members sorted by orderInGroup
    const groupMembers = items
        .filter((it) => {
            const we = idToWE.get(it.id);
            return we?.groupId === groupId;
        })
        .sort((a, b) => {
            const aOrder = idToWE.get(a.id)?.orderInGroup ?? 0;
            const bOrder = idToWE.get(b.id)?.orderInGroup ?? 0;
            return aOrder - bOrder;
        });

    if (groupMembers.length <= 1) return items;

    // Remove all group members from the list
    const withoutGroup = items.filter((it) => {
        const we = idToWE.get(it.id);
        return we?.groupId !== groupId;
    });

    // Find where the pivot would be in the filtered list
    // by finding its original position among non-group items
    const pivotIdx = items.findIndex((it) => it.id === pivotId);

    // Count how many non-group items are before the pivot
    let insertAt = 0;
    for (let i = 0; i < pivotIdx; i++) {
        const we = idToWE.get(items[i].id);
        if (we?.groupId !== groupId) insertAt++;
    }

    // Insert all group members (sorted by orderInGroup) at that position
    withoutGroup.splice(insertAt, 0, ...groupMembers);

    return withoutGroup;
};

/**
 * Ensure all groups (except the already-fixed one) are contiguous.
 * For each split group, the first occurrence determines position.
 */
const coalesceAllGroups = (
    items: WorkoutItem[],
    idToWE: Map<string, WorkoutExerciseSelect>,
    skipGroupId: string | null | undefined,
): WorkoutItem[] => {
    let result = [...items];
    const processedGroups = new Set<string>();
    if (skipGroupId) processedGroups.add(skipGroupId);

    // Check each item; if its group hasn't been processed and is split, fix it
    for (let i = 0; i < result.length; i++) {
        const we = idToWE.get(result[i].id);
        const gid = we?.groupId;
        if (!gid || processedGroups.has(gid)) continue;
        processedGroups.add(gid);

        // Check if group is contiguous
        const indices: number[] = [];
        for (let j = 0; j < result.length; j++) {
            const jwe = idToWE.get(result[j].id);
            if (jwe?.groupId === gid) indices.push(j);
        }

        if (indices.length <= 1) continue;

        const isContiguous = indices.every((idx, k) => k === 0 || idx === indices[k - 1]! + 1);
        if (isContiguous) continue;

        // Group is split — coalesce around the first occurrence
        result = coalesceGroup(result, gid, result[indices[0]].id, idToWE);
    }

    return result;
};

const WorkoutScreen: FC = () => {
    const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
    const { user } = useUser();

    const { data: workoutExercises, isLoading: isWorkoutExercisesLoading } =
        useWorkoutExercises(workoutId);
    const { data: workoutDetails, isLoading: isWorkoutDetailsLoading } =
        useWorkoutWithDetails(workoutId);
    const { data: groups } = useWorkoutGroups(workoutId);

    const { stats: liveWorkoutStats } = useWorkoutHealthStats(workoutDetails?.workout);

    const isLoading = isWorkoutExercisesLoading || isWorkoutDetailsLoading;

    const deleteWorkoutExercise = useDeleteWorkoutExercise();
    const updateWorkoutExercise = useUpdateWorkoutExercise();
    const updateWorkoutGroup = useUpdateWorkoutGroup();
    const deleteWorkoutGroup = useDeleteWorkoutGroup();
    const { runningWorkoutActiveExercise, runningWorkoutActiveSet, runningWorkoutRestingSet } =
        useRunningWorkoutTicker();

    const { track } = useAnalytics();

    // Edit mode state
    const isEditMode = useSupersetEditStore((state) => state.workoutId === workoutId);
    const clearSupersetEdit = useSupersetEditStore((state) => state.clear);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const { createCircuit, removeCircuit, removeFromGroup } = useManageCircuitGroups({
        workoutId,
    });

    // Reset selection when exiting edit mode
    useEffect(() => {
        if (!isEditMode) {
            setSelectedIds([]);
        }
    }, [isEditMode]);

    const groupTypeMap = useMemo(() => {
        if (!groups) return new Map<string, string>();
        return new Map(groups.map((g) => [g.id, g.type]));
    }, [groups]);

    const items = useMemo<WorkoutItem[]>(() => {
        if (!workoutExercises || !workoutDetails) return [];

        const exerciseMap = new Map(
            workoutDetails.exercises.map((item) => [item.exercise.id, item.exercise]),
        );
        const setsByWorkoutExerciseId = new Map<string, any[]>(
            (workoutDetails?.exercises || []).map((e) => [e.workoutExercise.id, e.sets]),
        );
        const groupOrderMap = new Map((groups || []).map((g) => [g.id, g.order]));
        return workoutExercises
            .map((we) => {
                const ex = exerciseMap.get(we.exerciseId);
                const groupOrder = we.groupId ? (groupOrderMap.get(we.groupId) ?? 0) : 0;
                const compositeOrder = groupOrder * 1000 + (we.orderInGroup ?? 0);
                return {
                    id: we.id,
                    name: ex?.name || we.exerciseId,
                    order: compositeOrder,
                    groupId: we.groupId,
                    groupType: we.groupId ? (groupTypeMap.get(we.groupId) ?? null) : null,
                    tracking: ex?.tracking,
                    sets: (setsByWorkoutExerciseId.get(we.id) || [])
                        .slice()
                        .sort((a, b) => a.order - b.order),
                    exercise: ex,
                };
            })
            .sort((a, b) => a.order - b.order);
    }, [workoutExercises, workoutDetails, groups, groupTypeMap]);

    const [localItems, setLocalItems] = useState<WorkoutItem[]>(items);

    useEffect(() => {
        setLocalItems(items);
    }, [items]);

    const workoutMetrics = useMemo(() => {
        if (!workoutDetails?.workout) {
            return null;
        }

        return buildWorkoutMetricsValues({
            workout: workoutDetails.workout,
            exercises: workoutDetails.exercises,
            userWeightUnits: user?.weightUnits,
        });
    }, [workoutDetails, user?.weightUnits]);

    const handleDelete = useCallback(
        (id: string) => {
            if (!workoutId) return;
            deleteWorkoutExercise.mutate({ id, workoutId });
            track('workout:exercise_remove', {
                workoutId,
            });
        },
        [deleteWorkoutExercise, workoutId, track],
    );

    const handleReorder = useCallback(
        ({ data, key }: { data: WorkoutItem[]; key: string }) => {
            if (!workoutExercises) return;

            const idToWE = new Map(workoutExercises.map((we) => [we.id, we]));

            // Auto-coalesce: keep groups contiguous, anchored around dragged item
            // Also detect if dragged item should be absorbed into a circuit group
            const { result: coalesced, absorption } = coalesceGroups(
                data,
                key,
                idToWE,
                groupTypeMap,
            );
            setLocalItems(coalesced);

            // Handle absorption: update groupId in DB
            if (absorption) {
                updateWorkoutExercise.mutate({
                    id: absorption.itemId,
                    updates: { groupId: absorption.targetGroupId },
                });

                // Check if old group is now empty and should be deleted
                if (absorption.oldGroupId) {
                    const remainingInOldGroup = workoutExercises.filter(
                        (we) => we.groupId === absorption.oldGroupId && we.id !== absorption.itemId,
                    );
                    if (remainingInOldGroup.length === 0) {
                        deleteWorkoutGroup.mutate({
                            id: absorption.oldGroupId,
                            workoutId,
                        });
                    } else if (remainingInOldGroup.length === 1) {
                        // Convert to single if only 1 exercise remains
                        const oldGroup = (groups || []).find((g) => g.id === absorption.oldGroupId);
                        if (oldGroup && oldGroup.type !== 'single') {
                            updateWorkoutGroup.mutate({
                                id: absorption.oldGroupId!,
                                updates: { type: 'single' },
                            });
                        }
                    }
                }
            }

            const groupIdToExistingOrder = new Map((groups || []).map((g) => [g.id, g.order]));

            // Build new per-group item order and new group order (first occurrence wins)
            const groupIdToOrderedIds = new Map<string, string[]>();
            const newGroupOrderList: string[] = [];
            const seenGroup = new Set<string>();

            for (const item of coalesced) {
                const we = idToWE.get(item.id);
                if (!we || !we.groupId) continue;

                if (!seenGroup.has(we.groupId)) {
                    seenGroup.add(we.groupId);
                    newGroupOrderList.push(we.groupId);
                }

                if (!groupIdToOrderedIds.has(we.groupId)) {
                    groupIdToOrderedIds.set(we.groupId, []);
                }
                groupIdToOrderedIds.get(we.groupId)!.push(we.id);
            }

            // 1) Update orderInGroup inside each group
            for (const [, orderedIds] of groupIdToOrderedIds.entries()) {
                for (let index = 0; index < orderedIds.length; index += 1) {
                    const weId = orderedIds[index];
                    const current = idToWE.get(weId);
                    if (!current) continue;
                    if (current.orderInGroup !== index) {
                        updateWorkoutExercise.mutate({
                            id: weId,
                            updates: { orderInGroup: index },
                        });
                    }
                }
            }

            // 2) Update groups order based on first appearance in the new list
            for (let groupOrder = 0; groupOrder < newGroupOrderList.length; groupOrder += 1) {
                const gid = newGroupOrderList[groupOrder];
                const prevOrder = groupIdToExistingOrder.get(gid);
                if (prevOrder !== groupOrder) {
                    updateWorkoutGroup.mutate({ id: gid, updates: { order: groupOrder } });
                }
            }
        },
        [
            groups,
            groupTypeMap,
            updateWorkoutExercise,
            updateWorkoutGroup,
            deleteWorkoutGroup,
            workoutExercises,
            workoutId,
        ],
    );

    const handleDragStart = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, []);

    const handleExercisePress = useCallback(
        (id: string) => {
            router.navigate(`/workout/${workoutId}/${id}`);
        },
        [workoutId],
    );

    const handleToggleSelect = useCallback((id: string) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
    }, []);

    const handleCreateCircuit = useCallback(async () => {
        if (!workoutExercises || !groups) return;
        // Sort selectedIds by display order
        const orderedSelected = items
            .filter((it) => selectedIds.includes(it.id))
            .map((it) => it.id);
        await createCircuit(orderedSelected, workoutExercises, groups);
        setSelectedIds([]);
        clearSupersetEdit();
    }, [selectedIds, workoutExercises, groups, items, createCircuit, clearSupersetEdit]);

    const handleRemoveCircuit = useCallback(async () => {
        if (!workoutExercises || !groups) return;
        // All selected are from the same circuit group
        const firstSelected = items.find((it) => selectedIds.includes(it.id));
        const groupId = firstSelected?.groupId;
        if (!groupId) return;
        await removeCircuit(groupId, workoutExercises, groups);
        setSelectedIds([]);
        clearSupersetEdit();
    }, [selectedIds, items, workoutExercises, groups, removeCircuit, clearSupersetEdit]);

    const handleRemoveFromGroup = useCallback(async () => {
        if (!workoutExercises || !groups) return;
        const firstSelected = items.find((it) => selectedIds.includes(it.id));
        const groupId = firstSelected?.groupId;
        if (!groupId) return;
        await removeFromGroup(selectedIds, groupId, workoutExercises, groups);
        setSelectedIds([]);
        clearSupersetEdit();
    }, [selectedIds, items, workoutExercises, groups, removeFromGroup, clearSupersetEdit]);

    return (
        <Box style={styles.container}>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                <Header />
                {!isLoading && items.length > 0 && <Pushes wrapperStyle={styles.pushes} />}
                {workoutDetails?.workout && (
                    <Stats
                        workout={workoutDetails.workout}
                        exercises={workoutDetails.exercises}
                        healthStats={liveWorkoutStats}
                        workoutStats={workoutMetrics}
                    />
                )}
                {isLoading ? (
                    <LoadingState />
                ) : items.length === 0 ? (
                    <EmptyState workout={workoutDetails?.workout} />
                ) : (
                    <Sortable.Grid
                        columns={1}
                        data={localItems}
                        keyExtractor={(it) => it.id}
                        onDragStart={handleDragStart}
                        onDragEnd={({ data, key }) => handleReorder({ data, key })}
                        rowGap={0}
                        columnGap={0}
                        overDrag="vertical"
                        enableActiveItemSnap={false}
                        itemsLayoutTransitionMode="reorder"
                        itemEntering={null}
                        itemExiting={null}
                        sortEnabled={!isEditMode}
                        renderItem={({ item, index }) => {
                            const nextItem = localItems[index + 1];
                            const showGroupIndicator =
                                !!item.groupId &&
                                item.groupType !== 'single' &&
                                !!nextItem &&
                                nextItem.groupId === item.groupId;
                            return (
                                <Exercise
                                    key={item.id}
                                    item={item}
                                    index={index}
                                    onDelete={handleDelete}
                                    onPress={handleExercisePress}
                                    activeExerciseId={runningWorkoutActiveExercise?.id ?? null}
                                    activeSetId={runningWorkoutActiveSet?.id ?? null}
                                    restingSetId={runningWorkoutRestingSet?.id ?? null}
                                    isEditMode={isEditMode}
                                    isSelected={selectedIds.includes(item.id)}
                                    onToggleSelect={handleToggleSelect}
                                    showGroupIndicator={showGroupIndicator}
                                />
                            );
                        }}
                    />
                )}
            </ScrollView>
            {isEditMode ? (
                <EditModeActions
                    selectedIds={selectedIds}
                    items={items}
                    onCreateCircuit={handleCreateCircuit}
                    onRemoveCircuit={handleRemoveCircuit}
                    onRemoveFromGroup={handleRemoveFromGroup}
                />
            ) : (
                <Actions workout={workoutDetails?.workout} />
            )}
        </Box>
    );
};

export default WorkoutScreen;
