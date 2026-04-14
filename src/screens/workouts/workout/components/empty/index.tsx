import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';

import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { WorkoutSelect } from '@/db/schema';

interface EmptyStateProps {
    workout?: WorkoutSelect;
}

const styles = StyleSheet.create((theme, rt) => ({
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: theme.space(8),
        paddingBottom: rt.insets.bottom,
        gap: theme.space(2),
    },
    emptyTitle: {
        fontSize: theme.fontSize.xl.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
        color: theme.colors.typography,
    },
    emptyDescription: {
        color: theme.colors.typography,
        opacity: 0.6,
        textAlign: 'center',
    },
}));
const EmptyState: FC<EmptyStateProps> = ({ workout }) => {
    const { t } = useTranslation(['screens']);

    const title = useMemo(() => {
        if (workout?.status) return t(`workout.empty.title.${workout.status}`, { ns: 'screens' });
        return t('workout.empty.title.planned', { ns: 'screens' });
    }, [t, workout]);

    const description = useMemo(() => {
        if (workout?.status)
            return t(`workout.empty.description.${workout.status}`, { ns: 'screens' });
        return t('workout.empty.description.planned', { ns: 'screens' });
    }, [t, workout]);

    return (
        <VStack style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>{title}</Text>
            <Text style={styles.emptyDescription}>{description}</Text>
        </VStack>
    );
};

export { EmptyState };
