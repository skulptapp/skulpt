import SwiftUI

private struct OptimisticTrackingValue {
  let value: Double
  let createdAt: Date
}

struct WorkoutExercisePage: View {
  let state: WatchWorkoutState
  let onCommand: (String, String?, String?) -> Void

  @Environment(\.scenePhase) private var scenePhase
  @EnvironmentObject private var session: WatchSessionManager
  @EnvironmentObject private var workoutManager: WorkoutManager
  @FocusState private var isCrownFocused: Bool
  @State private var selectedTrackingField: WatchEditableTrackingField?
  @State private var precisionTrackingField: WatchEditableTrackingField?
  @State private var crownValue: Double = 0
  @State private var lastCrownStep = 0
  @State private var optimisticTrackingValues: [String: OptimisticTrackingValue] = [:]
  @State private var trackingEditTimeoutToken = UUID()
  private let optimisticTrackingHoldSeconds: TimeInterval = 2
  private let trackingEditTimeoutSeconds: TimeInterval = 3

  var body: some View {
    ZStack {
      Color.black.ignoresSafeArea()

      VStack(spacing: 0) {
        VStack(spacing: 8) {
          headerSection
          timesSection
        }
        .padding(.top, WatchLayoutMetrics.topPadding)

        Spacer(minLength: 0)

        exerciseSection
          .layoutPriority(1)

        Spacer(minLength: 0)

        VStack(spacing: 2) {
          trackingSection
          controlsSection
        }
        .padding(.bottom, WatchLayoutMetrics.bottomPadding)
      }
    }
    .ignoresSafeArea()
    .onChange(of: crownValue) { _, newValue in
      handleCrownChange(newValue)
    }
    .onChange(of: displayedEditableSetKey) { _, _ in
      clearTrackingSelection()
      optimisticTrackingValues.removeAll()
    }
    .onChange(of: externalTrackingSnapshotKey) { _, _ in
      reconcileOptimisticTrackingValues()
    }
    .onChange(of: scenePhase) { _, newPhase in
      if newPhase != .active {
        clearTrackingSelection(playHaptic: true)
      }
    }
    .onDisappear {
      session.flushPendingTrackingUpdates()
    }
  }

  private var headerSection: some View {
    HStack {
      HStack(spacing: 6) {
        Text(
          String(
            format: watchLocalized("workout.header.exercise_format"),
            displayedExerciseCounter,
            state.totalExercises
          )
        )
        .font(.system(.caption2, weight: .bold))
        .foregroundColor(.white)

        Text(
          String(
            format: watchLocalized("workout.header.set_format"),
            state.setNumber,
            state.totalSets
          )
        )
        .font(.system(.caption2, weight: .bold))
        .foregroundColor(.white)

        Text(state.setTypeShort)
          .font(.system(.caption2, weight: .bold))
          .foregroundColor(.white)
      }

      Spacer()

      HStack(spacing: 6) {
        if workoutManager.heartRate > 0 {
          HStack(spacing: 2) {
            Image(systemName: "heart.fill")
              .font(.system(size: 10))
              .foregroundColor(.red)

            Text("\(Int(workoutManager.heartRate))")
              .font(.system(.caption2, weight: .bold))
              .foregroundColor(.white)
          }
        }
      }
    }.padding(.leading, 4).padding(.trailing, 12)
  }

  private var timesSection: some View {
    HStack {
      if state.isResting {
        Text(watchLocalized("workout.badge.next"))
          .font(.system(.caption2, weight: .bold))
          .foregroundColor(.black)
          .padding(.horizontal, 6)
          .padding(.vertical, 1)
          .background(watchBrandLime)
          .clipShape(Capsule())
      } else {
        Text(watchLocalized("workout.badge.work"))
          .font(.system(.caption2, weight: .bold))
          .foregroundColor(.black)
          .padding(.horizontal, 6)
          .padding(.vertical, 1)
          .background(.white)
          .clipShape(Capsule())
      }

      Spacer()

      timerSection
    }.padding(.leading, 4).padding(.trailing, 12)
  }

  private var displayedExerciseCounter: Int {
    min(state.completedExercises + 1, state.totalExercises)
  }

  private var exerciseSection: some View {
    VStack(spacing: 4) {
      Text(state.displayExerciseName)
        .font(.system(.body, weight: .medium))
        .foregroundColor(.white)
        .lineLimit(2)
        .multilineTextAlignment(.center)
    }
    .padding(.horizontal, 8)
    .offset(y: 6)
  }

