import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Sortable from 'react-native-sortables';
import {
    KeyboardAwareScrollView,
    KeyboardController,
    AndroidSoftInputModes,
} from 'react-native-keyboard-controller';

import { Box } from '@/components/primitives/box';
import Spinner from '@/components/feedback/spinner';
import { useUpdateExerciseSet, useWorkoutWithDetails } from '@/hooks/use-workouts';
import { ExerciseSetSelect } from '@/db/schema';
import { useRunningWorkoutTicker } from '@/hooks/use-running-workout';

import { Header } from './components/header';
import { Actions } from './components/actions';
import { SetItem } from './components/set-item';
import { WorkoutExerciseStats } from './components/stats';
import { Pushes } from '@/components/promo/pushes';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
    },
    content: {
        flexGrow: 1,
        paddingBottom: rt.insets.bottom + theme.space(20),
        backgroundColor: theme.colors.background,
    },
    scroll: {
        flex: 1,
    },
    pushes: {
        marginVertical: theme.space(5),
    },
}));

const WorkoutExerciseScreen: FC = () => {
    const [actionsHeight, setActionsHeight] = useState(0);
    const { theme } = useUnistyles();

    const { workoutExerciseId, workoutId } = useLocalSearchParams<{
        workoutExerciseId: string;
        workoutId: string;
    }>();

    const { data: workoutDetails, isLoading } = useWorkoutWithDetails(workoutId || '');

    const { mutateAsync: updateSet } = useUpdateExerciseSet();

    const {
        nowMs,
        runningWorkoutActiveSet,
        runningWorkoutRestingSet,
        activeWorkTimerRemainingSeconds,
        activeStopwatchElapsedSeconds,
    } = useRunningWorkoutTicker();

    const exerciseInfo = useMemo(() => {
        if (!workoutDetails) return null;
        const we = workoutDetails.exercises.find((x) => x.workoutExercise.id === workoutExerciseId);
        if (!we) return null;
        return we;
    }, [workoutDetails, workoutExerciseId]);

    const [localItems, setLocalItems] = useState<ExerciseSetSelect[]>(exerciseInfo?.sets || []);

    useEffect(() => {
        setLocalItems(exerciseInfo?.sets || []);
    }, [exerciseInfo]);

    useEffect(() => {
        if (Platform.OS === 'android') {
            KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_RESIZE);
        }
        return () => {
            if (Platform.OS === 'android') {
                KeyboardController.setDefaultMode();
            }
        };
    }, []);

    const handleReorder = useCallback(
        ({ data }: { data: ExerciseSetSelect[] }) => {
            const previousOrderMap = new Map(localItems.map((it) => [it.id, it.order]));

            setLocalItems(data);

            for (let index = 0; index < data.length; index++) {
                const item = data[index];
                const prevOrder = previousOrderMap.get(item.id);
                if (prevOrder !== index) {
                    updateSet({ id: item.id, updates: { order: index } });
                }
            }
        },
        [localItems, updateSet],
    );

    const handleDragStart = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, []);

    return (
        <Box style={styles.container}>
            <KeyboardAwareScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                keyboardDismissMode="interactive"
                bottomOffset={theme.space(2)}
                extraKeyboardSpace={-actionsHeight}
            >
                <Header exerciseInfo={exerciseInfo} />
                {isLoading ? (
                    <Box>
                        <Spinner />
                    </Box>
                ) : (
                    <>
                        <Pushes wrapperStyle={styles.pushes} />
                        {exerciseInfo && (
                            <WorkoutExerciseStats
                                sets={exerciseInfo.sets}
                                exercise={exerciseInfo.exercise}
                                workoutId={workoutId}
                            />
                        )}
                        <Sortable.Grid
                            columns={1}
                            data={localItems}
                            keyExtractor={(it) => it.id}
                            onDragStart={handleDragStart}
                            onDragEnd={({ data }) => handleReorder({ data })}
                            rowGap={0}
                            columnGap={0}
                            overDrag="vertical"
                            enableActiveItemSnap={false}
                            itemsLayoutTransitionMode="reorder"
                            itemEntering={null}
                            itemExiting={null}
                            renderItem={({ item, index }) => (
                                <SetItem
                                    key={item.id}
                                    exerciseInfo={exerciseInfo}
                                    set={item}
                                    index={index}
                                    nowMs={nowMs}
                                    activeSetId={runningWorkoutActiveSet?.id ?? null}
                                    restingSetId={runningWorkoutRestingSet?.id ?? null}
                                    activeWorkTimerRemainingSeconds={
                                        activeWorkTimerRemainingSeconds ?? null
                                    }
                                    activeStopwatchElapsedSeconds={
                                        activeStopwatchElapsedSeconds ?? null
                                    }
                                />
                            )}
                        />
                    </>
                )}
            </KeyboardAwareScrollView>
            <Actions
                workoutDetails={workoutDetails}
                workoutExerciseId={workoutExerciseId}
                sets={exerciseInfo?.sets}
                setActionsHeight={setActionsHeight}
            />
        </Box>
    );
};

export default WorkoutExerciseScreen;
