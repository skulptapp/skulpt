import { FC, ForwardedRef, forwardRef, ReactNode, useMemo, useState, ComponentRef } from 'react';
import { KeyboardTypeOptions, StyleProp, TextInput, TextInputProps, TextStyle } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { NumberFormatValues, NumericFormat } from 'react-number-format';
import { StyleSheet, UnistylesVariants } from 'react-native-unistyles';
import { useLocales } from 'expo-localization';

import { HStack } from '@/components/primitives/hstack';
import { Input as InputPrimitive } from '@/components/primitives/input';
import { SheetInput as SheetInputPrimitive } from '@/components/primitives/sheet/input';
import { VStack } from '@/components/primitives/vstack';
import { stableOutlineWidth } from '@/helpers/styles';
import { getNumericValue, valueToType } from '@/helpers/values';

import { FieldValueType, InputType, OnChangeType } from '../../types';
import { Label, Error, Help } from '../../components';
import { useTranslation } from 'react-i18next';

interface InputBaseProps extends InputType {
    onChange: OnChangeType;
}

export type InputProps = InputBaseProps & UnistylesVariants<typeof styles>;

interface InputContainerBaseProps extends Pick<InputType, 'error' | 'inputContainerStyle'> {
    children: ReactNode;
}

type InputContainerProps = InputContainerBaseProps & UnistylesVariants<typeof styles>;

interface InputComponentProps extends Pick<
    TextInputProps,
    'onSubmitEditing' | 'placeholder' | 'onFocus' | 'onBlur'
> {
    defaultValue?: string;
    inputValue?: string;
    valueType: FieldValueType;
    keyboardType?: KeyboardTypeOptions;
    decimalScale: number;
    decimalSeparator: string;
    thousandSeparator: string;
    style?: StyleProp<TextStyle>;
    onChangeNumeric: (values: NumberFormatValues) => void;
    onChangeHandler: (value: string) => void;
    onChangeText: (text: string) => void;
}

const styles = StyleSheet.create((theme) => ({
    inputContainer: (error: boolean) => ({
        alignItems: 'center',
        backgroundColor: error ? theme.colors.red[100] : theme.colors.background,
        borderRadius: theme.radius.full,
        borderWidth: stableOutlineWidth,
        borderColor: error ? theme.colors.red[100] : theme.colors.background,
        paddingHorizontal: theme.space(4),
        variants: {
            size: {
                xs: {
                    height: theme.space(10),
                },
                sm: {
                    height: theme.space(12),
                },
                default: {
                    height: theme.space(14),
                },
            },
        },
    }),
    input: (error: boolean) => ({
        height: '100%',
        width: '100%',
        color: error ? theme.colors.red[100] : theme.colors.typography,
        variants: {
            size: {
                xs: {
                    fontSize: theme.fontSize.default.fontSize,
                    fontWeight: theme.fontWeight.medium.fontWeight,
                },
                sm: {
                    fontSize: theme.fontSize.default.fontSize,
                    fontWeight: theme.fontWeight.semibold.fontWeight,
                },
                default: {
                    fontSize: theme.fontSize.lg.fontSize,
                    fontWeight: theme.fontWeight.semibold.fontWeight,
                },
            },
        },
    }),
}));

export const InputContainer: FC<InputContainerProps> = ({
    error,
    inputContainerStyle,
    size,
    children,
}) => {
    styles.useVariants({ size });

    return (
        <HStack style={[styles.inputContainer(!!error), inputContainerStyle]}>{children}</HStack>
    );
};

const InputComponent = forwardRef<TextInput, InputComponentProps>(
    (
        {
            defaultValue,
            inputValue,
            valueType,
            keyboardType,
            decimalScale,
            decimalSeparator,
            thousandSeparator,
            style,
            onChangeNumeric,
            onChangeHandler,
            onChangeText,
            onSubmitEditing,
            placeholder,
            onFocus,
            onBlur,
        }: InputComponentProps,
        ref: ForwardedRef<TextInput>,
    ) => {
        return (
            <>
                {['number', 'decimal'].includes(valueType) ? (
                    <NumericFormat
                        value={inputValue}
                        valueIsNumericString={true}
                        onValueChange={onChangeNumeric}
                        allowNegative={false}
                        decimalScale={decimalScale}
                        decimalSeparator={decimalSeparator}
                        thousandSeparator={thousandSeparator}
                        displayType={'text'}
                        renderText={(value) => (
                            <InputPrimitive
                                ref={ref}
                                value={value}
                                keyboardType={keyboardType}
                                onChangeText={onChangeHandler}
                                onSubmitEditing={onSubmitEditing}
                                onFocus={onFocus}
                                onBlur={onBlur}
                                style={style}
                                placeholder={placeholder}
                            />
                        )}
                    />
                ) : (
                    <InputPrimitive
                        ref={ref}
                        defaultValue={defaultValue}
                        keyboardType={keyboardType}
                        onChangeText={onChangeText}
                        onSubmitEditing={onSubmitEditing}
                        onFocus={onFocus}
                        onBlur={onBlur}
                        style={style}
                        placeholder={placeholder}
                    />
                )}
            </>
        );
    },
);

