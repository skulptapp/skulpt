import { FC, useMemo, useState } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { LineChart, type lineDataItem } from 'react-native-gifted-charts';
import { type StyleProp, type ViewStyle } from 'react-native';

import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { MetricGrid } from '@/components/layout/metric-grid';
import { type WorkoutStatsDisplay, WorkoutMetricsGrid } from '@/components/layout/workout-metrics';
import type { ExerciseSelect, ExerciseSetSelect, WorkoutSelect } from '@/db/schema';
import { stableOutlineWidth } from '@/helpers/styles';
import { getZoneDefinitions } from '@/helpers/heart-rate-zones';
import { useUser } from '@/hooks/use-user';
import { reportError } from '@/services/error-reporting';
import { type HealthStatsDisplay } from '@/types/health-stats';
import {
    buildHeartRateMetrics,
    buildOverviewMetrics,
    buildRecoveryMetrics,
    formatCompactDuration,
    type WorkoutMetricsExerciseContext,
} from './builders';

type HealthStatsExerciseContext = WorkoutMetricsExerciseContext & {
    exercise: Pick<
        ExerciseSelect,
        'category' | 'tracking' | 'distanceActivityType' | 'weightDoubleInStats'
    >;
    sets?: readonly Pick<
        ExerciseSetSelect,
        | 'type'
        | 'weight'
        | 'weightUnits'
        | 'reps'
        | 'time'
        | 'restTime'
        | 'finalRestTime'
        | 'startedAt'
        | 'completedAt'
        | 'restCompletedAt'
    >[];
};

interface StatsProps {
    workout: WorkoutSelect;
    exercises?: readonly HealthStatsExerciseContext[];
    healthStats?: Partial<HealthStatsDisplay> | null;
    workoutStats?: WorkoutStatsDisplay | null;
    forceShowLocomotionMetrics?: boolean;
    containerStyle?: StyleProp<ViewStyle>;
    zonePercentageTotalSeconds?: number | null;
}

type HeartRateSeriesPoint = {
    timestamp: number;
    bpm: number;
};

type ZoneMetric = {
    zone: number;
    label: string;
    seconds: number;
    percentage: number;
    color: string;
};

type RecoveryChartPoint = {
    minute: number;
    bpm: number;
};

type RecoveryLineDataItem = lineDataItem & {
    minute: number;
    bpm: number;
};

const CHART_HEIGHT = 120;
const CHART_EDGE_INSET = 3;
const CHART_ASPECT_RATIO = CHART_HEIGHT / 250;

