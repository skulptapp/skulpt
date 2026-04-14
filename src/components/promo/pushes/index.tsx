import { useCallback, useMemo } from 'react';
import { RESULTS } from 'react-native-permissions';
import { StyleSheet } from 'react-native-unistyles';

import { Box, BoxProps } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { usePermissionsStore } from '@/stores/permissions';
import { useUser } from '@/hooks/use-user';
import { VStack } from '@/components/primitives/vstack';
import { Title } from '@/components/typography/title';
import { Button } from '@/components/buttons/base';
import { HStack } from '@/components/primitives/hstack';
import { useNotifications } from '@/hooks/use-notifications';
import { useTranslation } from 'react-i18next';

const styles = StyleSheet.create((theme, rt) => ({
    wrapper: {
        paddingHorizontal: theme.space(4),
    },
    container: {
        padding: theme.space(5),
        backgroundColor: rt.themeName === 'dark' ? theme.colors.white : theme.colors.neutral[950],
        borderRadius: theme.radius['4xl'],
        gap: theme.space(5),
    },
    messageContainer: {
        gap: theme.space(1),
    },
    title: {
        color: rt.themeName === 'dark' ? theme.colors.neutral[950] : theme.colors.white,
    },
    descriptionText: {
        color: rt.themeName === 'dark' ? theme.colors.neutral[950] : theme.colors.white,
        fontSize: theme.fontSize.sm.fontSize,
        lineHeight: theme.fontSize.sm.lineHeight,
        fontWeight: theme.fontWeight.default.fontWeight,
    },
    buttonsContainer: {
        gap: theme.space(5),
    },
    turnOnButton: {
        fontWeight: theme.fontWeight.semibold.fontWeight,
    },
    buttonText: {
        color: rt.themeName === 'dark' ? theme.colors.neutral[950] : theme.colors.white,
        fontSize: theme.fontSize.sm.fontSize,
        fontWeight: theme.fontWeight.default.fontWeight,
    },
}));

export const Pushes = ({ wrapperStyle }: { wrapperStyle?: BoxProps['style'] }) => {
    const { user, updateUser } = useUser();
    const { requestPermissions } = useNotifications();
    const { t } = useTranslation(['common']);

    const notifications = usePermissionsStore((state) => state.permissions.notifications);

    const showPushes = useMemo(() => {
        if (notifications && notifications !== RESULTS.GRANTED) {
            if (user?.isDelayedDate) {
                const delayTimestamp =
                    typeof user.isDelayedDate === 'number'
                        ? user.isDelayedDate
                        : user.isDelayedDate.getTime();

                if (delayTimestamp > Date.now()) return false;
            }
            return true;
        }
        return false;
    }, [notifications, user]);

    const handleTurnOn = useCallback(() => {
        requestPermissions();
    }, [requestPermissions]);

    const handleDelay = useCallback(() => {
        updateUser({
            isDelayed: true,
            isDelayedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
    }, [updateUser]);

    return (
        showPushes && (
            <Box style={[styles.wrapper, wrapperStyle]}>
                <VStack style={styles.container}>
                    <VStack style={styles.messageContainer}>
                        <Box>
                            <Title type="h5" style={styles.title}>
                                {t('promo.pushes.title', { ns: 'common' })}
                            </Title>
                        </Box>
                        <Box>
                            <Text style={styles.descriptionText}>
                                {t('promo.pushes.description', { ns: 'common' })}
                            </Text>
                        </Box>
                    </VStack>
                    <HStack style={styles.buttonsContainer}>
                        <Button
                            onPress={handleTurnOn}
                            type="link"
                            title={t('promo.pushes.turnOn', { ns: 'common' })}
                            textStyle={[styles.buttonText, styles.turnOnButton]}
                        />
                        <Button
                            onPress={handleDelay}
                            type="link"
                            title={t('promo.pushes.delay', { ns: 'common' })}
                            textStyle={styles.buttonText}
                        />
                    </HStack>
                </VStack>
            </Box>
        )
    );
};
