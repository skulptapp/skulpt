import { useEffect, useCallback, useRef } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react-native';

import { ScrollView } from '@/components/primitives/scrollview';
import { Choices } from '@/components/forms/fields/choices';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { EditUserFormData, editUserSchema, useUser } from '@/hooks/use-user';
import { VStack } from '@/components/primitives/vstack';
import { Label } from '@/components/forms/label';
import { Text } from '@/components/primitives/text';
import { Box } from '@/components/primitives/box';
import { Title } from '@/components/typography/title';
import { reportError } from '@/services/error-reporting';
import {
    ChoiceOption,
    createTranslatedChoices,
    markFormValuesSyncing,
    submitAutoSaveForm,
} from '../shared';

const weightUnits: ChoiceOption<string>[] = [
    {
        value: 'kg',
        title: 'weightUnits.kg',
    },
    {
        value: 'lb',
        title: 'weightUnits.lb',
    },
];

const measurementUnits: ChoiceOption<string>[] = [
    {
        value: 'cm',
        title: 'measurementUnits.cm',
    },
    {
        value: 'in',
        title: 'measurementUnits.in',
    },
];

const distanceUnits: ChoiceOption<string>[] = [
    {
        value: 'km',
        title: 'distanceUnits.km',
    },
    {
        value: 'mi',
        title: 'distanceUnits.mi',
    },
];

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
    content: {
        ...theme.screenContentPadding('child'),
        gap: theme.space(5),
    },
    headerContainer: {
        padding: theme.space(5),
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius['4xl'],
        gap: theme.space(5),
    },
    headerTitleContainer: {
        gap: theme.space(2),
    },
    descriptionContainer: {
        gap: theme.space(5),
    },
    description: {
        fontSize: theme.fontSize.lg.fontSize,
        color: theme.colors.typography,
        opacity: 0.6,
    },
    iconContainer: {
        height: theme.space(15),
        width: theme.space(15),
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: rt.themeName === 'dark' ? theme.colors.white : theme.colors.neutral[950],
        borderRadius: theme.radius['2xl'],
        marginBottom: theme.space(2),
    },
    fieldContainer: {
        gap: theme.space(3),
    },
}));

const UnitsScreen = () => {
    const { user, updateUser } = useUser();
    const { t } = useTranslation(['common', 'screens']);
    const { theme, rt } = useUnistyles();

    const {
        control,
        handleSubmit,
        watch,
        reset,
        formState: { errors },
    } = useForm<EditUserFormData>({
        resolver: zodResolver(editUserSchema),
        defaultValues: {
            bodyWeightUnits: user?.bodyWeightUnits || 'kg',
            measurementUnits: user?.measurementUnits || 'cm',
            weightUnits: user?.weightUnits || 'kg',
            distanceUnits: user?.distanceUnits || 'km',
        },
    });

    const watchedBodyWeightUnits = watch('bodyWeightUnits');
    const watchedMeasurementUnits = watch('measurementUnits');
    const watchedWeightUnits = watch('weightUnits');
    const watchedDistanceUnits = watch('distanceUnits');
    const isUserLoaded = user !== undefined;
    const userBodyWeightUnits = user?.bodyWeightUnits ?? 'kg';
    const userMeasurementUnits = user?.measurementUnits ?? 'cm';
    const userWeightUnits = user?.weightUnits ?? 'kg';
    const userDistanceUnits = user?.distanceUnits ?? 'km';
    const isSyncingFormRef = useRef(false);
    const isAutoSavingRef = useRef(false);

    const onSubmit = useCallback(
        async (data: EditUserFormData) => {
            try {
                await updateUser(data);
            } catch (error) {
                reportError(error, 'Failed to update user units:');
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
            'Failed to submit unit settings form:',
        );
    }, [handleSubmit, onSubmit]);

    useEffect(() => {
        if (!isUserLoaded) return;

        markFormValuesSyncing(isSyncingFormRef, () => {
            reset({
                bodyWeightUnits: userBodyWeightUnits,
                measurementUnits: userMeasurementUnits,
                weightUnits: userWeightUnits,
                distanceUnits: userDistanceUnits,
            });
        });
    }, [
        isUserLoaded,
        userBodyWeightUnits,
        userMeasurementUnits,
        userWeightUnits,
        userDistanceUnits,
        reset,
    ]);

    useEffect(() => {
        if (isSyncingFormRef.current) return;

        if (
            isUserLoaded &&
            watchedBodyWeightUnits &&
            watchedBodyWeightUnits !== userBodyWeightUnits
        ) {
            submitCurrentValues();
        }
        if (
            isUserLoaded &&
            watchedMeasurementUnits &&
            watchedMeasurementUnits !== userMeasurementUnits
        ) {
            submitCurrentValues();
        }
        if (isUserLoaded && watchedWeightUnits && watchedWeightUnits !== userWeightUnits) {
            submitCurrentValues();
        }
        if (isUserLoaded && watchedDistanceUnits && watchedDistanceUnits !== userDistanceUnits) {
            submitCurrentValues();
        }
    }, [
        isUserLoaded,
        watchedBodyWeightUnits,
        watchedMeasurementUnits,
        watchedWeightUnits,
        watchedDistanceUnits,
        userBodyWeightUnits,
        userMeasurementUnits,
        userWeightUnits,
        userDistanceUnits,
        submitCurrentValues,
    ]);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <VStack style={styles.headerContainer}>
                <VStack style={styles.headerTitleContainer}>
                    <Box style={styles.iconContainer}>
                        <Languages
                            size={theme.space(8)}
                            strokeWidth={theme.space(0.375)}
                            color={
                                rt.themeName === 'dark'
                                    ? theme.colors.neutral[950]
                                    : theme.colors.white
                            }
                        />
                    </Box>
                    <Box>
                        <Title type="h3">{t('units.title', { ns: 'screens' })}</Title>
                    </Box>
                    <VStack style={styles.descriptionContainer}>
                        <Text style={styles.description}>
                            {t('units.description', { ns: 'screens' })}
                        </Text>
                        <Text style={styles.description}>
                            {t('units.exerciseUnits', { ns: 'screens' })}
                        </Text>
                    </VStack>
                </VStack>
            </VStack>
            <VStack style={styles.fieldContainer}>
                <Label>{t('units.bodyWeightUnits', { ns: 'screens' })}</Label>
                <Choices
                    control={control}
                    name="bodyWeightUnits"
                    choices={createTranslatedChoices(weightUnits, t)}
                    error={errors.bodyWeightUnits}
                    selectPosition="right"
                />
            </VStack>
            <VStack style={styles.fieldContainer}>
                <Label>{t('units.measurementUnits', { ns: 'screens' })}</Label>
                <Choices
                    control={control}
                    name="measurementUnits"
                    choices={createTranslatedChoices(measurementUnits, t)}
                    error={errors.measurementUnits}
                    selectPosition="right"
                />
            </VStack>
            <VStack style={styles.fieldContainer}>
                <Label>{t('units.weightUnits', { ns: 'screens' })}</Label>
                <Choices
                    control={control}
                    name="weightUnits"
                    choices={createTranslatedChoices(weightUnits, t)}
                    error={errors.weightUnits}
                    selectPosition="right"
                />
            </VStack>
            <VStack style={styles.fieldContainer}>
                <Label>{t('units.distanceUnits', { ns: 'screens' })}</Label>
                <Choices
                    control={control}
                    name="distanceUnits"
                    choices={createTranslatedChoices(distanceUnits, t)}
                    error={errors.distanceUnits}
                    selectPosition="right"
                />
            </VStack>
        </ScrollView>
    );
};

export default UnitsScreen;
