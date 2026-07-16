import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import ResultsScreen from '@/screens/results/results';

const ResultsRoute = () => {
    useAnalyticsScreen('progress');

    return <ResultsScreen />;
};

export default ResultsRoute;
