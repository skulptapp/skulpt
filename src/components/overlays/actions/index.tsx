import { FC, useEffect, useRef } from 'react';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useShallow } from 'zustand/react/shallow';
import { useUnistyles, StyleSheet } from 'react-native-unistyles';

import { useActionsStore } from '@/stores/actions';

import { Backdrop } from '../backdrop';
import { Handle } from '../handle';

import { WorkoutMenu } from './menus/workout';
import { WorkoutRepeat } from './menus/workout-repeat';
import { ExerciseMenu } from './menus/exercise';
import { SetMenu } from './menus/set';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        backgroundColor: theme.colors.background,
    },
    backgroundStyle: {
        backgroundColor:
            rt.themeName === 'dark' ? theme.colors.neutral[925] : theme.colors.background,
        borderTopRightRadius: theme.radius['4xl'],
        borderTopLeftRadius: theme.radius['4xl'],
    },
    sheetHandle: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        borderTopRightRadius: theme.radius['4xl'],
        borderTopLeftRadius: theme.radius['4xl'],
    },
    sheetHandleIndicator: {
        backgroundColor: theme.colors.typography,
        opacity: 0.2,
    },
    sheetContentContainer: {
        paddingTop: theme.space(5),
        paddingBottom: rt.insets.bottom + theme.space(5),
    },
}));

const ActionsSheet: FC = () => {
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const { rt } = useUnistyles();

    const { type, title, close, showCloseButton } = useActionsStore(
        useShallow((state) => ({
            type: state.type,
            title: state.title,
            showCloseButton: state.showCloseButton,
            close: state.close,
        })),
    );

    useEffect(() => {
        if (bottomSheetRef.current) {
            if (type) {
                bottomSheetRef.current.present();
            } else {
                bottomSheetRef.current.close();
            }
        }
    }, [type]);

    const handleSheetChanges = (index: number) => {
        if (index === -1 && type) {
            close();
        }
    };

    const Menu: FC = () => {
        switch (type) {
            case 'workout__menu':
                return <WorkoutMenu />;
            case 'workout__repeat':
                return <WorkoutRepeat />;
            case 'exercise__menu':
                return <ExerciseMenu />;
            case 'set__menu':
                return <SetMenu />;
            default:
                return null;
        }
    };

    return (
        <BottomSheetModal
            ref={bottomSheetRef}
            backdropComponent={Backdrop}
            handleComponent={(props) => (
                <Handle
                    handleClose={close}
                    title={title}
                    compact={!title}
                    closeButton={showCloseButton}
                    containerStyle={styles.container}
                    {...props}
                />
            )}
            onChange={handleSheetChanges}
            stackBehavior="push"
            topInset={rt.insets.top + 20}
            backgroundStyle={styles.backgroundStyle}
            handleStyle={styles.sheetHandle}
            handleIndicatorStyle={styles.sheetHandleIndicator}
        >
            <BottomSheetView style={styles.sheetContentContainer}>
                <Menu />
            </BottomSheetView>
        </BottomSheetModal>
    );
};

export default ActionsSheet;
