import { useEffect, useState } from 'react';
import { Alert, Platform, Share } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import * as MailComposer from 'expo-mail-composer';
import * as StoreReview from 'expo-store-review';
import {
    Globe,
    ChevronRight,
    Bell,
    Lock,
    Sun,
    Volume2,
    Clock,
    Languages,
    Heart,
    Megaphone,
    Mail,
    MessageCircle,
    Star,
    Undo2,
} from 'lucide-react-native';

import { Title } from '@/components/typography/title';
import { ScrollView } from '@/components/primitives/scrollview';
import { VStack } from '@/components/primitives/vstack';
import { Box } from '@/components/primitives/box';
import { Pressable } from '@/components/primitives/pressable';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';
import { Label } from '@/components/forms/label';
import { useUser } from '@/hooks/use-user';
import { useRunningWorkoutStatic } from '@/hooks/use-running-workout';
import { reportError } from '@/services/error-reporting';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.space(4),
    },
    content: {
        ...theme.screenContentPadding('root'),
        gap: theme.space(5),
    },
    settingsContainer: {
        flex: 1,
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius['4xl'],
        padding: theme.space(5),
    },
    settingsWrapper: {
        flex: 1,
    },
    settingContainer: {
        height: theme.space(8),
        alignItems: 'center',
        gap: theme.space(3),
    },
    iconContainer: {
        height: theme.space(8),
        width: theme.space(8),
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.foreground,
        borderRadius: theme.radius.lg,
    },
    settingContentContainer: {
        flex: 1,
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: theme.space(3),
    },
    settingTitleContainer: {
        gap: theme.space(2),
    },
    settingTitle: {
        color: theme.colors.typography,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
        marginLeft: theme.space(11),
        marginVertical: theme.space(2),
    },
    versionContainer: {
        gap: theme.space(1),
        alignItems: 'center',
        justifyContent: 'center',
    },
    versionText: {
        color: theme.colors.neutral[500],
        fontSize: theme.fontSize.sm.fontSize,
    },
    fieldContainer: {
        gap: theme.space(3),
    },
}));

