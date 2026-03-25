import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @Environment(\.scenePhase) private var scenePhase
    @State private var selectedTab: AppTab = .home

    var body: some View {
        ZStack(alignment: .bottom) {
            // MARK: - Tab Content
            Group {
                switch selectedTab {
                case .home:     HomeView()
                case .schedule: ScheduleView()
                case .clock:    ClockView()
                case .pay:      PayView()
                case .profile:  ProfileView()
                }
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

