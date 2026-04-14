import { FC, useMemo } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { Box, BoxProps } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';

export type MetricGridItem = {
    key: string;
    value: string;
    label: string;
};

interface MetricGridProps {
    metrics: readonly MetricGridItem[];
    columns?: number;
    style?: BoxProps['style'];
}

const styles = StyleSheet.create((theme) => ({
    grid: {
        gap: theme.space(3),
    },
    row: {
        gap: theme.space(3),
    },
    card: {
        flex: 1,
    },
    value: {
        color: theme.colors.typography,
        fontSize: theme.fontSize.default.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
    },
    label: {
        color: theme.colors.typography,
        opacity: 0.55,
        fontSize: theme.fontSize.xs.fontSize,
        lineHeight: theme.fontSize.xs.lineHeight,
    },
}));

export const MetricGrid: FC<MetricGridProps> = ({ metrics, columns = 2, style }) => {
    const rows = useMemo(() => {
        if (columns <= 0) return [] as MetricGridItem[][];

        const chunkedRows: MetricGridItem[][] = [];
        for (let index = 0; index < metrics.length; index += columns) {
            chunkedRows.push(metrics.slice(index, index + columns));
        }
        return chunkedRows;
    }, [columns, metrics]);

    if (rows.length === 0) {
        return null;
    }

    return (
        <VStack style={[styles.grid, style]}>
            {rows.map((row, rowIndex) => (
                <HStack key={`metric-grid-row-${rowIndex}`} style={styles.row}>
                    {row.map((metric) => (
                        <VStack key={metric.key} style={styles.card}>
                            <Text style={styles.value}>{metric.value}</Text>
                            <Text style={styles.label}>{metric.label}</Text>
                        </VStack>
                    ))}
                    {row.length < columns &&
                        Array.from({ length: columns - row.length }).map((_, emptyIndex) => (
                            <Box
                                key={`metric-grid-empty-${rowIndex}-${emptyIndex}`}
                                style={styles.card}
                            />
                        ))}
                </HStack>
            ))}
        </VStack>
    );
};
