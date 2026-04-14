import { useEffect, useCallback, useMemo, useRef } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react-native';

import { ScrollView } from '@/components/primitives/scrollview';
import { Choices } from '@/components/forms/fields/choices';
import { Datetime } from '@/components/forms/fields/datetime';
import { Input } from '@/components/forms/fields/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { EditUserFormData, editUserSchema, useUser } from '@/hooks/use-user';
import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { Label } from '@/components/forms/label';
import { Text } from '@/components/primitives/text';
import { Box } from '@/components/primitives/box';
import { Title } from '@/components/typography/title';
import {
    calculateAge,
    calculateMHR,
    getZoneDefinitions,
    type MhrFormula,
} from '@/helpers/heart-rate-zones';
import { readBiologicalSex, readDateOfBirth } from '@/services/health';
import { reportError, runInBackground } from '@/services/error-reporting';
import { markFormValuesSyncing } from '../shared';

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
    fieldWrapper: {
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius['4xl'],
        paddingVertical: theme.space(2),
    },
    description: {
        fontSize: theme.fontSize.lg.fontSize,
        color: theme.colors.typography,
        opacity: 0.6,
    },
    infoCard: {
        padding: theme.space(5),
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius['4xl'],
        gap: theme.space(3),
    },
    infoRow: {
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    infoLabel: {
        color: theme.colors.typography,
        opacity: 0.6,
    },
    infoValue: {
        color: theme.colors.typography,
        fontWeight: theme.fontWeight.semibold.fontWeight,
    },
    zoneDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
    },
}));

