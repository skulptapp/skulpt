import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { GuideScreen } from '@/screens';

const Guide = () => {
    useAnalyticsScreen('exercise_guide');

    return <GuideScreen />;
};

export default Guide;
