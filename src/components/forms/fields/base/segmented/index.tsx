import { useEffect, useState } from 'react';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    runOnJS,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
    FieldError,
    FieldPath,
    FieldValues,
    Merge,
    PathValue,
    useController,
} from 'react-hook-form';
import { LayoutChangeEvent } from 'react-native';

import { Pressable } from '@/components/primitives/pressable';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Box, BoxProps } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';

import { ControlledInputType } from '../../types';
import { Error } from '../../components';
import { useTranslation } from 'react-i18next';

interface SegmentedType<
    T extends FieldValues = FieldValues,
    TName extends FieldPath<T> = FieldPath<T>,
> extends ControlledInputType<T, TName> {
    segments: {
        value: string;
        title: string;
        description?: string;
    }[];
    title: string;
    description?: string;
    selectedIndex?: number;
    error?: Merge<FieldError, (FieldError | undefined)[]> | undefined;
    containerStyle?: BoxProps['style'];
}

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        paddingVertical: theme.space(3),
        paddingHorizontal: theme.space(5),
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    segmentedContainer: (error: boolean) => ({
        flexDirection: 'row',
        backgroundColor: error ? theme.colors.red[100] : theme.colors.foreground,
        borderRadius: theme.radius.full,
        padding: theme.space(0.75),
        position: 'relative',
        height: theme.space(8),
        alignSelf: 'flex-start',
    }),
    segment: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.space(3),
        zIndex: 2,
        minWidth: theme.space(12),
    },
    thumb: {
        position: 'absolute',
        top: theme.space(0.75),
        bottom: theme.space(0.75),
        backgroundColor: rt.themeName === 'dark' ? theme.colors.white : theme.colors.neutral[950],
        borderRadius: theme.radius.full,
        zIndex: 1,
    },
    title: (error: boolean) => ({
        color: error ? theme.colors.red[500] : theme.colors.typography,
        fontWeight: theme.fontWeight.medium.fontWeight,
    }),
    value: (error: boolean, isActive: boolean) => ({
        color: error
            ? theme.colors.red[500]
            : isActive
              ? rt.themeName === 'dark'
                  ? theme.colors.neutral[950]
                  : theme.colors.white
              : theme.colors.typography,
        fontWeight: theme.fontWeight.semibold.fontWeight,
    }),
    errorContainer: {
        paddingHorizontal: theme.space(5),
        marginTop: -theme.space(2),
        marginBottom: theme.space(3),
    },
}));

function Segmented<T extends FieldValues, TName extends FieldPath<T>>({
    name,
    control,
    segments,
    title,
    description,
    error,
    selectedIndex = 0,
    containerStyle,
}: SegmentedType<T, TName>) {
    const { t } = useTranslation(['common']);
    const { theme } = useUnistyles();
    const padding = theme.space(0.75);

    const {
        field: { onChange, value },
    } = useController({
        name,
        control,
        defaultValue: segments[selectedIndex]?.value as PathValue<T, TName>,
    });

    const duration = 200;

    const currentIndex = segments.findIndex((el) => el.value === value);
    const selected = useSharedValue(currentIndex >= 0 ? currentIndex : selectedIndex);
    const [activeIndex, setActiveIndex] = useState(
        currentIndex >= 0 ? currentIndex : selectedIndex,
    );

    const [segmentWidths, setSegmentWidths] = useState<number[]>(
        new Array(segments.length).fill(0),
    );
    const [segmentPositions, setSegmentPositions] = useState<number[]>(
        new Array(segments.length).fill(0),
    );
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        const newIndex = segments.findIndex((el) => el.value === value);
        if (newIndex >= 0 && newIndex !== selected.value) {
            selected.value = newIndex;
            setActiveIndex(newIndex);
        }
    }, [value, segments, selected]);

    const updateSegmentDimensions = (widths: number[]) => {
        const positions: number[] = [];
        let currentPosition = padding; // Начинаем с левого паддинга контейнера

        widths.forEach((width) => {
            positions.push(currentPosition);
            currentPosition += width;
        });

        setSegmentWidths(widths);
        setSegmentPositions(positions);
        setIsInitialized(true);
    };

    const thumbAnimatedStyle = useAnimatedStyle(() => {
        if (!isInitialized || segmentWidths.length === 0) return { opacity: 0 };

        const currentWidth = segmentWidths[selected.value] || 0;
        const currentPosition = segmentPositions[selected.value] || 0;

        return {
            opacity: 1,
            transform: [{ translateX: withTiming(currentPosition, { duration }) }],
            width: withTiming(currentWidth, { duration }),
        };
    });

    const handlePress = (index: number) => {
        selected.value = withTiming(index, { duration });
        setActiveIndex(index);
        onChange(segments[index].value);
    };

    const handleSegmentLayout = (event: LayoutChangeEvent, index: number) => {
        const { width } = event.nativeEvent.layout;

        runOnJS(() => {
            setSegmentWidths((prev) => {
                const newWidths = [...prev];
                newWidths[index] = width;

                if (newWidths.every((w) => w > 0)) {
                    updateSegmentDimensions(newWidths);
                }

                return newWidths;
            });
        })();
    };

    return (
        <VStack>
            <HStack style={[styles.container, containerStyle]}>
                <VStack>
                    <Box>
                        <Text style={styles.title(!!error)}>{title}</Text>
                    </Box>
                </VStack>

                <HStack style={styles.segmentedContainer(!!error)}>
                    {isInitialized && <Animated.View style={[styles.thumb, thumbAnimatedStyle]} />}
                    {segments.map((segment, index) => (
                        <Pressable
                            key={index}
                            onPress={() => handlePress(index)}
                            style={styles.segment}
                            onLayout={(event) => handleSegmentLayout(event, index)}
                        >
                            <Text
                                fontSize="xs"
                                style={styles.value(!!error, activeIndex === index)}
                            >
                                {segment.title}
                            </Text>
                        </Pressable>
                    ))}
                </HStack>
            </HStack>
            {error?.message && (
                <Error containerStyle={styles.errorContainer}>
                    {t(error.message, { ns: 'common' })}
                </Error>
            )}
        </VStack>
    );
}

export { Segmented };
