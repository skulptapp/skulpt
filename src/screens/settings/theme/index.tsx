import { useEffect, useCallback, useRef } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { ScrollView } from '@/components/primitives/scrollview';
import { Choices } from '@/components/forms/fields/choices';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { EditUserFormData, editUserSchema, themes, useUser } from '@/hooks/use-user';
import { reportError } from '@/services/error-reporting';
import { markFormValuesSyncing, submitAutoSaveForm } from '../shared';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
    content: {
        ...theme.screenContentPadding('child'),
        gap: theme.space(5),
    },
}));

const ThemeScreen = () => {
    const { user, updateUser } = useUser();
    const { t } = useTranslation('screens');

    const {
        control,
        handleSubmit,
        watch,
        reset,
        formState: { errors },
    } = useForm<EditUserFormData>({
        resolver: zodResolver(editUserSchema),
        defaultValues: {
            theme: user?.theme || 'dark',
        },
    });

    const watchedTheme = watch('theme');
    const isUserLoaded = user !== undefined;
    const userTheme = user?.theme ?? 'dark';
    const isSyncingFormRef = useRef(false);
    const isAutoSavingRef = useRef(false);

    const onSubmit = useCallback(
        async (data: EditUserFormData) => {
            try {
                await updateUser(data);
            } catch (error) {
                reportError(error, 'Failed to update user theme:');
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
            'Failed to submit theme settings form:',
        );
    }, [handleSubmit, onSubmit]);

    useEffect(() => {
        if (!isUserLoaded) return;

        markFormValuesSyncing(isSyncingFormRef, () => {
            reset({ theme: userTheme });
        });
    }, [isUserLoaded, userTheme, reset]);

    useEffect(() => {
        if (isSyncingFormRef.current) return;

        if (isUserLoaded && watchedTheme && watchedTheme !== userTheme) {
            submitCurrentValues();
        }
    }, [isUserLoaded, watchedTheme, userTheme, submitCurrentValues]);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Choices
                control={control}
                name="theme"
                choices={themes.map((v) => ({
                    value: v,
                    title: t(`settings.items.theme.${v}`),
                }))}
                error={errors.theme}
                selectPosition="right"
            />
        </ScrollView>
    );
};

export default ThemeScreen;
