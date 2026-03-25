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
    @State private var selectedShiftForSwap: PlannedShift?

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
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        if let emp = authVM.employee {
                            AvailabilityView(employeeId: emp.id)
                        }
                    } label: {
                        Image(systemName: "calendar.badge.clock")
                            .foregroundStyle(JColor.accent)
                    }
                }
            }
            .sheet(item: $selectedShiftForSwap) { shift in
                if let emp = authVM.employee {
                    SwapRequestSheet(
                        shift: shift,
                        employeeId: emp.id,
                        locationId: emp.locationId,
                        onDismiss: { selectedShiftForSwap = nil }
                    )
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
                }
            }
            .refreshable {
                await loadWeekShifts()
                HapticManager.play(.success)
            }
            .task { await loadWeekShifts() }
            .onAppear {
                RealtimeManager.shared.onShiftChange = { [self] in
                    await loadWeekShifts()
                }
                RealtimeManager.shared.clearShiftBadge()
            }
            .onDisappear {
                RealtimeManager.shared.onShiftChange = nil
            }
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
                .foregroundStyle(JColor.textPrimary)
                .contentTransition(.numericText())
                .animation(.easeInOut(duration: 0.3), value: weekRangeString)

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
                let isToday = calendar.isDateInToday(day)
                let hasShift = weekShifts.contains { $0.shiftDate == DateFormatter.yyyyMMdd.string(from: day) }

                Button {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) {
                        selectedDate = day
                    }
                } label: {
                    VStack(spacing: JSpacing.xs) {
                        Text(dayAbbrev(day))
                            .font(.jCaption2)
                            .foregroundStyle(isSelected ? .white : JColor.textMuted)
                        Text("\(calendar.component(.day, from: day))")
                            .font(.jBodyBold)
                            .foregroundStyle(isSelected ? .white : JColor.textSecondary)
                        Circle()
                            .fill(isSelected ? .white : (hasShift ? JColor.accent : .clear))
                            .frame(width: 5, height: 5)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, JSpacing.sm)
                    .background(isSelected ? JColor.accent : (isToday ? JColor.accent.opacity(0.08) : .clear))
                    .clipShape(RoundedRectangle(cornerRadius: JRadius.sm))
                    .overlay(
                        RoundedRectangle(cornerRadius: JRadius.sm)
                            .stroke(isToday && !isSelected ? JColor.accent.opacity(0.3) : .clear, lineWidth: 1)
                    )
                }
            }
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.75), value: selectedDate)
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
                .font(.jSectionHeader)
                .foregroundStyle(JColor.textPrimary)

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
                .transition(.opacity)
            } else {
                ForEach(shifts) { shift in
                    Button {
                        selectedShiftForSwap = shift
                    } label: {
                        JCard {
                            ShiftRow(shift: shift)
                        }
                    }
                    .buttonStyle(.plain)
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
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
