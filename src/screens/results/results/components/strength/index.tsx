import { FC, useMemo, useState, useCallback } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { type LayoutChangeEvent, View } from 'react-native';

import { VStack } from '@/components/primitives/vstack';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { useStrengthRadarStats } from '@/hooks/use-workouts';
import { useUser } from '@/hooks/use-user';
import { type StrengthRadarMetricMap, type StrengthRadarMuscleKey } from '@/crud/workout';

// Base chart dimensions (designed at 160px, scaled proportionally)
const BASE_SIZE = 160;
const CHART_LEVELS = 4;
const BASE_CENTER_RADIUS = 12;
const BASE_RING_WIDTH = 15.5;
const BASE_RING_GAP = 1;
const BASE_CORNER_RADIUS = 4;
const VISUAL_GAP_INNER = 1.5;
const VISUAL_GAP_OUTER = 3;
const CHART_WIDTH_RATIO = 0.5;
const LABEL_OFFSET_RATIO = 1.45;

const RADAR_DATA_ORDER: readonly StrengthRadarMuscleKey[] = [
    'chest',
    'back',
    'shoulders',
    'arms',
    'legs',
    'core',
    'neck',
] as const;

const START_ANGLE = -90;
const SECTOR_STEP = 360 / RADAR_DATA_ORDER.length;

type StrengthMetricCard = {
    key: 'totalVolume' | 'workoutFrequency' | 'muscularLoad';
    title: string;
    values: StrengthRadarMetricMap;
};

