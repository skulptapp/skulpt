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
        playStoreUrl: process.env.PLAY_STORE_URL,
        softwareKeyboardLayoutMode: 'pan',
        edgeToEdgeEnabled: true,
        adaptiveIcon: {
            foregroundImage: './assets/images/adaptive-icon.png',
            backgroundColor: '#a3e635',
        },
        permissions: [
            'android.permission.health.WRITE_EXERCISE',
            'android.permission.health.READ_HEART_RATE',
            'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
            'android.permission.health.READ_BASAL_METABOLIC_RATE',
            'android.permission.health.READ_STEPS',
            'android.permission.health.READ_DISTANCE',
            'android.permission.health.READ_WEIGHT',
            'android.permission.health.READ_BODY_FAT',
            'android.permission.health.READ_LEAN_BODY_MASS',
            'android.permission.health.READ_BONE_MASS',
            'android.permission.health.READ_BODY_WATER_MASS',
        ],
    },
    ios: {
        buildNumber: String(process.env.APP_BUILD_NUMBER) || '1',
        appleTeamId: process.env.APP_APPLE_TEAM_ID || '',
        bundleIdentifier: process.env.APP_BUNDLE_IDENTIFIER || '',
        appStoreUrl: process.env.APP_STORE_URL,
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
        en: './src/locale/translations/meta/en.json',
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
        'expo-image',
        'expo-sharing',
        'expo-status-bar',
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
                    targetSdkVersion: 35,
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
                sounds: ['./assets/sounds/timer-end.wav'],
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
