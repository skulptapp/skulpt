import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import HomeScreen from '@/screens/home';

const HomeRoute = () => {
    useAnalyticsScreen('home');

    return <HomeScreen />;
};

export default HomeRoute;
