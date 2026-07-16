import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { FilterScreen } from '@/screens';

const Filter = () => {
    useAnalyticsScreen('exercise_filter');

    return <FilterScreen />;
};

export default Filter;
