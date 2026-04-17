import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useKeyboard } from '@react-native-community/hooks';
import { Minus, Plus } from 'lucide-react-native';
import { Keyboard, Platform, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Backdrop } from '@/components/overlays/backdrop';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Pressable } from '@/components/primitives/pressable';
import { SheetInput } from '@/components/primitives/sheet/input';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';

type Selection = { start: number; end: number };

type NumericStepperFieldProps = {
    value: number;
    unit: string;
    onChange: (value: number) => void;
    modalTitle?: string;
    step?: number;
    min?: number;
    max?: number;
    decimalPlaces?: number;
};

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space(3),
    },
    actionButton: (disabled: boolean) => ({
        width: theme.space(12),
        height: theme.space(12),
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor:
            rt.themeName === 'dark' ? theme.colors.neutral[800] : theme.colors.neutral[200],
        opacity: disabled ? 0.45 : 1,
    }),
    valueButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    valueText: {
        ...theme.fontSize['4xl'],
        color: theme.colors.typography,
        fontWeight: theme.fontWeight.bold.fontWeight,
        textAlign: 'center',
    },
    background: {
        backgroundColor:
            rt.themeName === 'dark' ? theme.colors.neutral[925] : theme.colors.background,
        borderTopRightRadius: theme.radius['4xl'],
        borderTopLeftRadius: theme.radius['4xl'],
    },
    handleContainer: {
        paddingHorizontal: theme.space(5),
        paddingVertical: theme.space(5),
        justifyContent: 'center',
    },
    handleTitle: {
        color: theme.colors.typography,
        fontWeight: theme.fontWeight.bold.fontWeight,
        fontSize: theme.fontSize.lg.fontSize,
    },
    fieldsContainer: {
        gap: theme.space(6),
        alignItems: 'center',
    },
    modalValueContainer: {
        alignItems: 'center',
    },
    inputFieldContainer: {
        position: 'relative',
    },
    underline: (visible: boolean) => ({
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: theme.space(1),
        backgroundColor: visible ? theme.colors.lime[500] : 'transparent',
    }),
    text: {
        borderBottomWidth: 0,
        color: theme.colors.typography,
        fontSize: theme.fontSize['4xl'].fontSize,
        lineHeight: theme.fontSize['4xl'].lineHeight,
        fontWeight: theme.fontWeight.bold.fontWeight,
        textAlign: 'center',
        paddingBottom: theme.space(1.5),
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
    buttonsContainer: {
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.space(5),
        backgroundColor:
            rt.themeName === 'dark' ? theme.colors.neutral[925] : theme.colors.background,
    },
    buttonContainer: {
        height: theme.space(14),
    },
    buttonTitleContainer: {
        height: '100%',
        justifyContent: 'center',
    },
    buttonTitle: {
        color: theme.colors.typography,
        fontSize: theme.fontSize.default.fontSize,
    },
}));

const toFixedNumber = (value: number, decimalPlaces: number): number => {
    const factor = 10 ** decimalPlaces;
    return Math.round(value * factor) / factor;
};

const clamp = (value: number, min: number, max?: number): number => {
    const upper = max ?? Number.POSITIVE_INFINITY;
    return Math.max(min, Math.min(upper, value));
};

const parseNumericDraft = (draft: string): number | null => {
    if (draft.trim().length === 0) return null;
    const normalized = draft.replace(/\s/g, '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
};

const formatEditableValue = (value: number, decimalPlaces: number): string => {
    const fixed = toFixedNumber(value, decimalPlaces).toFixed(decimalPlaces);
    const trimmed = fixed.replace(/\.?0+$/, '');
    return trimmed.length > 0 ? trimmed : '0';
};

const formatDisplayValue = (value: number, decimalPlaces: number): string => {
    const normalized = toFixedNumber(value, decimalPlaces);
    const hasFraction = Math.abs(normalized % 1) > 0;

    return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: hasFraction ? 1 : 0,
        maximumFractionDigits: decimalPlaces,
    }).format(normalized);
};

const normalizeValue = (
    value: number,
    min: number,
    max: number | undefined,
    decimalPlaces: number,
): number => {
    return toFixedNumber(clamp(value, min, max), decimalPlaces);
};

