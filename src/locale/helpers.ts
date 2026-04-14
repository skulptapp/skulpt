import i18n from './i18n';
import { defaultLocale, supportedLanguages } from './constants';
import { getLocales } from 'expo-localization';

export const getLang = () => {
    if (i18n.language) {
        return i18n.language;
    }

    const lang = getLocales()[0].languageCode;
    if (lang) {
        if (supportedLanguages.includes(lang)) {
            return lang;
        }
    }

    return defaultLocale;
};
