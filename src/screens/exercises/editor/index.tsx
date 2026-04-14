import { FC, Fragment, useEffect, useMemo } from 'react';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Container } from '@/screens/editor/components';
import { Box } from '@/components/primitives/box';
import { Input } from '@/components/forms/fields/input';
import { VStack } from '@/components/primitives/vstack';
import { Buttons } from '@/components/forms/fields/buttons';
import { Choices } from '@/components/forms/fields/choices';
import { Text } from '@/components/primitives/text';
import { Switch } from '@/components/forms/fields/switch';
import { Segmented } from '@/components/forms/fields/base/segmented';
import { Separator } from '@/components/layout/separator';
import { SheetChoices } from '@/components/forms/fields/sheet/choices';
import { useUser } from '@/hooks/use-user';
import { useAnalytics } from '@/hooks/use-analytics';
import { createExercise, isSkulptExercise } from '@/crud/exercise';
import { queryClient } from '@/queries';
import { Label } from '@/components/forms/label';
import { useExercise, useUpdateExercise } from '@/hooks/use-exercises';
import { ExerciseSelect } from '@/db/schema';
import { muscles, normalizeMuscleValues, sanitizeMuscleGroupSelections } from '@/constants/muscles';
import { reportError } from '@/services/error-reporting';

const tracking = [
    {
        value: ['weight', 'reps'],
    },
    {
        value: ['time'],
    },
    {
        value: ['reps'],
    },
    {
        value: ['time', 'reps'],
    },
    // {
    //     value: ['distance', 'time'],
    // },
    // {
    //     value: ['weight'],
    // },
    // {
    //     value: ['distance'],
    // },
    // {
    //     value: ['weight', 'time'],
    // },
    // {
    //     value: ['weight', 'distance'],
    // },
    // {
    //     value: ['distance', 'reps'],
    // },
    // {
    //     value: ['weight', 'time', 'reps'],
    // },
    // {
    //     value: ['weight', 'time', 'distance'],
    // },
    // {
    //     value: ['weight', 'reps', 'distance'],
    // },
    // {
    //     value: ['time', 'reps', 'distance'],
    // },
    // {
    //     value: ['weight', 'time', 'reps', 'distance'],
    // },
];

const normalizeMuscleSelectionForComparison = (
    value: string[] | null | undefined,
): string[] | null => {
    if (!Array.isArray(value) || value.length === 0) {
        return null;
    }

    return value;
};

const muscleSelectionsMatch = (
    left: string[] | null | undefined,
    right: string[] | null | undefined,
): boolean => {
    const normalizedLeft = normalizeMuscleSelectionForComparison(left);
    const normalizedRight = normalizeMuscleSelectionForComparison(right);

    if (!normalizedLeft && !normalizedRight) {
        return true;
    }

    if (!normalizedLeft || !normalizedRight) {
        return false;
    }

    return (
        normalizedLeft.length === normalizedRight.length &&
        normalizedLeft.every((value, index) => value === normalizedRight[index])
    );
};

const category = [
    {
        value: 'strength' as const,
    },
    {
        value: 'cardio' as const,
    },
    {
        value: 'flexibility' as const,
    },
    {
        value: 'yoga' as const,
    },
    {
        value: 'pilates' as const,
    },
    {
        value: 'other' as const,
    },
];

const weightUnits = [
    {
        value: 'kg',
    },
    {
        value: 'lb',
    },
];

const distanceUnits = [
    {
        value: 'km',
    },
    {
        value: 'mi',
    },
];

const distanceActivityType = [
    {
        value: 'outdoor_running',
    },
    {
        value: 'indoor_running',
    },
    {
        value: 'outdoor_walking',
    },
    {
        value: 'indoor_walking',
    },
    {
        value: 'stationary_bike',
    },
    {
        value: 'bike',
    },
    {
        value: 'elliptical',
    },
    {
        value: 'cardio',
    },
];

const timeOptions = [
    {
        value: 'log',
    },
    {
        value: 'timer',
    },
    {
        value: 'stopwatch',
    },
];

