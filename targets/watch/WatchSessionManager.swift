import Foundation
import WatchConnectivity
import WatchKit

class WatchSessionManager: NSObject, ObservableObject {
  static let shared = WatchSessionManager()
  private let timerWarningLeadSeconds: TimeInterval = 4

  @Published var workoutState: WatchWorkoutState = .idle

  let workoutManager = WorkoutManager.shared
  private var restTimer: Timer?
  private var countdownTimer: Timer?
  private var lastCountdownWarningKey: String?
  private var finishingWorkoutId: String?
  private var pendingLifecyclePayload: [String: Any]?

  private override init() {
    super.init()
    if WCSession.isSupported() {
      let session = WCSession.default
      session.delegate = self
      session.activate()
    }
  }

  func sendCommand(_ command: String, setId: String? = nil, expectedState: String? = nil) {
    guard WCSession.isSupported() else { return }

    let session = WCSession.default
    if session.activationState != .activated {
      session.activate()
    }

    if let optimisticState = optimisticState(for: command) {
      handleStateUpdate(optimisticState)
    }

    if command == "finishWorkout" {
      finishingWorkoutId = workoutState.workoutId
    }

    var payload: [String: Any] = [
      "command": command,
      "commandId": UUID().uuidString,
    ]

    if let workoutId = workoutState.workoutId {
      payload["workoutId"] = workoutId
    }

    if let setId {
      payload["setId"] = setId
    }

    if let expectedState {
      payload["expectedState"] = expectedState
    }

    session.transferUserInfo(payload)

    guard session.isReachable else { return }
    session.sendMessage(
      payload,
      replyHandler: nil,
      errorHandler: { error in
        reportNativeError(error, context: "WatchSessionManager.sendCommand failed")
      }
    )
  }

  func sendLifecycleSignal(_ command: String, workoutId: String? = nil) {
    guard WCSession.isSupported() else { return }

    let session = WCSession.default
    var payload: [String: Any] = [
      "command": command,
      "eventAtMs": NSNumber(value: Int64(Date().timeIntervalSince1970 * 1000)),
    ]
    if let workoutId = workoutId ?? workoutState.workoutId {
      payload["workoutId"] = workoutId
    }

    session.transferUserInfo(payload)

    guard session.activationState == .activated else {
      pendingLifecyclePayload = payload
      session.activate()
      return
    }

    if pushLifecycleSignal(payload, session: session) {
      pendingLifecyclePayload = nil
      return
    }

    pendingLifecyclePayload = payload
    guard session.isReachable else { return }
    session.sendMessage(
      payload,
      replyHandler: nil,
      errorHandler: { error in
        reportNativeError(
          error,
          context: "WatchSessionManager.sendLifecycleSignal fallback failed"
        )
      }
    )
  }

  private func pushLifecycleSignal(_ payload: [String: Any], session: WCSession) -> Bool {
    do {
      try session.updateApplicationContext(payload)
      return true
    } catch {
      reportNativeError(error, context: "WatchSessionManager.sendLifecycleSignal failed")
      return false
    }
  }

  private func flushPendingLifecycleSignal(using session: WCSession) {
    guard let pendingLifecyclePayload else { return }
    guard session.activationState == .activated else { return }

    if pushLifecycleSignal(pendingLifecyclePayload, session: session) {
      self.pendingLifecyclePayload = nil
    }
  }

  private func optimisticState(for command: String) -> WatchWorkoutState? {
    var s = workoutState
    let now = Date()

    switch command {
    case "completeSet":
      if let restTimeSeconds = s.restTimeSeconds, restTimeSeconds > 0 {
        s.state = s.nextSetId != nil ? "resting" : "resting_no_next"
        s.restSetId = s.currentSetId
        s.currentSetId = nil
        s.timerStartDate = now
        s.timerEndDate = now.addingTimeInterval(TimeInterval(restTimeSeconds))
      } else if let performingState = optimisticPerformingState(from: s, at: now) {
        s = performingState
      } else {
        s.state = "ready"
        s.currentSetId = nil
      }
    case "skipRest", "restTimerDone":
      if let performingState = optimisticPerformingState(from: s, at: now) {
        s = performingState
      } else {
        s.state = "ready"
        s.restSetId = nil
        s.currentSetId = nil
      }
    case "startSet":
      guard let performingState = optimisticPerformingState(from: s, at: now) else { return nil }
      s = performingState
    case "finishWorkout":
      s.state = "completed"
    default:
      return nil
    }

    return s
  }

