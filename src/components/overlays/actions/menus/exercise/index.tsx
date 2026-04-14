import { FC, useCallback } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';

import { useActionsStore } from '@/stores/actions';
import { VStack } from '@/components/primitives/vstack';
import { useEditor } from '@/hooks/use-editor';
import { useDeleteExercise, useExercise } from '@/hooks/use-exercises';
import { isSkulptExercise } from '@/crud/exercise';

import { MenuItem } from '../../components/menu-item';

const ExerciseMenu: FC = () => {
    const { t } = useTranslation(['common', 'screens']);
    const router = useRouter();

    const { navigate } = useEditor();

    const deleteExercise = useDeleteExercise();

    const { close, payload } = useActionsStore(
        useShallow((state) => ({
            close: state.close,
            payload: state.payload,
        })),
    );

    const exerciseId =
        payload && 'exerciseId' in payload && typeof payload.exerciseId === 'string'
            ? payload.exerciseId
            : '';

    const { data: exercise } = useExercise(exerciseId);

    const canDelete = exercise ? !isSkulptExercise(exercise) : false;

    const handleMerge = useCallback(() => {
        if (!payload || !('exerciseId' in payload)) return;

        close();

        router.navigate({
            pathname: '/select',
            params: { merge: 'true', sourceExerciseId: payload.exerciseId as string },
        });
    }, [close, payload, router]);

    const handleDelete = useCallback(() => {
        if (!payload || !('exerciseId' in payload) || !canDelete) return;

        close();
        Alert.alert(t('exercise.deleteExerciseAlert', { ns: 'screens' }), undefined, [
            {
                text: t('cancel', { ns: 'common' }),
                style: 'cancel',
            },
            {
                text: t('delete', { ns: 'common' }),
                style: 'destructive',
                onPress: () => {
                    deleteExercise.mutate(payload.exerciseId as string);
                    router.back();
                },
            },
        ]);
    }, [canDelete, close, payload, deleteExercise, router, t]);

    return (
        <VStack>
            {payload && 'exerciseId' in payload && typeof payload.exerciseId === 'string' && (
                <>
                    <MenuItem
                        title={t('edit', { ns: 'common' })}
                        onPress={() => {
                            close();
                            navigate({
                                type: 'exercise__edit',
                                payload: { exerciseId: payload.exerciseId as string },
                            });
                        }}
                    />
                    <MenuItem
                        title={t('merge', { ns: 'common' })}
                        last={!canDelete}
                        onPress={handleMerge}
                    />
                    {canDelete && (
                        <MenuItem
                            title={t('delete', { ns: 'common' })}
                            variant="destructive"
                            last={true}
                            onPress={handleDelete}
                        />
                    )}
                </>
            )}
        </VStack>
    );
};

export { ExerciseMenu };
