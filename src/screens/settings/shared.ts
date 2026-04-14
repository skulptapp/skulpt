import { FieldValues, UseFormHandleSubmit } from 'react-hook-form';

import { runInBackground } from '@/services/error-reporting';

type BooleanRef = {
    current: boolean;
};

type TranslationFn = (key: string, options?: { ns?: string }) => string;

export type ChoiceOption<T extends string | number> = {
    value: T;
    title: string;
};

export const markFormValuesSyncing = (isSyncingRef: BooleanRef, sync: () => void): void => {
    isSyncingRef.current = true;
    sync();
    queueMicrotask(() => {
        isSyncingRef.current = false;
    });
};

export const submitAutoSaveForm = <TFieldValues extends FieldValues>(
    isSyncingRef: BooleanRef,
    isAutoSavingRef: BooleanRef,
    handleSubmit: UseFormHandleSubmit<TFieldValues>,
    onSubmit: (data: TFieldValues) => Promise<void>,
    errorContext: string,
): void => {
    if (isSyncingRef.current || isAutoSavingRef.current) return;

    isAutoSavingRef.current = true;

    runInBackground(
        () =>
            handleSubmit(
                async (data) => {
                    try {
                        await onSubmit(data);
                    } finally {
                        isAutoSavingRef.current = false;
                    }
                },
                () => {
                    isAutoSavingRef.current = false;
                },
            )(),
        errorContext,
    );
};

export const createTranslatedChoices = <T extends string | number>(
    options: readonly ChoiceOption<T>[],
    t: TranslationFn,
): ChoiceOption<T>[] => {
    return options.map((option) => {
        const translatedTitle = t(option.title, { ns: 'common' });

        return {
            value: option.value,
            title: translatedTitle.charAt(0).toUpperCase() + translatedTitle.slice(1),
        };
    });
};
