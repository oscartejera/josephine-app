import SwiftUI
import SwiftData

@main
struct JosephineTeamApp: App {
    @StateObject private var authVM = AuthViewModel()
    @State private var showSplash = true

    var body: some Scene {
        WindowGroup {
            ZStack {
                Group {
                    if authVM.isAuthenticated {
                        ContentView()
                            .environmentObject(authVM)
                    } else {
                        LoginView()
                            .environmentObject(authVM)
                    }
                }
                .opacity(showSplash ? 0 : 1)

                if showSplash {
                    SplashView()
                        .transition(.opacity)
                        .zIndex(1)
                }
            }
            .tint(JColor.accent)
            .preferredColorScheme(.dark)
            .task {
                await CacheManager.shared.syncAll()
            }
            .onChange(of: authVM.isLoading) { _, isLoading in
                guard !isLoading else { return }
                // Auth finished — dismiss splash with animation
                withAnimation(.easeOut(duration: 0.5)) {
                    showSplash = false
                }
            }
        }
        .modelContainer(CacheManager.shared.container)
    }
}


// MARK: - Splash Screen (animated, TheFork-style)
struct SplashView: View {
    @State private var logoScale: CGFloat = 0.3
    @State private var logoOpacity: Double = 0
    @State private var textOpacity: Double = 0
    @State private var textOffset: CGFloat = 20

    // Josephine brand purple
    private let gradientTop = JColor.brandPurple
    private let gradientBottom = JColor.brandPurpleDark

    var body: some View {
        ZStack {
            // Full-screen purple gradient
            LinearGradient(
                colors: [gradientTop, gradientBottom],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 24) {
                // Chef hat logo — matches pwa-icon.svg
                Image(systemName: "chef.hat.fill")
                    .font(.system(size: 80, weight: .medium))
                    .foregroundStyle(.white)
                    .scaleEffect(logoScale)
                    .opacity(logoOpacity)

                // Brand name
                Text("josephine")
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .opacity(textOpacity)
                    .offset(y: textOffset)
            }
        }
        .onAppear {
            // Logo bounces in
            withAnimation(.spring(response: 0.6, dampingFraction: 0.6, blendDuration: 0)) {
                logoScale = 1.0
                logoOpacity = 1.0
            }
            // Text fades in after logo
            withAnimation(.easeOut(duration: 0.5).delay(0.4)) {
                textOpacity = 1.0
                textOffset = 0
            }
        }
    }
}
