import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authVM: AuthViewModel

    var body: some View {
        TabView {
            Tab("Inicio", systemImage: "house.fill") {
                HomeView()
            }

            Tab("Horario", systemImage: "calendar") {
                ScheduleView()
            }

            Tab("Fichaje", systemImage: "clock.fill") {
                ClockView()
            }

            Tab("Nómina", systemImage: "banknote.fill") {
                PayView()
            }

            Tab("Noticias", systemImage: "megaphone.fill") {
                NewsView()
            }

            Tab("Perfil", systemImage: "person.circle.fill") {
                ProfileView()
            }
        }
        .tint(JColor.accent)
    }
}
