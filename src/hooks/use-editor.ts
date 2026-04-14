import { router } from 'expo-router';

import { EditorState, useEditorStore } from '@/stores/editor';

const useEditor = () => {
    const setState = useEditorStore((state) => state.setState);

    const navigate = (payload: EditorState) => {
        setState(payload);
        router.navigate('/editor');
    };

    return { navigate };
};

export { useEditor };
