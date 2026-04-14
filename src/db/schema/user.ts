import { sql, relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { exercise } from './exercise';
import { workout } from './workout';

export type UserSelect = typeof user.$inferSelect;
export type UserInsert = typeof user.$inferInsert;

export const user = sqliteTable('user', {
    id: text('id', { length: 21 }).primaryKey(),
    status: text('status', { length: 20 }),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    isDelayed: integer('is_delayed', { mode: 'boolean' }),
    isDelayedDate: integer('is_delayed_date', { mode: 'timestamp_ms' }),
    pushes: integer('pushes', { mode: 'boolean' }).default(true),
    nativeToken: text('native_token', { length: 100 }),
    epsToken: text('eps_token', { length: 100 }),
    applicationId: text('application_id', { length: 50 }),
    applicationName: text('application_name', { length: 50 }),
    applicationVersion: text('application_version', { length: 50 }),
    applicationBuildNumber: text('application_build_number', { length: 50 }),
    deviceBrand: text('device_brand', { length: 50 }),
    device: text('device', { length: 50 }),
    deviceType: text('device_type', { length: 50 }),
    deviceModel: text('device_model', { length: 50 }),
    deviceSystemName: text('device_system_name', { length: 50 }),
    deviceSystemVersion: text('device_system_version', { length: 50 }),
    lng: text('lng', { length: 2 }).default('en'),
    alert: integer('alert', { mode: 'boolean' }),
    badge: integer('badge', { mode: 'boolean' }),
    lockScreen: integer('lock_screen', { mode: 'boolean' }),
    notificationCenter: integer('notification_center', { mode: 'boolean' }),
    provisional: integer('provisional', { mode: 'boolean' }),
    sound: integer('sound', { mode: 'boolean' }),
    carPlay: integer('car_play', { mode: 'boolean' }),
    criticalAlert: integer('critical_alert', { mode: 'boolean' }),
    providesAppSettings: integer('provides_app_settings', { mode: 'boolean' }),
    theme: text('theme', { enum: ['auto', 'light', 'dark'] }).default('auto'),
    bodyWeightUnits: text('body_weight_units', { enum: ['kg', 'lb'] }),
    measurementUnits: text('measurement_units', { enum: ['cm', 'in'] }),
    weightUnits: text('weight_units', { enum: ['kg', 'lb'] }),
    distanceUnits: text('distance_units', { enum: ['km', 'mi'] }),
    temperatureUnits: text('temperature_units', { enum: ['celsius', 'fahrenheit'] }),
    screenAutoLock: integer('screen_auto_lock', { mode: 'boolean' }).default(true),
    playSounds: integer('play_sounds', { mode: 'boolean' }).default(true),
    playHaptics: integer('play_haptics', { mode: 'boolean' }).default(true),
    soundsVolume: integer('sounds_volume').default(100),
    firstWeekday: integer('first_weekday'),
    timeFormat: text('time_format', { enum: ['12h', '24h'] }),
    timeZone: text('time_zone', { length: 50 }).default('UTC'),
    calendar: text('calendar', { length: 50 }).default('gregorian'),
    textDirection: text('text_direction').default('ltr'),
    currencyCode: text('currency_code', { length: 3 }).default('USD'),
    currencySymbol: text('currency_symbol', { length: 10 }).default('$'),
    regionCode: text('region_code', { length: 10 }).default('UNKNOWN'),
    mhrFormula: text('mhr_formula', {
        enum: ['nes', 'fox', 'tanaka', 'inbar', 'gulati', 'gellish', 'manual'],
    }).default('nes'),
    mhrManualValue: integer('mhr_manual_value'),
    birthday: integer('birthday', { mode: 'timestamp_ms' }),
    biologicalSex: text('biological_sex', { enum: ['female', 'male', 'other'] }),
    activityLevel: text('activity_level', { enum: ['sedentary', 'active', 'trained'] }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
        .notNull()
        .default(sql`(strftime('%s','now') * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
        .notNull()
        .default(sql`(strftime('%s','now') * 1000)`)
        .$onUpdate(() => new Date()),
});

export const userRelations = relations(user, ({ many }) => ({
    exercises: many(exercise),
    workouts: many(workout),
}));
