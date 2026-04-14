import { useUnistyles, StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react-native';

import { HStack } from '@/components/primitives/hstack';
import { Pressable } from '@/components/primitives/pressable';
import { Box } from '@/components/primitives/box';
import { Title } from '@/components/typography/title';

interface HeaderProps {
    handleClose: () => void;
}

const styles = StyleSheet.create((theme) => ({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        justifyContent: 'flex-end',
        height: theme.screenHeaderHeight(),
        paddingHorizontal: theme.space(4),
    },
    wrapper: {
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    titleContainer: {
        minWidth: 0,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    title: {
        fontSize: theme.fontSize['4xl'].fontSize,
        fontWeight: theme.fontWeight.extrabold.fontWeight,
        lineHeight: theme.fontSize['4xl'].lineHeight,
        color: theme.colors.typography,
        textAlign: 'left',
    },
    closeContainer: {
        height: theme.space(11),
        width: theme.space(11),
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius.full,
    },
}));

const Header = ({ handleClose }: HeaderProps) => {
    const { theme } = useUnistyles();
    const { t } = useTranslation(['screens']);

    return (
        <Box style={styles.container}>
            <HStack style={styles.wrapper}>
                <Box style={styles.titleContainer}>
                    <Title type="h2">{t('exercise.tabs.guide', { ns: 'screens' })}</Title>
                </Box>
                <Box style={styles.closeContainer}>
                    <Pressable onPress={handleClose}>
                        <X size={theme.space(7)} color={theme.colors.typography} />
                    </Pressable>
                </Box>
            </HStack>
        </Box>
    );
};

export { Header };
