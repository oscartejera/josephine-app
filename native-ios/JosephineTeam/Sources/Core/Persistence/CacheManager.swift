import Foundation
import SwiftData
import Supabase

// MARK: - Cache Manager

/// Cache-first sync engine backed by SwiftData.
///
/// **Strategy**: Views always read from the local cache (instant, offline-safe).
/// Network fetches update the cache in the background with TTL-based staleness.
///
/// Usage:
/// ```swift
/// let employees = try await CacheManager.shared.employees()        // cached
/// try await CacheManager.shared.sync(.employees)                   // force refresh
/// ```
@MainActor
@Observable
final class CacheManager {
    static let shared = CacheManager()

    let container: ModelContainer
    private let ttl: TimeInterval

    private init() {
        let schema = Schema([
            CachedEmployee.self,
            CachedLocation.self,
            CachedClockRecord.self,
            CachedPlannedShift.self,
            CachedAnnouncement.self,
            CachedTipDistribution.self,
            CachedUserProfile.self
        ])

        let config = ModelConfiguration(
            "JosephineCache",
            schema: schema,
            isStoredInMemoryOnly: false
        )

        do {
            container = try ModelContainer(for: schema, configurations: [config])
        } catch {
            fatalError("❌ Failed to create SwiftData container: \(error)")
        }

        ttl = AppEnvironment.current.cacheTTLSeconds
    }

    // MARK: - Table Enum

    enum Table: String, CaseIterable {
        case employees
        case locations
        case clockRecords = "employee_clock_records"
        case plannedShifts = "planned_shifts"
        case announcements
        case tipDistributions = "tip_distributions"
    }

    // MARK: - Public API: Read from Cache

    func employees() throws -> [Employee] {
        let context = container.mainContext
        let cached = try context.fetch(FetchDescriptor<CachedEmployee>())
        return cached.map { $0.toModel() }
    }

    func locations() throws -> [Location] {
        let context = container.mainContext
        let cached = try context.fetch(FetchDescriptor<CachedLocation>())
        return cached.map { $0.toModel() }
    }

    func clockRecords(for employeeId: UUID) throws -> [ClockRecord] {
        let context = container.mainContext
        var descriptor = FetchDescriptor<CachedClockRecord>(
            predicate: #Predicate { $0.employeeId == employeeId },
            sortBy: [SortDescriptor(\.clockIn, order: .reverse)]
        )
        return try context.fetch(descriptor).map { $0.toModel() }
    }

    func plannedShifts(for employeeId: UUID) throws -> [PlannedShift] {
        let context = container.mainContext
        let descriptor = FetchDescriptor<CachedPlannedShift>(
            predicate: #Predicate { $0.employeeId == employeeId },
            sortBy: [SortDescriptor(\.shiftDate, order: .reverse)]
        )
        return try context.fetch(descriptor).map { $0.toModel() }
    }

    func announcements() throws -> [Announcement] {
        let context = container.mainContext
        let cached = try context.fetch(FetchDescriptor<CachedAnnouncement>())
        return cached.map { $0.toModel() }
    }

    func tipDistributions(for employeeId: UUID) throws -> [TipDistribution] {
        let context = container.mainContext
        let descriptor = FetchDescriptor<CachedTipDistribution>(
            predicate: #Predicate { $0.employeeId == employeeId }
        )
        return try context.fetch(descriptor).map { $0.toModel() }
    }

    // MARK: - Public API: Sync from Network

