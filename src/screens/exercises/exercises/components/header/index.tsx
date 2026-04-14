import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';

import { Text } from '@/components/primitives/text';
import { HStack } from '@/components/primitives/hstack';
import { Box } from '@/components/primitives/box';

export interface StickyHeaderState {
    category?: string;
    muscleGroup?: string;
}

const styles = StyleSheet.create((theme, rt) => ({
    stickyHeader: {
        backgroundColor: theme.colors.background,
        paddingBottom: theme.space(2),
        paddingHorizontal: theme.space(4),
    },
    stickyHeaderDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
    },
    stickyHeaderCategory: {
        color: theme.colors.typography,
    },
    stickyHeaderMuscleGroup: {
        color: theme.colors.typography,
        opacity: 0.6,
        marginLeft: theme.space(2),
    },
}));

const StickyHeader: FC<{ state: StickyHeaderState }> = ({ state }) => {
    const { t } = useTranslation(['common']);

    if (!state.category) return null;

    return (
        <Box>
            <Box style={styles.stickyHeader}>
                <HStack>
                    <Text fontWeight="semibold" style={styles.stickyHeaderCategory}>
                        {t(`exerciseCategory.${state.category}`, {
                            ns: 'common',
                            defaultValue: state.category,
                        })}
                    </Text>
                    {state.muscleGroup && (
                        <Text fontWeight="medium" style={styles.stickyHeaderMuscleGroup}>
                            {' '}
                            {t(`muscleGroup.${state.muscleGroup}`, {
                                ns: 'common',
                                defaultValue: state.muscleGroup,
                            })}
                        </Text>
                    )}
                </HStack>
            </Box>
            <Box style={styles.stickyHeaderDivider} />
        </Box>
    );
};

export { StickyHeader };
