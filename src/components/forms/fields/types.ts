import { TextInputProps, KeyboardTypeOptions } from 'react-native';
import { Control, FieldError, FieldPath, FieldValues, Merge } from 'react-hook-form';

import { BoxProps } from '@/components/primitives/box';
import { InputProps } from '@/components/primitives/input';

export type FieldValueType = 'text' | 'number' | 'decimal';

export type InputValueType = string | number | null;

export type OnChangeType = (value?: string | number | null) => void;

export interface InputType extends Pick<
    TextInputProps,
    'onSubmitEditing' | 'placeholder' | 'onFocus' | 'onBlur'
> {
    label?: string;
    value?: InputValueType;
    valueType?: FieldValueType;
    keyboardType?: KeyboardTypeOptions;
    numericThousandSeparator?: string;
    numericDecimalScale?: number;
    error?: Merge<FieldError, (FieldError | undefined)[]> | undefined;
    help?: {
        message: string;
    };
    inputContainerStyle?: BoxProps['style'];
    inputStyle?: InputProps['style'];
    asSheet?: boolean;
    prefix?: string;
    suffix?: string;
}

export interface ControlledInputType<
    T extends FieldValues = FieldValues,
    TName extends FieldPath<T> = FieldPath<T>,
> {
    control: Control<T>;
    name: TName;
}
