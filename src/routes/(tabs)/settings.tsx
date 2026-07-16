import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import SettingsScreen from '@/screens/settings/settings';

const SettingsRoute = () => {
    useAnalyticsScreen('settings');

    return <SettingsScreen />;
};

export default SettingsRoute;
