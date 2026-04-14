import { FC } from 'react';
import { Text as DefaultText } from 'react-native';
import { StyleSheet, type UnistylesVariants } from 'react-native-unistyles';

type ThemedText = DefaultText['props'] & UnistylesVariants<typeof styles>;

export type TextProps = ThemedText;

const styles = StyleSheet.create((theme) => ({
    text: {
        variants: {
            fontSize: {
                ...theme.fontSize,
            },
            fontWeight: {
                ...theme.fontWeight,
            },
        },
    },
    textColor: {
        color: theme.colors.typography,
    },
}));

export const Text: FC<TextProps> = ({ style, fontSize, fontWeight, ...rest }) => {
    styles.useVariants({ fontSize, fontWeight });

    return <DefaultText style={[styles.text, styles.textColor, style]} {...rest} />;
};
