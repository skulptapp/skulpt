import { FC, ReactNode } from 'react';
import { StyleSheet, UnistylesVariants } from 'react-native-unistyles';

import { Pressable } from '../primitives/pressable';
import { Text, TextProps } from '../primitives/text';
import { Box, BoxProps } from '../primitives/box';
import { HStack } from '../primitives/hstack';
import Spinner from '../feedback/spinner';

export type ButtonProps = {
    title?: ReactNode;
    disabled?: boolean;
    loading?: boolean;
    spinnerColor?: string;
    containerStyle?: BoxProps['style'];
    textStyle?: TextProps['style'];
    onPress?: () => void;
    prefix?: ReactNode;
    suffix?: ReactNode;
} & UnistylesVariants<typeof styles>;

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        variants: {
            type: {
                default: {
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '100%',
                    backgroundColor:
                        rt.themeName === 'dark' ? theme.colors.white : theme.colors.neutral[950],
                    borderRadius: theme.radius.full,
                },
                link: {
                    backgroundColor: 'transparent',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    gap: theme.space(1.5),
                },
            },
            size: {
                default: {
                    height: theme.space(14),
                },
                sm: {
                    height: theme.space(11),
                },
                lg: {
                    height: theme.space(16),
                },
            },
        },
        compoundVariants: [
            {
                type: 'link',
                styles: {
                    height: 'auto',
                },
            },
        ],
    },
    title: {
        variants: {
            type: {
                default: {
                    color:
                        rt.themeName === 'dark'
                            ? theme.colors.neutral[950]
                            : theme.colors.neutral[50],
                },
                link: {
                    color: theme.colors.typography,
                },
            },
            size: {
                default: {
                    fontSize: theme.fontSize.default.fontSize,
                },
                sm: {
                    fontSize: theme.fontSize.sm.fontSize,
                },
            },
        },
    },
    fixContainer: (title: boolean) => ({
        variants: {
            type: {
                default: {
                    position: title ? 'absolute' : 'relative',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                },
            },
            size: {},
        },
    }),
    prefixContainer: (title: boolean) => ({
        variants: {
            type: {
                default: {
                    left: title ? theme.space(4) : 0,
                },
                link: {
                    left: 0,
                },
            },
            size: {},
        },
    }),
    suffixContainer: (title: boolean) => ({
        right: title ? theme.space(4) : 0,
    }),
}));

const Button: FC<ButtonProps> = ({
    title,
    disabled = false,
    loading = false,
    onPress,
    containerStyle,
    textStyle,
    spinnerColor,
    prefix,
    suffix,
    type,
    size,
}) => {
    styles.useVariants({ type, size });

    return (
        <Pressable disabled={disabled} onPress={onPress}>
            <HStack style={[styles.container, containerStyle]}>
                {loading ? (
                    <Spinner color={spinnerColor} />
                ) : (
                    <>
                        {prefix && (
                            <Box
                                style={[
                                    styles.fixContainer(!!title),
                                    styles.prefixContainer(!!title),
                                ]}
                            >
                                {prefix}
                            </Box>
                        )}
                        {title && (
                            <>
                                {typeof title === 'string' ? (
                                    <Text fontWeight="semibold" style={[styles.title, textStyle]}>
                                        {title}
                                    </Text>
                                ) : (
                                    title
                                )}
                            </>
                        )}
                        {suffix && (
                            <Box
                                style={[
                                    styles.fixContainer(!!title),
                                    styles.suffixContainer(!!title),
                                ]}
                            >
                                {suffix}
                            </Box>
                        )}
                    </>
                )}
            </HStack>
        </Pressable>
    );
};

export { Button };
