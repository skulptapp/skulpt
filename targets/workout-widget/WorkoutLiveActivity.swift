import ActivityKit
import SwiftUI
import WidgetKit

struct WorkoutLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: WorkoutAttributes.self) { context in
      LockScreenView(context: context)
        .activityBackgroundTint(brandLime)
        .widgetURL(buildDeepLink(context: context))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          ExpandedLeading(context: context)
        }
        DynamicIslandExpandedRegion(.trailing) {
          ExpandedTrailing(context: context)
        }
        DynamicIslandExpandedRegion(.center) {
          ExpandedCenter(context: context)
        }
        DynamicIslandExpandedRegion(.bottom) {
          ExpandedBottom(context: context)
        }
      } compactLeading: {
        CompactLeading(context: context)
      } compactTrailing: {
        CompactTrailing(context: context)
      } minimal: {
        MinimalView(context: context)
      }
      .keylineTint(brandLime)
      .widgetURL(buildDeepLink(context: context))
    }
  }

  private func buildDeepLink(context: ActivityViewContext<WorkoutAttributes>) -> URL? {
    let workoutId = context.attributes.workoutId
    let exerciseId = context.state.workoutExerciseId ?? ""
    return URL(string: "skulpt://workout/\(workoutId)/\(exerciseId)")
  }
}

// MARK: - Brand Colors

private let brandLime = Color(red: 163 / 255, green: 230 / 255, blue: 53 / 255)

// MARK: - State Helpers

private func isResting(_ state: String) -> Bool {
  state == "resting" || state == "resting_no_next"
}

private func isPerforming(_ state: String) -> Bool {
  state == "performing"
}

// MARK: - Timer View

private struct TimerText: View {
  let context: ActivityViewContext<WorkoutAttributes>
  var font: Font = .system(.body, weight: .bold)
  var color: Color = .black

  var body: some View {
    let state = context.state

    if isResting(state.state) {
      Text(state.timerEndDate, style: .timer)
        .monospacedDigit()
        .font(font)
        .foregroundColor(color)
    } else if isPerforming(state.state) && state.timeOptions == "timer" {
      Text(state.timerEndDate, style: .timer)
        .monospacedDigit()
        .font(font)
        .foregroundColor(color)
    } else if isPerforming(state.state) && state.timeOptions == "stopwatch" {
      Text(state.timerStartDate, style: .timer)
        .monospacedDigit()
        .font(font)
        .foregroundColor(color)
    } else {
      // ready or performing with log — show elapsed workout time
      Text(state.workoutStartDate, style: .timer)
        .monospacedDigit()
        .font(font)
        .foregroundColor(color)
    }
  }
}

private func formatWeight(_ weight: Double, units: String) -> String {
  if weight == weight.rounded() {
    return "\(Int(weight)) \(units)"
  }
  return String(format: "%.1f %@", weight, units)
}

private func setTypeShort(_ value: String) -> String {
  switch value {
  case "warmup":
    return "WU"
  case "dropset":
    return "DS"
  case "failure":
    return "F"
  default:
    return "W"
  }
}

// MARK: - State Label

private struct StateLabel: View {
  let state: String

  var body: some View {
    if isResting(state) {
      Text("REST")
        .font(.system(.caption2, weight: .bold))
        .foregroundColor(.black)
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(brandLime)
        .clipShape(Capsule())
    }
  }
}

// MARK: - Lock Screen View

private struct LockScreenView: View {
  let context: ActivityViewContext<WorkoutAttributes>

