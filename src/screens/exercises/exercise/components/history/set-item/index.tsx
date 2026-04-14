import { FC } from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/primitives/box';
import { Text } from '@/components/primitives/text';
import { ExerciseSetSelect, ExerciseSelect } from '@/db/schema';
import { formatSet } from '@/helpers/workouts';
import { formatRestTime } from '@/helpers/rest';
import { HStack } from '@/components/primitives/hstack';
import { normalizeSetType } from '@/helpers/set-type';

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        paddingVertical: theme.space(3),
        alignItems: 'center',
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
    },
    setNumberContainer: {
        width: theme.space(16),
        justifyContent: 'center',
    },
    setNumber: {
        color: theme.colors.typography,
        opacity: 0.6,
        fontSize: theme.fontSize.sm.fontSize,
        fontWeight: theme.fontWeight.default.fontWeight,
        minWidth: theme.space(6),
    },
    setTextContainer: {
        flex: 1,
    },
    setText: {
        color: theme.colors.typography,
        fontSize: theme.fontSize['lg'].fontSize,
        fontWeight: theme.fontWeight.medium.fontWeight,
        lineHeight: theme.fontSize['lg'].lineHeight,
        textAlign: 'center',
    },
    restContainer: {
        width: theme.space(16),
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    restText: {
        color: theme.colors.typography,
        opacity: 0.6,
        fontSize: theme.fontSize.sm.fontSize,
        fontWeight: theme.fontWeight.default.fontWeight,
    },
}));

interface SetItemProps {
    set: ExerciseSetSelect;
    exercise: ExerciseSelect;
}

export const SetItem: FC<SetItemProps> = ({ set, exercise }) => {
    const { t } = useTranslation(['common']);
    const restTimeDisplay = set.restTime ? formatRestTime(set, set.restTime) : '';
    const setTypeShort = t(`setTypeShort.${normalizeSetType(set.type)}`, { ns: 'common' });

    return (
        <>
            <HStack style={styles.container}>
                <Box style={styles.setNumberContainer}>
                    <Text style={styles.setNumber}>{`${set.order + 1} ${setTypeShort}`}</Text>
                </Box>
                <Box style={styles.setTextContainer}>
                    <Text style={styles.setText}>{formatSet(exercise, set)}</Text>
                </Box>
                <Box style={styles.restContainer}>
                    <Text style={styles.restText}>{restTimeDisplay}</Text>
                </Box>
            </HStack>
            <Box style={styles.divider} />
        </>
    );
};
