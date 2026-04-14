import { FC, useCallback, useDeferredValue, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

import { Box } from '@/components/primitives/box';
import { Title } from '@/components/typography/title';
import { useExercisesList } from '@/hooks/use-exercises';
import { useFilterStore } from '@/stores/filter';
import { useShallow } from 'zustand/shallow';

import { Search } from './components/search';
import { ExercisesListContainer } from './components/list/container';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
        paddingTop: theme.screenContentPadding('root').paddingTop,
    },
    header: {
        paddingHorizontal: theme.space(4),
        marginBottom: theme.space(3),
        backgroundColor: theme.colors.background,
        gap: theme.space(2),
    },
    listContainer: {
        flex: 1,
    },
    contentContainer: {
        paddingBottom: theme.screenContentPadding('root').paddingBottom,
    },
}));

const Exercises: FC = () => {
    const { t } = useTranslation(['common', 'screens']);
    const { ownership, category, tracking, primaryMuscle } = useFilterStore(
        useShallow((s) => ({
            ownership: s.ownership,
            category: s.category,
            tracking: s.tracking,
            primaryMuscle: s.primaryMuscle,
        })),
    );

    const filters = useMemo(
        () => ({ ownership, category, tracking, primaryMuscle }),
        [ownership, category, tracking, primaryMuscle],
    );

    const { data: rawExercises, isLoading, isFetching, error } = useExercisesList(filters);
    const [query, setQuery] = useState('');
    const deferredQuery = useDeferredValue(query);

    const handleExercisePress = useCallback((exerciseId: string) => {
        router.navigate(`/exercises/${exerciseId}`);
    }, []);

    return (
        <Box style={styles.container}>
            <Box style={styles.header}>
                <Title type="h1">{t('exercises.title', { ns: 'screens' })}</Title>
                <Search
                    value={query}
                    onChange={setQuery}
                    placeholder={t('placeholder.search', { ns: 'common' })}
                />
            </Box>
            <ExercisesListContainer
                mode="browse"
                rawExercises={rawExercises}
                query={deferredQuery}
                isLoading={isLoading || isFetching}
                error={error}
                onExercisePress={handleExercisePress}
                contentContainerStyle={styles.contentContainer}
            />
        </Box>
    );
};

export default Exercises;
