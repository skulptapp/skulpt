import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import HeartrateScreen from '@/screens/settings/heartrate';

const HeartrateRoute = () => {
    useAnalyticsScreen('settings_heart_rate');

    return <HeartrateScreen />;
};

export default HeartrateRoute;