  private func optimisticPerformingState(from state: WatchWorkoutState, at now: Date)
    -> WatchWorkoutState?
  {
    guard state.nextSetId != nil else { return nil }

    var s = state
    let nextTimeOptions = s.nextTimeOptions ?? s.timeOptions
    let nextTimeSeconds = s.nextTimeSeconds
    let nextRestTimeSeconds = s.nextRestTimeSeconds
    let nextTracking = s.nextTracking ?? s.tracking

    s.state = "performing"
    s.currentSetId = s.nextSetId
    s.restSetId = nil
    s.exerciseName = s.nextExerciseName ?? s.exerciseName
    s.setNumber = s.nextSetNumber ?? s.setNumber
    s.weight = s.nextWeight ?? s.weight
    s.weightUnits = s.nextWeightUnits ?? s.weightUnits
    s.reps = s.nextReps ?? s.reps
    s.tracking = nextTracking
    s.distance = s.nextDistance ?? s.distance
    s.distanceUnits = s.nextDistanceUnits ?? s.distanceUnits
    s.timeSeconds = nextTimeSeconds ?? s.timeSeconds
    s.timeOptions = nextTimeOptions
    s.restTimeSeconds = nextRestTimeSeconds
    s.nextSetId = nil
    s.nextExerciseName = nil
    s.nextSetNumber = nil
    s.nextWeight = nil
    s.nextWeightUnits = nil
    s.nextReps = nil
    s.nextTracking = nil
    s.nextDistance = nil
    s.nextDistanceUnits = nil
    s.nextTimeOptions = nil
    s.nextTimeSeconds = nil
    s.nextRestTimeSeconds = nil
    s.timerStartDate = now

    if s.timeOptions == "timer", let nextTimeSeconds {
      s.timerEndDate = now.addingTimeInterval(TimeInterval(nextTimeSeconds))
    } else {
      s.timerEndDate = now.addingTimeInterval(TimeInterval(8 * 60 * 60))
    }

    return s
  }

  private func handleStateUpdate(_ newState: WatchWorkoutState) {
    let resolvedState = resolveDisplayState(from: newState, previousState: workoutState)
    let wasActive = workoutState.isActive
    let hasActiveHealthSession = workoutManager.isSessionActive
    let currentWorkoutId = workoutState.workoutId
    let incomingWorkoutId = resolvedState.workoutId
    let didChangeActiveWorkout =
      resolvedState.isActive
      && wasActive
      && currentWorkoutId != nil
      && incomingWorkoutId != nil
      && incomingWorkoutId != currentWorkoutId
    let finishingWorkoutId = self.finishingWorkoutId
    let shouldIgnoreFinishingEcho =
      resolvedState.isActive
      && finishingWorkoutId != nil
      && incomingWorkoutId == finishingWorkoutId
    let isExplicitCompletion =
      resolvedState.state == "completed"
      && resolvedState.workoutId != nil
      && (currentWorkoutId == nil || resolvedState.workoutId == currentWorkoutId)
    let shouldIgnoreTransientEnd =
      wasActive
      && hasActiveHealthSession
      && !resolvedState.isActive
      && !isExplicitCompletion

    if shouldIgnoreFinishingEcho {
      return
    }

    if shouldIgnoreTransientEnd {
      return
    }

    if isExplicitCompletion, incomingWorkoutId == finishingWorkoutId {
      self.finishingWorkoutId = nil
    } else if let finishingWorkoutId, let incomingWorkoutId, incomingWorkoutId != finishingWorkoutId
    {
      self.finishingWorkoutId = nil
    }

    workoutState = resolvedState
    workoutManager.updateAuthorizationSource(
      phoneHasHealthPermissions: resolvedState.phoneHealthPermissionsGranted
    )
    workoutManager.updateZoneConfiguration(mhr: resolvedState.heartRateMhr)

    if didChangeActiveWorkout {
      workoutManager.endSession()
      workoutManager.startSession(for: resolvedState.workoutId)
    } else if resolvedState.isActive && !wasActive {
      workoutManager.startSession(for: resolvedState.workoutId)
    } else if !resolvedState.isActive && (wasActive || hasActiveHealthSession) {
      workoutManager.endSession()
    }

    scheduleTimers(for: resolvedState)
  }