const normalizeTextValue = (value: string | null | undefined): string | null => {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const normalizeStringListValue = (
    value: string | null | undefined,
    splitPattern: RegExp,
): string[] | null => {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value
        .split(splitPattern)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);

    return normalized.length > 0 ? normalized : null;
};

const serializeStringListValue = (
    values: string[] | null | undefined,
    delimiter: string,
): string | null => {
    if (!Array.isArray(values) || values.length === 0) {
        return null;
    }

    return values.join(delimiter);
};

const styles = StyleSheet.create((theme) => ({
    fieldsContainer: {
        paddingHorizontal: theme.space(4),
        gap: theme.space(5),
    },
    fieldContainer: {
        gap: theme.space(3),
    },
    selectedDescriptionContainer: {
        gap: theme.space(2),
    },
    selectedDescriptionText: {
        color: theme.colors.typography,
        opacity: 0.6,
    },
    weightUnits: {
        borderBottomStartRadius: 0,
        borderBottomEndRadius: 0,
    },
    weightAssisted: {
        borderRadius: 0,
        borderTopWidth: 0,
    },
    weightDoubleInStats: {
        borderTopStartRadius: 0,
        borderTopEndRadius: 0,
        borderTopWidth: 0,
    },
    weightContainer: {
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius['4xl'],
        paddingVertical: theme.space(2),
    },
    weightSeparator: {
        marginHorizontal: theme.space(5),
    },
}));

const TrackingDescription: FC<{ index: number; description: string[] }> = ({
    index,
    description,
}) => {
    return (
        <VStack key={`desc-${index}`} style={styles.selectedDescriptionContainer}>
            {description.map((v, descIndex) => (
                <Fragment key={`desc-item-${descIndex}`}>
                    {descIndex !== 0 && <Separator />}
                    <Text style={styles.selectedDescriptionText} fontSize="sm">
                        {v}
                    </Text>
                </Fragment>
            ))}
        </VStack>
    );
};

const createExerciseSchema = z
    .object({
        name: z.string().min(1, 'errors.exercise.name.required'),
        category: z
            .enum(['strength', 'cardio', 'flexibility', 'yoga', 'pilates', 'other'])
            .refine((val) => val !== undefined, {
                message: 'errors.exercise.category.required',
            }),
        tracking: z
            .array(z.enum(['weight', 'reps', 'time', 'distance']))
            .min(1, 'errors.exercise.tracking.required'),

        weightUnits: z.enum(['kg', 'lb']).nullable(),
        weightAssisted: z.boolean().nullable(),
        weightDoubleInStats: z.boolean().nullable(),

        distanceUnits: z.enum(['km', 'mi']).nullable(),
        distanceActivityType: z
            .enum([
                'outdoor_running',
                'indoor_running',
                'outdoor_walking',
                'indoor_walking',
                'stationary_bike',
                'bike',
                'elliptical',
                'cardio',
            ])
            .nullable(),
        distanceTrackAW: z.boolean().nullable(),

        timeOptions: z.enum(['log', 'timer', 'stopwatch']).nullable(),
        timeHalfwayAlert: z.boolean().nullable(),

        primaryMuscleGroups: z.array(z.string()).nullable(),
        secondaryMuscleGroups: z.array(z.string()).nullable(),
        difficulty: z.enum(['beginner', 'intermediate', 'advanced']).nullable(),
        description: z.string().max(4000).optional().nullable(),
        equipmentText: z.string().max(4000).optional().nullable(),
        mistakesText: z.string().max(8000).optional().nullable(),
        instructionsText: z.string().max(8000).optional().nullable(),
    })
    .superRefine((data, ctx) => {
        const hasWeight = data.tracking.includes('weight');
        const hasTime = data.tracking.includes('time');
        const hasDistance = data.tracking.includes('distance');

        if (hasWeight) {
            if (data.weightUnits === null) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'errors.exercise.weightUnits.required',
                    path: ['weightUnits'],
                });
            }
            if (data.weightAssisted === null) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'errors.exercise.weightAssisted.required',
                    path: ['weightAssisted'],
                });
            }
            if (data.weightDoubleInStats === null) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'errors.exercise.weightDoubleInStats.required',
                    path: ['weightDoubleInStats'],
                });
            }
        }

        if (hasTime) {
            if (data.timeOptions === null) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'errors.exercise.timeOptions.required',
                    path: ['timeOptions'],
                });
            }
            if (data.timeHalfwayAlert === null) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'errors.exercise.timeHalfwayAlert.required',
                    path: ['timeHalfwayAlert'],
                });
            }
        }

        if (hasDistance) {
            if (data.distanceUnits === null) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'errors.exercise.distanceUnits.required',
                    path: ['distanceUnits'],
                });
            }
            if (data.distanceActivityType === null) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'errors.exercise.distanceActivityType.required',
                    path: ['distanceActivityType'],
                });
            }
            if (data.distanceTrackAW === null) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'errors.exercise.distanceTrackAW.required',
                    path: ['distanceTrackAW'],
                });
            }
        }

        const normalizedPrimary = normalizeMuscleValues(data.primaryMuscleGroups);
        const normalizedSecondary = normalizeMuscleValues(data.secondaryMuscleGroups);

        if (!muscleSelectionsMatch(data.primaryMuscleGroups, normalizedPrimary)) {
            ctx.addIssue({
                code: 'custom',
                message: 'errors.exercise.primaryMuscleGroups.invalidSelection',
                path: ['primaryMuscleGroups'],
            });
        }

        if (!muscleSelectionsMatch(data.secondaryMuscleGroups, normalizedSecondary)) {
            ctx.addIssue({
                code: 'custom',
                message: 'errors.exercise.secondaryMuscleGroups.invalidSelection',
                path: ['secondaryMuscleGroups'],
            });
        }

        if (muscleSelectionsMatch(data.secondaryMuscleGroups, normalizedSecondary)) {
            const sanitizedMuscleGroups = sanitizeMuscleGroupSelections({
                primary: normalizedPrimary,
                secondary: normalizedSecondary,
            });

            if (!muscleSelectionsMatch(normalizedSecondary, sanitizedMuscleGroups.secondary)) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'errors.exercise.secondaryMuscleGroups.overlapPrimary',
                    path: ['secondaryMuscleGroups'],
                });
            }
        }
    });

