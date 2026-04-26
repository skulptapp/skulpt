# Strain Methodology

This document describes how Skulpt calculates the Strain metric in the current algorithm
version:

```text
STRAIN_ALGORITHM_VERSION = 1
```

The goal is to make the methodology defensible in front of physicians, sports
physiologists, exercise scientists, and fitness coaches. It explains what Strain measures,
which physiological assumptions are used, which formulas are implemented, which data are
required, where the calculation is intentionally product-specific, and which limitations
must be considered before interpreting the result.

Important: Skulpt Strain is not a medical diagnosis, a disease marker, a replacement for
cardiopulmonary exercise testing (CPET), lactate testing, ECG stress testing, or clinical
exercise clearance. It is an application-level internal-load metric derived from heart rate,
heart-rate reserve (HRR), and Banister TRIMP, then normalized onto a bounded `0..100` scale.

## Executive Summary

Skulpt Strain is calculated in four main steps:

1. Read a heart-rate time series from HealthKit or Health Connect.
2. Convert heart rate into relative intensity using heart-rate reserve:

    ```text
    HRR = MHR - RHR
    intensity = clamp((HR - RHR) / HRR, 0, 1)
    ```

3. Integrate load over time using Banister TRIMP:

    ```text
    TRIMP_segment = duration_minutes * intensity * sex_weight(intensity)
    TRIMP_total = sum(TRIMP_segment)
    ```

4. Convert TRIMP onto the Skulpt Strain scale:

    ```text
    Strain = min(100, round(75 * ln(1 + TRIMP / 80)))
    ```

The app exposes three daily values:

- `Day Strain`: all accepted cardiovascular load for the user's local day.
- `Activity Strain`: the portion of daily load that falls inside completed workout windows.
- `Passive Strain`: the portion of daily load outside completed workout windows.

`Day Strain` is not equal to `Activity Strain + Passive Strain`. TRIMP is additive, but
Strain is a nonlinear logarithmic transformation of TRIMP.

## Implementation Map

The calculation is implemented primarily in these files:

- `src/helpers/strain.ts`: TRIMP, Banister coefficients, Strain scaling, Strain levels, and
  estimated RHR fallback.
- `src/helpers/heart-rate-zones.ts`: MHR calculation, HRR intensity, HRR zones, and
  per-workout Activity Strain.
- `src/services/daily-strain.ts`: Day Strain, Daily Activity Strain, Passive Strain, daily
  cache, day segmentation, workout-window clipping, and range recomputation.
- `src/services/resting-heart-rate.ts`: RHR resolution from health data, manual profile data,
  or activity-level fallback.
- `src/services/health.ts`: HealthKit / Health Connect access for heart-rate samples, resting
  heart rate, date of birth, biological sex, and workout summary metrics.
- `src/db/schema/daily-strain.ts`: local persisted/cache schema for daily Strain aggregates.

Some function names in code historically use `Bannister`, but the method is named after
Eric W. Banister in the scientific literature.

## Scientific Basis

### Internal Training Load

Training load is commonly separated into:

- `External load`: the mechanical work performed, such as distance, pace, power, resistance,
  repetitions, velocity, or volume.
- `Internal load`: the physiological response to that work, such as heart rate, rating of
  perceived exertion (RPE), blood lactate, ventilation, oxygen uptake, heart-rate variability,
  and related markers.

Skulpt Strain is an internal-load metric. It does not attempt to measure mechanical work
directly. Instead, it quantifies the cardiovascular response to activity. This is useful when
external work is difficult to compare across exercise modalities, such as running, strength
training, walking, team sports, daily activity, heat exposure, illness, or stress responses.

