import SwiftUI

@main
struct watchEntry: App {
  @StateObject private var session = WatchSessionManager.shared
  @StateObject private var workoutManager = WorkoutManager.shared

  var body: some Scene {
    WindowGroup {
      ContentView()
        .environmentObject(session)
        .environmentObject(workoutManager)
    }
  }
}
