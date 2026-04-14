import SwiftUI

struct WorkoutExercisePage: View {
  let state: WatchWorkoutState
  let onCommand: (String, String?, String?) -> Void

  @EnvironmentObject private var workoutManager: WorkoutManager

  var body: some View {
    ZStack {
      Color.black.ignoresSafeArea()

      VStack(spacing: 0) {
        VStack(spacing: 8) {
          headerSection
          timesSection
        }
        .padding(.top, WatchLayoutMetrics.topPadding)

        Spacer(minLength: 0)

        exerciseSection
          .layoutPriority(1)

        Spacer(minLength: 0)

        VStack(spacing: 2) {
          trackingSection
          controlsSection
        }
        .padding(.bottom, WatchLayoutMetrics.bottomPadding)
      }
    }
    .ignoresSafeArea()
  }

  private var headerSection: some View {
    HStack {
      HStack(spacing: 6) {
        Text(
          String(
            format: watchLocalized("workout.header.exercise_format"),
            displayedExerciseCounter,
            state.totalExercises
          )
        )
        .font(.system(.caption2, weight: .bold))
        .foregroundColor(.white)

        Text(
          String(
            format: watchLocalized("workout.header.set_format"),
            state.setNumber,
            state.totalSets
          )
        )
        .font(.system(.caption2, weight: .bold))
        .foregroundColor(.white)

        Text(state.setTypeShort)
          .font(.system(.caption2, weight: .bold))
          .foregroundColor(.white)
      }

      Spacer()

      HStack(spacing: 6) {
        if workoutManager.heartRate > 0 {
          HStack(spacing: 2) {
            Image(systemName: "heart.fill")
              .font(.system(size: 10))
              .foregroundColor(.red)

            Text("\(Int(workoutManager.heartRate))")
              .font(.system(.caption2, weight: .bold))
              .foregroundColor(.white)
          }
        }
      }
    }.padding(.leading, 4).padding(.trailing, 12)
  }

  private var timesSection: some View {
    HStack {
      if state.isResting {
        Text(watchLocalized("workout.badge.next"))
          .font(.system(.caption2, weight: .bold))
          .foregroundColor(.black)
          .padding(.horizontal, 6)
          .padding(.vertical, 1)
          .background(watchBrandLime)
          .clipShape(Capsule())
      } else {
        Text(watchLocalized("workout.badge.work"))
          .font(.system(.caption2, weight: .bold))
          .foregroundColor(.black)
          .padding(.horizontal, 6)
          .padding(.vertical, 1)
          .background(.white)
          .clipShape(Capsule())
      }

      Spacer()

      timerSection
    }.padding(.leading, 4).padding(.trailing, 12)
  }

  private var displayedExerciseCounter: Int {
    min(state.completedExercises + 1, state.totalExercises)
  }

  private var exerciseSection: some View {
    VStack(spacing: 4) {
      Text(state.displayExerciseName)
        .font(.system(.body, weight: .medium))
        .foregroundColor(.white)
        .lineLimit(2)
        .multilineTextAlignment(.center)
    }
    .padding(.horizontal, 8)
    .offset(y: 6)
  }

