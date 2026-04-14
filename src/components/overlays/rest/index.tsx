import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { Keyboard, Platform, TextInput } from 'react-native';
import { useKeyboard } from '@react-native-community/hooks';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';
import { useShallow } from 'zustand/react/shallow';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';
import { Backdrop } from '@/components/overlays/backdrop';
import { RestChangeType, useRestStore } from '@/stores/rest';
import { BaseButtons } from '@/components/forms/fields/base/buttons';
import { VStack } from '@/components/primitives/vstack';
import { useExerciseSets, useUpdateExerciseSet } from '@/hooks/use-workouts';
import { SheetInput } from '@/components/primitives/sheet/input';
import { digitsFromSeconds, formatClockSecondsCompact, secondsFromDigits } from '@/helpers/times';

type Selection = { start: number; end: number };

const isChangeType = (v: unknown): v is RestChangeType =>
    v === 'after_set' || v === 'between_sets' || v === 'after_exercise' || v === 'all_intervals';

const styles = StyleSheet.create((theme, rt) => ({
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
    inputFieldContainer: {
        position: 'relative',
    },
    fieldContainer: {
        paddingHorizontal: theme.space(5),
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
    choicesContainer: {
        justifyContent: 'center',
    },
    input: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        color: 'transparent',
        borderBottomWidth: 0,
    },
    secondsContainer: {
        alignItems: 'center',
    },
}));

