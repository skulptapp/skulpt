import React from 'react';
import { FieldPath, FieldValues, PathValue, useController } from 'react-hook-form';

import { ControlledInputType } from '../types';
import { BaseButtons, BaseButtonsFieldType } from '../base/buttons';

type ButtonsFieldType<
    T extends FieldValues = FieldValues,
    TName extends FieldPath<T> = FieldPath<T>,
> = Omit<BaseButtonsFieldType, 'onChange' | 'value'> &
    ControlledInputType<T, TName> & {
        value?: PathValue<T, TName>;
    };

function Buttons<T extends FieldValues, TName extends FieldPath<T>>({
    control,
    name,
    label,
    type = 'radio',
    choices,
    value: defaultValue,
    error,
}: ButtonsFieldType<T, TName>) {
    const {
        field: { onChange, value },
    } = useController({ name, control, defaultValue });

    return (
        <BaseButtons
            label={label}
            type={type}
            choices={choices}
            value={value as BaseButtonsFieldType['value']}
            error={error}
            onChange={onChange}
        />
    );
}

export { Buttons };
