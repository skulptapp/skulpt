import { FC, useMemo, useState } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { LineChart, type lineDataItem } from 'react-native-gifted-charts';
import { type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { MetricGrid } from '@/components/layout/metric-grid';
import {
    hasWorkoutMetrics,
    type WorkoutStatsDisplay,
    WorkoutMetricsGrid,
} from '@/components/layout/workout-metrics';
import type { ExerciseSelect, ExerciseSetSelect, WorkoutSelect } from '@/db/schema';
import { stableOutlineWidth } from '@/helpers/styles';
import { calculateAge, getZoneDefinitions } from '@/helpers/heart-rate-zones';
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

type RecoveryRatingKey = 'poor' | 'fair' | 'good' | 'excellent' | 'superior';

type RecoveryScaleSegment = {
    key: RecoveryRatingKey;
    min: number;
    max: number | null;
    width: number;
    labelColor: string;
};

type RecoveryScaleModel = {
    markerPercent: number;
    markerColor: string;
    segments: RecoveryScaleSegment[];
};

type RecoveryScaleStarts = readonly [number, number, number, number, number];
type RgbColor = {
    r: number;
    g: number;
    b: number;
};

const CHART_HEIGHT = 120;
const CHART_EDGE_INSET = 3;
const CHART_ASPECT_RATIO = CHART_HEIGHT / 250;
const FALLBACK_RECOVERY_CHART_COLOR = '#ef4444';

const RECOVERY_SCALE_COLORS: Record<RecoveryRatingKey, { labelColor: string }> = {
    poor: {
        labelColor: '#F8D749',
    },
    fair: {
        labelColor: '#F3C058',
    },
    good: {
        labelColor: '#F1A97F',
    },
    excellent: {
        labelColor: '#E772A6',
    },
    superior: {
        labelColor: '#CCC3FA',
    },
};

const RECOVERY_SCALE_GRADIENT_COLORS = [
    '#F8D749',
    '#F4C844',
    '#F2AC7D',
    '#E770A0',
    '#D8AADD',
    '#CCC3FA',
] as const;

const RECOVERY_SCALE_BOUNDS_BY_AGE: readonly {
    minAge: number;
    maxAge: number;
    starts: RecoveryScaleStarts;
}[] = [
    { minAge: 18, maxAge: 29, starts: [0, 14, 31, 40, 49] },
    { minAge: 30, maxAge: 39, starts: [0, 14, 30, 39, 47] },
    { minAge: 40, maxAge: 49, starts: [0, 14, 29, 38, 46] },
    { minAge: 50, maxAge: 59, starts: [0, 14, 28, 36, 44] },
    { minAge: 60, maxAge: 69, starts: [0, 14, 25, 32, 40] },
    { minAge: 70, maxAge: Number.POSITIVE_INFINITY, starts: [0, 14, 21, 29, 36] },
] as const;

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
    recoveryScale: {
        gap: theme.space(1.5),
        marginTop: theme.space(3.5),
    },
    recoveryScaleLabels: {
        width: '100%',
        alignItems: 'center',
    },
    recoveryScaleLabelSlot: {
        minWidth: 0,
        paddingRight: theme.space(0.5),
    },
    recoveryScaleLabel: {
        fontSize: theme.fontSize.xs.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
    },
    recoveryScaleBarWrap: {
        height: theme.space(1),
        justifyContent: 'center',
    },
    recoveryScaleTrack: {
        height: theme.space(2.5),
        borderRadius: theme.radius.full,
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
    },
    recoveryScaleGradient: {
        flex: 1,
    },
    recoveryScaleDivider: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: theme.space(0.5),
        marginLeft: -theme.space(0.25),
        backgroundColor: theme.colors.background,
    },
    recoveryScaleDivider1: {
        left: '20%',
    },
    recoveryScaleDivider2: {
        left: '40%',
    },
    recoveryScaleDivider3: {
        left: '60%',
    },
    recoveryScaleDivider4: {
        left: '80%',
    },
    recoveryScaleMarker: {
        position: 'absolute',
        width: theme.space(2.5),
        height: theme.space(2.5),
        marginLeft: -theme.space(2.25),
        borderRadius: theme.radius.full,
        borderWidth: theme.space(0.55),
        borderColor: '#34343C',
        backgroundColor: 'transparent',
    },
    recoveryScaleTicks: {
        width: '100%',
        alignItems: 'center',
    },
    recoveryScaleTickSlot: {
        minWidth: 0,
        paddingRight: theme.space(0.5),
    },
    recoveryScaleTick: {
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
    recoveryPointerComponent: {
        width: theme.space(2),
        alignItems: 'center',
    },
    recoveryPointerCustomStrip: {
        position: 'absolute',
        top: theme.space(1),
        width: theme.space(0.5),
    },
    recoveryPointerCustomDot: {
        width: theme.space(2),
        height: theme.space(2),
        borderRadius: theme.radius.full,
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

const parseHexColor = (color: string): RgbColor => {
    const normalized = color.replace('#', '');
    const value = Number.parseInt(normalized, 16);

    return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255,
    };
};

const toHexChannel = (value: number): string =>
    Math.round(value).toString(16).padStart(2, '0').toUpperCase();

const rgbToHex = ({ r, g, b }: RgbColor): string =>
    `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`;

const withAlpha = (color: string, alpha: number): string => {
    const { r, g, b } = parseHexColor(color);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getRecoveryScaleColor = (markerPercent: number): string => {
    const colors = RECOVERY_SCALE_GRADIENT_COLORS;
    const boundedPercent = Math.max(0, Math.min(100, markerPercent));
    const scaledPosition = (boundedPercent / 100) * (colors.length - 1);
    const leftIndex = Math.min(Math.floor(scaledPosition), colors.length - 2);
    const rightIndex = leftIndex + 1;
    const progress = scaledPosition - leftIndex;
    const left = parseHexColor(colors[leftIndex]!);
    const right = parseHexColor(colors[rightIndex]!);

    return rgbToHex({
        r: left.r + (right.r - left.r) * progress,
        g: left.g + (right.g - left.g) * progress,
        b: left.b + (right.b - left.b) * progress,
    });
};

const getRecoveryScaleStarts = (age: number | null | undefined): RecoveryScaleStarts => {
    const safeAge = age == null || !Number.isFinite(age) ? 30 : Math.max(18, Math.floor(age));
    const bounds =
        RECOVERY_SCALE_BOUNDS_BY_AGE.find(
            (item) => safeAge >= item.minAge && safeAge <= item.maxAge,
        ) ?? RECOVERY_SCALE_BOUNDS_BY_AGE[1]!;

    return bounds.starts;
};

const getRecoveryScaleMarkerPercent = (value: number, starts: RecoveryScaleStarts): number => {
    const segmentCount = starts.length;

    for (let index = 0; index < starts.length - 1; index += 1) {
        const min = starts[index]!;
        const max = starts[index + 1]!;

        if (value < max) {
            const progress = Math.max(0, Math.min(1, (value - min) / Math.max(max - min, 1)));
            return ((index + progress) / segmentCount) * 100;
        }
    }

    const superiorStart = starts[starts.length - 1]!;
    const superiorSpan = Math.max(starts[1]! - starts[0]!, 1);
    const superiorProgress = Math.max(0, Math.min(1, (value - superiorStart) / superiorSpan));

    return ((segmentCount - 1 + superiorProgress) / segmentCount) * 100;
};

const buildRecoveryScaleModel = (
    recovery: number | null | undefined,
    age: number | null | undefined,
): RecoveryScaleModel | null => {
    if (recovery == null) return null;

    const starts = getRecoveryScaleStarts(age);
    const [poorStart, fairStart, goodStart, excellentStart, superiorStart] = starts;
    const value = Math.max(0, Math.round(recovery));

    const segments: RecoveryScaleSegment[] = [
        {
            key: 'poor',
            min: poorStart,
            max: fairStart - 1,
            width: 1,
            labelColor: RECOVERY_SCALE_COLORS.poor.labelColor,
        },
        {
            key: 'fair',
            min: fairStart,
            max: goodStart - 1,
            width: 1,
            labelColor: RECOVERY_SCALE_COLORS.fair.labelColor,
        },
        {
            key: 'good',
            min: goodStart,
            max: excellentStart - 1,
            width: 1,
            labelColor: RECOVERY_SCALE_COLORS.good.labelColor,
        },
        {
            key: 'excellent',
            min: excellentStart,
            max: superiorStart - 1,
            width: 1,
            labelColor: RECOVERY_SCALE_COLORS.excellent.labelColor,
        },
        {
            key: 'superior',
            min: superiorStart,
            max: null,
            width: 1,
            labelColor: RECOVERY_SCALE_COLORS.superior.labelColor,
        },
    ];
    const markerPercent = getRecoveryScaleMarkerPercent(value, starts);

    return {
        markerPercent,
        markerColor: getRecoveryScaleColor(markerPercent),
        segments,
    };
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
    const userBirthday = user?.birthday ?? null;
    const twoMinuteRecovery = healthStats?.heartRateRecoveryTwoMinutes ?? null;
    const recoveryScaleModel = useMemo(() => {
        const age = userBirthday ? calculateAge(userBirthday) : null;
        return buildRecoveryScaleModel(twoMinuteRecovery, age);
    }, [twoMinuteRecovery, userBirthday]);
    const recoveryChartColor = recoveryScaleModel?.markerColor ?? FALLBACK_RECOVERY_CHART_COLOR;
    const recoveryChartPointerStripColor = withAlpha(recoveryChartColor, 0.35);

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
        [healthStats],
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
            pointerColor: recoveryChartColor,
            radius: 4,
            showPointerStrip: false,
            pointerStripColor: recoveryChartPointerStripColor,
            pointerStripWidth: 4,
            pointerStripUptoDataPoint: true,
            stripOverPointer: true,
            pointerComponent: (item?: RecoveryLineDataItem | RecoveryLineDataItem[]) => {
                const pointerItem = Array.isArray(item) ? item[0] : item;
                const bpm =
                    typeof pointerItem?.bpm === 'number'
                        ? pointerItem.bpm
                        : typeof pointerItem?.value === 'number'
                          ? pointerItem.value
                          : null;
                const valueRange = recoveryChartModel
                    ? Math.max(1, recoveryChartModel.maxBpm - recoveryChartModel.minBpm)
                    : 1;
                const pointerY =
                    bpm != null && recoveryChartModel
                        ? Math.max(
                              0,
                              Math.min(
                                  recoveryChartHeight,
                                  recoveryChartHeight -
                                      ((bpm - recoveryChartModel.minBpm) / valueRange) *
                                          recoveryChartHeight,
                              ),
                          )
                        : 0;
                const stripHeight = Math.max(0, recoveryChartHeight - pointerY);

                return (
                    <Box style={styles.recoveryPointerComponent}>
                        <Box
                            style={[
                                styles.recoveryPointerCustomStrip,
                                {
                                    height: stripHeight,
                                    backgroundColor: recoveryChartPointerStripColor,
                                },
                            ]}
                        />
                        <Box
                            style={[
                                styles.recoveryPointerCustomDot,
                                { backgroundColor: recoveryChartColor },
                            ]}
                        />
                    </Box>
                );
            },
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
        [
            recoveryChartColor,
            recoveryChartHeight,
            recoveryChartModel,
            recoveryChartPointerStripColor,
            theme,
        ],
    );

    const hasZoneSection =
        totalZoneSeconds > 0 ||
        healthStats?.avgHeartRate != null ||
        healthStats?.minHeartRate != null ||
        healthStats?.maxHeartRate != null;
    const hasOverviewSection = workoutStats != null && hasWorkoutMetrics(workoutStats);
    const hasActivitySection = activityMetrics && activityMetrics.length > 0;
    const hasHeartRateSection = heartRateMetrics && heartRateMetrics.length > 0;
    const hasRecoverySection =
        recoveryChartModel != null || (recoveryMetrics && recoveryMetrics.length > 0);

    if (
        !hasOverviewSection &&
        !hasZoneSection &&
        !hasActivitySection &&
        !hasHeartRateSection &&
        !hasRecoverySection
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
                                            thickness={2}
                                            color={recoveryChartColor}
                                            startFillColor={recoveryChartColor}
                                            endFillColor={recoveryChartColor}
                                            startOpacity={1}
                                            startOpacity1={0.2}
                                            endOpacity={0}
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
                                            hideDataPoints={true}
                                        />
                                    )}
                                    <HStack style={styles.recoveryChartMetaRow}>
                                        <Text style={styles.recoveryChartMetaLabel}>0</Text>
                                        <Text style={styles.recoveryChartMetaLabel}>1m</Text>
                                        <Text style={styles.recoveryChartMetaLabel}>
                                            {recoveryChartModel.maxMinute === 2 ? '2m' : '1m'}
                                        </Text>
                                    </HStack>
                                    {recoveryScaleModel && (
                                        <VStack style={styles.recoveryScale}>
                                            <HStack style={styles.recoveryScaleLabels}>
                                                {recoveryScaleModel.segments.map((segment) => (
                                                    <Box
                                                        key={segment.key}
                                                        style={[
                                                            styles.recoveryScaleLabelSlot,
                                                            { flex: segment.width },
                                                        ]}
                                                    >
                                                        <Text
                                                            adjustsFontSizeToFit
                                                            minimumFontScale={0.75}
                                                            numberOfLines={1}
                                                            style={[
                                                                styles.recoveryScaleLabel,
                                                                { color: segment.labelColor },
                                                            ]}
                                                        >
                                                            {t(
                                                                `workout.stats.recoveryScale.${segment.key}`,
                                                                { ns: 'screens' },
                                                            )}
                                                        </Text>
                                                    </Box>
                                                ))}
                                            </HStack>
                                            <Box style={styles.recoveryScaleBarWrap}>
                                                <Box style={styles.recoveryScaleTrack}>
                                                    <LinearGradient
                                                        colors={RECOVERY_SCALE_GRADIENT_COLORS}
                                                        start={{ x: 0, y: 0.5 }}
                                                        end={{ x: 1, y: 0.5 }}
                                                        style={styles.recoveryScaleGradient}
                                                    />
                                                    <Box
                                                        style={[
                                                            styles.recoveryScaleDivider,
                                                            styles.recoveryScaleDivider1,
                                                        ]}
                                                    />
                                                    <Box
                                                        style={[
                                                            styles.recoveryScaleDivider,
                                                            styles.recoveryScaleDivider2,
                                                        ]}
                                                    />
                                                    <Box
                                                        style={[
                                                            styles.recoveryScaleDivider,
                                                            styles.recoveryScaleDivider3,
                                                        ]}
                                                    />
                                                    <Box
                                                        style={[
                                                            styles.recoveryScaleDivider,
                                                            styles.recoveryScaleDivider4,
                                                        ]}
                                                    />
                                                </Box>
                                                <Box
                                                    style={[
                                                        styles.recoveryScaleMarker,
                                                        {
                                                            left: `${recoveryScaleModel.markerPercent}%`,
                                                        },
                                                    ]}
                                                />
                                            </Box>
                                            <HStack style={styles.recoveryScaleTicks}>
                                                {recoveryScaleModel.segments.map((segment) => (
                                                    <Box
                                                        key={segment.key}
                                                        style={[
                                                            styles.recoveryScaleTickSlot,
                                                            { flex: segment.width },
                                                        ]}
                                                    >
                                                        <Text
                                                            adjustsFontSizeToFit
                                                            minimumFontScale={0.75}
                                                            numberOfLines={1}
                                                            style={styles.recoveryScaleTick}
                                                        >
                                                            {segment.max == null
                                                                ? `${segment.min}+`
                                                                : segment.min}
                                                        </Text>
                                                    </Box>
                                                ))}
                                            </HStack>
                                        </VStack>
                                    )}
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
