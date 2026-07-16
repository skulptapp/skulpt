import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import NotificationsScreen from '@/screens/settings/notifications';

const NotificationsRoute = () => {
    useAnalyticsScreen('settings_notifications');

    return <NotificationsScreen />;
};

export default NotificationsRoute;
