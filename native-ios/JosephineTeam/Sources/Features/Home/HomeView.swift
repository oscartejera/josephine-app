import SwiftUI
import Supabase

struct HomeView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @State private var todayShift: PlannedShift?
    @State private var upcomingShifts: [PlannedShift] = []
    @State private var activeClockRecord: ClockRecord?
    @State private var weekHours: Double = 0
    @State private var weekPlannedHours: Double = 0
    @State private var completedDays: Set<Int> = []   // 1=Mon...7=Sun
    @State private var announcements: [Announcement] = []
    @State private var isLoading = true
    @State private var showError = false
    @State private var errorMessage = ""

    private let supabase = SupabaseManager.shared
    private let cache = CacheManager.shared

    /// Current ISO day of week (1=Mon ... 7=Sun)
    private var currentDayOfWeek: Int {
        let weekday = Calendar.current.component(.weekday, from: Date())
        // .weekday: Sun=1 ... Sat=7  → ISO Mon=1 ... Sun=7
        return weekday == 1 ? 7 : weekday - 1
    }

    /// Formatted date string for header
    private var formattedDate: String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "es_ES")
        fmt.dateFormat = "EEEE, d MMMM"
        return fmt.string(from: Date()).capitalizedFirstLetter
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: JSpacing.xl) {
                    OfflineBanner()

                    // MARK: - Welcome Header
                    welcomeHeader

                    // MARK: - Weekly Progress Ring
                    WeeklyProgressRing(
                        worked: weekHours,
                        planned: weekPlannedHours,
                        completedDays: completedDays,
                        currentDayOfWeek: currentDayOfWeek
                    )
                    .padding(.vertical, JSpacing.sm)

                    // MARK: - Active Clock Banner
                    if let record = activeClockRecord {
                        activeClockBanner(record)
                    }

                    // MARK: - Today's Shift
                    todayShiftCard

                    // MARK: - Upcoming Shifts
                    upcomingShiftsList

                    // MARK: - News Feed
                    newsFeed
                }
                .padding(.horizontal, JSpacing.lg)
                .padding(.bottom, JSpacing.xxl)
            }
            .background(JColor.background)
            .navigationTitle("Inicio")
            .refreshable {
                await loadData()
                HapticManager.play(.success)
            }
            .task { await loadData() }
            .errorBanner(errorMessage, isPresented: $showError)
        }
    }

    // MARK: - Welcome Header
    private var welcomeHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: JSpacing.xs) {
                Text("Bienvenido, \(authVM.employee?.fullName ?? "")")
                    .font(.jTitle2)
                    .foregroundStyle(JColor.textPrimary)

                Text(formattedDate)
                    .font(.jCallout)
                    .foregroundStyle(JColor.textSecondary)
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
                        .foregroundStyle(JColor.textPrimary)
                }
                Spacer()
                Image(systemName: "clock.fill")
                    .font(.title2)
                    .foregroundStyle(JColor.accent)
            }
        }
    }

    // MARK: - Today's Shift
    private var todayShiftCard: some View {
        VStack(alignment: .leading, spacing: JSpacing.md) {
            Text("Hoy")
                .font(.jTitle3)
                .foregroundStyle(JColor.textPrimary)

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
            Text("Próximos")
                .font(.jTitle3)
                .foregroundStyle(JColor.textPrimary)

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

    // MARK: - News Feed
    private var newsFeed: some View {
        Group {
            if !announcements.isEmpty {
                VStack(alignment: .leading, spacing: JSpacing.md) {
                    Text("Noticias")
                        .font(.jTitle3)
                        .foregroundStyle(JColor.textPrimary)

                    ForEach(sortedAnnouncements) { item in
                        newsCard(item)
                    }
                }
            }
        }
    }

    private func newsCard(_ item: Announcement) -> some View {
        JCard {
            VStack(alignment: .leading, spacing: JSpacing.md) {
                // Badge row
                HStack {
                    HStack(spacing: JSpacing.xs) {
                        Image(systemName: item.announcementType.icon)
                            .font(.system(size: 12))
                        Text(item.announcementType.label)
                            .font(.jCaption)
                    }
                    .padding(.horizontal, JSpacing.sm)
                    .padding(.vertical, 4)
                    .background(
                        Capsule().fill(badgeColor(for: item.announcementType).opacity(0.15))
                    )
                    .foregroundStyle(badgeColor(for: item.announcementType))

                    if item.pinned {
                        Image(systemName: "pin.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(JColor.warning)
                    }

                    Spacer()

                    Text(relativeDate(item.createdAt))
                        .font(.jCaption2)
                        .foregroundStyle(JColor.textMuted)
                }

                // Title
                Text(item.title)
                    .font(.jBodyBold)
                    .foregroundStyle(JColor.textPrimary)

                // Body (if present)
                if let body = item.body, !body.isEmpty {
                    Text(body)
                        .font(.jCallout)
                        .foregroundStyle(JColor.textSecondary)
                        .lineLimit(3)
                }

                // Author
                if let author = item.authorName {
                    HStack(spacing: JSpacing.xs) {
                        Image(systemName: "person.circle.fill")
                            .font(.system(size: 12))
                        Text(author)
                            .font(.jCaption)
                    }
                    .foregroundStyle(JColor.textMuted)
                }
            }
        }
    }

    private var sortedAnnouncements: [Announcement] {
        announcements.sorted { a, b in
            if a.pinned != b.pinned { return a.pinned }
            return a.createdAt > b.createdAt
        }
    }

    private func badgeColor(for type: AnnouncementType) -> Color {
        switch type {
        case .info:        return JColor.info
        case .important:   return JColor.error
        case .celebration: return JColor.warning
        case .schedule:    return JColor.accent
        }
    }

    private func relativeDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = Locale(identifier: "es_ES")
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    // MARK: - Data Loading
    private func loadData() async {
        let today = DateFormatter.yyyyMMdd.string(from: Date())
        let (weekStart, weekEnd) = Date.currentWeekBounds()

        // Load announcements from cache immediately (no employee needed)
        announcements = (try? cache.announcements()) ?? []

        // Load employee-dependent data only when available
        if let emp = authVM.employee {
            // 1. Read from cache instantly
            do {
                let cachedShifts = try cache.plannedShifts(for: emp.id)
                let cachedRecords = try cache.clockRecords(for: emp.id)
                if !cachedShifts.isEmpty || !cachedRecords.isEmpty {
                    applyData(shifts: cachedShifts, records: cachedRecords, today: today, weekStart: weekStart, weekEnd: weekEnd)
                }
            } catch { /* Cache miss — will load from network */ }
        }

        isLoading = todayShift == nil && upcomingShifts.isEmpty
        defer { isLoading = false }

        // 2. Sync announcements from network (always)
        do {
            try await cache.sync(.announcements, force: true)
            announcements = (try? cache.announcements()) ?? []
        } catch { /* Announcements sync failed — keep cached */ }

        // 3. Sync employee-dependent data from network
        if let emp = authVM.employee {
            do {
                try await cache.sync(.plannedShifts, force: true)
                try await cache.sync(.clockRecords, force: true)
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
    }

    private func applyData(shifts: [PlannedShift], records: [ClockRecord], today: String, weekStart: String, weekEnd: String) {
        let published = shifts.filter { $0.status == "published" }

        // Today & upcoming shifts
        todayShift = published.first(where: { $0.shiftDate == today })
        upcomingShifts = published
            .filter { $0.shiftDate > today }
            .sorted { $0.shiftDate < $1.shiftDate }
            .prefix(5)
            .map { $0 }

        // Week's clock records
        let weekRecords = records.filter { record in
            let clockStr = DateFormatter.yyyyMMdd.string(from: record.clockIn)
            return clockStr >= weekStart && clockStr <= weekEnd
        }
        activeClockRecord = weekRecords.first(where: { $0.isActive })
        weekHours = weekRecords.compactMap { record -> Double? in
            guard let mins = record.durationMinutes else { return nil }
            return Double(mins) / 60.0
        }.reduce(0, +)

        // NEW: Week's planned hours (sum of all published shifts this week)
        let weekShifts = published.filter { $0.shiftDate >= weekStart && $0.shiftDate <= weekEnd }
        weekPlannedHours = weekShifts.reduce(0) { $0 + $1.plannedHours }

        // NEW: Completed days (days that have at least one completed clock record)
        let cal = Calendar.current
        var days = Set<Int>()
        for record in weekRecords {
            guard record.clockOut != nil else { continue }
            let weekday = cal.component(.weekday, from: record.clockIn)
            // .weekday: Sun=1 ... Sat=7 → ISO Mon=1 ... Sun=7
            let iso = weekday == 1 ? 7 : weekday - 1
            days.insert(iso)
        }
        completedDays = days
    }
}

// MARK: - String Helpers
private extension String {
    var capitalizedFirstLetter: String {
        guard let first = self.first else { return self }
        return String(first).uppercased() + self.dropFirst()
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
