import { ForwardedRef, forwardRef } from 'react';
import { View, ViewProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export type BoxProps = ViewProps;

const styles = StyleSheet.create((theme) => ({
    container: {
        backgroundColor: 'transparent',
    },
}));

const Box = forwardRef<View, BoxProps>(({ style, ...rest }, ref: ForwardedRef<View>) => {
    return <View ref={ref} style={[styles.container, style]} {...rest} />;
});

Box.displayName = 'Box';

export { Box };
