import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
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
const DATA_POINT_SIZE = 8;
const CHART_TERMINAL_EDGE_INSET = DATA_POINT_SIZE / 2;
const WEIGHT_POINTS_PER_PAGE = 15;
const PAGE_OVERLAP_POINTS = 1;
const PAGE_PRERENDER_RADIUS = 1;
const CHART_POINTER_LABEL_WIDTH = 88;
const SCRUB_ACTIVATION_DELAY_MS = 180;
const SCRUB_CANCEL_THRESHOLD_PX = 8;

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
        top: 0,
        height: CHART_HEIGHT,
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

type WeightChartProps = {
    timeline: MeasurementWithDisplayValue[];
    weightUnits: 'kg' | 'lb';
    numberFormatter: Intl.NumberFormat;
};

const WeightChart = ({ timeline, weightUnits, numberFormatter }: WeightChartProps) => {
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();
    const [chartWidth, setChartWidth] = useState(0);
    const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [isScrubbing, setIsScrubbing] = useState(false);
    const pagerRef = useRef<PagerView>(null);
    const lastHapticPointIndexRef = useRef<number | null>(null);
    const currentPageIndexRef = useRef(0);
    const previousPageCountRef = useRef(0);
    const scrubActivationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrubTouchStartXRef = useRef<number | null>(null);
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
            const leftInset = pageIndex === 0 ? CHART_TERMINAL_EDGE_INSET : 0;
            const rightInset = pageIndex === pageRanges.length - 1 ? CHART_TERMINAL_EDGE_INSET : 0;
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
        if (timelinePages.length === 0) return 0;
        return Math.max(0, Math.min(currentPageIndex, timelinePages.length - 1));
    }, [currentPageIndex, timelinePages.length]);

    useEffect(() => {
        const pageCount = timelinePages.length;
        if (pageCount === 0) {
            previousPageCountRef.current = 0;
            currentPageIndexRef.current = 0;
            setCurrentPageIndex(0);
            return;
        }

        const previousPageCount = previousPageCountRef.current;
        setCurrentPageIndex((previousIndex) => {
            const maxIndex = pageCount - 1;
            const wasOnLastPage = previousPageCount === 0 || previousIndex >= previousPageCount - 1;

            if (wasOnLastPage) {
                return maxIndex;
            }

            return Math.max(0, Math.min(previousIndex, maxIndex));
        });
        previousPageCountRef.current = pageCount;
    }, [timelinePages.length]);

    useEffect(() => {
        if (!pagerRef.current || timelinePages.length === 0) return;
        if (currentPageIndexRef.current === clampedCurrentPageIndex) return;

        pagerRef.current.setPageWithoutAnimation(clampedCurrentPageIndex);
        currentPageIndexRef.current = clampedCurrentPageIndex;
    }, [clampedCurrentPageIndex, timelinePages.length]);

    const clampedSelectedPointIndex = useMemo(() => {
        if (selectedPointIndex == null) return null;
        return Math.max(0, Math.min(selectedPointIndex, timeline.length - 1));
    }, [selectedPointIndex, timeline.length]);

    const resolvePointIndexFromTouchX = useCallback(
        (touchX: number, pointCount: number, segmentSpacing: number, leftInset: number) => {
            if (pointCount <= 1) return 0;

            const firstPointX = leftInset;
            const lastPointX = leftInset + (pointCount - 1) * segmentSpacing;
            const clampedTouchX = Math.max(firstPointX, Math.min(touchX, lastPointX));
            const ratio = segmentSpacing > 0 ? (clampedTouchX - firstPointX) / segmentSpacing : 0;

            return Math.round(ratio);
        },
        [],
    );

    const clearPendingScrubActivation = useCallback(() => {
        if (scrubActivationTimeoutRef.current != null) {
            clearTimeout(scrubActivationTimeoutRef.current);
            scrubActivationTimeoutRef.current = null;
        }
        scrubTouchStartXRef.current = null;
    }, []);

    const beginScrubbingAt = useCallback(
        (
            touchX: number,
            pageStartIndex: number,
            pointCount: number,
            segmentSpacing: number,
            leftInset: number,
        ) => {
            isScrubbingRef.current = true;
            setIsScrubbing(true);

            const localPointIndex = resolvePointIndexFromTouchX(
                touchX,
                pointCount,
                segmentSpacing,
                leftInset,
            );
            const nextIndex = pageStartIndex + localPointIndex;
            setSelectedPointIndex((prev) => (prev === nextIndex ? prev : nextIndex));
        },
        [resolvePointIndexFromTouchX],
    );

    const resetScrubbingState = useCallback(() => {
        clearPendingScrubActivation();
        isScrubbingRef.current = false;
        setIsScrubbing(false);
        setSelectedPointIndex(null);
    }, [clearPendingScrubActivation]);

    const handleChartTouch = useCallback(
        (
            event: GestureResponderEvent,
            pageStartIndex: number,
            pointCount: number,
            segmentSpacing: number,
            leftInset: number,
        ) => {
            if (!isScrubbingRef.current) {
                return;
            }
            const localPointIndex = resolvePointIndexFromTouchX(
                event.nativeEvent.locationX,
                pointCount,
                segmentSpacing,
                leftInset,
            );
            const nextIndex = pageStartIndex + localPointIndex;
            setSelectedPointIndex((prev) => (prev === nextIndex ? prev : nextIndex));
        },
        [resolvePointIndexFromTouchX],
    );

    const handleTouchLayerStart = useCallback(
        (
            event: GestureResponderEvent,
            pageStartIndex: number,
            pointCount: number,
            segmentSpacing: number,
            leftInset: number,
        ) => {
            if (pointCount === 0) {
                return;
            }

            clearPendingScrubActivation();
            const touchX = event.nativeEvent.locationX;
            scrubTouchStartXRef.current = touchX;

            scrubActivationTimeoutRef.current = setTimeout(() => {
                scrubActivationTimeoutRef.current = null;
                beginScrubbingAt(touchX, pageStartIndex, pointCount, segmentSpacing, leftInset);
            }, SCRUB_ACTIVATION_DELAY_MS);
        },
        [beginScrubbingAt, clearPendingScrubActivation],
    );

    const handleTouchLayerMove = useCallback(
        (event: GestureResponderEvent) => {
            if (isScrubbingRef.current) {
                return;
            }

            if (scrubTouchStartXRef.current == null) {
                return;
            }

            const movedX = Math.abs(event.nativeEvent.locationX - scrubTouchStartXRef.current);
            if (movedX > SCRUB_CANCEL_THRESHOLD_PX) {
                clearPendingScrubActivation();
            }
        },
        [clearPendingScrubActivation],
    );

    const handleTouchLayerEnd = useCallback(() => {
        if (isScrubbingRef.current) {
            resetScrubbingState();
            return;
        }
        clearPendingScrubActivation();
    }, [clearPendingScrubActivation, resetScrubbingState]);

    const handleChartTouchEnd = useCallback(() => {
        if (isScrubbingRef.current) {
            resetScrubbingState();
        }
    }, [resetScrubbingState]);

    const handlePageSelected = useCallback(
        (event: PagerViewOnPageSelectedEvent) => {
            const nextPageIndex = event.nativeEvent.position;
            currentPageIndexRef.current = nextPageIndex;
            setCurrentPageIndex((prev) => (prev === nextPageIndex ? prev : nextPageIndex));
            resetScrubbingState();
        },
        [resetScrubbingState],
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

    useEffect(() => {
        return () => {
            if (scrubActivationTimeoutRef.current != null) {
                clearTimeout(scrubActivationTimeoutRef.current);
                scrubActivationTimeoutRef.current = null;
            }
        };
    }, []);

    const currentPage = timelinePages[clampedCurrentPageIndex] ?? null;
    const currentPageTicks = currentPage?.xAxisTicks ?? [];
    const currentPageLeftInset = currentPage?.leftInset ?? 0;
    const currentPageRightInset = currentPage?.rightInset ?? 0;

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
                                    pageIndex === clampedCurrentPageIndex &&
                                    clampedSelectedPointIndex != null &&
                                    clampedSelectedPointIndex >= page.startIndex &&
                                    clampedSelectedPointIndex <= page.endIndex
                                        ? clampedSelectedPointIndex - page.startIndex
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
                                                customDataPoint: () => (
                                                    <View
                                                        style={{
                                                            width: DATA_POINT_SIZE,
                                                            height: DATA_POINT_SIZE,
                                                            borderRadius: DATA_POINT_SIZE / 2,
                                                            borderWidth: 1.5,
                                                            borderColor: theme.colors.lime[400],
                                                            backgroundColor:
                                                                theme.colors.foreground,
                                                        }}
                                                    />
                                                ),
                                                dataPointWidth: DATA_POINT_SIZE,
                                                dataPointHeight: DATA_POINT_SIZE,
                                                dataPointRadius: DATA_POINT_SIZE / 2,
                                            }))}
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
                                            thickness={4}
                                            color={theme.colors.lime[400]}
                                            startFillColor={theme.colors.lime[400]}
                                            endFillColor={theme.colors.lime[400]}
                                            startOpacity={1}
                                            endOpacity={0.4}
                                            hideDataPoints={false}
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
                                        {selectedGuideX != null && (
                                            <Box
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
                                                        width: CHART_POINTER_LABEL_WIDTH,
                                                    },
                                                ]}
                                            >
                                                <Text style={styles.pointerValue}>
                                                    {`${numberFormatter.format(selectedPoint.displayValue)} ${weightUnits}`}
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
                                                handleTouchLayerStart(
                                                    event,
                                                    page.startIndex,
                                                    page.points.length,
                                                    page.segmentSpacing,
                                                    page.leftInset,
                                                )
                                            }
                                            onTouchMove={handleTouchLayerMove}
                                            onTouchEnd={handleTouchLayerEnd}
                                            onTouchCancel={handleTouchLayerEnd}
                                            onStartShouldSetResponder={() => false}
                                            onMoveShouldSetResponder={() => isScrubbingRef.current}
                                            onResponderGrant={(event) =>
                                                handleChartTouch(
                                                    event,
                                                    page.startIndex,
                                                    page.points.length,
                                                    page.segmentSpacing,
                                                    page.leftInset,
                                                )
                                            }
                                            onResponderMove={(event) =>
                                                handleChartTouch(
                                                    event,
                                                    page.startIndex,
                                                    page.points.length,
                                                    page.segmentSpacing,
                                                    page.leftInset,
                                                )
                                            }
                                            onResponderRelease={handleChartTouchEnd}
                                            onResponderTerminate={handleChartTouchEnd}
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
                    <Text style={styles.emptyChartText}>
                        {t('results.scale.chart.empty', { ns: 'screens' })}
                    </Text>
                </Box>
            )}
        </VStack>
    );
};

export { WeightChart };
