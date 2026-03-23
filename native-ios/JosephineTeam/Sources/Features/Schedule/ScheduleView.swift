import SwiftUI
import Supabase

struct ScheduleView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @State private var selectedDate = Date()
    @State private var shifts: [PlannedShift] = []
    @State private var weekShifts: [PlannedShift] = []
    @State private var isLoading = false
    @State private var showError = false
    @State private var errorMessage = ""

    private let supabase = SupabaseManager.shared
    private let cache = CacheManager.shared
    private let calendar = Calendar.current

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: JSpacing.lg) {
                    OfflineBanner()

                    // MARK: - Week Selector
                    weekSelector

                    // MARK: - Day Pills
                    dayPills

                    // MARK: - Week Summary
                    weekSummary

                    // MARK: - Selected Day Shifts
                    selectedDayShifts
                }
                .padding(.horizontal, JSpacing.lg)
                .padding(.bottom, JSpacing.xxl)
            }
            .background(JColor.background)
            .navigationTitle("Horario")
            .toolbarColorScheme(.dark, for: .navigationBar)
            .refreshable { await loadWeekShifts() }
            .task { await loadWeekShifts() }
            .onChange(of: selectedDate) { _, _ in
                filterShiftsForSelectedDay()
            }
            .errorBanner(errorMessage, isPresented: $showError)
        }
    }

    // MARK: - Week Selector
    private var weekSelector: some View {
        HStack {
            Button { changeWeek(-1) } label: {
                Image(systemName: "chevron.left")
                    .foregroundStyle(JColor.textSecondary)
            }

            Spacer()

            Text(weekRangeString)
                .font(.jSubheadline)
                .foregroundStyle(.white)

            Spacer()

            Button { changeWeek(1) } label: {
                Image(systemName: "chevron.right")
                    .foregroundStyle(JColor.textSecondary)
            }
        }
        .padding(.top, JSpacing.md)
    }

    // MARK: - Day Pills
    private var dayPills: some View {
        HStack(spacing: JSpacing.sm) {
            ForEach(weekDays, id: \.self) { day in
                let isSelected = calendar.isDate(day, inSameDayAs: selectedDate)
                let hasShift = weekShifts.contains { $0.shiftDate == DateFormatter.yyyyMMdd.string(from: day) }

                Button { selectedDate = day } label: {
                    VStack(spacing: JSpacing.xs) {
                        Text(dayAbbrev(day))
                            .font(.jCaption2)
                            .foregroundStyle(isSelected ? .white : JColor.textMuted)
                        Text("\(calendar.component(.day, from: day))")
                            .font(.jBodyBold)
                            .foregroundStyle(isSelected ? .white : JColor.textSecondary)
                        Circle()
                            .fill(hasShift ? JColor.accent : .clear)
                            .frame(width: 5, height: 5)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, JSpacing.sm)
                    .background(isSelected ? JColor.accent.opacity(0.2) : .clear)
                    .clipShape(RoundedRectangle(cornerRadius: JRadius.sm))
                    .overlay(
                        RoundedRectangle(cornerRadius: JRadius.sm)
                            .stroke(isSelected ? JColor.accent : .clear, lineWidth: 1)
                    )
                }
            }
        }
    }

    // MARK: - Week Summary
    private var weekSummary: some View {
        let totalHours = weekShifts.reduce(0) { $0 + $1.plannedHours }
        let totalDays = Set(weekShifts.map(\.shiftDate)).count

        return HStack(spacing: JSpacing.md) {
            JStatCard(
                value: String(format: "%.1f", totalHours),
                label: "Horas",
                icon: "clock",
                color: JColor.accent
            )
            JStatCard(
                value: "\(totalDays)",
                label: "Días",
                icon: "calendar",
                color: JColor.info
            )
        }
    }

    // MARK: - Selected Day Shifts
    private var selectedDayShifts: some View {
        VStack(alignment: .leading, spacing: JSpacing.md) {
            Text(selectedDate.formatted(date: .complete, time: .omitted).capitalized)
                .font(.jTitle3)
                .foregroundStyle(.white)

            if shifts.isEmpty {
                JCard {
                    HStack {
                        Image(systemName: "moon.zzz.fill")
                            .foregroundStyle(JColor.textMuted)
                        Text("Día libre")
                            .font(.jCallout)
                            .foregroundStyle(JColor.textSecondary)
                        Spacer()
                    }
                }
            } else {
                ForEach(shifts) { shift in
                    JCard {
                        ShiftRow(shift: shift)
                    }
                }
            }
        }
    }

    // MARK: - Helpers
    private var weekDays: [Date] {
        let weekday = calendar.component(.weekday, from: selectedDate)
        let daysFromMonday = (weekday + 5) % 7
        let monday = calendar.date(byAdding: .day, value: -daysFromMonday, to: selectedDate)!
        return (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: monday) }
    }

    private var weekRangeString: String {
        guard let first = weekDays.first, let last = weekDays.last else { return "" }
        let fmt = DateFormatter()
        fmt.dateFormat = "d MMM"
        fmt.locale = Locale(identifier: "es_ES")
        return "\(fmt.string(from: first)) – \(fmt.string(from: last))"
    }

    private func dayAbbrev(_ date: Date) -> String {
        let fmt = DateFormatter()
        fmt.dateFormat = "EEE"
        fmt.locale = Locale(identifier: "es_ES")
        return fmt.string(from: date).prefix(3).uppercased()
    }

    private func changeWeek(_ delta: Int) {
        if let newDate = calendar.date(byAdding: .weekOfYear, value: delta, to: selectedDate) {
            selectedDate = newDate
            Task { await loadWeekShifts() }
        }
    }

    private func filterShiftsForSelectedDay() {
        let dateStr = DateFormatter.yyyyMMdd.string(from: selectedDate)
        shifts = weekShifts.filter { $0.shiftDate == dateStr }
    }

    // MARK: - Data Loading
    private func loadWeekShifts() async {
        guard let emp = authVM.employee else { return }

        let days = weekDays
        guard let first = days.first, let last = days.last else { return }
        let startStr = DateFormatter.yyyyMMdd.string(from: first)
        let endStr = DateFormatter.yyyyMMdd.string(from: last)

        // 1. Read from cache instantly
        do {
            let cached = try cache.plannedShifts(for: emp.id)
            let filtered = cached.filter { $0.status == "published" && $0.shiftDate >= startStr && $0.shiftDate <= endStr }
            if !filtered.isEmpty {
                weekShifts = filtered.sorted { $0.shiftDate < $1.shiftDate }
                filterShiftsForSelectedDay()
            }
        } catch { /* Cache miss */ }

        isLoading = weekShifts.isEmpty
        defer { isLoading = false }

        // 2. Sync from network in background
        do {
            try await cache.sync(.plannedShifts, force: true)
            // 3. Re-read from cache after sync
            let fresh = try cache.plannedShifts(for: emp.id)
            weekShifts = fresh.filter { $0.status == "published" && $0.shiftDate >= startStr && $0.shiftDate <= endStr }
                .sorted { $0.shiftDate < $1.shiftDate }
            filterShiftsForSelectedDay()
        } catch {
            if weekShifts.isEmpty {
                errorMessage = "No se pudo cargar el horario. Tira hacia abajo para reintentar."
                showError = true
                HapticManager.play(.error)
            }
        }
    }
}
