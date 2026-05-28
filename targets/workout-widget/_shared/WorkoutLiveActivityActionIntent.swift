import AppIntents
import Foundation

@available(iOS 17.0, *)
struct WorkoutLiveActivityActionIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Workout Action"
  static var openAppWhenRun: Bool { false }

  @Parameter(title: "Command")
  var command: String

  @Parameter(title: "Workout ID")
  var workoutId: String

  @Parameter(title: "Set ID")
  var setId: String

  @Parameter(title: "Expected State")
  var expectedState: String

  init() {
    command = ""
    workoutId = ""
    setId = ""
    expectedState = ""
  }

  init(command: String, workoutId: String, setId: String?, expectedState: String?) {
    self.command = command
    self.workoutId = workoutId
    self.setId = setId ?? ""
    self.expectedState = expectedState ?? ""
  }

  func perform() async throws -> some IntentResult {
    guard !command.isEmpty else {
      return .result()
    }

    WorkoutCommandQueue.enqueue(
      command: command,
      workoutId: workoutId.nilIfEmpty,
      setId: setId.nilIfEmpty,
      expectedState: expectedState.nilIfEmpty
    )

    return .result()
  }
}

private enum WorkoutCommandQueue {
  private static let pendingCommandsKey = "WorkoutCommand.pendingCommands"
  private static let didChangeNotificationName = "app.skulpt.workoutCommandQueue.didChange"

  static func enqueue(
    command: String,
    workoutId: String?,
    setId: String?,
    expectedState: String?
  ) {
    let commandId = UUID().uuidString
    var payload: [String: String] = [
      "command": command,
      "commandId": commandId,
    ]

    if let workoutId {
      payload["workoutId"] = workoutId
    }
    if let setId {
      payload["setId"] = setId
    }
    if let expectedState {
      payload["expectedState"] = expectedState
    }

    var commands = pendingCommands()
    commands.append(payload)
    defaults.set(commands, forKey: pendingCommandsKey)

    NotificationCenter.default.post(name: Notification.Name(didChangeNotificationName), object: nil)
  }

  private static func pendingCommands() -> [[String: String]] {
    defaults.array(forKey: pendingCommandsKey) as? [[String: String]] ?? []
  }

  private static var defaults: UserDefaults {
    return .standard
  }
}

private extension String {
  var nilIfEmpty: String? {
    isEmpty ? nil : self
  }
}
