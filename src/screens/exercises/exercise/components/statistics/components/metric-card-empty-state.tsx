import { StyleSheet } from 'react-native-unistyles';

import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';

interface MetricCardEmptyStateProps {
    title: string;
    description: string;
}

const styles = StyleSheet.create((theme) => ({
    content: {
        minHeight: theme.space(44),
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: theme.space(8),
        paddingVertical: theme.space(8),
        gap: theme.space(1),
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['2xl'],
    },
    title: {
        color: theme.colors.typography,
        ...theme.fontSize.default,
        fontWeight: theme.fontWeight.bold.fontWeight,
    },
    description: {
        ...theme.fontSize.sm,
        color: theme.colors.typography,
        opacity: 0.6,
        textAlign: 'center',
    },
}));

export const MetricCardEmptyState = ({ title, description }: MetricCardEmptyStateProps) => {
    return (
        <VStack style={styles.content}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
        </VStack>
    );
};
