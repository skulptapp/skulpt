import { FC, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { VStack } from '@/components/primitives/vstack';
import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { MetricGrid, type MetricGridItem } from '@/components/layout/metric-grid';
import type { ExerciseSelect, ExerciseSetSelect } from '@/db/schema';
import { isWarmupSetType } from '@/helpers/set-type';
import { convertWeight } from '@/helpers/units';
import { waitForIdle } from '@/helpers/idle';
import { useUser } from '@/hooks/use-user';
import { useMeasurementTimeline } from '@/hooks/use-measurements';
import { useExerciseHistory } from '@/hooks/use-exercises';
import {
    isWeightUnit,
    resolveWorkoutDate,
    roundOneDecimal,
    roundTwoDecimals,
} from '@/screens/exercises/exercise/components/statistics/components/metric-utils';

interface WorkoutExerciseStatsProps {
    sets: ExerciseSetSelect[];
    exercise: ExerciseSelect;
    workoutId: string;
}

interface ComputedStats {
    oneRm: number | null;
    volume: number;
    averageWeight: number | null;
    intensity: number | null;
    relativeStrength: number | null;
}

const styles = StyleSheet.create((theme) => ({
    container: {
        marginHorizontal: theme.space(4),
        backgroundColor: theme.colors.background,
        paddingTop: theme.space(5),
        gap: theme.space(5),
    },
    section: {
        gap: theme.space(3),
    },
    sectionTitle: {
        fontSize: theme.fontSize.lg.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
    },
}));

export const WorkoutExerciseStats: FC<WorkoutExerciseStatsProps> = ({
    sets,
    exercise,
    workoutId,
}) => {
    const { t } = useTranslation(['common', 'screens']);
    const { user } = useUser();
    const bodyWeightTimeline = useMeasurementTimeline('body_weight');
    const { data: history = [] } = useExerciseHistory(exercise.id);

    const displayWeightUnits = user?.weightUnits ?? exercise.weightUnits ?? 'kg';

    const [computed, setComputed] = useState<ComputedStats | null>(null);

    useEffect(() => {
        let cancelled = false;

        waitForIdle().then(() => {
            if (cancelled) return;

            // Normalize working sets
            const workingSets = sets
                .filter((set) => {
                    if (isWarmupSetType(set.type)) return false;
                    if (set.weight == null || set.reps == null) return false;
                    if (set.weight <= 0 || set.reps <= 0) return false;
                    return true;
                })
                .map((set) => {
                    const sourceUnits =
                        set.weightUnits ?? exercise.weightUnits ?? displayWeightUnits;
                    const normalizedWeight =
                        sourceUnits === displayWeightUnits
                            ? set.weight!
                            : convertWeight(set.weight!, sourceUnits, displayWeightUnits);
                    return { weight: normalizedWeight, reps: set.reps! };
                });

            if (workingSets.length === 0) {
                setComputed(null);
                return;
            }

            // One RM, volume, average weight
            let bestOneRm = 0;
            let totalVolume = 0;
            let totalWeightByReps = 0;
            let totalReps = 0;

            for (const set of workingSets) {
                const oneRm = set.weight * (1 + set.reps / 30);
                if (Number.isFinite(oneRm) && oneRm > bestOneRm) bestOneRm = oneRm;

                totalVolume += set.weight * set.reps;
                totalWeightByReps += set.weight * set.reps;
                totalReps += set.reps;
            }

            // Reference 1RM: take last 5 previous workouts first, then iterate their sets
            const last5 = history
                .filter((item) => item.workout.id !== workoutId)
                .map((item) => ({ item, date: resolveWorkoutDate(item) }))
                .sort((a, b) => a.date.getTime() - b.date.getTime())
                .slice(-5);

            let referenceOneRm: number | null = null;
            for (const { item } of last5) {
                for (const set of item.sets) {
                    if (isWarmupSetType(set.type)) continue;
                    if (set.weight == null || set.reps == null) continue;
                    if (set.weight <= 0 || set.reps <= 0) continue;

                    const sourceUnits =
                        set.weightUnits ?? exercise.weightUnits ?? displayWeightUnits;
                    const normalizedWeight =
                        sourceUnits === displayWeightUnits
                            ? set.weight
                            : convertWeight(set.weight, sourceUnits, displayWeightUnits);
                    const oneRm = normalizedWeight * (1 + set.reps / 30);
                    if (Number.isFinite(oneRm) && oneRm > (referenceOneRm ?? 0))
                        referenceOneRm = oneRm;
                }
            }

            // Intensity
            let intensity: number | null = null;
            if (referenceOneRm != null && referenceOneRm > 0) {
                let totalWeightedIntensity = 0;
                let totalTonnage = 0;
                for (const set of workingSets) {
                    const tonnage = set.weight * set.reps;
                    totalWeightedIntensity += tonnage * (set.weight / referenceOneRm) * 100;
                    totalTonnage += tonnage;
                }
                if (totalTonnage > 0) {
                    intensity = roundOneDecimal(totalWeightedIntensity / totalTonnage);
                }
            }

            // Relative strength
            let relativeStrength: number | null = null;
            if (bestOneRm > 0 && bodyWeightTimeline.length > 0) {
                const latestBodyWeight = bodyWeightTimeline
                    .filter((e) => Number.isFinite(e.value) && e.value > 0 && isWeightUnit(e.unit))
                    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
                    .at(-1);

                if (latestBodyWeight && isWeightUnit(latestBodyWeight.unit)) {
                    const normalizedBodyWeight =
                        latestBodyWeight.unit === displayWeightUnits
                            ? latestBodyWeight.value
                            : convertWeight(
                                  latestBodyWeight.value,
                                  latestBodyWeight.unit,
                                  displayWeightUnits,
                              );

                    if (Number.isFinite(normalizedBodyWeight) && normalizedBodyWeight > 0) {
                        const value = roundTwoDecimals(
                            roundOneDecimal(bestOneRm) / normalizedBodyWeight,
                        );
                        if (Number.isFinite(value) && value > 0) relativeStrength = value;
                    }
                }
            }

            setComputed({
                oneRm: bestOneRm > 0 ? roundOneDecimal(bestOneRm) : null,
                volume: roundOneDecimal(totalVolume),
                averageWeight:
                    totalReps > 0 ? roundOneDecimal(totalWeightByReps / totalReps) : null,
                intensity,
                relativeStrength,
            });
        });

        return () => {
            cancelled = true;
        };
    }, [sets, exercise.weightUnits, history, workoutId, bodyWeightTimeline, displayWeightUnits]);

    if (!computed) return null;

    const formatWeight = (v: number) =>
        t('weight.weight', { value: v, context: displayWeightUnits, ns: 'common' });

    const gridItems: MetricGridItem[] = [
        computed.oneRm != null
            ? {
                  key: 'oneRm',
                  value: formatWeight(computed.oneRm),
                  label: t('exercise.stats.oneRm.cardTitle', { ns: 'screens' }),
              }
            : null,
        {
            key: 'volume',
            value: formatWeight(computed.volume),
            label: t('exercise.stats.volume.cardTitle', { ns: 'screens' }),
        },
        computed.averageWeight != null
            ? {
                  key: 'averageWeight',
                  value: formatWeight(computed.averageWeight),
                  label: t('exercise.stats.averageWeight.cardTitle', { ns: 'screens' }),
              }
            : null,
        computed.intensity != null
            ? {
                  key: 'intensity',
                  value: `${t('number', { value: computed.intensity, ns: 'common' })}%`,
                  label: t('exercise.stats.intensity.cardTitle', { ns: 'screens' }),
              }
            : null,
        computed.relativeStrength != null
            ? {
                  key: 'relativeStrength',
                  value: t('number', { value: computed.relativeStrength, ns: 'common' }),
                  label: t('exercise.stats.relativeStrength.cardTitle', { ns: 'screens' }),
              }
            : null,
    ].filter((item): item is MetricGridItem => item != null);

    if (gridItems.length === 0) return null;

    return (
        <VStack style={styles.container}>
            <VStack style={styles.section}>
                <Text style={styles.sectionTitle}>
                    {t('workout.stats.sections.overview', { ns: 'screens' })}
                </Text>
                <MetricGrid metrics={gridItems} />
            </VStack>
            <Box style={styles.divider} />
        </VStack>
    );
};
