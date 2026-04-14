import { StyleSheet } from 'react-native-unistyles';

import { Box, BoxProps } from '@/components/primitives/box';
import { FC } from 'react';

interface SeparatorProps {
    style?: BoxProps['style'];
}

const styles = StyleSheet.create((theme) => ({
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
    },
}));

const Separator: FC<SeparatorProps> = ({ style }) => {
    return <Box style={[styles.separator, style]} />;
};

export { Separator };