  var body: some View {
    let state = context.state
    let resting = isResting(state.state)
    let showNextData = resting || state.state == "ready"
    let topLeftLabel = showNextData ? "Next" : "Work"
    let displayExerciseNameRaw =
      showNextData ? (state.nextExerciseName ?? state.exerciseName) : state.exerciseName
    let displayExerciseName =
      displayExerciseNameRaw.isEmpty
      ? (showNextData ? "Next Exercise" : "Exercise") : displayExerciseNameRaw
    let displayWeight = showNextData ? (state.nextWeight ?? state.weight) : state.weight
    let displayWeightUnits =
      showNextData ? (state.nextWeightUnits ?? state.weightUnits) : state.weightUnits
    let displayReps = showNextData ? (state.nextReps ?? state.reps) : state.reps
    let displayExerciseCounter = min(state.completedExercises + 1, state.totalExercises)

    VStack(spacing: 10) {
      // Row 1: mode pill + timer pills
      HStack(alignment: .center) {
        BlackPill(text: topLeftLabel)
        Spacer(minLength: 0)

        if resting {
          HStack(spacing: 6) {
            BlackPill(text: "Rest")
            BlackPill {
              Text(state.timerEndDate, style: .timer)
                .font(.system(.caption))
                .fontWeight(.bold)
                .monospacedDigit()
                .multilineTextAlignment(.center)
                .frame(width: 46)
            }
          }
        } else {
          BlackPill {
            Text(state.workoutStartDate, style: .timer)
              .font(.system(.caption))
              .fontWeight(.bold)
              .monospacedDigit()
              .multilineTextAlignment(.center)
              .frame(width: 56)
          }
        }
      }

      // Row 2: current/next exercise title
      HStack {
        Text(displayExerciseName)
          .font(.system(.headline))
          .fontWeight(.bold)
          .foregroundColor(.black)
          .lineLimit(1)
        Spacer()
      }

      // Row 3: set + weight/reps + exercise progress
      HStack(spacing: 8) {
        Text("Set \(state.setNumber)/\(state.totalSets)")
          .font(.system(.subheadline))
          .fontWeight(.medium)
          .foregroundColor(.black)
        Text(setTypeShort(state.setType))
          .font(.system(.subheadline))
          .fontWeight(.semibold)
          .foregroundColor(.black.opacity(0.8))
        SetInfoValueText(
          weight: displayWeight,
          weightUnits: displayWeightUnits,
          reps: displayReps
        )
        Spacer()
        Text("E\(displayExerciseCounter)/\(state.totalExercises)")
          .font(.system(.subheadline))
          .fontWeight(.medium)
          .foregroundColor(.black)
      }
    }
    .padding(16)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(brandLime)
  }
}

private struct SetInfoValueText: View {
  let weight: Double?
  let weightUnits: String?
  let reps: Int?

  var body: some View {
    HStack(spacing: 4) {
      if let weight, let units = weightUnits {
        Text(formatWeight(weight, units: units))
          .foregroundColor(.black)
      }
      if weight != nil, reps != nil {
        Text("×")
          .foregroundColor(.black)
      }
      if let reps {
        Text("\(reps)")
          .foregroundColor(.black)
      }
    }
    .font(.system(.subheadline))
    .fontWeight(.medium)
  }
}

private struct BlackPill<Content: View>: View {
  let content: Content

  init(@ViewBuilder content: () -> Content) {
    self.content = content()
  }

  init(text: String) where Content == Text {
    self.content = Text(text)
      .font(.system(.caption))
      .fontWeight(.bold)
  }

  var body: some View {
    content
      .foregroundColor(brandLime)
      .padding(.horizontal, 8)
      .padding(.vertical, 4)
      .background(Color.black)
      .clipShape(Capsule())
  }
}

// MARK: - Dynamic Island: Compact

private struct CompactLeading: View {
  let context: ActivityViewContext<WorkoutAttributes>

  var body: some View {
    if isResting(context.state.state) {
      Image(systemName: "pause.circle.fill")
        .font(.caption2)
        .foregroundColor(brandLime)
    } else {
      Image(systemName: "play.circle.fill")
        .font(.caption2)
        .foregroundColor(brandLime)
    }
  }
}

private struct CompactTrailing: View {
  let context: ActivityViewContext<WorkoutAttributes>

  var body: some View {
    TimerText(
      context: context,
      font: .system(.caption, weight: .bold),
      color: brandLime
    )
    .frame(minWidth: 36)
  }
}

// MARK: - Dynamic Island: Expanded

private struct ExpandedLeading: View {
  let context: ActivityViewContext<WorkoutAttributes>

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      StateLabel(state: context.state.state)
      if !isResting(context.state.state) {
        Image(systemName: "play.circle.fill")
          .font(.title3)
          .foregroundColor(brandLime)
      }
    }
  }
}

private struct ExpandedTrailing: View {
  let context: ActivityViewContext<WorkoutAttributes>

  var body: some View {
    TimerText(
      context: context,
      font: .system(.title2, weight: .bold)
    )
  }
}

private struct ExpandedCenter: View {
  let context: ActivityViewContext<WorkoutAttributes>

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(context.state.exerciseName)
        .font(.system(.headline, weight: .bold))
        .foregroundColor(brandLime)
        .lineLimit(1)

