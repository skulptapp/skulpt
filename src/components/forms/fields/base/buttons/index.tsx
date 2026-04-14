import React, { FC } from 'react';
import { FieldError, Merge } from 'react-hook-form';
import { StyleSheet, UnistylesVariants } from 'react-native-unistyles';

import { Pressable } from '@/components/primitives/pressable';
import { Box, BoxProps } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Text } from '@/components/primitives/text';

import { ChoicesType, ChoiceType } from '../../choices';
import { compact } from 'lodash';
import { Label, Error } from '../../components';
import { useTranslation } from 'react-i18next';

export type BaseButtonsFieldType = {
    label?: string;
    choices: Omit<ChoiceType, 'description'>[];
    type?: ChoicesType;
    value?: string | number | boolean | null | (string | number)[];
    error?: Merge<FieldError, (FieldError | undefined)[]> | undefined;
    onChange: (value: string | number | boolean | null | (string | number)[]) => void;
    choicesContainerStyle?: BoxProps['style'];
    size?: 'small';
    variant?: 'accent';
} & UnistylesVariants<typeof styles>;

const styles = StyleSheet.create((theme, rt) => ({
    labelContainer: {
        marginBottom: theme.space(2),
    },
    errorContainer: {
        marginTop: theme.space(2),
    },
    choicesContainer: {
        gap: theme.space(2),
        flexWrap: 'wrap',
    },
    choiceContainer: (checked: boolean, error: boolean) => ({
        minWidth: theme.space(11),
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: theme.radius.full,
        variants: {
            variant: {
                default: {
                    backgroundColor: error
                        ? theme.colors.red[100]
                        : checked
                          ? rt.themeName === 'dark'
                              ? theme.colors.white
                              : theme.colors.neutral[950]
                          : theme.colors.background,
                },
                accent: {
                    backgroundColor: error
                        ? theme.colors.red[100]
                        : checked
                          ? rt.themeName === 'dark'
                              ? theme.colors.white
                              : theme.colors.neutral[950]
                          : theme.colors.foreground,
                },
            },
            size: {
                default: {
                    height: theme.space(11),
                    minWidth: theme.space(11),
                    paddingHorizontal: theme.space(5),
                },
                small: {
                    height: theme.space(10),
                    minWidth: theme.space(10),
                    paddingHorizontal: theme.space(4),
                },
            },
        },
    }),
    choiceTitle: (checked: boolean, error: boolean) => ({
        color: error
            ? theme.colors.red[500]
            : checked
              ? rt.themeName === 'dark'
                  ? theme.colors.neutral[950]
                  : theme.colors.white
              : rt.themeName === 'dark'
                ? theme.colors.white
                : theme.colors.neutral[950],
        fontWeight: checked
            ? theme.fontWeight.medium.fontWeight
            : theme.fontWeight.medium.fontWeight,
        variants: {
            size: {
                default: {
                    fontSize: theme.fontSize.default.fontSize,
                },
                small: {
                    fontSize: theme.fontSize.sm.fontSize,
                },
            },
        },
    }),
}));

const BaseButtons: FC<BaseButtonsFieldType> = ({
    label,
    type = 'radio',
    choices,
    value,
    error,
    onChange,
    choicesContainerStyle,
    variant,
    size,
}) => {
    const { t } = useTranslation(['common']);

    styles.useVariants({ variant, size });

    const handleOnChange = (choice: ChoiceType) => {
        if (type === 'radio') {
            if (value === choice.value) {
                onChange(null);
            } else {
                onChange(choice.value);
            }
        }

        if (type === 'checkbox') {
            let s: ChoiceType['value'][];

            if (value) {
                if (Array.isArray(value)) {
                    s = compact(value.map((i) => choices.find((x) => x.value === i)?.value));
                } else {
                    const f = choices.find((x) => x.value === value);
                    if (f) {
                        s = [f.value];
                    } else {
                        s = [];
                    }
                }
            } else {
                s = [];
            }

            if (s.some((i) => i === choice.value)) {
                s = s.filter((i) => i !== choice.value);
            } else {
                s = [...s, choice.value];
            }

            const cleanedS = s.filter(
                (item): item is string | number => item !== null && item !== undefined,
            );

            if (cleanedS.length > 0) {
                onChange(cleanedS);
            } else {
                onChange(null);
            }
        }
    };

    const getCheckedValue = (choice: ChoiceType) => {
        if (Array.isArray(value)) {
            const s = compact(value.map((i) => choices.find((x) => x.value === i)));
            return s.some((i) => i.value === choice.value);
        }
        return value === choice.value;
    };

    const Choice: FC<{ choice: ChoiceType }> = ({ choice }) => {
        const checked = getCheckedValue(choice);

        return (
            <Pressable onPress={() => handleOnChange(choice)}>
                <Box style={styles.choiceContainer(checked, !!error)}>
                    <Text fontWeight="semibold" style={styles.choiceTitle(checked, !!error)}>
                        {choice.title}
                    </Text>
                </Box>
            </Pressable>
        );
    };

    return (
        <Box>
            {label && <Label containerStyle={styles.labelContainer}>{label}</Label>}
            <HStack style={[styles.choicesContainer, choicesContainerStyle]}>
                {choices.map((choice, index) => (
                    <Choice choice={choice} key={index} />
                ))}
            </HStack>
            {error?.message && (
                <Error containerStyle={styles.errorContainer}>
                    {t(error.message, { ns: 'common' })}
                </Error>
            )}
        </Box>
    );
};

export { BaseButtons };
