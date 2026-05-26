import { router, useGlobalSearchParams } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';
import { useShallow } from 'zustand/react/shallow';

import { ActionsButton } from '@/components/buttons/actions';
import { BackButton } from '@/components/buttons/back';
import { useScreen } from '@/hooks/use-screen';
import { useActionsStore } from '@/stores/actions';

const useWorkoutExerciseScreen = () => {
    const { options } = useScreen();
    const { theme } = useUnistyles();
    const { workoutId, workoutExerciseId } = useGlobalSearchParams<{
        workoutId: string;
        workoutExerciseId: string;
    }>();
    const { actionsOpen } = useActionsStore(
        useShallow((state) => ({
            actionsOpen: state.open,
        })),
    );

    const handleBack = () => {
        router.back();
    };

    const handleActions = () => {
        if (!workoutId || !workoutExerciseId) return;

        actionsOpen({
            type: 'workout_exercise__menu',
            payload: { workoutId, workoutExerciseId },
        });
    };

    return {
        name: '[workoutId]/[workoutExerciseId]',
        options: {
            ...options,
            headerShown: true,
            headerTitle: () => null,
            headerTransparent: true,
            headerStyle: {
                ...options.headerStyle,
                backgroundColor: 'transparent',
            },
            headerLeft: () => (
                <BackButton
                    onPressHandler={handleBack}
                    backgroundColor={theme.colors.lime[500]}
                    iconColor={theme.colors.neutral[950]}
                />
            ),
            headerRight: () => (
                <ActionsButton
                    onPressHandler={handleActions}
                    backgroundColor={theme.colors.lime[500]}
                    iconColor={theme.colors.neutral[950]}
                />
            ),
            cardStyle: {
                ...options.cardStyle,
                backgroundColor: theme.colors.lime[400],
            },
        },
    };
};

export { useWorkoutExerciseScreen };
