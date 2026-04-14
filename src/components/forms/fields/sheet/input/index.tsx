import React, { FC, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, TextInput } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useKeyboard } from '@react-native-community/hooks';
import { useTranslation } from 'react-i18next';
import { NumericFormat } from 'react-number-format';
import { useLocales } from 'expo-localization';
import { StyleSheet } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';
import { Backdrop } from '@/components/overlays/backdrop';

import { BaseInput, InputProps, InputContainer } from '../../base/input';
import { Label, Error, Help } from '../../components';

export interface SheetInputProps extends Omit<InputProps, 'sheet'> {
    title?: string;
}

const styles = StyleSheet.create((theme) => ({
    handleContainer: (title: boolean) => ({
        paddingHorizontal: theme.space(5),
        paddingVertical: title ? theme.space(5) : theme.space(3),
        justifyContent: 'center',
    }),
    handleTitle: {
        color: theme.colors.typography,
    },
    value: (error: boolean) => ({
        color: error ? theme.colors.red[500] : theme.colors.typography,
    }),
    inputContainer: {
        paddingHorizontal: theme.space(5),
    },
    actionsContainer: {
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.space(5),
        backgroundColor: theme.colors.background,
    },
    actionContainer: {
        height: theme.space(14),
    },
    actionWrapper: {
        height: '100%',
        justifyContent: 'center',
    },
    actionTitle: {
        color: theme.colors.typography,
    },
}));

const SheetInput: FC<SheetInputProps> = ({
    title,
    label,
    value: defaultValue,
    valueType = 'text',
    keyboardType,
    numericThousandSeparator,
    error,
    help,
    inputContainerStyle,
    inputStyle,
    onChange,
    prefix,
    suffix,
    placeholder,
}) => {
    const [visible, setVisible] = useState<boolean>(false);
    const [value, setValue] = useState<string | number | null | undefined>(defaultValue);
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);
    const { keyboardShown } = useKeyboard();
    const locale = useLocales();
    const { t } = useTranslation(['common']);

    const decimalSeparator = locale[0].decimalSeparator || '.';

    const thousandSeparator = useMemo(() => {
        if (numericThousandSeparator) {
            return numericThousandSeparator;
        }
        if (numericThousandSeparator === '') {
            return numericThousandSeparator;
        }
        return locale[0].digitGroupingSeparator || ' ';
    }, [locale, numericThousandSeparator]);

    useEffect(() => {
        if (visible) {
            bottomSheetModalRef.current?.present();
        } else {
            bottomSheetModalRef.current?.close();
        }
    }, [keyboardShown, visible]);

    const inputRef = useCallback((input: TextInput | null) => {
        if (input !== null) {
            setTimeout(
                () => {
                    input.focus();
                },
                Platform.OS === 'android' ? 30 : 0,
            );
        }
    }, []);

    const handleOnChange = (value: string | number | null | undefined) => {
        setValue(value);
        if (onChange) {
            onChange(value);
        }
    };

    const handleSheet = () => {
        if (visible && keyboardShown) {
            Keyboard.dismiss();
        }
        setVisible(!visible);
    };

    const Handle = () => (
        <>
            <HStack style={styles.handleContainer(!!title)}>
                <Box>
                    {title && (
                        <Text fontWeight="black" fontSize="lg" style={styles.handleTitle}>
                            {title}
                        </Text>
                    )}
                </Box>
            </HStack>
        </>
    );

    const Value: FC<{ children: ReactNode }> = ({ children }) => (
        <Text fontSize="lg" fontWeight="semibold" style={[styles.value(!!error), inputStyle]}>
            {children}
        </Text>
    );

    return (
        <Box>
            <Pressable onPress={handleSheet}>
                {label && <Label>{label}</Label>}
                <InputContainer error={error} inputContainerStyle={inputContainerStyle}>
                    {value && (
                        <>
                            {['number', 'decimal'].includes(valueType) ? (
                                <NumericFormat
                                    value={value}
                                    thousandSeparator={thousandSeparator}
                                    decimalSeparator={decimalSeparator}
                                    prefix={prefix}
                                    suffix={suffix}
                                    displayType="text"
                                    renderText={(value) => <Value>{value}</Value>}
                                />
                            ) : (
                                <Value>{value}</Value>
                            )}
                        </>
                    )}
                </InputContainer>
                {error?.message && <Error>{t(error.message, { ns: 'common' })}</Error>}
                {help && !error && <Help>{help.message}</Help>}
            </Pressable>
            <BottomSheetModal
                ref={bottomSheetModalRef}
                backdropComponent={Backdrop}
                handleComponent={Handle}
                enableHandlePanningGesture={false}
                enableContentPanningGesture={false}
                stackBehavior="push"
            >
                <BottomSheetView>
                    <Box style={styles.inputContainer}>
                        <BaseInput
                            asSheet={true}
                            ref={inputRef}
                            value={value}
                            valueType={valueType}
                            keyboardType={keyboardType}
                            numericThousandSeparator={numericThousandSeparator}
                            error={error}
                            help={help}
                            inputContainerStyle={inputContainerStyle}
                            inputStyle={inputStyle}
                            onChange={handleOnChange}
                            onSubmitEditing={handleSheet}
                            placeholder={placeholder}
                        />
                    </Box>
                    <HStack style={styles.actionsContainer}>
                        <Box style={styles.actionContainer}>
                            <Pressable style={styles.actionWrapper} onPress={handleSheet}>
                                <Text style={styles.actionTitle}>
                                    {t('close', { ns: 'common' })}
                                </Text>
                            </Pressable>
                        </Box>
                        <Box style={styles.actionContainer}>
                            <Pressable style={styles.actionWrapper} onPress={handleSheet}>
                                <Text fontWeight="bold" style={styles.actionTitle}>
                                    {t('save', { ns: 'common' })}
                                </Text>
                            </Pressable>
                        </Box>
                    </HStack>
                </BottomSheetView>
            </BottomSheetModal>
        </Box>
    );
};

export { SheetInput };