const HeartRateScreen = () => {
    const { user, updateUser } = useUser();
    const { t } = useTranslation(['common', 'screens']);
    const { theme, rt } = useUnistyles();

    const formulaChoices = useMemo(
        () => [
            { value: 'nes', title: t('heartrate.formulas.nes', { ns: 'screens' }) },
            { value: 'fox', title: t('heartrate.formulas.fox', { ns: 'screens' }) },
            { value: 'tanaka', title: t('heartrate.formulas.tanaka', { ns: 'screens' }) },
            { value: 'inbar', title: t('heartrate.formulas.inbar', { ns: 'screens' }) },
            { value: 'gulati', title: t('heartrate.formulas.gulati', { ns: 'screens' }) },
            {
                value: 'gellish',
                title: t('heartrate.formulas.gellishLegacy', { ns: 'screens' }),
            },
            { value: 'manual', title: t('heartrate.formulas.manual', { ns: 'screens' }) },
        ],
        [t],
    );
    const biologicalSexChoices = useMemo(
        () => [
            { value: null, title: t('heartrate.unset', { ns: 'screens' }) },
            {
                value: 'female',
                title: t('heartrate.biologicalSexOptions.female', { ns: 'screens' }),
            },
            {
                value: 'male',
                title: t('heartrate.biologicalSexOptions.male', { ns: 'screens' }),
            },
            {
                value: 'other',
                title: t('heartrate.biologicalSexOptions.other', { ns: 'screens' }),
            },
        ],
        [t],
    );
    const activityLevelChoices = useMemo(
        () => [
            { value: null, title: t('heartrate.unset', { ns: 'screens' }) },
            {
                value: 'sedentary',
                title: t('heartrate.activityLevelOptions.sedentary', { ns: 'screens' }),
            },
            {
                value: 'active',
                title: t('heartrate.activityLevelOptions.active', { ns: 'screens' }),
            },
            {
                value: 'trained',
                title: t('heartrate.activityLevelOptions.trained', { ns: 'screens' }),
            },
        ],
        [t],
    );

    const {
        control,
        watch,
        setValue,
        trigger,
        reset,
        formState: { errors },
    } = useForm<EditUserFormData>({
        resolver: zodResolver(editUserSchema),
        defaultValues: {
            mhrFormula: user?.mhrFormula ?? 'nes',
            mhrManualValue: user?.mhrManualValue ?? null,
            birthday: user?.birthday ?? null,
            biologicalSex: user?.biologicalSex ?? null,
            activityLevel: user?.activityLevel ?? null,
        },
    });

    const watchedFormula = watch('mhrFormula');
    const watchedManualValue = watch('mhrManualValue');
    const watchedBirthday = watch('birthday');
    const watchedBiologicalSex = watch('biologicalSex');
    const watchedActivityLevel = watch('activityLevel');
    const isUserLoaded = user !== undefined;
    const userFormula = user?.mhrFormula ?? 'nes';
    const userManualValue = user?.mhrManualValue ?? null;
    const userBirthday = user?.birthday ?? null;
    const userBiologicalSex = user?.biologicalSex ?? null;
    const userActivityLevel = user?.activityLevel ?? null;
    const userBirthdayTimestamp = user?.birthday?.getTime() ?? null;
    const watchedBirthdayTimestamp = watchedBirthday?.getTime() ?? null;

    const isSyncingFormRef = useRef(false);
    const isAutoSavingRef = useRef(false);

    const savePatch = useCallback(
        async (patch: EditUserFormData) => {
            if (isSyncingFormRef.current || isAutoSavingRef.current) return;

            isAutoSavingRef.current = true;
            try {
                await updateUser(patch);
            } catch (error) {
                reportError(error, 'Failed to update heart rate settings:');
            } finally {
                isAutoSavingRef.current = false;
            }
        },
        [updateUser],
    );

    useEffect(() => {
        if (!isUserLoaded) return;

        markFormValuesSyncing(isSyncingFormRef, () => {
            reset({
                mhrFormula: userFormula,
                mhrManualValue: userManualValue,
                birthday: userBirthday,
                biologicalSex: userBiologicalSex,
                activityLevel: userActivityLevel,
            });
        });
    }, [
        isUserLoaded,
        userFormula,
        userManualValue,
        userBirthday,
        userBirthdayTimestamp,
        userBiologicalSex,
        userActivityLevel,
        reset,
    ]);

    // Auto-fetch profile details from HealthKit if not set
    const fetchedProfileRef = useRef(false);
    useEffect(() => {
        if (fetchedProfileRef.current || !isUserLoaded) return;
        if (userBirthday && userBiologicalSex) return;

        fetchedProfileRef.current = true;

        runInBackground(async () => {
            const [dob, biologicalSex] = await Promise.all([
                userBirthday ? Promise.resolve(null) : readDateOfBirth(),
                userBiologicalSex ? Promise.resolve(null) : readBiologicalSex(),
            ]);

            if (!dob && !biologicalSex) return;

            isSyncingFormRef.current = true;
            const patch: EditUserFormData = {};

            if (dob) {
                setValue('birthday', dob, { shouldDirty: false });
                patch.birthday = dob;
            }
            if (biologicalSex) {
                setValue('biologicalSex', biologicalSex, { shouldDirty: false });
                patch.biologicalSex = biologicalSex;
            }

            queueMicrotask(() => {
                isSyncingFormRef.current = false;
                runInBackground(
                    () => savePatch(patch),
                    'Failed to persist hydrated heart rate profile settings:',
                );
            });
        }, 'Failed to hydrate heart rate profile from Health data:');
    }, [isUserLoaded, userBirthday, userBiologicalSex, savePatch, setValue]);

    useEffect(() => {
        if (isSyncingFormRef.current) return;
        if (isUserLoaded && watchedFormula && watchedFormula !== userFormula) {
            runInBackground(
                () => savePatch({ mhrFormula: watchedFormula }),
                'Failed to save heart rate formula:',
            );
        }
    }, [isUserLoaded, watchedFormula, userFormula, savePatch]);

    useEffect(() => {
        if (isSyncingFormRef.current) return;
        if (
            isUserLoaded &&
            watchedManualValue !== undefined &&
            watchedManualValue !== userManualValue
        ) {
            runInBackground(async () => {
                const isValid = await trigger('mhrManualValue');
                if (isValid) {
                    await savePatch({
                        mhrManualValue: watchedManualValue ?? null,
                    });
                }
            }, 'Failed to validate and save manual heart rate value:');
        }
    }, [isUserLoaded, watchedManualValue, userManualValue, savePatch, trigger]);

    useEffect(() => {
        if (isSyncingFormRef.current) return;
        if (
            isUserLoaded &&
            watchedBirthday !== undefined &&
            watchedBirthdayTimestamp !== userBirthdayTimestamp
        ) {
            runInBackground(
                () =>
                    savePatch({
                        birthday: watchedBirthday ?? null,
                    }),
                'Failed to save birthday in heart rate settings:',
            );
        }
    }, [isUserLoaded, watchedBirthday, watchedBirthdayTimestamp, userBirthdayTimestamp, savePatch]);

    useEffect(() => {
        if (isSyncingFormRef.current) return;
        if (
            isUserLoaded &&
            watchedBiologicalSex !== undefined &&
            watchedBiologicalSex !== userBiologicalSex
        ) {
            runInBackground(
                () =>
                    savePatch({
                        biologicalSex: watchedBiologicalSex ?? null,
                    }),
                'Failed to save biological sex in heart rate settings:',
            );
        }
    }, [isUserLoaded, watchedBiologicalSex, userBiologicalSex, savePatch]);

    useEffect(() => {
        if (isSyncingFormRef.current) return;
        if (
            isUserLoaded &&
            watchedActivityLevel !== undefined &&
            watchedActivityLevel !== userActivityLevel
        ) {
            runInBackground(
                () =>
                    savePatch({
                        activityLevel: watchedActivityLevel ?? null,
                    }),
                'Failed to save activity level in heart rate settings:',
            );
        }
    }, [isUserLoaded, watchedActivityLevel, userActivityLevel, savePatch]);

    const mhr = useMemo(() => {
        const formula = (watchedFormula ?? 'nes') as MhrFormula;
        const birthday = watchedBirthday;
        const manualValue = watchedManualValue;

        if (formula === 'manual') {
            return manualValue ?? null;
        }

        if (!birthday) return null;

        const a = calculateAge(birthday);
        const m = calculateMHR(formula, a, manualValue);
        return m;
    }, [watchedFormula, watchedBirthday, watchedManualValue]);

    const displayedMhr = useMemo(() => (mhr != null ? Math.floor(mhr) : null), [mhr]);

    const zoneDefinitions = getZoneDefinitions();

    const formatZoneRange = useCallback(
        (currentMhr: number, minPct: number, maxPctExclusive: number | null) => {
            const startBpm = Math.ceil((currentMhr * minPct) / 100);

            if (maxPctExclusive == null) {
                return `>= ${startBpm} ${t('heartrate.bpm', { ns: 'screens' })}`;
            }

            const endBpm = Math.max(startBpm, Math.ceil((currentMhr * maxPctExclusive) / 100) - 1);
            return `${startBpm}-${endBpm} ${t('heartrate.bpm', { ns: 'screens' })}`;
        },
        [t],
    );

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <VStack style={styles.headerContainer}>
                <VStack style={styles.headerTitleContainer}>
                    <Box style={styles.iconContainer}>
                        <Heart
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
                        <Title type="h3">{t('heartrate.title', { ns: 'screens' })}</Title>
                    </Box>
                    <Text style={styles.description}>
                        {t('heartrate.description', { ns: 'screens' })}
                    </Text>
                </VStack>
            </VStack>

            <VStack style={styles.fieldContainer}>
                <Label>{t('heartrate.biologicalSex', { ns: 'screens' })}</Label>
                <Choices
                    control={control}
                    name="biologicalSex"
                    choices={biologicalSexChoices}
                    error={errors.biologicalSex}
                    selectPosition="right"
                />
            </VStack>

            <VStack style={styles.fieldContainer}>
                <Label>{t('heartrate.activityLevel', { ns: 'screens' })}</Label>
                <Choices
                    control={control}
                    name="activityLevel"
                    choices={activityLevelChoices}
                    error={errors.activityLevel}
                    selectPosition="right"
                />
            </VStack>

            {watchedFormula !== 'manual' && (
                <VStack style={styles.fieldContainer}>
                    <VStack style={styles.fieldWrapper}>
                        <Datetime
                            control={control}
                            name="birthday"
                            value={watchedBirthday ?? new Date(1990, 0, 1)}
                            title={t('heartrate.birthday', { ns: 'screens' })}
                            mode="date"
                            maximumDate={new Date()}
                            error={errors.birthday}
                        />
                    </VStack>
                </VStack>
            )}

            <VStack style={styles.fieldContainer}>
                <Label>{t('heartrate.formula', { ns: 'screens' })}</Label>
                <Choices
                    control={control}
                    name="mhrFormula"
                    choices={formulaChoices}
                    error={errors.mhrFormula}
                    selectPosition="right"
                />
            </VStack>

            {watchedFormula === 'manual' && (
                <VStack style={styles.fieldContainer}>
                    <Label>{t('heartrate.manualMhr', { ns: 'screens' })}</Label>
                    <Input
                        control={control}
                        name="mhrManualValue"
                        valueType="number"
                        keyboardType="number-pad"
                        placeholder="180"
                        suffix={t('heartrate.bpm', { ns: 'screens' })}
                        error={errors.mhrManualValue}
                    />
                </VStack>
            )}

            {displayedMhr != null && mhr != null && (
                <VStack style={styles.infoCard}>
                    <HStack style={styles.infoRow}>
                        <Text style={styles.infoLabel}>
                            {t('heartrate.calculatedMhr', { ns: 'screens' })}
                        </Text>
                        <Text style={styles.infoValue}>
                            {displayedMhr} {t('heartrate.bpm', { ns: 'screens' })}
                        </Text>
                    </HStack>
                    <Box style={styles.zoneDivider} />
                    {zoneDefinitions.map((zone) => (
                        <HStack key={zone.zone} style={styles.infoRow}>
                            <Text style={styles.infoLabel}>
                                {t(`heartrate.zones.zone${zone.zone}`, { ns: 'screens' })}
                            </Text>
                            <Text style={styles.infoValue}>
                                {formatZoneRange(mhr, zone.minPct, zone.maxPctExclusive)}
                            </Text>
                        </HStack>
                    ))}
                </VStack>
            )}
        </ScrollView>
    );
};

export default HeartRateScreen;
