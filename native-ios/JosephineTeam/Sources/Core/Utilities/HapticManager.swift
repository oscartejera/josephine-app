import UIKit

// MARK: - Haptic Manager

/// Centralized haptic feedback — consistent tactile responses across the app.
/// Usage: `HapticManager.shared.play(.clockIn)`
enum HapticManager {

    enum FeedbackType {
        case clockIn        // Heavy impact — satisfying "punch in"
        case clockOut       // Medium impact
        case breakStart     // Light impact
        case breakEnd       // Light impact
        case success        // Notification: success
        case error          // Notification: error
        case warning        // Notification: warning
        case selection      // Subtle selection tap
    }

    @MainActor
    static func play(_ type: FeedbackType) {
        switch type {
        case .clockIn:
            let gen = UIImpactFeedbackGenerator(style: .heavy)
            gen.prepare()
            gen.impactOccurred(intensity: 1.0)

        case .clockOut:
            let gen = UIImpactFeedbackGenerator(style: .medium)
            gen.prepare()
            gen.impactOccurred(intensity: 0.8)

        case .breakStart, .breakEnd:
            let gen = UIImpactFeedbackGenerator(style: .light)
            gen.prepare()
            gen.impactOccurred()

        case .success:
            let gen = UINotificationFeedbackGenerator()
            gen.prepare()
            gen.notificationOccurred(.success)

        case .error:
            let gen = UINotificationFeedbackGenerator()
            gen.prepare()
            gen.notificationOccurred(.error)

        case .warning:
            let gen = UINotificationFeedbackGenerator()
            gen.prepare()
            gen.notificationOccurred(.warning)

        case .selection:
            let gen = UISelectionFeedbackGenerator()
            gen.prepare()
            gen.selectionChanged()
        }
    }
}
