import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @Environment(\.scenePhase) private var scenePhase
    @State private var selectedTab: AppTab = .home

    var body: some View {
        ZStack(alignment: .bottom) {
            // MARK: - Tab Content
            // ZStack keeps all views alive so @State (timers, selections, data)
            // survives tab switches — equivalent to UITabBarController behavior.
            ZStack {
                HomeView()
                    .opacity(selectedTab == .home ? 1 : 0)
                    .allowsHitTesting(selectedTab == .home)
                ScheduleView()
                    .opacity(selectedTab == .schedule ? 1 : 0)
                    .allowsHitTesting(selectedTab == .schedule)
                ClockView()
                    .opacity(selectedTab == .clock ? 1 : 0)
                    .allowsHitTesting(selectedTab == .clock)
                PayView()
                    .opacity(selectedTab == .pay ? 1 : 0)
                    .allowsHitTesting(selectedTab == .pay)
                ProfileView()
                    .opacity(selectedTab == .profile ? 1 : 0)
                    .allowsHitTesting(selectedTab == .profile)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            // Extra bottom padding so content doesn't hide behind the tab bar
            .safeAreaInset(edge: .bottom) {
                Color.clear.frame(height: 72)
            }

            // MARK: - Floating Tab Bar
            FloatingTabBar(selectedTab: $selectedTab)
        }
        .background(JColor.background)
        // MARK: - Push Deep Link
        .onReceive(NotificationCenter.default.publisher(for: PushNotificationRouter.deepLinkNotification)) { notification in
            if let tabRaw = notification.userInfo?["tab"] as? Int,
               let tab = AppTab(rawValue: tabRaw) {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                    selectedTab = tab
                }
            }
        }
        // MARK: - Realtime Lifecycle
        .task {
            if let emp = authVM.employee {
                await RealtimeManager.shared.connect(employeeId: emp.id)
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            switch newPhase {
            case .active:
                if let emp = authVM.employee {
                    Task {
                        await RealtimeManager.shared.connect(employeeId: emp.id)
                    }
                }
            case .background:
                RealtimeManager.shared.disconnect()
            default:
                break
            }
        }
    }
}

