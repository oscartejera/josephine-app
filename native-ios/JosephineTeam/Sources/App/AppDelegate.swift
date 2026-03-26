import UIKit
import UserNotifications
@preconcurrency import Supabase

// MARK: - AppDelegate (Push Notifications)

/// Handles APNs token registration and remote notification delivery.
/// Connected via `@UIApplicationDelegateAdaptor` in `JosephineTeamApp`.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    // MARK: - App Launch

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Set self as notification center delegate for foreground handling
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    // MARK: - APNs Token Registration

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        #if DEBUG
        print("📲 APNs token: \(token)")
        #endif

        // Persist token locally for sign-out cleanup
        UserDefaults.standard.set(token, forKey: "apns_device_token")

        // Upsert token to Supabase
        Task {
            await upsertDeviceToken(token)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        #if DEBUG
        print("❌ APNs registration failed: \(error.localizedDescription)")
        #endif
    }

    // MARK: - Foreground Notification Display

    /// Show notification banner even when app is in foreground
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .badge, .sound])
    }

    // MARK: - Notification Tap (Deep Link)

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        PushNotificationRouter.handlePush(userInfo: userInfo)
        completionHandler()
    }

    // MARK: - Background Remote Notification (Silent Push)

    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        // Trigger cache sync on silent push
        Task {
            await CacheManager.shared.syncAll()
            completionHandler(.newData)
        }
    }

    // MARK: - Supabase Token Upsert

    private func upsertDeviceToken(_ token: String) async {
        do {
            let session = try await SupabaseManager.shared.auth.session
            let userId = session.user.id.uuidString

            // Upsert: if token already exists for this user, just update timestamp
            try await SupabaseManager.shared.client
                .from("device_tokens")
                .upsert(
                    DeviceTokenInsert(
                        userId: userId,
                        token: token,
                        platform: "ios",
                        active: true
                    ),
                    onConflict: "user_id,token"
                )
                .execute()

            #if DEBUG
            print("✅ Device token upserted to Supabase")
            #endif
        } catch {
            #if DEBUG
            print("⚠️ Failed to upsert device token: \(error.localizedDescription)")
            #endif
        }
    }

    // MARK: - Remove Token (called on sign-out)

    static func removeDeviceToken() async {
        guard let token = UserDefaults.standard.string(forKey: "apns_device_token") else { return }

        do {
            let session = try await SupabaseManager.shared.auth.session
            let userId = session.user.id.uuidString

            try await SupabaseManager.shared.client
                .from("device_tokens")
                .update(["active": false])
                .eq("user_id", value: userId)
                .eq("token", value: token)
                .execute()

            UserDefaults.standard.removeObject(forKey: "apns_device_token")

            #if DEBUG
            print("🗑️ Device token deactivated")
            #endif
        } catch {
            #if DEBUG
            print("⚠️ Failed to deactivate device token: \(error.localizedDescription)")
            #endif
        }
    }
}

// MARK: - DTO

private struct DeviceTokenInsert: Encodable {
    let userId: String
    let token: String
    let platform: String
    let active: Bool

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case token
        case platform
        case active
    }
}
