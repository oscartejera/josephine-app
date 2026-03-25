import Foundation
import SwiftUI

// MARK: - Push Notification Router

/// Routes push notification payloads to the correct app tab via deep linking.
/// The payload is expected to have a `type` field in `userInfo` that maps to an `AppTab`.
enum PushNotificationRouter {

    /// Notification name used for deep-link routing from push taps
    static let deepLinkNotification = Notification.Name("pushDeepLink")

    /// Known push notification types (matches `type` field in push payload)
    enum PushType: String {
        case newShift = "new_shift"
        case newAnnouncement = "new_announcement"
        case shiftSwap = "shift_swap"
        case breakReminder = "break_reminder"
        case payslipReady = "payslip_ready"
    }

    // MARK: - Handle Incoming Push

    /// Parse the push `userInfo` and post a deep-link notification.
    /// Called from `AppDelegate.didReceive(_:)`.
    static func handlePush(userInfo: [AnyHashable: Any]) {
        // Try extracting `type` from nested `data` dict (APNs custom payload)
        // or from top-level userInfo
        let typeString: String? = {
            if let data = userInfo["data"] as? [String: Any],
               let t = data["type"] as? String {
                return t
            }
            return userInfo["type"] as? String
        }()

        guard let typeString,
              let pushType = PushType(rawValue: typeString) else {
            #if DEBUG
            print("📬 Push received but no recognized type: \(userInfo)")
            #endif
            return
        }

        let targetTab = tab(for: pushType)

        #if DEBUG
        print("📬 Push deep link → \(pushType.rawValue) → tab: \(targetTab)")
        #endif

        // Post notification on main thread for UI update
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: deepLinkNotification,
                object: nil,
                userInfo: ["tab": targetTab.rawValue]  // Int — matches AppTab: Int
            )
        }
    }

    // MARK: - Type → Tab Mapping

    private static func tab(for type: PushType) -> AppTab {
        switch type {
        case .newShift, .shiftSwap:
            return .schedule
        case .newAnnouncement:
            return .profile   // News is inside Profile tab
        case .breakReminder:
            return .clock
        case .payslipReady:
            return .pay
        }
    }
}
