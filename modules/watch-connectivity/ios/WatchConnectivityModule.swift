import ExpoModulesCore
import WatchConnectivity

public class WatchConnectivityModule: Module {
  private var sessionDelegate: SessionDelegate?
  private let defaults = UserDefaults.standard
  private var latestLifecyclePayload: [String: String]?

  private enum StorageKey {
    static let pendingCommands = "WatchConnectivity.pendingCommands"
    static let seenCommandIds = "WatchConnectivity.seenCommandIds"
    static let pendingApplicationContext = "WatchConnectivity.pendingApplicationContext"
  }

  private let maxSeenCommandIds = 200

  public func definition() -> ModuleDefinition {
    Name("WatchConnectivity")

    Events("onWatchCommand")

    OnCreate {
      let delegate = SessionDelegate(
        onCommand: { [weak self] payload in
          self?.handleIncomingCommand(payload: payload)
        },
        onActivationDidComplete: { [weak self] activationState in
          guard activationState == .activated else { return }
          self?.flushPendingApplicationContextIfNeeded()
        }
      )
      self.sessionDelegate = delegate

      if WCSession.isSupported() {
        let session = WCSession.default
        session.delegate = delegate
        session.activate()
        if session.activationState == .activated {
          self.flushPendingApplicationContextIfNeeded()
        }
      }
    }

    Function("isWatchSupported") { () -> Bool in
      return WCSession.isSupported()
    }

    Function("isWatchPaired") { () -> Bool in
      guard WCSession.isSupported() else { return false }
      let session = WCSession.default
      guard session.activationState == .activated else {
        session.activate()
        return false
      }
      return session.isPaired
    }

    Function("isWatchReachable") { () -> Bool in
      guard WCSession.isSupported() else { return false }
      let session = WCSession.default
      guard session.activationState == .activated else {
        session.activate()
        return false
      }
      return session.isReachable
    }

    AsyncFunction("updateWatchContext") { (stateDict: [String: Any]) -> Bool in
      guard WCSession.isSupported() else { return false }
      let session = WCSession.default
      let cleaned = Self.sanitize(stateDict)
      guard session.activationState == .activated else {
        if Self.isTerminalWorkoutState(cleaned) {
          self.setPendingApplicationContext(cleaned)
        } else {
          self.clearPendingApplicationContext()
        }
        session.activate()
        return false
      }

      do {
        try session.updateApplicationContext(cleaned)
        self.clearPendingApplicationContext()
        return true
      } catch {
        if Self.isTerminalWorkoutState(cleaned) {
          self.setPendingApplicationContext(cleaned)
        } else {
          self.clearPendingApplicationContext()
        }
        reportNativeError(error, context: "WatchConnectivity.updateWatchContext failed")
        return false
      }
    }

    AsyncFunction("sendWatchMessage") { (stateDict: [String: Any]) -> Bool in
      guard WCSession.isSupported() else { return false }
      let session = WCSession.default
      guard session.activationState == .activated else {
        session.activate()
        return false
      }
      guard session.isReachable else { return false }

      let cleaned = Self.sanitize(stateDict)
      return await withCheckedContinuation { continuation in
        session.sendMessage(
          ["workoutState": cleaned],
          replyHandler: { _ in continuation.resume(returning: true) },
          errorHandler: { error in
            reportNativeError(
              error,
              context: "WatchConnectivity.sendWatchMessage failed"
            )
            continuation.resume(returning: false)
          }
        )
      }
    }

    AsyncFunction("drainPendingWatchCommands") { () -> [[String: String]] in
      return self.pendingCommands()
    }

    AsyncFunction("ackPendingWatchCommand") { (commandId: String) -> Bool in
      return self.ackPendingCommand(commandId: commandId)
    }

    Function("getCurrentWatchCommand") { () -> [String: String]? in
      guard WCSession.isSupported() else { return nil }
      let session = WCSession.default
      if session.activationState != .activated {
        session.activate()
      }
      let contextPayload = SessionDelegate.extractPayload(from: session.receivedApplicationContext)
      let latestPayload = self.latestLifecycleCommand()
      return Self.preferredCurrentWatchCommand(
        contextPayload: contextPayload,
        latestPayload: latestPayload
      )
    }

    Function("clearPendingWatchContext") { () -> Bool in
      self.clearPendingApplicationContext()
      return true
    }

    Function("clearStoredWatchLifecycleCommand") { () -> Bool in
      self.clearLatestLifecycleCommand()
      return true
    }
  }

