import SwiftUI

// MARK: - Forgot Password (Supabase reset)
struct ForgotPasswordView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @Environment(\.dismiss) private var dismiss
    @State var email: String
    @State private var sent = false
    @State private var isLoading = false
    @State private var errorMessage: String?
    @FocusState private var emailFocused: Bool

    var body: some View {
        NavigationStack {
            ZStack {
                JColor.loginBackground
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    Spacer().frame(height: 40)

                    if sent {
                        successContent
                    } else {
                        formContent
                    }

                    Spacer()
                }
                .padding(.horizontal, 24)
            }
            .preferredColorScheme(.light)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(JColor.loginText)
                    }
                }
            }
        }
    }

    // MARK: - Form
    private var formContent: some View {
        VStack(spacing: 24) {
            // Icon
            Image(systemName: "envelope.badge")
                .font(.system(size: 48))
                .foregroundStyle(JColor.brandPurple)
                .padding(.bottom, 8)

            VStack(spacing: 8) {
                Text("Recupera tu contraseña")
                    .font(.jDisplayHeadline)
                    .foregroundColor(JColor.loginText)

                Text("Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.")
                    .font(.jDisplaySubtitle)
                    .foregroundColor(JColor.loginTextSecondary)
                    .multilineTextAlignment(.center)
            }

            // Email field
            VStack(alignment: .leading, spacing: 6) {
                Text("Email")
                    .font(.jDisplayCaption)
                    .foregroundColor(JColor.loginTextSecondary)
                    .textCase(.uppercase)

                TextField("tu@empresa.com", text: $email)
                    .font(.jBody)
                    .foregroundColor(JColor.loginText)
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .disableAutocorrection(true)
                    .focused($emailFocused)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 14)
                    .background(
                        RoundedRectangle(cornerRadius: JRadius.md)
                            .stroke(
                                emailFocused
                                    ? JColor.loginInputFocusBorder
                                    : JColor.loginInputBorder,
                                lineWidth: emailFocused ? 2 : 1
                            )
                    )
            }

            // Error
            if let error = errorMessage {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .font(.system(size: 14))
                    Text(error)
                        .font(.jFootnote)
                }
                .foregroundColor(JColor.error)
                .frame(maxWidth: .infinity, alignment: .leading)
                .transition(.move(edge: .top).combined(with: .opacity))
            }

            // CTA
            Button {
                Task { await sendReset() }
            } label: {
                HStack(spacing: 8) {
                    if isLoading {
                        ProgressView()
                            .tint(.white)
                    }
                    Text("Enviar enlace")
                        .font(.jDisplayButton)
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(
                    RoundedRectangle(cornerRadius: JRadius.md)
                        .fill(email.isValidEmail ? JColor.brandPurple : JColor.brandPurple.opacity(0.4))
                )
            }
            .disabled(!email.isValidEmail || isLoading)
        }
        .animation(.easeOut(duration: 0.25), value: errorMessage != nil)
    }

    // MARK: - Success
    private var successContent: some View {
        VStack(spacing: 24) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 56))
                .foregroundStyle(JColor.success)
                .transition(.scale.combined(with: .opacity))

            VStack(spacing: 8) {
                Text("¡Revisa tu correo!")
                    .font(.jDisplayHeadline)
                    .foregroundColor(JColor.loginText)

                Text("Hemos enviado un enlace de recuperación a **\(email)**. Sigue las instrucciones para restablecer tu contraseña.")
                    .font(.jDisplaySubtitle)
                    .foregroundColor(JColor.loginTextSecondary)
                    .multilineTextAlignment(.center)
            }

            Button {
                dismiss()
            } label: {
                Text("Volver al inicio de sesión")
                    .font(.jDisplayButton)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(
                        RoundedRectangle(cornerRadius: JRadius.md)
                            .fill(JColor.brandPurple)
                    )
            }
        }
        .transition(.move(edge: .trailing).combined(with: .opacity))
    }

    // MARK: - Logic (uses shared String.isValidEmail extension)

    private func sendReset() async {
        guard email.isValidEmail else { return }
        isLoading = true
        errorMessage = nil
        HapticManager.play(.selection)

        do {
            try await authVM.resetPassword(email: email)
            withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
                sent = true
            }
            HapticManager.play(.success)
        } catch {
            errorMessage = "No se pudo enviar el enlace. Verifica tu email e intenta de nuevo."
            HapticManager.play(.error)
        }

        isLoading = false
    }
}

#Preview {
    ForgotPasswordView(email: "test@ejemplo.com")
        .environmentObject(AuthViewModel())
}
