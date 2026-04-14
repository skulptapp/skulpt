import { FC } from 'react';

import { StyleSheet, type UnistylesVariants } from 'react-native-unistyles';

import { Text, TextProps } from '@/components/primitives/text';

type TitleProps = TextProps & UnistylesVariants<typeof styles>;

const styles = StyleSheet.create((theme) => ({
    title: {
        fontWeight: theme.fontWeight.extrabold.fontWeight,
        variants: {
            type: {
                h1: {
                    ...theme.fontSize['4xl'],
                },
                h2: {
                    ...theme.fontSize['3xl'],
                },
                h3: {
                    ...theme.fontSize['2xl'],
                },
                h4: {
                    ...theme.fontSize.xl,
                },
                h5: {
                    ...theme.fontSize.lg,
                },
                h6: {
                    ...theme.fontSize.default,
                },
                h7: {
                    ...theme.fontSize.sm,
                },
                h8: {
                    ...theme.fontSize.xs,
                },
            },
        },
    },
}));

export const Title: FC<TitleProps> = ({ style, type, ...rest }) => {
    styles.useVariants({ type });

    return <Text style={[styles.title, style]} {...rest} />;
};
