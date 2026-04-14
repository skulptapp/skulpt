import Foundation

struct WatchWorkoutState {
  var state: String  // "performing" | "resting" | "resting_no_next" | "ready" | "completed" | "idle"
  var workoutId: String?
  var currentSetId: String?
  var restSetId: String?
  var nextSetId: String?

  var workoutName: String
  var exerciseName: String
  var setNumber: Int
  var totalSets: Int
  var setType: String

  var weight: Double?
  var weightUnits: String?
  var reps: Int?
  var tracking: [String]?
  var distance: Double?
  var distanceUnits: String?
  var timeSeconds: Int?
  var timeOptions: String?

  var timerStartDate: Date
  var timerEndDate: Date
  var workoutStartDate: Date

  var nextExerciseName: String?
  var nextSetNumber: Int?
  var nextWeight: Double?
  var nextWeightUnits: String?
  var nextReps: Int?
  var nextTracking: [String]?
  var nextDistance: Double?
  var nextDistanceUnits: String?

  var completedExercises: Int
  var totalExercises: Int
  var playSounds: Bool
  var heartRateMhr: Double?
  var restTimeSeconds: Int?
  var nextTimeOptions: String?
  var nextTimeSeconds: Int?
  var nextRestTimeSeconds: Int?
  var phoneHealthPermissionsGranted: Bool

  var isActive: Bool {
    state != "idle" && state != "completed"
  }

  var isResting: Bool {
    state == "resting" || state == "resting_no_next"
  }

  var isPerforming: Bool {
    state == "performing"
  }

  var isReady: Bool {
    state == "ready"
  }

  var isAllSetsCompleted: Bool {
    (state == "ready" || state == "resting_no_next") && nextSetNumber == nil
  }

  static func from(dictionary dict: [String: Any]) -> WatchWorkoutState {
    WatchWorkoutState(
      state: dict["state"] as? String ?? "idle",
      workoutId: dict["workoutId"] as? String,
      currentSetId: dict["currentSetId"] as? String,
      restSetId: dict["restSetId"] as? String,
      nextSetId: dict["nextSetId"] as? String,
      workoutName: dict["workoutName"] as? String ?? "",
      exerciseName: dict["exerciseName"] as? String ?? "",
      setNumber: dict["setNumber"] as? Int ?? 0,
      totalSets: dict["totalSets"] as? Int ?? 0,
      setType: dict["setType"] as? String ?? "working",
      weight: dict["weight"] as? Double,
      weightUnits: dict["weightUnits"] as? String,
      reps: dict["reps"] as? Int,
      tracking: stringArrayFromAny(dict["tracking"]),
      distance: doubleFromAny(dict["distance"]),
      distanceUnits: dict["distanceUnits"] as? String,
      timeSeconds: intFromAny(dict["timeSeconds"]),
      timeOptions: dict["timeOptions"] as? String,
      timerStartDate: dateFromMs(dict["timerStartDate"]),
      timerEndDate: dateFromMs(dict["timerEndDate"]),
      workoutStartDate: dateFromMs(dict["workoutStartDate"]),
      nextExerciseName: dict["nextExerciseName"] as? String,
      nextSetNumber: dict["nextSetNumber"] as? Int,
      nextWeight: dict["nextWeight"] as? Double,
      nextWeightUnits: dict["nextWeightUnits"] as? String,
      nextReps: dict["nextReps"] as? Int,
      nextTracking: stringArrayFromAny(dict["nextTracking"]),
      nextDistance: doubleFromAny(dict["nextDistance"]),
      nextDistanceUnits: dict["nextDistanceUnits"] as? String,
      completedExercises: dict["completedExercises"] as? Int ?? 0,
      totalExercises: dict["totalExercises"] as? Int ?? 0,
      playSounds: dict["playSounds"] as? Bool ?? false,
      heartRateMhr: doubleFromAny(dict["heartRateMhr"]),
      restTimeSeconds: intFromAny(dict["restTimeSeconds"]),
      nextTimeOptions: dict["nextTimeOptions"] as? String,
      nextTimeSeconds: intFromAny(dict["nextTimeSeconds"]),
      nextRestTimeSeconds: intFromAny(dict["nextRestTimeSeconds"]),
      phoneHealthPermissionsGranted: dict["phoneHealthPermissionsGranted"] as? Bool ?? false
    )
  }

  static let idle = WatchWorkoutState(
    state: "idle",
    workoutId: nil,
    currentSetId: nil,
    restSetId: nil,
    nextSetId: nil,
    workoutName: "",
    exerciseName: "",
    setNumber: 0,
    totalSets: 0,
    setType: "working",
    tracking: nil,
    distance: nil,
    distanceUnits: nil,
    timeSeconds: nil,
    timerStartDate: .now,
    timerEndDate: .now,
    workoutStartDate: .now,
    nextTracking: nil,
    nextDistance: nil,
    nextDistanceUnits: nil,
    completedExercises: 0,
    totalExercises: 0,
    playSounds: false,
    heartRateMhr: nil,
    restTimeSeconds: nil,
    nextTimeOptions: nil,
    nextTimeSeconds: nil,
    nextRestTimeSeconds: nil,
    phoneHealthPermissionsGranted: false
  )
}

private func dateFromMs(_ value: Any?) -> Date {
  guard let ms = doubleFromAny(value) else { return Date() }
  return Date(timeIntervalSince1970: ms / 1000.0)
}

private func doubleFromAny(_ value: Any?) -> Double? {
  if let number = value as? Double { return number }
  if let number = value as? Int { return Double(number) }
  if let number = value as? NSNumber { return number.doubleValue }
  return nil
}

private func intFromAny(_ value: Any?) -> Int? {
  if let number = value as? Int { return number }
  if let number = value as? Double { return Int(number) }
  if let number = value as? NSNumber { return number.intValue }
  return nil
}

private func stringArrayFromAny(_ value: Any?) -> [String]? {
  if let items = value as? [String] { return items }
  if let items = value as? [Any] {
    let strings = items.compactMap { $0 as? String }
    return strings.isEmpty ? nil : strings
  }
  return nil
}
