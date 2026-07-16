import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import DayScreen from '@/screens/results/day';

const DayRoute = () => {
    useAnalyticsScreen('results_day');

    return <DayScreen />;
};

export default DayRoute;