    /// Fetches fresh data from Supabase and upserts into SwiftData.
    /// Skips if data is still fresh (within TTL) unless `force` is true.
    func sync(_ table: Table, force: Bool = false) async throws {
        guard NetworkMonitor.shared.isConnected else {
            #if DEBUG
            print("📡 Offline — skipping sync for \(table.rawValue)")
            #endif
            return
        }

        if !force && isFresh(table) {
            #if DEBUG
            print("✅ Cache fresh for \(table.rawValue) — skipping")
            #endif
            return
        }

        let db = SupabaseManager.shared.client

        switch table {
        case .employees:
            let items: [Employee] = try await db.from("employees")
                .select()
                .execute()
                .value
            try upsert(items, as: CachedEmployee.self)

        case .locations:
            let items: [Location] = try await db.from("locations")
                .select()
                .execute()
                .value
            try upsert(items, as: CachedLocation.self)

        case .clockRecords:
            let clockCutoff = Calendar.current.date(byAdding: .day, value: -90, to: Date())!
            let clockISO = ISO8601DateFormatter().string(from: clockCutoff)
            let items: [ClockRecord] = try await db.from("employee_clock_records")
                .select()
                .gte("clock_in", value: clockISO)
                .execute()
                .value
            try upsertClockRecords(items)

        case .plannedShifts:
            let shiftFrom = Calendar.current.date(byAdding: .day, value: -30, to: Date())!
            let shiftTo = Calendar.current.date(byAdding: .day, value: 60, to: Date())!
            let fromStr = DateFormatter.yyyyMMdd.string(from: shiftFrom)
            let toStr = DateFormatter.yyyyMMdd.string(from: shiftTo)
            let items: [PlannedShift] = try await db.from("planned_shifts")
                .select()
                .gte("shift_date", value: fromStr)
                .lte("shift_date", value: toStr)
                .execute()
                .value
            try upsertPlannedShifts(items)

        case .announcements:
            let items: [Announcement] = try await db.from("announcements")
                .select()
                .execute()
                .value
            try upsertAnnouncements(items)

        case .tipDistributions:
            let items: [TipDistribution] = try await db.from("tip_distributions")
                .select()
                .execute()
                .value
            try upsertTipDistributions(items)
        }

        #if DEBUG
        print("🔄 Synced \(table.rawValue)")
        #endif
    }

    /// Sync all tables — used on app launch or pull-to-refresh.
    func syncAll(force: Bool = false) async {
        for table in Table.allCases {
            do {
                try await sync(table, force: force)
            } catch {
                #if DEBUG
                print("⚠️ Sync failed for \(table.rawValue): \(error.localizedDescription)")
                #endif
            }
        }

        // Purge stale cached data after sync
        do {
            try purgeStaleData()
        } catch {
            #if DEBUG
            print("⚠️ Purge failed: \(error.localizedDescription)")
            #endif
        }
    }

    // MARK: - TTL Check

    private func isFresh(_ table: Table) -> Bool {
        let context = container.mainContext
        let cutoff = Date().addingTimeInterval(-ttl)

        do {
            switch table {
            case .employees:
                var d = FetchDescriptor<CachedEmployee>(sortBy: [SortDescriptor(\.lastSyncedAt, order: .reverse)])
                d.fetchLimit = 1
                return try context.fetch(d).first.map { $0.lastSyncedAt > cutoff } ?? false
            case .locations:
                var d = FetchDescriptor<CachedLocation>(sortBy: [SortDescriptor(\.lastSyncedAt, order: .reverse)])
                d.fetchLimit = 1
                return try context.fetch(d).first.map { $0.lastSyncedAt > cutoff } ?? false
            case .clockRecords:
                var d = FetchDescriptor<CachedClockRecord>(sortBy: [SortDescriptor(\.lastSyncedAt, order: .reverse)])
                d.fetchLimit = 1
                return try context.fetch(d).first.map { $0.lastSyncedAt > cutoff } ?? false
            case .plannedShifts:
                var d = FetchDescriptor<CachedPlannedShift>(sortBy: [SortDescriptor(\.lastSyncedAt, order: .reverse)])
                d.fetchLimit = 1
                return try context.fetch(d).first.map { $0.lastSyncedAt > cutoff } ?? false
            case .announcements:
                var d = FetchDescriptor<CachedAnnouncement>(sortBy: [SortDescriptor(\.lastSyncedAt, order: .reverse)])
                d.fetchLimit = 1
                return try context.fetch(d).first.map { $0.lastSyncedAt > cutoff } ?? false
            case .tipDistributions:
                var d = FetchDescriptor<CachedTipDistribution>(sortBy: [SortDescriptor(\.lastSyncedAt, order: .reverse)])
                d.fetchLimit = 1
                return try context.fetch(d).first.map { $0.lastSyncedAt > cutoff } ?? false
            }
        } catch {
            return false
        }
    }

