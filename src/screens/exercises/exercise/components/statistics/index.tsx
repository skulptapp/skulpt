import { FC } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import type { ExerciseHistoryItem } from '@/crud/exercise';
import type { ExerciseSelect } from '@/db/schema';
import { VStack } from '@/components/primitives/vstack';
import {
    AverageWeightCard,
    IntensityCard,
    OneRmCard,
    RelativeStrengthCard,
    VolumeCard,
} from './components';

interface StatisticsProps {
    history: ExerciseHistoryItem[];
    exercise: ExerciseSelect;
}

const styles = StyleSheet.create((theme) => ({
    container: {
        paddingHorizontal: theme.space(4),
        gap: theme.space(3),
    },
}));

export const Statistics: FC<StatisticsProps> = ({ history, exercise }) => {
    return (
        <VStack style={styles.container}>
            <OneRmCard history={history} exercise={exercise} />
            <VolumeCard history={history} exercise={exercise} />
            <RelativeStrengthCard history={history} exercise={exercise} />
            <AverageWeightCard history={history} exercise={exercise} />
            <IntensityCard history={history} exercise={exercise} />
        </VStack>
    );
};