InputComponent.displayName = 'InputComponent';

const SheetInputComponent = forwardRef<
    ComponentRef<typeof BottomSheetTextInput>,
    InputComponentProps
>(
    (
        {
            defaultValue,
            inputValue,
            valueType,
            keyboardType,
            decimalScale,
            decimalSeparator,
            thousandSeparator,
            style,
            onChangeNumeric,
            onChangeHandler,
            onChangeText,
            onSubmitEditing,
            placeholder,
        }: InputComponentProps,
        ref: ForwardedRef<ComponentRef<typeof BottomSheetTextInput>>,
    ) => {
        return (
            <>
                {['number', 'decimal'].includes(valueType) ? (
                    <NumericFormat
                        value={inputValue}
                        valueIsNumericString={true}
                        onValueChange={onChangeNumeric}
                        allowNegative={false}
                        decimalScale={decimalScale}
                        decimalSeparator={decimalSeparator}
                        thousandSeparator={thousandSeparator}
                        displayType={'text'}
                        renderText={(value) => (
                            <SheetInputPrimitive
                                ref={ref}
                                value={value}
                                keyboardType={keyboardType}
                                onChangeText={onChangeHandler}
                                onSubmitEditing={onSubmitEditing}
                                style={style}
                                placeholder={placeholder}
                            />
                        )}
                    />
                ) : (
                    <SheetInputPrimitive
                        ref={ref}
                        defaultValue={defaultValue}
                        keyboardType={keyboardType}
                        onChangeText={onChangeText}
                        onSubmitEditing={onSubmitEditing}
                        style={style}
                        placeholder={placeholder}
                    />
                )}
            </>
        );
    },
);

SheetInputComponent.displayName = 'SheetInputComponent';

const BaseInput = forwardRef(
    (
        {
            label,
            value,
            valueType = 'text',
            keyboardType,
            numericThousandSeparator,
            numericDecimalScale,
            error,
            help,
            inputContainerStyle,
            inputStyle,
            onChange,
            asSheet = false,
            onSubmitEditing,
            placeholder,
            size,
            onFocus,
            onBlur,
        }: InputProps,
        ref: ForwardedRef<TextInput | ComponentRef<typeof BottomSheetTextInput>>,
    ) => {
        styles.useVariants({ size });

        const locale = useLocales();
        const { t } = useTranslation(['common']);

        const defaultValue = useMemo(() => {
            if (!value) {
                return undefined;
            }
            return String(value);
        }, [value]);

        const [inputValue, setInputValue] = useState<string | undefined>(defaultValue);

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

        const decimalScale = useMemo(() => {
            if (numericDecimalScale) {
                return numericDecimalScale;
            }
            if (valueType === 'decimal') {
                return 2;
            }
            return 0;
        }, [valueType, numericDecimalScale]);

        const onChangeText = (text: string) => {
            const value = valueToType(text, valueType);

            if (typeof value !== 'boolean') {
                if (!value && valueType === 'text') {
                    onChange(undefined);
                }
                if (!value && valueType === 'number') {
                    onChange(null);
                }
                if (!value && valueType === 'decimal') {
                    onChange(null);
                }

                if (value) {
                    onChange(value);
                }
            }
        };

        const onChangeNumeric = (values: NumberFormatValues) => {
            const numeric = getNumericValue(values.floatValue);
            onChange(numeric);
        };

        const onChangeHandler = (value: string) => {
            setInputValue(value);
        };

        const props = {
            defaultValue,
            inputValue,
            valueType,
            keyboardType,
            decimalScale,
            decimalSeparator,
            thousandSeparator,
            inputStyle,
            onChangeNumeric,
            onChangeHandler,
            onChangeText,
            onSubmitEditing,
            placeholder,
            onFocus,
            onBlur,
            style: [styles.input(!!error), inputStyle],
        };

        return (
            <VStack>
                {label && <Label>{label}</Label>}
                <InputContainer error={error} inputContainerStyle={inputContainerStyle} size={size}>
                    {asSheet ? (
                        <SheetInputComponent
                            {...props}
                            ref={ref as ForwardedRef<ComponentRef<typeof BottomSheetTextInput>>}
                        />
                    ) : (
                        <InputComponent {...props} ref={ref as ForwardedRef<TextInput>} />
                    )}
                </InputContainer>
                {error?.message && <Error>{t(error.message, { ns: 'common' })}</Error>}
                {help && !error && <Help>{help.message}</Help>}
            </VStack>
        );
    },
);

BaseInput.displayName = 'BaseInput';

export { BaseInput };
