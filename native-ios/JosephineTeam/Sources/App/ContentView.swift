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

                ScheduleView()
                    .tabItem {
                        Label("Horario", systemImage: "calendar")
                    }
                    .tag(1)

                ClockView()
                    .tabItem {
                        Label("Fichaje", systemImage: "clock.fill")
                    }
                    .tag(2)

                PayView()
                    .tabItem {
                        Label("Nómina", systemImage: "banknote.fill")
                    }
                    .tag(3)

                NewsView()
                    .tabItem {
                        Label("Noticias", systemImage: "megaphone.fill")
                    }
                    .tag(4)

                ProfileView()
                    .tabItem {
                        Label("Perfil", systemImage: "person.circle.fill")
                    }
                    .tag(5)
            }
            .tint(JColor.accent)
            .onChange(of: selectedTab) { _, _ in
                HapticManager.play(.selection)
            }
        }
    }
}

