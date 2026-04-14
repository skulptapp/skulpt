import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { Keyboard, TextInput } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { BaseInput } from '@/components/forms/fields/base/input';
import { HStack } from '@/components/primitives/hstack';
import { Button } from '@/components/buttons/base';

const styles = StyleSheet.create((theme) => ({
    inputContainer: {
        backgroundColor: theme.colors.foreground,
        borderColor: theme.colors.foreground,
    },
    inputWrapper: {
        flex: 1,
    },
    row: {
        alignItems: 'center',
        gap: 0,
    },
    buttonContainer: {
        paddingVertical: theme.space(2),
    },
    buttonText: {
        color: theme.colors.typography,
    },
}));

interface SearchProps {
    value: string;
    onChange: (text: string) => void;
    placeholder: string;
    dismissText?: string;
}

export const Search: FC<SearchProps> = ({ value, onChange, placeholder, dismissText }) => {
    const inputRef = useRef<TextInput>(null);
    const [isFocused, setIsFocused] = useState(false);
    const [manualHide, setManualHide] = useState(false);
    const visible = useSharedValue(0);
    const btnW = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => {
        const spacing = 8;
        const distance = (btnW.value || 40) + spacing;
        return {
            opacity: visible.value,
            transform: [
                {
                    translateX: distance * (1 - visible.value),
                },
            ],
        };
    });

    const inputAnimatedStyle = useAnimatedStyle(() => {
        const spacing = 8;
        const distance = (btnW.value || 40) + spacing;
        return {
            paddingRight: distance * visible.value,
        };
    });

    const label = useMemo(() => dismissText || 'Готово', [dismissText]);
    useEffect(() => {
        const shouldShow = (isFocused || !!value) && !manualHide;
        visible.value = withTiming(shouldShow ? 1 : 0, { duration: 180 });
    }, [isFocused, value, manualHide, visible]);

    const handleDismiss = () => {
        Keyboard.dismiss();
        inputRef.current?.blur?.();
        setManualHide(true);
    };

    const handleSubmit = () => {
        Keyboard.dismiss();
        inputRef.current?.blur?.();
        setManualHide(true);
    };

    const handleFocus = () => {
        setIsFocused(true);
        setManualHide(false);
        visible.value = withTiming(1, { duration: 180 });
    };

    const handleBlur = () => {
        setIsFocused(false);
        visible.value = withTiming(0, { duration: 180 });
    };

    return (
        <HStack style={styles.row}>
            <Animated.View style={[styles.inputWrapper, inputAnimatedStyle]}>
                <BaseInput
                    ref={inputRef}
                    value={value}
                    onChange={(v) => onChange((v ?? '').toString())}
                    valueType="text"
                    placeholder={placeholder}
                    inputContainerStyle={styles.inputContainer}
                    size="xs"
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onSubmitEditing={handleSubmit}
                />
            </Animated.View>
            <Animated.View
                style={[
                    animatedStyle,
                    {
                        position: 'absolute',
                        right: 0,
                    },
                ]}
                onLayout={(e) => {
                    btnW.value = e.nativeEvent.layout.width;
                }}
            >
                <Button type="link" title={label} onPress={handleDismiss} />
            </Animated.View>
        </HStack>
    );
};
