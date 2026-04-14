import React from 'react';

import { Stack } from '@/navigators/stack';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useSettingScreen } from '@/screens/settings/settings/hooks';
import { BackButton } from '@/components/buttons/back';
import { router } from 'expo-router';

export default function SettingsLayout() {
    const { options } = useSettingScreen();
    const { t } = useTranslation(['screens']);
    const { theme } = useUnistyles();

    const handleBack = () => {
        router.back();
    };

    return (
        <Stack
            screenOptions={{
                ...options,
                headerLeft: () => (
                    <BackButton
                        onPressHandler={handleBack}
                        backgroundColor={theme.colors.background}
                        iconColor={theme.colors.typography}
                    />
                ),
            }}
        >
            <Stack.Screen
                name="autolock"
                options={{
                    headerTitle: t('settings.items.autolock.title', { ns: 'screens' }),
                }}
            />
            <Stack.Screen
                name="notifications"
                options={{
                    headerTitle: t('settings.items.notifications.title', { ns: 'screens' }),
                }}
            />
            <Stack.Screen
                name="theme"
                options={{
                    headerTitle: t('settings.items.theme.title', { ns: 'screens' }),
                }}
            />
            <Stack.Screen
                name="sound"
                options={{
                    headerTitle: t('settings.items.sound.title', { ns: 'screens' }),
                }}
            />
            <Stack.Screen
                name="datetime"
                options={{
                    headerTitle: t('settings.items.dateTime.title', { ns: 'screens' }),
                }}
            />
            <Stack.Screen
                name="units"
                options={{
                    headerTitle: t('settings.items.units.title', { ns: 'screens' }),
                }}
            />
            <Stack.Screen
                name="language"
                options={{
                    headerTitle: t('settings.items.language.title', { ns: 'screens' }),
                }}
            />
            <Stack.Screen
                name="heartrate"
                options={{
                    headerTitle: t('settings.items.heartRate.title', { ns: 'screens' }),
                }}
            />
        </Stack>
    );
}
