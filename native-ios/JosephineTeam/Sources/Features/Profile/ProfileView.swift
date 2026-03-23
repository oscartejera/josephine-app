import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var authVM: AuthViewModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: JSpacing.xl) {
                    // MARK: - Avatar & Name
                    profileHeader

                    // MARK: - Info Cards
                    infoSection

                    // MARK: - Actions
                    actionsSection

                    // MARK: - Sign Out
                    signOutButton
                }
                .padding(.horizontal, JSpacing.lg)
                .padding(.bottom, JSpacing.xxl)
            }
            .background(JColor.background)
            .navigationTitle("Perfil")
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    // MARK: - Profile Header
    private var profileHeader: some View {
        VStack(spacing: JSpacing.md) {
            // Avatar
            ZStack {
                Circle()
                    .fill(JColor.accent.opacity(0.2))
                    .frame(width: 100, height: 100)

                Text(initials)
                    .font(.jTitle1)
                    .foregroundStyle(JColor.accent)
            }
            .padding(.top, JSpacing.xl)

            Text(authVM.employee?.fullName ?? "Empleado")
                .font(.jTitle2)
                .foregroundStyle(.white)

            if let location = authVM.locationName {
                HStack(spacing: JSpacing.xs) {
                    Image(systemName: "mappin.circle.fill")
                        .font(.jCaption)
                    Text(location)
                        .font(.jCallout)
                }
                .foregroundStyle(JColor.textSecondary)
            }
        }
    }

    // MARK: - Info Section
    private var infoSection: some View {
        VStack(spacing: JSpacing.md) {
            JCard {
                VStack(spacing: JSpacing.md) {
                    infoRow(icon: "envelope.fill", label: "Email", value: authVM.currentUser?.email ?? "—")
                    Divider().background(JColor.border)
                    infoRow(icon: "person.badge.key.fill", label: "ID Empleado", value: authVM.employee?.id.uuidString.prefix(8).uppercased() ?? "—")
                    if let cost = authVM.employee?.hourlyCost {
                        Divider().background(JColor.border)
                        infoRow(icon: "eurosign.circle.fill", label: "Coste/hora", value: String(format: "%.2f€", cost))
                    }
                }
            }
        }
    }

    private func infoRow(icon: String, label: String, value: some StringProtocol) -> some View {
        HStack(spacing: JSpacing.md) {
            Image(systemName: icon)
                .font(.jBody)
                .foregroundStyle(JColor.accent)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: JSpacing.xs) {
                Text(label)
                    .font(.jCaption)
                    .foregroundStyle(JColor.textMuted)
                Text(value)
                    .font(.jBody)
                    .foregroundStyle(.white)
            }
            Spacer()
        }
    }

    // MARK: - Actions
    private var actionsSection: some View {
        VStack(alignment: .leading, spacing: JSpacing.md) {
            Text("Ajustes")
                .font(.jTitle3)
                .foregroundStyle(.white)

            JCard {
                VStack(spacing: 0) {
                    actionRow(icon: "bell.fill", label: "Notificaciones", color: JColor.info)
                    Divider().background(JColor.border)
                    actionRow(icon: "globe", label: "Idioma", color: JColor.accent)
                    Divider().background(JColor.border)
                    actionRow(icon: "questionmark.circle.fill", label: "Ayuda", color: JColor.success)
                    Divider().background(JColor.border)
                    actionRow(icon: "doc.text.fill", label: "Política de privacidad", color: JColor.textSecondary)
                }
            }
        }
    }

    private func actionRow(icon: String, label: String, color: Color) -> some View {
        HStack(spacing: JSpacing.md) {
            Image(systemName: icon)
                .font(.jBody)
                .foregroundStyle(color)
                .frame(width: 28)

            Text(label)
                .font(.jBody)
                .foregroundStyle(.white)

            Spacer()

            Image(systemName: "chevron.right")
                .font(.jCaption)
                .foregroundStyle(JColor.textMuted)
        }
        .padding(.vertical, JSpacing.sm)
    }

    // MARK: - Sign Out
    private var signOutButton: some View {
        Button {
            Task { await authVM.signOut() }
        } label: {
            HStack {
                Image(systemName: "rectangle.portrait.and.arrow.right")
                Text("Cerrar Sesión")
            }
            .font(.jBodyBold)
            .foregroundStyle(JColor.error)
            .frame(maxWidth: .infinity)
            .padding(.vertical, JSpacing.md)
        }
        .buttonStyle(.bordered)
        .tint(JColor.error.opacity(0.2))
        .clipShape(RoundedRectangle(cornerRadius: JRadius.md))
        .padding(.top, JSpacing.lg)
    }

    // MARK: - Helpers
    private var initials: String {
        let parts = (authVM.employee?.fullName ?? "E").components(separatedBy: " ")
        let first = parts.first?.prefix(1) ?? "E"
        let last = parts.count > 1 ? parts[1].prefix(1) : ""
        return "\(first)\(last)".uppercased()
    }
}
