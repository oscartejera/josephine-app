import SwiftUI

// MARK: - JCard — Reusable card container
struct JCard<Content: View>: View {
    let content: () -> Content

    init(@ViewBuilder content: @escaping () -> Content) {
        self.content = content
    }

    var body: some View {
        content()
            .padding(JSpacing.lg)
            .background(JColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: JRadius.lg))
            .overlay(
                RoundedRectangle(cornerRadius: JRadius.lg)
                    .stroke(JColor.border, lineWidth: 1)
            )
    }
}

// MARK: - JBadge — Status badge pill
struct JBadge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.jCaption)
            .foregroundStyle(color)
            .padding(.horizontal, JSpacing.sm)
            .padding(.vertical, JSpacing.xs)
            .background(color.opacity(0.2))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(color.opacity(0.4), lineWidth: 1))
            .accessibilityLabel(text)
            .accessibilityAddTraits(.isStaticText)
    }
}

// MARK: - JStatCard — Number + label stat card
struct JStatCard: View {
    let value: String
    let label: String
    let icon: String
    let color: Color

    var body: some View {
        JCard {
            VStack(alignment: .leading, spacing: JSpacing.sm) {
                HStack {
                    Image(systemName: icon)
                        .font(.jFootnote)
                        .foregroundStyle(color)
                    Spacer()
                }
                Text(value)
                    .font(.jStatNumber)
                    .foregroundStyle(JColor.textPrimary)
                Text(label)
                    .font(.jCaption)
                    .foregroundStyle(JColor.textSecondary)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(value), \(label)")
        .accessibilityIdentifier("stat_\(label.lowercased().replacingOccurrences(of: " ", with: "_"))")
    }
}

// MARK: - JEmptyState — Placeholder for empty data
struct JEmptyState: View {
    let icon: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: JSpacing.lg) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundStyle(JColor.textMuted)
                .accessibilityHidden(true)
            Text(title)
                .font(.jTitle3)
                .foregroundStyle(JColor.textSecondary)
            Text(message)
                .font(.jCallout)
                .foregroundStyle(JColor.textMuted)
                .multilineTextAlignment(.center)
        }
        .padding(.vertical, JSpacing.xxxl)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title). \(message)")
    }
}

// MARK: - ShiftRow — Used in Home and Schedule
struct ShiftRow: View {
    let shift: PlannedShift

    var body: some View {
        HStack(spacing: JSpacing.md) {
            // Role color bar
            RoundedRectangle(cornerRadius: 2)
                .fill(JColor.forRole(shift.role))
                .frame(width: 4, height: 44)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: JSpacing.xs) {
                Text("\(shift.startTime) – \(shift.endTime)")
                    .font(.jBodyBold)
                    .foregroundStyle(JColor.textPrimary)
                Text(shift.role.capitalized)
                    .font(.jCaption)
                    .foregroundStyle(JColor.textSecondary)
            }

            Spacer()

            Text("\(shift.plannedHours, specifier: "%.1f")h")
                .font(.jSubheadline)
                .foregroundStyle(JColor.textSecondary)
        }
        .padding(.vertical, JSpacing.sm)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(shift.role.capitalized), \(shift.startTime) a \(shift.endTime), \(String(format: "%.1f", shift.plannedHours)) horas")
        .accessibilityIdentifier("shift_row_\(shift.id)")
    }
}
