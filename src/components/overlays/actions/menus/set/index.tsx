import { FC, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useShallow } from 'zustand/react/shallow';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useActionsStore } from '@/stores/actions';
import { useUpdateExerciseSet } from '@/hooks/use-workouts';
import { normalizeSetType } from '@/helpers/set-type';
import { Choices, ValueType } from '@/components/forms/fields/choices';

const SET_TYPES = ['working', 'warmup', 'dropset', 'failure'] as const;
type SetType = (typeof SET_TYPES)[number];
type SetTypeForm = { type: SetType };

const styles = StyleSheet.create((theme, rt) => ({
    choicesContainer: {
        backgroundColor:
            rt.themeName === 'dark' ? theme.colors.neutral[925] : theme.colors.background,
    },
}));

export const SetMenu: FC = () => {
    const { t } = useTranslation(['common']);
    const { theme, rt } = useUnistyles();
    const choicesBackgroundColor =
        rt.themeName === 'dark' ? theme.colors.neutral[925] : theme.colors.background;
    const { control, reset } = useForm<SetTypeForm>({
        defaultValues: {
            type: 'working',
        },
    });

    const { close, payload } = useActionsStore(
        useShallow((state) => ({
            close: state.close,
            payload: state.payload,
        })),
    );

    const { mutateAsync: updateSet } = useUpdateExerciseSet();

    useEffect(() => {
        if (!payload || !('setId' in payload)) return;
        reset({ type: payload.setType });
    }, [payload, reset]);

    const handleSelectType = useCallback(
        (value: ValueType) => {
            if (!payload || !('setId' in payload)) return;
            if (typeof value !== 'string') return;

            const nextType = normalizeSetType(value);
            if (nextType === payload.setType) {
                close();
                return;
            }

            void updateSet({
                id: payload.setId,
                updates: { type: nextType },
            }).then(() => close());
        },
        [close, payload, updateSet],
    );

    if (!payload || !('setId' in payload)) return null;

    return (
        <Choices
            control={control}
            name="type"
            choices={SET_TYPES.map((setType) => ({
                value: setType,
                title: t(`setType.${setType}`, { ns: 'common' }),
            }))}
            containerStyle={styles.choicesContainer}
            uncheckedIndicatorBackgroundColor={choicesBackgroundColor}
            selectPosition="left"
            onChange={handleSelectType}
        />
    );
};
