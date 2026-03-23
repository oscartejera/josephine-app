import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authVM: AuthViewModel

    var body: some View {
        VStack(spacing: 0) {
            OfflineBanner()

            TabView {
                HomeView()
                    .tabItem {
                        Label("Inicio", systemImage: "house.fill")
                    }

                ScheduleView()
                    .tabItem {
                        Label("Horario", systemImage: "calendar")
                    }

                ClockView()
                    .tabItem {
                        Label("Fichaje", systemImage: "clock.fill")
                    }

                PayView()
                    .tabItem {
                        Label("Nómina", systemImage: "banknote.fill")
                    }

                NewsView()
                    .tabItem {
                        Label("Noticias", systemImage: "megaphone.fill")
                    }

                ProfileView()
                    .tabItem {
                        Label("Perfil", systemImage: "person.circle.fill")
                    }
            }
            .tint(JColor.accent)
        }
    }
}

