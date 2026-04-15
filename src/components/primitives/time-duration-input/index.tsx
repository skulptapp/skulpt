import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, TextInput, TextStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { Input } from '@/components/primitives/input';
import { digitsFromSeconds, formatClockSecondsCompact, secondsFromDigits } from '@/helpers/times';

type Selection = { start: number; end: number };

export interface TimeDurationInputProps {
    valueSeconds?: number | null;
    editable: boolean;
    /**
     * If provided, this text is displayed instead of the editable formatted value.
     * Useful for timer/stopwatch display during an active set.
     */
    displayOverride?: string;
    /**
     * Base text style (font, height, colors, opacity, etc.) from the parent.
     * The component will NOT use borderBottom from this style; underline is drawn separately.
     */
    style: TextStyle;
    onCommitSeconds: (seconds: number) => void;
}

const styles = StyleSheet.create((theme) => ({
    underline: (visible: boolean) => ({
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: theme.space(1),
        backgroundColor: visible ? theme.colors.lime[500] : 'transparent',
    }),
    text: {
        paddingTop: theme.space(0.5),
        borderBottomWidth: 0,
    },
    input: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        color: 'transparent',
        opacity: Platform.OS === 'android' ? 0 : 1,
        borderBottomWidth: 0,
    },
}));

export const TimeDurationInput: FC<TimeDurationInputProps> = ({
    valueSeconds,
    editable,
    displayOverride,
    style,
    onCommitSeconds,
}) => {
    const { theme } = useUnistyles();
    const inputRef = useRef<TextInput | null>(null);

    const baseSeconds = Math.max(0, valueSeconds ?? 0);
    const fallbackDigits = useMemo(() => digitsFromSeconds(baseSeconds), [baseSeconds]);

    const [focused, setFocused] = useState(false);
    const [digits, setDigits] = useState<string>(fallbackDigits);
    const [selection, setSelection] = useState<Selection | undefined>(undefined);

    useEffect(() => {
        // Keep in sync while not editing
        if (!focused) {
            setDigits(fallbackDigits);
        }
    }, [focused, fallbackDigits]);

    const timeDigits = useMemo(() => digits.replace(/\D/g, ''), [digits]);
    const formatted = useMemo(
        () => formatClockSecondsCompact(secondsFromDigits(timeDigits)),
        [timeDigits],
    );

    const displayText = displayOverride ?? formatted;

    const handleFocus = () => {
        if (!editable) return;
        setFocused(true);
        setDigits(fallbackDigits);
        const end = fallbackDigits.length;
        setSelection({ start: end, end });
    };

    const handleBlur = () => {
        setFocused(false);
        setSelection(undefined);
    };

    const handleChangeText = (t: string) => {
        if (!editable) return;
        const d = t.replace(/\D/g, '');
        setDigits(d);
        const end = d.length;
        setSelection({ start: end, end });
        onCommitSeconds(secondsFromDigits(d));
    };

    return (
        <Box style={{ position: 'relative' }}>
            <Text pointerEvents="none" style={[style, styles.text]}>
                {displayText}
            </Text>
            <Box pointerEvents="none" style={styles.underline(editable && focused)} />
            <Input
                ref={inputRef}
                keyboardType="number-pad"
                style={[style, styles.input]}
                editable={editable}
                caretHidden={true}
                selectionColor="transparent"
                cursorColor="transparent"
                value={editable ? timeDigits : ''}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onChangeText={handleChangeText}
                selection={selection}
                placeholder=""
                placeholderTextColor={theme.colors.neutral[400]}
            />
        </Box>
    );
};
