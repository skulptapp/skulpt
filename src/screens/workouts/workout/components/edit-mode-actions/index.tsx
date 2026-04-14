import { FC, useMemo } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Button } from '@/components/buttons/base';
import { WorkoutItem } from '../../types';

interface EditModeActionsProps {
    selectedIds: string[];
    items: WorkoutItem[];
    onCreateCircuit: () => Promise<void>;
    onRemoveCircuit: () => Promise<void>;
    onRemoveFromGroup: () => Promise<void>;
}

type ActionMode = 'none' | 'create_superset' | 'remove_superset' | 'remove_from_group';

const styles = StyleSheet.create((theme, rt) => ({
    bottomActionsContainer: {
        position: 'absolute',
        bottom: 0,
        paddingHorizontal: theme.space(4),
        paddingBottom: theme.space(5) + rt.insets.bottom,
        width: '100%',
    },
    actionContainer: {
        flex: 1,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    customStartButtonContainer: {
        backgroundColor: theme.colors.lime[400],
    },
    customStartButtonText: {
        fontSize: theme.fontSize.lg.fontSize,
        color: theme.colors.neutral[950],
    },
}));

const getActionMode = (selectedIds: string[], items: WorkoutItem[]): ActionMode => {
    if (selectedIds.length === 0) return 'none';

    const selectedItems = selectedIds
        .map((id) => items.find((it) => it.id === id))
        .filter(Boolean) as WorkoutItem[];

    // Get unique group IDs of selected items
    const groupIds = new Set(selectedItems.map((it) => it.groupId).filter(Boolean) as string[]);

    // Get unique group types of selected items
    const groupTypes = new Set(selectedItems.map((it) => it.groupType).filter(Boolean) as string[]);

    // All from the same circuit group?
    if (groupIds.size === 1 && groupTypes.has('circuit')) {
        const groupId = Array.from(groupIds)[0];
        // Count total items in that group
        const totalInGroup = items.filter((it) => it.groupId === groupId).length;

        if (selectedIds.length === totalInGroup) {
            // All items from the group are selected → Remove Superset
            return 'remove_superset';
        }
        // Only some items from the group are selected → Remove from Group
        return 'remove_from_group';
    }

    // Need at least 2 to create a superset
    if (selectedIds.length < 2) return 'none';

    // Mix of different groups or singles → Create Superset
    return 'create_superset';
};

export const EditModeActions: FC<EditModeActionsProps> = ({
    selectedIds,
    items,
    onCreateCircuit,
    onRemoveCircuit,
    onRemoveFromGroup,
}) => {
    const { t } = useTranslation(['screens']);

    const actionMode = useMemo(() => getActionMode(selectedIds, items), [selectedIds, items]);

    return (
        <Box style={styles.bottomActionsContainer}>
            <HStack>
                <Box style={[styles.actionContainer, styles.centerContainer]}>
                    <Box>
                        {actionMode === 'create_superset' && (
                            <Button
                                title={t('workout.supersets.create', { ns: 'screens' })}
                                containerStyle={styles.customStartButtonContainer}
                                textStyle={styles.customStartButtonText}
                                onPress={onCreateCircuit}
                            />
                        )}
                        {actionMode === 'remove_superset' && (
                            <Button
                                title={t('workout.supersets.remove', { ns: 'screens' })}
                                containerStyle={styles.customStartButtonContainer}
                                textStyle={styles.customStartButtonText}
                                onPress={onRemoveCircuit}
                            />
                        )}
                        {actionMode === 'remove_from_group' && (
                            <Button
                                title={t('workout.supersets.removeFromGroup', { ns: 'screens' })}
                                containerStyle={styles.customStartButtonContainer}
                                textStyle={styles.customStartButtonText}
                                onPress={onRemoveFromGroup}
                            />
                        )}
                    </Box>
                </Box>
            </HStack>
        </Box>
    );
};