  // MARK: - Sanitize payload for WCSession (property-list types only)

  private static func sanitize(_ dict: [String: Any]) -> [String: Any] {
    var result = [String: Any]()
    for (key, value) in dict {
      if let clean = sanitizeValue(value) {
        result[key] = clean
      }
    }
    return result
  }

  private static func sanitizeValue(_ value: Any) -> Any? {
    if value is NSNull { return nil }
    if value is String { return value }
    if value is Data { return value }
    if value is Date { return value }
    if let n = value as? Double {
      return n.isFinite ? n : nil
    }
    if value is Int { return value }
    if value is Bool { return value }
    if value is NSNumber { return value }
    if let dict = value as? [String: Any] {
      return sanitize(dict)
    }
    if let arr = value as? [Any] {
      return arr.compactMap { sanitizeValue($0) }
    }
    return nil
  }

  private static func isTerminalWorkoutState(_ dict: [String: Any]) -> Bool {
    return (dict["state"] as? String) == "completed"
  }

  private static func isLifecycleCommand(_ payload: [String: String]) -> Bool {
    guard let command = payload["command"] else { return false }
    return command == "watchSessionStarted" || command == "watchSessionEnded"
  }

  private static func lifecycleEventAtMs(_ payload: [String: String]?) -> Int64? {
    guard let rawValue = payload?["eventAtMs"] else { return nil }
    return Int64(rawValue)
  }

  private static func preferredCurrentWatchCommand(
    contextPayload: [String: String]?,
    latestPayload: [String: String]?
  ) -> [String: String]? {
    guard let latestPayload else { return contextPayload }
    guard let contextPayload else { return latestPayload }

    let latestEventAtMs = lifecycleEventAtMs(latestPayload)
    let contextEventAtMs = lifecycleEventAtMs(contextPayload)

    switch (latestEventAtMs, contextEventAtMs) {
    case (let latest?, let context?):
      return latest >= context ? latestPayload : contextPayload
    case (.some, .none):
      return latestPayload
    case (.none, .some):
      return contextPayload
    case (.none, .none):
      return latestPayload
    }
  }

  // MARK: - Pending command queue

  private func handleIncomingCommand(payload: [String: String]) {
    if Self.isLifecycleCommand(payload) {
      setLatestLifecycleCommand(payload)
    }

    if let commandId = payload["commandId"] {
      guard !hasSeenCommandId(commandId) else { return }
      rememberCommandId(commandId)
      enqueuePendingCommand(payload: payload)
    }

    DispatchQueue.main.async {
      self.sendEvent("onWatchCommand", payload)
    }
  }

  private func pendingCommands() -> [[String: String]] {
    return defaults.array(forKey: StorageKey.pendingCommands) as? [[String: String]] ?? []
  }

  private func setPendingCommands(_ commands: [[String: String]]) {
    defaults.set(commands, forKey: StorageKey.pendingCommands)
  }

