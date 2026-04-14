import { getLocales } from 'expo-localization';

export const languageDetector = {
    type: 'languageDetector' as const,
    async: true,
    init: () => {},
    detect: async (callback: any) => callback(getLocales()[0].languageCode),
    cacheUserLanguage: () => {},
};
