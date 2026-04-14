import Foundation
import SwiftUI

let watchBrandLime = Color(red: 163 / 255, green: 230 / 255, blue: 53 / 255)

func watchLocalized(_ key: String) -> String {
  NSLocalizedString(key, comment: "")
}

func watchZoneTitle(for zone: Int?) -> String? {
  guard let zone else { return nil }

  switch zone {
  case 1: return watchLocalized("workout.zone.1")
  case 2: return watchLocalized("workout.zone.2")
  case 3: return watchLocalized("workout.zone.3")
  case 4: return watchLocalized("workout.zone.4")
  case 5: return watchLocalized("workout.zone.5")
  default: return nil
  }
}

func watchZoneColor(for zone: Int?) -> Color {
  switch zone {
  case 1: return Color(red: 148 / 255, green: 163 / 255, blue: 184 / 255)  // #94a3b8
  case 2: return Color(red: 250 / 255, green: 204 / 255, blue: 21 / 255)  // #facc15
  case 3: return Color(red: 251 / 255, green: 146 / 255, blue: 60 / 255)  // #fb923c
  case 4: return Color(red: 248 / 255, green: 113 / 255, blue: 113 / 255)  // #f87171
  case 5: return Color(red: 244 / 255, green: 114 / 255, blue: 182 / 255)  // #f472b6
  default: return .white
  }
}

func watchFormattedDuration(_ seconds: Int) -> String {
  let safeSeconds = max(0, seconds)
  let minutes = safeSeconds / 60
  let remainder = safeSeconds % 60
  return String(format: "%d:%02d", minutes, remainder)
}

extension WatchWorkoutState {
  enum TrackingSegmentKind {
    case value
    case unit
    case separator
  }

  enum TrackingSegmentContent {
    case text(String)
    case timer(Date)
    case stopwatch(Date)
  }

  struct TrackingDisplaySegment {
    let content: TrackingSegmentContent
    let kind: TrackingSegmentKind
  }

  var displayWorkoutName: String {
    workoutName.isEmpty ? watchLocalized("app.name") : workoutName
  }

  var displayExerciseName: String {
    if isAllSetsCompleted && (nextExerciseName?.isEmpty ?? true) {
      return ""
    }

    let showNext = isResting || isReady
    let name = showNext ? (nextExerciseName ?? exerciseName) : exerciseName
    return name.isEmpty ? watchLocalized("workout.fallback.exercise") : name
  }

  var displaySetNumber: Int {
    if isResting || isReady {
      return nextSetNumber ?? setNumber
    }

    return setNumber
  }

  var setTypeShort: String {
    switch setType {
    case "warmup":
      return watchLocalized("workout.set_type.warmup_short")
    case "dropset":
      return watchLocalized("workout.set_type.dropset_short")
    case "failure":
      return watchLocalized("workout.set_type.failure_short")
    default:
      return watchLocalized("workout.set_type.working_short")
    }
  }

  var trackingDisplaySegments: [TrackingDisplaySegment] {
    if isAllSetsCompleted {
      return []
    }

    let showNext = isResting || isReady
    let weightValue = showNext ? (nextWeight ?? weight) : weight
    let weightUnit = showNext ? (nextWeightUnits ?? weightUnits) : weightUnits
    let repsValue = showNext ? (nextReps ?? reps) : reps
    let timeValue = showNext ? (nextTimeSeconds ?? timeSeconds) : timeSeconds
    let distanceValue = showNext ? (nextDistance ?? distance) : distance
    let distanceUnit = showNext ? (nextDistanceUnits ?? distanceUnits) : distanceUnits
    let trackingOrder = displayTrackingOrder

    let fieldSegments = trackingOrder.compactMap { key -> [TrackingDisplaySegment]? in
      switch key {
      case "weight":
        guard let weightValue else { return nil }
        var segments = [
          TrackingDisplaySegment(
            content: .text(watchFormatMetricNumber(weightValue)),
            kind: .value
          )
        ]
        if let weightUnit, !weightUnit.isEmpty {
          segments.append(TrackingDisplaySegment(content: .text(weightUnit), kind: .unit))
        }
        return segments
      case "reps":
        guard let repsValue else { return nil }
        return [TrackingDisplaySegment(content: .text("\(repsValue)"), kind: .value)]
      case "time":
        guard let timeValue else { return nil }
        if isPerforming && timeOptions == "timer" {
          return [TrackingDisplaySegment(content: .timer(timerEndDate), kind: .value)]
        }
        if isPerforming && timeOptions == "stopwatch" {
          return [TrackingDisplaySegment(content: .stopwatch(timerStartDate), kind: .value)]
        }
        return [
          TrackingDisplaySegment(
            content: .text(watchFormattedDurationCompact(timeValue)),
            kind: .value
          )
        ]
      case "distance":
        guard let distanceValue else { return nil }
        var segments = [
          TrackingDisplaySegment(
            content: .text(watchFormatMetricNumber(distanceValue)),
            kind: .value
          )
        ]
        if let distanceUnit, !distanceUnit.isEmpty {
          segments.append(TrackingDisplaySegment(content: .text(distanceUnit), kind: .unit))
        }
        return segments
      default:
        return nil
      }
    }

    guard !fieldSegments.isEmpty else { return [] }

    var combined: [TrackingDisplaySegment] = []
    for (index, segments) in fieldSegments.enumerated() {
      if index > 0 {
        combined.append(TrackingDisplaySegment(content: .text("×"), kind: .separator))
      }
      combined.append(contentsOf: segments)
    }

    return combined
  }

  var hasLiveTimeInTracking: Bool {
    trackingDisplaySegments.contains { segment in
      switch segment.content {
      case .timer, .stopwatch:
        return true
      case .text:
        return false
      }
    }
  }

  private var displayTrackingOrder: [String] {
    let showNext = isResting || isReady
    let tracked = showNext ? (nextTracking ?? tracking) : tracking
    if let tracked, !tracked.isEmpty {
      return tracked
    }

    var fallback: [String] = []
    if (showNext ? (nextWeight ?? weight) : weight) != nil { fallback.append("weight") }
    if (showNext ? (nextReps ?? reps) : reps) != nil { fallback.append("reps") }
    if (showNext ? (nextTimeSeconds ?? timeSeconds) : timeSeconds) != nil {
      fallback.append("time")
    }
    if (showNext ? (nextDistance ?? distance) : distance) != nil { fallback.append("distance") }
    return fallback
  }
}

private func watchFormatMetricNumber(_ value: Double) -> String {
  value == value.rounded() ? "\(Int(value))" : String(format: "%.1f", value)
}

private func watchFormattedDurationCompact(_ seconds: Int) -> String {
  let total = max(0, seconds)
  let hh = total / 3600
  let mm = (total % 3600) / 60
  let ss = total % 60

  if hh > 0 {
    return "\(hh):\(String(format: "%02d", mm)):\(String(format: "%02d", ss))"
  }

  return "\(mm):\(String(format: "%02d", ss))"
}
