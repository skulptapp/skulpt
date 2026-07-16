export type AnalyticsEventProperties = Record<
    string,
    string | number | boolean | null | undefined | readonly string[] | readonly number[]
>;

type ReviewPromptProperties = {
    promptId: string;
    promptKey: string;
    cycleIndex: number;
    workoutId?: string;
    completionSource?: 'phone' | 'watch';
    response?: 'bad' | 'not_bad' | 'good';
    eligibleWorkoutCount: number;
};

type CampaignProperties = {
    campaignSource?: string;
    campaignMedium?: string;
    campaignName?: string;
};

// Keep user-entered and sensitive data out of this catalog. Do not add workout/exercise
// names, notes, search text, measurement values, health samples, or raw deep-link URLs.
export type AnalyticsEventMap = {
    'app:session_start': CampaignProperties & {
        source: 'cold_start' | 'foreground' | 'deep_link' | 'notification';
        isFirstSession: boolean;
    };
    'app:deep_link_opened': CampaignProperties;
    'app:share_requested': {
        surface: 'settings';
    };
    'app_review:manual_request': {
        surface: 'settings';
        storeReviewAvailable: boolean;
        storeReviewHasAction: boolean;
    };
    'workout:create': {
        status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
        hasStartDate: boolean;
        hasReminder: boolean;
    };
    'workout:duplicate': {
        mode: 'now' | 'planned' | 'completed';
    };
    'workout:start': {
        workoutId: string;
        source: 'new' | 'planned' | 'repeat';
        $insert_id?: string;
    };
    'workout:complete': {
        workoutId: string;
        duration: number | null;
        wallDurationSec: number;
        activeDurationSec: number;
        completedSetCount: number;
        exerciseCount: number;
        completionSource: 'phone' | 'watch';
        watchUsed: boolean;
        liveActivityUsed: boolean;
        $insert_id: string;
    };
    'workout:delete': undefined;
    'workout:reminder_scheduled': {
        leadTime: 'start' | '5m' | '10m' | '15m' | '30m' | '1h' | '2h';
        source: 'create' | 'update';
    };
    'workout:exercise_add': {
        workoutId: string;
        exerciseCount: number;
    };
    'workout:exercise_remove': {
        workoutId: string;
    };
    'workout:exercise_set_add': {
        workoutExerciseId: string;
        setType: string;
        source: 'manual' | 'exercise_seed' | 'copied';
    };
    'workout:exercise_set_remove': {
        workoutExerciseId: string;
    };
    'workout:exercise_set_complete': {
        workoutExerciseId: string;
        setType: string;
        source: 'phone' | 'watch' | 'auto_timer';
        $insert_id: string;
    };
    'exercise:create': {
        category: string;
    };
    'exercise:delete': undefined;
    'exercise_search:completed': {
        context: 'library' | 'workout_select';
        queryLength: number;
        scriptGroup: 'han' | 'latin' | 'cyrillic' | 'devanagari' | 'mixed' | 'other';
        resultCount: number;
        hasResults: boolean;
        activeFilterCount: number;
    };
    'exercise_search:result_selected': {
        context: 'library' | 'workout_select';
        rankBucket: '1' | '2_3' | '4_10' | '11_plus';
        ownership: 'system' | 'custom';
        category: string;
    };
    'exercise:guide_viewed': {
        surface: 'active_workout' | 'exercise_detail';
        ownership: 'system' | 'custom';
        category: string;
    };
    'exercise:preview_opened': {
        surface: 'exercise_library' | 'workout_select' | 'active_workout';
    };
    'watch:workout_started': {
        supported: boolean;
        paired: boolean;
    };
    'live_activity:started': {
        result: 'started' | 'recovered' | 'unavailable';
    };
    'health:permission_result': {
        platform: 'ios' | 'android';
        trigger: 'workout_start';
        granted: boolean;
        hasResolvedMhr: boolean;
    };
    'health:workout_export_result': {
        platform: 'ios' | 'android';
        outcome: 'saved' | 'skipped_watch' | 'permission_missing' | 'service_unavailable' | 'error';
    };
    'health:measurement_import_summary': {
        platform: 'ios' | 'android';
        permissionGranted: boolean;
        importedCount: number;
        skippedCount: number;
        sampledCount: number;
        metricTypes: readonly string[];
    };
    'notification:permission_result': {
        trigger: 'initial_check' | 'request' | 'settings_change';
        status: string;
        granted: boolean;
    };
    'notification:opened': {
        kind: 'workout_reminder' | 'rest_timer' | 'work_timer' | 'other';
    };
    'measurement:created': {
        metric: string;
        source: 'manual' | 'health';
        count: number;
    };
    'sync:first_success': {
        trigger: 'initial' | 'scheduled' | 'deferred' | 'manual';
        durationMs: number;
        pendingBefore: number;
        pendingAfter: number;
    };
    'sync:state_changed': {
        outcome: 'success' | 'failure';
        trigger: 'initial' | 'scheduled' | 'deferred' | 'manual';
        durationMs: number;
        pendingBefore: number;
        pendingAfter: number;
    };
    'app_review_prompt:eligible': ReviewPromptProperties;
    'app_review_prompt:deferred': ReviewPromptProperties;
    'app_review_prompt:shown': ReviewPromptProperties;
    'app_review_prompt:submitted': ReviewPromptProperties;
    'app_review_prompt:dismissed': ReviewPromptProperties;
    'app_review_prompt:store_review_requested': ReviewPromptProperties & {
        storeReviewAvailable: boolean;
        storeReviewHasAction: boolean;
    };
};

export type AnalyticsEventName = keyof AnalyticsEventMap;

export type AnalyticsScreenName =
    | 'home'
    | 'progress'
    | 'exercise_library'
    | 'settings'
    | 'workout_editor'
    | 'exercise_editor'
    | 'exercise_select'
    | 'exercise_preview'
    | 'exercise_guide'
    | 'app_review'
    | 'results_day'
    | 'exercise_filter'
    | 'workout'
    | 'active_exercise'
    | 'exercise_detail'
    | 'measurement_editor'
    | 'settings_autolock'
    | 'settings_datetime'
    | 'settings_heart_rate'
    | 'settings_language'
    | 'settings_notifications'
    | 'settings_sound'
    | 'settings_theme'
    | 'settings_units'
    | 'not_found';
