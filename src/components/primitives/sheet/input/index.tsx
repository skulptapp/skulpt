import { ComponentRef, ForwardedRef, forwardRef } from 'react';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';

import { InputProps } from '../../input';

type BottomSheetTextInputRef = ComponentRef<typeof BottomSheetTextInput>;

const SheetInput = forwardRef<BottomSheetTextInputRef, InputProps>(
    ({ style, ...rest }, ref: ForwardedRef<BottomSheetTextInputRef>) => {
        return <BottomSheetTextInput ref={ref} style={[style]} {...rest} />;
    },
);

SheetInput.displayName = 'SheetInput';

export { SheetInput };
