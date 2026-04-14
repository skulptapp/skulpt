import 'react-native-reanimated';
import { FC, useEffect } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import dayjs from 'dayjs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { useDrizzleStudio } from 'expo-drizzle-studio-plugin';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';

import migrations from '../../drizzle/migrations';

import { db, dbConnection } from '@/db';
import i18n from '@/locale/i18n';
import { useUser, UserProvider } from '@/hooks/use-user';
import { queryClient } from '@/queries';
import { SyncProvider } from '@/hooks/use-sync';
import { Stack } from '@/navigators/stack';
import { useScreen } from '@/hooks/use-screen';
import { NotificationsProvider } from '@/hooks/use-notifications';
import Actions from '@/components/overlays/actions';
import RestInput from '@/components/overlays/rest';
import { RunningWorkoutProvider } from '@/hooks/use-running-workout';
import { AnalyticsProvider } from '@/hooks/use-analytics';
import { useHealthImporter } from '@/hooks/use-health-importer';

import 'dayjs/locale/en';
import 'dayjs/locale/ru';
import 'dayjs/locale/zh';
import 'dayjs/locale/es';
import 'dayjs/locale/hi';
import { AudioProvider } from '@/hooks/use-audio';

export { ErrorBoundary } from 'expo-router';

// Set initial dayjs locale
dayjs.locale(i18n.language);

// Listen for language changes and update dayjs locale
i18n.on('languageChanged', (lng) => {
    dayjs.locale(lng);
});

const navigationIntegration = Sentry.reactNavigationIntegration({
    enableTimeToInitialDisplay: !isRunningInExpoGo(),
});

Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    debug: false,
    tracesSampleRate: 0,
    integrations: [navigationIntegration],
    enableNativeFramesTracking: !isRunningInExpoGo(),
});

export const unstable_settings = {
    initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const App: FC = () => {
    const { user } = useUser();
    const { options } = useScreen();

    useHealthImporter(user ?? undefined);

    useEffect(() => {
        if (user) {
            SplashScreen.hideAsync();
        }
    }, [user]);

    if (!user) return null;

    return (
        <SyncProvider>
            <RunningWorkoutProvider>
                <BottomSheetModalProvider>
                    <Stack
                        screenOptions={{
                            ...options,
                            headerShown: false,
                        }}
                    >
                        <Stack.Screen name="(tabs)" />
                        <Stack.Screen name="workout" />
                        <Stack.Screen name="settings" />
                        <Stack.Screen
                            name="editor"
                            options={{
                                presentation: 'modal',
                                animationTypeForReplace: 'pop',
                                cardOverlayEnabled: false,
                                animation: 'slide_from_bottom',
                            }}
                        />
                        <Stack.Screen
                            name="select"
                            options={{
                                presentation: 'modal',
                                animationTypeForReplace: 'pop',
                                cardOverlayEnabled: false,
                                animation: 'slide_from_bottom',
                            }}
                        />
                        <Stack.Screen
                            name="preview"
                            options={{
                                presentation: 'modal',
                                animationTypeForReplace: 'pop',
                                cardOverlayEnabled: false,
                                animation: 'slide_from_bottom',
                            }}
                        />
                        <Stack.Screen
                            name="guide"
                            options={{
                                presentation: 'modal',
                                animationTypeForReplace: 'pop',
                                cardOverlayEnabled: false,
                                animation: 'slide_from_bottom',
                            }}
                        />
                        <Stack.Screen
                            name="day"
                            options={{
                                presentation: 'modal',
                                animationTypeForReplace: 'pop',
                                cardOverlayEnabled: false,
                                animation: 'slide_from_bottom',
                            }}
                        />
                        <Stack.Screen
                            name="filter"
                            options={{
                                presentation: 'modal',
                                animationTypeForReplace: 'pop',
                                cardOverlayEnabled: false,
                                animation: 'slide_from_bottom',
                            }}
                        />
                    </Stack>
                    <Actions />
                    <RestInput />
                </BottomSheetModalProvider>
            </RunningWorkoutProvider>
        </SyncProvider>
    );
};

const RootLayout: FC = () => {
    const { success: dbSuccess, error: dbError } = useMigrations(db, migrations);

    useDrizzleStudio(process.env.NODE_ENV !== 'production' ? dbConnection : null);

    const [fontsLoaded, fontsError] = useFonts({
        InterRegular: require('../../assets/fonts/Inter-Regular.ttf'),
        InterMedium: require('../../assets/fonts/Inter-Medium.ttf'),
        InterSemibold: require('../../assets/fonts/Inter-SemiBold.ttf'),
        InterBold: require('../../assets/fonts/Inter-Bold.ttf'),
        InterExtraBold: require('../../assets/fonts/Inter-ExtraBold.ttf'),
        InterBlack: require('../../assets/fonts/Inter-Black.ttf'),
    });

    useEffect(() => {
        if (fontsError) throw fontsError;
        if (dbError) throw dbError;
    }, [dbError, fontsError]);

    if (!dbSuccess || !fontsLoaded) {
        return null;
    }

    return (
        <GestureHandlerRootView>
            <KeyboardProvider>
                <QueryClientProvider client={queryClient}>
                    <UserProvider>
                        <AnalyticsProvider>
                            <NotificationsProvider>
                                <AudioProvider>
                                    <App />
                                </AudioProvider>
                            </NotificationsProvider>
                        </AnalyticsProvider>
                    </UserProvider>
                </QueryClientProvider>
            </KeyboardProvider>
        </GestureHandlerRootView>
    );
};

export default Sentry.wrap(RootLayout);
