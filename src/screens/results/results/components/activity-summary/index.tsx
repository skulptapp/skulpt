import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { LineChart, type lineDataItem, yAxisSides } from 'react-native-gifted-charts';
import { type GestureResponderEvent, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import type { WorkoutSelect } from '@/db/schema';
import { useWorkouts } from '@/hooks/use-workouts';
import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';

const CHART_HEIGHT = 172;
const CHART_EDGE_INSET = 6;
const CHART_SECTIONS = 3;
const Y_AXIS_LABEL_AREA = 40;
const CURRENT_POINT_SIZE = 10;
const CURRENT_POINT_ACTIVE_SIZE = 12;
const CURRENT_POINT_BORDER_WIDTH = 1.5;

type ActivitySummaryModel = {
    timelineDays: number;
    todayIndex: number;
    currentSeries: number[];
    previousSeries: number[];
    currentDateLabels: string[];
    previousDateLabels: string[];
    xAxisTicks: string[];
    currentTotalSeconds: number;
    previousTotalSeconds: number;
    currentMonthLabel: string;
    previousMonthLabel: string;
    maxValue: number;
    yAxisLabels: string[];
};

type DurationUnits = {
    hr: string;
    min: string;
};

interface ActivitySummaryProps {
    onScrubbingChange?: (isScrubbing: boolean) => void;
}

const styles = StyleSheet.create((theme) => ({
    section: {
        gap: theme.space(3),
    },
    sectionHeader: {
        gap: theme.space(0.5),
    },
    sectionTitle: {
        ...theme.fontSize['2xl'],
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    card: {
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['4xl'],
        padding: theme.space(4),
        gap: theme.space(4),
    },
    monthHeader: {
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    monthTitle: {
        ...theme.fontSize.lg,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    monthNavButton: {
        height: theme.space(9),
        width: theme.space(9),
        borderRadius: theme.radius.full,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.background,
    },
    monthPrevIcon: {
        marginRight: theme.space(0.5),
    },
    monthNextIcon: {
        marginLeft: theme.space(0.5),
    },
    monthNavButtonDisabled: {
        opacity: 0.45,
    },
    valuesRow: {
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: theme.space(3),
    },
    valueBlock: {
        flex: 1,
    },
    prevValueBlock: {
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
    },
    valueText: {
        ...theme.fontSize['3xl'],
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
    },
    prevValueText: {
        ...theme.fontSize.lg,
        marginBottom: theme.space(0.5),
    },
    metaRow: {
        alignItems: 'center',
        gap: theme.space(1.5),
    },
    metaDot: {
        width: theme.space(2),
        height: theme.space(2),
        borderRadius: theme.radius.full,
    },
    metaLabel: {
        ...theme.fontSize.sm,
        color: theme.colors.typography,
        opacity: 0.6,
    },
    chartWrap: {
        width: '100%',
        alignSelf: 'stretch',
        justifyContent: 'center',
    },
    chartFrame: {
        position: 'relative',
        width: '100%',
    },
    yAxisOverlay: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: Y_AXIS_LABEL_AREA,
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    xAxisLabel: {
        ...theme.fontSize['2xs'],
        color: theme.colors.typography,
        opacity: 0.6,
    },
    yAxisLabel: {
        ...theme.fontSize['2xs'],
        color: theme.colors.typography,
        opacity: 0.6,
    },
    xAxisMetaRow: {
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: theme.space(1),
        alignSelf: 'flex-start',
    },
    xAxisTickItem: {
        flex: 1,
    },
    xAxisTickLabelStart: {
        textAlign: 'left',
    },
    xAxisTickLabelCenter: {
        textAlign: 'center',
    },
    xAxisTickLabelEnd: {
        textAlign: 'right',
    },
    touchLayer: {
        position: 'absolute',
        left: 0,
        top: 0,
        height: CHART_HEIGHT,
        zIndex: 2,
    },
    selectedDayGuide: {
        position: 'absolute',
        top: 8,
        bottom: 0,
        width: 1,
        zIndex: 1,
        height: CHART_HEIGHT,
    },
}));

const resolveWorkoutDate = (workout: WorkoutSelect): Date | null => {
    return workout.completedAt ?? workout.startedAt ?? workout.createdAt ?? null;
};

const resolveWorkoutDurationSeconds = (workout: WorkoutSelect): number => {
    if (typeof workout.duration === 'number' && Number.isFinite(workout.duration)) {
        return Math.max(0, workout.duration);
    }

    if (workout.startedAt && workout.completedAt) {
        return Math.max(
            0,
            Math.round((workout.completedAt.getTime() - workout.startedAt.getTime()) / 1000),
        );
    }

    return 0;
};

const toCumulativeSeries = (values: number[]): number[] => {
    const cumulative: number[] = [];
    let total = 0;

    for (const value of values) {
        total += Math.max(0, Math.round(value));
        cumulative.push(total);
    }

    return cumulative;
};

const formatDurationLabel = (totalSeconds: number, units: DurationUnits): string => {
    const safeSeconds = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}${units.hr} ${minutes}${units.min}`;
    }

    return `${minutes}${units.min}`;
};

const formatAxisTick = (valueSeconds: number, units: DurationUnits): string => {
    if (!Number.isFinite(valueSeconds) || valueSeconds <= 0) {
        return '0';
    }

    if (valueSeconds >= 3600) {
        const hours = valueSeconds / 3600;
        const rounded = hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10;
        return `${rounded}${units.hr}`;
    }

    return `${Math.round(valueSeconds / 60)}${units.min}`;
};

const formatMonthLabel = (monthStart: dayjs.Dayjs): string => {
    const formatted = monthStart.format('MMM YYYY');
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

const formatMonthTitle = (monthStart: dayjs.Dayjs): string => {
    const formatted = monthStart.format('MMMM YYYY');
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

const formatRangeLabel = (start: dayjs.Dayjs, end: dayjs.Dayjs): string => {
    if (start.isSame(end, 'month') && start.isSame(end, 'year')) {
        return `${start.format('D')}-${end.format('D MMM')}`;
    }

    return `${start.format('D MMM')} - ${end.format('D MMM')}`;
};

const buildXAxisTicks = (monthStart: dayjs.Dayjs, daysInMonth: number): string[] => {
    const endIndex = daysInMonth - 1;
    const middleIndex = Math.floor(endIndex / 2);

    return [0, middleIndex, endIndex].map((dayIndex) =>
        monthStart.date(dayIndex + 1).format('D MMM'),
    );
};

const buildActivitySummaryModel = (
    workouts: WorkoutSelect[],
    visibleMonthStart: dayjs.Dayjs,
    units: DurationUnits,
): ActivitySummaryModel => {
    const now = dayjs();
    const currentMonthStart = visibleMonthStart.startOf('month');
    const runtimeCurrentMonthStart = now.startOf('month');
    const isVisibleCurrentMonth = currentMonthStart.isSame(runtimeCurrentMonthStart, 'month');
    const timelineDays = currentMonthStart.daysInMonth();
    const previousPeriodStart = currentMonthStart.subtract(timelineDays, 'day').startOf('day');
    const previousPeriodEnd = currentMonthStart.subtract(1, 'day').startOf('day');
    const todayIndex = isVisibleCurrentMonth
        ? Math.min(timelineDays - 1, Math.max(0, now.date() - 1))
        : timelineDays - 1;

    const currentDurations = Array.from({ length: timelineDays }, () => 0);
    const previousDurations = Array.from({ length: timelineDays }, () => 0);

    for (const workout of workouts) {
        if (workout.status !== 'completed') continue;

        const workoutDate = resolveWorkoutDate(workout);
        if (!workoutDate) continue;

        const workoutDay = dayjs(workoutDate);
        if (!workoutDay.isValid()) continue;

        const durationSeconds = resolveWorkoutDurationSeconds(workout);
        if (durationSeconds <= 0) continue;

        if (workoutDay.isSame(currentMonthStart, 'month')) {
            currentDurations[workoutDay.date() - 1]! += durationSeconds;
            continue;
        }

        const isInPreviousWindow =
            !workoutDay.isBefore(previousPeriodStart, 'day') &&
            !workoutDay.isAfter(previousPeriodEnd, 'day');

        if (isInPreviousWindow) {
            const previousDayIndex = workoutDay.startOf('day').diff(previousPeriodStart, 'day');
            if (previousDayIndex >= 0 && previousDayIndex < timelineDays) {
                previousDurations[previousDayIndex] += durationSeconds;
            }
        }
    }

    const currentCumulative = toCumulativeSeries(currentDurations);
    const previousCumulative = toCumulativeSeries(previousDurations);

    const currentTotalSeconds = currentCumulative[todayIndex] ?? 0;
    const previousTotalSeconds = previousCumulative[previousCumulative.length - 1] ?? 0;

    const currentSeries = Array.from({ length: timelineDays }, (_, index) => {
        if (isVisibleCurrentMonth && index > todayIndex) {
            return currentTotalSeconds;
        }

        return currentCumulative[index] ?? currentTotalSeconds;
    });

    const previousSeries = Array.from(
        { length: timelineDays },
        (_, index) => previousCumulative[index] ?? 0,
    );
    const currentDateLabels = Array.from({ length: timelineDays }, (_, index) =>
        currentMonthStart.date(index + 1).format('D MMM'),
    );
    const previousDateLabels = Array.from({ length: timelineDays }, (_, index) =>
        previousPeriodStart.add(index, 'day').format('D MMM'),
    );

    const rawMaxValue = Math.max(
        currentTotalSeconds,
        previousTotalSeconds,
        ...currentSeries,
        ...previousSeries,
    );
    const maxValue = rawMaxValue > 0 ? Math.ceil(rawMaxValue * 1.08) : 3600;
    const axisStep = maxValue / CHART_SECTIONS;
    const yAxisLabels = Array.from({ length: CHART_SECTIONS + 1 }, (_, index) => {
        const fromTop = CHART_SECTIONS - index;
        return formatAxisTick(fromTop * axisStep, units);
    });
    const xAxisTicks = buildXAxisTicks(currentMonthStart, timelineDays);

    return {
        timelineDays,
        todayIndex,
        currentSeries,
        previousSeries,
        currentDateLabels,
        previousDateLabels,
        xAxisTicks,
        currentTotalSeconds,
        previousTotalSeconds,
        currentMonthLabel: formatMonthLabel(currentMonthStart),
        previousMonthLabel: formatRangeLabel(previousPeriodStart, previousPeriodEnd),
        maxValue,
        yAxisLabels,
    };
};

const ActivitySummary = ({ onScrubbingChange }: ActivitySummaryProps) => {
    const { t } = useTranslation(['common', 'screens']);
    const { theme, rt } = useUnistyles();
    const { data: workouts = [] } = useWorkouts();
    const [chartWidth, setChartWidth] = useState(0);
    const [visibleMonthStart, setVisibleMonthStart] = useState(() => dayjs().startOf('month'));
    const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
    const [isScrubbing, setIsScrubbing] = useState(false);
    const lastHapticDayIndexRef = useRef<number | null>(null);

    const durationUnits = useMemo<DurationUnits>(
        () => ({
            hr: t('durations.hr', { ns: 'common' }),
            min: t('durations.min', { ns: 'common' }),
        }),
        [t],
    );

    const model = useMemo(
        () => buildActivitySummaryModel(workouts, visibleMonthStart, durationUnits),
        [durationUnits, visibleMonthStart, workouts],
    );
    const monthTitle = useMemo(() => formatMonthTitle(visibleMonthStart), [visibleMonthStart]);
    const canGoForward = useMemo(() => {
        const currentMonthStart = dayjs().startOf('month');
        return visibleMonthStart.isBefore(currentMonthStart, 'month');
    }, [visibleMonthStart]);

    const currentLineColor = theme.colors.lime[400];
    const previousLineColor = theme.colors.border;

    const clampedSelectedDayIndex = useMemo(() => {
        if (selectedDayIndex == null) return null;
        return Math.max(0, Math.min(selectedDayIndex, model.timelineDays - 1));
    }, [model.timelineDays, selectedDayIndex]);

    const renderCurrentDataPoint = useCallback(
        (isActive: boolean) => (
            <View
                style={{
                    width: isActive ? CURRENT_POINT_ACTIVE_SIZE : CURRENT_POINT_SIZE,
                    height: isActive ? CURRENT_POINT_ACTIVE_SIZE : CURRENT_POINT_SIZE,
                    borderRadius: (isActive ? CURRENT_POINT_ACTIVE_SIZE : CURRENT_POINT_SIZE) / 1.5,
                    borderWidth: CURRENT_POINT_BORDER_WIDTH,
                    borderColor: currentLineColor,
                    backgroundColor: isActive ? currentLineColor : theme.colors.foreground,
                }}
            />
        ),
        [currentLineColor, theme.colors.foreground],
    );

    const chartData = useMemo(() => {
        const lineChartWidth = Math.max(1, chartWidth - Y_AXIS_LABEL_AREA);
        if (lineChartWidth <= 0) {
            return {
                current: [] as lineDataItem[],
                previous: [] as lineDataItem[],
            };
        }

        const timelineWidth = Math.max(0, lineChartWidth - CHART_EDGE_INSET * 2);
        const segmentSpacing =
            model.timelineDays > 1 ? timelineWidth / (model.timelineDays - 1) : 0;

        const current = model.currentSeries.map((value, index) => {
            const previousValue = index > 0 ? (model.currentSeries[index - 1] ?? 0) : 0;
            const shouldShowPoint = value > previousValue;
            const isActive =
                shouldShowPoint &&
                clampedSelectedDayIndex != null &&
                index === clampedSelectedDayIndex;
            const pointSize = isActive ? CURRENT_POINT_ACTIVE_SIZE : CURRENT_POINT_SIZE;

            return {
                value,
                spacing: index < model.currentSeries.length - 1 ? segmentSpacing : 0,
                hideDataPoint: !shouldShowPoint,
                customDataPoint: shouldShowPoint
                    ? () => renderCurrentDataPoint(isActive)
                    : undefined,
                dataPointWidth: shouldShowPoint ? pointSize : undefined,
                dataPointHeight: shouldShowPoint ? pointSize : undefined,
                dataPointRadius: shouldShowPoint ? pointSize / 2 : undefined,
            } satisfies lineDataItem;
        });

        const previous = model.previousSeries.map((value, index) => {
            return {
                value,
                spacing: index < model.previousSeries.length - 1 ? segmentSpacing : 0,
            } satisfies lineDataItem;
        });

        return { current, previous };
    }, [chartWidth, clampedSelectedDayIndex, model, renderCurrentDataPoint]);

    const lineChartWidth = Math.max(1, chartWidth - Y_AXIS_LABEL_AREA);
    const timelineWidth = Math.max(1, lineChartWidth - CHART_EDGE_INSET * 2);

    const displayedCurrentTotalSeconds =
        clampedSelectedDayIndex == null
            ? model.currentTotalSeconds
            : (model.currentSeries[clampedSelectedDayIndex] ?? model.currentTotalSeconds);
    const displayedPreviousTotalSeconds =
        clampedSelectedDayIndex == null
            ? model.previousTotalSeconds
            : (model.previousSeries[clampedSelectedDayIndex] ?? model.previousTotalSeconds);
    const displayedCurrentMetaLabel =
        clampedSelectedDayIndex == null
            ? model.currentMonthLabel
            : (model.currentDateLabels[clampedSelectedDayIndex] ?? model.currentMonthLabel);
    const displayedPreviousMetaLabel =
        clampedSelectedDayIndex == null
            ? model.previousMonthLabel
            : (model.previousDateLabels[clampedSelectedDayIndex] ?? model.previousMonthLabel);

    const selectedGuideX =
        clampedSelectedDayIndex == null || model.timelineDays <= 1
            ? null
            : Math.round(
                  CHART_EDGE_INSET +
                      (clampedSelectedDayIndex / (model.timelineDays - 1)) * timelineWidth,
              );

    const resolveDayIndexFromTouchX = useCallback(
        (touchX: number) => {
            if (model.timelineDays <= 1) return 0;

            const clampedTouchX = Math.max(
                CHART_EDGE_INSET,
                Math.min(touchX, CHART_EDGE_INSET + timelineWidth),
            );
            const ratio = (clampedTouchX - CHART_EDGE_INSET) / timelineWidth;
            return Math.round(ratio * (model.timelineDays - 1));
        },
        [model.timelineDays, timelineWidth],
    );

    const resetScrubbingState = useCallback(() => {
        setIsScrubbing(false);
        setSelectedDayIndex(null);
        onScrubbingChange?.(false);
    }, [onScrubbingChange]);

    const handleChartTouch = useCallback(
        (event: GestureResponderEvent) => {
            const nextIndex = resolveDayIndexFromTouchX(event.nativeEvent.locationX);
            setSelectedDayIndex((prev) => (prev === nextIndex ? prev : nextIndex));
        },
        [resolveDayIndexFromTouchX],
    );

    const handleChartTouchStart = useCallback(
        (event: GestureResponderEvent) => {
            setIsScrubbing(true);
            onScrubbingChange?.(true);
            handleChartTouch(event);
        },
        [handleChartTouch, onScrubbingChange],
    );

    const handleChartTouchEnd = useCallback(() => {
        resetScrubbingState();
    }, [resetScrubbingState]);

    const handlePrevMonth = useCallback(() => {
        resetScrubbingState();
        setVisibleMonthStart((prev) => prev.subtract(1, 'month').startOf('month'));
    }, [resetScrubbingState]);

    const handleNextMonth = useCallback(() => {
        if (!canGoForward) return;
        resetScrubbingState();
        setVisibleMonthStart((prev) => {
            const next = prev.add(1, 'month').startOf('month');
            const currentMonthStart = dayjs().startOf('month');
            return next.isAfter(currentMonthStart, 'month') ? prev : next;
        });
    }, [canGoForward, resetScrubbingState]);

    useEffect(() => {
        return () => {
            onScrubbingChange?.(false);
        };
    }, [onScrubbingChange]);

    useEffect(() => {
        if (!isScrubbing || clampedSelectedDayIndex == null) {
            lastHapticDayIndexRef.current = null;
            return;
        }

        if (lastHapticDayIndexRef.current === clampedSelectedDayIndex) {
            return;
        }

        lastHapticDayIndexRef.current = clampedSelectedDayIndex;
        void Haptics.selectionAsync();
    }, [clampedSelectedDayIndex, isScrubbing]);

    return (
        <VStack style={styles.section}>
            <VStack style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                    {t('results.activitySummary.title', { ns: 'screens' })}
                </Text>
            </VStack>
            <VStack style={styles.card}>
                <HStack style={styles.valuesRow}>
                    <VStack style={styles.valueBlock}>
                        <Text style={styles.valueText}>
                            {formatDurationLabel(displayedCurrentTotalSeconds, durationUnits)}
                        </Text>
                        <HStack style={styles.metaRow}>
                            <Box style={[styles.metaDot, { backgroundColor: currentLineColor }]} />
                            <Text style={styles.metaLabel}>{displayedCurrentMetaLabel}</Text>
                        </HStack>
                    </VStack>
                    <VStack style={[styles.valueBlock, styles.prevValueBlock]}>
                        <Text style={[styles.valueText, styles.prevValueText]}>
                            {formatDurationLabel(displayedPreviousTotalSeconds, durationUnits)}
                        </Text>
                        <HStack style={styles.metaRow}>
                            <Box style={[styles.metaDot, { backgroundColor: previousLineColor }]} />
                            <Text style={styles.metaLabel}>{displayedPreviousMetaLabel}</Text>
                        </HStack>
                    </VStack>
                </HStack>
                <VStack
                    style={styles.chartWrap}
                    onLayout={(event) => {
                        const width = Math.round(event.nativeEvent.layout.width);
                        if (width > 0 && width !== chartWidth) {
                            setChartWidth(width);
                        }
                    }}
                >
                    {chartWidth > 0 && (
                        <VStack style={styles.chartFrame}>
                            <LineChart
                                data={chartData.current}
                                data2={chartData.previous}
                                width={lineChartWidth}
                                height={CHART_HEIGHT}
                                disableScroll
                                adjustToWidth
                                initialSpacing={CHART_EDGE_INSET}
                                endSpacing={CHART_EDGE_INSET}
                                endIndex={model.todayIndex}
                                endIndex2={model.timelineDays - 1}
                                maxValue={model.maxValue}
                                noOfSections={CHART_SECTIONS}
                                thickness={4}
                                thickness2={2}
                                color={currentLineColor}
                                color2={previousLineColor}
                                hideDataPoints={false}
                                hideDataPoints1={false}
                                hideDataPoints2={true}
                                dataPointsRadius2={0}
                                dataPointsColor2="transparent"
                                xAxisThickness={1}
                                xAxisColor={theme.colors.border}
                                xAxisLabelsHeight={0}
                                labelsExtraHeight={0}
                                yAxisSide={yAxisSides.RIGHT}
                                hideYAxisText
                                yAxisLabelWidth={0}
                                yAxisThickness={0}
                                rulesColor={theme.colors.border}
                                rulesThickness={1}
                                hideRules={false}
                            />
                            {selectedGuideX != null && (
                                <Box
                                    pointerEvents="none"
                                    style={[
                                        styles.selectedDayGuide,
                                        {
                                            left: selectedGuideX,
                                            backgroundColor: theme.colors.border,
                                            opacity: 0.95,
                                        },
                                    ]}
                                />
                            )}
                            <View
                                style={[styles.touchLayer, { width: lineChartWidth }]}
                                onStartShouldSetResponder={() => true}
                                onMoveShouldSetResponder={() => true}
                                onResponderGrant={handleChartTouchStart}
                                onResponderMove={handleChartTouch}
                                onResponderRelease={handleChartTouchEnd}
                                onResponderTerminate={handleChartTouchEnd}
                                onResponderTerminationRequest={() => false}
                            />
                            <VStack pointerEvents="none" style={styles.yAxisOverlay}>
                                {model.yAxisLabels.map((label, index) => (
                                    <Text key={`y-axis-${index}`} style={styles.yAxisLabel}>
                                        {label}
                                    </Text>
                                ))}
                            </VStack>
                        </VStack>
                    )}
                    <HStack
                        style={[
                            styles.xAxisMetaRow,
                            {
                                width: lineChartWidth,
                                paddingHorizontal: CHART_EDGE_INSET,
                            },
                        ]}
                    >
                        {model.xAxisTicks.map((label, index) => (
                            <Box key={`x-axis-${index}`} style={styles.xAxisTickItem}>
                                <Text
                                    numberOfLines={1}
                                    style={[
                                        styles.xAxisLabel,
                                        index === 0
                                            ? styles.xAxisTickLabelStart
                                            : index === model.xAxisTicks.length - 1
                                              ? styles.xAxisTickLabelEnd
                                              : styles.xAxisTickLabelCenter,
                                    ]}
                                >
                                    {label}
                                </Text>
                            </Box>
                        ))}
                    </HStack>
                </VStack>
                <HStack style={styles.monthHeader}>
                    <Pressable onPress={handlePrevMonth} hitSlop={theme.space(2)}>
                        <Box style={styles.monthNavButton}>
                            <ChevronLeft
                                size={theme.space(6)}
                                style={styles.monthPrevIcon}
                                color={
                                    rt.themeName === 'dark'
                                        ? theme.colors.white
                                        : theme.colors.neutral[950]
                                }
                            />
                        </Box>
                    </Pressable>
                    <Text style={styles.monthTitle}>{monthTitle}</Text>
                    <Pressable
                        onPress={handleNextMonth}
                        disabled={!canGoForward}
                        hitSlop={theme.space(2)}
                    >
                        <Box
                            style={[
                                styles.monthNavButton,
                                !canGoForward && styles.monthNavButtonDisabled,
                            ]}
                        >
                            <ChevronRight
                                size={theme.space(6)}
                                style={styles.monthNextIcon}
                                color={
                                    rt.themeName === 'dark'
                                        ? theme.colors.white
                                        : theme.colors.neutral[950]
                                }
                            />
                        </Box>
                    </Pressable>
                </HStack>
            </VStack>
        </VStack>
    );
};

export { ActivitySummary };
