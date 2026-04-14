import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';
import { useShallow } from 'zustand/react/shallow';

import { BackButton } from '@/components/buttons/back';
import { CloseButton } from '@/components/buttons/close';
import { ActionsButton } from '@/components/buttons/actions';
import { useActionsStore } from '@/stores/actions';
import { useSupersetEditStore } from '@/stores/superset-edit';
import { useScreen } from '@/hooks/use-screen';

const useWorkoutScreen = () => {
    const { options } = useScreen();
    const { theme } = useUnistyles();
    const router = useRouter();

    const { workoutId } = useGlobalSearchParams<{ workoutId: string }>();

    const { actionsOpen } = useActionsStore(
        useShallow((state) => ({
            actionsOpen: state.open,
        })),
    );

    const isEditMode = useSupersetEditStore((state) => state.workoutId === workoutId);
    const clearSupersetEdit = useSupersetEditStore((state) => state.clear);

    const handleBack = () => {
        router.back();
    };

    const handleActions = () => {
        actionsOpen({ type: 'workout__menu', payload: { workoutId } });
    };

    const handleCancelEdit = () => {
        clearSupersetEdit();
    };

    return {
        name: '[workoutId]',
        options: {
            ...options,
            headerShown: true,
            headerTitle: () => null,
            headerTransparent: true,
            headerStyle: {
                ...options.headerStyle,
                backgroundColor: 'transparent',
            },
            headerLeft: () =>
                isEditMode ? (
                    <CloseButton
                        onPressHandler={handleCancelEdit}
                        backgroundColor={theme.colors.lime[500]}
                        iconColor={theme.colors.neutral[950]}
                    />
                ) : (
                    <BackButton
                        onPressHandler={handleBack}
                        backgroundColor={theme.colors.lime[500]}
                        iconColor={theme.colors.neutral[950]}
                    />
                ),
            headerRight: () =>
                isEditMode ? null : (
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

export { useWorkoutScreen };
