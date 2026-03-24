import SwiftUI
import UserNotifications

// MARK: - Notification Permission (post-auth onboarding)
struct NotificationPermissionView: View {
    var onComplete: () -> Void
    @State private var animateIcon = false
    @State private var permissionGranted: Bool?

    var body: some View {
        ZStack {
            JColor.loginBackground
                .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // ─── Icon ───
                iconSection
                    .padding(.bottom, 40)

                // ─── Copy ───
                copySection
                    .padding(.bottom, 48)

                // ─── Actions ───
                actionsSection

                Spacer()

                // ─── Skip ───
                skipSection
                    .padding(.bottom, 32)
            }
            .padding(.horizontal, 24)
        }
        .preferredColorScheme(.light)
        .onAppear {
            withAnimation(.spring(response: 0.6, dampingFraction: 0.7).delay(0.3)) {
                animateIcon = true
            }
        }
    }

    // MARK: - Icon
    private var iconSection: some View {
        ZStack {
            Circle()
                .fill(JColor.accent.opacity(0.1))
                .frame(width: 120, height: 120)

            Image(systemName: "bell.badge.fill")
                .font(.system(size: 48, weight: .light))
                .foregroundStyle(JColor.accent)
                .scaleEffect(animateIcon ? 1.0 : 0.5)
                .opacity(animateIcon ? 1.0 : 0.0)
        }
    }

    // MARK: - Copy
    private var copySection: some View {
        VStack(spacing: 12) {
            Text("No te pierdas nada")
                .font(.jDisplayTitle)
                .foregroundColor(JColor.loginText)
                .multilineTextAlignment(.center)

            Text("Recibe avisos de nuevos turnos, cambios de horario y mensajes importantes de tu equipo.")
                .font(.jDisplaySubtitle)
                .foregroundColor(JColor.loginTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 16)
        }
    }

    // MARK: - Actions
    private var actionsSection: some View {
        VStack(spacing: 12) {
            Button {
                requestNotificationPermission()
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "bell.badge")
                        .font(.system(size: 18))
                    Text("Activar notificaciones")
                        .font(.jDisplayButton)
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(
                    RoundedRectangle(cornerRadius: JRadius.md)
                        .fill(JColor.brandPurple)
                )
            }
        }
    }

    // MARK: - Skip
    private var skipSection: some View {
        Button {
            HapticManager.play(.selection)
            withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                onComplete()
            }
        } label: {
            Text("Ahora no")
                .font(.jDisplayButton)
                .foregroundColor(JColor.loginTextSecondary)
        }
    }

    // MARK: - Logic
    private func requestNotificationPermission() {
        HapticManager.play(.selection)

        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            DispatchQueue.main.async {
                permissionGranted = granted
                if granted {
                    UIApplication.shared.registerForRemoteNotifications()
                    HapticManager.play(.success)
                }
                // Always proceed after permission dialog
                withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                    onComplete()
                }
            }
        }
    }
}

#Preview {
    NotificationPermissionView(onComplete: {})
}
