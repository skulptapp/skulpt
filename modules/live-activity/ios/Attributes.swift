#if canImport(ActivityKit)
import ActivityKit
import Foundation

public struct WorkoutAttributes: ActivityAttributes {
    public var workoutName: String
    public var workoutId: String

    public struct ContentState: Codable, Hashable {
        public var state: String  // "performing" | "resting" | "resting_no_next" | "ready" | "completed"

        public var exerciseName: String
        public var setNumber: Int
        public var totalSets: Int
        public var setType: String  // "working" | "warmup" | "dropset" | "failure"

        public var weight: Double?
        public var weightUnits: String?  // "kg" | "lb"
        public var reps: Int?
        public var timeOptions: String?  // "log" | "timer" | "stopwatch"

        public var timerStartDate: Date
        public var timerEndDate: Date
        public var workoutStartDate: Date

        public var nextExerciseName: String?
        public var nextSetNumber: Int?
        public var nextWeight: Double?
        public var nextWeightUnits: String?
        public var nextReps: Int?

        public var completedExercises: Int
        public var totalExercises: Int

        public var workoutExerciseId: String?  // for deep link
    }
}
#endif
