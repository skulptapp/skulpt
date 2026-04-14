import SwiftUI

struct WorkoutOverviewPage: View {
  let state: WatchWorkoutState
  @Binding var isFinishConfirmationPresented: Bool
  let onFinish: () -> Void

  var body: some View {
    ZStack {
      Color.black.ignoresSafeArea()

      VStack(spacing: 0) {
        VStack(alignment: .leading, spacing: 4) {
          Text(state.displayWorkoutName)
            .font(.system(.body, weight: .medium))
            .foregroundColor(.white)
            .multilineTextAlignment(.leading)
            .lineLimit(2)
            .frame(maxWidth: .infinity, alignment: .leading)

          if state.isActive {
            HStack(spacing: 4) {
              Text(state.workoutStartDate, style: .timer)
                .font(.system(.largeTitle, weight: .semibold))
                .foregroundColor(.white)
                .monospacedDigit()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, WatchLayoutMetrics.topPadding)
        .padding(.leading, 12)

        Spacer(minLength: 0)

        VStack(spacing: 8) {
          Button(role: .destructive) {
            isFinishConfirmationPresented = true
          } label: {
            Text(watchLocalized("workout.finish"))
              .font(.system(.body, weight: .bold))
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.borderedProminent)
          .tint(.red)
          .confirmationDialog(
            watchLocalized("workout.finish.confirm_title"),
            isPresented: $isFinishConfirmationPresented,
            titleVisibility: .visible
          ) {
            Button(watchLocalized("workout.finish.confirm_action"), role: .destructive) {
              onFinish()
            }
            Button(watchLocalized("workout.finish.cancel"), role: .cancel) {}
          }
        }
        .padding(.bottom, WatchLayoutMetrics.bottomPadding)
      }
    }
    .ignoresSafeArea()
  }
}
