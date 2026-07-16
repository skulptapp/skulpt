import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import DatetimeScreen from '@/screens/settings/datetime';

const DatetimeRoute = () => {
    useAnalyticsScreen('settings_datetime');

    return <DatetimeScreen />;
};

export default DatetimeRoute;