  private func enqueuePendingCommand(payload: [String: String]) {
    var commands = pendingCommands()
    let commandId = payload["commandId"]

    if let commandId, commands.contains(where: { $0["commandId"] == commandId }) {
      return
    }

    commands.append(payload)
    setPendingCommands(commands)
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

  private func seenCommandIds() -> [String] {
    return defaults.array(forKey: StorageKey.seenCommandIds) as? [String] ?? []
  }

  private func hasSeenCommandId(_ commandId: String) -> Bool {
    return seenCommandIds().contains(commandId)
  }

  private func rememberCommandId(_ commandId: String) {
    var commandIds = seenCommandIds()

    if commandIds.contains(commandId) {
      return
    }

    commandIds.append(commandId)

    if commandIds.count > maxSeenCommandIds {
      commandIds.removeFirst(commandIds.count - maxSeenCommandIds)
    }

    defaults.set(commandIds, forKey: StorageKey.seenCommandIds)
  }

  private func pendingApplicationContext() -> [String: Any]? {
    return defaults.dictionary(forKey: StorageKey.pendingApplicationContext)
  }

  private func setPendingApplicationContext(_ context: [String: Any]) {
    defaults.set(context, forKey: StorageKey.pendingApplicationContext)
  }

  private func clearPendingApplicationContext() {
    defaults.removeObject(forKey: StorageKey.pendingApplicationContext)
  }

  private func latestLifecycleCommand() -> [String: String]? {
    return latestLifecyclePayload
  }

  private func setLatestLifecycleCommand(_ payload: [String: String]) {
    let existingPayload = latestLifecyclePayload
    let existingEventAtMs = Self.lifecycleEventAtMs(existingPayload)
    let nextEventAtMs = Self.lifecycleEventAtMs(payload)

    let shouldReplace: Bool
    switch (existingEventAtMs, nextEventAtMs) {
    case (.none, _):
      shouldReplace = true
    case (.some, .none):
      shouldReplace = false
    case (let existing?, let next?):
      shouldReplace = next >= existing
    }

    if shouldReplace {
      latestLifecyclePayload = payload
    }
  }

  private func clearLatestLifecycleCommand() {
    latestLifecyclePayload = nil
  }

  private func flushPendingApplicationContextIfNeeded() {
    guard WCSession.isSupported() else { return }
    guard let pendingApplicationContext = pendingApplicationContext() else { return }

    let session = WCSession.default
    guard session.activationState == .activated else { return }

    do {
      try session.updateApplicationContext(pendingApplicationContext)
      clearPendingApplicationContext()
    } catch {
      reportNativeError(error, context: "WatchConnectivity.flushPendingApplicationContext failed")
    }
  }
}

// MARK: - WCSession Delegate

private class SessionDelegate: NSObject, WCSessionDelegate {
  let onCommand: ([String: String]) -> Void
  let onActivationDidComplete: (WCSessionActivationState) -> Void

  init(
    onCommand: @escaping ([String: String]) -> Void,
    onActivationDidComplete: @escaping (WCSessionActivationState) -> Void
  ) {
    self.onCommand = onCommand
    self.onActivationDidComplete = onActivationDidComplete
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    if let error {
      reportNativeError(error, context: "WatchConnectivity session activation failed")
    }

    if activationState == .activated,
      let payload = Self.extractPayload(from: session.receivedApplicationContext)
    {
      onCommand(payload)
    }

    onActivationDidComplete(activationState)
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  func session(
    _ session: WCSession,
    didReceiveApplicationContext applicationContext: [String: Any]
  ) {
    if let payload = Self.extractPayload(from: applicationContext) {
      onCommand(payload)
    }
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    if let payload = Self.extractPayload(from: message) {
      onCommand(payload)
    }
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void
  ) {
    if let payload = Self.extractPayload(from: message) {
      onCommand(payload)
    }
    replyHandler(["received": true])
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
    if let payload = Self.extractPayload(from: userInfo) {
      onCommand(payload)
    }
  }

  static func extractPayload(from dictionary: [String: Any]) -> [String: String]? {
    guard let command = dictionary["command"] as? String else { return nil }

    var payload: [String: String] = [
      "command": command
    ]

    if let commandId = dictionary["commandId"] as? String {
      payload["commandId"] = commandId
    }

    if let workoutId = dictionary["workoutId"] as? String {
      payload["workoutId"] = workoutId
    }

    if let setId = dictionary["setId"] as? String {
      payload["setId"] = setId
    }

    if let expectedState = dictionary["expectedState"] as? String {
      payload["expectedState"] = expectedState
    }

    if let eventAtMs = dictionary["eventAtMs"] as? NSNumber {
      payload["eventAtMs"] = eventAtMs.stringValue
    } else if let eventAtMs = dictionary["eventAtMs"] as? Int64 {
      payload["eventAtMs"] = String(eventAtMs)
    } else if let eventAtMs = dictionary["eventAtMs"] as? Int {
      payload["eventAtMs"] = String(eventAtMs)
    } else if let eventAtMs = dictionary["eventAtMs"] as? String {
      payload["eventAtMs"] = eventAtMs
    }

    return payload
  }
}
