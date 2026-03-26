import SwiftUI

// MARK: - UpcomingShiftCard — Horizontal scrollable card for upcoming shifts
struct UpcomingShiftCard: View {
    let shift: PlannedShift
    let isFirst: Bool

    /// Relative day label (MÑN, PAS. MÑN, or weekday abbreviation)
    private var relativeDay: String {
        guard let shiftDate = shift.date else { return "—" }
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        let days = cal.dateComponents([.day], from: today, to: cal.startOfDay(for: shiftDate)).day ?? 0

        switch days {
        case 1:  return "MÑN"
        case 2:  return "PAS. MÑN"
        default:
            let fmt = DateFormatter()
            fmt.locale = Locale(identifier: "es_ES")
            fmt.dateFormat = "EEE"
            return fmt.string(from: shiftDate).uppercased()
        }
    }

    /// Formatted short date (e.g. "27 mar")
    private var shortDate: String {
        guard let shiftDate = shift.date else { return shift.shiftDate }
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "es_ES")
        fmt.dateFormat = "d MMM"
        return fmt.string(from: shiftDate)
    }

    private let cardWidth: CGFloat = 120

    var body: some View {
        VStack(alignment: .leading, spacing: JSpacing.sm) {
            // Top color bar
            RoundedRectangle(cornerRadius: 2)
                .fill(JColor.forRole(shift.safeRole))
                .frame(height: 4)
                .accessibilityHidden(true)

            // Day label
            Text(relativeDay)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(isFirst ? JColor.accent : JColor.textPrimary)

            // Date
            Text(shortDate)
                .font(.jCaption)
                .foregroundStyle(JColor.textSecondary)

            Spacer().frame(height: JSpacing.xs)

            // Time range (vertical)
            VStack(alignment: .leading, spacing: 2) {
                Text(shift.safeStartTime)
                    .font(.system(size: 18, weight: .semibold, design: .rounded))
                    .foregroundStyle(JColor.textPrimary)

                Image(systemName: "arrow.down")
                    .font(.system(size: 10))
                    .foregroundStyle(JColor.textMuted)

                Text(shift.safeEndTime)
                    .font(.system(size: 18, weight: .semibold, design: .rounded))
                    .foregroundStyle(JColor.textPrimary)
            }

            Spacer()

            // Role + hours
            VStack(alignment: .leading, spacing: 2) {
                Text(shift.safeRole.capitalized)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(JColor.textSecondary)
                    .lineLimit(1)

                Text("\(shift.plannedHours, specifier: "%.0f")h")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(JColor.forRole(shift.safeRole))
            }
        }
        .padding(JSpacing.md)
        .frame(width: cardWidth, height: 190)
        .background(
            RoundedRectangle(cornerRadius: JRadius.md)
                .fill(isFirst ? JColor.accent.opacity(0.06) : JColor.card)
        )
        .overlay(
            RoundedRectangle(cornerRadius: JRadius.md)
                .stroke(isFirst ? JColor.accent.opacity(0.2) : JColor.border, lineWidth: 1)
        )
        .shadow(color: .black.opacity(isFirst ? 0.08 : 0.04), radius: isFirst ? 8 : 4, x: 0, y: 2)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(relativeDay), \(shortDate). \(shift.safeRole.capitalized), \(shift.safeStartTime) a \(shift.safeEndTime), \(String(format: "%.0f", shift.plannedHours)) horas")
        .accessibilityIdentifier("upcoming_card_\(shift.id)")
    }
}
