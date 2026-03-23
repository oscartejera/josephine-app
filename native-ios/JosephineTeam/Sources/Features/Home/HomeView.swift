import SwiftUI
import Supabase

struct HomeView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @State private var todayShift: PlannedShift?
    @State private var upcomingShifts: [PlannedShift] = []
    @State private var activeClockRecord: ClockRecord?
    @State private var weekHours: Double = 0
    @State private var isLoading = true
    @State private var showError = false
    @State private var errorMessage = ""

    private let supabase = SupabaseManager.shared
    private let cache = CacheManager.shared

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: JSpacing.lg) {
                    OfflineBanner()

                    // MARK: - Welcome Header
                    welcomeHeader

                    // MARK: - Active Clock Banner
                    if let record = activeClockRecord {
                        activeClockBanner(record)
                    }

                    // MARK: - Stats Row
                    statsRow

                    // MARK: - Today's Shift
                    todayShiftCard

                    // MARK: - Upcoming Shifts
                    upcomingShiftsList
                }
                .padding(.horizontal, JSpacing.lg)
                .padding(.bottom, JSpacing.xxl)
            }
            .background(JColor.background)
            .navigationTitle("Inicio")
            .toolbarColorScheme(.dark, for: .navigationBar)
            .refreshable { await loadData() }
            .task { await loadData() }
            .errorBanner(errorMessage, isPresented: $showError)
        }
    }

    // MARK: - Welcome Header
    private var welcomeHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: JSpacing.xs) {
                Text("Hola, \(authVM.employee?.fullName.components(separatedBy: " ").first ?? "")!")
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
            Spacer()
            // Clock status indicator
            Circle()
                .fill(activeClockRecord != nil ? JColor.success : JColor.textMuted)
                .frame(width: 10, height: 10)
        }
        .padding(.top, JSpacing.md)
    }

    // MARK: - Active Clock Banner
    private func activeClockBanner(_ record: ClockRecord) -> some View {
        JCard {
            HStack {
                VStack(alignment: .leading, spacing: JSpacing.xs) {
                    HStack(spacing: JSpacing.sm) {
                        Circle()
                            .fill(JColor.success)
                            .frame(width: 8, height: 8)
                        Text("FICHAJE ACTIVO")
                            .font(.jCaption)
                            .foregroundStyle(JColor.success)
                    }
                    Text("Desde \(record.clockIn.formatted(date: .omitted, time: .shortened))")
                        .font(.jBody)
                        .foregroundStyle(.white)
                }
                Spacer()
                Image(systemName: "clock.fill")
                    .font(.title2)
                    .foregroundStyle(JColor.accent)
            }
        }
    }

    // MARK: - Stats Row
    private var statsRow: some View {
        HStack(spacing: JSpacing.md) {
            JStatCard(
                value: String(format: "%.1f", weekHours),
                label: "Horas esta semana",
                icon: "clock",
                color: JColor.accent
            )
            JStatCard(
                value: "\(upcomingShifts.count)",
                label: "Próximos turnos",
                icon: "calendar",
                color: JColor.info
            )
        }
    }

    // MARK: - Today's Shift
    private var todayShiftCard: some View {
        VStack(alignment: .leading, spacing: JSpacing.md) {
            Text("Turno de hoy")
                .font(.jTitle3)
                .foregroundStyle(.white)

            if let shift = todayShift {
                JCard {
                    ShiftRow(shift: shift)
                }
            } else {
                JCard {
                    HStack {
                        Image(systemName: "moon.zzz.fill")
                            .foregroundStyle(JColor.textMuted)
                        Text("No tienes turno hoy")
                            .font(.jCallout)
                            .foregroundStyle(JColor.textSecondary)
                        Spacer()
                    }
                }
            }
        }
    }

    // MARK: - Upcoming Shifts
    private var upcomingShiftsList: some View {
        VStack(alignment: .leading, spacing: JSpacing.md) {
            Text("Próximos turnos")
                .font(.jTitle3)
                .foregroundStyle(.white)

            if upcomingShifts.isEmpty {
                JCard {
                    HStack {
                        Image(systemName: "calendar.badge.minus")
                            .foregroundStyle(JColor.textMuted)
                        Text("No hay turnos programados")
                            .font(.jCallout)
                            .foregroundStyle(JColor.textSecondary)
                        Spacer()
                    }
                }
            } else {
                JCard {
                    LazyVStack(spacing: 0) {
                        ForEach(upcomingShifts) { shift in
                            ShiftRow(shift: shift)
                            if shift.id != upcomingShifts.last?.id {
                                Divider()
                                    .background(JColor.border)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Data Loading
    private func loadData() async {
        guard let emp = authVM.employee else { return }

        let today = DateFormatter.yyyyMMdd.string(from: Date())
        let (weekStart, weekEnd) = Date.currentWeekBounds()

        // 1. Read from cache instantly
        do {
            let cachedShifts = try cache.plannedShifts(for: emp.id)
            let cachedRecords = try cache.clockRecords(for: emp.id)
            if !cachedShifts.isEmpty || !cachedRecords.isEmpty {
                applyData(shifts: cachedShifts, records: cachedRecords, today: today, weekStart: weekStart, weekEnd: weekEnd)
            }
        } catch { /* Cache miss — will load from network */ }

        isLoading = todayShift == nil && upcomingShifts.isEmpty
        defer { isLoading = false }

        // 2. Sync from network in background
        do {
            try await cache.sync(.plannedShifts, force: true)
            try await cache.sync(.clockRecords, force: true)
            // 3. Re-read from cache after sync
            let freshShifts = try cache.plannedShifts(for: emp.id)
            let freshRecords = try cache.clockRecords(for: emp.id)
            applyData(shifts: freshShifts, records: freshRecords, today: today, weekStart: weekStart, weekEnd: weekEnd)
        } catch {
            if todayShift == nil && upcomingShifts.isEmpty {
                errorMessage = "No se pudieron cargar los datos. Tira hacia abajo para reintentar."
                showError = true
                HapticManager.play(.error)
            }
        }
    }

    private func applyData(shifts: [PlannedShift], records: [ClockRecord], today: String, weekStart: String, weekEnd: String) {
        let published = shifts.filter { $0.status == "published" }
        todayShift = published.first(where: { $0.shiftDate == today })
        upcomingShifts = published
            .filter { $0.shiftDate > today }
            .sorted { $0.shiftDate < $1.shiftDate }
            .prefix(5)
            .map { $0 }

        let weekRecords = records.filter { record in
            let clockStr = DateFormatter.yyyyMMdd.string(from: record.clockIn)
            return clockStr >= weekStart && clockStr <= weekEnd
        }
        activeClockRecord = weekRecords.first(where: { $0.isActive })
        weekHours = weekRecords.compactMap { record -> Double? in
            guard let mins = record.durationMinutes else { return nil }
            return Double(mins) / 60.0
        }.reduce(0, +)
    }
}

// MARK: - Date Helpers
extension DateFormatter {
    static let yyyyMMdd: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()
}

extension Date {
    static func currentWeekBounds() -> (String, String) {
        let cal = Calendar.current
        let today = Date()
        let weekday = cal.component(.weekday, from: today)
        let daysFromMonday = (weekday + 5) % 7  // Monday = 0
        let monday = cal.date(byAdding: .day, value: -daysFromMonday, to: today)!
        let sunday = cal.date(byAdding: .day, value: 6, to: monday)!
        let fmt = DateFormatter.yyyyMMdd
        return (fmt.string(from: monday), fmt.string(from: sunday))
    }
}
