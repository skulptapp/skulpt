import { useEffect, useCallback, useRef } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { ScrollView } from '@/components/primitives/scrollview';
import { Choices } from '@/components/forms/fields/choices';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { localeNames, supportedLanguages } from '@/locale/constants';
import { EditUserFormData, editUserSchema, useUser } from '@/hooks/use-user';
import { reportError } from '@/services/error-reporting';
import { markFormValuesSyncing, submitAutoSaveForm } from '../shared';
import { performSkulptSync } from '@/sync';
import { queryClient } from '@/queries';

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

const LanguageScreen = () => {
    const { user, updateUser } = useUser();

    const {
        control,
        handleSubmit,
        watch,
        reset,
        formState: { errors },
    } = useForm<EditUserFormData>({
        resolver: zodResolver(editUserSchema),
        defaultValues: {
            lng: user?.lng || 'en',
        },
    });

    const watchedLng = watch('lng');
    const isUserLoaded = user !== undefined;
    const userLng = user?.lng ?? 'en';
    const isSyncingFormRef = useRef(false);
    const isAutoSavingRef = useRef(false);

    const onSubmit = useCallback(
        async (data: EditUserFormData) => {
            try {
                await updateUser(data);

                if (data.lng && data.lng !== userLng) {
                    const fullSkulptReloadResult = await performSkulptSync({
                        locale: data.lng,
                        full: true,
                    });

                    if (fullSkulptReloadResult) {
                        queryClient.invalidateQueries({ queryKey: ['exercises-list'] });
                        queryClient.invalidateQueries({ queryKey: ['exercise'] });
                        queryClient.invalidateQueries({ queryKey: ['exercise-history'] });
                        queryClient.invalidateQueries({ queryKey: ['workout-details'] });
                        queryClient.invalidateQueries({ queryKey: ['workout-exercises'] });
                        queryClient.invalidateQueries({
                            queryKey: ['workout-exercises-with-exercise'],
                        });
                    }
                }
            } catch (error) {
                reportError(error, 'Failed to update user language:');
            }
        },
        [updateUser, userLng],
    );

    const submitCurrentValues = useCallback(() => {
        submitAutoSaveForm(
            isSyncingFormRef,
            isAutoSavingRef,
            handleSubmit,
            onSubmit,
            'Failed to submit language settings form:',
        );
    }, [handleSubmit, onSubmit]);

    useEffect(() => {
        if (!isUserLoaded) return;

        markFormValuesSyncing(isSyncingFormRef, () => {
            reset({ lng: userLng });
        });
    }, [isUserLoaded, userLng, reset]);

    useEffect(() => {
        if (isSyncingFormRef.current) return;

        if (isUserLoaded && watchedLng && watchedLng !== userLng) {
            submitCurrentValues();
        }
    }, [isUserLoaded, watchedLng, userLng, submitCurrentValues]);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Choices
                control={control}
                name="lng"
                choices={supportedLanguages.map((v) => ({
                    value: v,
                    title: localeNames[v],
                }))}
                error={errors.lng}
                selectPosition="right"
            />
        </ScrollView>
    );
};

export default LanguageScreen;
