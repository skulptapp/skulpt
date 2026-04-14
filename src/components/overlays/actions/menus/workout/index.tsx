import { FC, useCallback } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';

import { useActionsStore } from '@/stores/actions';
import { useSupersetEditStore } from '@/stores/superset-edit';
import { VStack } from '@/components/primitives/vstack';
import { useEditor } from '@/hooks/use-editor';
import { useDeleteWorkout } from '@/hooks/use-workouts';

import { MenuItem } from '../../components/menu-item';

const WorkoutMenu: FC = () => {
    const { t } = useTranslation(['common', 'screens']);
    const router = useRouter();

    const { navigate } = useEditor();

    const deleteWorkout = useDeleteWorkout();
    const startSupersetEdit = useSupersetEditStore((state) => state.start);

    const { close, payload } = useActionsStore(
        useShallow((state) => ({
            close: state.close,
            payload: state.payload,
        })),
    );

    const handleDelete = useCallback(() => {
        if (!payload || !('workoutId' in payload)) return;

        close();

        Alert.alert(t('workout.deleteWorkoutAlert', { ns: 'screens' }), undefined, [
            {
                text: t('cancel', { ns: 'common' }),
                style: 'cancel',
            },
            {
                text: t('delete', { ns: 'common' }),
                style: 'destructive',
                onPress: () => {
                    deleteWorkout.mutate(payload.workoutId);
                    router.back();
                },
            },
        ]);
    }, [close, payload, deleteWorkout, router, t]);

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
                        onPress={handleDelete}
                    />
                </>
            )}
        </VStack>
    );
};

export { WorkoutMenu };