const styles = StyleSheet.create((theme) => ({
    container: {
        marginHorizontal: theme.space(4),
        backgroundColor: theme.colors.background,
        paddingTop: theme.space(5),
        paddingBottom: theme.space(3),
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
    zoneSection: {
        paddingBottom: theme.space(2),
    },
    zoneList: {
        gap: theme.space(1),
    },
    zoneRow: {
        gap: theme.space(1),
    },
    zoneTop: {
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: theme.space(3),
    },
    zoneLabelWrap: {
        flex: 1,
        gap: theme.space(1),
    },
    zoneLabelRow: {
        alignItems: 'center',
    },
    zoneLabel: {
        flexShrink: 1,
        color: theme.colors.typography,
        fontSize: theme.fontSize.sm.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
    },
    zoneFill: {
        height: theme.space(2),
        borderRadius: theme.radius.full,
        overflow: 'hidden',
    },
    zoneStats: {
        alignItems: 'center',
        gap: theme.space(3),
    },
    zonePercent: {
        minWidth: theme.space(12),
        textAlign: 'right',
        color: theme.colors.typography,
        opacity: 0.55,
        fontSize: theme.fontSize.sm.fontSize,
        fontWeight: theme.fontWeight.medium.fontWeight,
    },
    zoneDuration: {
        minWidth: theme.space(14),
        textAlign: 'right',
        color: theme.colors.typography,
        fontSize: theme.fontSize.sm.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
    },
    recoveryCard: {
        width: '100%',
        borderRadius: theme.radius['4xl'],
        gap: theme.space(3),
    },
    recoveryContent: {
        flex: 1,
        width: '100%',
        gap: theme.space(3),
        alignItems: 'stretch',
    },
    recoveryChartWrap: {
        flex: 1,
        width: '100%',
        alignSelf: 'stretch',
        justifyContent: 'center',
    },
    recoveryChartMetaRow: {
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: -theme.space(1.5),
    },
    recoveryChartMetaLabel: {
        color: theme.colors.typography,
        opacity: 0.55,
        fontSize: theme.fontSize.xs.fontSize,
        fontWeight: theme.fontWeight.medium.fontWeight,
    },
    recoveryPointerLabel: {
        minWidth: theme.space(10),
        paddingHorizontal: theme.space(1),
        paddingVertical: theme.space(1.5),
        borderRadius: theme.radius['2xl'],
        backgroundColor: theme.colors.background,
        borderWidth: stableOutlineWidth,
        borderColor: theme.colors.border,
        gap: theme.space(0.5),
    },
    recoveryPointerValue: {
        color: theme.colors.typography,
        fontSize: theme.fontSize.sm.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
        textAlign: 'center',
    },
    recoveryPointerTime: {
        color: theme.colors.typography,
        opacity: 0.55,
        fontSize: theme.fontSize['2xs'].fontSize,
        fontWeight: theme.fontWeight.medium.fontWeight,
        textAlign: 'center',
    },
}));

const parseHeartRateSeries = (raw: string | null): HeartRateSeriesPoint[] => {
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw) as HeartRateSeriesPoint[];
        if (!Array.isArray(parsed)) return [];

        return parsed.filter(
            (point): point is HeartRateSeriesPoint =>
                typeof point?.timestamp === 'number' && typeof point?.bpm === 'number',
        );
    } catch (error) {
        reportError(error, 'Failed to parse workout heart rate series:');
        return [];
    }
};

const compactZoneLabel = (value: string): string => {
    const emDashParts = value.split('—');
    if (emDashParts.length > 1) {
        return emDashParts[emDashParts.length - 1]!.trim();
    }

    const hyphenParts = value.split('-');
    if (hyphenParts.length > 1) {
        return hyphenParts[hyphenParts.length - 1]!.trim();
    }

    return value.trim();
};

const formatRecoveryPointerMinute = (minute: number): string => {
    const safeSeconds = Math.max(0, Math.round(minute * 60));
    const wholeMinutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;

    return `${wholeMinutes}:${seconds.toString().padStart(2, '0')}`;
};

const getClosestPoint = (
    points: RecoveryChartPoint[],
    targetMinute: number,
): RecoveryChartPoint | null => {
    let closestPoint: RecoveryChartPoint | null = null;
    let closestDelta = Number.POSITIVE_INFINITY;

    for (const point of points) {
        const delta = Math.abs(point.minute - targetMinute);
        if (delta < closestDelta) {
            closestPoint = point;
            closestDelta = delta;
        }
    }

    return closestPoint;
};

const getInterpolatedRecoveryBpm = (
    points: RecoveryChartPoint[],
    targetMinute: number,
): number | null => {
    if (points.length === 0) return null;

    const firstPoint = points[0]!;
    const lastPoint = points[points.length - 1]!;

    if (targetMinute <= firstPoint.minute) {
        return firstPoint.bpm;
    }

    if (targetMinute >= lastPoint.minute) {
        return lastPoint.bpm;
    }

    for (let index = 0; index < points.length - 1; index += 1) {
        const left = points[index]!;
        const right = points[index + 1]!;

        if (targetMinute < left.minute || targetMinute > right.minute) {
            continue;
        }

        const span = right.minute - left.minute;
        if (span <= 0) {
            return right.bpm;
        }

        const progress = (targetMinute - left.minute) / span;
        return left.bpm + (right.bpm - left.bpm) * progress;
    }

    return lastPoint.bpm;
};

