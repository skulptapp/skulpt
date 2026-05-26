import { FC, useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { VStack } from '@/components/primitives/vstack';
import { useActionsStore } from '@/stores/actions';
import {
    useCreateExerciseSet,
    useDeleteWorkoutExercise,
    useWorkoutWithDetails,
} from '@/hooks/use-workouts';
import { useAnalytics } from '@/hooks/use-analytics';
import { addWorkoutExerciseSet, type SetType } from '@/screens/workouts/exercise/helpers/add-set';

import { MenuItem } from '../../components/menu-item';

const SET_TYPES: SetType[] = ['working', 'failure', 'dropset', 'warmup'];

const WorkoutExerciseMenu: FC = () => {
    const { t } = useTranslation(['common', 'screens']);
    const router = useRouter();
    const { track } = useAnalytics();

    const { close, payload } = useActionsStore(
        useShallow((state) => ({
            close: state.close,
            payload: state.payload,
        })),
    );

    const workoutId =
        payload && 'workoutId' in payload && typeof payload.workoutId === 'string'
            ? payload.workoutId
            : '';
    const workoutExerciseId =
        payload && 'workoutExerciseId' in payload && typeof payload.workoutExerciseId === 'string'
            ? payload.workoutExerciseId
            : '';

    const { data: workoutDetails } = useWorkoutWithDetails(workoutId);
    const createExerciseSet = useCreateExerciseSet();
    const deleteWorkoutExercise = useDeleteWorkoutExercise();

    const handleAddSet = useCallback(
        async (setType: SetType) => {
            if (!workoutExerciseId || createExerciseSet.isPending) return;

            await addWorkoutExerciseSet({
                workoutDetails,
                workoutExerciseId,
                setType,
                createSet: createExerciseSet.mutateAsync,
            });
            close();
        },
        [
            close,
            createExerciseSet.isPending,
            createExerciseSet.mutateAsync,
            workoutDetails,
            workoutExerciseId,
        ],
    );

    const handleDelete = useCallback(() => {
        if (!workoutId || !workoutExerciseId || deleteWorkoutExercise.isPending) return;

        close();
        Alert.alert(t('workoutExercise.deleteAlert', { ns: 'screens' }), undefined, [
            {
                text: t('cancel', { ns: 'common' }),
                style: 'cancel',
            },
            {
                text: t('delete', { ns: 'common' }),
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteWorkoutExercise.mutateAsync({
                            id: workoutExerciseId,
                            workoutId,
                        });
                        track('workout:exercise_remove', { workoutId });
                        router.back();
                    } catch {
                        // deleteWorkoutExercise reports the underlying error.
                    }
                },
            },
        ]);
    }, [close, deleteWorkoutExercise, router, t, track, workoutExerciseId, workoutId]);

    if (!workoutId || !workoutExerciseId) return null;

    return (
        <VStack>
            {SET_TYPES.map((setType) => (
                <MenuItem
                    key={setType}
                    title={t(`workoutExercise.addSet.${setType}.title`, { ns: 'screens' })}
                    description={t(`workoutExercise.addSet.${setType}.description`, {
                        ns: 'screens',
                    })}
                    disabled={!workoutDetails || createExerciseSet.isPending}
                    onPress={() => handleAddSet(setType)}
                />
            ))}
            <MenuItem
                title={t('workoutExercise.delete', { ns: 'screens' })}
                variant="destructive"
                last={true}
                disabled={deleteWorkoutExercise.isPending}
                onPress={handleDelete}
            />
        </VStack>
    );
};

export { WorkoutExerciseMenu };
