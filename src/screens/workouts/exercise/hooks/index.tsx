import { router, useLocalSearchParams } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';
import { useShallow } from 'zustand/react/shallow';

import { ActionsButton } from '@/components/buttons/actions';
import { CollapseButton } from '@/components/buttons/collapse';
import { useScreen } from '@/hooks/use-screen';
import { useActionsStore } from '@/stores/actions';

const useWorkoutExerciseScreen = () => {
    const { options } = useScreen();
    const { theme } = useUnistyles();
    const { workoutId, workoutExerciseId } = useLocalSearchParams<{
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
            presentation: 'card' as const,
            animationTypeForReplace: 'pop' as const,
            cardOverlayEnabled: false,
            headerMode: 'screen' as const,
            animation: 'slide_from_bottom' as const,
            headerShown: true,
            headerTitle: () => null,
            headerTransparent: true,
            headerStyle: {
                ...options.headerStyle,
                backgroundColor: 'transparent',
            },
            headerLeft: () => <CollapseButton onPressHandler={handleBack} />,
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