  private var trackingSection: some View {
    VStack(spacing: 4) {
      let displayState = trackingDisplayState
      if !displayState.trackingDisplaySegments.isEmpty {
        ViewThatFits(in: .horizontal) {
          trackingSegmentsRow(displayState, fontScale: 1)
            .fixedSize(horizontal: true, vertical: false)
          trackingSegmentsRow(displayState, fontScale: 0.92)
            .fixedSize(horizontal: true, vertical: false)
          trackingSegmentsRow(displayState, fontScale: 0.84)
            .fixedSize(horizontal: true, vertical: false)
          trackingSegmentsRow(displayState, fontScale: 0.76)
            .fixedSize(horizontal: true, vertical: false)
          trackingSegmentsRow(displayState, fontScale: 0.68)
            .fixedSize(horizontal: true, vertical: false)
          trackingSegmentsRow(displayState, fontScale: 0.6)
            .fixedSize(horizontal: true, vertical: false)
          trackingSegmentsRow(displayState, fontScale: WatchLayoutMetrics.trackingRowMinimumScale)
            .fixedSize(horizontal: true, vertical: false)
        }
        .frame(maxWidth: .infinity)
        .frame(height: WatchLayoutMetrics.trackingRowHeight)
        .focusable(true)
        .focused($isCrownFocused)
        .digitalCrownRotation(
          $crownValue,
          from: -1_000,
          through: 1_000,
          by: 1,
          sensitivity: .medium,
          isContinuous: false,
          isHapticFeedbackEnabled: true
        )
        .digitalCrownAccessory(.hidden)
      }
    }
  }

  private func trackingSegmentsRow(
    _ displayState: WatchWorkoutState,
    fontScale: CGFloat
  ) -> some View {
    HStack(alignment: .firstTextBaseline, spacing: 4) {
      ForEach(Array(displayState.trackingDisplaySegments.enumerated()), id: \.offset) { item in
        trackingSegmentView(item.element, fontScale: fontScale)
      }
    }
    .lineLimit(1)
  }

  @ViewBuilder
  private func trackingSegmentView(
    _ segment: WatchWorkoutState.TrackingDisplaySegment,
    fontScale: CGFloat
  ) -> some View {
    switch segment.kind {
    case .separator:
      trackingSegmentContent(segment, fontScale: fontScale)
        .baselineOffset(WatchLayoutMetrics.trackingSeparatorBaselineOffset * fontScale)
        .contentShape(Rectangle())
    case .value, .unit:
      trackingSegmentContent(segment, fontScale: fontScale)
        .contentShape(Rectangle())
        .gesture(trackingEditGesture(for: segment.field))
    }
  }

  private func trackingEditGesture(for field: WatchEditableTrackingField?) -> some Gesture {
    ExclusiveGesture(
      LongPressGesture(minimumDuration: 0.45),
      TapGesture()
    )
    .onEnded { value in
      switch value {
      case .first:
        handleTrackingLongPress(field)
      case .second:
        handleTrackingTap(field)
      }
    }
  }

  @ViewBuilder
  private func trackingSegmentContent(
    _ segment: WatchWorkoutState.TrackingDisplaySegment,
    fontScale: CGFloat
  ) -> some View {
    switch segment.content {
    case .text(let text):
      Text(displayText(text, for: segment))
        .font(font(for: segment.kind, scale: fontScale))
        .foregroundColor(color(for: segment))
        .lineLimit(1)
    case .timer(let endDate):
      Text(endDate, style: .timer)
        .font(font(for: segment.kind, scale: fontScale))
        .foregroundColor(color(for: segment))
        .monospacedDigit()
        .lineLimit(1)
    case .stopwatch(let startDate):
      Text(startDate, style: .timer)
        .font(font(for: segment.kind, scale: fontScale))
        .foregroundColor(color(for: segment))
        .monospacedDigit()
        .lineLimit(1)
    }
  }

  private func color(for segment: WatchWorkoutState.TrackingDisplaySegment) -> Color {
    guard segment.kind == .value else { return .white }
    guard let field = segment.field, field == selectedTrackingField else { return .white }
    return watchBrandLime
  }

  private func displayText(
    _ text: String,
    for segment: WatchWorkoutState.TrackingDisplaySegment
  ) -> String {
    guard segment.kind == .value else { return text }
    guard let field = segment.field, field == precisionTrackingField else { return text }
    guard field == .weight || field == .distance else { return text }
    guard let value = currentDisplayedTrackingValue(for: field) else { return text }
    return watchFormatMetricNumber(value, precisionFractionDigits: 2)
  }

