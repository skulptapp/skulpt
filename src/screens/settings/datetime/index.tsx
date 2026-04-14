import { useEffect, useCallback, useRef } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { ScrollView } from '@/components/primitives/scrollview';
import { Choices } from '@/components/forms/fields/choices';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { EditUserFormData, editUserSchema, useUser } from '@/hooks/use-user';
import { VStack } from '@/components/primitives/vstack';
import { Label } from '@/components/forms/label';
import { reportError } from '@/services/error-reporting';
import {
    ChoiceOption,
    createTranslatedChoices,
    markFormValuesSyncing,
    submitAutoSaveForm,
} from '../shared';

const firstWeekdayChoices: ChoiceOption<number>[] = [
    {
        value: 1,
        title: 'weekday.sunday',
    },
    {
        value: 2,
        title: 'weekday.monday',
    },
];

const timeFormatChoices: ChoiceOption<string>[] = [
    {
        value: '12h',
        title: 'timeFormat.12h',
    },
    {
        value: '24h',
        title: 'timeFormat.24h',
    },
];

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
    content: {
        ...theme.screenContentPadding('child'),
        gap: theme.space(5),
    },
    fieldContainer: {
        gap: theme.space(3),
    },
}));

const DateTimeScreen = () => {
    const { user, updateUser } = useUser();
    const { t } = useTranslation(['common', 'screens']);

    const {
        control,
        handleSubmit,
        watch,
        reset,
        formState: { errors },
    } = useForm<EditUserFormData>({
        resolver: zodResolver(editUserSchema),
        defaultValues: {
            firstWeekday: user?.firstWeekday || 2,
            timeFormat: user?.timeFormat || '24h',
        },
    });

    const watchedFirstWeekday = watch('firstWeekday');
    const watchedTimeFormat = watch('timeFormat');
    const isUserLoaded = user !== undefined;
    const userFirstWeekday = user?.firstWeekday ?? 2;
    const userTimeFormat = user?.timeFormat ?? '24h';
    const isSyncingFormRef = useRef(false);
    const isAutoSavingRef = useRef(false);

    const onSubmit = useCallback(
        async (data: EditUserFormData) => {
            try {
                await updateUser(data);
            } catch (error) {
                reportError(error, 'Failed to update date/time settings:');
            }
        },
        [updateUser],
    );

    const submitCurrentValues = useCallback(() => {
        submitAutoSaveForm(
            isSyncingFormRef,
            isAutoSavingRef,
            handleSubmit,
            onSubmit,
            'Failed to submit date/time settings form:',
        );
    }, [handleSubmit, onSubmit]);

    useEffect(() => {
        if (!isUserLoaded) return;

        markFormValuesSyncing(isSyncingFormRef, () => {
            reset({
                firstWeekday: userFirstWeekday,
                timeFormat: userTimeFormat,
            });
        });
    }, [isUserLoaded, userFirstWeekday, userTimeFormat, reset]);

    useEffect(() => {
        if (isSyncingFormRef.current) return;

        if (
            isUserLoaded &&
            watchedFirstWeekday !== undefined &&
            watchedFirstWeekday !== userFirstWeekday
        ) {
            submitCurrentValues();
        }
        if (isUserLoaded && watchedTimeFormat && watchedTimeFormat !== userTimeFormat) {
            submitCurrentValues();
        }
    }, [
        isUserLoaded,
        watchedFirstWeekday,
        watchedTimeFormat,
        userFirstWeekday,
        userTimeFormat,
        submitCurrentValues,
    ]);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <VStack style={styles.fieldContainer}>
                <Label>{t('datetime.firstWeekday', { ns: 'screens' })}</Label>
                <Choices
                    control={control}
                    name="firstWeekday"
                    choices={createTranslatedChoices(firstWeekdayChoices, t)}
                    error={errors.firstWeekday}
                    selectPosition="right"
                />
            </VStack>
            <VStack style={styles.fieldContainer}>
                <Label>{t('datetime.timeFormat', { ns: 'screens' })}</Label>
                <Choices
                    control={control}
                    name="timeFormat"
                    choices={createTranslatedChoices(timeFormatChoices, t)}
                    error={errors.timeFormat}
                    selectPosition="right"
                />
            </VStack>
        </ScrollView>
    );
};

export default DateTimeScreen;