const SettingsScreen = () => {
    const { user } = useUser();
    const { resetWatchSync } = useRunningWorkoutStatic();
    const { t } = useTranslation(['common', 'screens']);
    const { theme } = useUnistyles();

    const [isMailAvailable, setIsMailAvailable] = useState(false);

    useEffect(() => {
        MailComposer.isAvailableAsync()
            .then(setIsMailAvailable)
            .catch(() => {});
    }, []);

    const appVersion = Constants.expoConfig?.version;
    const buildVersion =
        Platform.OS === 'ios'
            ? Constants.expoConfig?.ios?.buildNumber
            : Constants.expoConfig?.android?.versionCode;

    const shareUrl = 'https://skulpt.app';

    const handleComposeEmail = (options: MailComposer.MailComposerOptions) => {
        MailComposer.composeAsync(options).catch(() => {});
    };

    const handleResetWatchSync = () => {
        Alert.alert(
            t('settings.items.resetWatchSync.confirmTitle', { ns: 'screens' }),
            t('settings.items.resetWatchSync.confirmDescription', { ns: 'screens' }),
            [
                {
                    text: t('cancel', { ns: 'common' }),
                    style: 'cancel',
                },
                {
                    text: t('reset', { ns: 'common' }),
                    style: 'destructive',
                    onPress: () => {
                        try {
                            resetWatchSync();
                            Alert.alert(
                                t('settings.items.resetWatchSync.successTitle', { ns: 'screens' }),
                                t('settings.items.resetWatchSync.successDescription', {
                                    ns: 'screens',
                                }),
                            );
                        } catch (error) {
                            reportError(error, 'Failed to reset watch sync state:');
                        }
                    },
                },
            ],
            {
                cancelable: true,
            },
        );
    };

    const settings = [
        {
            icon: Bell,
            title: t('settings.items.notifications.title', { ns: 'screens' }),
            onPress: () => router.navigate('/settings/notifications'),
        },
        {
            icon: Lock,
            title: t('settings.items.autolock.title', { ns: 'screens' }),
            onPress: () => router.navigate('/settings/autolock'),
        },
        {
            icon: Sun,
            title: t('settings.items.theme.title', { ns: 'screens' }),
            onPress: () => router.navigate('/settings/theme'),
        },
        {
            icon: Volume2,
            title: t('settings.items.sound.title', { ns: 'screens' }),
            onPress: () => router.navigate('/settings/sound'),
        },
        {
            icon: Clock,
            title: t('settings.items.dateTime.title', { ns: 'screens' }),
            onPress: () => router.navigate('/settings/datetime'),
        },
        {
            icon: Languages,
            title: t('settings.items.units.title', { ns: 'screens' }),
            onPress: () => router.navigate('/settings/units'),
        },
        {
            icon: Globe,
            title: t('settings.items.language.title', { ns: 'screens' }),
            onPress: () => router.navigate('/settings/language'),
        },
        {
            icon: Heart,
            title: t('settings.items.heartRate.title', { ns: 'screens' }),
            onPress: () => router.navigate('/settings/heartrate' as any),
        },
    ];

    const watch = [
        {
            icon: Undo2,
            title: t('settings.items.resetWatchSync.title', { ns: 'screens' }),
            onPress: handleResetWatchSync,
        },
    ];

    const help = [
        {
            icon: Megaphone,
            title: t('settings.help.items.reportProblem.title', { ns: 'screens' }),
            onPress: () =>
                handleComposeEmail({
                    subject: t('problem', { ns: 'common' }),
                    recipients: ['errors@skulpt.app'],
                    body: `\n\n---\n${t('code', { ns: 'common' })}: ${user?.id}`,
                }),
        },
        {
            icon: Mail,
            title: t('settings.help.items.sendFeedback.title', { ns: 'screens' }),
            onPress: () =>
                handleComposeEmail({
                    subject: t('feedback', { ns: 'common' }),
                    recipients: ['hello@skulpt.app'],
                    body: `\n\n---\n${t('code', { ns: 'common' })}: ${user?.id}`,
                }),
        },
    ];

    const supportSkulpt = [
        {
            icon: MessageCircle,
            title: t('settings.supportSkulpt.items.tellFriend.title', { ns: 'screens' }),
            onPress: () =>
                Share.share({
                    message: t('settings.supportSkulpt.items.reviewAppStore.message', {
                        ns: 'screens',
                        url: shareUrl,
                    }),
                }),
        },
        {
            icon: Star,
            title: t('settings.supportSkulpt.items.reviewAppStore.title', { ns: 'screens' }),
            onPress: () => StoreReview.requestReview(),
        },
    ];

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Title type="h1">{t('settings.title', { ns: 'screens' })}</Title>
            <VStack style={styles.settingsContainer}>
                <VStack style={styles.settingsWrapper}>
                    {settings.map((setting, index) => (
                        <VStack key={index}>
                            <Pressable onPress={setting.onPress}>
                                <HStack style={styles.settingContainer}>
                                    <Box style={styles.iconContainer}>
                                        <setting.icon
                                            size={theme.space(5)}
                                            strokeWidth={theme.space(0.375)}
                                            opacity={0.8}
                                            color={theme.colors.typography}
                                        />
                                    </Box>
                                    <HStack style={styles.settingContentContainer}>
                                        <VStack style={styles.settingTitleContainer}>
                                            <Box>
                                                <Text
                                                    fontWeight="medium"
                                                    style={styles.settingTitle}
                                                >
                                                    {setting.title}
                                                </Text>
                                            </Box>
                                        </VStack>
                                        <Box>
                                            <ChevronRight
                                                size={theme.space(5)}
                                                color={theme.colors.typography}
                                                opacity={0.8}
                                            />
                                        </Box>
                                    </HStack>
                                </HStack>
                            </Pressable>
                            {index < settings.length - 1 && <Box style={styles.divider} />}
                        </VStack>
                    ))}
                </VStack>
            </VStack>
            {Platform.OS === 'ios' && (
                <VStack style={styles.fieldContainer}>
                    <Label>{t('settings.watch.title', { ns: 'screens' })}</Label>
                    <VStack style={styles.settingsContainer}>
                        <VStack style={styles.settingsWrapper}>
                            {watch.map((setting, index) => (
                                <VStack key={index}>
                                    <Pressable onPress={setting.onPress}>
                                        <HStack style={styles.settingContainer}>
                                            <Box style={styles.iconContainer}>
                                                <setting.icon
                                                    size={theme.space(5)}
                                                    strokeWidth={theme.space(0.375)}
                                                    opacity={0.8}
                                                    color={theme.colors.typography}
                                                />
                                            </Box>
                                            <HStack style={styles.settingContentContainer}>
                                                <VStack style={styles.settingTitleContainer}>
                                                    <Box>
                                                        <Text
                                                            fontWeight="medium"
                                                            style={styles.settingTitle}
                                                        >
                                                            {setting.title}
                                                        </Text>
                                                    </Box>
                                                </VStack>
                                            </HStack>
                                        </HStack>
                                    </Pressable>
                                </VStack>
                            ))}
                        </VStack>
                    </VStack>
                </VStack>
            )}
            {isMailAvailable && (
                <VStack style={styles.fieldContainer}>
                    <Label>{t('settings.help.title', { ns: 'screens' })}</Label>
                    <VStack style={styles.settingsContainer}>
                        <VStack style={styles.settingsWrapper}>
                            {help.map((setting, index) => (
                                <VStack key={index}>
                                    <Pressable onPress={setting.onPress}>
                                        <HStack style={styles.settingContainer}>
                                            <Box style={styles.iconContainer}>
                                                <setting.icon
                                                    size={theme.space(5)}
                                                    strokeWidth={theme.space(0.375)}
                                                    opacity={0.8}
                                                    color={theme.colors.typography}
                                                />
                                            </Box>
                                            <HStack style={styles.settingContentContainer}>
                                                <VStack style={styles.settingTitleContainer}>
                                                    <Box>
                                                        <Text
                                                            fontWeight="medium"
                                                            style={styles.settingTitle}
                                                        >
                                                            {setting.title}
                                                        </Text>
                                                    </Box>
                                                </VStack>
                                            </HStack>
                                        </HStack>
                                    </Pressable>
                                    {index < help.length - 1 && <Box style={styles.divider} />}
                                </VStack>
                            ))}
                        </VStack>
                    </VStack>
                </VStack>
            )}
            <VStack style={styles.fieldContainer}>
                <Label>{t('settings.supportSkulpt.title', { ns: 'screens' })}</Label>
                <VStack style={styles.settingsContainer}>
                    <VStack style={styles.settingsWrapper}>
                        {supportSkulpt.map((setting, index) => (
                            <VStack key={index}>
                                <Pressable onPress={setting.onPress}>
                                    <HStack style={styles.settingContainer}>
                                        <Box style={styles.iconContainer}>
                                            <setting.icon
                                                size={theme.space(5)}
                                                strokeWidth={theme.space(0.375)}
                                                opacity={0.8}
                                                color={theme.colors.typography}
                                            />
                                        </Box>
                                        <HStack style={styles.settingContentContainer}>
                                            <VStack style={styles.settingTitleContainer}>
                                                <Box>
                                                    <Text
                                                        fontWeight="medium"
                                                        style={styles.settingTitle}
                                                    >
                                                        {setting.title}
                                                    </Text>
                                                </Box>
                                            </VStack>
                                        </HStack>
                                    </HStack>
                                </Pressable>
                                {index < help.length - 1 && <Box style={styles.divider} />}
                            </VStack>
                        ))}
                    </VStack>
                </VStack>
            </VStack>
            <HStack style={styles.versionContainer}>
                <Text style={styles.versionText}>{t('settings.version', { ns: 'screens' })}</Text>
                <Text style={styles.versionText}>{appVersion}</Text>
                <Text style={styles.versionText}>({buildVersion})</Text>
            </HStack>
        </ScrollView>
    );
};

export default SettingsScreen;
