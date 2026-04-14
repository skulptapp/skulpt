import { useScreen } from '@/hooks/use-screen';

export const useResultsTab = () => {
    const { options } = useScreen();
    return {
        name: 'results',
        options: {
            ...options,
            headerTransparent: true,
            headerStyle: {
                ...options.headerStyle,
                backgroundColor: 'transparent',
            },
        },
    };
};