const NumericStepperField: FC<NumericStepperFieldProps> = ({
    value,
    unit,
    onChange,
    modalTitle,
    step = 0.1,
    min = 0,
    max,
    decimalPlaces = 1,
}) => {
    const { theme } = useUnistyles();
    const { t } = useTranslation(['common']);
    const { keyboardShown } = useKeyboard();

    const bottomSheetModalRef = useRef<BottomSheetModal>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);

    const safeValue = useMemo(
        () => normalizeValue(Number.isFinite(value) ? value : min, min, max, decimalPlaces),
        [decimalPlaces, max, min, value],
    );

    const fallbackInput = useMemo(
        () => formatEditableValue(safeValue, decimalPlaces),
        [decimalPlaces, safeValue],
    );

    const [focused, setFocused] = useState(false);
    const [inputText, setInputText] = useState<string>(fallbackInput);
    const [selection, setSelection] = useState<Selection | undefined>(undefined);

    useEffect(() => {
        if (!focused) {
            setInputText(fallbackInput);
        }
    }, [focused, fallbackInput]);

    useEffect(() => {
        if (isModalVisible) {
            bottomSheetModalRef.current?.present();
        } else {
            bottomSheetModalRef.current?.close();
        }
    }, [keyboardShown, isModalVisible]);

    const displayText = useMemo(() => {
        const numericValue = parseNumericDraft(inputText) ?? 0;
        return `${formatDisplayValue(numericValue, decimalPlaces)} ${unit}`;
    }, [decimalPlaces, inputText, unit]);

    const canDecrement = safeValue > min;
    const canIncrement = max == null || safeValue < max;

    const handleOpenModal = useCallback(() => {
        setInputText(fallbackInput);
        setIsModalVisible(true);
    }, [fallbackInput]);

    const handleCloseModal = useCallback(() => {
        if (isModalVisible && keyboardShown) {
            Keyboard.dismiss();
        }
        setIsModalVisible(false);
        setFocused(false);
        setSelection(undefined);
    }, [isModalVisible, keyboardShown]);

    const handleDraftSave = useCallback(() => {
        const parsed = parseNumericDraft(inputText);
        const nextValue = normalizeValue(parsed ?? 0, min, max, decimalPlaces);
        onChange(nextValue);
        handleCloseModal();
    }, [decimalPlaces, handleCloseModal, inputText, max, min, onChange]);

    const handleInputRef = useCallback((input: TextInput | null | undefined) => {
        if (input == null) return;

        setTimeout(
            () => {
                input.focus();
            },
            Platform.OS === 'android' ? 30 : 0,
        );
    }, []);

    const handleFocus = useCallback(() => {
        setFocused(true);
        setInputText(fallbackInput);
        const end = fallbackInput.length;
        setSelection({ start: end, end });
    }, [fallbackInput]);

    const handleBlur = useCallback(() => {
        setFocused(false);
        setSelection(undefined);
    }, []);

    const handleChangeText = useCallback((nextText: string) => {
        const normalized = nextText.replace(/[^0-9.,]/g, '');
        setInputText(normalized);
        const end = normalized.length;
        setSelection({ start: end, end });
    }, []);

    const handleStepDown = useCallback(() => {
        if (!canDecrement) return;
        const nextValue = normalizeValue(safeValue - step, min, max, decimalPlaces);
        onChange(nextValue);
    }, [canDecrement, decimalPlaces, max, min, onChange, safeValue, step]);

    const handleStepUp = useCallback(() => {
        if (!canIncrement) return;
        const nextValue = normalizeValue(safeValue + step, min, max, decimalPlaces);
        onChange(nextValue);
    }, [canIncrement, decimalPlaces, max, min, onChange, safeValue, step]);

    const title = useMemo(() => {
        const base = modalTitle ?? '';
        if (base.length === 0) return '';
        return base.charAt(0).toUpperCase() + base.slice(1);
    }, [modalTitle]);

    const Handle = () => (
        <HStack style={styles.handleContainer}>
            <Box>
                <Text style={styles.handleTitle}>{title}</Text>
            </Box>
        </HStack>
    );

    return (
        <>
            <HStack style={styles.container}>
                <Pressable
                    onPress={handleStepDown}
                    disabled={!canDecrement}
                    style={styles.actionButton(!canDecrement)}
                >
                    <Minus size={26} color={theme.colors.typography} />
                </Pressable>

                <Pressable onPress={handleOpenModal} style={styles.valueButton}>
                    <Text style={styles.valueText}>
                        {`${formatDisplayValue(safeValue, decimalPlaces)} ${unit}`}
                    </Text>
                </Pressable>

                <Pressable
                    onPress={handleStepUp}
                    disabled={!canIncrement}
                    style={styles.actionButton(!canIncrement)}
                >
                    <Plus size={26} color={theme.colors.typography} />
                </Pressable>
            </HStack>

            <BottomSheetModal
                ref={bottomSheetModalRef}
                backdropComponent={Backdrop}
                handleComponent={Handle}
                enableHandlePanningGesture={false}
                enableContentPanningGesture={false}
                backgroundStyle={styles.background}
                stackBehavior="push"
                onDismiss={() => setIsModalVisible(false)}
            >
                <BottomSheetView>
                    <VStack style={styles.fieldsContainer}>
                        <VStack style={styles.modalValueContainer}>
                            <Box style={styles.inputFieldContainer}>
                                <Text pointerEvents="none" style={styles.text}>
                                    {displayText}
                                </Text>
                                <Box pointerEvents="none" style={styles.underline(focused)} />
                                <SheetInput
                                    ref={handleInputRef}
                                    keyboardType="decimal-pad"
                                    style={styles.input}
                                    editable={true}
                                    caretHidden={true}
                                    selectionColor="transparent"
                                    cursorColor="transparent"
                                    value={inputText}
                                    onFocus={handleFocus}
                                    onBlur={handleBlur}
                                    onChangeText={handleChangeText}
                                    {...(selection != null ? { selection } : {})}
                                    placeholder=""
                                />
                            </Box>
                        </VStack>
                    </VStack>

                    <HStack style={styles.buttonsContainer}>
                        <Box style={styles.buttonContainer}>
                            <Pressable
                                style={styles.buttonTitleContainer}
                                onPress={handleCloseModal}
                            >
                                <Text style={styles.buttonTitle}>
                                    {t('cancel', { ns: 'common' })}
                                </Text>
                            </Pressable>
                        </Box>
                        <Box style={styles.buttonContainer}>
                            <Pressable
                                style={styles.buttonTitleContainer}
                                onPress={handleDraftSave}
                            >
                                <Text fontWeight="bold" style={styles.buttonTitle}>
                                    {t('save', { ns: 'common' })}
                                </Text>
                            </Pressable>
                        </Box>
                    </HStack>
                </BottomSheetView>
            </BottomSheetModal>
        </>
    );
};

export { NumericStepperField };
