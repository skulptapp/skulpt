import { useRouter, useGlobalSearchParams } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';
import { useShallow } from 'zustand/react/shallow';

import { BackButton } from '@/components/buttons/back';
import { ActionsButton } from '@/components/buttons/actions';
import { useActionsStore } from '@/stores/actions';
import { useScreen } from '@/hooks/use-screen';

const useExerciseScreen = () => {
    const { options } = useScreen();
    const { theme } = useUnistyles();
    const router = useRouter();

    const { exerciseId } = useGlobalSearchParams<{ exerciseId: string }>();

    const { actionsOpen } = useActionsStore(
        useShallow((state) => ({
            actionsOpen: state.open,
        })),
    );

    const handleBack = () => {
        router.back();
    };

    const handleActions = () => {
        actionsOpen({ type: 'exercise__menu', payload: { exerciseId } });
    };

    return {
        name: '[exerciseId]',
        options: {
            ...options,
            headerShown: true,
            headerTitle: () => null,
            headerTransparent: true,
            headerStyle: {
                ...options.headerStyle,
                backgroundColor: 'transparent',
            },
            headerLeft: () => <BackButton onPressHandler={handleBack} />,
            headerRight: () => <ActionsButton onPressHandler={handleActions} />,
            cardStyle: {
                ...options.cardStyle,
                backgroundColor: theme.colors.background,
            },
        },
    };
};

export { useExerciseScreen };
