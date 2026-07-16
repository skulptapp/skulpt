import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { SelectScreen } from '@/screens';

const Select = () => {
    useAnalyticsScreen('exercise_select');

    return <SelectScreen />;
};

export default Select;