  private var displayedEditableSetId: String? {
    if state.isResting || state.isReady {
      return state.nextSetId
    }

    if state.isPerforming {
      return state.currentSetId
    }

    return nil
  }

  private var displayedEditableSetKey: String {
    "\(state.workoutId ?? "none"):\(displayedEditableSetId ?? "none")"
  }

  private func currentDisplayedTrackingValue(for field: WatchEditableTrackingField) -> Double? {
    guard let setId = displayedEditableSetId else { return nil }
    let displayState = trackingDisplayState
    let isCurrentSet = setId == displayState.currentSetId
    let isNextSet = setId == displayState.nextSetId

    switch field {
    case .weight:
      if isCurrentSet { return displayState.weight }
      if isNextSet { return displayState.nextWeight }
    case .reps:
      if isCurrentSet, let reps = displayState.reps { return Double(reps) }
      if isNextSet, let reps = displayState.nextReps { return Double(reps) }
    case .distance:
      if isCurrentSet { return displayState.distance }
      if isNextSet { return displayState.nextDistance }
    }

    return nil
  }

  private var externalTrackingSnapshotKey: String {
    guard let setId = displayedEditableSetId else {
      return "\(displayedEditableSetKey):none"
    }

    let weight = baseTrackingValue(for: .weight, setId: setId)
    let reps = baseTrackingValue(for: .reps, setId: setId)
    let distance = baseTrackingValue(for: .distance, setId: setId)
    return [
      displayedEditableSetKey,
      formatSnapshotValue(weight),
      formatSnapshotValue(reps),
      formatSnapshotValue(distance),
    ].joined(separator: ":")
  }

  private var trackingDisplayState: WatchWorkoutState {
    guard let setId = displayedEditableSetId else { return state }

    var displayState = state
    let isCurrentSet = setId == displayState.currentSetId
    let isNextSet = setId == displayState.nextSetId

    if let value = optimisticTrackingValues[trackingValueKey(setId: setId, field: .weight)]?.value
    {
      if isCurrentSet {
        displayState.weight = value
      } else if isNextSet {
        displayState.nextWeight = value
      }
    }

    if let value = optimisticTrackingValues[trackingValueKey(setId: setId, field: .reps)]?.value {
      if isCurrentSet {
        displayState.reps = Int(value.rounded())
      } else if isNextSet {
        displayState.nextReps = Int(value.rounded())
      }
    }

    if let value = optimisticTrackingValues[trackingValueKey(setId: setId, field: .distance)]?
      .value
    {
      if isCurrentSet {
        displayState.distance = value
      } else if isNextSet {
        displayState.nextDistance = value
      }
    }

    return displayState
  }

  private func handleTrackingTap(_ field: WatchEditableTrackingField?) {
    guard let field else { return }

    session.flushPendingTrackingUpdates()
    if selectedTrackingField == field {
      clearTrackingSelection(flushPendingUpdates: false, playHaptic: true)
      return
    }

    selectedTrackingField = field
    precisionTrackingField = nil
    resetCrownTracking()
    isCrownFocused = true
    playTrackingEditHaptic()
    scheduleTrackingEditTimeout()
  }

  private func handleTrackingLongPress(_ field: WatchEditableTrackingField?) {
    guard let field else { return }

    if selectedTrackingField != field {
      session.flushPendingTrackingUpdates()
    }

    selectedTrackingField = field
    precisionTrackingField = field
    resetCrownTracking()
    isCrownFocused = true
    playTrackingEditHaptic()
    scheduleTrackingEditTimeout()
  }

  private func clearTrackingSelection(
    flushPendingUpdates: Bool = true,
    playHaptic: Bool = false
  ) {
    let hadSelection = selectedTrackingField != nil
    if flushPendingUpdates {
      session.flushPendingTrackingUpdates()
    }
    trackingEditTimeoutToken = UUID()
    selectedTrackingField = nil
    precisionTrackingField = nil
    isCrownFocused = false
    resetCrownTracking()
    if playHaptic && hadSelection {
      playTrackingEditHaptic()
    }
  }

  private func scheduleTrackingEditTimeout() {
    guard selectedTrackingField != nil else { return }

    let token = UUID()
    trackingEditTimeoutToken = token
    DispatchQueue.main.asyncAfter(deadline: .now() + trackingEditTimeoutSeconds) {
      guard selectedTrackingField != nil, trackingEditTimeoutToken == token else { return }
      clearTrackingSelection(playHaptic: true)
    }
  }

