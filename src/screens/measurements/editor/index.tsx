import { FC, useEffect, useMemo, useRef } from 'react';
import { router } from 'expo-router';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';

import { Container } from '@/screens/editor/components';
import { Box } from '@/components/primitives/box';
import { VStack } from '@/components/primitives/vstack';
import { Label } from '@/components/forms/label';
import { Datetime } from '@/components/forms/fields/datetime';
import { NumericStepperField } from '@/components/primitives/numeric-stepper-field';
import { convertWeight } from '@/helpers/units';
import { useCreateMeasurements, useLatestMeasurementsByMetric } from '@/hooks/use-measurements';
import { useUser } from '@/hooks/use-user';
import { reportError } from '@/services/error-reporting';

type MeasurementEditorFormData = {
    weight: number;
    recordedAt: Date;
};

const styles = StyleSheet.create((theme) => ({
    fieldsContainer: {
        paddingHorizontal: theme.space(4),
        gap: theme.space(10),
    },
    fieldContainer: {
        gap: theme.space(2),
    },
    weightLabel: {
        textAlign: 'center',
    },
    dateFieldWrapper: {
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius['4xl'],
        paddingVertical: theme.space(2),
    },
}));

const MeasurementEditor: FC = () => {
    const { t } = useTranslation(['common', 'screens']);
    const { user } = useUser();
    const createMeasurementsMutation = useCreateMeasurements();
    const latestByMetric = useLatestMeasurementsByMetric(['body_weight']);
    const initialWeightAppliedRef = useRef(false);
    const displayWeightUnit = user?.bodyWeightUnits ?? 'kg';

    const { control, formState, setValue, handleSubmit } = useForm<MeasurementEditorFormData>({
        defaultValues: {
            weight: 0,
            recordedAt: new Date(),
        },
    });

    const watchedWeight = useWatch({ control, name: 'weight' }) ?? 0;
    const latestWeightMeasurement = latestByMetric['body_weight'];

    useEffect(() => {
        if (initialWeightAppliedRef.current) {
            return;
        }

        if (formState.dirtyFields.weight) {
            initialWeightAppliedRef.current = true;
            return;
        }

        if (latestWeightMeasurement === undefined) {
            return;
        }

        const latestInDisplayUnit =
            latestWeightMeasurement == null
                ? 0
                : latestWeightMeasurement.unit === displayWeightUnit
                  ? latestWeightMeasurement.value
                  : latestWeightMeasurement.unit === 'kg' && displayWeightUnit === 'lb'
                    ? convertWeight(latestWeightMeasurement.value, 'kg', 'lb')
                    : latestWeightMeasurement.unit === 'lb' && displayWeightUnit === 'kg'
                      ? convertWeight(latestWeightMeasurement.value, 'lb', 'kg')
                      : latestWeightMeasurement.value;

        setValue('weight', Math.max(0, Number(latestInDisplayUnit.toFixed(1))), {
            shouldDirty: false,
            shouldTouch: false,
            shouldValidate: true,
        });

        initialWeightAppliedRef.current = true;
    }, [displayWeightUnit, formState.dirtyFields.weight, latestWeightMeasurement, setValue]);

    const canSubmit = useMemo(() => {
        return (
            !!user?.id &&
            !createMeasurementsMutation.isPending &&
            Number.isFinite(watchedWeight) &&
            watchedWeight > 0
        );
    }, [createMeasurementsMutation.isPending, watchedWeight, user?.id]);

    const onSubmit = handleSubmit(async (payload) => {
        if (!user?.id || !canSubmit || payload.weight <= 0) {
            return;
        }

        const recordedAt = payload.recordedAt ?? new Date();
        const weightInKg =
            displayWeightUnit === 'lb' ? convertWeight(payload.weight, 'lb', 'kg') : payload.weight;

        const measurements = [
            {
                metric: 'body_weight',
                value: weightInKg,
                unit: 'kg',
                recordedAt,
                source: 'manual' as const,
            },
        ];

        try {
            await createMeasurementsMutation.mutateAsync(measurements);
            router.back();
        } catch (error) {
            reportError(error, 'Failed to create manual weight log entry from editor:');
        }
    });

    return (
        <Container
            title={t('results.scale.actions.weighIn', { ns: 'screens' })}
            buttonLabel={t('results.scale.actions.log', { ns: 'screens' })}
            handleClose={() => router.back()}
            handleSubmit={onSubmit}
            loading={createMeasurementsMutation.isPending}
            submitDisabled={!canSubmit}
        >
            <Box style={styles.fieldsContainer}>
                <VStack style={styles.fieldContainer}>
                    <Label style={styles.weightLabel}>
                        {t('results.scale.modal.weight', { ns: 'screens' })}
                    </Label>
                    <NumericStepperField
                        value={watchedWeight}
                        unit={displayWeightUnit}
                        modalTitle={t('results.scale.modal.weight', { ns: 'screens' })}
                        onChange={(nextWeight) =>
                            setValue('weight', nextWeight, {
                                shouldDirty: true,
                                shouldTouch: true,
                                shouldValidate: true,
                            })
                        }
                    />
                </VStack>

                <VStack style={styles.fieldContainer}>
                    <VStack style={styles.dateFieldWrapper}>
                        <Datetime
                            control={control}
                            name="recordedAt"
                            mode="datetime"
                            title={t('results.scale.modal.date', { ns: 'screens' })}
                            maximumDate={new Date()}
                        />
                    </VStack>
                </VStack>
            </Box>
        </Container>
    );
};

export default MeasurementEditor;
