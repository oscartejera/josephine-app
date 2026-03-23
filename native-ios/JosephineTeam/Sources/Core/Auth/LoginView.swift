import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @FocusState private var focusedField: LoginField?

    enum LoginField { case email, password }

    var body: some View {
        ZStack {
            JColor.background
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: JSpacing.xxl) {
                    // MARK: - Logo
                    VStack(spacing: JSpacing.md) {
                        Image(systemName: "fork.knife.circle.fill")
                            .font(.system(size: 80))
                            .foregroundStyle(JColor.accent)

                        Text("Josephine Team")
                            .font(.jTitle1)
                            .foregroundStyle(.white)

                        Text("Portal del empleado")
                            .font(.jCallout)
                            .foregroundStyle(JColor.textSecondary)
                    }
                    .padding(.top, 80)

                    // MARK: - Form
                    VStack(spacing: JSpacing.lg) {
                        // Email
                        VStack(alignment: .leading, spacing: JSpacing.xs) {
                            Text("Email")
                                .font(.jCaption)
                                .foregroundStyle(JColor.textSecondary)

                            TextField("tu@email.com", text: $authVM.email)
                                .textFieldStyle(.plain)
                                .keyboardType(.emailAddress)
                                .textContentType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .focused($focusedField, equals: .email)
                                .padding(.horizontal, JSpacing.lg)
                                .padding(.vertical, JSpacing.md)
                                .background(JColor.surface)
                                .clipShape(RoundedRectangle(cornerRadius: JRadius.md))
                                .overlay(
                                    RoundedRectangle(cornerRadius: JRadius.md)
                                        .stroke(JColor.border, lineWidth: 1)
                                )
                                .foregroundStyle(.white)
                        }

                        // Password
                        VStack(alignment: .leading, spacing: JSpacing.xs) {
                            Text("Contraseña")
                                .font(.jCaption)
                                .foregroundStyle(JColor.textSecondary)

                            SecureField("••••••••", text: $authVM.password)
                                .textFieldStyle(.plain)
                                .textContentType(.password)
                                .focused($focusedField, equals: .password)
                                .padding(.horizontal, JSpacing.lg)
                                .padding(.vertical, JSpacing.md)
                                .background(JColor.surface)
                                .clipShape(RoundedRectangle(cornerRadius: JRadius.md))
                                .overlay(
                                    RoundedRectangle(cornerRadius: JRadius.md)
                                        .stroke(JColor.border, lineWidth: 1)
                                )
                                .foregroundStyle(.white)
                        }

                        // Error
                        if let error = authVM.errorMessage {
                            HStack(spacing: JSpacing.sm) {
                                Image(systemName: "exclamationmark.circle.fill")
                                Text(error)
                            }
                            .font(.jFootnote)
                            .foregroundStyle(JColor.error)
                        }

                        // Sign In Button
                        Button {
                            Task { await authVM.signIn() }
                        } label: {
                            Group {
                                if authVM.isLoading {
                                    ProgressView()
                                        .tint(.white)
                                } else {
                                    Text("Iniciar Sesión")
                                        .font(.jBodyBold)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, JSpacing.md)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(JColor.accent)
                        .clipShape(RoundedRectangle(cornerRadius: JRadius.md))
                        .disabled(authVM.isLoading)
                    }
                    .padding(.horizontal, JSpacing.xl)

                    Spacer(minLength: 40)
                }
            }
        }
        .onSubmit {
            switch focusedField {
            case .email:
                focusedField = .password
            case .password:
                Task { await authVM.signIn() }
            case .none:
                break
            }
        }
    }
}
