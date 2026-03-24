import SwiftUI
import LocalAuthentication

// MARK: - Face ID / Passcode Setup (post-auth onboarding)
struct FaceIDSetupView: View {
    @Binding var onboardingComplete: Bool
    @State private var biometricType: BiometricType = .none
    @State private var showError = false
    @State private var errorText = ""
    @State private var animateIcon = false

    enum BiometricType {
        case faceID, touchID, none
    }

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
            detectBiometricType()
            withAnimation(.spring(response: 0.6, dampingFraction: 0.7).delay(0.3)) {
                animateIcon = true
            }
        }
    }

    // MARK: - Icon
    private var iconSection: some View {
        ZStack {
            Circle()
                .fill(JColor.brandPurple.opacity(0.1))
                .frame(width: 120, height: 120)

            Image(systemName: biometricIconName)
                .font(.system(size: 48, weight: .light))
                .foregroundStyle(JColor.brandPurple)
                .scaleEffect(animateIcon ? 1.0 : 0.5)
                .opacity(animateIcon ? 1.0 : 0.0)
        }
    }

    // MARK: - Copy
    private var copySection: some View {
        VStack(spacing: 12) {
            Text(biometricTitle)
                .font(.jDisplayTitle)
                .foregroundColor(JColor.loginText)
                .multilineTextAlignment(.center)

            Text("Accede a Josephine de forma rápida y segura sin escribir tu contraseña cada vez.")
                .font(.jDisplaySubtitle)
                .foregroundColor(JColor.loginTextSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 16)
        }
    }

    // MARK: - Actions
    private var actionsSection: some View {
        VStack(spacing: 12) {
            // Primary CTA
            Button {
                authenticateWithBiometrics()
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: biometricIconName)
                        .font(.system(size: 18))
                    Text(biometricButtonLabel)
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

            // Error
            if showError {
                Text(errorText)
                    .font(.jFootnote)
                    .foregroundColor(JColor.error)
                    .multilineTextAlignment(.center)
                    .transition(.opacity)
            }
        }
    }

    // MARK: - Skip
    private var skipSection: some View {
        Button {
            skipBiometrics()
        } label: {
            Text("Ahora no")
                .font(.jDisplayButton)
                .foregroundColor(JColor.loginTextSecondary)
        }
    }

    // MARK: - Logic
    private var biometricIconName: String {
        switch biometricType {
        case .faceID: return "faceid"
        case .touchID: return "touchid"
        case .none: return "lock.shield"
        }
    }

    private var biometricTitle: String {
        switch biometricType {
        case .faceID: return "Usa Face ID para\niniciar sesión"
        case .touchID: return "Usa Touch ID para\niniciar sesión"
        case .none: return "Acceso rápido"
        }
    }

    private var biometricButtonLabel: String {
        switch biometricType {
        case .faceID: return "Activar Face ID"
        case .touchID: return "Activar Touch ID"
        case .none: return "Configurar código"
        }
    }

    private func detectBiometricType() {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            biometricType = .none
            return
        }
        switch context.biometryType {
        case .faceID: biometricType = .faceID
        case .touchID: biometricType = .touchID
        default: biometricType = .none
        }
    }

    private func authenticateWithBiometrics() {
        let context = LAContext()
        context.localizedCancelTitle = "Cancelar"

        let policy: LAPolicy = biometricType != .none
            ? .deviceOwnerAuthenticationWithBiometrics
            : .deviceOwnerAuthentication

        context.evaluatePolicy(policy, localizedReason: "Verifica tu identidad para activar el acceso rápido") { success, error in
            DispatchQueue.main.async {
                if success {
                    UserDefaults.standard.set(true, forKey: UserDefaultsKey.biometricsEnabled)
                    HapticManager.play(.success)
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                        onboardingComplete = true
                    }
                } else {
                    showError = true
                    errorText = error?.localizedDescription ?? "No se pudo verificar tu identidad."
                    HapticManager.play(.error)
                }
            }
        }
    }

    private func skipBiometrics() {
        UserDefaults.standard.set(false, forKey: UserDefaultsKey.biometricsEnabled)
        HapticManager.play(.selection)
        withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
            onboardingComplete = true
        }
    }
}

#Preview {
    FaceIDSetupView(onboardingComplete: .constant(false))
}
