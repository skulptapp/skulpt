import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRouter } from 'expo-router';

import { useActionsStore } from '@/stores/actions';
import { VStack } from '@/components/primitives/vstack';
import { useDuplicateWorkout } from '@/hooks/use-workouts';
import { useRunningWorkoutStatic } from '@/hooks/use-running-workout';

import { MenuItem } from '../../components/menu-item';

const WorkoutRepeat: FC = () => {
    const { t } = useTranslation(['common', 'screens']);
    const router = useRouter();

    const { runningWorkout } = useRunningWorkoutStatic();

    const { close, payload } = useActionsStore(
        useShallow((state) => ({
            close: state.close,
            payload: state.payload,
        })),
    );

    const duplicateWorkout = useDuplicateWorkout();

    const handleDuplicate = async (mode: 'now' | 'planned' | 'completed') => {
        if (!payload || !('workoutId' in payload)) return;

        const newWorkout = await duplicateWorkout.mutateAsync({
            workoutId: payload.workoutId,
            mode,
        });
        close();
        router.setParams({ workoutId: newWorkout.id });
    };

    return (
        <VStack>
            {!runningWorkout && (
                <MenuItem
                    title={t('workout.repeat.now', { ns: 'screens' })}
                    onPress={() => handleDuplicate('now')}
                />
            )}
            <MenuItem
                title={t('workout.repeat.plan', { ns: 'screens' })}
                onPress={() => handleDuplicate('planned')}
            />
            <MenuItem
                title={t('workout.repeat.completed', { ns: 'screens' })}
                last={true}
                onPress={() => handleDuplicate('completed')}
            />
        </VStack>
    );
};

export { WorkoutRepeat };
