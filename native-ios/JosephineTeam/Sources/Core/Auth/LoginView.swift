import SwiftUI

// MARK: - Multi-Step Login (Remote-style)
struct LoginView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @State private var step: LoginStep = .email
    @State private var email = ""
    @State private var password = ""
    @State private var showPassword = false
    @State private var emailFieldFocused = true
    @State private var passwordFieldFocused = false
    @State private var showForgotPassword = false
    @FocusState private var focusedField: LoginField?

    enum LoginStep {
        case email, password
    }

    enum LoginField: Hashable {
        case email, password
    }

    var body: some View {
        ZStack {
            JColor.loginBackground
                .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer().frame(height: 60)

                // ─── Logo ───
                logoSection
                    .padding(.bottom, 40)

                // ─── Title ───
                titleSection
                    .padding(.bottom, 32)

                // ─── Form ───
                formSection

                Spacer()

                // ─── Footer ───
                footerSection
                    .padding(.bottom, 16)
            }
            .padding(.horizontal, 24)
        }
        .preferredColorScheme(.light)
        .sheet(isPresented: $showForgotPassword) {
            ForgotPasswordView(email: email)
                .environmentObject(authVM)
        }
        .onAppear {
            focusedField = .email
        }
    }

    // MARK: - Logo
    private var logoSection: some View {
        HStack(spacing: 10) {
            Image(systemName: "fork.knife.circle.fill")
                .font(.system(size: 36))
                .foregroundStyle(JColor.brandPurple)

            Text("Josephine")
                .font(.jDisplayTitle)
                .foregroundColor(JColor.loginText)
        }
    }

    // MARK: - Title
    private var titleSection: some View {
        VStack(spacing: 8) {
            Text(step == .email ? "Bienvenido a Josephine" : "Introduce tu contraseña")
                .font(.jDisplayHeadline)
                .foregroundColor(JColor.loginText)
                .multilineTextAlignment(.center)
                .id("title-\(step)")
                .transition(.asymmetric(
                    insertion: .move(edge: .trailing).combined(with: .opacity),
                    removal: .move(edge: .leading).combined(with: .opacity)
                ))

            Text(step == .email
                 ? "Introduce tu email para continuar."
                 : "Usa tu contraseña para iniciar sesión.")
                .font(.jDisplaySubtitle)
                .foregroundColor(JColor.loginTextSecondary)
                .multilineTextAlignment(.center)
                .id("subtitle-\(step)")
                .transition(.asymmetric(
                    insertion: .move(edge: .trailing).combined(with: .opacity),
                    removal: .move(edge: .leading).combined(with: .opacity)
                ))
        }
        .animation(.spring(response: 0.45, dampingFraction: 0.85), value: step)
    }

    // MARK: - Form
    private var formSection: some View {
        VStack(spacing: 16) {
            // Email field
            VStack(alignment: .leading, spacing: 6) {
                Text("Email")
                    .font(.jDisplayCaption)
                    .foregroundColor(JColor.loginTextSecondary)
                    .textCase(.uppercase)

                if step == .email {
                    TextField("tu@empresa.com", text: $email)
                        .font(.jBody)
                        .foregroundColor(JColor.loginText)
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .disableAutocorrection(true)
                        .focused($focusedField, equals: .email)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 14)
                        .background(
                            RoundedRectangle(cornerRadius: JRadius.md)
                                .stroke(
                                    focusedField == .email
                                        ? JColor.loginInputFocusBorder
                                        : JColor.loginInputBorder,
                                    lineWidth: focusedField == .email ? 2 : 1
                                )
                        )
                } else {
                    // Read-only email with edit button
                    HStack {
                        Text(email)
                            .font(.jBody)
                            .foregroundColor(JColor.loginText)
                        Spacer()
                        Button {
                            withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                                step = .email
                                authVM.errorMessage = nil
                            }
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                                focusedField = .email
                            }
                        } label: {
                            Image(systemName: "pencil")
                                .font(.system(size: 16, weight: .medium))
                                .foregroundColor(JColor.brandPurple)
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 14)
                    .background(
                        RoundedRectangle(cornerRadius: JRadius.md)
                            .fill(Color(hex: 0xF3F4F6))
                    )
                    .transition(.opacity)
                }
            }

            // Password field (Step 2)
            if step == .password {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Contraseña")
                        .font(.jDisplayCaption)
                        .foregroundColor(JColor.loginTextSecondary)
                        .textCase(.uppercase)

                    HStack(spacing: 0) {
                        Group {
                            if showPassword {
                                TextField("••••••••", text: $password)
                            } else {
                                SecureField("••••••••", text: $password)
                            }
                        }
                        .font(.jBody)
                        .foregroundColor(JColor.loginText)
                        .textContentType(.password)
                        .focused($focusedField, equals: .password)

                        Button {
                            showPassword.toggle()
                            HapticManager.play(.selection)
                        } label: {
                            Image(systemName: showPassword ? "eye.slash" : "eye")
                                .font(.system(size: 16, weight: .medium))
                                .foregroundColor(JColor.loginTextSecondary)
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 14)
                    .background(
                        RoundedRectangle(cornerRadius: JRadius.md)
                            .stroke(
                                focusedField == .password
                                    ? JColor.loginInputFocusBorder
                                    : JColor.loginInputBorder,
                                lineWidth: focusedField == .password ? 2 : 1
                            )
                    )

                    // Forgot password
                    HStack {
                        Spacer()
                        Button {
                            showForgotPassword = true
                        } label: {
                            Text("¿Olvidaste tu contraseña?")
                                .font(.jDisplayCaption)
                                .foregroundColor(JColor.brandPurple)
                        }
                    }
                    .padding(.top, 4)
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            // Error message
            if let error = authVM.errorMessage {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .font(.system(size: 14))
                    Text(error)
                        .font(.jFootnote)
                }
                .foregroundColor(JColor.error)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: JRadius.sm)
                        .fill(JColor.error.opacity(0.08))
                )
                .transition(.move(edge: .top).combined(with: .opacity))
            }

            // CTA button
            Button {
                handleContinue()
            } label: {
                HStack(spacing: 8) {
                    if authVM.isLoading {
                        ProgressView()
                            .tint(.white)
                    }
                    Text("Continuar")
                        .font(.jDisplayButton)
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(
                    RoundedRectangle(cornerRadius: JRadius.md)
                        .fill(ctaEnabled ? JColor.brandPurple : JColor.brandPurple.opacity(0.4))
                )
            }
            .disabled(!ctaEnabled || authVM.isLoading)
            .padding(.top, 8)
        }
        .animation(.spring(response: 0.4, dampingFraction: 0.85), value: step)
        .animation(.easeOut(duration: 0.25), value: authVM.errorMessage != nil)
    }

    // MARK: - Footer
    private var footerSection: some View {
        Text("Al continuar, aceptas los **Términos de Uso** y la **Política de Privacidad** de Josephine.")
            .font(.jCaption2)
            .foregroundColor(JColor.loginTextSecondary)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 16)
    }

    // MARK: - Logic
    private var ctaEnabled: Bool {
        switch step {
        case .email:
            return email.isValidEmail
        case .password:
            return !password.isEmpty && password.count >= 6
        }
    }



    private func handleContinue() {
        HapticManager.play(.selection)
        authVM.errorMessage = nil

        switch step {
        case .email:
            withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                step = .password
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                focusedField = .password
            }

        case .password:
            Task {
                await authVM.signIn(email: email, password: password)
            }
        }
    }
}

#Preview {
    LoginView()
        .environmentObject(AuthViewModel())
}
