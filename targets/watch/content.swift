import SwiftUI

struct ContentView: View {
  @EnvironmentObject var session: WatchSessionManager

  var body: some View {
    Group {
      if session.workoutState.isActive {
        WorkoutView(
          state: session.workoutState,
          onCommand: { command, setId, expectedState in
            session.sendCommand(command, setId: setId, expectedState: expectedState)
          }
        )
      } else {
        idleView
      }
    }
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
