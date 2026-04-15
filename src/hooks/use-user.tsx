import { createContext, PropsWithChildren, useContext, useEffect, FC } from 'react';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { useMutation, useQuery } from '@tanstack/react-query';
import { UnistylesRuntime } from 'react-native-unistyles';
import { getLocales, getCalendars } from 'expo-localization';

import i18n from '@/locale/i18n';
import { createOrUpdateCurrentUser, getCurrentUser } from '@/crud/user';
import { queryClient } from '@/queries';
import { ensureValidToken } from '@/services/auth';
import { isSyncEnabled } from '@/sync/config';
import { supportedLanguages } from '@/locale/constants';
import type { UserSelect } from '@/db/schema/user';
import { z } from 'zod';
import { storage } from '@/storage';
import { readBiologicalSex, readDateOfBirth } from '@/services/health';

export const themes = ['auto', 'light', 'dark'] as const;

export const editUserSchema = z.object({
    theme: z.enum(themes).optional(),
    lng: z.enum(supportedLanguages).optional(),
    pushes: z.boolean().optional(),
    screenAutoLock: z.boolean().optional(),
    bodyWeightUnits: z.enum(['kg', 'lb']).optional(),
    measurementUnits: z.enum(['cm', 'in']).optional(),
    weightUnits: z.enum(['kg', 'lb']).optional(),
    distanceUnits: z.enum(['km', 'mi']).optional(),
    firstWeekday: z.number().optional(),
    timeFormat: z.enum(['12h', '24h']).optional(),
    playSounds: z.boolean().optional(),
    soundsVolume: z.number().optional(),
    mhrFormula: z.enum(['nes', 'fox', 'tanaka', 'inbar', 'gulati', 'gellish', 'manual']).optional(),
    mhrManualValue: z.number().int().min(100).max(240).nullable().optional(),
    birthday: z.date().nullable().optional(),
    biologicalSex: z.enum(['female', 'male', 'other']).nullable().optional(),
    activityLevel: z.enum(['sedentary', 'active', 'trained']).nullable().optional(),
});

export type EditUserFormData = z.infer<typeof editUserSchema>;

const applyTheme = (theme: (typeof themes)[number]) => {
    if (theme === 'auto') {
        UnistylesRuntime.setTheme(UnistylesRuntime.colorScheme === 'dark' ? 'dark' : 'light');
        storage.set('user.theme', 'auto');
    } else {
        UnistylesRuntime.setTheme(theme);
        storage.set('user.theme', theme);
    }
};

type UserContextType = ReturnType<typeof useUserProvider>;

const userContext = createContext<UserContextType>({} as UserContextType);

const UserProvider: FC<PropsWithChildren> = ({ children }) => {
    const user = useUserProvider();

    return <userContext.Provider value={user}>{children}</userContext.Provider>;
};

const useUser = () => {
    return useContext(userContext);
};

const useUserProvider = () => {
    const { data: user } = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            return await getCurrentUser();
        },
    });

    // Bootstrap auth token once when the user ID is known.
    // Runs in the background — if the server is unreachable the next sync cycle will retry.
    useEffect(() => {
        if (!user?.id || !isSyncEnabled()) return;
        ensureValidToken(user.id).catch(() => {});
    }, [user?.id]);

    const { mutate, mutateAsync, isPending } = useMutation({
        mutationFn: createOrUpdateCurrentUser,
        onMutate: async (newUser) => {
            await queryClient.cancelQueries({ queryKey: ['user'] });

            const previousUser = queryClient.getQueryData<UserSelect>(['user']);
            const previousLng = i18n.language;
            const previousTheme = previousUser?.theme || 'dark';

            // Optimistically update cache, i18n language and theme
            queryClient.setQueryData(['user'], { ...previousUser, ...newUser });
            if (newUser.lng && newUser.lng !== previousLng) {
                i18n.changeLanguage(newUser.lng);
            }
            if (newUser.theme && newUser.theme !== previousTheme) {
                applyTheme(newUser.theme as (typeof themes)[number]);
            }

            return { previousUser, previousLng, previousTheme };
        },
        onError: (_, __, context) => {
            queryClient.setQueryData(['user'], context?.previousUser);

            if (context?.previousLng && context.previousLng !== i18n.language) {
                i18n.changeLanguage(context.previousLng);
            }

            if (context?.previousTheme !== context?.previousUser?.theme) {
                applyTheme(context?.previousTheme || 'dark');
            }
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['user'] }),
    });

    useEffect(() => {
        const initUser = async () => {
            const existingUser = await getCurrentUser();

            const locales = getLocales();
            const calendars = getCalendars();

            const userLng = existingUser?.lng || i18n.language;
            const userTheme = existingUser?.theme || 'dark';
            const userBodyWeightUnits =
                existingUser?.bodyWeightUnits ??
                (locales[0].measurementSystem === 'metric' ? 'kg' : 'lb');
            const userMeasurementUnits =
                existingUser?.measurementUnits ??
                (locales[0].measurementSystem === 'metric' ? 'cm' : 'in');
            const userWeightUnits =
                existingUser?.weightUnits ??
                (locales[0].measurementSystem === 'metric' ? 'kg' : 'lb');
            const userDistanceUnits =
                existingUser?.distanceUnits ??
                (locales[0].measurementSystem === 'metric' ? 'km' : 'mi');
            const userTemperatureUnits =
                existingUser?.temperatureUnits ??
                (locales[0].measurementSystem === 'metric' ? 'celsius' : 'fahrenheit');
            const userFirstWeekday = existingUser?.firstWeekday || calendars[0].firstWeekday;
            const userTimeFormat =
                existingUser?.timeFormat ?? (calendars[0].uses24hourClock ? '24h' : '12h');
            const userBirthday = existingUser?.birthday ?? (await readDateOfBirth());
            const userBiologicalSex = existingUser?.biologicalSex ?? (await readBiologicalSex());

            mutate({
                applicationId: Application.applicationId,
                applicationName: Application.applicationName,
                applicationVersion: Application.nativeApplicationVersion,
                applicationBuildNumber: Application.nativeBuildVersion,
                device: Device.modelId,
                deviceBrand: Device.brand,
                deviceType: Device.deviceType ? Device.DeviceType[Device.deviceType] : 'UNKNOWN',
                deviceModel: Device.modelName,
                deviceSystemName: Device.osName,
                deviceSystemVersion: Device.osVersion,
                lng: userLng,
                theme: userTheme,
                bodyWeightUnits: userBodyWeightUnits,
                measurementUnits: userMeasurementUnits,
                weightUnits: userWeightUnits,
                distanceUnits: userDistanceUnits,
                temperatureUnits: userTemperatureUnits,
                firstWeekday: userFirstWeekday,
                timeFormat: userTimeFormat,
                timeZone: calendars[0].timeZone,
                calendar: calendars[0].calendar,
                textDirection: locales[0].textDirection,
                currencyCode: locales[0].currencyCode,
                currencySymbol: locales[0].currencySymbol,
                regionCode: locales[0].regionCode,
                birthday: userBirthday,
                biologicalSex: userBiologicalSex,
            });
        };

        initUser();
    }, [mutate]);

    return {
        user,
        updateUser: mutateAsync,
        isUpdating: isPending,
    };
};

export { UserProvider, useUser };
