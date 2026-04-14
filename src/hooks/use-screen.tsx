import { useState } from 'react';
import { Platform } from 'react-native';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { ChevronLeft } from 'lucide-react-native';

const styles = StyleSheet.create((theme, rt) => ({
    icon: Platform.select({
        ios: {
            marginLeft: -8,
        },
        default: {
            marginLeft: -20,
        },
    }),
}));

const useScreen = () => {
    const [scrollPosition, setScrollPosition] = useState(0);
    const { theme } = useUnistyles();

    const options = {
        headerBackButtonDisplayMode: 'minimal' as const,
        headerShadowVisible: scrollPosition > 10,
        headerTitleAlign: 'center' as const,
        headerLeftContainerStyle: {
            marginStart: 16,
        },
        headerRightContainerStyle: {
            marginEnd: 16,
        },
        headerStyle: {
            height: theme.screenHeaderHeight(),
            backgroundColor: theme.colors.background,
        },
        headerTitleStyle: {
            fontWeight: 'bold' as const,
            fontSize: 18,
            color: theme.colors.typography,
        },
        headerBackImage: () => (
            <ChevronLeft size={30} color={theme.colors.typography} style={styles.icon} />
        ),
        cardStyle: {
            backgroundColor: theme.colors.background,
        },
        sceneStyle: {
            backgroundColor: theme.colors.background,
        },
    };

    return { options, scrollPosition, setScrollPosition };
};

export { useScreen };
