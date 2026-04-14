import { createElement } from 'react';
import { FieldPath, FieldValues, PathValue, useController } from 'react-hook-form';

import { BaseInput } from '../base/input';
import { SheetInput } from '../sheet/input';
import type { InputType as InputBaseType, ControlledInputType, InputValueType } from '../types';

type InputType<
    T extends FieldValues = FieldValues,
    TName extends FieldPath<T> = FieldPath<T>,
> = Omit<InputBaseType, 'value'> &
    ControlledInputType<T, TName> & {
        value?: PathValue<T, TName>;
    };

function Input<T extends FieldValues, TName extends FieldPath<T>>({
    control,
    label,
    name,
    value: defaultValue,
    valueType,
    keyboardType,
    error,
    help,
    inputContainerStyle,
    inputStyle,
    asSheet,
    prefix,
    suffix,
    numericThousandSeparator,
    placeholder,
}: InputType<T, TName>) {
    const {
        field: { onChange, value },
    } = useController({ name, control, defaultValue });

    return createElement(asSheet ? SheetInput : BaseInput, {
        label,
        value: value as InputValueType,
        valueType,
        keyboardType,
        error,
        help,
        inputContainerStyle,
        inputStyle,
        onChange,
        prefix,
        suffix,
        asSheet,
        title: label,
        numericThousandSeparator,
        placeholder,
    });
}

export { Input };
