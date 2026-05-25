import { FC, useCallback } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';
import { useIsMutating } from '@tanstack/react-query';

import { useActionsStore } from '@/stores/actions';
import { useSupersetEditStore } from '@/stores/superset-edit';
import { VStack } from '@/components/primitives/vstack';
import { useEditor } from '@/hooks/use-editor';
import { deleteWorkoutMutationKey, useDeleteWorkout } from '@/hooks/use-workouts';

import { MenuItem } from '../../components/menu-item';

const WorkoutMenu: FC = () => {
    const { t } = useTranslation(['common', 'screens']);
    const router = useRouter();

    const { navigate } = useEditor();

    const deleteWorkout = useDeleteWorkout();
    const deleteWorkoutMutations = useIsMutating({ mutationKey: deleteWorkoutMutationKey });
    const startSupersetEdit = useSupersetEditStore((state) => state.start);
    const isDeletingWorkout = deleteWorkout.isPending || deleteWorkoutMutations > 0;

    const { close, payload } = useActionsStore(
        useShallow((state) => ({
            close: state.close,
            payload: state.payload,
        })),
    );

    const handleDelete = useCallback(() => {
        if (!payload || !('workoutId' in payload) || isDeletingWorkout) return;

        const workoutId = payload.workoutId;
        close();

        Alert.alert(t('workout.deleteWorkoutAlert', { ns: 'screens' }), undefined, [
            {
                text: t('cancel', { ns: 'common' }),
                style: 'cancel',
            },
            {
                text: t('delete', { ns: 'common' }),
                style: 'destructive',
                onPress: async () => {
                    if (isDeletingWorkout) return;

                    try {
                        await deleteWorkout.mutateAsync(workoutId);
                        router.replace('/');
                    } catch {
                        // deleteWorkout reports the underlying error.
                    }
                },
            },
        ]);
    }, [close, payload, isDeletingWorkout, deleteWorkout, router, t]);

    return (
        <VStack>
            {payload && 'workoutId' in payload && (
                <>
                    <MenuItem
                        title={t('edit', { ns: 'common' })}
                        onPress={() => {
                            close();
                            navigate({
                                type: 'workout__edit',
                                payload: { workoutId: payload.workoutId },
                            });
                        }}
                    />
                    <MenuItem
                        title={t('workout.supersets.edit', { ns: 'screens' })}
                        onPress={() => {
                            close();
                            startSupersetEdit(payload.workoutId);
                        }}
                    />
                    <MenuItem
                        title={t('delete', { ns: 'common' })}
                        variant="destructive"
                        last={true}
                        disabled={isDeletingWorkout}
                        onPress={handleDelete}
                    />
                </>
            )}
        </VStack>
    );
};

export { WorkoutMenu };
