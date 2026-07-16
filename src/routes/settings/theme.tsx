import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import ThemeScreen from '@/screens/settings/theme';

const ThemeRoute = () => {
    useAnalyticsScreen('settings_theme');

    return <ThemeScreen />;
};

export default ThemeRoute;
