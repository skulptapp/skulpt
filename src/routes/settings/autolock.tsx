import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import AutolockScreen from '@/screens/settings/autolock';

const AutolockRoute = () => {
    useAnalyticsScreen('settings_autolock');

    return <AutolockScreen />;
};

export default AutolockRoute;
