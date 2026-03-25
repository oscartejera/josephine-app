import SwiftUI

// MARK: - Weekly Progress Ring (Apple Watch style)
struct WeeklyProgressRing: View {
    let worked: Double          // hours worked so far
    let planned: Double         // total planned hours for the week
    let completedDays: Set<Int> // 1=Mon ... 7=Sun
    let currentDayOfWeek: Int   // 1=Mon ... 7=Sun

    @State private var animatedProgress: Double = 0

    private var progress: Double {
        guard planned > 0 else { return 0 }
        return min(worked / planned, 1.0)
    }

    private let ringSize: CGFloat = 180
    private let lineWidth: CGFloat = 14

    private let dayLabels = ["L", "M", "X", "J", "V", "S", "D"]

    var body: some View {
        VStack(spacing: JSpacing.xl) {
            // MARK: - Ring
            ZStack {
                // Track
                Circle()
                    .stroke(
                        JColor.border.opacity(0.4),
                        style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                    )

                // Progress arc
                Circle()
                    .trim(from: 0, to: animatedProgress)
                    .stroke(
                        AngularGradient(
                            colors: [JColor.accent, JColor.accentLight, JColor.accent],
                            center: .center,
                            startAngle: .degrees(0),
                            endAngle: .degrees(360)
                        ),
                        style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))

                // Cap dot at end of arc
                if animatedProgress > 0.02 {
                    Circle()
                        .fill(JColor.accentLight)
                        .frame(width: lineWidth, height: lineWidth)
                        .offset(y: -ringSize / 2)
                        .rotationEffect(.degrees(360 * animatedProgress - 90))
                        .shadow(color: JColor.accent.opacity(0.4), radius: 4, x: 0, y: 0)
                }

                // Center text
                VStack(spacing: JSpacing.xs) {
                    Text(String(format: "%.1f", worked))
                        .font(.jHeroNumber)
                        .foregroundStyle(JColor.textPrimary)
                        .contentTransition(.numericText())

                    Text("de \(String(format: "%.0f", planned))h")
                        .font(.jCaption)
                        .foregroundStyle(JColor.textMuted)
                }
            }
            .frame(width: ringSize, height: ringSize)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(String(format: "%.1f", worked)) de \(String(format: "%.0f", planned)) horas esta semana")
            .accessibilityIdentifier("weekly_progress_ring")

            // MARK: - Day Dots
            HStack(spacing: JSpacing.lg) {
                ForEach(1...7, id: \.self) { day in
                    VStack(spacing: JSpacing.xs) {
                        dayDot(for: day)
                        Text(dayLabels[day - 1])
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(
                                day == currentDayOfWeek
                                    ? JColor.accent
                                    : JColor.textMuted
                            )
                    }
                }
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Progreso diario: \(completedDays.count) de 7 días completados")
        }
        .onAppear {
            withAnimation(.spring(response: 1.0, dampingFraction: 0.8)) {
                animatedProgress = progress
            }
        }
        .onChange(of: worked) { _, _ in
            withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                animatedProgress = progress
            }
        }
    }

    // MARK: - Day Dot
    @ViewBuilder
    private func dayDot(for day: Int) -> some View {
        let size: CGFloat = 8

        if completedDays.contains(day) {
            // Completed day — filled
            Circle()
                .fill(JColor.accent)
                .frame(width: size, height: size)
        } else if day == currentDayOfWeek {
            // Current day — ring outline
            Circle()
                .stroke(JColor.accent, lineWidth: 1.5)
                .frame(width: size, height: size)
        } else {
            // Future day — empty
            Circle()
                .fill(JColor.border.opacity(0.5))
                .frame(width: size, height: size)
        }
    }
}

// MARK: - Preview
#if DEBUG
#Preview("Progress Ring") {
    WeeklyProgressRing(
        worked: 18.5,
        planned: 32,
        completedDays: [1, 2, 3],
        currentDayOfWeek: 4
    )
    .padding()
}
#endif
