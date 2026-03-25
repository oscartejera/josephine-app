import Foundation
@preconcurrency import Supabase

// MARK: - Realtime Manager

/// Centralized Supabase Realtime channel management.
/// Subscribes to `employee_clock_records`, `planned_shifts`, and `announcements`.
@MainActor
final class RealtimeManager: ObservableObject {
    static let shared = RealtimeManager()

    // MARK: - Badge State
    @Published var hasNewShifts = false
    @Published var hasNewAnnouncements = false

    // MARK: - Callbacks (set by each view)
    var onClockChange: (() async -> Void)?
    var onShiftChange: (() async -> Void)?
    var onAnnouncementChange: (() async -> Void)?

    // MARK: - Internal
    private var channelTask: Task<Void, Never>?
    private var isConnected = false
    private var currentEmployeeId: UUID?

    private let supabase = SupabaseManager.shared

    private init() {}

    // MARK: - Connect

    /// Subscribe to all realtime channels for the given employee.
    /// Safe to call multiple times — will no-op if already connected for the same employee.
    func connect(employeeId: UUID) async {
        guard !isConnected || currentEmployeeId != employeeId else { return }
        disconnect()

        currentEmployeeId = employeeId
        isConnected = true

        let channelName = "rt-ios-\(employeeId.uuidString.prefix(8))"
        let channel = supabase.client.realtimeV2.channel(channelName)

        // 1. Clock records — filtered by employee
        let clockChanges = channel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "employee_clock_records",
            filter: "employee_id=eq.\(employeeId)"
        )

        // 2. Employee breaks — all (filtered client-side via clock_record_id)
        let breakChanges = channel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "employee_breaks"
        )

        // 3. Planned shifts — filtered by employee
        let shiftChanges = channel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "planned_shifts",
            filter: "employee_id=eq.\(employeeId)"
        )

        // 4. Announcements — all (location-wide)
        let announcementChanges = channel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "announcements"
        )

        await channel.subscribe()

        #if DEBUG
        print("📡 RealtimeManager: connected [\(channelName)]")
        #endif

        channelTask = Task { [weak self] in
            await withTaskGroup(of: Void.self) { group in
                // Clock records
                group.addTask {
                    for await _ in clockChanges {
                        guard !Task.isCancelled else { break }
                        await self?.onClockChange?()
                    }
                }

                // Breaks
                group.addTask {
                    for await _ in breakChanges {
                        guard !Task.isCancelled else { break }
                        await self?.onClockChange?()
                    }
                }

                // Shifts
                group.addTask {
                    for await _ in shiftChanges {
                        guard !Task.isCancelled else { break }
                        await MainActor.run {
                            self?.hasNewShifts = true
                        }
                        await self?.onShiftChange?()
                    }
                }

                // Announcements
                group.addTask {
                    for await _ in announcementChanges {
                        guard !Task.isCancelled else { break }
                        await MainActor.run {
                            self?.hasNewAnnouncements = true
                        }
                        await self?.onAnnouncementChange?()
                    }
                }
            }
        }
    }

    // MARK: - Disconnect

    /// Unsubscribe from all channels and clean up.
    func disconnect() {
        channelTask?.cancel()
        channelTask = nil
        isConnected = false
        currentEmployeeId = nil

        #if DEBUG
        print("📡 RealtimeManager: disconnected")
        #endif
    }

    // MARK: - Badge Helpers

    func clearShiftBadge() {
        hasNewShifts = false
    }

    func clearAnnouncementBadge() {
        hasNewAnnouncements = false
    }
}
