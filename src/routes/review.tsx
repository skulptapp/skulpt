import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { AppReviewScreen } from '@/screens';

const Review = () => {
    useAnalyticsScreen('app_review');

    return <AppReviewScreen />;
};

export default Review;
