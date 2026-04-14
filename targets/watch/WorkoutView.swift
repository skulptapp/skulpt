import SwiftUI

struct WorkoutView: View {
  let state: WatchWorkoutState
  let onCommand: (String, String?, String?) -> Void

  @State private var showFinishConfirmation = false

  var body: some View {
    Group {
      if state.state == "idle" {
        idleView
      } else {
        TabView {
          WorkoutOverviewPage(
            state: state,
            isFinishConfirmationPresented: $showFinishConfirmation
          ) {
            onCommand("finishWorkout", nil, nil)
          }

          TabView {
            WorkoutExercisePage(state: state, onCommand: onCommand)
            WorkoutZonesPage(state: state)
          }
          .tabViewStyle(.verticalPage)
          .ignoresSafeArea()
        }
        .tabViewStyle(.page)
      }
    }
    .ignoresSafeArea()
  }

  private var idleView: some View {
    ZStack {
      Color.black.ignoresSafeArea()

      VStack(spacing: 8) {
        Image(systemName: "figure.strengthtraining.traditional")
          .font(.system(size: 36))
          .foregroundColor(watchBrandLime)

        Text(watchLocalized("app.name"))
          .font(.system(.headline, weight: .bold))
          .foregroundColor(.white)
          .frame(maxWidth: .infinity)

        Text(watchLocalized("idle.start_on_phone"))
          .font(.system(.caption, weight: .medium))
          .foregroundColor(.gray)
          .multilineTextAlignment(.center)
          .frame(maxWidth: .infinity)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
      .padding(.horizontal, 12)
    }
    .ignoresSafeArea()
  }
}
