import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';

import { Button } from '@/components/buttons/base';
import { CloseButton } from '@/components/buttons/close';
import { Box } from '@/components/primitives/box';
import { HStack } from '@/components/primitives/hstack';
import { Pressable } from '@/components/primitives/pressable';
import { Text } from '@/components/primitives/text';
import { VStack } from '@/components/primitives/vstack';
import { type AppReviewResponse } from '@/constants/app-review';
import {
    dismissAppReviewPrompt,
    recordStoreReviewAttempt,
    submitAppReviewPrompt,
} from '@/crud/app-review';
import { type AppReviewPromptSelect } from '@/db/schema';
import { useAnalytics } from '@/hooks/use-analytics';
import { reportError, runInBackground } from '@/services/error-reporting';
import { requestStoreReviewAfterTransition } from '@/services/store-review';

type Option = {
    value: AppReviewResponse;
    emoji: string;
};

const OPTIONS: Option[] = [
    { value: 'bad', emoji: '🙁' },
    { value: 'not_bad', emoji: '😐' },
    { value: 'good', emoji: '🙂' },
];

const OPTION_TRANSLATION_KEYS = {
    bad: 'bad',
    not_bad: 'notBad',
    good: 'good',
} satisfies Record<AppReviewResponse, 'bad' | 'notBad' | 'good'>;

const getPromptAnalyticsProperties = (
    prompt: AppReviewPromptSelect,
    response?: AppReviewResponse,
) => ({
    promptId: prompt.id,
    promptKey: prompt.promptKey,
    cycleIndex: prompt.cycleIndex,
    completionSource: prompt.completionSource ?? undefined,
    response: response ?? prompt.response ?? undefined,
    eligibleWorkoutCount: prompt.eligibleWorkoutCount,
    workoutId: prompt.shownWorkoutId ?? prompt.triggerWorkoutId ?? undefined,
});

