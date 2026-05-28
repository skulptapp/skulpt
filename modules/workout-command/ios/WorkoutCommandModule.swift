import ExpoModulesCore
import Foundation

public class WorkoutCommandModule: Module {
  private var commandQueueObserver: NSObjectProtocol?
  private let defaults = UserDefaults.standard

  private enum StorageKey {
    static let pendingCommands = "WorkoutCommand.pendingCommands"
  }

  private static let commandQueueDidChangeNotification = Notification.Name(
    "app.skulpt.workoutCommandQueue.didChange"
  )

  public func definition() -> ModuleDefinition {
    Name("WorkoutCommand")

    Events("onWorkoutCommand")

    OnCreate {
      self.commandQueueObserver = NotificationCenter.default.addObserver(
        forName: Self.commandQueueDidChangeNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.emitPendingCommands()
      }
    }

    AsyncFunction("drainPendingWorkoutCommands") { () -> [[String: String]] in
      return self.pendingCommands()
    }

    AsyncFunction("ackPendingWorkoutCommand") { (commandId: String) -> Bool in
      return self.ackPendingCommand(commandId: commandId)
    }
  }

  private func emitPendingCommands() {
    let commands = pendingCommands()
    guard !commands.isEmpty else { return }

    DispatchQueue.main.async {
      for payload in commands {
        self.sendEvent("onWorkoutCommand", payload)
      }
    }
  }

  private func pendingCommands() -> [[String: String]] {
    return defaults.array(forKey: StorageKey.pendingCommands) as? [[String: String]] ?? []
  }

  private func setPendingCommands(_ commands: [[String: String]]) {
    defaults.set(commands, forKey: StorageKey.pendingCommands)
  }

  private func ackPendingCommand(commandId: String) -> Bool {
    let commands = pendingCommands()
    let filtered = commands.filter { $0["commandId"] != commandId }
    let didRemove = filtered.count != commands.count

    if didRemove {
      setPendingCommands(filtered)
    }

    return didRemove
  }
}
