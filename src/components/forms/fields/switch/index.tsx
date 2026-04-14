import { FieldPath, FieldValues, PathValue, useController } from 'react-hook-form';

import { SwitchType as SwitchBaseType, Switch as SwitchBase } from '../base/switch';
import { ControlledInputType } from '../types';

type SwitchType<
    T extends FieldValues = FieldValues,
    TName extends FieldPath<T> = FieldPath<T>,
> = Omit<SwitchBaseType, 'onChange' | 'value'> &
    ControlledInputType<T, TName> & {
        value?: PathValue<T, TName>;
    };

function Switch<T extends FieldValues, TName extends FieldPath<T>>({
    name,
    control,
    value: defaultValue,
    title,
    description,
    containerStyle,
    error,
}: SwitchType<T, TName>) {
    const {
        field: { onChange, value },
    } = useController({ name, control, defaultValue });

    return (
        <SwitchBase
            value={value as boolean | undefined}
            onChange={onChange}
            title={title}
            description={description}
            containerStyle={containerStyle}
            error={error}
        />
    );
}

export { Switch };
