import { FC, useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { ScrollView } from '@/components/primitives/scrollview';
import { useExercise, useExerciseHistory } from '@/hooks/use-exercises';
import { Header, History, Guide, Tabs, Statistics } from './components';
import { LoadingState } from '../exercises/components/loading';
import { EmptyState } from '../exercises/components/empty';

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    content: {
        flexGrow: 1,
        ...theme.screenContentPadding('child'),
        gap: theme.space(5),
    },
}));

const ExerciseScreen: FC = () => {
    const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
    const { t } = useTranslation(['screens']);
    const [activeTab, setActiveTab] = useState(0);

    const {
        data: exercise,
        isLoading: isExerciseLoading,
        error: exerciseError,
    } = useExercise(exerciseId);
    const { data: history, isLoading: isHistoryLoading } = useExerciseHistory(exerciseId);

    const isLoading = isExerciseLoading || isHistoryLoading;

    if (isLoading) {
        return <LoadingState />;
    }

    if (exerciseError || !exercise) {
        return <EmptyState />;
    }

    const tabs = [
        t('exercise.tabs.history', { ns: 'screens' }),
        t('exercise.tabs.statistics', { ns: 'screens' }),
        t('exercise.tabs.guide', { ns: 'screens' }),
    ];

    return (
        <Box style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                <Header exercise={exercise} />
                <Tabs tabs={tabs} activeIndex={activeTab} onTabChange={setActiveTab} />
                {activeTab === 0 && <History history={history || []} exercise={exercise} />}
                {activeTab === 1 && <Statistics history={history || []} exercise={exercise} />}
                {activeTab === 2 && <Guide exercise={exercise} />}
            </ScrollView>
        </Box>
    );
};

export default ExerciseScreen;