There is no single field-based gold standard for training-load measurement. Lambert and
Borresen describe the training dose-response concept as straightforward in principle, but
emphasize that measuring the field "dose" is difficult and method-dependent:
[Lambert & Borresen, 2010](https://pubmed.ncbi.nlm.nih.gov/20861529/). Therefore, Skulpt
Strain should be interpreted as a standardized applied internal-load metric, not as an
absolute biological quantity.

### Why Heart-Rate Reserve Instead of Percent of Max HR

Heart-rate reserve accounts for both maximum heart rate and resting heart rate:

```text
HRR = MHR - RHR
```

Relative intensity is computed as the fraction of the available reserve being used:

```text
fraction_HRR = (HR - RHR) / (MHR - RHR)
```

This is closely related to the Karvonen method for target heart-rate prescription:

```text
target_HR = RHR + intensity_fraction * (MHR - RHR)
```

The approach is historically connected to Karvonen, Kentala, and Mustala's work on training
effects on heart rate:
[Karvonen et al., 1957](https://www.scirp.org/reference/referencespapers?referenceid=835840).
Modern exercise-prescription guidance also widely uses HRR or VO2 reserve:
[ACSM position stand, Garber et al., 2011](https://pubmed.ncbi.nlm.nih.gov/21694556/).

The practical advantages of HRR for Skulpt are:

- Two people with the same MHR but different RHR values do not have the same physiological
  reserve at the same absolute HR.
- If aerobic fitness improves and RHR decreases, the interpretation of the same absolute HR
  changes automatically.
- HRR produces more individualized intensity estimates than a simple percentage of MHR.

### Why Banister TRIMP

TRIMP means training impulse. It is a classic way to collapse exercise duration and relative
intensity into one internal-load value. Historically, TRIMP is associated with Banister et al.
and fitness-fatigue models of athletic preparation:

- [Banister, Calvert, Savage & Bach, 1975](https://www.sciepub.com/reference/340730)
- [Morton, Fitz-Clarke & Banister, 1990](https://pubmed.ncbi.nlm.nih.gov/2246166/)
- [Banister, 1991, chapter reference in Stagno et al.](https://umh1617.umh.es/files/2016/05/2007-JSS-25-629-634.pdf)

The central idea of Banister TRIMP is that minutes of exercise are multiplied by relative
intensity and by an exponential weighting factor that grows faster at high intensities. This
guards against treating ten minutes near threshold as merely a linear addition to ten minutes
of easy activity.

Stagno et al. discuss modified TRIMP for intermittent team sports and note a key limitation
of using mean HR: mean HR can smooth out short high-intensity bursts. Skulpt therefore does
not compute daily or workout TRIMP from a single average HR. It sums TRIMP across accepted
heart-rate time segments:
[Stagno, Thatcher & van Someren, 2007](https://umh1617.umh.es/files/2016/05/2007-JSS-25-629-634.pdf).

Additional references supporting TRIMP or related training-load approaches:

- [Wallace, Slattery & Coutts, 2014](https://pubmed.ncbi.nlm.nih.gov/24104194/) compares
  TRIMP, session-RPE, and running training stress score in endurance training.
- [Training load quantification of high intensity exercises, 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC7398532/)
  discusses discrepancies between training-load methods during high-intensity sessions.

## Input Data

### Heart-Rate Samples

Sources:

- iOS: HealthKit `HKQuantityTypeIdentifierHeartRate`, unit `count/min`.
- Android: Health Connect `HeartRate`.

Each sample is normalized to this shape:

```ts
{
    timestamp: number; // milliseconds since Unix epoch
    bpm: number; // beats per minute
}
```

For Day Strain, the app reads samples in this window:

```text
[dayStartAt, computedUntilAt]
```

where:

- `dayStartAt` is the user's local midnight for `dateKey`.
- `computedUntilAt` is:
    - the local day end for historical days;
    - the current time for the current day, clamped between day start and day end.

### Local Day

A day is identified by:

```text
dateKey = YYYY-MM-DD
```

The day boundaries are computed in the user's timezone:

```text
dayStartAt = local(dateKey 00:00:00)
dayEndAt   = local(nextDateKey 00:00:00)
```

This matters for daylight-saving transitions, travel, and users outside UTC. Cached daily
rows are considered stale if the user's timezone changes in a way that changes the local day
window.

### Maximum Heart Rate (MHR)

MHR is the upper bound of the heart-rate reserve.

Resolution order:

1. If the user selected `manual`, use `mhrManualValue`.
2. If the user selected an age-based formula, date of birth is required.
3. If date of birth is missing and manual MHR is not provided, Strain is not computed:
   `status = missing_mhr`.

Current formulas:

| Code value | Formula                     | Notes and source                                                                                                                                 |
| ---------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `nes`      | `MHR = 211 - 0.64 * age`    | Default in Skulpt. HUNT Fitness Study, 3320 healthy subjects: [Nes et al., 2013](https://doi.org/10.1111/j.1600-0838.2012.01445.x).              |
| `fox`      | `MHR = 220 - age`           | Historically common Fox/Haskell formula: [Fox et al., 1971 reference](https://www.sciepub.com/reference/334691), also discussed by Tanaka et al. |
| `tanaka`   | `MHR = 208 - 0.7 * age`     | Meta-analysis and cross-validation: [Tanaka, Monahan & Seals, 2001](https://pubmed.ncbi.nlm.nih.gov/11153730/).                                  |
| `inbar`    | `MHR = 205.8 - 0.685 * age` | Incremental treadmill test in 1424 men: [Inbar et al., 1994](https://pubmed.ncbi.nlm.nih.gov/8007799/).                                          |
| `gulati`   | `MHR = 206 - 0.88 * age`    | Women-specific cohort: [Gulati et al., 2010](https://doi.org/10.1161/CIRCULATIONAHA.110.939249).                                                 |
| `gellish`  | `MHR = 207 - 0.7 * age`     | Legacy support. Longitudinal model: [Gellish et al., 2007](https://reference.medscape.com/medline/abstract/17468581).                            |
| `manual`   | `MHR = mhrManualValue`      | Preferred when available from a valid maximal test, reliable observation, or clinician/sports-science assessment for the individual user.        |

Age is calculated as full years on the device's current date.

TRIMP calculation uses the raw floating-point MHR value. The daily cache stores
`mhrUsed = floor(MHR)` so that UI and sync have a stable integer value.

Critical limitation: age-based MHR formulas are population estimates. Even good formulas
have substantial individual error. Tanaka et al. show a strong group-level relationship with
age, but this does not make the formula an accurate individual measurement. For athletes,
people with naturally high or low MHR, cardiology patients, and users taking medications that
alter chronotropic response, a measured or manually corrected MHR is preferable.

### Resting Heart Rate (RHR)

RHR is the lower bound of the heart-rate reserve.

Resolution order:

1. Health-source resting heart rate during the 30 days before `computedUntilAt`.
2. Manual profile value `user.restingHeartRate`, if positive.
3. Activity-level estimate:

    ```text
    trained   -> 55 bpm
    sedentary -> 72 bpm
    active    -> 65 bpm
    unknown   -> 65 bpm
    ```

HealthKit / Health Connect RHR is rounded to the nearest integer:

```text
RHR = round(health_resting_hr)
```

The activity-level fallback is not intended to be clinically precise. It exists so users
without health RHR and without manual RHR can still receive an approximate metric. The
daily cache stores `rhrSource` so the UI can communicate when RHR was estimated.

### Biological Sex

Biological sex is used only for Banister TRIMP coefficients.

Resolution order:

1. User profile value `user.biologicalSex`, if set.
2. iOS HealthKit characteristic `HKCharacteristicTypeIdentifierBiologicalSex`.
3. `null`, if unavailable or unsupported.

Possible values:

```text
female | male | other | null
```

If the value is `other` or `null`, Skulpt uses a neutral coefficient between the male and
female coefficient curves. This is a product fallback, not a separately clinically validated
model.

## Heart-Rate Time-Series Preparation

Raw heart-rate samples are not used as independent points. They are converted into
piecewise-constant time segments.

### Segment Model

Each segment has this shape:

```ts
{
    startMs: number;
    endMs: number;
    bpm: number;
}
```

Interpretation:

```text
HR is considered equal to bpm during [startMs, endMs)
```

This is a sample-and-hold approach: a sample is assumed to hold until the next sample if the
gap between the two samples is acceptable.

### Sample Filtering

Before segments are built:

```text
sample.timestamp must be inside [windowStartMs, windowEndMs]
sample.bpm must be finite
samples are sorted by timestamp ascending
```

Samples outside the window are not used.

### Gap Handling

For adjacent samples:

```text
gapMs = next.timestamp - current.timestamp
```

If:

```text
gapMs <= maxGapMs
```

a segment is created from the current sample to the next sample.

If:

```text
gapMs > maxGapMs
```

the interval is treated as uncovered and contributes no TRIMP.

Parameters:

| Context                             | maxGapMs | boundaryGraceMs | Rationale                                                                                                   |
| ----------------------------------- | -------: | --------------: | ----------------------------------------------------------------------------------------------------------- |
| Daily / Passive / Activity day calc |   20 min |          20 min | Health devices may sample background HR sparsely. A longer tolerance avoids excessive fragmentation.        |
| Workout stats calculation           |    2 min |           2 min | During workouts HR sampling should be denser; large gaps should not be treated as continuous measured load. |

### Boundary Grace

If the first sample is close to the beginning of the window:

```text
current.timestamp - windowStartMs <= boundaryGraceMs
```

the first segment starts at `windowStartMs`, not at the sample timestamp.

If the last sample is close to the end of the window:

```text
windowEndMs - current.timestamp <= boundaryGraceMs
```

the last segment extends to `windowEndMs`.

This prevents the calculation from losing the first or last minutes of a workout or day
because of small mismatches between the activity boundary and the first or last HR sample.

### Why Skulpt Does Not Interpolate

Skulpt does not linearly interpolate HR between samples. HealthKit and Health Connect
samples can be irregular, and interpolation would create artificial values that were not
measured by the sensor. Sample-and-hold is simpler, more stable, and easier to audit. Large
gaps are explicitly excluded by `maxGapMs`.

Limitation: sparse background sampling within the 20-minute daily tolerance can smooth fast
HR spikes. Workout stats use a stricter 2-minute threshold.

## Intensity: HRR Fraction

For each segment, Skulpt computes relative intensity:

```text
HRR = MHR - RHR
rawIntensity = (segment.bpm - RHR) / HRR
intensity = clamp(rawIntensity, 0, 1)
```

where:

```text
clamp(x, 0, 1) = min(1, max(0, x))
```

If:

```text
MHR <= RHR
```

the calculation is invalid because heart-rate reserve is not positive. For daily Strain,
Skulpt returns:

```text
status = invalid_heart_rate_settings
```

Clamp behavior:

- HR below RHR produces intensity `0`, therefore TRIMP `0`.
- HR above MHR produces intensity `1`, preventing unbounded load from sensor spikes or
  incorrect peak values.

## Banister TRIMP in Skulpt

### Segment Formula

For one segment:

```text
durationMinutes = (endMs - startMs) / 60000
I = clamp((bpm - RHR) / (MHR - RHR), 0, 1)
Y = A * exp(B * I)
TRIMP_segment = durationMinutes * I * Y
```

Coefficients:

| biologicalSex    |    A |    B |
| ---------------- | ---: | ---: |
| `male`           | 0.64 | 1.92 |
| `female`         | 0.86 | 1.67 |
| `other` / `null` | 0.75 | 1.80 |

The male and female coefficients correspond to classic Banister TRIMP weighting, where the
exponential multiplier reflects the nonlinear increase in physiological stress with rising
intensity. Stagno et al. describe this same principle: weighting increases exponentially as
intensity rises and is linked to a typical blood-lactate response curve:
[Stagno et al., 2007](https://umh1617.umh.es/files/2016/05/2007-JSS-25-629-634.pdf).

Neutral coefficients:

```text
A_neutral = 0.75
B_neutral = 1.80
```

These are product-level midpoints between the male and female curves:

```text
0.75 ~= (0.64 + 0.86) / 2
1.80 ~= (1.92 + 1.67) / 2
```

They are used for unknown or `other` biological sex. They are not a separately validated
clinical model.

### TRIMP Summation

TRIMP for a period:

```text
TRIMP_total = round2(sum(TRIMP_segment_i))
```

where:

```text
round2(x) = round(x * 100) / 100
```

TRIMP is additive. If a period is split into non-overlapping intervals:

```text
TRIMP_total ~= TRIMP_part_1 + TRIMP_part_2 + ...
```

Small differences can occur because each aggregate is rounded to two decimals.

### TRIMP Example

Given:

```text
MHR = 190 bpm
RHR = 60 bpm
sex = male
segment HR = 135 bpm
duration = 60 min
```

Heart-rate reserve:

```text
HRR = 190 - 60 = 130
```

Intensity:

```text
I = (135 - 60) / 130 = 75 / 130 = 0.5769
```

Male Banister weight:

```text
Y = 0.64 * exp(1.92 * 0.5769)
Y = 0.64 * exp(1.1077)
Y ~= 1.94
```

TRIMP:

```text
TRIMP = 60 * 0.5769 * 1.94 ~= 67
```

This order of magnitude is enforced by regression tests.

## TRIMP-to-Strain Transformation

TRIMP is unbounded and can be difficult to display directly. Skulpt converts TRIMP to a
bounded `0..100` Strain scale.

Formula:

```text
Strain = min(100, round(75 * ln(1 + TRIMP / 80)))
```

Constants:

```text
STRAIN_SCALE_A = 75
STRAIN_SCALE_B = 80
```

### Why a Logarithmic Scale

The logarithmic scale is a product normalization choice:

- It preserves `0 TRIMP -> 0 Strain`.
- It is monotonic: higher TRIMP always maps to equal or higher Strain.
- It is responsive to low and moderate loads.
- It compresses very large TRIMP values so the UI scale remains finite.
- It constrains the displayed value to `0..100`.

This does not claim that physiological fatigue is logarithmically equal to TRIMP. The
scientific foundation is HRR/TRIMP. The TRIMP-to-Strain transformation is Skulpt's product
calibration layer.

### Inverse Formula

For threshold interpretation, the approximate inverse is:

```text
TRIMP = 80 * (exp(Strain / 75) - 1)
```

Examples:

| Strain | Approx TRIMP |
| -----: | -----------: |
|     15 |         17.7 |
|     35 |         47.6 |
|     55 |         86.6 |
|     75 |        137.5 |
|     90 |        185.6 |
|    100 |        223.6 |

Because of `min(100, ...)`, all values above roughly `223.6 TRIMP` display as `100`.

### TRIMP-to-Strain Example

For the previous example:

```text
TRIMP ~= 67
Strain = round(75 * ln(1 + 67 / 80))
Strain = round(75 * ln(1.8375))
Strain = round(45.6)
Strain = 46
```

## Strain Levels

After numeric Strain is calculated, Skulpt assigns a label:

| Strain range | Level       |
| -----------: | ----------- |
|      `0..15` | `rest`      |
|     `16..35` | `light`     |
|     `36..55` | `moderate`  |
|     `56..75` | `high`      |
|     `76..90` | `very_high` |
|    `91..100` | `maximum`   |

These levels are UI categories. They are not clinical risk zones and should not be used as
medical cutoffs.

## Day Strain

### Definition

`Day Strain` is Strain from all accepted HR segments during the user's local day:

```text
daySegments = segments(heartRateSamples within [dayStartAt, computedUntilAt])
dayTrimp = TRIMP(daySegments)
dayStrain = strainFromTrimp(dayTrimp)
```

For the current day:

```text
computedUntilAt = now
```

clamped to the local day boundaries. Therefore, current-day Strain can grow throughout the
day and is refreshed more often.

For historical days:

```text
computedUntilAt = dayEndAt
```

### When Day Strain Is Not Ready

Possible statuses:

| Status                        | Meaning                                                                 |
| ----------------------------- | ----------------------------------------------------------------------- |
| `missing_mhr`                 | MHR cannot be resolved: no manual MHR and no date of birth for formula. |
| `invalid_heart_rate_settings` | `MHR <= RHR`, so heart-rate reserve is not positive.                    |
| `no_hr_data`                  | No HR samples, or no accepted segments after gap filtering.             |
| `ready`                       | A valid calculation exists.                                             |

If the calculation is not ready, Strain fields are stored as `null`, but diagnostic fields
are still cached: `sampleCount`, `trackedSeconds`, `rhrUsed`, `rhrSource`, `mhrUsed`,
`algorithmVersion`, and `computedUntilAt`. This allows the UI to explain why a value is not
available.

## Activity Strain

There are two related but distinct Activity Strain contexts.

### Activity Strain Inside Workout Stats

For a completed workout, the app reads HR samples around the workout window. HealthKit may
provide a more precise workout summary window; if available, that window is used.

Workout segmentation parameters:

```text
maxGapMs = 2 minutes
boundaryGraceMs = 2 minutes
```

Formulas:

```text
workoutSegments = accepted segments inside workout window
workoutTrimp = TRIMP(workoutSegments)
workoutActivityStrain = strainFromTrimp(workoutTrimp)
```

The app also stores:

- weighted average HR;
- min/max HR;
- average/min/max HRR intensity;
- time in HRR zones;
- TRIMP;
- Strain level.

HRR zones:

```text
zone 1: 50% <= HRR% < 60%
zone 2: 60% <= HRR% < 70%
zone 3: 70% <= HRR% < 80%
zone 4: 80% <= HRR% < 90%
zone 5: 90% <= HRR%
zone 0: HRR% < 50%, not accumulated in zones
```

Zone labels are used for UI and do not directly participate in TRIMP.

### Daily Activity Strain

For daily Activity Strain, the app selects all completed workouts for the user that intersect
the daily window:

```text
workout.status = completed
workout.startedAt < dayEnd/computedUntilAt
workout.completedAt > dayStart
```

Each workout window is clipped to the day window:

```text
window.start = max(workout.startedAt, dayStartAt)
window.end   = min(workout.completedAt, computedUntilAt)
```

Workout windows are then merged so overlapping workouts do not double-count daily Activity
TRIMP:

```text
mergedWorkoutWindows = merge(overlapping or touching windows)
activitySegments = intersect(daySegments, mergedWorkoutWindows)
activityTrimp = TRIMP(activitySegments)
activityStrain = strainFromTrimp(activityTrimp)
```

### Activity Breakdown

`activityBreakdown` stores per-workout explanatory detail:

```ts
type DailyStrainActivityBreakdownItem = {
    workoutId: string;
    name: string;
    startMs: number;
    endMs: number;
    trimp: number;
    strain: number;
    strainLevel: StrainLevel;
    isPartialDayWindow: boolean;
};
```

`isPartialDayWindow = true` if the workout crossed a day boundary or the current
`computedUntilAt` boundary and was clipped.

Important: daily `activityTrimp` is calculated from merged workout windows to avoid double
counting. Breakdown rows are calculated per workout window for UI explanation. If the data
contains overlapping workouts, the sum of breakdown rows may differ from daily
`activityTrimp`.

## Passive Strain

`Passive Strain` is Strain from accepted HR segments outside completed workout windows.

Formulas:

```text
passiveSegments = subtract(daySegments, mergedWorkoutWindows)
passiveTrimp = TRIMP(passiveSegments)
passiveStrain = strainFromTrimp(passiveTrimp)
```

Passive Strain may include:

- walking or daily activity without a recorded workout;
- an unlogged workout;
- recovery activity;
- physiological response to stress, heat, illness, poor sleep, or dehydration;
- sensor artifacts if they pass gap filtering and clamp behavior.

Therefore, Passive Strain should not be interpreted as "bad stress" or as a pure measure of
psychological stress. It is cardiovascular load outside known workout windows.

## Why Day Strain Is Not Activity Strain Plus Passive Strain

TRIMP is additive. Strain is not.

If:

```text
dayTrimp ~= activityTrimp + passiveTrimp
```

then:

```text
dayStrain = f(dayTrimp)
activityStrain = f(activityTrimp)
passiveStrain = f(passiveTrimp)
```

where:

```text
f(x) = min(100, round(75 * ln(1 + x / 80)))
```

Because `f` is nonlinear:

```text
f(a + b) != f(a) + f(b)
```

Example:

```text
activityTrimp = 67  -> activityStrain = 46
passiveTrimp = 20   -> passiveStrain ~= 17
dayTrimp = 87       -> dayStrain ~= 55
```

Adding Strain scores directly would produce:

```text
46 + 17 = 63
```

which would overstate the daily metric. Therefore, Day Strain must be interpreted as an
independent transformation of full-day TRIMP.

## Caching and Recalculation

Daily Strain is stored in the local `daily_strain` table.

Key fields:

- `dateKey`
- `dayStartAt`
- `dayEndAt`
- `computedUntilAt`
- `dayStrain`, `dayTrimp`
- `passiveStrain`, `passiveTrimp`
- `activityStrain`, `activityTrimp`
- `strainLevel`
- `activityBreakdown`
- `sampleCount`
- `trackedSeconds`
- `rhrUsed`, `rhrSource`
- `mhrUsed`
- `biologicalSexUsed`
- `algorithmVersion`
- `createdAt`, `updatedAt`

The daily cache ID is deterministic from `(userId, dateKey)`, so multiple devices use the
same record ID for the same user and day.

### Single-Day Calculation Trigger

The day summary screen calls `useDailyStrain(dateKey)`.

Behavior:

- The query runs only when `dateKey` and `user.id` are valid.
- Before heavier computation, the app awaits `waitForIdle()`.
- The current day has a stale time of 5 minutes.
- Historical days have a stale time of 24 hours.
- When the app returns to foreground, the query is invalidated.

### Range Calculation Trigger

The Strain history chart calls `useDailyStrainRange(startDateKey, endDateKey)`.

Behavior:

1. Existing cached rows are read from SQLite.
2. Freshness is evaluated for each date.
3. After `waitForIdle()`, missing or stale days are computed sequentially.
4. Future dates are not computed.
5. Today is recomputed during batch computation.

Freshness reasons:

| Reason                                           | Recompute |
| ------------------------------------------------ | --------- |
| missing row                                      | yes       |
| future date                                      | no        |
| algorithm version changed                        | yes       |
| local day window changed                         | yes       |
| MHR changed                                      | yes       |
| manual RHR changed and row used manual RHR       | yes       |
| estimated RHR changed and row used estimated RHR | yes       |
| biological sex changed                           | yes       |
| ready                                            | no        |

Health-source RHR can change when new HealthKit or Health Connect data arrives. Single-day
queries and foreground invalidation help refresh the current day. Historical health-source
RHR refresh depends on refetching, the 24-hour stale window, and any explicit recomputation.

### Sync

Server sync transfers aggregated `daily_strain` records, not raw HR samples. This reduces
data volume and avoids syncing the full health time series.

Synced derived fields include:

- `dayStrain`, `dayTrimp`
- `passiveStrain`, `passiveTrimp`
- `activityStrain`, `activityTrimp`
- coverage fields
- RHR/MHR used
- algorithm version
- activity breakdown

Raw HealthKit / Health Connect samples remain the local source of truth for recalculation.

## Algorithmic Correctness Checks

Regression tests enforce these invariants:

- `strainFromTrimp(0) = 0`.
- Non-finite, zero, or negative TRIMP does not produce positive Strain.
- TRIMP maps to a bounded `0..100` Strain scale.
- Male, female, and neutral Banister coefficients are stable.
- HR below RHR produces zero TRIMP.
- HR above MHR is clamped to intensity `1`.
- Segments with gaps larger than the daily/passive threshold are discarded.
- The first and last sample extend to a window boundary only inside boundary grace.
- Passive segments correctly subtract workout windows.
- Activity segments correctly intersect workout windows.
- Day Strain is computed from full-day TRIMP and is not the sum of Activity and Passive
  Strain.
- Workouts crossing midnight are clipped to the requested local day.
- Today's `computedUntilAt` is never later than `now`.

## Full Daily Calculation Example

User:

```text
MHR = 190
RHR = 60
biologicalSex = male
timezone = UTC
```

Day:

```text
dateKey = 2026-04-02
dayStartAt = 2026-04-02T00:00:00Z
dayEndAt = 2026-04-03T00:00:00Z
```

Simplified HR series:

```text
00:00 160 bpm
00:20 160 bpm
00:40 160 bpm
01:00 100 bpm
01:20 100 bpm
02:00 100 bpm
```

Workout:

```text
00:00 - 01:00
```

Segments:

```text
00:00-00:20 HR=160
00:20-00:40 HR=160
00:40-01:00 HR=160
01:00-01:20 HR=100
01:20-02:00 HR=100
```

Activity segments:

```text
00:00-01:00 HR=160
```

Passive segments:

```text
01:00-02:00 HR=100
```

For HR=160:

```text
I = (160 - 60) / (190 - 60) = 100 / 130 = 0.7692
Y = 0.64 * exp(1.92 * 0.7692) ~= 2.80
TRIMP_60min ~= 60 * 0.7692 * 2.80 = 129.2
```

For HR=100:

```text
I = (100 - 60) / 130 = 0.3077
Y = 0.64 * exp(1.92 * 0.3077) ~= 1.16
TRIMP_60min ~= 60 * 0.3077 * 1.16 = 21.4
```

Totals:

```text
activityTrimp ~= 129.2
passiveTrimp ~= 21.4
dayTrimp ~= 150.6
```

Strain:

```text
activityStrain = round(75 * ln(1 + 129.2 / 80)) ~= 72
passiveStrain  = round(75 * ln(1 + 21.4 / 80)) ~= 18
dayStrain      = round(75 * ln(1 + 150.6 / 80)) ~= 79
```

Notice:

```text
72 + 18 = 90
dayStrain = 79
```

This is expected because Strain is not additive.

## Interpretation Limits and Risks

### Sensor Limitations

Wrist-based optical HR can be inaccurate during:

- strength exercises involving forearm tension;
- rapid intervals;
- cold exposure;
- poor sensor contact;
- tattoos, sweat, motion, or loose fit;
- sparse background sampling.

The algorithm limits the damage from large gaps, but it cannot fully distinguish a
physiological HR peak from a plausible sensor artifact.

### HR as a Proxy for Load

Heart rate reflects cardiovascular strain, but it does not fully capture:

- local muscular fatigue;
- tendon and joint mechanical load;
- eccentric loading;
- delayed-onset muscle soreness risk;
- neuromuscular fatigue;
- heavy strength work with low HR response;
- external power, pace, resistance, or volume.

Therefore, Strain is appropriate as an internal cardiovascular-load metric, but it should be
interpreted alongside workout volume, RPE, pain, technique, recovery, sleep, and context.

### Medical Limitations

Strain interpretation may be unreliable for users who:

- take beta blockers, calcium-channel blockers, antiarrhythmics, or other medications that
  alter chronotropic response;
- have arrhythmias;
- have a pacemaker or ICD;
- have dysautonomia or POTS;
- have heart failure;
- are post-myocardial infarction or post-cardiac surgery;
- are pregnant;
- have fever, infection, dehydration, heat stress, or altitude exposure;
- have incorrect MHR or RHR settings.

For such users, Strain should not be used to prescribe exercise intensity without medical
clearance.

### Age-Based MHR Formula Limitations

MHR formula error directly affects HRR intensity, TRIMP, and Strain.

If MHR is underestimated:

```text
HRR smaller -> intensity higher -> TRIMP higher -> Strain higher
```

If MHR is overestimated:

```text
HRR larger -> intensity lower -> TRIMP lower -> Strain lower
```

Manual MHR correction is important for users who know their real maximum HR differs from the
age-based estimate.

### Passive Strain Is Not "Stress"

Passive Strain is cardiovascular load outside completed workout windows. It may reflect
stress, illness, heat, or poor sleep, but it may also reflect an unrecorded walk or workout.
It should not be interpreted as a pure measure of psychological stress.

### Activity Strain Depends on Workout Windows

If a workout is not completed, lacks `startedAt`/`completedAt`, was not recorded in Skulpt,
or synced incorrectly, part of the load may be classified as Passive Strain.

If the workout window is too long, some passive activity may be classified as Activity
Strain.

### TRIMP and High-Intensity Intervals

HR-based TRIMP has a known limitation: heart rate lags behind actual mechanical and
metabolic demand. A short sprint may have a relatively low HR during the sprint itself and a
higher HR during recovery. HR-based Strain can therefore underestimate very short anaerobic
work and attribute part of the response to the recovery period.

## What Can Be Defended Clinically or Professionally

### Strengths of the Methodology

- It uses an established internal-load family: HRR plus TRIMP.
- Intensity is individualized by RHR and MHR, not only by absolute HR.
- High intensity receives nonlinear weighting through the Banister exponential term.
- The algorithm sums time-series segments instead of relying on a single average HR.
- Day, Activity, and Passive loads are separated by non-overlapping time windows.
- Raw HR gaps are controlled by explicit maximum-gap thresholds.
- The algorithm is versioned and cache rows are invalidated when key personal parameters
  change.
- Raw health samples are not synced to the server.

### What Must Not Be Claimed

- `Strain = 80` does not correspond to a specific lactate level, VO2, injury risk, or medical
  risk.
- The `0..100` scale has not been clinically validated as an outcome measure.
- Passive Strain is not a direct measure of psychological stress.
- An age-based MHR formula is not an accurate individual MHR measurement.
- Strain is not a substitute for clinical evaluation in people with cardiovascular disease or
  medication-altered heart-rate response.

## Potential Future Improvements

1. Individual MHR calibration from reliable peak HR observations.
2. Individual lactate-threshold or ventilatory-threshold TRIMP instead of generic Banister
   coefficients.
3. RPE integration for strength training and intervals where HR poorly reflects mechanical
   load.
4. A heart-rate coverage and sensor-confidence quality score.
5. Separate heat, illness, and stress flags to help interpret Passive Strain.
6. Validation of the Strain scale against user outcomes: RPE, fatigue, performance, recovery,
   HRV, sleep, and illness markers.

## References

1. Karvonen MJ, Kentala E, Mustala O. The effects of training on heart rate: a longitudinal
   study. Ann Med Exp Biol Fenn. 1957;35:307-315.
   [Reference page](https://www.scirp.org/reference/referencespapers?referenceid=835840).
2. Banister EW, Calvert TW, Savage MV, Bach TM. A systems model of training for athletic
   performance. Australian Journal of Sports Medicine. 1975;7:57-61.
   [Reference page](https://www.sciepub.com/reference/340730).
3. Morton RH, Fitz-Clarke JR, Banister EW. Modeling human performance in running. J Appl
   Physiol. 1990;69(3):1171-1177. [PubMed](https://pubmed.ncbi.nlm.nih.gov/2246166/).
4. Banister EW. Modeling elite athletic performance. In: MacDougall JD, Wenger HA, Green HJ,
   editors. Physiological Testing of Elite Athletes. Human Kinetics; 1991. Referenced in
   [Stagno et al., 2007 PDF](https://umh1617.umh.es/files/2016/05/2007-JSS-25-629-634.pdf).
5. Stagno KM, Thatcher R, van Someren KA. A modified TRIMP to quantify the in-season training
   load of team sport players. Journal of Sports Sciences. 2007;25(6):629-634.
   [PDF](https://umh1617.umh.es/files/2016/05/2007-JSS-25-629-634.pdf).
6. Lambert MI, Borresen J. Measuring training load in sports. Int J Sports Physiol Perform.
   2010;5(3):406-411. [PubMed](https://pubmed.ncbi.nlm.nih.gov/20861529/).
7. Wallace LK, Slattery KM, Coutts AJ. A comparison of methods for quantifying training load:
   relationships between modelled and actual training responses. Eur J Appl Physiol.
   2014;114(1):11-20. [PubMed](https://pubmed.ncbi.nlm.nih.gov/24104194/).
8. Garber CE, Blissmer B, Deschenes MR, Franklin BA, Lamonte MJ, Lee IM, Nieman DC, Swain DP;
   American College of Sports Medicine. Quantity and quality of exercise for developing and
   maintaining cardiorespiratory, musculoskeletal, and neuromotor fitness in apparently healthy
   adults: guidance for prescribing exercise. Med Sci Sports Exerc. 2011;43(7):1334-1359.
   [PubMed](https://pubmed.ncbi.nlm.nih.gov/21694556/).
9. Tanaka H, Monahan KD, Seals DR. Age-predicted maximal heart rate revisited. J Am Coll
   Cardiol. 2001;37(1):153-156. [PubMed](https://pubmed.ncbi.nlm.nih.gov/11153730/).
10. Nes BM, Janszky I, Wisloff U, Stoylen A, Karlsen T. Age-predicted maximal heart rate in
    healthy subjects: The HUNT Fitness Study. Scand J Med Sci Sports. 2013;23(6):697-704.
    [DOI](https://doi.org/10.1111/j.1600-0838.2012.01445.x).
11. Inbar O, Oren A, Scheinowitz M, Rotstein A, Dlin R, Casaburi R. Normal cardiopulmonary
    responses during incremental exercise in 20- to 70-yr-old men. Med Sci Sports Exerc.
    1994;26(5):538-546. [PubMed](https://pubmed.ncbi.nlm.nih.gov/8007799/).
12. Gulati M, Shaw LJ, Thisted RA, Black HR, Bairey Merz CN, Arnsdorf MF. Heart rate response
    to exercise stress testing in asymptomatic women. Circulation. 2010;122(2):130-137.
    [DOI](https://doi.org/10.1161/CIRCULATIONAHA.110.939249).
13. Gellish RL, Goslin BR, Olson RE, McDonald A, Russi GD, Moudgil VK. Longitudinal modeling
    of the relationship between age and maximal heart rate. Med Sci Sports Exerc.
    2007;39(5):822-829. [MEDLINE abstract](https://reference.medscape.com/medline/abstract/17468581).
14. Fox SM 3rd, Naughton JP, Haskell WL. Physical activity and the prevention of coronary heart
    disease. Ann Clin Res. 1971;3(6):404-432.
    [Reference page](https://www.sciepub.com/reference/334691).
