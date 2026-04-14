import { router } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

import { CollapseButton } from '@/components/buttons/collapse';
import { useScreen } from '@/hooks/use-screen';

const useWorkoutExerciseScreen = () => {
    const { options } = useScreen();
    const { theme } = useUnistyles();

    const handleBack = () => {
        router.back();
    };

    return {
        name: '[workoutId]/[workoutExerciseId]',
        options: {
            ...options,
            presentation: 'modal' as const,
            animationTypeForReplace: 'pop' as const,
            cardOverlayEnabled: false,
            animation: 'slide_from_bottom' as const,
            headerShown: true,
            headerTitle: () => null,
            headerTransparent: true,
            headerStyle: {
                ...options.headerStyle,
                backgroundColor: 'transparent',
            },
            headerLeft: () => <CollapseButton onPressHandler={handleBack} />,
            cardStyle: {
                ...options.cardStyle,
                backgroundColor: theme.colors.lime[400],
            },
        },
    };
};

export { useWorkoutExerciseScreen };
