import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';

import { useActionsStore } from '@/stores/actions';
import { useDuplicateWorkout } from '@/hooks/use-workouts';
import { useRunningWorkoutStatic } from '@/hooks/use-running-workout';

import { MenuItem } from '../../components/menu-item';

type WorkoutDuplicateItemsProps = {
    labels?: 'repeat' | 'copy';
    last?: boolean;
};

const WorkoutDuplicateItems: FC<WorkoutDuplicateItemsProps> = ({ labels = 'repeat', last }) => {
    const { t } = useTranslation(['screens']);
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
        <>
            {!runningWorkout && (
                <MenuItem
                    title={t(`workout.${labels}.now`, { ns: 'screens' })}
                    onPress={() => handleDuplicate('now')}
                />
            )}
            <MenuItem
                title={t(`workout.${labels}.plan`, { ns: 'screens' })}
                onPress={() => handleDuplicate('planned')}
            />
            <MenuItem
                title={t(`workout.${labels}.completed`, { ns: 'screens' })}
                last={last}
                onPress={() => handleDuplicate('completed')}
            />
        </>
    );
};

export { WorkoutDuplicateItems };
