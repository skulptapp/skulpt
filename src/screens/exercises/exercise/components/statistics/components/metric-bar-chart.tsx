import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { BarChart } from 'react-native-gifted-charts';
import * as Haptics from 'expo-haptics';
import { type GestureResponderEvent, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { stableOutlineWidth } from '@/helpers/styles';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import type { MetricChartPoint } from './metric-utils';
import { roundOneDecimal } from './metric-utils';

const CHART_HEIGHT = 180;
const CHART_SECTIONS = 4;
const CHART_EDGE_INSET = 6;
const Y_AXIS_LABEL_AREA = 40;

interface MetricBarChartProps {
    points: MetricChartPoint[];
    formatTooltipValue: (value: number) => string;
    formatAxisValue?: (value: number) => string;
    maxValue?: number;
}

const styles = StyleSheet.create((theme) => ({
    chartWrap: {
        width: '100%',
        alignSelf: 'stretch',
        justifyContent: 'center',
        marginTop: theme.space(3),
    },
    chartFrame: {
        position: 'relative',
        width: '100%',
    },
    chartAxisLabel: {
        ...theme.fontSize['2xs'],
        color: theme.colors.typography,
        opacity: 0.6,
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
        zIndex: 4,
    },
    selectedGuide: {
        position: 'absolute',
        top: theme.space(10),
        bottom: theme.space(1.5),
        width: 1,
        zIndex: 2,
    },
    pointerLabel: {
        position: 'absolute',
        top: theme.space(1),
        paddingHorizontal: theme.space(1),
        paddingVertical: theme.space(1.5),
        borderRadius: theme.radius['2xl'],
        backgroundColor: theme.colors.background,
        borderWidth: stableOutlineWidth,
        borderColor: theme.colors.border,
        zIndex: 3,
    },
    pointerValue: {
        ...theme.fontSize.sm,
        color: theme.colors.typography,
        fontWeight: theme.fontWeight.bold.fontWeight,
        textAlign: 'center',
    },
    pointerDate: {
        ...theme.fontSize['2xs'],
        color: theme.colors.typography,
        opacity: 0.6,
        fontWeight: theme.fontWeight.medium.fontWeight,
        textAlign: 'center',
    },
}));

const defaultFormatAxisValue = (value: number): string => {
    const safeValue = Math.max(0, value);
    if (safeValue >= 100) return String(Math.round(safeValue));
    return String(roundOneDecimal(safeValue));
};

export const MetricBarChart = ({
    points,
    formatTooltipValue,
    formatAxisValue = defaultFormatAxisValue,
    maxValue,
}: MetricBarChartProps) => {
    const { theme } = useUnistyles();
    const [chartWidth, setChartWidth] = useState(0);
    const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);
    const [isScrubbing, setIsScrubbing] = useState(false);
    const lastHapticBarIndexRef = useRef<number | null>(null);

    const chartContentWidth = useMemo(
        () => Math.max(1, chartWidth - Y_AXIS_LABEL_AREA),
        [chartWidth],
    );

    const barWidth = theme.space(2);
    const barSpacing = theme.space(1);
    const barStep = barWidth + barSpacing;

    const chartMaxValue = useMemo(() => {
        const rawMaxValue = points.reduce((maxValue, point) => Math.max(maxValue, point.value), 0);
        const safeProvidedMaxValue =
            typeof maxValue === 'number' && Number.isFinite(maxValue) && maxValue > 0
                ? maxValue
                : null;
        if (safeProvidedMaxValue != null) {
            return Math.max(safeProvidedMaxValue, rawMaxValue);
        }
        if (rawMaxValue <= 0) return CHART_SECTIONS;

        const paddedMaxValue = rawMaxValue <= 40 ? rawMaxValue : rawMaxValue * 1.04;
        const normalizedMaxValue = Math.ceil(paddedMaxValue / CHART_SECTIONS) * CHART_SECTIONS;

        return Math.max(CHART_SECTIONS, normalizedMaxValue);
    }, [maxValue, points]);

    const yAxisLabels = useMemo(() => {
        const step = chartMaxValue / CHART_SECTIONS;
        return Array.from({ length: CHART_SECTIONS + 1 }, (_, index) =>
            formatAxisValue(chartMaxValue - index * step),
        );
    }, [chartMaxValue, formatAxisValue]);

    const xAxisTicks = useMemo(() => {
        if (points.length === 0) return [];
        const startLabel = points[0].label;
        const middleLabel = points[Math.floor((points.length - 1) / 2)]?.label || '';
        const endLabel = points[points.length - 1]?.label || '';

        return [startLabel, middleLabel, endLabel];
    }, [points]);

    const chartInitialSpacing = useMemo(() => {
        if (points.length === 0) return CHART_EDGE_INSET;

        const barsWidth = points.length * barWidth + Math.max(0, points.length - 1) * barSpacing;
        const rightAlignedSpacing = chartContentWidth - CHART_EDGE_INSET - barsWidth;

        return Math.max(CHART_EDGE_INSET, Math.floor(rightAlignedSpacing));
    }, [barSpacing, barWidth, chartContentWidth, points.length]);

    const firstBarCenterX = useMemo(
        () => chartInitialSpacing + barWidth / 2,
        [barWidth, chartInitialSpacing],
    );

    const lastBarCenterX = useMemo(
        () => firstBarCenterX + Math.max(0, points.length - 1) * barStep,
        [barStep, firstBarCenterX, points.length],
    );

    const clampedSelectedBarIndex = useMemo(() => {
        if (selectedBarIndex == null) return null;
        return Math.max(0, Math.min(selectedBarIndex, points.length - 1));
    }, [points.length, selectedBarIndex]);

    const selectedGuideX =
        clampedSelectedBarIndex == null
            ? null
            : Math.round(firstBarCenterX + clampedSelectedBarIndex * barStep);

    const selectedPoint =
        clampedSelectedBarIndex == null ? null : (points[clampedSelectedBarIndex] ?? null);

    const pointerLabelWidth = theme.space(22);

    const pointerLabelLeft = useMemo(() => {
        if (selectedGuideX == null) return 0;
        const left = selectedGuideX - pointerLabelWidth / 2;
        const maxLeft = Math.max(0, chartContentWidth - pointerLabelWidth);

        return Math.max(0, Math.min(left, maxLeft));
    }, [chartContentWidth, pointerLabelWidth, selectedGuideX]);

    const chartData = useMemo(() => points.map((point) => ({ value: point.value })), [points]);

    const resolveBarIndexFromTouchX = useCallback(
        (touchX: number) => {
            if (points.length <= 1) return 0;

            const clampedTouchX = Math.max(firstBarCenterX, Math.min(touchX, lastBarCenterX));
            const ratio = (clampedTouchX - firstBarCenterX) / barStep;

            return Math.round(ratio);
        },
        [barStep, firstBarCenterX, lastBarCenterX, points.length],
    );

    const handleChartTouch = useCallback(
        (event: GestureResponderEvent) => {
            const nextIndex = resolveBarIndexFromTouchX(event.nativeEvent.locationX);
            setSelectedBarIndex((prev) => (prev === nextIndex ? prev : nextIndex));
        },
        [resolveBarIndexFromTouchX],
    );

    const handleChartTouchStart = useCallback(
        (event: GestureResponderEvent) => {
            setIsScrubbing(true);
            handleChartTouch(event);
        },
        [handleChartTouch],
    );

    const resetScrubbingState = useCallback(() => {
        setIsScrubbing(false);
        setSelectedBarIndex(null);
    }, []);

    const handleChartTouchEnd = useCallback(() => {
        resetScrubbingState();
    }, [resetScrubbingState]);

    useEffect(() => {
        if (!isScrubbing || clampedSelectedBarIndex == null) {
            lastHapticBarIndexRef.current = null;
            return;
        }

        if (lastHapticBarIndexRef.current === clampedSelectedBarIndex) {
            return;
        }

        lastHapticBarIndexRef.current = clampedSelectedBarIndex;
        void Haptics.selectionAsync();
    }, [clampedSelectedBarIndex, isScrubbing]);

    if (points.length === 0) return null;

    return (
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
                    <BarChart
                        data={chartData}
                        width={chartContentWidth}
                        height={CHART_HEIGHT}
                        noOfSections={CHART_SECTIONS}
                        maxValue={chartMaxValue}
                        frontColor={theme.colors.lime[500]}
                        barBorderRadius={theme.radius.xs}
                        barWidth={barWidth}
                        spacing={barSpacing}
                        initialSpacing={chartInitialSpacing}
                        endSpacing={CHART_EDGE_INSET}
                        xAxisColor={theme.colors.border}
                        xAxisThickness={1}
                        hideYAxisText
                        yAxisLabelWidth={0}
                        yAxisThickness={0}
                        xAxisLabelsHeight={0}
                        labelsExtraHeight={0}
                        hideRules={false}
                        rulesColor={theme.colors.border}
                        rulesThickness={1}
                        disableScroll
                        adjustToWidth
                    />
                    <VStack pointerEvents="none" style={styles.yAxisOverlay}>
                        {yAxisLabels.map((label, index) => (
                            <Text key={`y-axis-${index}`} style={styles.chartAxisLabel}>
                                {label}
                            </Text>
                        ))}
                    </VStack>
                    {selectedGuideX != null && (
                        <View
                            pointerEvents="none"
                            style={[
                                styles.selectedGuide,
                                {
                                    left: selectedGuideX,
                                    backgroundColor: theme.colors.border,
                                    opacity: 0.95,
                                },
                            ]}
                        />
                    )}
                    {selectedPoint && (
                        <VStack
                            pointerEvents="none"
                            style={[
                                styles.pointerLabel,
                                {
                                    left: pointerLabelLeft,
                                    width: pointerLabelWidth,
                                },
                            ]}
                        >
                            <Text style={styles.pointerValue}>
                                {formatTooltipValue(selectedPoint.value)}
                            </Text>
                            <Text style={styles.pointerDate}>
                                {dayjs(selectedPoint.date).format('LL')}
                            </Text>
                        </VStack>
                    )}
                    <View
                        style={[styles.touchLayer, { width: chartContentWidth }]}
                        onStartShouldSetResponder={() => true}
                        onMoveShouldSetResponder={() => true}
                        onResponderGrant={handleChartTouchStart}
                        onResponderMove={handleChartTouch}
                        onResponderRelease={handleChartTouchEnd}
                        onResponderTerminate={handleChartTouchEnd}
                        onResponderTerminationRequest={() => false}
                    />
                </VStack>
            )}
            <HStack
                style={[
                    styles.xAxisMetaRow,
                    {
                        width: chartContentWidth,
                        paddingHorizontal: CHART_EDGE_INSET,
                    },
                ]}
            >
                {xAxisTicks.map((label, index) => (
                    <VStack key={`x-axis-${index}`} style={styles.xAxisTickItem}>
                        <Text
                            numberOfLines={1}
                            style={[
                                styles.chartAxisLabel,
                                index === 0
                                    ? styles.xAxisTickLabelStart
                                    : index === xAxisTicks.length - 1
                                      ? styles.xAxisTickLabelEnd
                                      : styles.xAxisTickLabelCenter,
                            ]}
                        >
                            {label}
                        </Text>
                    </VStack>
                ))}
            </HStack>
        </VStack>
    );
};
