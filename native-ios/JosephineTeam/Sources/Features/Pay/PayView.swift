import SwiftUI
import Supabase

struct PayView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @State private var monthRecords: [ClockRecord] = []
    @State private var tips: [TipDistribution] = []
    @State private var selectedMonth = Date()
    @State private var isLoading = false
    @State private var showError = false
    @State private var errorMessage = ""

    private let supabase = SupabaseManager.shared
    private let cache = CacheManager.shared

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: JSpacing.lg) {
                    OfflineBanner()

                    // MARK: - Month Selector
                    monthSelector

                    // MARK: - Summary Cards
                    summaryCards

                    // MARK: - Breakdown
                    breakdownSection

                    // MARK: - Daily Detail
                    dailyDetail
                }
                .padding(.horizontal, JSpacing.lg)
                .padding(.bottom, JSpacing.xxl)
            }
            .background(JColor.background)
            .navigationTitle("Nómina")
            .refreshable {
                await loadPayData()
                HapticManager.play(.success)
            }
            .task { await loadPayData() }
            .errorBanner(errorMessage, isPresented: $showError)
        }
    }

    // MARK: - Month Selector
    private var monthSelector: some View {
        HStack {
            Button { changeMonth(-1) } label: {
                Image(systemName: "chevron.left")
                    .foregroundStyle(JColor.textSecondary)
            }
            Spacer()
            Text(monthString)
                .font(.jSubheadline)
                .foregroundStyle(JColor.textPrimary)
            Spacer()
            Button { changeMonth(1) } label: {
                Image(systemName: "chevron.right")
                    .foregroundStyle(JColor.textSecondary)
            }
        }
        .padding(.top, JSpacing.md)
    }

    // MARK: - Summary Cards
    private var summaryCards: some View {
        let totalHours = totalWorkedHours
        let hourlyRate = authVM.employee?.hourlyCost ?? 0
        let grossPay = totalHours * hourlyRate
        let totalTips = tips.reduce(0) { $0 + $1.shareAmount }

        return VStack(spacing: JSpacing.md) {
            HStack(spacing: JSpacing.md) {
                JStatCard(
                    value: String(format: "%.1f", totalHours),
                    label: "Horas trabajadas",
                    icon: "clock",
                    color: JColor.accent
                )
                JStatCard(
                    value: String(format: "%.0f€", grossPay),
                    label: "Salario bruto",
                    icon: "eurosign.circle",
                    color: JColor.success
                )
            }
            HStack(spacing: JSpacing.md) {
                JStatCard(
                    value: "\(workedDays)",
                    label: "Días trabajados",
                    icon: "calendar",
                    color: JColor.info
                )
                JStatCard(
                    value: String(format: "%.0f€", totalTips),
                    label: "Propinas",
                    icon: "hand.thumbsup.fill",
                    color: JColor.warning
                )
            }
        }
    }

    // MARK: - Breakdown
    private var breakdownSection: some View {
        let hourlyRate = authVM.employee?.hourlyCost ?? 0
        let grossPay = totalWorkedHours * hourlyRate
        let totalTips = tips.reduce(0) { $0 + $1.shareAmount }

        return VStack(alignment: .leading, spacing: JSpacing.md) {
            Text("Desglose")
                .font(.jTitle3)
                .foregroundStyle(JColor.textPrimary)

            JCard {
                VStack(spacing: JSpacing.md) {
                    breakdownRow(label: "Horas totales", value: String(format: "%.1fh", totalWorkedHours))
                    Divider().background(JColor.border)
                    breakdownRow(label: "Coste/hora", value: String(format: "%.2f€", hourlyRate))
                    Divider().background(JColor.border)
                    breakdownRow(label: "Salario bruto", value: String(format: "%.2f€", grossPay))
                    Divider().background(JColor.border)
                    breakdownRow(label: "Propinas", value: String(format: "%.2f€", totalTips))
                    Divider().background(JColor.border)
                    breakdownRow(label: "Total estimado", value: String(format: "%.2f€", grossPay + totalTips), highlight: true)
                }
            }
        }
    }

    private func breakdownRow(label: String, value: String, highlight: Bool = false) -> some View {
        HStack {
            Text(label)
                .font(highlight ? .jBodyBold : .jCallout)
                .foregroundStyle(highlight ? .white : JColor.textSecondary)
            Spacer()
            Text(value)
                .font(highlight ? .jBodyBold : .jBody)
                .foregroundStyle(highlight ? JColor.accent : .white)
        }
    }

    // MARK: - Daily Detail
    private var dailyDetail: some View {
        VStack(alignment: .leading, spacing: JSpacing.md) {
            Text("Detalle diario")
                .font(.jTitle3)
                .foregroundStyle(JColor.textPrimary)

            if monthRecords.isEmpty {
                JCard {
                    HStack {
                        Image(systemName: "doc.text.magnifyingglass")
                            .foregroundStyle(JColor.textMuted)
                        Text("Sin registros este mes")
                            .font(.jCallout)
                            .foregroundStyle(JColor.textSecondary)
                        Spacer()
                    }
                }
            } else {
                JCard {
                    LazyVStack(spacing: 0) {
                        ForEach(monthRecords) { record in
                            HStack {
                                VStack(alignment: .leading, spacing: JSpacing.xs) {
                                    Text(record.clockIn.formatted(date: .abbreviated, time: .omitted))
                                        .font(.jBody)
                                        .foregroundStyle(JColor.textPrimary)
                                    Text("\(record.clockIn.formatted(date: .omitted, time: .shortened)) – \(record.clockOut?.formatted(date: .omitted, time: .shortened) ?? "...")")
                                        .font(.jCaption)
                                        .foregroundStyle(JColor.textSecondary)
                                }
                                Spacer()
                                Text(record.durationString)
                                    .font(.jSubheadline)
                                    .foregroundStyle(record.isActive ? JColor.success : JColor.textSecondary)
                            }
                            .padding(.vertical, JSpacing.sm)

                            if record.id != monthRecords.last?.id {
                                Divider().background(JColor.border)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Computed
    private var totalWorkedHours: Double {
        monthRecords
            .compactMap(\.durationMinutes)
            .reduce(0) { $0 + Double($1) } / 60.0
    }

    private var workedDays: Int {
        let cal = Calendar.current
        let dates = Set(monthRecords.map { cal.startOfDay(for: $0.clockIn) })
        return dates.count
    }

    // MARK: - Helpers
    private var monthString: String {
        let fmt = DateFormatter()
        fmt.dateFormat = "MMMM yyyy"
        fmt.locale = Locale(identifier: "es_ES")
        return fmt.string(from: selectedMonth).capitalized
    }

    private func changeMonth(_ delta: Int) {
        if let newDate = Calendar.current.date(byAdding: .month, value: delta, to: selectedMonth) {
            selectedMonth = newDate
            Task { await loadPayData() }
        }
    }

    // MARK: - Data Loading
    private func loadPayData() async {
        guard let emp = authVM.employee else { return }

        let cal = Calendar.current
        let comps = cal.dateComponents([.year, .month], from: selectedMonth)
        guard let monthStart = cal.date(from: comps),
              let monthEnd = cal.date(byAdding: DateComponents(month: 1, second: -1), to: monthStart) else { return }

        // 1. Read from cache instantly
        do {
            let cachedRecords = try cache.clockRecords(for: emp.id)
            let cachedTips = try cache.tipDistributions(for: emp.id)
            let filtered = cachedRecords.filter { $0.clockIn >= monthStart && $0.clockIn <= monthEnd }
                .sorted { $0.clockIn < $1.clockIn }
            if !filtered.isEmpty || !cachedTips.isEmpty {
                monthRecords = filtered
                tips = cachedTips
            }
        } catch { /* Cache miss */ }

        isLoading = monthRecords.isEmpty
        defer { isLoading = false }

        // 2. Sync from network in background
        do {
            try await cache.sync(.clockRecords, force: true)
            try await cache.sync(.tipDistributions, force: true)
            // 3. Re-read from cache after sync
            let freshRecords = try cache.clockRecords(for: emp.id)
            monthRecords = freshRecords.filter { $0.clockIn >= monthStart && $0.clockIn <= monthEnd }
                .sorted { $0.clockIn < $1.clockIn }
            tips = try cache.tipDistributions(for: emp.id)
        } catch {
            if monthRecords.isEmpty {
                errorMessage = "No se pudo cargar la nómina. Tira hacia abajo para reintentar."
                showError = true
                HapticManager.play(.error)
            }
        }
    }
}
