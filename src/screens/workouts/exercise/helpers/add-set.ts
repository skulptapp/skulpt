import { ExerciseSetSelect } from '@/db/schema';
import { getOrderedExercisesFromDetails } from '@/helpers/workouts';
import { type CreateExerciseSetInput, type useWorkoutWithDetails } from '@/hooks/use-workouts';

type WorkoutDetails = ReturnType<typeof useWorkoutWithDetails>['data'];
type SetType = ExerciseSetSelect['type'];

type AddWorkoutExerciseSetParams = {
    workoutDetails: WorkoutDetails;
    workoutExerciseId: string;
    sets?: ExerciseSetSelect[];
    setType?: SetType;
    createSet: (data: CreateExerciseSetInput) => Promise<ExerciseSetSelect>;
};

const sortSets = (sets: ExerciseSetSelect[]) => sets.slice().sort((a, b) => a.order - b.order);

const addWorkoutExerciseSet = async ({
    workoutDetails,
    workoutExerciseId,
    sets,
    setType,
    createSet,
}: AddWorkoutExerciseSetParams) => {
    if (!workoutDetails || !workoutExerciseId) return;

    const completedWorkoutSetDefaults =
        workoutDetails.workout.status === 'completed'
            ? {
                  startedAt: null,
                  completedAt: workoutDetails.workout.completedAt ?? new Date(),
                  restCompletedAt: null,
                  finalRestTime: null,
              }
            : {};

    const orderedExercises = getOrderedExercisesFromDetails(workoutDetails);
    const currentWe = workoutDetails.exercises.find(
        (exercise) => exercise.workoutExercise.id === workoutExerciseId,
    );
    const groupId = currentWe?.workoutExercise.groupId;
    const group = workoutDetails.groups.find((groupData) => groupData.group.id === groupId);
    const groupType = group?.group.type ?? 'single';

    if (groupType !== 'single' && groupId) {
        const groupExercises = orderedExercises.filter((exercise) => exercise.groupId === groupId);

        let maxRound = -1;
        for (const groupExercise of groupExercises) {
            for (const set of groupExercise.sets) {
                const round = set.round ?? groupExercise.sets.indexOf(set);
                if (round > maxRound) maxRound = round;
            }
        }
        const nextRound = maxRound + 1;

        await Promise.all(
            groupExercises.map((groupExercise) => {
                const exerciseSets = sortSets(groupExercise.sets);
                const nextOrder =
                    exerciseSets.length > 0 ? exerciseSets[exerciseSets.length - 1].order + 1 : 0;
                const prev = exerciseSets[exerciseSets.length - 1];

                return createSet({
                    analyticsSource: 'manual',
                    workoutExerciseId: groupExercise.id,
                    order: nextOrder,
                    type: setType ?? prev?.type ?? 'working',
                    weight: prev?.weight ?? null,
                    reps: prev?.reps ?? null,
                    time: prev?.time ?? null,
                    distance: prev?.distance ?? null,
                    restTime: prev?.restTime ?? null,
                    ...completedWorkoutSetDefaults,
                    round: nextRound,
                });
            }),
        );
        return;
    }

    const sortedSets = sortSets(sets ?? currentWe?.sets ?? []);
    const nextOrder = sortedSets.length > 0 ? sortedSets[sortedSets.length - 1].order + 1 : 0;
    const prev = sortedSets[sortedSets.length - 1];

    await createSet({
        analyticsSource: 'manual',
        workoutExerciseId,
        order: nextOrder,
        type: setType ?? prev?.type ?? 'working',
        weight: prev?.weight ?? null,
        reps: prev?.reps ?? null,
        time: prev?.time ?? null,
        distance: prev?.distance ?? null,
        restTime: prev?.restTime ?? null,
        ...completedWorkoutSetDefaults,
        round: prev?.round != null ? prev.round + 1 : sortedSets.length,
    });
};

export { addWorkoutExerciseSet };
export type { SetType };
