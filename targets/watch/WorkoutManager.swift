import Foundation
import HealthKit
import WatchKit

class WorkoutManager: NSObject, ObservableObject {
  static let shared = WorkoutManager()
  private static let mirroredPermissionWaitMaxNs: UInt64 = 4_000_000_000
  private static let mirroredPermissionPollNs: UInt64 = 250_000_000

  private let healthStore = HKHealthStore()
  private var session: HKWorkoutSession?
  private var builder: HKLiveWorkoutBuilder?
  private var isEndingSession = false
  private var isFinalizingEndedSession = false
  private var wantsSessionActive = false
  private var sessionRequestGeneration = 0
  private var pendingSessionWorkoutId: String?
  private var activeSessionWorkoutId: String?
  private var phoneHasGrantedHealthPermissions = false

  @Published var heartRate: Double = 0
  @Published var avgHeartRate: Double = 0
  @Published var activeCalories: Double = 0
  @Published var isSessionActive = false
  @Published var intensityPercent: Int?
  @Published var currentZone: Int?
  @Published var currentZoneElapsedSeconds = 0

  private var currentZoneStartedAt: Date?
  private var zoneTimer: Timer?
  private var heartRateMhr: Double?

  private override init() {
    super.init()
  }

  // MARK: - Authorization

  func requestAuthorization() async -> Bool {
    guard HKHealthStore.isHealthDataAvailable() else { return false }

    let typesToShare: Set<HKSampleType> = [
      HKQuantityType.workoutType()
    ]

    let typesToRead: Set<HKObjectType> = [
      HKQuantityType(.heartRate),
      HKQuantityType(.activeEnergyBurned),
    ]

    if phoneHasGrantedHealthPermissions {
      // Fresh installs may start workout before mirrored Health permission reaches
      // watchOS. We wait briefly and avoid prompting on watch.
      await waitForMirroredPhoneAuthorization()
      return true
    }

    do {
      try await healthStore.requestAuthorization(toShare: typesToShare, read: typesToRead)
      return true
    } catch {
      reportNativeError(error, context: "WorkoutManager.requestAuthorization failed")
      return false
    }
  }

  private func waitForMirroredPhoneAuthorization() async {
    guard !hasWorkoutWriteAuthorization() else { return }
    let startUptime = DispatchTime.now().uptimeNanoseconds

    while wantsSessionActive && !hasWorkoutWriteAuthorization() {
      let nowUptime = DispatchTime.now().uptimeNanoseconds
      if nowUptime - startUptime >= Self.mirroredPermissionWaitMaxNs {
        return
      }

      try? await Task.sleep(nanoseconds: Self.mirroredPermissionPollNs)
    }
  }

  private func hasWorkoutWriteAuthorization() -> Bool {
    let status = healthStore.authorizationStatus(for: HKObjectType.workoutType())
    return status == .sharingAuthorized
  }

  // MARK: - Session Management

  func startSession(for workoutId: String? = nil) {
    wantsSessionActive = true
    if let workoutId {
      pendingSessionWorkoutId = workoutId
    }
    guard session == nil else { return }
    sessionRequestGeneration += 1
    let requestGeneration = sessionRequestGeneration

    Task {
      let authorized = await requestAuthorization()
      guard authorized else { return }

      await MainActor.run {
        guard self.wantsSessionActive else { return }
        guard self.session == nil else { return }
        guard self.sessionRequestGeneration == requestGeneration else { return }
        beginWorkoutSession()
      }
    }
  }

