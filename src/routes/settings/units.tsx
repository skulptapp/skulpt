import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import UnitsScreen from '@/screens/settings/units';

const UnitsRoute = () => {
    useAnalyticsScreen('settings_units');

    return <UnitsScreen />;
};

export default UnitsRoute;