  private func resolveDisplayState(
    from incoming: WatchWorkoutState, previousState: WatchWorkoutState
  )
    -> WatchWorkoutState
  {
    guard incoming.setNumber == 0, incoming.totalSets == 0 else { return incoming }
    guard previousState.totalSets > 0 else { return incoming }
    guard incoming.workoutId == nil || incoming.workoutId == previousState.workoutId else {
      return incoming
    }

    let isTerminalDisplayState =
      incoming.state == "completed"
      || ((incoming.state == "ready" || incoming.state == "resting_no_next")
        && incoming.nextSetNumber == nil)
    guard isTerminalDisplayState else { return incoming }

    var resolved = incoming
    resolved.totalSets = previousState.totalSets
    resolved.setNumber = previousState.totalSets
    if resolved.exerciseName.isEmpty {
      resolved.exerciseName = previousState.exerciseName
    }
    return resolved
  }

  private func countdownWarningKey(for state: WatchWorkoutState) -> String? {
    let workoutId = state.workoutId ?? "unknown"

    if state.isResting {
      let restSetId = state.restSetId ?? "unknown"
      return "rest:\(workoutId):\(restSetId):\(state.timerEndDate.timeIntervalSince1970)"
    }

    if state.isPerforming && state.timeOptions == "timer" {
      let setId = state.currentSetId ?? "unknown"
      return "work:\(workoutId):\(setId):\(state.timerEndDate.timeIntervalSince1970)"
    }

    return nil
  }

  private func scheduleCountdownWarning(for state: WatchWorkoutState) {
    guard state.playSounds else { return }
    guard let warningKey = countdownWarningKey(for: state) else { return }

    let delay = state.timerEndDate.timeIntervalSinceNow
    guard delay > 0 else { return }

    let warningDelay = delay - timerWarningLeadSeconds
    if warningDelay <= 0 {
      guard lastCountdownWarningKey != warningKey else { return }
      lastCountdownWarningKey = warningKey
      sendCommand("playTimerEnd")
      return
    }

    countdownTimer = Timer.scheduledTimer(withTimeInterval: warningDelay, repeats: false) {
      [weak self] _ in
      guard let self else { return }
      self.countdownTimer = nil
      guard self.lastCountdownWarningKey != warningKey else { return }
      self.lastCountdownWarningKey = warningKey
      self.sendCommand("playTimerEnd")
    }
  }

  private func scheduleTimers(for state: WatchWorkoutState) {
    restTimer?.invalidate()
    restTimer = nil
    countdownTimer?.invalidate()
    countdownTimer = nil
    scheduleCountdownWarning(for: state)

    guard state.isResting else { return }

    let delay = state.timerEndDate.timeIntervalSinceNow
    guard delay > 0 else { return }

    // Haptic + transition when rest ends
    restTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
      guard let self else { return }
      self.restTimer = nil
      WKInterfaceDevice.current().play(.notification)
      self.sendCommand(
        "restTimerDone",
        setId: self.workoutState.restSetId,
        expectedState: self.workoutState.state
      )
    }
  }
}

extension WatchSessionManager: WCSessionDelegate {
  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    if let error {
      reportNativeError(error, context: "WatchSessionManager session activation failed")
    }

    if activationState == .activated {
      flushPendingLifecycleSignal(using: session)
    }

    let context = session.receivedApplicationContext
    if !context.isEmpty {
      DispatchQueue.main.async {
        self.handleStateUpdate(WatchWorkoutState.from(dictionary: context))
      }
    }
  }

  func session(
    _ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]
  ) {
    DispatchQueue.main.async {
      self.handleStateUpdate(WatchWorkoutState.from(dictionary: applicationContext))
    }
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    if let stateDict = message["workoutState"] as? [String: Any] {
      DispatchQueue.main.async {
        self.handleStateUpdate(WatchWorkoutState.from(dictionary: stateDict))
      }
    }
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void
  ) {
    if let stateDict = message["workoutState"] as? [String: Any] {
      DispatchQueue.main.async {
        self.handleStateUpdate(WatchWorkoutState.from(dictionary: stateDict))
      }
    }
    replyHandler(["received": true])
  }
}