  private func playTrackingEditHaptic() {
    WKInterfaceDevice.current().play(.click)
  }

  private func resetCrownTracking() {
    lastCrownStep = 0
    crownValue = 0
  }

  private func handleCrownChange(_ newValue: Double) {
    let nextStep = Int(newValue.rounded())
    let delta = nextStep - lastCrownStep
    lastCrownStep = nextStep

    guard delta != 0 else { return }
    guard let field = selectedTrackingField else { return }
    guard let setId = displayedEditableSetId else { return }
    guard let currentValue = currentTrackingValue(for: field, setId: setId) else { return }

    let updatedValue = steppedTrackingValue(
      currentValue,
      field: field,
      delta: delta,
      precision: precisionTrackingField == field
    )

    scheduleTrackingEditTimeout()
    guard updatedValue != currentValue else { return }

    let key = trackingValueKey(setId: setId, field: field)
    optimisticTrackingValues[key] = OptimisticTrackingValue(
      value: updatedValue,
      createdAt: Date()
    )
    scheduleOptimisticTrackingReconciliation()

    session.sendTrackingUpdate(
      setId: setId,
      field: field,
      value: updatedValue,
      expectedState: state.state
    )
  }

  private func currentTrackingValue(for field: WatchEditableTrackingField, setId: String) -> Double?
  {
    if let optimisticValue = optimisticTrackingValues[trackingValueKey(setId: setId, field: field)]?
      .value
    {
      return optimisticValue
    }

    return baseTrackingValue(for: field, setId: setId)
  }

  private func baseTrackingValue(for field: WatchEditableTrackingField, setId: String) -> Double? {
    let isCurrentSet = setId == state.currentSetId
    let isNextSet = setId == state.nextSetId

    switch field {
    case .weight:
      if isCurrentSet { return state.weight }
      if isNextSet { return state.nextWeight }
    case .reps:
      if isCurrentSet, let reps = state.reps { return Double(reps) }
      if isNextSet, let reps = state.nextReps { return Double(reps) }
    case .distance:
      if isCurrentSet { return state.distance }
      if isNextSet { return state.nextDistance }
    }

    return nil
  }

  private func trackingValueKey(setId: String, field: WatchEditableTrackingField) -> String {
    "\(setId):\(field.rawValue)"
  }

  private func formatSnapshotValue(_ value: Double?) -> String {
    guard let value else { return "nil" }
    return String(value)
  }

  private func reconcileOptimisticTrackingValues() {
    guard let setId = displayedEditableSetId else {
      optimisticTrackingValues.removeAll()
      return
    }

    for field in [WatchEditableTrackingField.weight, .reps, .distance] {
      let key = trackingValueKey(setId: setId, field: field)
      guard let optimisticValue = optimisticTrackingValues[key] else { continue }
      guard let baseValue = baseTrackingValue(for: field, setId: setId) else {
        optimisticTrackingValues.removeValue(forKey: key)
        continue
      }

      if trackingValuesAreEqual(baseValue, optimisticValue.value, field: field) {
        optimisticTrackingValues.removeValue(forKey: key)
        continue
      }

      let age = Date().timeIntervalSince(optimisticValue.createdAt)
      if age >= optimisticTrackingHoldSeconds {
        optimisticTrackingValues.removeValue(forKey: key)
      }
    }
  }

  private func scheduleOptimisticTrackingReconciliation() {
    DispatchQueue.main.asyncAfter(deadline: .now() + optimisticTrackingHoldSeconds) {
      reconcileOptimisticTrackingValues()
    }
  }

  private func trackingValuesAreEqual(
    _ lhs: Double,
    _ rhs: Double,
    field: WatchEditableTrackingField
  ) -> Bool {
    switch field {
    case .reps:
      return Int(lhs.rounded()) == Int(rhs.rounded())
    case .weight, .distance:
      return abs(lhs - rhs) < 0.000_001
    }
  }

  private func steppedTrackingValue(
    _ value: Double,
    field: WatchEditableTrackingField,
    delta: Int,
    precision: Bool
  ) -> Double {
    var nextValue = value
    let direction = delta > 0 ? 1 : -1

    for _ in 0..<abs(delta) {
      nextValue = singleStepTrackingValue(
        nextValue,
        field: field,
        direction: direction,
        precision: precision
      )
    }

    return max(0, normalizedTrackingValue(nextValue, field: field))
  }

