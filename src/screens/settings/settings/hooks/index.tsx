import { BackButton } from '@/components/buttons/back';
import { useScreen } from '@/hooks/use-screen';
import { router } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

const useSettingsTab = () => {
    const { options } = useScreen();
    const { theme } = useUnistyles();

    return {
        name: 'settings',
        options: {
            ...options,
            headerTransparent: true,
            headerStyle: {
                ...options.headerStyle,
                backgroundColor: 'transparent',
            },
            sceneStyle: {
                ...options.sceneStyle,
                backgroundColor: theme.colors.foreground,
            },
        },
    };
};

const useSettingScreen = () => {
    const { options } = useScreen();
    const { theme } = useUnistyles();

    const handleBack = () => {
        router.back();
    };

    return {
        options: {
            ...options,
            headerTransparent: true,
            headerStyle: {
                ...options.headerStyle,
                backgroundColor: 'transparent',
            },
            cardStyle: {
                ...options.sceneStyle,
                backgroundColor: theme.colors.foreground,
            },
            headerLeft: () => (
                <BackButton
                    onPressHandler={handleBack}
                    backgroundColor={theme.colors.foreground}
                    iconColor={theme.colors.typography}
                />
            ),
        },
    };
};

export { useSettingsTab, useSettingScreen };
