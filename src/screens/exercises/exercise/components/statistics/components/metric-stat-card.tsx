import { StyleSheet } from 'react-native-unistyles';

import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';

interface MetricStatCardProps {
    value: string;
    label: string;
}

const styles = StyleSheet.create((theme) => ({
    card: {
        flex: 1,
        backgroundColor: theme.colors.foreground,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
        borderRadius: theme.radius['2xl'],
        paddingHorizontal: theme.space(3),
        paddingVertical: theme.space(2.5),
    },
    value: {
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    label: {
        ...theme.fontSize.xs,
        color: theme.colors.typography,
        opacity: 0.55,
    },
}));

export const MetricStatCard = ({ value, label }: MetricStatCardProps) => {
    return (
        <VStack style={styles.card}>
            <Text style={styles.value}>{value}</Text>
            <Text style={styles.label}>{label}</Text>
        </VStack>
    );
};