  private var trackingSection: some View {
    VStack(spacing: 4) {
      if !state.trackingDisplaySegments.isEmpty {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
          ForEach(Array(state.trackingDisplaySegments.enumerated()), id: \.offset) { item in
            trackingSegmentView(item.element)
          }
        }
      }
    }
  }

  @ViewBuilder
  private func trackingSegmentView(_ segment: WatchWorkoutState.TrackingDisplaySegment) -> some View
  {
    switch segment.kind {
    case .separator:
      trackingSegmentContent(segment)
        .baselineOffset(WatchLayoutMetrics.trackingSeparatorBaselineOffset)
    case .value, .unit:
      trackingSegmentContent(segment)
    }
  }

  @ViewBuilder
  private func trackingSegmentContent(_ segment: WatchWorkoutState.TrackingDisplaySegment)
    -> some View
  {
    switch segment.content {
    case .text(let text):
      Text(text)
        .font(font(for: segment.kind))
        .foregroundColor(.white)
    case .timer(let endDate):
      Text(endDate, style: .timer)
        .font(font(for: segment.kind))
        .foregroundColor(.white)
        .monospacedDigit()
    case .stopwatch(let startDate):
      Text(startDate, style: .timer)
        .font(font(for: segment.kind))
        .foregroundColor(.white)
        .monospacedDigit()
    }
  }

  private func font(for kind: WatchWorkoutState.TrackingSegmentKind) -> Font {
    switch kind {
    case .value:
      return .system(size: WatchLayoutMetrics.trackingValueFontSize, weight: .semibold)
    case .unit, .separator:
      return .system(size: WatchLayoutMetrics.trackingUnitFontSize, weight: .medium)
    }
  }

  private var controlsSection: some View {
    VStack(spacing: 8) {
      if state.isAllSetsCompleted {
        Text(watchLocalized("workout.finish.swipe_hint"))
          .font(.system(.caption2, weight: .semibold))
          .foregroundColor(.gray)
          .multilineTextAlignment(.center)
      } else if state.isPerforming {
        circularActionButton(
          systemName: "checkmark",
          accessibilityLabel: watchLocalized("workout.a11y.complete_set")
        ) {
          onCommand("completeSet", state.currentSetId, "performing")
        }
      } else if state.isResting {
        circularActionButton(
          systemName: "stop.fill",
          accessibilityLabel: watchLocalized("workout.a11y.skip_rest")
        ) {
          onCommand("skipRest", state.restSetId, state.state)
        }
      } else if state.isReady {
        circularActionButton(
          systemName: "play.fill",
          accessibilityLabel: watchLocalized("workout.a11y.start_set")
        ) {
          onCommand("startSet", state.nextSetId, "ready")
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .bottom)
  }

  private var timerSection: some View {
    Group {
      if state.hasLiveTimeInTracking {
        Text(state.workoutStartDate, style: .timer)
          .font(.system(.body, weight: .medium))
          .foregroundColor(.white)
          .monospacedDigit()
      } else if state.isResting {
        Text(state.timerEndDate, style: .timer)
          .font(.system(.body, weight: .bold))
          .foregroundColor(watchBrandLime)
          .monospacedDigit()
      } else if state.isPerforming && state.timeOptions == "timer" {
        Text(state.timerEndDate, style: .timer)
          .font(.system(.body, weight: .bold))
          .foregroundColor(.white)
          .monospacedDigit()
      } else if state.isPerforming && state.timeOptions == "stopwatch" {
        Text(state.timerStartDate, style: .timer)
          .font(.system(.body, weight: .bold))
          .foregroundColor(.white)
          .monospacedDigit()
      } else {
        Text(state.workoutStartDate, style: .timer)
          .font(.system(.body, weight: .medium))
          .foregroundColor(.white)
          .monospacedDigit()
      }
    }
  }

  private func circularActionButton(
    systemName: String,
    accessibilityLabel: String,
    action: @escaping () -> Void
  ) -> some View {
    let iconWeight: Font.Weight = systemName == "checkmark" ? .heavy : .bold

    return Image(systemName: systemName)
      .font(.system(size: 22, weight: iconWeight))
      .foregroundColor(.black)
      .frame(width: 40, height: 40)
      .background(watchBrandLime)
      .clipShape(Circle())
      .contentShape(Circle())
      .onTapGesture {
        WKInterfaceDevice.current().play(hapticType(for: systemName))
        action()
      }
      .accessibilityAddTraits(.isButton)
      .accessibilityAction {
        WKInterfaceDevice.current().play(hapticType(for: systemName))
        action()
      }
      .accessibilityLabel(accessibilityLabel)
  }

  private func hapticType(for systemName: String) -> WKHapticType {
    switch systemName {
    case "checkmark":
      return .success
    case "play.fill":
      return .start
    case "stop.fill":
      return .stop
    default:
      return .click
    }
  }
}
