import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import LanguageScreen from '@/screens/settings/language';

const LanguageRoute = () => {
    useAnalyticsScreen('settings_language');

    return <LanguageScreen />;
};

export default LanguageRoute;
