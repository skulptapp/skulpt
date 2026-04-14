import { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { VStack } from '@/components/primitives/vstack';
import { Text } from '@/components/primitives/text';

interface MetricCardShellProps extends PropsWithChildren {
    title: string;
    description?: string;
}

const styles = StyleSheet.create((theme) => ({
    card: {
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius['4xl'],
        padding: theme.space(4),
        gap: theme.space(2),
    },
    header: {
        gap: theme.space(0.5),
    },
    title: {
        ...theme.fontSize.lg,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    description: {
        ...theme.fontSize.sm,
        color: theme.colors.typography,
        opacity: 0.6,
    },
}));

export const MetricCardShell = ({ title, description, children }: MetricCardShellProps) => {
    return (
        <VStack style={styles.card}>
            <VStack style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                {description ? <Text style={styles.description}>{description}</Text> : null}
            </VStack>
            {children}
        </VStack>
    );
};