      Text("Set \(context.state.setNumber)/\(context.state.totalSets)")
        .font(.system(.subheadline, weight: .medium))
        .foregroundColor(brandLime)
      Text(setTypeShort(context.state.setType))
        .font(.system(.caption, weight: .semibold))
        .foregroundColor(brandLime.opacity(0.9))
    }
  }
}

private struct ExpandedBottom: View {
  let context: ActivityViewContext<WorkoutAttributes>

  var body: some View {
    let state = context.state

    HStack {
      SetInfoValueText(
        weight: state.weight,
        weightUnits: state.weightUnits,
        reps: state.reps
      )

      Spacer()

      if let nextName = state.nextExerciseName {
        HStack(spacing: 4) {
          Image(systemName: "arrow.right")
            .font(.caption2)
            .foregroundColor(brandLime)
          Text(nextName)
            .font(.system(.caption))
            .foregroundColor(brandLime)
            .lineLimit(1)
        }
      }
    }
  }
}

// MARK: - Dynamic Island: Minimal

private struct MinimalView: View {
  let context: ActivityViewContext<WorkoutAttributes>

  var body: some View {
    if isResting(context.state.state) {
      Image(systemName: "pause.circle.fill")
        .font(.caption)
        .foregroundColor(brandLime)
    } else {
      Image(systemName: "play.circle.fill")
        .font(.caption)
        .foregroundColor(brandLime)
    }
  }
}

// MARK: - Previews: Lock Screen

#Preview("Lock Screen — Performing", as: .content, using: WorkoutAttributes.preview) {
  WorkoutLiveActivity()
} contentStates: {
  WorkoutAttributes.ContentState.performing
}

#Preview("Lock Screen — Timer", as: .content, using: WorkoutAttributes.preview) {
  WorkoutLiveActivity()
} contentStates: {
  WorkoutAttributes.ContentState.performingTimer
}

#Preview("Lock Screen — Stopwatch", as: .content, using: WorkoutAttributes.preview) {
  WorkoutLiveActivity()
} contentStates: {
  WorkoutAttributes.ContentState.performingStopwatch
}

#Preview("Lock Screen — Resting", as: .content, using: WorkoutAttributes.preview) {
  WorkoutLiveActivity()
} contentStates: {
  WorkoutAttributes.ContentState.resting
}

#Preview("Lock Screen — Ready", as: .content, using: WorkoutAttributes.preview) {
  WorkoutLiveActivity()
} contentStates: {
  WorkoutAttributes.ContentState.ready
}

// MARK: - Previews: Dynamic Island Expanded

#Preview("Expanded — Performing", as: .dynamicIsland(.expanded), using: WorkoutAttributes.preview) {
  WorkoutLiveActivity()
} contentStates: {
  WorkoutAttributes.ContentState.performing
}

#Preview("Expanded — Resting", as: .dynamicIsland(.expanded), using: WorkoutAttributes.preview) {
  WorkoutLiveActivity()
} contentStates: {
  WorkoutAttributes.ContentState.resting
}

#Preview("Expanded — Timer", as: .dynamicIsland(.expanded), using: WorkoutAttributes.preview) {
  WorkoutLiveActivity()
} contentStates: {
  WorkoutAttributes.ContentState.performingTimer
}

// MARK: - Previews: Dynamic Island Compact

#Preview("Compact — Performing", as: .dynamicIsland(.compact), using: WorkoutAttributes.preview) {
  WorkoutLiveActivity()
} contentStates: {
  WorkoutAttributes.ContentState.performing
}

#Preview("Compact — Resting", as: .dynamicIsland(.compact), using: WorkoutAttributes.preview) {
  WorkoutLiveActivity()
} contentStates: {
  WorkoutAttributes.ContentState.resting
}

// MARK: - Previews: Dynamic Island Minimal

#Preview("Minimal — Performing", as: .dynamicIsland(.minimal), using: WorkoutAttributes.preview) {
  WorkoutLiveActivity()
} contentStates: {
  WorkoutAttributes.ContentState.performing
}

#Preview("Minimal — Resting", as: .dynamicIsland(.minimal), using: WorkoutAttributes.preview) {
  WorkoutLiveActivity()
} contentStates: {
  WorkoutAttributes.ContentState.resting
}
