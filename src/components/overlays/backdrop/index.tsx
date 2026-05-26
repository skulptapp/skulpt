import { FC } from 'react';
import { BottomSheetBackdrop, BottomSheetBackdropProps } from '@gorhom/bottom-sheet';

interface IBackdrop extends BottomSheetBackdropProps {
    appearsOnIndex?: number;
    disappearsOnIndex?: number;
    pressBehavior?: 'none' | 'close' | 'collapse' | number;
}

const Backdrop: FC<IBackdrop> = (props) => (
    <BottomSheetBackdrop
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior={'none'}
        {...props}
    />
);

export { Backdrop };
