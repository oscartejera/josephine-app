import SwiftUI

// MARK: - Tab Definition
enum AppTab: Int, CaseIterable {
    case home = 0
    case schedule
    case clock
    case pay
    case profile

    var title: String {
        switch self {
        case .home:     return "Inicio"
        case .schedule: return "Horario"
        case .clock:    return "Fichaje"
        case .pay:      return "Nómina"
        case .profile:  return "Perfil"
        }
    }

    var icon: String {
        switch self {
        case .home:     return "house.fill"
        case .schedule: return "calendar"
        case .clock:    return "clock.fill"
        case .pay:      return "banknote.fill"
        case .profile:  return "person.circle.fill"
        }
    }

    var accessibilityId: String {
        switch self {
        case .home:     return "tab_home"
        case .schedule: return "tab_schedule"
        case .clock:    return "tab_clock"
        case .pay:      return "tab_pay"
        case .profile:  return "tab_profile"
        }
    }
}

// MARK: - Floating Tab Bar
struct FloatingTabBar: View {
    @Binding var selectedTab: AppTab

    var body: some View {
        HStack(spacing: 0) {
            ForEach(AppTab.allCases, id: \.rawValue) { tab in
                tabButton(tab)
            }
        }
        .padding(.horizontal, JSpacing.sm)
        .padding(.vertical, JSpacing.sm)
        .background(
            Capsule()
                .fill(.ultraThickMaterial)
                .shadow(color: .black.opacity(0.25), radius: 16, x: 0, y: 4)
        )
        .padding(.horizontal, JSpacing.lg)
        .padding(.bottom, JSpacing.xs)
    }

    @ViewBuilder
    private func tabButton(_ tab: AppTab) -> some View {
        let isSelected = selectedTab == tab

        Button {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
                selectedTab = tab
            }
            HapticManager.play(.selection)
        } label: {
            VStack(spacing: JSpacing.xs) {
                ZStack {
                    // Background pill for selected state
                    if isSelected {
                        Capsule()
                            .fill(JColor.accent.opacity(0.15))
                            .frame(width: 44, height: 30)
                            .transition(.scale.combined(with: .opacity))
                    }

                    Image(systemName: tab.icon)
                        .font(.system(size: 18, weight: isSelected ? .semibold : .regular))
                        .symbolEffect(.bounce, value: isSelected)
                }
                .frame(height: 30)

                Text(tab.title)
                    .font(.system(size: 10, weight: isSelected ? .semibold : .regular))
                    .lineLimit(1)
            }
            .foregroundStyle(isSelected ? JColor.accent : JColor.textMuted)
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(tab.accessibilityId)
        .accessibilityLabel(tab.title)
    }
}
