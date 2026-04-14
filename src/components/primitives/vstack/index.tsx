import { FC } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { Box, BoxProps } from '../box';

const styles = StyleSheet.create(() => ({
    container: {
        flexDirection: 'column',
    },
}));

export const VStack: FC<BoxProps> = ({ style, ...rest }) => {
    return <Box style={[styles.container, style]} {...rest} />;
};
