import { storage } from '@/storage';
import { Platform } from 'react-native';
import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles';

const FONT_SIZE_BASE = 16;
const SPACE = 4;

const common = {
    radius: {
        none: 0,
        xs: 2,
        sm: 4,
        md: 6,
        lg: 8,
        xl: 12,
        '2xl': 16,
        '3xl': 24,
        '4xl': 32,
        full: 9999,
    },
    fontSize: {
        '2xs': {
            fontSize: FONT_SIZE_BASE * 0.625,
            lineHeight: FONT_SIZE_BASE * 1,
        },
        xs: {
            fontSize: FONT_SIZE_BASE * 0.75,
            lineHeight: FONT_SIZE_BASE * 1,
        },
        sm: {
            fontSize: FONT_SIZE_BASE * 0.875,
            lineHeight: FONT_SIZE_BASE * 1.25,
        },
        default: {
            fontSize: FONT_SIZE_BASE,
            lineHeight: FONT_SIZE_BASE * 1.5,
        },
        lg: {
            fontSize: FONT_SIZE_BASE * 1.125,
            lineHeight: FONT_SIZE_BASE * 1.5,
        },
        xl: {
            fontSize: FONT_SIZE_BASE * 1.25,
            lineHeight: FONT_SIZE_BASE * 1.5,
        },
        '2xl': {
            fontSize: FONT_SIZE_BASE * 1.375,
            lineHeight: FONT_SIZE_BASE * 1.75,
        },
        '3xl': {
            fontSize: FONT_SIZE_BASE * 1.75,
            lineHeight: FONT_SIZE_BASE * 2.125,
        },
        '4xl': {
            fontSize: FONT_SIZE_BASE * 2.125,
            lineHeight: FONT_SIZE_BASE * 2.55,
        },
    },
    fontWeight: {
        default: {
            fontWeight: 400,
        },
        medium: {
            fontWeight: 500,
        },
        semibold: {
            fontWeight: 600,
        },
        bold: {
            fontWeight: 700,
        },
        extrabold: {
            fontWeight: 800,
        },
        black: {
            fontWeight: 900,
        },
    } as const,
};

const func = {
    space: (v: number) => v * SPACE,
    statusBarHeight: () => {
        const hasDynamicIsland = Platform.OS === 'ios' && UnistylesRuntime.insets.top > 50;
        return hasDynamicIsland ? UnistylesRuntime.insets.top - 6 : UnistylesRuntime.insets.top;
    },
    headerHeight: (modalPresentation: boolean = false) => {
        let headerHeight;

        if (Platform.OS === 'ios') {
            if (Platform.isPad || Platform.isTV) {
                if (modalPresentation) {
                    headerHeight = 56;
                } else {
                    headerHeight = 50;
                }
            } else {
                if (UnistylesRuntime.isLandscape) {
                    headerHeight = 32;
                } else {
                    if (modalPresentation) {
                        headerHeight = 56;
                    } else {
                        headerHeight = 56;
                    }
                }
            }
        } else if (Platform.OS === 'android') {
            headerHeight = 64;
        } else {
            headerHeight = 64;
        }

        return headerHeight;
    },
    screenHeaderHeight: (modalPresentation: boolean = false) => {
        let headerHeight = func.headerHeight(modalPresentation);
        const statusBarHeight = func.statusBarHeight();

        return headerHeight + statusBarHeight;
    },
    headerContentTopOffset: (contentHeight: number, modalPresentation: boolean = false): number => {
        const statusBarHeight = func.statusBarHeight();
        const navHeaderBodyHeight = func.headerHeight(modalPresentation);
        const centeredOffset = Math.max(0, (navHeaderBodyHeight - contentHeight) / 2);

        return statusBarHeight + centeredOffset;
    },
    sheetHeaderHeight: () => {
        return func.screenHeaderHeight() - func.space(5);
    },
    screenContentPadding: (screen: 'root' | 'child' | 'editor' | 'sheet') => {
        if (screen === 'root')
            return {
                paddingTop: func.screenHeaderHeight(),
                paddingBottom: UnistylesRuntime.insets.bottom + func.space(20),
            };

        if (screen === 'editor')
            return {
                paddingTop: func.screenHeaderHeight() + func.space(5),
                paddingBottom: UnistylesRuntime.insets.bottom + func.space(24),
            };

        if (screen === 'sheet')
            return {
                paddingTop: func.sheetHeaderHeight(),
            };

        return {
            paddingTop: func.screenHeaderHeight() + func.space(5),
            paddingBottom: UnistylesRuntime.insets.bottom + func.space(5),
        };
    },
};

const colors = {
    white: '#FFFFFF',
    neutral: {
        50: '#fafafa',
        100: '#f5f5f5',
        200: '#e5e5e5',
        300: '#d4d4d4',
        400: '#a3a3a3',
        500: '#737373',
        600: '#525252',
        700: '#404040',
        800: '#262626',
        900: '#171717',
        925: '#101010',
        950: '#0a0a0a',
    },
    lime: {
        50: '#f7fee7',
        100: '#ecfccb',
        200: '#d9f99d',
        300: '#bef264',
        400: '#a3e635',
        500: '#84cc16',
        600: '#65a30d',
        700: '#4d7c0f',
        800: '#3f6212',
        900: '#365314',
        950: '#1a2e05',
    },
    red: {
        50: '#fef2f2',
        100: '#fee2e2',
        200: '#fecaca',
        300: '#fca5a5',
        400: '#f87171',
        500: '#ef4444',
        600: '#dc2626',
        700: '#b91c1c',
        800: '#991b1b',
        900: '#7f1d1d',
        950: '#450a0a',
    },
};

const lightTheme = {
    colors: {
        background: colors.white,
        foreground: colors.neutral[100],
        typography: colors.neutral[950],
        border: colors.neutral[300],
        ...colors,
    },
    ...common,
    ...func,
} as const;

const darkTheme = {
    colors: {
        background: colors.neutral[950],
        foreground: colors.neutral[900],
        typography: colors.white,
        border: colors.neutral[700],
        ...colors,
    },
    ...common,
    ...func,
} as const;

const appThemes = {
    light: lightTheme,
    dark: darkTheme,
};

const breakpoints = {
    xs: 0,
    sm: 300,
    md: 500,
    lg: 800,
    xl: 1200,
};

type AppBreakpoints = typeof breakpoints;
type AppThemes = typeof appThemes;

declare module 'react-native-unistyles' {
    export interface UnistylesThemes extends AppThemes {}
    export interface UnistylesBreakpoints extends AppBreakpoints {}
}

StyleSheet.configure({
    settings: {
        adaptiveThemes: false,
        initialTheme: () => {
            const theme = storage.getString('user.theme');

            if (!theme) {
                return 'dark';
            }

            if (theme === 'auto') {
                return UnistylesRuntime.colorScheme === 'dark' ? 'dark' : 'light';
            }

            return theme as keyof typeof appThemes;
        },
    },
    themes: {
        light: lightTheme,
        dark: darkTheme,
    },
    breakpoints,
});
