import { FC } from 'react';
import { StyleSheet } from 'react-native-unistyles';

import { Text, TextProps } from '@/components/primitives/text';

interface LabelProps {
    children: string;
    style?: TextProps['style'];
}

const styles = StyleSheet.create((theme) => ({
    label: {
        ...theme.fontSize.sm,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        color: theme.colors.typography,
        opacity: 0.6,
    },
}));

export const Label: FC<LabelProps> = ({ children, style }) => (
    <Text style={[styles.label, style]}>{children}</Text>
);