  private func singleStepTrackingValue(
    _ value: Double,
    field: WatchEditableTrackingField,
    direction: Int,
    precision: Bool
  ) -> Double {
    switch field {
    case .reps:
      return value + Double(direction)
    case .weight, .distance:
      if precision {
        return steppedDecimalValue(value, step: 0.25, direction: direction)
      }
      return steppedDecimalValue(value, step: 1, direction: direction)
    }
  }

  private func steppedDecimalValue(_ value: Double, step: Double, direction: Int) -> Double {
    let scaled = value / step
    let roundedScaled = scaled.rounded()
    let isOnStep = abs(scaled - roundedScaled) < 0.000_001

    if direction > 0 {
      return isOnStep ? value + step : ceil(scaled) * step
    }

    return isOnStep ? value - step : floor(scaled) * step
  }

  private func normalizedTrackingValue(_ value: Double, field: WatchEditableTrackingField) -> Double
  {
    switch field {
    case .reps:
      return Double(Int(value.rounded()))
    case .weight, .distance:
      return (value * 100).rounded() / 100
    }
  }

  private func font(for kind: WatchWorkoutState.TrackingSegmentKind, scale: CGFloat) -> Font {
    switch kind {
    case .value:
      return .system(
        size: WatchLayoutMetrics.trackingValueFontSize * scale,
        weight: .semibold
      )
    case .unit, .separator:
      return .system(
        size: WatchLayoutMetrics.trackingUnitFontSize * scale,
        weight: .medium
      )
    }
  }

  private var controlsSection: some View {
    VStack(spacing: 8) {
      if state.isAllSetsCompleted {
        Text(watchLocalized("workout.finish.swipe_hint"))
          .font(.system(.caption2, weight: .semibold))
          .foregroundColor(.gray)
          .multilineTextAlignment(.center)
      } else if state.isPerforming {
        circularActionButton(
          systemName: "checkmark",
          accessibilityLabel: watchLocalized("workout.a11y.complete_set")
        ) {
          onCommand("completeSet", state.currentSetId, "performing")
        }
      } else if state.isResting {
        circularActionButton(
          systemName: "stop.fill",
          accessibilityLabel: watchLocalized("workout.a11y.skip_rest")
        ) {
          onCommand("skipRest", state.restSetId, state.state)
        }
      } else if state.isReady {
        circularActionButton(
          systemName: "play.fill",
          accessibilityLabel: watchLocalized("workout.a11y.start_set")
        ) {
          onCommand("startSet", state.nextSetId, "ready")
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .bottom)
  }

  private var timerSection: some View {
    Group {
      if state.hasLiveTimeInTracking {
        Text(state.workoutStartDate, style: .timer)
          .font(.system(.body, weight: .medium))
          .foregroundColor(.white)
          .monospacedDigit()
      } else if state.isResting {
        Text(state.timerEndDate, style: .timer)
          .font(.system(.body, weight: .bold))
          .foregroundColor(watchBrandLime)
          .monospacedDigit()
      } else if state.isPerforming && state.timeOptions == "timer" {
        Text(state.timerEndDate, style: .timer)
          .font(.system(.body, weight: .bold))
          .foregroundColor(.white)
          .monospacedDigit()
      } else if state.isPerforming && state.timeOptions == "stopwatch" {
        Text(state.timerStartDate, style: .timer)
          .font(.system(.body, weight: .bold))
          .foregroundColor(.white)
          .monospacedDigit()
      } else {
        Text(state.workoutStartDate, style: .timer)
          .font(.system(.body, weight: .medium))
          .foregroundColor(.white)
          .monospacedDigit()
      }
    }
  }

  private func circularActionButton(
    systemName: String,
    accessibilityLabel: String,
    action: @escaping () -> Void
  ) -> some View {
    let iconWeight: Font.Weight = systemName == "checkmark" ? .heavy : .bold

    return Image(systemName: systemName)
      .font(.system(size: 22, weight: iconWeight))
      .foregroundColor(.black)
      .frame(width: 40, height: 40)
      .background(watchBrandLime)
      .clipShape(Circle())
      .contentShape(Circle())
      .onTapGesture {
        WKInterfaceDevice.current().play(hapticType(for: systemName))
        action()
      }
      .accessibilityAddTraits(.isButton)
      .accessibilityAction {
        WKInterfaceDevice.current().play(hapticType(for: systemName))
        action()
      }
      .accessibilityLabel(accessibilityLabel)
  }

  private func hapticType(for systemName: String) -> WKHapticType {
    switch systemName {
    case "checkmark":
      return .success
    case "play.fill":
      return .start
    case "stop.fill":
      return .stop
    default:
      return .click
    }
  }
}
