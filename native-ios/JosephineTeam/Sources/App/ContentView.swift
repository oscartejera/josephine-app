import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @State private var selectedTab = 0

    var body: some View {
        VStack(spacing: 0) {
            OfflineBanner()

            TabView(selection: $selectedTab) {
                HomeView()
                    .tabItem {
                        Label("Inicio", systemImage: "house.fill")
                    }
                    .tag(0)
                    .accessibilityIdentifier("tab_home")

                ScheduleView()
                    .tabItem {
                        Label("Horario", systemImage: "calendar")
                    }
                    .tag(1)
                    .accessibilityIdentifier("tab_schedule")

                ClockView()
                    .tabItem {
                        Label("Fichaje", systemImage: "clock.fill")
                    }
                    .tag(2)
                    .accessibilityIdentifier("tab_clock")

                PayView()
                    .tabItem {
                        Label("Nómina", systemImage: "banknote.fill")
                    }
                    .tag(3)
                    .accessibilityIdentifier("tab_pay")

                NewsView()
                    .tabItem {
                        Label("Noticias", systemImage: "megaphone.fill")
                    }
                    .tag(4)
                    .accessibilityIdentifier("tab_news")

                ProfileView()
                    .tabItem {
                        Label("Perfil", systemImage: "person.circle.fill")
                    }
                    .tag(5)
                    .accessibilityIdentifier("tab_profile")
            }
            .tint(JColor.accent)
            .onChange(of: selectedTab) { _, _ in
                HapticManager.play(.selection)
            }
        }
    }
}

