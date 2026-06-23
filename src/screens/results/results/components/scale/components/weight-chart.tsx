import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import * as Haptics from 'expo-haptics';
import { LineChart, yAxisSides } from 'react-native-gifted-charts';
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view';
import { type GestureResponderEvent, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { buildPageXAxisTicks } from '../utils';
import { type MeasurementWithDisplayValue, type WeightChartPage } from '../types';

const CHART_HEIGHT = 172;
const CHART_SECTIONS = 3;
const Y_AXIS_LABEL_AREA = 40;
const WEIGHT_POINTS_PER_PAGE = 15;
const PAGE_OVERLAP_POINTS = 1;
const PAGE_PRERENDER_RADIUS = 1;
const CHART_POINTER_LABEL_WIDTH = 88;
const SCRUB_ACTIVATION_DELAY_MS = 180;
const SCRUB_CANCEL_DISTANCE = 8;
const CHART_LINE_OPACITY = 0.2;
const CHART_GUIDE_OPACITY = 0.35;
const CHART_GUIDE_WIDTH = 2;
const CHART_GUIDE_DOT_SIZE = 8;
const CHART_EDGE_INSET = CHART_GUIDE_DOT_SIZE / 2;

const styles = StyleSheet.create((theme) => ({
    chartWrap: {
        width: '100%',
        justifyContent: 'center',
    },
    chartFrame: {
        position: 'relative',
        width: '100%',
    },
    chartViewport: {
        marginRight: Y_AXIS_LABEL_AREA,
    },
    chartPager: {
        width: '100%',
    },
    chartPage: {
        flex: 1,
    },
    xAxisLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: StyleSheet.hairlineWidth,
    },
    yAxisOverlay: {
        position: 'absolute',
        right: 0,
        top: 0,
        height: CHART_HEIGHT,
        width: Y_AXIS_LABEL_AREA,
        justifyContent: 'space-between',
        alignItems: 'flex-end',
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
    xAxisLabel: {
        ...theme.fontSize['2xs'],
        color: theme.colors.typography,
        opacity: 0.6,
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
        width: CHART_GUIDE_WIDTH,
        zIndex: 2,
    },
    selectedGuideDot: {
        position: 'absolute',
        width: CHART_GUIDE_DOT_SIZE,
        height: CHART_GUIDE_DOT_SIZE,
        borderRadius: CHART_GUIDE_DOT_SIZE / 2,
        zIndex: 3,
    },
    pointerLabel: {
        position: 'absolute',
        top: theme.space(1),
        paddingHorizontal: theme.space(1),
        paddingVertical: theme.space(1.5),
        borderRadius: theme.radius['2xl'],
        backgroundColor: theme.colors.background,
        borderWidth: StyleSheet.hairlineWidth,
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
    emptyChart: {
        height: CHART_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyChartText: {
        color: theme.colors.typography,
        opacity: 0.55,
    },
}));

const withAlpha = (color: string, alpha: number): string => {
    const normalized = color.trim();
    const hex = normalized.startsWith('#') ? normalized.slice(1) : normalized;
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
        return normalized;
    }

    const value = Number.parseInt(hex, 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

type WeightChartProps = {
    timeline: MeasurementWithDisplayValue[];
    numberFormatter: Intl.NumberFormat;
    formatValue: (value: number) => string;
    emptyText: string;
};

const WeightChart = ({ timeline, numberFormatter, formatValue, emptyText }: WeightChartProps) => {
    const { theme } = useUnistyles();
    const [chartWidth, setChartWidth] = useState(0);
    const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
    const [currentPageState, setCurrentPageState] = useState({ index: 0, pageCount: 0 });
    const [isScrubbing, setIsScrubbing] = useState(false);
    const pagerRef = useRef<PagerView>(null);
    const lastHapticPointIndexRef = useRef<number | null>(null);
    const currentPageIndexRef = useRef(0);
    const scrubActivationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestTouchXRef = useRef(0);
    const touchStartXRef = useRef(0);
    const touchStartYRef = useRef(0);
    const isScrubbingRef = useRef(false);

    const chartModel = useMemo(() => {
        if (timeline.length === 0) {
            return null;
        }

        const values = timeline.map((entry) => entry.displayValue);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const spread = Math.max(0.8, maxValue - minValue);
        const padding = Math.max(0.2, spread * 0.14);
        const axisMin = Math.max(0, minValue - padding);
        const axisMax = maxValue + padding;
        const shiftedMaxValue = Math.max(1, axisMax - axisMin);
        const sectionStep = shiftedMaxValue / CHART_SECTIONS;

        const yAxisLabels = Array.from({ length: CHART_SECTIONS + 1 }, (_, index) =>
            numberFormatter.format(axisMax - sectionStep * index),
        );

        return {
            axisMin,
            shiftedMaxValue,
            yAxisLabels,
        };
    }, [numberFormatter, timeline]);

    const lineChartViewportWidth = useMemo(
        () => Math.max(1, chartWidth - Y_AXIS_LABEL_AREA),
        [chartWidth],
    );

    const timelinePages = useMemo(() => {
        if (!chartModel || timeline.length === 0) {
            return [] as WeightChartPage[];
        }

        const pages: WeightChartPage[] = [];
        const pageRanges: { startIndex: number; endIndex: number }[] = [];
        let endIndex = timeline.length - 1;

        while (endIndex >= 0) {
            const startIndex = Math.max(0, endIndex - (WEIGHT_POINTS_PER_PAGE - 1));
            pageRanges.push({ startIndex, endIndex });

            if (startIndex === 0) {
                break;
            }

            endIndex = startIndex + PAGE_OVERLAP_POINTS - 1;
        }

        pageRanges.reverse().forEach(({ startIndex, endIndex }, pageIndex) => {
            const points = timeline.slice(startIndex, endIndex + 1);
            const leftInset = pageIndex === 0 ? CHART_EDGE_INSET : 0;
            const rightInset = pageIndex === pageRanges.length - 1 ? CHART_EDGE_INSET : 0;
            const segmentSpacing =
                points.length > 1
                    ? Math.max(
                          0,
                          (lineChartViewportWidth - leftInset - rightInset) / (points.length - 1),
                      )
                    : 0;

            pages.push({
                key: `weight-page-${startIndex}-${endIndex}`,
                startIndex,
                endIndex,
                leftInset,
                rightInset,
                segmentSpacing,
                points,
                xAxisTicks: buildPageXAxisTicks(points),
            });
        });

        return pages;
    }, [chartModel, lineChartViewportWidth, timeline]);

    const clampedCurrentPageIndex = useMemo(() => {
        const pageCount = timelinePages.length;
        if (pageCount === 0) return 0;

        const maxIndex = pageCount - 1;
        const wasOnLastPage =
            currentPageState.pageCount === 0 ||
            currentPageState.index >= currentPageState.pageCount - 1;

        if (wasOnLastPage) return maxIndex;

        return Math.max(0, Math.min(currentPageState.index, maxIndex));
    }, [currentPageState.index, currentPageState.pageCount, timelinePages.length]);

    useEffect(() => {
        if (timelinePages.length === 0) {
            currentPageIndexRef.current = 0;
            return;
        }
        if (!pagerRef.current) return;
        if (currentPageIndexRef.current === clampedCurrentPageIndex) return;

        pagerRef.current.setPageWithoutAnimation(clampedCurrentPageIndex);
        currentPageIndexRef.current = clampedCurrentPageIndex;
    }, [clampedCurrentPageIndex, timelinePages.length]);

    const clampedSelectedPointIndex = useMemo(() => {
        if (selectedPointIndex == null) return null;
        return Math.max(0, Math.min(selectedPointIndex, timeline.length - 1));
    }, [selectedPointIndex, timeline.length]);

    const clearScrubActivationTimeout = useCallback(() => {
        if (scrubActivationTimeoutRef.current == null) return;

        clearTimeout(scrubActivationTimeoutRef.current);
        scrubActivationTimeoutRef.current = null;
    }, []);

    const resolvePointIndexFromTouchX = useCallback(
        (page: WeightChartPage, touchX: number) => {
            if (page.points.length <= 1 || page.segmentSpacing <= 0) {
                return 0;
            }

            const clampedX = Math.max(0, Math.min(touchX, lineChartViewportWidth));
            const rawIndex = Math.round((clampedX - page.leftInset) / page.segmentSpacing);

            return Math.max(0, Math.min(rawIndex, page.points.length - 1));
        },
        [lineChartViewportWidth],
    );

    const selectPointFromTouch = useCallback(
        (page: WeightChartPage, pageIndex: number, touchX: number) => {
            if (pageIndex !== currentPageIndexRef.current) return;

            const localPointIndex = resolvePointIndexFromTouchX(page, touchX);
            const nextPointIndex = page.startIndex + localPointIndex;

            setSelectedPointIndex((prev) => (prev === nextPointIndex ? prev : nextPointIndex));
        },
        [resolvePointIndexFromTouchX],
    );

    const resetScrubbingState = useCallback(() => {
        clearScrubActivationTimeout();
        isScrubbingRef.current = false;
        setIsScrubbing(false);
        setSelectedPointIndex(null);
    }, [clearScrubActivationTimeout]);

    useEffect(() => () => clearScrubActivationTimeout(), [clearScrubActivationTimeout]);

    const handleChartTouchStart = useCallback(
        (event: GestureResponderEvent, page: WeightChartPage, pageIndex: number) => {
            clearScrubActivationTimeout();

            const { locationX, locationY } = event.nativeEvent;
            latestTouchXRef.current = locationX;
            touchStartXRef.current = locationX;
            touchStartYRef.current = locationY;
            isScrubbingRef.current = false;

            scrubActivationTimeoutRef.current = setTimeout(() => {
                scrubActivationTimeoutRef.current = null;
                isScrubbingRef.current = true;
                setIsScrubbing(true);
                selectPointFromTouch(page, pageIndex, latestTouchXRef.current);
            }, SCRUB_ACTIVATION_DELAY_MS);
        },
        [clearScrubActivationTimeout, selectPointFromTouch],
    );

    const handleChartTouchMove = useCallback(
        (event: GestureResponderEvent, page: WeightChartPage, pageIndex: number) => {
            const { locationX, locationY } = event.nativeEvent;
            latestTouchXRef.current = locationX;

            if (isScrubbingRef.current) {
                selectPointFromTouch(page, pageIndex, locationX);
                return;
            }

            const distanceX = Math.abs(locationX - touchStartXRef.current);
            const distanceY = Math.abs(locationY - touchStartYRef.current);

            if (distanceX > SCRUB_CANCEL_DISTANCE || distanceY > SCRUB_CANCEL_DISTANCE) {
                clearScrubActivationTimeout();
            }
        },
        [clearScrubActivationTimeout, selectPointFromTouch],
    );

    const handlePageSelected = useCallback(
        (event: PagerViewOnPageSelectedEvent) => {
            const nextPageIndex = event.nativeEvent.position;
            currentPageIndexRef.current = nextPageIndex;
            setCurrentPageState((prev) =>
                prev.index === nextPageIndex && prev.pageCount === timelinePages.length
                    ? prev
                    : { index: nextPageIndex, pageCount: timelinePages.length },
            );
            resetScrubbingState();
        },
        [resetScrubbingState, timelinePages.length],
    );

    useEffect(() => {
        if (!isScrubbing || clampedSelectedPointIndex == null) {
            lastHapticPointIndexRef.current = null;
            return;
        }

        if (lastHapticPointIndexRef.current === clampedSelectedPointIndex) {
            return;
        }

        lastHapticPointIndexRef.current = clampedSelectedPointIndex;
        void Haptics.selectionAsync();
    }, [clampedSelectedPointIndex, isScrubbing]);

    const currentPage = timelinePages[clampedCurrentPageIndex] ?? null;
    const currentPageTicks = currentPage?.xAxisTicks ?? [];
    const currentPageLeftInset = currentPage?.leftInset ?? 0;
    const currentPageRightInset = currentPage?.rightInset ?? 0;
    const chartColor = theme.colors.lime[400];
    const chartGuideColor = withAlpha(chartColor, CHART_GUIDE_OPACITY);

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
            {chartModel && chartWidth > 0 && timelinePages.length > 0 ? (
                <VStack style={styles.chartFrame}>
                    <VStack style={styles.chartViewport}>
                        <PagerView
                            ref={pagerRef}
                            style={[styles.chartPager, { height: CHART_HEIGHT }]}
                            initialPage={Math.max(0, timelinePages.length - 1)}
                            offscreenPageLimit={1}
                            scrollEnabled={timelinePages.length > 1 && !isScrubbing}
                            onPageSelected={handlePageSelected}
                        >
                            {timelinePages.map((page, pageIndex) => {
                                const shouldRenderPage =
                                    Math.abs(pageIndex - clampedCurrentPageIndex) <=
                                    PAGE_PRERENDER_RADIUS;

                                if (!shouldRenderPage) {
                                    return <View key={page.key} style={styles.chartPage} />;
                                }

                                const selectedLocalPointIndex =
                                    isScrubbing &&
                                    selectedPointIndex != null &&
                                    selectedPointIndex >= page.startIndex &&
                                    selectedPointIndex <= page.endIndex
                                        ? selectedPointIndex - page.startIndex
                                        : null;

                                const selectedGuideX =
                                    selectedLocalPointIndex == null
                                        ? null
                                        : Math.round(
                                              page.leftInset +
                                                  selectedLocalPointIndex * page.segmentSpacing,
                                          );

                                const selectedPoint =
                                    selectedLocalPointIndex == null
                                        ? null
                                        : (page.points[selectedLocalPointIndex] ?? null);

                                const selectedGuideY =
                                    selectedPoint == null
                                        ? null
                                        : Math.max(
                                              0,
                                              Math.min(
                                                  CHART_HEIGHT,
                                                  CHART_HEIGHT -
                                                      ((selectedPoint.displayValue -
                                                          chartModel.axisMin) /
                                                          chartModel.shiftedMaxValue) *
                                                          CHART_HEIGHT,
                                              ),
                                          );

                                const pointerLabelLeft =
                                    selectedGuideX == null
                                        ? 0
                                        : Math.max(
                                              0,
                                              Math.min(
                                                  selectedGuideX - CHART_POINTER_LABEL_WIDTH / 2,
                                                  Math.max(
                                                      0,
                                                      lineChartViewportWidth -
                                                          CHART_POINTER_LABEL_WIDTH,
                                                  ),
                                              ),
                                          );

                                return (
                                    <View key={page.key} style={styles.chartPage}>
                                        <LineChart
                                            data={page.points.map((entry, index) => ({
                                                value: entry.displayValue - chartModel.axisMin,
                                                spacing:
                                                    index < page.points.length - 1
                                                        ? page.segmentSpacing
                                                        : 0,
                                            }))}
                                            curved
                                            width={lineChartViewportWidth}
                                            height={CHART_HEIGHT}
                                            disableScroll
                                            adjustToWidth
                                            areaChart
                                            spacing={page.segmentSpacing}
                                            initialSpacing={page.leftInset}
                                            endSpacing={page.rightInset}
                                            maxValue={chartModel.shiftedMaxValue}
                                            noOfSections={CHART_SECTIONS}
                                            thickness={2}
                                            color={chartColor}
                                            startFillColor={chartColor}
                                            endFillColor={chartColor}
                                            startOpacity={1}
                                            startOpacity1={CHART_LINE_OPACITY}
                                            endOpacity={0}
                                            hideDataPoints
                                            hideYAxisText
                                            yAxisSide={yAxisSides.RIGHT}
                                            yAxisLabelWidth={0}
                                            yAxisThickness={0}
                                            xAxisThickness={0}
                                            xAxisColor={theme.colors.border}
                                            xAxisLabelsHeight={0}
                                            labelsExtraHeight={0}
                                            rulesColor={theme.colors.border}
                                            rulesThickness={1}
                                            hideRules={false}
                                        />
                                        <Box
                                            pointerEvents="none"
                                            style={[
                                                styles.xAxisLine,
                                                {
                                                    backgroundColor: theme.colors.border,
                                                },
                                            ]}
                                        />
                                        {selectedGuideX != null && selectedGuideY != null && (
                                            <>
                                                <Box
                                                    pointerEvents="none"
                                                    style={[
                                                        styles.selectedGuide,
                                                        {
                                                            left:
                                                                selectedGuideX -
                                                                CHART_GUIDE_WIDTH / 2,
                                                            top: selectedGuideY + CHART_EDGE_INSET,
                                                            height: Math.max(
                                                                0,
                                                                CHART_HEIGHT - selectedGuideY,
                                                            ),
                                                            backgroundColor: chartGuideColor,
                                                        },
                                                    ]}
                                                />
                                                <Box
                                                    pointerEvents="none"
                                                    style={[
                                                        styles.selectedGuideDot,
                                                        {
                                                            left:
                                                                selectedGuideX -
                                                                CHART_GUIDE_DOT_SIZE / 2,
                                                            top: selectedGuideY + CHART_EDGE_INSET,
                                                            backgroundColor: chartColor,
                                                        },
                                                    ]}
                                                />
                                            </>
                                        )}
                                        {selectedPoint && (
                                            <VStack
                                                pointerEvents="none"
                                                style={[
                                                    styles.pointerLabel,
                                                    {
                                                        left: pointerLabelLeft,
                                                        width: CHART_POINTER_LABEL_WIDTH,
                                                    },
                                                ]}
                                            >
                                                <Text style={styles.pointerValue}>
                                                    {formatValue(selectedPoint.displayValue)}
                                                </Text>
                                                <Text style={styles.pointerDate}>
                                                    {dayjs(selectedPoint.recordedAt).format(
                                                        'D MMM YYYY',
                                                    )}
                                                </Text>
                                            </VStack>
                                        )}
                                        <View
                                            style={[
                                                styles.touchLayer,
                                                { width: lineChartViewportWidth },
                                            ]}
                                            onTouchStart={(event) =>
                                                handleChartTouchStart(event, page, pageIndex)
                                            }
                                            onTouchMove={(event) =>
                                                handleChartTouchMove(event, page, pageIndex)
                                            }
                                            onTouchEnd={resetScrubbingState}
                                            onTouchCancel={resetScrubbingState}
                                            onStartShouldSetResponder={() => false}
                                            onMoveShouldSetResponder={() => isScrubbingRef.current}
                                            onResponderGrant={(event) =>
                                                handleChartTouchMove(event, page, pageIndex)
                                            }
                                            onResponderMove={(event) =>
                                                handleChartTouchMove(event, page, pageIndex)
                                            }
                                            onResponderRelease={resetScrubbingState}
                                            onResponderTerminate={resetScrubbingState}
                                            onResponderTerminationRequest={() =>
                                                !isScrubbingRef.current
                                            }
                                        />
                                    </View>
                                );
                            })}
                        </PagerView>
                        <HStack
                            style={[
                                styles.xAxisMetaRow,
                                {
                                    width: lineChartViewportWidth,
                                    paddingLeft: currentPageLeftInset,
                                    paddingRight: currentPageRightInset,
                                },
                            ]}
                        >
                            {currentPageTicks.map((tick, index) => (
                                <Box
                                    key={`scale-x-axis-${clampedCurrentPageIndex}-${index}`}
                                    style={styles.xAxisTickItem}
                                >
                                    <Text
                                        numberOfLines={1}
                                        style={[
                                            styles.xAxisLabel,
                                            tick.align === 'start'
                                                ? styles.xAxisTickLabelStart
                                                : tick.align === 'end'
                                                  ? styles.xAxisTickLabelEnd
                                                  : styles.xAxisTickLabelCenter,
                                        ]}
                                    >
                                        {tick.label}
                                    </Text>
                                </Box>
                            ))}
                        </HStack>
                    </VStack>
                    <VStack pointerEvents="none" style={styles.yAxisOverlay}>
                        {chartModel.yAxisLabels.map((label, index) => (
                            <Text key={`scale-y-axis-${index}`} style={styles.yAxisLabel}>
                                {label}
                            </Text>
                        ))}
                    </VStack>
                </VStack>
            ) : (
                <Box style={styles.emptyChart}>
                    <Text style={styles.emptyChartText}>{emptyText}</Text>
                </Box>
            )}
        </VStack>
    );
};

export { WeightChart };