    // MARK: - Upsert Helpers

    private func upsert(_ items: [Employee], as _: CachedEmployee.Type) throws {
        let context = container.mainContext
        let existing = try context.fetch(FetchDescriptor<CachedEmployee>())
        let existingById = Dictionary(uniqueKeysWithValues: existing.map { ($0.id, $0) })

        for item in items {
            if let cached = existingById[item.id] {
                cached.update(from: item)
            } else {
                context.insert(CachedEmployee(from: item))
            }
        }
        try context.save()
    }

    private func upsert(_ items: [Location], as _: CachedLocation.Type) throws {
        let context = container.mainContext
        let existing = try context.fetch(FetchDescriptor<CachedLocation>())
        let existingById = Dictionary(uniqueKeysWithValues: existing.map { ($0.id, $0) })

        for item in items {
            if let cached = existingById[item.id] {
                cached.update(from: item)
            } else {
                context.insert(CachedLocation(from: item))
            }
        }
        try context.save()
    }

    private func upsertClockRecords(_ items: [ClockRecord]) throws {
        let context = container.mainContext
        let existing = try context.fetch(FetchDescriptor<CachedClockRecord>())
        let existingById = Dictionary(uniqueKeysWithValues: existing.map { ($0.id, $0) })

        for item in items {
            if let cached = existingById[item.id] {
                cached.update(from: item)
            } else {
                context.insert(CachedClockRecord(from: item))
            }
        }
        try context.save()
    }

    private func upsertPlannedShifts(_ items: [PlannedShift]) throws {
        let context = container.mainContext
        let existing = try context.fetch(FetchDescriptor<CachedPlannedShift>())
        let existingById = Dictionary(uniqueKeysWithValues: existing.map { ($0.id, $0) })

        for item in items {
            if let cached = existingById[item.id] {
                cached.update(from: item)
            } else {
                context.insert(CachedPlannedShift(from: item))
            }
        }
        try context.save()
    }

    private func upsertAnnouncements(_ items: [Announcement]) throws {
        let context = container.mainContext
        let existing = try context.fetch(FetchDescriptor<CachedAnnouncement>())
        let existingById = Dictionary(uniqueKeysWithValues: existing.map { ($0.id, $0) })

        for item in items {
            if let cached = existingById[item.id] {
                cached.update(from: item)
            } else {
                context.insert(CachedAnnouncement(from: item))
            }
        }
        try context.save()
    }

    private func upsertTipDistributions(_ items: [TipDistribution]) throws {
        let context = container.mainContext
        let existing = try context.fetch(FetchDescriptor<CachedTipDistribution>())
        let existingById = Dictionary(uniqueKeysWithValues: existing.map { ($0.id, $0) })

        for item in items {
            if let cached = existingById[item.id] {
                cached.update(from: item)
            } else {
                context.insert(CachedTipDistribution(from: item))
            }
        }
        try context.save()
    }

    // MARK: - Cache Purge

    /// Remove cached records older than retention period.
    /// Called automatically after syncAll completes.
    func purgeStaleData(retentionDays: Int = 90) throws {
        let context = container.mainContext
        let cutoff = Calendar.current.date(byAdding: .day, value: -retentionDays, to: Date())!
        let cutoffStr = DateFormatter.yyyyMMdd.string(from: cutoff)

        // Clock records older than retention
        let oldClocks = try context.fetch(FetchDescriptor<CachedClockRecord>(
            predicate: #Predicate { $0.clockIn < cutoff }
        ))
        oldClocks.forEach { context.delete($0) }

        // Planned shifts older than retention (shiftDate is String "yyyy-MM-dd")
        let oldShifts = try context.fetch(FetchDescriptor<CachedPlannedShift>(
            predicate: #Predicate { $0.shiftDate < cutoffStr }
        ))
        oldShifts.forEach { context.delete($0) }

        if context.hasChanges {
            try context.save()
            #if DEBUG
            print("🗑 Purged \(oldClocks.count) old clock records, \(oldShifts.count) old shifts")
            #endif
        }
    }
}