const styles = StyleSheet.create((theme, rt) => ({
    container: {
        flex: 1,
    },
    selectedBackground: (response: AppReviewResponse) => {
        const backgroundByResponse = {
            bad: theme.colors.red[500],
            not_bad: theme.colors.amber[400],
            good: theme.colors.lime[400],
        } satisfies Record<AppReviewResponse, string>;

        return {
            backgroundColor: backgroundByResponse[response],
        };
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        justifyContent: 'flex-end',
        height: theme.screenHeaderHeight(),
        paddingHorizontal: theme.space(4),
    },
    headerWrapper: {
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    content: {
        flex: 1,
    },
    scroll: {
        ...theme.screenContentPadding('child'),
        flexGrow: 1,
        paddingBottom: rt.insets.bottom + theme.space(24),
    },
    reviewContent: {
        flexGrow: 1,
        justifyContent: 'center',
        gap: theme.space(25),
        paddingHorizontal: theme.space(4),
    },
    prompt: {
        alignItems: 'center',
        gap: theme.space(4),
    },
    question: {
        maxWidth: 320,
        color: theme.colors.neutral[950],
        fontSize: theme.fontSize['4xl'].fontSize,
        fontWeight: theme.fontWeight.black.fontWeight,
        lineHeight: theme.fontSize['4xl'].lineHeight,
        textAlign: 'center',
    },
    emoji: {
        fontSize: 96,
        lineHeight: 112,
        textAlign: 'center',
    },
    selectedLabel: {
        color: theme.colors.typography,
        fontSize: theme.fontSize['2xl'].fontSize,
        fontWeight: theme.fontWeight.bold.fontWeight,
    },
    selector: {
        padding: theme.space(2),
        gap: theme.space(2),
    },
    optionPressable: {
        flex: 1,
    },
    option: (selected: boolean, response: AppReviewResponse) => {
        const backgroundByResponse = {
            bad: theme.colors.red[600],
            not_bad: theme.colors.amber[500],
            good: theme.colors.lime[500],
        } satisfies Record<AppReviewResponse, string>;

        return {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.space(1),
            paddingVertical: theme.space(3),
            borderRadius: theme.radius['2xl'],
            backgroundColor: selected ? backgroundByResponse[response] : 'transparent',
        };
    },
    optionEmoji: {
        fontSize: 28,
        lineHeight: 34,
    },
    optionLabel: {
        color: theme.colors.neutral[950],
        fontSize: theme.fontSize.sm.fontSize,
        lineHeight: theme.fontSize.sm.lineHeight,
        fontWeight: theme.fontWeight.semibold.fontWeight,
        textAlign: 'center',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        paddingHorizontal: theme.space(4),
        paddingBottom: theme.space(5) + rt.insets.bottom,
        width: '100%',
    },
    submitButton: {
        backgroundColor: theme.colors.neutral[950],
    },
    submitButtonText: {
        color: theme.colors.neutral[50],
    },
}));

const Header: FC<{ handleClose: () => void }> = ({ handleClose }) => {
    return (
        <Box style={styles.header}>
            <HStack style={styles.headerWrapper}>
                <Box />
                <CloseButton onPressHandler={handleClose} />
            </HStack>
        </Box>
    );
};

const AppReviewScreen: FC = () => {
    const { promptId: rawPromptId } = useLocalSearchParams<{ promptId?: string | string[] }>();
    const promptId = Array.isArray(rawPromptId) ? rawPromptId[0] : rawPromptId;
    const { t } = useTranslation(['screens']);
    const { track } = useAnalytics();

    const [selected, setSelected] = useState<AppReviewResponse>('good');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const finalizedRef = useRef(false);
    const actionInFlightRef = useRef(false);
    const promptIdRef = useRef(promptId);
    const trackRef = useRef(track);

    useEffect(() => {
        promptIdRef.current = promptId;
        trackRef.current = track;
    }, [promptId, track]);

    useEffect(
        () => () => {
            const id = promptIdRef.current;
            if (!id || finalizedRef.current || actionInFlightRef.current) return;

            runInBackground(async () => {
                const prompt = await dismissAppReviewPrompt(id);
                trackRef.current('app_review_prompt:dismissed', {
                    ...getPromptAnalyticsProperties(prompt),
                });
            }, 'Failed to dismiss app review prompt after screen close:');
        },
        [],
    );

    const handleClose = useCallback(async () => {
        if (isSubmitting) return;

        try {
            actionInFlightRef.current = true;
            setIsSubmitting(true);
            if (promptId) {
                const prompt = await dismissAppReviewPrompt(promptId);
                finalizedRef.current = true;
                track('app_review_prompt:dismissed', {
                    ...getPromptAnalyticsProperties(prompt),
                });
            } else {
                finalizedRef.current = true;
            }
            router.back();
        } catch (error) {
            actionInFlightRef.current = false;
            reportError(error, 'Failed to dismiss app review prompt:');
            router.back();
        }
    }, [isSubmitting, promptId, track]);

    const handleSubmit = useCallback(async () => {
        if (isSubmitting || !promptId) return;

        try {
            actionInFlightRef.current = true;
            setIsSubmitting(true);
            const prompt = await submitAppReviewPrompt(promptId, selected);
            finalizedRef.current = true;
            track('app_review_prompt:submitted', {
                ...getPromptAnalyticsProperties(prompt, selected),
            });
            router.back();

            if (selected === 'good') {
                runInBackground(async () => {
                    const attempt = await requestStoreReviewAfterTransition();
                    await recordStoreReviewAttempt(promptId, attempt);
                    track('app_review_prompt:store_review_requested', {
                        ...getPromptAnalyticsProperties(prompt, selected),
                        storeReviewAvailable: attempt.isAvailable,
                        storeReviewHasAction: attempt.hasAction,
                    });
                }, 'Failed to request store review after app review prompt:');
            }
        } catch (error) {
            actionInFlightRef.current = false;
            setIsSubmitting(false);
            reportError(error, 'Failed to submit app review prompt:');
        }
    }, [isSubmitting, promptId, selected, track]);

    return (
        <Box style={[styles.container, styles.selectedBackground(selected)]}>
            <Header handleClose={handleClose} />
            <Box style={styles.content}>
                <ScrollView contentContainerStyle={styles.scroll}>
                    <VStack style={styles.reviewContent}>
                        <VStack style={styles.prompt}>
                            <Text style={styles.question}>{t('appReview.title')}</Text>
                        </VStack>

                        <HStack style={styles.selector}>
                            {OPTIONS.map((option) => {
                                const isSelected = option.value === selected;
                                const optionLabel = t(
                                    `appReview.options.${OPTION_TRANSLATION_KEYS[option.value]}`,
                                );

                                return (
                                    <Pressable
                                        key={option.value}
                                        style={styles.optionPressable}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: isSelected }}
                                        accessibilityLabel={optionLabel}
                                        onPress={() => setSelected(option.value)}
                                    >
                                        <VStack style={styles.option(isSelected, selected)}>
                                            <Text style={styles.optionEmoji}>{option.emoji}</Text>
                                            <Text style={styles.optionLabel}>{optionLabel}</Text>
                                        </VStack>
                                    </Pressable>
                                );
                            })}
                        </HStack>
                    </VStack>
                </ScrollView>
            </Box>
            <Box style={styles.footer}>
                <Button
                    title={t('appReview.actions.submit')}
                    containerStyle={styles.submitButton}
                    textStyle={styles.submitButtonText}
                    spinnerColor={styles.submitButtonText.color}
                    loading={isSubmitting}
                    disabled={isSubmitting || !promptId}
                    onPress={handleSubmit}
                />
            </Box>
        </Box>
    );
};

export default AppReviewScreen;
