import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';

import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';

const styles = StyleSheet.create((theme, rt) => ({
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: theme.space(8),
        paddingBottom: rt.insets.bottom + theme.space(25),
        gap: theme.space(2),
    },
    emptyTitle: {
        color: theme.colors.typography,
        fontSize: theme.fontSize.xl.fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
    },
    emptyDescription: {
        color: theme.colors.typography,
        opacity: 0.6,
        textAlign: 'center',
    },
}));
const EmptyState: FC = () => {
    const { t } = useTranslation(['screens']);

    return (
        <VStack style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>{t('exercises.empty.title', { ns: 'screens' })}</Text>
            <Text style={styles.emptyDescription}>
                {t('exercises.empty.description', { ns: 'screens' })}
            </Text>
        </VStack>
    );
};

export { EmptyState };