const styles = StyleSheet.create((theme, rt) => ({
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
    cards: {
        gap: theme.space(3),
    },
    card: {
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['4xl'],
        padding: theme.space(4),
        paddingBottom: theme.space(0),
        gap: theme.space(1),
    },
    cardHeader: {
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    cardHeaderTitleRow: {
        alignItems: 'center',
        gap: theme.space(1.5),
    },
    cardTitle: {
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    chartContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        position: 'absolute',
        alignItems: 'center',
    },
    metricValue: {
        ...theme.fontSize.xs,
        color: theme.colors.typography,
        fontWeight: theme.fontWeight.bold.fontWeight,
    },
    metricMuscle: {
        ...theme.fontSize.xs,
        color: theme.colors.typography,
        fontWeight: theme.fontWeight.medium.fontWeight,
    },
}));

const clamp = (value: number, min: number, max: number): number => {
    if (value < min) return min;
    if (value > max) return max;
    return value;
};

const polarToCartesian = (cx: number, cy: number, radius: number, angleDegrees: number) => {
    const radians = (Math.PI / 180) * angleDegrees;
    return {
        x: cx + radius * Math.cos(radians),
        y: cy + radius * Math.sin(radians),
    };
};

const describeAnnularSector = (
    cx: number,
    cy: number,
    innerR: number,
    outerR: number,
    startAngle: number,
    endAngle: number,
    cornerRadius: number,
): string => {
    const cr = Math.min(cornerRadius, (outerR - innerR) / 2);
    const outerAO = (cr / outerR) * (180 / Math.PI);
    const innerAO = (cr / innerR) * (180 / Math.PI);

    const oS = polarToCartesian(cx, cy, outerR, startAngle + outerAO);
    const oE = polarToCartesian(cx, cy, outerR, endAngle - outerAO);
    const iS = polarToCartesian(cx, cy, innerR, startAngle + innerAO);
    const iE = polarToCartesian(cx, cy, innerR, endAngle - innerAO);

    const cOS = polarToCartesian(cx, cy, outerR, startAngle);
    const cOE = polarToCartesian(cx, cy, outerR, endAngle);
    const cIS = polarToCartesian(cx, cy, innerR, startAngle);
    const cIE = polarToCartesian(cx, cy, innerR, endAngle);

    const rOS = polarToCartesian(cx, cy, outerR - cr, startAngle);
    const rOE = polarToCartesian(cx, cy, outerR - cr, endAngle);
    const rIS = polarToCartesian(cx, cy, innerR + cr, startAngle);
    const rIE = polarToCartesian(cx, cy, innerR + cr, endAngle);

    return [
        `M ${rOS.x} ${rOS.y}`,
        `Q ${cOS.x} ${cOS.y} ${oS.x} ${oS.y}`,
        `A ${outerR} ${outerR} 0 0 1 ${oE.x} ${oE.y}`,
        `Q ${cOE.x} ${cOE.y} ${rOE.x} ${rOE.y}`,
        `L ${rIE.x} ${rIE.y}`,
        `Q ${cIE.x} ${cIE.y} ${iE.x} ${iE.y}`,
        `A ${innerR} ${innerR} 0 0 0 ${iS.x} ${iS.y}`,
        `Q ${cIS.x} ${cIS.y} ${rIS.x} ${rIS.y}`,
        'Z',
    ].join(' ');
};

type RingColorMap = Record<number, string[]>;

const buildRingColors = (theme: {
    colors: Record<string, Record<number, string>>;
}): RingColorMap => ({
    4: [
        theme.colors.lime[700],
        theme.colors.lime[600],
        theme.colors.lime[500],
        theme.colors.lime[400],
    ],
    3: [theme.colors.lime[700], theme.colors.lime[600], theme.colors.lime[500]],
    2: [theme.colors.lime[700], theme.colors.lime[600]],
    1: [theme.colors.lime[700]],
});

const getRingColor = (
    ringColors: RingColorMap,
    filledCount: number,
    levelIndex: number,
): string => {
    const palette = ringColors[filledCount];
    if (!palette) return '#8A8F99';
    return palette[levelIndex] || palette[palette.length - 1];
};

const getFilledCount = (value: number, maxValue: number): number => {
    if (value <= 0 || maxValue <= 0) return 0;
    const normalized = clamp(value / maxValue, 0, 1);
    return clamp(Math.round(normalized * CHART_LEVELS), 1, CHART_LEVELS);
};

const getValueColor = (
    ringColors: RingColorMap,
    value: number,
    maxValue: number,
    mutedColor: string,
): string => {
    const count = getFilledCount(value, maxValue);
    if (count <= 0) return mutedColor;
    const palette = ringColors[count];
    if (!palette) return mutedColor;
    return palette[palette.length - 1];
};

const formatNumber = (value: number): string => {
    if (!Number.isFinite(value)) return '0';
    if (Math.abs(value) >= 100 || Number.isInteger(value)) {
        return Math.round(value).toString();
    }
    return value.toFixed(1);
};

const resolveNumberLocale = (language: string | undefined): string => {
    const normalized = (language || 'en').toLowerCase();
    if (normalized.startsWith('ru')) return 'ru-RU';
    if (normalized.startsWith('es')) return 'es-ES';
    if (normalized.startsWith('hi')) return 'hi-IN';
    if (normalized.startsWith('zh')) return 'zh-CN';
    return 'en-US';
};

const formatCompactK = (value: number, numberLocale: string, kiloSuffix: string): string => {
    if (value < 1000) {
        return formatNumber(value);
    }

    const thousands = value / 1000;
    const fractionDigits = thousands >= 10 ? 1 : 2;
    return (
        thousands.toLocaleString(numberLocale, {
            minimumFractionDigits: 0,
            maximumFractionDigits: fractionDigits,
        }) + kiloSuffix
    );
};

const formatMetricValue = (
    metric: StrengthMetricCard['key'],
    value: number,
    weightUnits: 'kg' | 'lb' | null | undefined,
    numberLocale: string,
    t: (key: string, options?: Record<string, unknown>) => string,
): string => {
    const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;

    if (metric === 'totalVolume') {
        const unitKey = `weightUnit.${weightUnits || 'kg'}`;
        return (
            formatCompactK(
                safeValue,
                numberLocale,
                t('results.strength.kSuffix', { ns: 'screens' }),
            ) +
            ' ' +
            t(unitKey)
        );
    }

    if (metric === 'workoutFrequency') {
        const sessions = Math.round(safeValue);
        return t('results.strength.sessions', { ns: 'screens', count: sessions });
    }

    return Math.round(safeValue) + ' %';
};

const buildRadarData = (values: StrengthRadarMetricMap): number[] => {
    return RADAR_DATA_ORDER.map((muscle) => Math.max(0, values[muscle] || 0));
};

const buildSegments = (chartSize: number) => {
    const scale = chartSize / BASE_SIZE;
    const centerRadius = BASE_CENTER_RADIUS * scale;
    const ringWidth = BASE_RING_WIDTH * scale;
    const ringGap = BASE_RING_GAP * scale;
    const cornerRadius = BASE_CORNER_RADIUS * scale;
    const cx = chartSize / 2;
    const cy = chartSize / 2;

    return RADAR_DATA_ORDER.flatMap((_, sectorIndex) => {
        return Array.from({ length: CHART_LEVELS }, (_, levelIndex) => {
            const innerR = centerRadius + levelIndex * (ringWidth + ringGap);
            const outerR = innerR + ringWidth;

            const outerRForGap = centerRadius + levelIndex * (ringWidth + ringGap) + ringWidth;
            const t = CHART_LEVELS > 1 ? levelIndex / (CHART_LEVELS - 1) : 0;
            const targetGap = VISUAL_GAP_INNER + t * (VISUAL_GAP_OUTER - VISUAL_GAP_INNER);
            const span = Math.max(SECTOR_STEP - (targetGap * 180) / (Math.PI * outerRForGap), 5);
            const centerAngle = START_ANGLE + sectorIndex * SECTOR_STEP;
            const startAngle = centerAngle - span / 2;
            const endAngle = centerAngle + span / 2;

            return {
                key: sectorIndex + '-' + levelIndex,
                sectorIndex,
                levelIndex,
                path: describeAnnularSector(
                    cx,
                    cy,
                    innerR,
                    outerR,
                    startAngle,
                    endAngle,
                    cornerRadius,
                ),
            };
        });
    });
};

const StrengthRadialChart: FC<{
    chartSize: number;
    data: number[];
    maxValue: number;
    baseFillColor: string;
    ringColors: RingColorMap;
}> = ({ chartSize, data, maxValue, baseFillColor, ringColors }) => {
    const segments = useMemo(() => buildSegments(chartSize), [chartSize]);

    const filledLevels = useMemo(
        () => data.map((value) => getFilledCount(value, maxValue)),
        [data, maxValue],
    );

    return (
        <Svg width={chartSize} height={chartSize}>
            {segments.map((segment) => (
                <Path key={'base-' + segment.key} d={segment.path} fill={baseFillColor} />
            ))}

            {segments.map((segment) => {
                const levelCount = filledLevels[segment.sectorIndex] || 0;
                if (segment.levelIndex >= levelCount) {
                    return null;
                }

                return (
                    <Path
                        key={'value-' + segment.key}
                        d={segment.path}
                        fill={getRingColor(ringColors, levelCount, segment.levelIndex)}
                    />
                );
            })}
        </Svg>
    );
};

const StrengthChartCard: FC<{
    card: StrengthMetricCard;
    weightUnits: 'kg' | 'lb' | null | undefined;
}> = ({ card, weightUnits }) => {
    const { theme, rt } = useUnistyles();
    const { t, i18n } = useTranslation(['common', 'screens']);
    const [cardWidth, setCardWidth] = useState(0);

    const onCardLayout = useCallback((e: LayoutChangeEvent) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w > 0) setCardWidth(w);
    }, []);

    const radarData = useMemo(() => buildRadarData(card.values), [card.values]);

    const maxValue = useMemo(() => {
        const max = radarData.reduce((currentMax, item) => Math.max(currentMax, item), 0);
        return max > 0 ? max : 1;
    }, [radarData]);

    const baseFillColor =
        rt.themeName === 'dark' ? theme.colors.neutral[800] : theme.colors.neutral[200];
    const mutedValueColor =
        rt.themeName === 'dark' ? theme.colors.neutral[500] : theme.colors.neutral[500];
    const ringColors = useMemo(() => buildRingColors(theme), [theme]);
    const numberLocale = useMemo(
        () => resolveNumberLocale(i18n.resolvedLanguage || i18n.language),
        [i18n.language, i18n.resolvedLanguage],
    );

    // Compute chart size from card width
    const chartSize = Math.round(cardWidth * CHART_WIDTH_RATIO);
    const containerSize = cardWidth > 0 ? cardWidth - theme.space(8) : 0;
    const labelRadius = (chartSize / 2) * LABEL_OFFSET_RATIO;

    // Compute label positions
    const labelPositions = useMemo(() => {
        if (containerSize <= 0) return [];
        const containerCenter = containerSize / 2;

        return RADAR_DATA_ORDER.map((muscle, index) => {
            const angleDeg = START_ANGLE + index * SECTOR_STEP;
            const angleRad = (Math.PI / 180) * angleDeg;
            const x = containerCenter + labelRadius * Math.cos(angleRad);
            const y = containerCenter + labelRadius * Math.sin(angleRad);

            return { muscle, x, y, angleDeg };
        });
    }, [containerSize, labelRadius]);

    return (
        <VStack style={styles.card} onLayout={onCardLayout}>
            <HStack style={styles.cardHeader}>
                <HStack style={styles.cardHeaderTitleRow}>
                    <Text style={styles.cardTitle}>{card.title}</Text>
                </HStack>
            </HStack>

            {containerSize > 0 && (
                <View
                    style={[styles.chartContainer, { width: containerSize, height: containerSize }]}
                >
                    <StrengthRadialChart
                        chartSize={chartSize}
                        data={radarData}
                        maxValue={maxValue}
                        baseFillColor={baseFillColor}
                        ringColors={ringColors}
                    />

                    {labelPositions.map(({ muscle, x, y }) => {
                        const muscleValue = card.values[muscle];
                        const valueColor = getValueColor(
                            ringColors,
                            muscleValue,
                            maxValue,
                            mutedValueColor,
                        );

                        return (
                            <VStack
                                key={muscle}
                                style={[
                                    styles.label,
                                    {
                                        left: x,
                                        top: y,
                                        transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
                                    },
                                ]}
                            >
                                <Text
                                    allowFontScaling={false}
                                    adjustsFontSizeToFit
                                    minimumFontScale={0.7}
                                    numberOfLines={1}
                                    style={[styles.metricValue, { color: valueColor }]}
                                >
                                    {formatMetricValue(
                                        card.key,
                                        muscleValue,
                                        weightUnits,
                                        numberLocale,
                                        t,
                                    )}
                                </Text>
                                <Text
                                    allowFontScaling={false}
                                    numberOfLines={1}
                                    style={styles.metricMuscle}
                                >
                                    {t(`muscleGroup.${muscle}`)}
                                </Text>
                            </VStack>
                        );
                    })}
                </View>
            )}
        </VStack>
    );
};

const StrengthStats = () => {
    const { t } = useTranslation(['common', 'screens']);
    const { user } = useUser();
    const stats = useStrengthRadarStats();

    const cards: StrengthMetricCard[] = [
        {
            key: 'totalVolume',
            title: t('results.strength.metrics.totalVolume', { ns: 'screens' }),
            values: stats.totalVolume,
        },
        {
            key: 'workoutFrequency',
            title: t('results.strength.metrics.workoutFrequency', { ns: 'screens' }),
            values: stats.workoutFrequency,
        },
        {
            key: 'muscularLoad',
            title: t('results.strength.metrics.muscularLoad', { ns: 'screens' }),
            values: stats.muscularLoad,
        },
    ];

    return (
        <VStack style={styles.section}>
            <VStack style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('exerciseCategory.strength')}</Text>
            </VStack>
            <VStack style={styles.cards}>
                {cards.map((card) => (
                    <StrengthChartCard key={card.key} card={card} weightUnits={user?.weightUnits} />
                ))}
            </VStack>
        </VStack>
    );
};

export { StrengthStats };
