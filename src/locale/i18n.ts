import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { defaultLocale, supportedLanguages } from './constants';
import { languageDetector } from './detector';
import { runInBackground } from '@/services/error-reporting';

import resources from './translations/resources.json';

const i18n = createInstance();

const options = {
    ns: ['common', 'menu'],
    defaultNS: 'common',
    resources,
    fallbackLng: defaultLocale,
    supportedLngs: supportedLanguages,
    preload: supportedLanguages,
    load: 'languageOnly' as const,
    interpolation: {
        escapeValue: false,
    },
    react: {
        useSuspense: true,
    },
};

i18n.use(languageDetector);
i18n.use(initReactI18next);

if (!i18n.isInitialized) {
    runInBackground(() => i18n.init(options), 'Failed to initialize i18n:');
}

export default i18n;
