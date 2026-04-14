import { ExerciseSelect, ExerciseSetSelect } from '@/db/schema';

export type WorkoutItem = {
    id: string;
    name: string;
    order: number;
    groupId?: string | null;
    groupType?: string | null;
    tracking?: ExerciseSelect['tracking'];
    sets?: ExerciseSetSelect[];
    exercise?: ExerciseSelect;
};
