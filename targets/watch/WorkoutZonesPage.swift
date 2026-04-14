import SwiftUI

struct WorkoutZonesPage: View {
  let state: WatchWorkoutState

  @EnvironmentObject private var workoutManager: WorkoutManager

  var body: some View {
    ZStack {
      Color.black.ignoresSafeArea()

      VStack(spacing: 0) {
        HStack(alignment: .center, spacing: 4) {
          if let zoneTitle = watchZoneTitle(for: workoutManager.currentZone) {
            Text(zoneTitle)
              .font(.system(.title3, weight: .semibold))
              .foregroundColor(watchZoneColor(for: workoutManager.currentZone))
              .lineLimit(2)
              .multilineTextAlignment(.leading)
          } else if workoutManager.heartRate > 0, workoutManager.intensityPercent != nil {
            Text(watchLocalized("workout.zone.below"))
              .font(.system(.title3, weight: .semibold))
              .foregroundColor(.gray)
          } else {
            Text(watchLocalized("workout.zone.waiting"))
              .font(.system(.title3, weight: .semibold))
              .foregroundColor(.gray)
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, WatchLayoutMetrics.topPadding)
        .padding(.leading, 12)

        Spacer(minLength: 0)

        VStack(alignment: .leading) {
          if workoutManager.heartRate > 0 {
            HStack(alignment: .lastTextBaseline, spacing: 4) {
              Text("\(Int(workoutManager.heartRate))")
                .font(.system(.title2, weight: .semibold))
                .foregroundColor(.white)
                .monospacedDigit()

              Text(watchLocalized("workout.zone.bpm"))
                .font(.system(.caption2, weight: .semibold))
                .foregroundColor(.gray)
            }
          }
          if workoutManager.avgHeartRate > 0 {
            HStack(alignment: .lastTextBaseline, spacing: 4) {
              Text("\(Int(workoutManager.avgHeartRate.rounded()))")
                .font(.system(.title2, weight: .semibold))
                .foregroundColor(.white)
                .monospacedDigit()

              Text("\(watchLocalized("workout.zone.avg")) / \(watchLocalized("workout.zone.bpm"))")
                .font(.system(.caption2, weight: .semibold))
                .foregroundColor(.gray)
            }
          }
          if let intensity = workoutManager.intensityPercent {
            HStack(alignment: .lastTextBaseline, spacing: 4) {
              Text(String(format: watchLocalized("workout.zone.intensity_format"), intensity))
                .font(.system(.title2, weight: .semibold))
                .foregroundColor(.white)
                .monospacedDigit()

              Text(watchLocalized("workout.zone.mhr"))
                .font(.system(.caption2, weight: .semibold))
                .foregroundColor(.gray)
            }
          }
          if workoutManager.currentZone != nil {
            HStack(alignment: .lastTextBaseline, spacing: 4) {
              Text(
                String(
                  format: watchLocalized("workout.zone.duration_format"),
                  watchFormattedDuration(workoutManager.currentZoneElapsedSeconds)
                )
              )
              .font(.system(.title2, weight: .semibold))
              .foregroundColor(.white)
              .monospacedDigit()

              Text(watchLocalized("workout.zone.in_zone"))
                .font(.system(.caption2, weight: .semibold))
                .foregroundColor(.gray)
            }
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.leading, 12)
        .padding(.bottom, WatchLayoutMetrics.bottomPadding)
      }
    }
    .ignoresSafeArea()
  }

  //  var body: some View {
  //    VStack(spacing: 8) {
  //      Spacer(minLength: 0)
  //
  //      if state.isActive {
  //        WatchMetricCard(systemName: "clock", tint: .white) {
  //          HStack(spacing: 4) {
  //            Text(watchLocalized("workout.timer.total"))
  //              .font(.system(.caption2, weight: .semibold))
  //              .foregroundColor(.gray)
  //
  //            Text(state.workoutStartDate, style: .timer)
  //              .font(.system(.caption, weight: .bold))
  //              .foregroundColor(.white)
  //              .monospacedDigit()
  //          }
  //        }
  //      }
  //    }
  //  }
}

private struct WatchMetricCard<Content: View>: View {
  let systemName: String
  let tint: Color
  let content: Content

  init(
    systemName: String,
    tint: Color,
    @ViewBuilder content: () -> Content
  ) {
    self.systemName = systemName
    self.tint = tint
    self.content = content()
  }

  var body: some View {
    HStack(spacing: 6) {
      Image(systemName: systemName)
        .font(.system(size: 11, weight: .bold))
        .foregroundColor(tint)

      content

      Spacer(minLength: 0)
    }
    .padding(.horizontal, 8)
    .padding(.vertical, 6)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(Color.white.opacity(0.08))
    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
  }
}