const RestInput: FC = () => {
    const [value, setValue] = useState<number | null | undefined>();
    const [userModified, setUserModified] = useState(false);
    const [isFirstOpen, setIsFirstOpen] = useState(true);
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);
    const { keyboardShown } = useKeyboard();
    const { t } = useTranslation(['common']);

    const baseSeconds = Math.max(0, value ?? 0);
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

    const displayText = useMemo(
        () => formatClockSecondsCompact(secondsFromDigits(timeDigits)),
        [timeDigits],
    );

    const { opened, customTitle, close, setId, workoutExerciseId, changeType, setChangeType } =
        useRestStore(
            useShallow((state) => ({
                opened: state.opened,
                customTitle: state.title,
                close: state.close,
                setId: state.setId,
                workoutExerciseId: state.workoutExerciseId,
                changeType: state.changeType,
                setChangeType: state.setChangeType,
            })),
        );

    const baseTitle = customTitle ?? t('rest', { ns: 'common' });
    const title = baseTitle.charAt(0).toUpperCase() + baseTitle.slice(1);

    const { data: sets } = useExerciseSets(workoutExerciseId || '');

    const sortedSets = useMemo(
        () => (sets || []).slice().sort((a, b) => a.order - b.order),
        [sets],
    );

    const currentSet = useMemo(
        () => sortedSets.find((s) => s.id === setId) || null,
        [sortedSets, setId],
    );

    const { mutate: updateSet } = useUpdateExerciseSet();

    useEffect(() => {
        if (opened) {
            bottomSheetModalRef.current?.present();
        } else {
            bottomSheetModalRef.current?.close();
        }
    }, [keyboardShown, opened]);

    const choices = useMemo(() => {
        const all = [
            { value: 'after_set' as const },
            { value: 'between_sets' as const },
            { value: 'after_exercise' as const },
            { value: 'all_intervals' as const },
        ];
        if (!setId) {
            return all.filter((c) => c.value !== 'after_set');
        }
        return all;
    }, [setId]);

    const showChangeType = useMemo(() => {
        if (changeType === 'after_set' && setId) {
            return false;
        }
        return true;
    }, [setId, changeType]);

    const inputRef = useCallback((input: TextInput | null | undefined) => {
        if (input !== null && input !== undefined) {
            setTimeout(
                () => {
                    input.focus();
                },
                Platform.OS === 'android' ? 30 : 0,
            );
        }
    }, []);

    useEffect(() => {
        if (opened) {
            if (setId) {
                // Specific set modal - use the set's rest time only if not previously modified
                if (!userModified) {
                    setValue(currentSet?.restTime ?? null);
                }
                // Don't reset userModified for specific modal - preserve user's input
            } else {
                // General modal - reset to empty only on first open
                if (isFirstOpen) {
                    setValue(null);
                    setIsFirstOpen(false);
                }
                // Don't reset userModified for general modal - preserve user's input
            }

            if (!setId && changeType === 'after_set') {
                setChangeType('all_intervals');
            }
        } else {
            // Modal closed - reset first open flag and user modified flag
            setIsFirstOpen(true);
            setUserModified(false);
        }
    }, [
        opened,
        currentSet?.restTime,
        setId,
        sortedSets,
        changeType,
        setChangeType,
        isFirstOpen,
        userModified,
    ]);

    // Only for specific set modal: update value when user hasn't modified it
    useEffect(() => {
        if (opened && !userModified && setId) {
            setValue(currentSet?.restTime ?? null);
        }
    }, [changeType, currentSet?.restTime, opened, userModified, setId]);

    const handleSheet = () => {
        if (opened && keyboardShown) {
            Keyboard.dismiss();
        }
        close();
    };

    const Handle = () => (
        <>
            <HStack style={styles.handleContainer}>
                <Box>
                    <Text style={styles.handleTitle}>{title}</Text>
                </Box>
            </HStack>
        </>
    );

    const handleButtonChange = (value: string | number | boolean | null | (string | number)[]) => {
        if (isChangeType(value)) {
            setChangeType(value);
        }
    };

    const handleSave = () => {
        if (!workoutExerciseId) {
            handleSheet();
            return;
        }
        const numeric = typeof value === 'number' ? value : value ? Number(value) : null;
        const nulledNumeric = numeric === 0 ? null : numeric;
        const restValue = nulledNumeric == null ? null : Math.max(0, Math.trunc(nulledNumeric));

        if (changeType === 'after_set') {
            if (setId) {
                updateSet({ id: setId, updates: { restTime: restValue } });
            }
        } else if (changeType === 'between_sets') {
            if (sortedSets.length > 0) {
                for (let i = 0; i < sortedSets.length - 1; i++) {
                    updateSet({ id: sortedSets[i].id, updates: { restTime: restValue } });
                }
            }
        } else if (changeType === 'after_exercise') {
            if (sortedSets.length > 0) {
                const last = sortedSets[sortedSets.length - 1];
                updateSet({ id: last.id, updates: { restTime: restValue } });
            }
        } else if (changeType === 'all_intervals') {
            for (const s of sortedSets) {
                updateSet({ id: s.id, updates: { restTime: restValue } });
            }
        }
        handleSheet();
    };

    const handleFocus = () => {
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
        const d = t.replace(/\D/g, '');
        setDigits(d);
        const end = d.length;
        setSelection({ start: end, end });
        setValue(secondsFromDigits(d) ?? null);
        setUserModified(true);
    };

    return (
        <BottomSheetModal
            ref={bottomSheetModalRef}
            backdropComponent={Backdrop}
            handleComponent={Handle}
            enableHandlePanningGesture={false}
            enableContentPanningGesture={false}
            backgroundStyle={styles.background}
            stackBehavior="push"
        >
            <BottomSheetView>
                <VStack style={styles.fieldsContainer}>
                    <VStack style={styles.secondsContainer}>
                        <Box style={styles.inputFieldContainer}>
                            <Text pointerEvents="none" style={styles.text}>
                                {displayText}
                            </Text>
                            <Box pointerEvents="none" style={styles.underline(focused)} />
                            <SheetInput
                                ref={inputRef}
                                keyboardType="number-pad"
                                style={styles.input}
                                editable={true}
                                caretHidden={true}
                                selectionColor="transparent"
                                cursorColor="transparent"
                                value={timeDigits}
                                onFocus={handleFocus}
                                onBlur={handleBlur}
                                onChangeText={handleChangeText}
                                selection={selection}
                                placeholder=""
                            />
                        </Box>
                    </VStack>
                    {showChangeType && (
                        <Box style={styles.fieldContainer}>
                            <BaseButtons
                                value={
                                    !setId && changeType === 'after_set'
                                        ? 'all_intervals'
                                        : changeType
                                }
                                choices={choices.map((v) => ({
                                    value: v.value,
                                    title: t(`setRestType.${v.value}`, { ns: 'common' }),
                                }))}
                                onChange={handleButtonChange}
                                choicesContainerStyle={styles.choicesContainer}
                                variant="accent"
                                size="small"
                            />
                        </Box>
                    )}
                </VStack>
                <HStack style={styles.buttonsContainer}>
                    <Box style={styles.buttonContainer}>
                        <Pressable style={styles.buttonTitleContainer} onPress={handleSheet}>
                            <Text style={styles.buttonTitle}>{t('cancel', { ns: 'common' })}</Text>
                        </Pressable>
                    </Box>
                    <Box style={styles.buttonContainer}>
                        <Pressable style={styles.buttonTitleContainer} onPress={handleSave}>
                            <Text fontWeight="bold" style={styles.buttonTitle}>
                                {t('save', { ns: 'common' })}
                            </Text>
                        </Pressable>
                    </Box>
                </HStack>
            </BottomSheetView>
        </BottomSheetModal>
    );
};

export default RestInput;
