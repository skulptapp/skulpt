import { router } from 'expo-router';

import { CreateButton } from '@/components/buttons/create';
import { FilterButton } from '@/components/buttons/filter';
import { useEditor } from '@/hooks/use-editor';
import { useScreen } from '@/hooks/use-screen';
import { useFilterStore, hasActiveFilters } from '@/stores/filter';
import { useShallow } from 'zustand/shallow';

const useExercisesTab = () => {
    const { options } = useScreen();
    const { navigate } = useEditor();
    const filterState = useFilterStore(
        useShallow((s) => ({
            ownership: s.ownership,
            category: s.category,
            tracking: s.tracking,
            primaryMuscle: s.primaryMuscle,
        })),
    );

    const handleExerciseCreate = () => {
        navigate({ type: 'exercise__create' });
    };

    const handleFilterOpen = () => {
        router.navigate('/filter');
    };

    return {
        name: 'exercises',
        options: {
            headerTransparent: true,
            headerStyle: {
                ...options.headerStyle,
                backgroundColor: 'transparent',
            },
            headerLeft: () => (
                <FilterButton onPress={handleFilterOpen} active={hasActiveFilters(filterState)} />
            ),
            headerRight: () => <CreateButton onPressHandler={handleExerciseCreate} />,
        },
    };
};

export { useExercisesTab };
