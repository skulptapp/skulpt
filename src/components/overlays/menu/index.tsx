import { Platform } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { StyleSheet } from 'react-native-unistyles';

import { Tabs } from './components';
import { Box } from '@/components/primitives/box';

const styles = StyleSheet.create((theme, rt) => ({
    menuContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor:
            rt.themeName === 'dark' ? theme.colors.neutral[925] : theme.colors.background,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingBottom: rt.insets.bottom,
        ...Platform.select({
            ios: {
                shadowOffset: {
                    width: 0,
                    height: 0,
                },
                shadowOpacity: 0.25,
                shadowRadius: 5,
                shadowColor: rt.themeName === 'dark' ? '#0a0a0a' : '#525252',
            },
            default: {
                boxShadow:
                    rt.themeName === 'dark'
                        ? '0 -2px 10px 0 rgba(10, 10, 10, 0.25)'
                        : '0 -2px 10px 0 rgba(82, 82, 82, 0.25)',
            },
        }),
    },
}));

const Menu = ({ state }: BottomTabBarProps) => {
    return (
        <Box style={styles.menuContainer}>
            <Tabs state={state} />
        </Box>
    );
};

export { Menu };