  private func beginWorkoutSession() {
    guard session == nil else { return }
    activeSessionWorkoutId = pendingSessionWorkoutId

    let configuration = HKWorkoutConfiguration()
    configuration.activityType = .traditionalStrengthTraining
    configuration.locationType = .indoor

    do {
      session = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
      builder = session?.associatedWorkoutBuilder()

      session?.delegate = self
      builder?.delegate = self

      builder?.dataSource = HKLiveWorkoutDataSource(
        healthStore: healthStore,
        workoutConfiguration: configuration
      )

      let startDate = Date()
      session?.startActivity(with: startDate)
      builder?.beginCollection(withStart: startDate) { _, error in
        if let error {
          reportNativeError(error, context: "WorkoutManager.beginCollection failed")
        }
      }

      isSessionActive = true
      isEndingSession = false
      isFinalizingEndedSession = false
      recomputeZoneMetrics(shouldNotify: false)
    } catch {
      reportNativeError(error, context: "WorkoutManager.beginWorkoutSession failed")
      clearSessionState()
    }
  }

  func endSession() {
    wantsSessionActive = false
    pendingSessionWorkoutId = nil
    sessionRequestGeneration += 1
    guard let session = session, !isEndingSession else { return }
    isEndingSession = true
    session.end()
  }

  func updateZoneConfiguration(mhr: Double?) {
    DispatchQueue.main.async {
      self.heartRateMhr = mhr
      self.recomputeZoneMetrics(shouldNotify: false)
    }
  }

  func updateAuthorizationSource(phoneHasHealthPermissions: Bool) {
    phoneHasGrantedHealthPermissions = phoneHasHealthPermissions
  }

  // MARK: - Data Updates

  private func updateHeartRate(from statistics: HKStatistics?) {
    DispatchQueue.main.async {
      guard let statistics else { return }

      let heartRateUnit = HKUnit.count().unitDivided(by: .minute())
      if let quantity = statistics.mostRecentQuantity() {
        self.heartRate = quantity.doubleValue(for: heartRateUnit)
      }
      if let averageQuantity = statistics.averageQuantity() {
        self.avgHeartRate = averageQuantity.doubleValue(for: heartRateUnit)
      }
      self.recomputeZoneMetrics()
    }
  }

  private func updateActiveCalories(from statistics: HKStatistics?) {
    guard let statistics = statistics,
      let quantity = statistics.sumQuantity()
    else { return }

    let value = quantity.doubleValue(for: .kilocalorie())
    DispatchQueue.main.async {
      self.activeCalories = value
    }
  }

  private func resetZoneMetrics() {
    zoneTimer?.invalidate()
    zoneTimer = nil
    intensityPercent = nil
    currentZone = nil
    currentZoneElapsedSeconds = 0
    currentZoneStartedAt = nil
  }

  private func clearSessionState(allowRestart: Bool = false) {
    let shouldRestart = allowRestart && wantsSessionActive
    if !allowRestart {
      wantsSessionActive = false
      pendingSessionWorkoutId = nil
      phoneHasGrantedHealthPermissions = false
    }

    isSessionActive = false
    heartRate = 0
    avgHeartRate = 0
    activeCalories = 0
    resetZoneMetrics()
    session = nil
    builder = nil
    activeSessionWorkoutId = nil
    isEndingSession = false
    isFinalizingEndedSession = false

    if shouldRestart {
      startSession()
    }
  }

  private func finalizeEndedSession(at endDate: Date) {
    guard !isFinalizingEndedSession else { return }
    isFinalizingEndedSession = true

    guard let builder else {
      clearSessionState(allowRestart: true)
      return
    }

    builder.endCollection(withEnd: endDate) { [weak self] _, error in
      if let error {
        reportNativeError(error, context: "WorkoutManager.endCollection failed")
      }

      builder.finishWorkout { _, finishError in
        if let finishError {
          reportNativeError(finishError, context: "WorkoutManager.finishWorkout failed")
        }

        DispatchQueue.main.async {
          self?.clearSessionState(allowRestart: true)
        }
      }
    }
  }

  private func zoneForPercent(_ percent: Double) -> Int? {
    if percent >= 90 { return 5 }
    if percent >= 80 { return 4 }
    if percent >= 70 { return 3 }
    if percent >= 60 { return 2 }
    if percent >= 50 { return 1 }
    return nil
  }

