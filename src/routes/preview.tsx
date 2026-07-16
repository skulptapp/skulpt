import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { PreviewScreen } from '@/screens';

const Preview = () => {
    useAnalyticsScreen('exercise_preview');

    return <PreviewScreen />;
};

export default Preview;
