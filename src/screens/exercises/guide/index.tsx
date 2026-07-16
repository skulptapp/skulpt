import { FC, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native';

import { Box } from '@/components/primitives/box';
import { useExercise } from '@/hooks/use-exercises';
import { Guide } from '@/screens/exercises/exercise/components/guide';

import { Header } from './components/header';
import { useAnalytics } from '@/hooks/use-analytics';
import { isSkulptExerciseUserId } from '@/constants/skulpt';

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    content: {
        flex: 1,
    },
    scroll: {
        ...theme.screenContentPadding('child'),
    },
}));

const GuideScreen: FC = () => {
    const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
    const { data: exercise } = useExercise(exerciseId ?? '');
    const { track } = useAnalytics();
    const trackedRef = useRef(false);

    useEffect(() => {
        if (!exercise || trackedRef.current) return;
        trackedRef.current = true;
        track('exercise:guide_viewed', {
            surface: 'active_workout',
            ownership: isSkulptExerciseUserId(exercise.userId) ? 'system' : 'custom',
            category: exercise.category,
        });
    }, [exercise, track]);

    const handleClose = () => {
        router.back();
    };

    return (
        <Box style={styles.container}>
            <Header handleClose={handleClose} />
            <Box style={styles.content}>
                {exercise && (
                    <ScrollView contentContainerStyle={styles.scroll}>
                        <Guide exercise={exercise} />
                    </ScrollView>
                )}
            </Box>
        </Box>
    );
};

export default GuideScreen;
