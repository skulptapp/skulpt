import ExpoModulesCore

#if canImport(ActivityKit)
    import ActivityKit
#endif

public class LiveActivityModule: Module {
    public func definition() -> ModuleDefinition {
        Name("LiveActivity")

        Function("areActivitiesEnabled") { () -> Bool in
            #if canImport(ActivityKit)
                if #available(iOS 16.2, *) {
                    return ActivityAuthorizationInfo().areActivitiesEnabled
                }
            #endif
            return false
        }

        AsyncFunction("startWorkoutActivity") {
            (workoutName: String, workoutId: String, stateDict: [String: Any]) -> String? in
            #if canImport(ActivityKit)
                if #available(iOS 16.2, *) {
                    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
                        return nil
                    }

                    let contentState = Self.buildContentState(from: stateDict)
                    let attributes = WorkoutAttributes(
                        workoutName: workoutName, workoutId: workoutId)
                    let content = ActivityContent(state: contentState, staleDate: nil)

                    do {
                        let activity = try Activity.request(
                            attributes: attributes,
                            content: content,
                            pushType: nil
                        )
                        return activity.id
                    } catch {
                        reportNativeError(error, context: "LiveActivity.startWorkoutActivity failed")
                        return nil
                    }
                }
            #endif
            return nil
        }

        AsyncFunction("updateWorkoutActivity") {
            (activityId: String, stateDict: [String: Any]) -> Bool in
            #if canImport(ActivityKit)
                if #available(iOS 16.2, *) {
                    let contentState = Self.buildContentState(from: stateDict)
                    let content = ActivityContent(state: contentState, staleDate: nil)

                    for activity in Activity<WorkoutAttributes>.activities {
                        if activity.id == activityId {
                            await activity.update(content)
                            return true
                        }
                    }
                }
            #endif
            return false
        }

        AsyncFunction("endWorkoutActivity") {
            (activityId: String, stateDict: [String: Any], dismissImmediately: Bool) -> Bool in
            #if canImport(ActivityKit)
                if #available(iOS 16.2, *) {
                    let contentState = Self.buildContentState(from: stateDict)
                    let content = ActivityContent(state: contentState, staleDate: nil)
                    let policy: ActivityUIDismissalPolicy =
                        dismissImmediately ? .immediate : .default

                    for activity in Activity<WorkoutAttributes>.activities {
                        if activity.id == activityId {
                            await activity.end(content, dismissalPolicy: policy)
                            return true
                        }
                    }
                }
            #endif
            return false
        }

        Function("getRunningActivityId") { () -> String? in
            #if canImport(ActivityKit)
                if #available(iOS 16.2, *) {
                    return Activity<WorkoutAttributes>.activities.first?.id
                }
            #endif
            return nil
        }

        AsyncFunction("endAllActivities") { () -> Bool in
            #if canImport(ActivityKit)
                if #available(iOS 16.2, *) {
                    for activity in Activity<WorkoutAttributes>.activities {
                        await activity.end(nil, dismissalPolicy: .immediate)
                    }
                    return true
                }
            #endif
            return false
        }
    }

    // MARK: - State Builder

    private static func buildContentState(from dict: [String: Any])
        -> WorkoutAttributes.ContentState
    {
        return WorkoutAttributes.ContentState(
            state: dict["state"] as? String ?? "ready",
            exerciseName: dict["exerciseName"] as? String ?? "",
            setNumber: intFromValue(dict["setNumber"]) ?? 0,
            totalSets: intFromValue(dict["totalSets"]) ?? 0,
            setType: dict["setType"] as? String ?? "working",
            weight: doubleFromValue(dict["weight"]),
            weightUnits: dict["weightUnits"] as? String,
            reps: intFromValue(dict["reps"]),
            timeOptions: dict["timeOptions"] as? String,
            timerStartDate: dateFromMs(dict["timerStartDate"]),
            timerEndDate: dateFromMs(dict["timerEndDate"]),
            workoutStartDate: dateFromMs(dict["workoutStartDate"]),
            nextExerciseName: dict["nextExerciseName"] as? String,
            nextSetNumber: intFromValue(dict["nextSetNumber"]),
            nextTotalSets: intFromValue(dict["nextTotalSets"]),
            nextSetType: dict["nextSetType"] as? String,
            nextWeight: doubleFromValue(dict["nextWeight"]),
            nextWeightUnits: dict["nextWeightUnits"] as? String,
            nextReps: intFromValue(dict["nextReps"]),
            completedExercises: intFromValue(dict["completedExercises"]) ?? 0,
            totalExercises: intFromValue(dict["totalExercises"]) ?? 0,
            workoutExerciseId: dict["workoutExerciseId"] as? String,
            currentSetId: dict["currentSetId"] as? String,
            restSetId: dict["restSetId"] as? String,
            nextSetId: dict["nextSetId"] as? String
        )
    }

    private static func dateFromMs(_ value: Any?) -> Date {
        guard let ms = doubleFromValue(value) else {
            return Date()
        }
        return Date(timeIntervalSince1970: ms / 1000.0)
    }

    private static func intFromValue(_ value: Any?) -> Int? {
        if let value = value as? Int {
            return value
        }
        if let value = value as? Double {
            return Int(value)
        }
        if let value = value as? Float {
            return Int(value)
        }
        if let value = value as? NSNumber {
            return value.intValue
        }
        if let value = value as? String {
            return Int(value)
        }
        return nil
    }

    private static func doubleFromValue(_ value: Any?) -> Double? {
        if let value = value as? Double {
            return value
        }
        if let value = value as? Float {
            return Double(value)
        }
        if let value = value as? Int {
            return Double(value)
        }
        if let value = value as? NSNumber {
            return value.doubleValue
        }
        if let value = value as? String {
            return Double(value)
        }
        return nil
    }
}
