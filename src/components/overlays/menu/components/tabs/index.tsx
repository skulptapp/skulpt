import React, { useCallback, useMemo, type FC } from 'react';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { RelativePathString, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { LucideIcon, House, Settings2, CircleGauge, ChartNoAxesColumn } from 'lucide-react-native';

import { Pressable } from '@/components/primitives/pressable';
import { VStack } from '@/components/primitives/vstack';
import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { HStack } from '@/components/primitives/hstack';
import { runInBackground } from '@/services/error-reporting';

type TabsType = Omit<BottomTabBarProps, 'descriptors' | 'insets' | 'navigation'>;

interface ItemType {
    isFocused: boolean;
    children: string;
    onPress: () => void;
    Icon: LucideIcon;
}

const styles = StyleSheet.create((theme, rt) => ({
    tabsContainer: {
        justifyContent: 'space-around',
        height: theme.space(16),
        paddingTop: theme.space(3),
        paddingHorizontal: theme.space(1),
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        backgroundColor:
            rt.themeName === 'dark' ? theme.colors.neutral[925] : theme.colors.background,
    },
    itemContainer: {
        flex: 1,
    },
    itemWrapper: {
        alignItems: 'center',
        gap: theme.space(0.25),
    },
    itemIconWrapper: {
        marginBottom: theme.space(1.5),
        height: theme.space(5),
        width: theme.space(5),
    },
    itemText: (isFocused: boolean) => ({
        color: theme.colors.typography,
        opacity: isFocused ? 1 : 0.6,
    }),
}));

const Item: FC<ItemType> = ({ isFocused, onPress, children, Icon }) => {
    const { theme } = useUnistyles();
    const { t } = useTranslation(['menu']);

    return (
        <Box style={styles.itemContainer}>
            <Pressable
                onPressIn={() => {
                    runInBackground(
                        () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
                        'Failed to trigger tab haptic feedback:',
                    );
                    onPress();
                }}
            >
                <VStack style={styles.itemWrapper}>
                    <Box style={styles.itemIconWrapper}>
                        <Icon
                            size={theme.space(5)}
                            color={theme.colors.typography}
                            opacity={isFocused ? 1 : 0.7}
                        />
                    </Box>
                    <Box>
                        <Text
                            fontSize="xs"
                            fontWeight={isFocused ? 'semibold' : 'medium'}
                            style={styles.itemText(isFocused)}
                        >
                            {t(children, { ns: 'menu' })}
                        </Text>
                    </Box>
                </VStack>
            </Pressable>
        </Box>
    );
};

const Tabs: FC<TabsType> = ({ state }) => {
    const menu = useMemo(() => {
        const items = [
            {
                screen: 'index',
                title: 'home.title',
                icon: House,
            },
            {
                screen: 'results',
                title: 'results.title',
                icon: ChartNoAxesColumn,
            },
            {
                screen: 'exercises',
                title: 'exercises.title',
                icon: CircleGauge,
            },
            {
                screen: 'settings',
                title: 'settings.title',
                icon: Settings2,
            },
        ];

        return items;
    }, []);

    const isFocused = useCallback(
        (name: string) => {
            if (name === 'menu') {
                return !menu.map((i) => i.screen).includes(state.routes[state.index].name);
            }
            return name === state.routes[state.index].name;
        },
        [state, menu],
    );

    return (
        <HStack style={styles.tabsContainer}>
            {menu.map((item, index) => (
                <Item
                    key={index}
                    onPress={() => {
                        if (item.screen === 'index') {
                            router.navigate(`/`);
                        } else {
                            router.navigate(`/${item.screen}` as RelativePathString);
                        }
                    }}
                    isFocused={isFocused(item.screen)}
                    Icon={item.icon}
                >
                    {item.title}
                </Item>
            ))}
        </HStack>
    );
};

export default Tabs;
