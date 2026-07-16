import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import SoundScreen from '@/screens/settings/sound';

const SoundRoute = () => {
    useAnalyticsScreen('settings_sound');

    return <SoundScreen />;
};

export default SoundRoute;