  private func refreshZoneElapsedSeconds() {
    guard let startedAt = currentZoneStartedAt else {
      currentZoneElapsedSeconds = 0
      return
    }

    currentZoneElapsedSeconds = max(0, Int(Date().timeIntervalSince(startedAt).rounded()))
  }

  private func startZoneTimerIfNeeded() {
    zoneTimer?.invalidate()
    zoneTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
      DispatchQueue.main.async {
        self?.refreshZoneElapsedSeconds()
      }
    }
  }

  private func recomputeZoneMetrics(shouldNotify: Bool = true) {
    guard isSessionActive, heartRate > 0, let mhr = heartRateMhr, mhr > 0 else {
      resetZoneMetrics()
      return
    }

    let effectiveMhr = max(1.0, floor(mhr))
    let nextPercent = max(0.0, (heartRate / effectiveMhr) * 100)
    let nextIntensity = Int(nextPercent.rounded())
    let nextZone = zoneForPercent(nextPercent)
    let previousZone = currentZone

    intensityPercent = nextIntensity

    guard let nextZone else {
      if previousZone != nil {
        zoneTimer?.invalidate()
        zoneTimer = nil
        currentZoneStartedAt = nil
        currentZoneElapsedSeconds = 0
        currentZone = nil
      } else {
        currentZone = nil
        currentZoneStartedAt = nil
        currentZoneElapsedSeconds = 0
      }
      return
    }

    if previousZone != nextZone {
      currentZone = nextZone
      currentZoneStartedAt = Date()
      currentZoneElapsedSeconds = 0
      startZoneTimerIfNeeded()

      if shouldNotify, previousZone != nil {
        WKInterfaceDevice.current().play(.click)
      }
    } else if currentZoneStartedAt == nil {
      currentZoneStartedAt = Date()
      startZoneTimerIfNeeded()
    }

    refreshZoneElapsedSeconds()
  }
}

// MARK: - HKWorkoutSessionDelegate

extension WorkoutManager: HKWorkoutSessionDelegate {
  func workoutSession(
    _ workoutSession: HKWorkoutSession,
    didChangeTo toState: HKWorkoutSessionState,
    from fromState: HKWorkoutSessionState,
    date: Date
  ) {
    DispatchQueue.main.async {
      if toState == .running {
        self.isSessionActive = true
        if fromState != .running {
          WatchSessionManager.shared.sendLifecycleSignal(
            "watchSessionStarted",
            workoutId: self.activeSessionWorkoutId
          )
        }
        self.recomputeZoneMetrics(shouldNotify: false)
        return
      }

      if toState == .ended {
        self.isSessionActive = false
        self.resetZoneMetrics()
        WatchSessionManager.shared.sendLifecycleSignal(
          "watchSessionEnded",
          workoutId: self.activeSessionWorkoutId
        )
        self.finalizeEndedSession(at: date)
      }
    }
  }

  func workoutSession(
    _ workoutSession: HKWorkoutSession,
    didFailWithError error: Error
  ) {
    reportNativeError(error, context: "WorkoutManager workout session failed")
    DispatchQueue.main.async {
      WatchSessionManager.shared.sendLifecycleSignal(
        "watchSessionEnded",
        workoutId: self.activeSessionWorkoutId
      )
      self.clearSessionState()
    }
  }
}

// MARK: - HKLiveWorkoutBuilderDelegate

extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
  func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

  func workoutBuilder(
    _ workoutBuilder: HKLiveWorkoutBuilder,
    didCollectDataOf collectedTypes: Set<HKSampleType>
  ) {
    for type in collectedTypes {
      guard let quantityType = type as? HKQuantityType else { continue }

      let statistics = workoutBuilder.statistics(for: quantityType)

      switch quantityType {
      case HKQuantityType(.heartRate):
        updateHeartRate(from: statistics)
      case HKQuantityType(.activeEnergyBurned):
        updateActiveCalories(from: statistics)
      default:
        break
      }
    }
  }
}
