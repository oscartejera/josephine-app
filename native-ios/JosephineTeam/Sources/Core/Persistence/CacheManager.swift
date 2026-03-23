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
        case clockRecords = "clock_records"
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
        let all = try context.fetch(FetchDescriptor<CachedClockRecord>())
        return all.filter { $0.employeeId == employeeId }.map { $0.toModel() }
    }

    func plannedShifts(for employeeId: UUID) throws -> [PlannedShift] {
        let context = container.mainContext
        let all = try context.fetch(FetchDescriptor<CachedPlannedShift>())
        return all.filter { $0.employeeId == employeeId }.map { $0.toModel() }
    }

    func announcements() throws -> [Announcement] {
        let context = container.mainContext
        let cached = try context.fetch(FetchDescriptor<CachedAnnouncement>())
        return cached.map { $0.toModel() }
    }

    func tipDistributions(for employeeId: UUID) throws -> [TipDistribution] {
        let context = container.mainContext
        let all = try context.fetch(FetchDescriptor<CachedTipDistribution>())
        return all.filter { $0.employeeId == employeeId }.map { $0.toModel() }
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
            let items: [ClockRecord] = try await db.from("clock_records")
                .select()
                .execute()
                .value
            try upsertClockRecords(items)

        case .plannedShifts:
            let items: [PlannedShift] = try await db.from("planned_shifts")
                .select()
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
    }

    // MARK: - TTL Check

    private func isFresh(_ table: Table) -> Bool {
        let context = container.mainContext
        let cutoff = Date().addingTimeInterval(-ttl)

        do {
            switch table {
            case .employees:
                let items = try context.fetch(FetchDescriptor<CachedEmployee>())
                return items.first.map { $0.lastSyncedAt > cutoff } ?? false
            case .locations:
                let items = try context.fetch(FetchDescriptor<CachedLocation>())
                return items.first.map { $0.lastSyncedAt > cutoff } ?? false
            case .clockRecords:
                let items = try context.fetch(FetchDescriptor<CachedClockRecord>())
                return items.first.map { $0.lastSyncedAt > cutoff } ?? false
            case .plannedShifts:
                let items = try context.fetch(FetchDescriptor<CachedPlannedShift>())
                return items.first.map { $0.lastSyncedAt > cutoff } ?? false
            case .announcements:
                let items = try context.fetch(FetchDescriptor<CachedAnnouncement>())
                return items.first.map { $0.lastSyncedAt > cutoff } ?? false
            case .tipDistributions:
                let items = try context.fetch(FetchDescriptor<CachedTipDistribution>())
                return items.first.map { $0.lastSyncedAt > cutoff } ?? false
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
}
