import { FC, useState } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { LayoutChangeEvent } from 'react-native';

import { Pressable } from '@/components/primitives/pressable';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';

interface TabsProps {
    tabs: string[];
    activeIndex: number;
    onTabChange: (index: number) => void;
}

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flexDirection: 'row',
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius.full,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
        padding: theme.space(0.75),
        position: 'relative',
        height: theme.space(12),
        marginHorizontal: theme.space(4),
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    thumb: {
        position: 'absolute',
        top: theme.space(0.75),
        bottom: theme.space(0.75),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius.full,
        zIndex: 1,
    },
    label: (isActive: boolean) => ({
        color: theme.colors.typography,
        fontWeight: theme.fontWeight.semibold.fontWeight,
    }),
}));

export const Tabs: FC<TabsProps> = ({ tabs, activeIndex, onTabChange }) => {
    const { theme } = useUnistyles();
    const padding = theme.space(0.75);
    const duration = 200;

    const selected = useSharedValue(activeIndex);
    const [tabWidths, setTabWidths] = useState<number[]>(new Array(tabs.length).fill(0));
    const [tabPositions, setTabPositions] = useState<number[]>(new Array(tabs.length).fill(0));
    const [isInitialized, setIsInitialized] = useState(false);

    const thumbAnimatedStyle = useAnimatedStyle(() => {
        if (!isInitialized || tabWidths.length === 0) return { opacity: 0 };

        const currentWidth = tabWidths[selected.value] || 0;
        const currentPosition = tabPositions[selected.value] || 0;

        return {
            opacity: 1,
            transform: [{ translateX: withTiming(currentPosition, { duration }) }],
            width: withTiming(currentWidth, { duration }),
        };
    });

    const handlePress = (index: number) => {
        selected.value = index;
        onTabChange(index);
    };

    const handleTabLayout = (event: LayoutChangeEvent, index: number) => {
        const { width } = event.nativeEvent.layout;

        setTabWidths((prev) => {
            const newWidths = [...prev];
            newWidths[index] = width;

            if (newWidths.every((w) => w > 0)) {
                const positions: number[] = [];
                let currentPosition = padding;
                newWidths.forEach((w) => {
                    positions.push(currentPosition);
                    currentPosition += w;
                });
                setTabPositions(positions);
                setIsInitialized(true);
            }

            return newWidths;
        });
    };

    return (
        <HStack style={styles.container}>
            {isInitialized && <Animated.View style={[styles.thumb, thumbAnimatedStyle]} />}
            {tabs.map((tab, index) => (
                <Pressable
                    key={index}
                    onPress={() => handlePress(index)}
                    style={styles.tab}
                    onLayout={(event) => handleTabLayout(event, index)}
                >
                    <Text fontSize="sm" style={styles.label(activeIndex === index)}>
                        {tab}
                    </Text>
                </Pressable>
            ))}
        </HStack>
    );
};
