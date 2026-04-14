import { CreateButton } from '@/components/buttons/create';
import { useEditor } from '@/hooks/use-editor';
import { useScreen } from '@/hooks/use-screen';

const useHomeTab = () => {
    const { options } = useScreen();
    const { navigate } = useEditor();

    const handleWorkoutCreate = () => {
        navigate({ type: 'workout__create' });
    };

    return {
        name: 'index',
        options: {
            headerTransparent: true,
            headerStyle: {
                ...options.headerStyle,
                backgroundColor: 'transparent',
            },
            headerRight: () => <CreateButton onPressHandler={handleWorkoutCreate} />,
        },
    };
};

export { useHomeTab };
