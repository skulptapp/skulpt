import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';

import { Title } from '@/components/typography/title';
import { Box } from '@/components/primitives/box';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        paddingHorizontal: theme.space(4),
    },
}));

export const Header: FC = () => {
    const { t } = useTranslation(['screens']);

    return (
        <Box style={styles.container}>
            <Title type="h1">{t('home.title', { ns: 'screens' })}</Title>
        </Box>
    );
};
