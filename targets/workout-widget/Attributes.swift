import ActivityKit
import Foundation

public struct WorkoutAttributes: ActivityAttributes {
    public var workoutName: String
    public var workoutId: String

    public struct ContentState: Codable, Hashable {
        public var state: String // "performing" | "resting" | "resting_no_next" | "ready" | "completed"

        public var exerciseName: String
        public var setNumber: Int
        public var totalSets: Int
        public var setType: String // "working" | "warmup" | "dropset" | "failure"

        public var weight: Double?
        public var weightUnits: String? // "kg" | "lb"
        public var reps: Int?
        public var timeOptions: String? // "log" | "timer" | "stopwatch"

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

        public var workoutExerciseId: String? // for deep link
    }
}

// MARK: - Preview Data

extension WorkoutAttributes {
    static var preview: WorkoutAttributes {
        WorkoutAttributes(workoutName: "Push Day", workoutId: "preview-1")
    }
}

extension WorkoutAttributes.ContentState {
    static var performing: WorkoutAttributes.ContentState {
        .init(
            state: "performing",
            exerciseName: "Bench Press",
            setNumber: 3,
            totalSets: 5,
            setType: "working",
            weight: 80,
            weightUnits: "kg",
            reps: 8,
            timeOptions: "log",
            timerStartDate: .now.addingTimeInterval(-1800),
            timerEndDate: .distantFuture,
            workoutStartDate: .now.addingTimeInterval(-1800),
            nextExerciseName: "Incline Dumbbell Press",
            nextSetNumber: 1,
            nextWeight: 30,
            nextWeightUnits: "kg",
            nextReps: 12,
            completedExercises: 1,
            totalExercises: 5,
            workoutExerciseId: "ex-1"
        )
    }

    static var performingTimer: WorkoutAttributes.ContentState {
        .init(
            state: "performing",
            exerciseName: "Plank",
            setNumber: 2,
            totalSets: 3,
            setType: "working",
            weight: nil,
            weightUnits: nil,
            reps: nil,
            timeOptions: "timer",
            timerStartDate: .now,
            timerEndDate: .now.addingTimeInterval(60),
            workoutStartDate: .now.addingTimeInterval(-1200),
            nextExerciseName: "Plank",
            nextSetNumber: 3,
            nextWeight: nil,
            nextWeightUnits: nil,
            nextReps: nil,
            completedExercises: 3,
            totalExercises: 5,
            workoutExerciseId: "ex-3"
        )
    }

    static var performingStopwatch: WorkoutAttributes.ContentState {
        .init(
            state: "performing",
            exerciseName: "Dead Hang",
            setNumber: 1,
            totalSets: 3,
            setType: "working",
            weight: nil,
            weightUnits: nil,
            reps: nil,
            timeOptions: "stopwatch",
            timerStartDate: .now,
            timerEndDate: .now.addingTimeInterval(28800),
            workoutStartDate: .now.addingTimeInterval(-900),
            nextExerciseName: "Dead Hang",
            nextSetNumber: 2,
            nextWeight: nil,
            nextWeightUnits: nil,
            nextReps: nil,
            completedExercises: 2,
            totalExercises: 4,
            workoutExerciseId: "ex-4"
        )
    }

    static var resting: WorkoutAttributes.ContentState {
        .init(
            state: "resting",
            exerciseName: "Bench Press",
            setNumber: 3,
            totalSets: 5,
            setType: "working",
            weight: 80,
            weightUnits: "kg",
            reps: 8,
            timeOptions: "log",
            timerStartDate: .now,
            timerEndDate: .now.addingTimeInterval(90),
            workoutStartDate: .now.addingTimeInterval(-1800),
            nextExerciseName: "Bench Press",
            nextSetNumber: 4,
            nextWeight: 85,
            nextWeightUnits: "kg",
            nextReps: 6,
            completedExercises: 1,
            totalExercises: 5,
            workoutExerciseId: "ex-1"
        )
    }

    static var ready: WorkoutAttributes.ContentState {
        .init(
            state: "ready",
            exerciseName: "Overhead Press",
            setNumber: 1,
            totalSets: 4,
            setType: "working",
            weight: 50,
            weightUnits: "kg",
            reps: 10,
            timeOptions: nil,
            timerStartDate: .now.addingTimeInterval(-2400),
            timerEndDate: .distantFuture,
            workoutStartDate: .now.addingTimeInterval(-2400),
            nextExerciseName: nil,
            nextSetNumber: nil,
            nextWeight: nil,
            nextWeightUnits: nil,
            nextReps: nil,
            completedExercises: 2,
            totalExercises: 5,
            workoutExerciseId: "ex-2"
        )
    }
}
