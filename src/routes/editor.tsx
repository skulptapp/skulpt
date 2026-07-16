import { useEffect } from 'react';
import type { AnalyticsScreenName } from '@/analytics';
import { useAnalyticsScreen } from '@/hooks/use-analytics-screen';
import { useEditorStore } from '@/stores/editor';
import { useShallow } from 'zustand/react/shallow';
import { EditorScreen } from '@/screens';

const Editor = () => {
    const { resetState, type } = useEditorStore(
        useShallow((state) => ({
            resetState: state.resetState,
            type: state.type,
        })),
    );
    const analyticsScreen: AnalyticsScreenName = type.startsWith('exercise__')
        ? 'exercise_editor'
        : type.startsWith('measurement__')
          ? 'measurement_editor'
          : 'workout_editor';

    useAnalyticsScreen(analyticsScreen);

    useEffect(() => {
        return () => {
            resetState();
        };
    }, [resetState]);

    return <EditorScreen />;
};

export default Editor;
