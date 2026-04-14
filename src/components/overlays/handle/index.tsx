import { FC } from 'react';
import { BottomSheetHandle, BottomSheetHandleProps } from '@gorhom/bottom-sheet';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { X } from 'lucide-react-native';

import { HStack } from '@/components/primitives/hstack';
import { Box, BoxProps } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { Pressable } from '@/components/primitives/pressable';

interface HandleProps extends BottomSheetHandleProps {
    title?: string;
    compact?: boolean;
    closeButton?: boolean;
    containerStyle?: BoxProps['style'];
    handleClose: () => void;
}

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingHorizontal: theme.space(5),
        justifyContent: 'space-between',
        alignItems: 'center',
        height: theme.sheetHeaderHeight(),
        paddingTop: theme.space(2.5),
    },
    actionContainer: {
        flex: 1,
    },
    title: {
        color: theme.colors.typography,
    },
    leftAction: {
        justifyContent: 'flex-start',
    },
    rightAction: {
        justifyContent: 'flex-end',
    },
    iconContainer: {
        height: theme.space(11),
        width: theme.space(11),
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: rt.themeName === 'dark' ? theme.colors.white : theme.colors.neutral[950],
        borderRadius: theme.radius.full,
    },
}));

const Handle: FC<HandleProps> = ({
    title,
    compact = false,
    closeButton = true,
    handleClose,
    containerStyle,
    ...props
}) => {
    const { theme, rt } = useUnistyles();

    return (
        <>
            <BottomSheetHandle {...props} />
            {!compact && (
                <HStack style={[styles.container, containerStyle]}>
                    <HStack style={[styles.actionContainer, styles.leftAction]} />
                    <Box>
                        <Text fontWeight="extrabold" fontSize="lg" style={styles.title}>
                            {title}
                        </Text>
                    </Box>
                    <HStack style={[styles.actionContainer, styles.rightAction]}>
                        {closeButton && (
                            <Box style={styles.iconContainer}>
                                <Pressable onPress={handleClose}>
                                    <X
                                        size={theme.space(7)}
                                        color={
                                            rt.themeName === 'dark'
                                                ? theme.colors.neutral[950]
                                                : theme.colors.white
                                        }
                                    />
                                </Pressable>
                            </Box>
                        )}
                    </HStack>
                </HStack>
            )}
        </>
    );
};

export { Handle };
