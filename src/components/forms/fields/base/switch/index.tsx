import { FC } from 'react';
import Animated, {
    interpolate,
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { FieldError, Merge } from 'react-hook-form';

import { Pressable } from '@/components/primitives/pressable';
import { HStack } from '@/components/primitives/hstack';
import { VStack } from '@/components/primitives/vstack';
import { Box, BoxProps } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';

import { Error } from '../../components';
import { useTranslation } from 'react-i18next';

export interface SwitchType {
    value?: boolean;
    title: string;
    description?: string;
    onChange: (value: boolean) => void;
    containerStyle?: BoxProps['style'];
    error?: Merge<FieldError, (FieldError | undefined)[]> | undefined;
}

const styles = StyleSheet.create((theme) => ({
    container: {
        paddingVertical: theme.space(3),
        paddingHorizontal: theme.space(5),
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    track: {
        alignItems: 'flex-start',
        width: theme.space(14),
        height: theme.space(8),
        padding: theme.space(0.75),
    },
    thumb: {
        height: '100%',
        aspectRatio: 1,
        backgroundColor: theme.colors.background,
    },
    title: (error: boolean) => ({
        fontWeight: theme.fontWeight.medium.fontWeight,
        color: error ? theme.colors.red[500] : theme.colors.typography,
    }),
    errorContainer: {
        paddingHorizontal: theme.space(5),
        marginTop: -theme.space(2),
        marginBottom: theme.space(3),
    },
}));

const Switch: FC<SwitchType> = ({ value, title, description, onChange, containerStyle, error }) => {
    const { t } = useTranslation(['common']);
    const { theme } = useUnistyles();

    const duration = 300;

    const isOn = useSharedValue(value ? 1 : 0);

    const height = useSharedValue(0);
    const width = useSharedValue(0);

    const trackAnimatedStyle = useAnimatedStyle(() => {
        const color = interpolateColor(
            isOn.value,
            [0, 1],
            [!!error ? theme.colors.red[100] : theme.colors.foreground, theme.colors.typography],
        );
        const colorValue = withTiming(color, { duration });

        return {
            backgroundColor: colorValue,
            borderRadius: height.value / 2,
        };
    });

    const thumbAnimatedStyle = useAnimatedStyle(() => {
        const moveValue = interpolate(Number(isOn.value), [0, 1], [0, width.value - height.value]);
        const translateValue = withTiming(moveValue, { duration });

        return {
            transform: [{ translateX: translateValue }],
            borderRadius: height.value / 2,
        };
    });

    const handlePress = () => {
        isOn.value = isOn.value ? 0 : 1;
        onChange(!isOn.value);
    };

    return (
        <VStack>
            <HStack style={[styles.container, containerStyle]}>
                <VStack>
                    <Box>
                        <Text style={styles.title(!!error)}>{title}</Text>
                    </Box>
                    {description && (
                        <Box>
                            <Text>{description}</Text>
                        </Box>
                    )}
                </VStack>
                <Pressable onPress={handlePress}>
                    <Animated.View
                        onLayout={(e) => {
                            height.value = e.nativeEvent.layout.height;
                            width.value = e.nativeEvent.layout.width;
                        }}
                        style={[styles.track, trackAnimatedStyle]}
                    >
                        <Animated.View style={[styles.thumb, thumbAnimatedStyle]}></Animated.View>
                    </Animated.View>
                </Pressable>
            </HStack>
            {error?.message && (
                <Error containerStyle={styles.errorContainer}>
                    {t(error.message, { ns: 'common' })}
                </Error>
            )}
        </VStack>
    );
};

export { Switch };
