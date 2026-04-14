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
            setNumber: dict["setNumber"] as? Int ?? 0,
            totalSets: dict["totalSets"] as? Int ?? 0,
            setType: dict["setType"] as? String ?? "working",
            weight: dict["weight"] as? Double,
            weightUnits: dict["weightUnits"] as? String,
            reps: dict["reps"] as? Int,
            timeOptions: dict["timeOptions"] as? String,
            timerStartDate: dateFromMs(dict["timerStartDate"]),
            timerEndDate: dateFromMs(dict["timerEndDate"]),
            workoutStartDate: dateFromMs(dict["workoutStartDate"]),
            nextExerciseName: dict["nextExerciseName"] as? String,
            nextSetNumber: dict["nextSetNumber"] as? Int,
            nextWeight: dict["nextWeight"] as? Double,
            nextWeightUnits: dict["nextWeightUnits"] as? String,
            nextReps: dict["nextReps"] as? Int,
            completedExercises: dict["completedExercises"] as? Int ?? 0,
            totalExercises: dict["totalExercises"] as? Int ?? 0,
            workoutExerciseId: dict["workoutExerciseId"] as? String
        )
    }

    private static func dateFromMs(_ value: Any?) -> Date {
        guard let ms = value as? Double else {
            return Date()
        }
        return Date(timeIntervalSince1970: ms / 1000.0)
    }
}
