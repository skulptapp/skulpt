module.exports = {
    name: process.env.APP_NAME || 'Skulpt',
    version: process.env.APP_VERSION || '1.0',
    owner: 'skulpt',
    slug: 'skulpt',
    orientation: 'portrait',
    scheme: 'skulpt',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    experiments: {
        typedRoutes: true,
        reactCompiler: true,
    },
    android: {
        versionCode: Number(process.env.APP_BUILD_NUMBER) || 1,
        package: process.env.APP_BUNDLE_IDENTIFIER || '',
        softwareKeyboardLayoutMode: 'pan',
        edgeToEdgeEnabled: true,
        adaptiveIcon: {
            foregroundImage: './assets/images/adaptive-icon.png',
            backgroundColor: '#a3e635',
        },
    },
    ios: {
        buildNumber: String(process.env.APP_BUILD_NUMBER) || '1',
        appleTeamId: process.env.APP_APPLE_TEAM_ID || '',
        bundleIdentifier: process.env.APP_BUNDLE_IDENTIFIER || '',
        supportsTablet: false,
        config: {
            usesNonExemptEncryption: false,
        },
        associatedDomains: ['applinks:skulpt.app', 'webcredentials:skulpt.app'],
        infoPlist: {
            CFBundleAllowMixedLocalizations: true,
            UIBackgroundModes: ['audio', 'remote-notification'],
            NSSupportsLiveActivities: true,
            NSSupportsLiveActivitiesFrequentUpdates: true,
        },
    },
    locales: {
        es: './src/locale/translations/meta/es.json',
        hi: './src/locale/translations/meta/hi.json',
        ru: './src/locale/translations/meta/ru.json',
        zh: './src/locale/translations/meta/zh.json',
    },
    icon:
        process.env.APP_VARIANT === 'development'
            ? './assets/images/icon-dev.png'
            : './assets/images/icon.png',
    plugins: [
        'expo-sqlite',
        'expo-audio',
        'expo-asset',
        'expo-mail-composer',
        '@bacons/apple-targets',
        [
            '@kingstinct/react-native-healthkit',
            {
                NSHealthShareUsageDescription: 'Skulpt reads your heart rate during workouts',
                NSHealthUpdateUsageDescription: 'Skulpt saves your completed workouts to Health',
            },
        ],
        'expo-health-connect',
        [
            'react-native-edge-to-edge',
            {
                android: {
                    parentTheme: 'Default',
                    enforceNavigationBarContrast: false,
                },
            },
        ],
        '@react-native-community/datetimepicker',
        [
            'expo-build-properties',
            {
                android: {
                    compileSdkVersion: 36,
                    targetSdkVersion: 34,
                    minSdkVersion: 26,
                },
            },
        ],
        [
            'expo-router',
            {
                root: './src/routes',
            },
        ],
        [
            'expo-localization',
            {
                supportedLocales: {
                    ios: ['en', 'es', 'hi', 'ru', 'zh'],
                    android: ['en', 'es', 'hi', 'ru', 'zh'],
                },
            },
        ],
        'expo-background-task',
        [
            'expo-notifications',
            {
                enableBackgroundRemoteNotifications: true,
            },
        ],
        [
            'react-native-permissions',
            {
                iosPermissions: ['AppTrackingTransparency', 'Notifications'],
            },
        ],
        [
            'expo-font',
            {
                fonts: [
                    './assets/fonts/Inter-Black.ttf',
                    './assets/fonts/Inter-Bold.ttf',
                    './assets/fonts/Inter-Medium.ttf',
                    './assets/fonts/Inter-Regular.ttf',
                    './assets/fonts/Inter-SemiBold.ttf',
                ],
            },
        ],
        [
            'expo-splash-screen',
            {
                image: './assets/images/splash-icon.png',
                imageWidth: 125,
                resizeMode: 'contain',
                backgroundColor: '#a3e635',
            },
        ],
        [
            '@sentry/react-native/expo',
            {
                project: process.env.APP_SENTRY_PROJECT || '',
                organization: process.env.APP_SENTRY_ORGANIZATION || '',
            },
        ],
    ],
    runtimeVersion: {
        policy: 'appVersion',
    },
    extra: {
        eas: {
            projectId: process.env.APP_EAS_PROJECT_ID,
        },
    },
    updates: {
        url: `https://u.expo.dev/${process.env.APP_EAS_PROJECT_ID}`,
        enableBsdiffPatchSupport: false,
    },
};
