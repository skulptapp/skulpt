import { useEffect } from 'react';
import { useEditorStore } from '@/stores/editor';
import { useShallow } from 'zustand/react/shallow';
import { EditorScreen } from '@/screens';

const Editor = () => {
    const { resetState } = useEditorStore(
        useShallow((state) => ({
            resetState: state.resetState,
        })),
    );

    useEffect(() => {
        return () => {
            resetState();
        };
    }, [resetState]);

    return <EditorScreen />;
};

export default Editor;