export const Stats: FC<StatsProps> = ({
    workout,
    exercises = [],
    healthStats,
    workoutStats,
    forceShowLocomotionMetrics,
    containerStyle,
    zonePercentageTotalSeconds,
}) => {
    const { t } = useTranslation(['screens', 'common']);
    const { user } = useUser();
    const { theme } = useUnistyles();
    const [recoveryContentWidth, setRecoveryContentWidth] = useState<number | null>(null);

    const effectiveRecoveryChartWidth =
        recoveryContentWidth != null
            ? Math.max(CHART_EDGE_INSET * 2 + 1, recoveryContentWidth)
            : null;
    const recoveryChartHeight =
        effectiveRecoveryChartWidth != null
            ? Math.max(1, Math.round(effectiveRecoveryChartWidth * CHART_ASPECT_RATIO))
            : CHART_HEIGHT;
    const recoveryChartTimelineWidth = Math.max(
        0,
        (effectiveRecoveryChartWidth ?? 0) - CHART_EDGE_INSET * 2,
    );

    const distanceUnits = user?.distanceUnits ?? 'km';

    const zoneColors = useMemo(
        () => ({
            1: '#94a3b8',
            2: '#facc15',
            3: '#fb923c',
            4: '#f87171',
            5: '#f472b6',
        }),
        [],
    );

    const zoneSecondsByZone = useMemo(
        () =>
            ({
                1:
                    healthStats?.zone1Seconds ??
                    (healthStats?.zone1Minutes != null
                        ? Math.round(healthStats.zone1Minutes * 60)
                        : 0),
                2:
                    healthStats?.zone2Seconds ??
                    (healthStats?.zone2Minutes != null
                        ? Math.round(healthStats.zone2Minutes * 60)
                        : 0),
                3:
                    healthStats?.zone3Seconds ??
                    (healthStats?.zone3Minutes != null
                        ? Math.round(healthStats.zone3Minutes * 60)
                        : 0),
                4:
                    healthStats?.zone4Seconds ??
                    (healthStats?.zone4Minutes != null
                        ? Math.round(healthStats.zone4Minutes * 60)
                        : 0),
                5:
                    healthStats?.zone5Seconds ??
                    (healthStats?.zone5Minutes != null
                        ? Math.round(healthStats.zone5Minutes * 60)
                        : 0),
            }) as const,
        [
            healthStats?.zone1Minutes,
            healthStats?.zone1Seconds,
            healthStats?.zone2Minutes,
            healthStats?.zone2Seconds,
            healthStats?.zone3Minutes,
            healthStats?.zone3Seconds,
            healthStats?.zone4Minutes,
            healthStats?.zone4Seconds,
            healthStats?.zone5Minutes,
            healthStats?.zone5Seconds,
        ],
    );

    const totalZoneSeconds = useMemo(
        () =>
            zoneSecondsByZone[1] +
            zoneSecondsByZone[2] +
            zoneSecondsByZone[3] +
            zoneSecondsByZone[4] +
            zoneSecondsByZone[5],
        [zoneSecondsByZone],
    );

    const workoutDurationSeconds = useMemo(() => {
        if (workout.startedAt && workout.completedAt) {
            return Math.max(
                0,
                Math.round((workout.completedAt.getTime() - workout.startedAt.getTime()) / 1000),
            );
        }

        return totalZoneSeconds;
    }, [totalZoneSeconds, workout.completedAt, workout.startedAt]);

    const zoneMetrics = useMemo<ZoneMetric[]>(() => {
        const zonePercentageTotal =
            zonePercentageTotalSeconds != null
                ? Math.max(0, Math.round(zonePercentageTotalSeconds))
                : 0;
        const totalSeconds = zonePercentageTotal || totalZoneSeconds || workoutDurationSeconds || 0;

        return [...getZoneDefinitions()].reverse().map((zone) => {
            const seconds = zoneSecondsByZone[zone.zone];
            const percentage = totalSeconds > 0 ? (seconds / totalSeconds) * 100 : 0;

            return {
                zone: zone.zone,
                label: compactZoneLabel(
                    t(`heartrate.zones.zone${zone.zone}`, {
                        ns: 'screens',
                    }),
                ),
                seconds,
                percentage,
                color: zoneColors[zone.zone],
            };
        });
    }, [
        t,
        totalZoneSeconds,
        workoutDurationSeconds,
        zoneColors,
        zonePercentageTotalSeconds,
        zoneSecondsByZone,
    ]);

    const shouldShowLocomotionMetrics = useMemo(
        () =>
            forceShowLocomotionMetrics ??
            exercises.some(({ exercise }) => {
                if (exercise.category === 'cardio') {
                    return true;
                }

                if (exercise.distanceActivityType) {
                    return true;
                }

                return exercise.tracking.includes('distance');
            }),
        [exercises, forceShowLocomotionMetrics],
    );

    const activityMetrics = healthStats
        ? buildOverviewMetrics({
              snapshot: healthStats,
              shouldShowLocomotionMetrics,
              distanceUnits,
              t,
          })
        : null;

    const heartRateMetrics = healthStats
        ? buildHeartRateMetrics({
              snapshot: healthStats,
              t,
          })
        : null;

    const recoveryMetrics = healthStats
        ? buildRecoveryMetrics({
              snapshot: healthStats,
              t,
          })
        : null;

    const recoveryChartModel = useMemo(() => {
        const savedRecoverySamples =
            workout.completedAt != null
                ? parseHeartRateSeries(healthStats?.hrRecoverySeries ?? null)
                : [];

        if (savedRecoverySamples.length === 0 || !workout.completedAt) {
            return null;
        }

        const completedAtMs = workout.completedAt.getTime();
        const recoveryWindowEndMs = completedAtMs + 2 * 60 * 1000;
        const points = savedRecoverySamples
            .filter(
                (sample) =>
                    sample.timestamp >= completedAtMs && sample.timestamp <= recoveryWindowEndMs,
            )
            .map((sample) => ({
                minute: (sample.timestamp - completedAtMs) / 60_000,
                bpm: sample.bpm,
            }))
            .sort((left, right) => left.minute - right.minute);

        if (points.length === 0) {
            return null;
        }

        const startPoint = getClosestPoint(points, 0);
        const oneMinutePoint = getClosestPoint(points, 1);
        const twoMinutePoint = getClosestPoint(points, 2);

        const startBpm = startPoint?.bpm ?? points[0]?.bpm ?? null;
        const oneMinuteBpm = oneMinutePoint?.bpm ?? null;
        const twoMinuteBpm = twoMinutePoint?.bpm ?? null;
        const maxMinute = points[points.length - 1]?.minute >= 1.5 ? 2 : 1;
        const plotStepCount = Math.max(12, maxMinute * 12);

        if (startBpm == null) return null;

        const plotPoints = Array.from({ length: plotStepCount + 1 }, (_, index) => {
            const minute = (index / plotStepCount) * maxMinute;
            const bpm = getInterpolatedRecoveryBpm(points, minute);

            return bpm == null
                ? null
                : {
                      minute,
                      bpm,
                  };
        }).filter(Boolean) as RecoveryChartPoint[];

        const bpmValues = points.map((point) => point.bpm);
        const minBpm = Math.min(...bpmValues);
        const maxBpm = Math.max(...bpmValues);
        const verticalPadding = Math.max(2, Math.round((maxBpm - minBpm) * 0.12) || 2);

        return {
            points,
            plotPoints,
            plotStepCount,
            startBpm,
            oneMinuteBpm,
            endBpm: twoMinuteBpm ?? oneMinuteBpm ?? startBpm,
            maxMinute,
            minBpm: minBpm - verticalPadding,
            maxBpm: maxBpm + verticalPadding,
        };
    }, [healthStats?.hrRecoverySeries, workout.completedAt]);

    const recoveryChartData = useMemo(() => {
        if (!recoveryChartModel) {
            return [] as RecoveryLineDataItem[];
        }

        const segmentSpacing =
            recoveryChartModel.plotStepCount > 0
                ? recoveryChartTimelineWidth / recoveryChartModel.plotStepCount
                : 0;

        return recoveryChartModel.plotPoints.map((point, index) => {
            return {
                value: point.bpm,
                bpm: point.bpm,
                minute: point.minute,
                spacing: index < recoveryChartModel.plotPoints.length - 1 ? segmentSpacing : 0,
            } satisfies RecoveryLineDataItem;
        });
    }, [recoveryChartModel, recoveryChartTimelineWidth]);

    const recoveryPointerConfig = useMemo(
        () => ({
            pointerColor: '#ef4444',
            radius: 4,
            showPointerStrip: true,
            pointerStripColor: 'rgba(203, 63, 97, 0.35)',
            pointerStripWidth: 4,
            pointerStripUptoDataPoint: true,
            activatePointersInstantlyOnTouch: true,
            resetPointerIndexOnRelease: true,
            autoAdjustPointerLabelPosition: true,
            pointerLabelWidth: theme.space(22),
            pointerLabelHeight: theme.space(14),
            shiftPointerLabelY: -theme.space(2),
            pointerLabelComponent: (items?: RecoveryLineDataItem[]) => {
                const item = items?.[0];
                if (!item) return null;

                return (
                    <VStack style={styles.recoveryPointerLabel}>
                        <Text style={styles.recoveryPointerValue}>
                            {`${Math.round(item.bpm)} bpm`}
                        </Text>
                        <Text style={styles.recoveryPointerTime}>
                            {formatRecoveryPointerMinute(item.minute)}
                        </Text>
                    </VStack>
                );
            },
        }),
        [theme],
    );

    const hasZoneSection =
        totalZoneSeconds > 0 ||
        healthStats?.avgHeartRate != null ||
        healthStats?.minHeartRate != null ||
        healthStats?.maxHeartRate != null;
    const hasOverviewSection = workoutStats != null;
    const hasActivitySection = activityMetrics && activityMetrics.length > 0;
    const hasHeartRateSection = heartRateMetrics && heartRateMetrics.length > 0;
    const hasRecoverySection =
        recoveryChartModel != null || (recoveryMetrics && recoveryMetrics.length > 0);

    if (
        workout.status !== 'completed' ||
        (!hasOverviewSection &&
            !hasZoneSection &&
            !hasActivitySection &&
            !hasHeartRateSection &&
            !hasRecoverySection)
    ) {
        return null;
    }

    return (
        <VStack style={[styles.container, containerStyle]}>
            {hasOverviewSection && (
                <VStack style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        {t('workout.stats.sections.overview', { ns: 'screens' })}
                    </Text>
                    <WorkoutMetricsGrid values={workoutStats} />
                </VStack>
            )}

            {hasOverviewSection &&
                (hasZoneSection ||
                    hasActivitySection ||
                    hasHeartRateSection ||
                    hasRecoverySection) && <Box style={styles.divider} />}

            {hasZoneSection && (
                <VStack style={[styles.section, styles.zoneSection]}>
                    <Text style={styles.sectionTitle}>
                        {t('workout.stats.sections.zone', { ns: 'screens' })}
                    </Text>
                    <VStack style={styles.zoneList}>
                        {zoneMetrics.map((zone) => (
                            <VStack key={zone.zone} style={styles.zoneRow}>
                                <HStack style={styles.zoneTop}>
                                    <VStack style={styles.zoneLabelWrap}>
                                        <HStack style={styles.zoneLabelRow}>
                                            <Text style={styles.zoneLabel}>{zone.label}</Text>
                                        </HStack>
                                        <Box
                                            style={[
                                                styles.zoneFill,
                                                {
                                                    backgroundColor: zone.color,
                                                    width:
                                                        zone.percentage > 0
                                                            ? `${Math.min(100, zone.percentage)}%`
                                                            : theme.space(2),
                                                },
                                            ]}
                                        />
                                    </VStack>
                                    <HStack style={styles.zoneStats}>
                                        <Text style={styles.zonePercent}>
                                            {Math.round(zone.percentage)}%
                                        </Text>
                                        <Text style={styles.zoneDuration}>
                                            {formatCompactDuration(zone.seconds)}
                                        </Text>
                                    </HStack>
                                </HStack>
                            </VStack>
                        ))}
                    </VStack>
                </VStack>
            )}

            {hasZoneSection &&
                (hasActivitySection || hasHeartRateSection || hasRecoverySection) && (
                    <Box style={styles.divider} />
                )}

            {hasActivitySection && (
                <VStack style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        {t('workout.stats.sections.activity', { ns: 'screens' })}
                    </Text>
                    <MetricGrid metrics={activityMetrics} />
                </VStack>
            )}

            {hasActivitySection && (hasHeartRateSection || hasRecoverySection) && (
                <Box style={styles.divider} />
            )}

            {hasHeartRateSection && (
                <VStack style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        {t('workout.stats.sections.heartRate', { ns: 'screens' })}
                    </Text>
                    <MetricGrid metrics={heartRateMetrics} />
                </VStack>
            )}

            {hasHeartRateSection && hasRecoverySection && <Box style={styles.divider} />}

            {hasRecoverySection && (
                <VStack style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        {t('workout.stats.sections.recovery', { ns: 'screens' })}
                    </Text>
                    <HStack style={styles.recoveryCard}>
                        <VStack
                            style={styles.recoveryContent}
                            onLayout={(event) => {
                                const nextWidth = Math.round(event.nativeEvent.layout.width);
                                if (nextWidth > 0 && nextWidth !== recoveryContentWidth) {
                                    setRecoveryContentWidth(nextWidth);
                                }
                            }}
                        >
                            {recoveryMetrics && <MetricGrid metrics={recoveryMetrics} />}

                            {recoveryChartModel && (
                                <VStack style={styles.recoveryChartWrap}>
                                    {effectiveRecoveryChartWidth != null && (
                                        <LineChart
                                            data={recoveryChartData}
                                            areaChart
                                            curved
                                            width={effectiveRecoveryChartWidth}
                                            height={recoveryChartHeight}
                                            disableScroll
                                            adjustToWidth
                                            pointerConfig={recoveryPointerConfig}
                                            initialSpacing={CHART_EDGE_INSET}
                                            endSpacing={CHART_EDGE_INSET}
                                            yAxisOffset={recoveryChartModel.minBpm}
                                            maxValue={Math.max(
                                                1,
                                                recoveryChartModel.maxBpm -
                                                    recoveryChartModel.minBpm,
                                            )}
                                            noOfSections={3}
                                            thickness={1.5}
                                            color="#ef4444"
                                            startFillColor="#ef4444"
                                            endFillColor="#ef4444"
                                            startOpacity={1}
                                            endOpacity={0.4}
                                            hideYAxisText
                                            yAxisLabelWidth={0}
                                            yAxisThickness={0}
                                            xAxisThickness={1}
                                            xAxisColor={theme.colors.border}
                                            xAxisLabelsHeight={0}
                                            xAxisLabelsVerticalShift={0}
                                            labelsExtraHeight={0}
                                            hideRules={false}
                                            rulesColor={theme.colors.border}
                                            rulesThickness={1}
                                            hideDataPoints={false}
                                            dataPointsRadius={3}
                                            dataPointsColor="#ef4444"
                                        />
                                    )}
                                    <HStack style={styles.recoveryChartMetaRow}>
                                        <Text style={styles.recoveryChartMetaLabel}>0</Text>
                                        <Text style={styles.recoveryChartMetaLabel}>1m</Text>
                                        <Text style={styles.recoveryChartMetaLabel}>
                                            {recoveryChartModel.maxMinute === 2 ? '2m' : '1m'}
                                        </Text>
                                    </HStack>
                                </VStack>
                            )}
                        </VStack>
                    </HStack>
                </VStack>
            )}
            <Box style={styles.divider} />
        </VStack>
    );
};
