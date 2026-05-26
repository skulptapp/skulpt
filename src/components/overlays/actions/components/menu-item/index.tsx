import { FC } from 'react';
import { StyleSheet, UnistylesVariants } from 'react-native-unistyles';

import { Pressable } from '@/components/primitives/pressable';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';

type MenuItemProps = {
    title: string;
    description?: string;
    last?: boolean;
    disabled?: boolean;
    onPress: () => void;
} & UnistylesVariants<typeof styles>;

const styles = StyleSheet.create((theme) => ({
    container: {
        paddingHorizontal: theme.space(5),
        paddingVertical: theme.space(4),
    },
    disabled: {
        opacity: 0.5,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
    },
    wrapper: {
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    titleContainer: {
        flex: 1,
        gap: theme.space(1),
    },
    title: {
        fontSize: theme.fontSize.default.fontSize,
        fontWeight: theme.fontWeight.medium.fontWeight,
        variants: {
            variant: {
                default: {
                    color: theme.colors.typography,
                },
                destructive: {
                    color: theme.colors.red[500],
                },
            },
        },
    },
    description: {
        ...theme.fontSize.sm,
        color: theme.colors.typography,
        opacity: 0.55,
    },
}));

const MenuItem: FC<MenuItemProps> = ({ title, description, last, variant, disabled, onPress }) => {
    styles.useVariants({ variant });

    return (
        <Pressable accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}>
            <Box style={disabled && styles.disabled}>
                <Box style={styles.container}>
                    <HStack style={styles.wrapper}>
                        <Box style={styles.titleContainer}>
                            <Text style={styles.title}>{title}</Text>
                            {description && <Text style={styles.description}>{description}</Text>}
                        </Box>
                    </HStack>
                </Box>
                {!last && <Box style={styles.divider} />}
            </Box>
        </Pressable>
    );
};

export { MenuItem };
