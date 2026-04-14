import { useCallback } from 'react';
import {
    useCreateWorkoutGroup,
    useUpdateWorkoutExercise,
    useDeleteWorkoutGroup,
    useUpdateWorkoutGroup,
} from '@/hooks/use-workouts';
import { WorkoutExerciseSelect, WorkoutGroupSelect } from '@/db/schema/workout';

type ManageCircuitGroupsParams = {
    workoutId: string;
};

export const useManageCircuitGroups = ({ workoutId }: ManageCircuitGroupsParams) => {
    const createWorkoutGroup = useCreateWorkoutGroup();
    const updateWorkoutExercise = useUpdateWorkoutExercise();
    const deleteWorkoutGroup = useDeleteWorkoutGroup();
    const updateWorkoutGroup = useUpdateWorkoutGroup();

    /**
     * Renormalize group.order for all groups to be sequential (0, 1, 2, ...)
     * based on their current ordering.
     */
    const renormalizeGroupOrders = useCallback(
        async (groups: WorkoutGroupSelect[]) => {
            const sorted = [...groups].sort((a, b) => a.order - b.order);
            for (let i = 0; i < sorted.length; i++) {
                if (sorted[i].order !== i) {
                    await updateWorkoutGroup.mutateAsync({
                        id: sorted[i].id,
                        updates: { order: i },
                    });
                }
            }
        },
        [updateWorkoutGroup],
    );

    /**
     * Handle orphaned groups after exercises have been moved out.
     * - If a group has 0 exercises left, delete it.
     * - If a group has 1 exercise left (was circuit), convert to single.
     */
    const handleOrphanedGroups = useCallback(
        async (
            affectedGroupIds: Set<string>,
            workoutExercises: WorkoutExerciseSelect[],
            groups: WorkoutGroupSelect[],
        ) => {
            const remainingGroups = [...groups];

            for (const groupId of affectedGroupIds) {
                const remaining = workoutExercises.filter((we) => we.groupId === groupId);

                if (remaining.length === 0) {
                    await deleteWorkoutGroup.mutateAsync({ id: groupId, workoutId });
                    const idx = remainingGroups.findIndex((g) => g.id === groupId);
                    if (idx !== -1) remainingGroups.splice(idx, 1);
                } else if (remaining.length === 1) {
                    const group = groups.find((g) => g.id === groupId);
                    if (group && group.type !== 'single') {
                        await updateWorkoutGroup.mutateAsync({
                            id: groupId,
                            updates: { type: 'single' },
                        });
                    }
                }
            }

            return remainingGroups;
        },
        [deleteWorkoutGroup, updateWorkoutGroup, workoutId],
    );

    /**
     * Create a circuit group from selected exercise IDs.
     * selectedIds must contain ≥ 2 items, in display order.
     */
    const createCircuit = useCallback(
        async (
            selectedIds: string[],
            workoutExercises: WorkoutExerciseSelect[],
            groups: WorkoutGroupSelect[],
        ) => {
            if (selectedIds.length < 2) return;

            // Determine new group order = min order of selected exercises' current groups
            const selectedWEs = selectedIds
                .map((id) => workoutExercises.find((we) => we.id === id))
                .filter(Boolean) as WorkoutExerciseSelect[];

            const selectedGroupIds = new Set(
                selectedWEs.map((we) => we.groupId).filter(Boolean) as string[],
            );

            const minOrder = Math.min(
                ...Array.from(selectedGroupIds).map(
                    (gid) => groups.find((g) => g.id === gid)?.order ?? Infinity,
                ),
            );
            const newOrder = Number.isFinite(minOrder) ? minOrder : groups.length;

            // Create new circuit group
            const newGroup = await createWorkoutGroup.mutateAsync({
                workoutId,
                type: 'circuit',
                order: newOrder,
                notes: null,
            });

            // Move each selected exercise to the new group (in display order)
            for (let i = 0; i < selectedIds.length; i++) {
                await updateWorkoutExercise.mutateAsync({
                    id: selectedIds[i],
                    updates: { groupId: newGroup.id, orderInGroup: i },
                });
            }

            // Update the in-memory workoutExercises to reflect moves
            const updatedWEs = workoutExercises.map((we) => {
                if (selectedIds.includes(we.id)) {
                    return { ...we, groupId: newGroup.id };
                }
                return we;
            });

            // Handle orphaned old groups
            const remainingGroups = await handleOrphanedGroups(selectedGroupIds, updatedWEs, [
                ...groups,
                newGroup,
            ]);

            // Renormalize
            await renormalizeGroupOrders(remainingGroups);
        },
        [
            workoutId,
            createWorkoutGroup,
            updateWorkoutExercise,
            handleOrphanedGroups,
            renormalizeGroupOrders,
        ],
    );

    /**
     * Remove an entire circuit group — each exercise becomes its own single group.
     */
    const removeCircuit = useCallback(
        async (
            groupId: string,
            workoutExercises: WorkoutExerciseSelect[],
            groups: WorkoutGroupSelect[],
        ) => {
            const groupExercises = workoutExercises
                .filter((we) => we.groupId === groupId)
                .sort((a, b) => (a.orderInGroup ?? 0) - (b.orderInGroup ?? 0));

            if (groupExercises.length === 0) return;

            const circuitGroup = groups.find((g) => g.id === groupId);
            const baseOrder = circuitGroup?.order ?? groups.length;

            // Create a new single group for each exercise
            for (let i = 0; i < groupExercises.length; i++) {
                const singleGroup = await createWorkoutGroup.mutateAsync({
                    workoutId,
                    type: 'single',
                    order: baseOrder + i,
                    notes: null,
                });

                await updateWorkoutExercise.mutateAsync({
                    id: groupExercises[i].id,
                    updates: { groupId: singleGroup.id, orderInGroup: 0 },
                });
            }

            // Delete the now-empty circuit group
            await deleteWorkoutGroup.mutateAsync({ id: groupId, workoutId });

            // Renormalize
            const updatedGroups = groups.filter((g) => g.id !== groupId);
            // We don't have the new single groups in our list, but renormalize will
            // be called with stale data. Query invalidation will handle the rest.
            await renormalizeGroupOrders(updatedGroups);
        },
        [
            workoutId,
            createWorkoutGroup,
            updateWorkoutExercise,
            deleteWorkoutGroup,
            renormalizeGroupOrders,
        ],
    );

    /**
     * Remove specific exercises from a group. Each removed exercise gets its own single group.
     */
    const removeFromGroup = useCallback(
        async (
            selectedIds: string[],
            groupId: string,
            workoutExercises: WorkoutExerciseSelect[],
            groups: WorkoutGroupSelect[],
        ) => {
            if (selectedIds.length === 0) return;

            const circuitGroup = groups.find((g) => g.id === groupId);
            const baseOrder = circuitGroup?.order ?? groups.length;

            // Create single groups for each removed exercise
            for (let i = 0; i < selectedIds.length; i++) {
                const singleGroup = await createWorkoutGroup.mutateAsync({
                    workoutId,
                    type: 'single',
                    order: baseOrder + 1 + i,
                    notes: null,
                });

                await updateWorkoutExercise.mutateAsync({
                    id: selectedIds[i],
                    updates: { groupId: singleGroup.id, orderInGroup: 0 },
                });
            }

            // Recalculate orderInGroup for remaining exercises in the group
            const updatedWEs = workoutExercises.map((we) => {
                if (selectedIds.includes(we.id)) {
                    return { ...we, groupId: '__removed__' };
                }
                return we;
            });

            const remaining = updatedWEs
                .filter((we) => we.groupId === groupId)
                .sort((a, b) => (a.orderInGroup ?? 0) - (b.orderInGroup ?? 0));

            for (let i = 0; i < remaining.length; i++) {
                if (remaining[i].orderInGroup !== i) {
                    await updateWorkoutExercise.mutateAsync({
                        id: remaining[i].id,
                        updates: { orderInGroup: i },
                    });
                }
            }

            // If only 1 exercise remains, convert group to single
            if (remaining.length === 1) {
                await updateWorkoutGroup.mutateAsync({
                    id: groupId,
                    updates: { type: 'single' },
                });
            }

            // Renormalize all groups
            await renormalizeGroupOrders(groups);
        },
        [
            workoutId,
            createWorkoutGroup,
            updateWorkoutExercise,
            updateWorkoutGroup,
            renormalizeGroupOrders,
        ],
    );

    return { createCircuit, removeCircuit, removeFromGroup };
};
