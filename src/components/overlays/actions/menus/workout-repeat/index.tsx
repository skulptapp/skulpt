import { FC } from 'react';
import { VStack } from '@/components/primitives/vstack';

import { WorkoutDuplicateItems } from '../workout-duplicate-items';

const WorkoutRepeat: FC = () => {
    return (
        <VStack>
            <WorkoutDuplicateItems last={true} />
        </VStack>
    );
};

export { WorkoutRepeat };
