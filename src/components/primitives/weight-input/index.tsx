import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, TextInput, TextStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { Input } from '@/components/primitives/input';

type Selection = { start: number; end: number };

export interface WeightInputProps {
    value?: number | null;
    editable: boolean;
    /**
     * If provided, this text is displayed instead of the editable formatted value.
     */
    displayOverride?: string;
    /**
     * Base text style (font, height, colors, opacity, etc.) from the parent.
     * The component will NOT use borderBottom from this style; underline is drawn separately.
     */
    style: TextStyle;
    onCommitValue: (value: number) => void;
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

const formatWeight = (weight: number) => {
    if (weight === 0) return '0';
    return String(weight);
};

const parseWeightInput = (input: string) => {
    if (!input || input.trim() === '') return 0;
    const normalized = input.replace(',', '.');
    const n = Number(normalized);
    return Number.isNaN(n) ? 0 : n;
};

export const WeightInput: FC<WeightInputProps> = ({
    value,
    editable,
    displayOverride,
    style,
    onCommitValue,
}) => {
    const { theme } = useUnistyles();
    const inputRef = useRef<TextInput | null>(null);

    const baseValue = Math.max(0, value ?? 0);
    const fallbackText = useMemo(() => formatWeight(baseValue), [baseValue]);

    const [focused, setFocused] = useState(false);
    const [text, setText] = useState<string>(fallbackText);
    const [selection, setSelection] = useState<Selection | undefined>(undefined);

    useEffect(() => {
        // Keep in sync while not editing
        if (!focused) {
            setText(fallbackText);
        }
    }, [focused, fallbackText]);

    const weightDigits = useMemo(() => {
        const normalized = text.replace(/[^0-9.,]/g, '');
        return normalized;
    }, [text]);

    const formatted = useMemo(() => formatWeight(parseWeightInput(weightDigits)), [weightDigits]);

    const displayText = displayOverride ?? formatted;

    const handleFocus = () => {
        if (!editable) return;
        setFocused(true);
        setText(fallbackText);
        const end = fallbackText.length;
        setSelection({ start: end, end });
    };

    const handleBlur = () => {
        setFocused(false);
        setSelection(undefined);
    };

    const handleChangeText = (t: string) => {
        if (!editable) return;
        const normalized = t.replace(/[^0-9.,]/g, '');
        setText(normalized);
        const end = normalized.length;
        setSelection({ start: end, end });
        onCommitValue(parseWeightInput(normalized));
    };

    return (
        <Box style={{ position: 'relative' }}>
            <Text pointerEvents="none" style={[style, styles.text]}>
                {displayText}
            </Text>
            <Box pointerEvents="none" style={styles.underline(editable && focused)} />
            <Input
                ref={inputRef}
                keyboardType="decimal-pad"
                style={[style, styles.input]}
                editable={editable}
                caretHidden={true}
                selectionColor="transparent"
                cursorColor="transparent"
                value={editable ? weightDigits : ''}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onChangeText={handleChangeText}
                {...(selection != null ? { selection } : {})}
                placeholder=""
                placeholderTextColor={theme.colors.neutral[400]}
            />
        </Box>
    );
};
