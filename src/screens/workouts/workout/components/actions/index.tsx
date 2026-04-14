import { FC, useCallback, useMemo } from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { Box } from '@/components/primitives/box';
import { WorkoutSelect } from '@/db/schema';
import { Button } from '@/components/buttons/base';
import { CreateButton } from '@/components/buttons/create';
import { HStack } from '@/components/primitives/hstack';
import { useActionsStore } from '@/stores/actions';
import { useRunningWorkoutStatic } from '@/hooks/use-running-workout';

interface ActionsProps {
    workout?: WorkoutSelect;
}

const styles = StyleSheet.create((theme, rt) => ({
    bottomActionsContainer: {
        position: 'absolute',
        bottom: 0,
        paddingHorizontal: theme.space(4),
        paddingBottom: theme.space(5) + rt.insets.bottom,
        width: '100%',
    },
    actionContainer: {
        flex: 1,
    },
    leftContainer: {
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    centerContainer: {
        flex: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rightContainer: {
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    startButtonContainer: {
        width: '100%',
    },
    customStartButtonText: {
        fontSize: theme.fontSize.lg.fontSize,
    },
}));

export const Actions: FC<ActionsProps> = ({ workout }) => {
    const { theme } = useUnistyles();
    const { t } = useTranslation(['common', 'screens']);

    const { startWorkout, completeWorkout, isPendingStartWorkout, isPendingCompleteWorkout } =
        useRunningWorkoutStatic();

    const { actionsOpen } = useActionsStore(
        useShallow((state) => ({
            actionsOpen: state.open,
        })),
    );

    const mainButtonTitle = useMemo(() => {
        if (workout?.status === 'in_progress') {
            return t('complete', { ns: 'common' });
        }
        if (workout?.status === 'completed') {
            return t('repeat', { ns: 'common' });
        }
        return t('begin', { ns: 'common' });
    }, [workout, t]);

    const handleExerciseAdd = () => {
        if (workout) {
            router.navigate(`/select?workoutId=${workout.id}`);
        } else {
            router.navigate('/select');
        }
    };

    const handleMainAction = useCallback(() => {
        if (!workout) return;
        if (workout.status === 'in_progress') {
            completeWorkout();
            return;
        }
        if (workout.status === 'planned') {
            startWorkout(workout.id);
            return;
        }
        if (workout.status === 'completed') {
            actionsOpen({
                type: 'workout__repeat',
                showCloseButton: false,
                payload: { workoutId: workout.id },
            });
            return;
        }
    }, [workout, startWorkout, completeWorkout, actionsOpen]);

    return (
        <Box style={styles.bottomActionsContainer}>
            <HStack>
                <Box style={[styles.actionContainer, styles.leftContainer]}>
                    <CreateButton onPressHandler={handleExerciseAdd} iconSize={theme.space(6)} />
                </Box>
                <Box style={[styles.actionContainer, styles.centerContainer]}>
                    <Box style={styles.startButtonContainer}>
                        <Button
                            title={mainButtonTitle}
                            textStyle={styles.customStartButtonText}
                            loading={isPendingStartWorkout || isPendingCompleteWorkout}
                            disabled={!workout}
                            onPress={handleMainAction}
                        />
                    </Box>
                </Box>
                <Box style={[styles.actionContainer, styles.rightContainer]}></Box>
            </HStack>
        </Box>
    );
};
