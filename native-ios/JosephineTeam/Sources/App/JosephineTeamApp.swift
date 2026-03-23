import SwiftUI
import SwiftData

@main
struct JosephineTeamApp: App {
    @StateObject private var authVM = AuthViewModel()

    var body: some Scene {
        WindowGroup {
            Group {
                if authVM.isLoading {
                    SplashView()
                } else if authVM.isAuthenticated {
                    ContentView()
                        .environmentObject(authVM)
                } else {
                    LoginView()
                        .environmentObject(authVM)
                }
            }
            .tint(JColor.accent)
            .preferredColorScheme(.dark)
            .task {
                // Background sync on launch — non-blocking
                await CacheManager.shared.syncAll()
            }
        }
        .modelContainer(CacheManager.shared.container)
    }
}


// MARK: - Splash Screen
struct SplashView: View {
    var body: some View {
        ZStack {
            JColor.background
                .ignoresSafeArea()
            VStack(spacing: 16) {
                Image(systemName: "fork.knife.circle.fill")
                    .font(.system(size: 72))
                    .foregroundStyle(JColor.accent)
                Text("Josephine Team")
                    .font(.title2.weight(.bold))
                    .foregroundStyle(.white)
                ProgressView()
                    .tint(JColor.accent)
            }
        }
    }
}
