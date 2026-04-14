import { FC } from 'react';
import { StyleSheet, UnistylesVariants } from 'react-native-unistyles';

import { Pressable } from '@/components/primitives/pressable';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';

type MenuItemProps = {
    title: string;
    last?: boolean;
    onPress: () => void;
} & UnistylesVariants<typeof styles>;

const styles = StyleSheet.create((theme) => ({
    container: {
        paddingHorizontal: theme.space(5),
        paddingVertical: theme.space(4),
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
}));

const MenuItem: FC<MenuItemProps> = ({ title, last, variant, onPress }) => {
    styles.useVariants({ variant });

    return (
        <Pressable onPress={onPress}>
            <Box>
                <Box style={styles.container}>
                    <HStack style={styles.wrapper}>
                        <Box style={styles.titleContainer}>
                            <Text style={styles.title}>{title}</Text>
                        </Box>
                    </HStack>
                </Box>
                {!last && <Box style={styles.divider} />}
            </Box>
        </Pressable>
    );
};

export { MenuItem };
