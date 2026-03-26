import SwiftUI
@preconcurrency import Supabase

// MARK: - Availability View

/// Full-screen view showing 7-day weekly availability grid.
/// Employee can toggle status and set time ranges per day.
struct AvailabilityView: View {
    let employeeId: UUID

    @State private var rows: [EditableAvailability] = Self.defaultRows()
    @State private var originalRows: [EditableAvailability] = Self.defaultRows()
    @State private var isLoading = true
    @State private var isSaving = false
    @State private var showError = false
    @State private var errorMessage = ""
    @State private var showSaved = false

    private let supabase = SupabaseManager.shared.client
    private let cache = CacheManager.shared

    private var hasChanges: Bool { rows != originalRows }

    var body: some View {
        ScrollView {
            VStack(spacing: JSpacing.lg) {
                // MARK: - Legend
                legend

                // MARK: - Grid
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 200)
                } else {
                    dayGrid
                }

                // MARK: - Save Button
                saveButton
            }
            .padding(.horizontal, JSpacing.lg)
            .padding(.bottom, JSpacing.xxl)
        }
        .background(JColor.background)
        .navigationTitle("Disponibilidad")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadAvailability() }
        .errorBanner(errorMessage, isPresented: $showError)
    }

    // MARK: - Legend

    private var legend: some View {
        JCard {
            HStack(spacing: JSpacing.lg) {
                legendItem(color: JColor.success, label: "Disponible")
                legendItem(color: JColor.error, label: "No disponible")
                legendItem(color: JColor.warning, label: "Prefiero libre")
            }
        }
    }

    private func legendItem(color: Color, label: String) -> some View {
        HStack(spacing: JSpacing.xs) {
            Circle()
                .fill(color)
                .frame(width: 10, height: 10)
            Text(label)
                .font(.jCaption)
                .foregroundStyle(JColor.textSecondary)
        }
    }

    // MARK: - Day Grid

    private var dayGrid: some View {
        VStack(spacing: JSpacing.sm) {
            ForEach($rows) { $row in
                dayRow(row: $row)
            }
        }
    }

    private func dayRow(row: Binding<EditableAvailability>) -> some View {
        JCard {
            VStack(spacing: JSpacing.md) {
                // Day name + status badge
                HStack {
                    Text(row.wrappedValue.dayName)
                        .font(.jBodyBold)
                        .foregroundStyle(JColor.textPrimary)

                    Spacer()

                    statusBadge(for: row.wrappedValue.status)
                }

                // Status picker
                HStack(spacing: JSpacing.sm) {
                    statusButton("Disponible", target: .available, current: row.status)
                    statusButton("No disp.", target: .unavailable, current: row.status)
                    statusButton("Pref. libre", target: .preferredOff, current: row.status)
                }

                // Time pickers (hidden if unavailable)
                if row.wrappedValue.status != .unavailable {
                    HStack(spacing: JSpacing.md) {
                        VStack(alignment: .leading, spacing: JSpacing.xs) {
                            Text("Desde")
                                .font(.jCaption)
                                .foregroundStyle(JColor.textMuted)
                            timePicker(selection: row.startTime)
                        }

                        Image(systemName: "arrow.right")
                            .foregroundStyle(JColor.textMuted)
                            .padding(.top, JSpacing.md)

                        VStack(alignment: .leading, spacing: JSpacing.xs) {
                            Text("Hasta")
                                .font(.jCaption)
                                .foregroundStyle(JColor.textMuted)
                            timePicker(selection: row.endTime)
                        }
                    }
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(row.wrappedValue.dayName), \(row.wrappedValue.status.label)")
    }

    private func statusButton(_ label: String, target: AvailabilityStatusOption,
                               current: Binding<AvailabilityStatusOption>) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) { current.wrappedValue = target }
        } label: {
            Text(label)
                .font(.jCaption2)
                .padding(.horizontal, JSpacing.sm)
                .padding(.vertical, JSpacing.xs)
                .background(current.wrappedValue == target ? target.color.opacity(0.15) : JColor.surface)
                .foregroundStyle(current.wrappedValue == target ? target.color : JColor.textMuted)
                .clipShape(RoundedRectangle(cornerRadius: JRadius.sm))
                .overlay(
                    RoundedRectangle(cornerRadius: JRadius.sm)
                        .stroke(current.wrappedValue == target ? target.color.opacity(0.4) : JColor.border, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    private func timePicker(selection: Binding<String>) -> some View {
        Picker("", selection: selection) {
            ForEach(Self.timeOptions, id: \.self) { time in
                Text(time).tag(time)
            }
        }
        .pickerStyle(.menu)
        .font(.jCallout)
        .tint(JColor.accent)
    }

    private func statusBadge(for status: AvailabilityStatusOption) -> some View {
        HStack(spacing: JSpacing.xs) {
            Image(systemName: status.icon)
                .font(.caption2)
            Text(status.label)
                .font(.jCaption2)
        }
        .foregroundStyle(status.color)
    }

    // MARK: - Save Button

    private var saveButton: some View {
        VStack(spacing: JSpacing.md) {
            if showSaved {
                HStack(spacing: JSpacing.sm) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(JColor.success)
                    Text("Cambios guardados")
                        .font(.jCallout)
                        .foregroundStyle(JColor.success)
                }
                .transition(.opacity.combined(with: .scale))
            }

            if hasChanges {
                JBadge(text: "Cambios sin guardar", color: JColor.warning)
            }

            Button {
                Task { await saveAvailability() }
            } label: {
                HStack(spacing: JSpacing.sm) {
                    if isSaving {
                        ProgressView()
                            .tint(.white)
                    }
                    Text(isSaving ? "Guardando…" : "Guardar Cambios")
                        .font(.jBodyBold)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, JSpacing.md)
                .background(hasChanges ? JColor.accent : JColor.textMuted.opacity(0.3))
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: JRadius.md))
            }
            .disabled(!hasChanges || isSaving)
        }
    }

    // MARK: - Data Loading

    private func loadAvailability() async {
        // 1. Read from cache instantly
        do {
            let cached = try cache.availability(for: employeeId)
            if !cached.isEmpty {
                applyRows(from: cached)
            }
        } catch { /* Cache miss */ }

        isLoading = false

        // 2. Sync from network
        do {
            try await cache.sync(.availability, force: true)
            let fresh = try cache.availability(for: employeeId)
            if !fresh.isEmpty {
                applyRows(from: fresh)
            }
        } catch {
            if rows == Self.defaultRows() {
                errorMessage = "No se pudo cargar la disponibilidad."
                showError = true
            }
        }
    }

    private func applyRows(from cached: [AvailabilityRow]) {
        var updated = Self.defaultRows()
        for row in cached {
            guard row.dayIndex >= 0, row.dayIndex < 7 else { continue }
            updated[row.dayIndex].status = AvailabilityStatusOption(rawValue: row.status) ?? .available
            updated[row.dayIndex].startTime = row.startTime ?? "09:00"
            updated[row.dayIndex].endTime = row.endTime ?? "22:00"
        }
        rows = updated
        originalRows = updated
    }

    // MARK: - Save

    private func saveAvailability() async {
        isSaving = true
        defer { isSaving = false }

        let dtos: [AvailabilityUpsert] = rows.map { row in
            AvailabilityUpsert(
                employeeId: employeeId,
                dayIndex: row.dayIndex,
                status: row.status.rawValue,
                startTime: row.status == .unavailable ? "00:00" : row.startTime,
                endTime: row.status == .unavailable ? "00:00" : row.endTime,
                note: nil
            )
        }

        do {
            try await supabase
                .from("employee_availability")
                .upsert(dtos)
                .execute()

            try? await cache.sync(.availability, force: true)

            originalRows = rows
            HapticManager.play(.success)

            withAnimation(.spring(response: 0.4)) {
                showSaved = true
            }

            try? await Task.sleep(for: .seconds(2))
            withAnimation { showSaved = false }

        } catch {
            errorMessage = "No se pudieron guardar los cambios."
            showError = true
            HapticManager.play(.error)
        }
    }

    // MARK: - Static Helpers

    private static let dayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

    private static let timeOptions: [String] = (6...23).map { String(format: "%02d:00", $0) }

    static func defaultRows() -> [EditableAvailability] {
        dayNames.enumerated().map { index, name in
            EditableAvailability(dayIndex: index, dayName: name)
        }
    }
}

// MARK: - Editable Row Model

struct EditableAvailability: Identifiable, Equatable {
    let dayIndex: Int
    let dayName: String
    var status: AvailabilityStatusOption = .available
    var startTime: String = "09:00"
    var endTime: String = "22:00"

    var id: Int { dayIndex }
}

// MARK: - Availability Status

enum AvailabilityStatusOption: String, CaseIterable, Sendable {
    case available
    case unavailable
    case preferredOff = "preferred_off"

    var label: String {
        switch self {
        case .available:    return "Disponible"
        case .unavailable:  return "No disponible"
        case .preferredOff: return "Pref. libre"
        }
    }

    var icon: String {
        switch self {
        case .available:    return "checkmark.circle.fill"
        case .unavailable:  return "xmark.circle.fill"
        case .preferredOff: return "moon.fill"
        }
    }

    var color: Color {
        switch self {
        case .available:    return JColor.success
        case .unavailable:  return JColor.error
        case .preferredOff: return JColor.warning
        }
    }
}