type CreateExerciseFormData = z.infer<typeof createExerciseSchema>;

interface ExerciseEditorProps {
    exerciseId?: string;
}

// Wrapper that waits for data to load before mounting the form.
// This eliminates the race condition between reset() and tracking useEffects.
const Editor: FC<ExerciseEditorProps> = ({ exerciseId }) => {
    const isEdit = Boolean(exerciseId);
    const { data: existingExercise, isLoading } = useExercise(exerciseId || '');

    if (isEdit && (isLoading || !existingExercise)) {
        return null;
    }

    return <EditorForm existingExercise={isEdit ? existingExercise : undefined} />;
};

interface EditorFormProps {
    existingExercise?: ExerciseSelect | null;
}

const EditorForm: FC<EditorFormProps> = ({ existingExercise }) => {
    const { user } = useUser();
    const { t } = useTranslation(['common', 'screens']);
    const { track } = useAnalytics();

    const isEdit = Boolean(existingExercise);
    const updateExerciseMutation = useUpdateExercise();

    const {
        control,
        handleSubmit,
        watch,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<CreateExerciseFormData>({
        resolver: zodResolver(createExerciseSchema),
        defaultValues: {
            name: existingExercise?.name ?? '',
            category: existingExercise?.category ?? undefined,
            tracking: Array.isArray(existingExercise?.tracking) ? existingExercise.tracking : [],
            weightUnits: existingExercise?.weightUnits ?? null,
            weightAssisted: existingExercise?.weightAssisted ?? null,
            weightDoubleInStats: existingExercise?.weightDoubleInStats ?? null,
            distanceUnits: existingExercise?.distanceUnits ?? null,
            distanceActivityType: existingExercise?.distanceActivityType ?? null,
            distanceTrackAW: existingExercise?.distanceTrackAW ?? null,
            timeOptions: existingExercise?.timeOptions ?? null,
            timeHalfwayAlert: existingExercise?.timeHalfwayAlert ?? null,
            primaryMuscleGroups:
                normalizeMuscleValues(existingExercise?.primaryMuscleGroups) ?? null,
            secondaryMuscleGroups:
                normalizeMuscleValues(existingExercise?.secondaryMuscleGroups) ?? null,
            difficulty:
                existingExercise?.difficulty === 'beginner' ||
                existingExercise?.difficulty === 'intermediate' ||
                existingExercise?.difficulty === 'advanced'
                    ? existingExercise.difficulty
                    : null,
            description: existingExercise?.description ?? null,
            equipmentText: serializeStringListValue(existingExercise?.equipment, ', '),
            mistakesText: serializeStringListValue(existingExercise?.mistakes, ', '),
            instructionsText: serializeStringListValue(existingExercise?.instructions, ', '),
        },
    });

    const createExerciseMutation = useMutation({
        mutationFn: createExercise,
        onSuccess: (created) => {
            queryClient.invalidateQueries({ queryKey: ['exercises-list'] });
            track('exercise:create', {
                category: created.category,
            });
            router.back();
        },
        onError: (error) => {
            reportError(error, 'Failed to create exercise:');
        },
    });

    const onSubmit = handleSubmit(async (payload: CreateExerciseFormData) => {
        if (!user) {
            return;
        }

        const normalizedMuscleGroups = sanitizeMuscleGroupSelections({
            primary: payload.primaryMuscleGroups,
            secondary: payload.secondaryMuscleGroups,
        });

        const normalizedPayload = {
            name: payload.name,
            category: payload.category,
            tracking: payload.tracking,
            weightUnits: payload.weightUnits,
            weightAssisted: payload.weightAssisted,
            weightDoubleInStats: payload.weightDoubleInStats,
            distanceUnits: payload.distanceUnits,
            distanceActivityType: payload.distanceActivityType,
            distanceTrackAW: payload.distanceTrackAW,
            timeOptions: payload.timeOptions,
            timeHalfwayAlert: payload.timeHalfwayAlert,
            primaryMuscleGroups: normalizedMuscleGroups.primary,
            secondaryMuscleGroups: normalizedMuscleGroups.secondary,
            difficulty: payload.difficulty,
            description: normalizeTextValue(payload.description),
            equipment: normalizeStringListValue(payload.equipmentText, /[,\n]+/),
            mistakes: normalizeStringListValue(payload.mistakesText, /[,\n]+/),
            instructions: normalizeStringListValue(payload.instructionsText, /[,\n]+/),
        };

        if (isEdit && existingExercise) {
            updateExerciseMutation.mutate(
                {
                    id: existingExercise.id,
                    updates: {
                        ...normalizedPayload,
                    },
                },
                {
                    onSuccess: (savedExercise) => {
                        if (
                            isSkulptExercise(existingExercise) &&
                            savedExercise.id !== existingExercise.id
                        ) {
                            router.replace(`/exercises/${savedExercise.id}`);
                            return;
                        }

                        router.back();
                    },
                },
            );
            return;
        }

        createExerciseMutation.mutate({
            userId: user.id,
            ...normalizedPayload,
        });
    });

    const handleClose = () => router.back();

    const trackingValue = watch('tracking');

    const selectedTracking = useMemo(() => trackingValue || [], [trackingValue]);

    const hasWeightTracking = selectedTracking.includes('weight');
    const hasTimeTracking = selectedTracking.includes('time');
    const hasDistanceTracking = selectedTracking.includes('distance');

    const muscleGroups = useMemo(() => {
        type MuscleNode = { value: string; choices?: MuscleNode[] };
        type NestedChoice = { value: string; title: string; children?: NestedChoice[] };

        const mapMuscleNodes = (nodes: MuscleNode[]): NestedChoice[] => {
            return nodes.map((node) => ({
                value: node.value,
                title: t(`muscleGroup.${node.value}`, { ns: 'common' }),
                children: node.choices?.length ? mapMuscleNodes(node.choices) : undefined,
            }));
        };

        return muscles.map((muscleGroup) => {
            if (muscleGroup.title) {
                return {
                    title: t(`muscleGroup.${muscleGroup.title}`, { ns: 'common' }),
                    choices: mapMuscleNodes(muscleGroup.choices),
                };
            }

            if (muscleGroup.value) {
                return {
                    choices: mapMuscleNodes([
                        {
                            value: muscleGroup.value,
                            choices: muscleGroup.choices,
                        },
                    ]),
                };
            }

            return {
                choices: mapMuscleNodes(muscleGroup.choices),
            };
        });
    }, [t]);

    useEffect(() => {
        if (!hasWeightTracking) {
            setValue('weightUnits', null);
            setValue('weightAssisted', null);
            setValue('weightDoubleInStats', null);
        } else if (!isEdit || (existingExercise && existingExercise.weightUnits === null)) {
            setValue('weightUnits', user?.weightUnits || 'kg');
            setValue('weightAssisted', false);
            setValue('weightDoubleInStats', false);
        }
    }, [hasWeightTracking, setValue, isEdit, existingExercise, user]);

    useEffect(() => {
        if (!hasTimeTracking) {
            setValue('timeOptions', null);
            setValue('timeHalfwayAlert', null);
        } else if (!isEdit || (existingExercise && existingExercise.timeHalfwayAlert === null)) {
            setValue('timeHalfwayAlert', false);
        }
    }, [hasTimeTracking, setValue, isEdit, existingExercise]);

    useEffect(() => {
        if (!hasDistanceTracking) {
            setValue('distanceUnits', null);
            setValue('distanceActivityType', null);
            setValue('distanceTrackAW', null);
        } else if (!isEdit || (existingExercise && existingExercise.distanceUnits === null)) {
            setValue('distanceUnits', user?.distanceUnits || 'km');
            setValue('distanceActivityType', 'outdoor_running');
            setValue('distanceTrackAW', false);
        }
    }, [hasDistanceTracking, setValue, isEdit, existingExercise, user]);

    return (
        <Container
            title={t(isEdit ? 'edit' : 'create', {
                ns: 'common',
            })}
            handleSubmit={onSubmit}
            handleClose={handleClose}
            loading={isSubmitting}
            submitDisabled={isSubmitting}
        >
            <Box style={styles.fieldsContainer}>
                <VStack style={styles.fieldContainer}>
                    <Label>{t('exercise-create.name', { ns: 'screens' })}</Label>
                    <Input control={control} name="name" valueType="text" error={errors.name} />
                </VStack>
                <VStack style={styles.fieldContainer}>
                    <Label>{t('exercise-create.category', { ns: 'screens' })}</Label>
                    <Buttons
                        control={control}
                        name="category"
                        choices={category.map((v) => ({
                            value: v.value,
                            title: t(`exerciseCategory.${v.value}`, { ns: 'common' }),
                        }))}
                        error={errors.category}
                    />
                </VStack>
                <VStack style={styles.fieldContainer}>
                    <Label>{t('exercise-create.tracking', { ns: 'screens' })}</Label>
                    <Choices
                        expandable
                        control={control}
                        name="tracking"
                        style="compact"
                        error={errors.tracking}
                        choices={tracking.map((v, index) => ({
                            value: v.value,
                            title: v.value
                                .map((v) => t(`exerciseTracking.${v}`, { ns: 'common' }))
                                .join(' + '),
                            description: (
                                <TrackingDescription
                                    index={index}
                                    description={
                                        t(`exerciseTrackingDescription.${v.value.join('+')}`, {
                                            ns: 'common',
                                            returnObjects: true,
                                        }) as string[]
                                    }
                                />
                            ),
                        }))}
                    />
                </VStack>
                {hasWeightTracking && (
                    <VStack style={styles.fieldContainer}>
                        <Label>{t('exercise-create.weight', { ns: 'screens' })}</Label>
                        <VStack style={styles.weightContainer}>
                            <Segmented
                                control={control}
                                name="weightUnits"
                                title={t('exercise-create.weightUnits', { ns: 'screens' })}
                                error={errors.weightUnits}
                                containerStyle={styles.weightUnits}
                                segments={weightUnits.map((v) => ({
                                    value: v.value,
                                    title: t(`weightUnit.${v.value}`, { ns: 'common' }),
                                }))}
                            />
                            <Separator style={styles.weightSeparator} />
                            <Switch
                                name="weightAssisted"
                                control={control}
                                title={t('exercise-create.weightAssisted', { ns: 'screens' })}
                                error={errors.weightAssisted}
                                containerStyle={styles.weightAssisted}
                            />
                            <Separator style={styles.weightSeparator} />
                            <Switch
                                name="weightDoubleInStats"
                                control={control}
                                title={t('exercise-create.weightDoubleInStats', { ns: 'screens' })}
                                error={errors.weightDoubleInStats}
                                containerStyle={styles.weightDoubleInStats}
                            />
                        </VStack>
                    </VStack>
                )}
                {hasDistanceTracking && (
                    <VStack style={styles.fieldContainer}>
                        <Label>{t('exercise-create.distance', { ns: 'screens' })}</Label>
                        <VStack style={styles.weightContainer}>
                            <Segmented
                                control={control}
                                name="distanceUnits"
                                title={t('exercise-create.distanceUnits', { ns: 'screens' })}
                                error={errors.distanceUnits}
                                containerStyle={styles.weightUnits}
                                segments={distanceUnits.map((v) => ({
                                    value: v.value,
                                    title: t(`distanceUnit.${v.value}`, { ns: 'common' }),
                                }))}
                            />
                            <Separator style={styles.weightSeparator} />
                            <SheetChoices
                                control={control}
                                name="distanceActivityType"
                                title={t('exercise-create.distanceActivityType', { ns: 'screens' })}
                                error={errors.distanceActivityType}
                                choices={distanceActivityType.map((v) => ({
                                    value: v.value,
                                    title: t(`distanceActivityType.${v.value}`, { ns: 'common' }),
                                }))}
                            />
                            <Separator style={styles.weightSeparator} />
                            <Switch
                                name="distanceTrackAW"
                                control={control}
                                title={t('exercise-create.distanceTrackAW', { ns: 'screens' })}
                                error={errors.distanceTrackAW}
                                containerStyle={styles.weightAssisted}
                            />
                        </VStack>
                    </VStack>
                )}
                {hasTimeTracking && (
                    <VStack style={styles.fieldContainer}>
                        <Label>{t('exercise-create.time', { ns: 'screens' })}</Label>
                        <VStack style={styles.weightContainer}>
                            <SheetChoices
                                control={control}
                                name="timeOptions"
                                title={t('exercise-create.timeOptions', { ns: 'screens' })}
                                error={errors.timeOptions}
                                choices={timeOptions.map((v) => ({
                                    value: v.value,
                                    title: t(`timeOption.${v.value}`, { ns: 'common' }),
                                }))}
                            />
                            <Separator style={styles.weightSeparator} />
                            <Switch
                                name="timeHalfwayAlert"
                                control={control}
                                title={t('exercise-create.timeHalfwayAlert', { ns: 'screens' })}
                                error={errors.timeHalfwayAlert}
                                containerStyle={styles.weightAssisted}
                            />
                        </VStack>
                    </VStack>
                )}
                <VStack style={styles.fieldContainer}>
                    <Label>{t('exercise-create.muscleGroups', { ns: 'screens' })}</Label>
                    <VStack style={styles.weightContainer}>
                        <SheetChoices
                            control={control}
                            name="primaryMuscleGroups"
                            title={t('exercise-create.primaryMuscleGroup', { ns: 'screens' })}
                            type="checkbox"
                            error={errors.primaryMuscleGroups}
                            groups={muscleGroups}
                        />
                        <Separator style={styles.weightSeparator} />
                        <SheetChoices
                            control={control}
                            name="secondaryMuscleGroups"
                            title={t('exercise-create.secondaryMuscleGroup', { ns: 'screens' })}
                            type="checkbox"
                            error={errors.secondaryMuscleGroups}
                            groups={muscleGroups}
                        />
                    </VStack>
                </VStack>
            </Box>
        </Container>
    );
};

export default Editor;
