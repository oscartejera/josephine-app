import Foundation
import SwiftData
@preconcurrency import Supabase

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
            CachedEmployeeBreak.self,
            CachedPlannedShift.self,
            CachedAnnouncement.self,
            CachedTipDistribution.self,
            CachedUserProfile.self,
            CachedSwapRequest.self,
            CachedAvailability.self
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
        case employeeBreaks = "employee_breaks"
        case plannedShifts = "planned_shifts"
        case announcements
        case tipDistributions = "tip_distributions"
        case swapRequests = "shift_swap_requests"
        case availability = "employee_availability"
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

    func employeeBreaks(for clockRecordId: UUID) throws -> [EmployeeBreak] {
        let context = container.mainContext
        let descriptor = FetchDescriptor<CachedEmployeeBreak>(
            predicate: #Predicate { $0.clockRecordId == clockRecordId },
            sortBy: [SortDescriptor(\.breakStart, order: .reverse)]
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

    func swapRequests(for employeeId: UUID) throws -> [ShiftSwapRequest] {
        let context = container.mainContext
        let descriptor = FetchDescriptor<CachedSwapRequest>(
            predicate: #Predicate { $0.requesterId == employeeId || $0.targetId == employeeId },
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )
        return try context.fetch(descriptor).map { $0.toModel() }
    }

    func availability(for employeeId: UUID) throws -> [AvailabilityRow] {
        let context = container.mainContext
        let descriptor = FetchDescriptor<CachedAvailability>(
            predicate: #Predicate { $0.employeeId == employeeId },
            sortBy: [SortDescriptor(\.dayIndex)]
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
            try upsert(items, into: CachedEmployee.self)

        case .locations:
            let items: [Location] = try await db.from("locations")
                .select()
                .execute()
                .value
            try upsert(items, into: CachedLocation.self)

        case .clockRecords:
            let clockCutoff = Calendar.current.date(byAdding: .day, value: -90, to: Date())!
            let clockISO = ISO8601DateFormatter().string(from: clockCutoff)
            let items: [ClockRecord] = try await db.from("employee_clock_records")
                .select()
                .gte("clock_in", value: clockISO)
                .execute()
                .value
            try upsert(items, into: CachedClockRecord.self)

        case .employeeBreaks:
            let breakCutoff = Calendar.current.date(byAdding: .day, value: -90, to: Date())!
            let breakISO = ISO8601DateFormatter().string(from: breakCutoff)
            let items: [EmployeeBreak] = try await db.from("employee_breaks")
                .select()
                .gte("break_start", value: breakISO)
                .execute()
                .value
            try upsert(items, into: CachedEmployeeBreak.self)

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
            try upsert(items, into: CachedPlannedShift.self)

        case .announcements:
            let items: [Announcement] = try await db.from("announcements")
                .select()
                .execute()
                .value
            try upsert(items, into: CachedAnnouncement.self)

        case .tipDistributions:
            let items: [TipDistribution] = try await db.from("tip_distributions")
                .select()
                .execute()
                .value
            try upsert(items, into: CachedTipDistribution.self)

        case .swapRequests:
            let swapCutoff = Calendar.current.date(byAdding: .day, value: -90, to: Date())!
            let swapISO = ISO8601DateFormatter().string(from: swapCutoff)
            let items: [ShiftSwapRequest] = try await db.from("shift_swap_requests")
                .select()
                .gte("created_at", value: swapISO)
                .execute()
                .value
            try upsert(items, into: CachedSwapRequest.self)

        case .availability:
            let items: [AvailabilityRow] = try await db.from("employee_availability")
                .select()
                .execute()
                .value
            try upsertAvailability(items)
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
        switch table {
        case .employees:        return isCacheFresh(CachedEmployee.self)
        case .locations:        return isCacheFresh(CachedLocation.self)
        case .clockRecords:     return isCacheFresh(CachedClockRecord.self)
        case .employeeBreaks:   return isCacheFresh(CachedEmployeeBreak.self)
        case .plannedShifts:    return isCacheFresh(CachedPlannedShift.self)
        case .announcements:    return isCacheFresh(CachedAnnouncement.self)
        case .tipDistributions: return isCacheFresh(CachedTipDistribution.self)
        case .swapRequests:     return isCacheFresh(CachedSwapRequest.self)
        case .availability:     return isCacheFresh(CachedAvailability.self)
        }
    }

    /// Generic TTL check for any SwiftData model with a `lastSyncedAt` property.
    private func isCacheFresh<T: PersistentModel>(_ type: T.Type) -> Bool {
        let context = container.mainContext
        let cutoff = Date().addingTimeInterval(-ttl)
        do {
            var d = FetchDescriptor<T>(sortBy: [SortDescriptor(\.persistentModelID)])
            d.fetchLimit = 1
            guard let row = try context.fetch(d).first else { return false }
            let mirror = Mirror(reflecting: row)
            guard let syncDate = mirror.children.first(where: { $0.label == "lastSyncedAt" })?.value as? Date else { return false }
            return syncDate > cutoff
        } catch {
            return false
        }
    }

    // MARK: - Generic Upsert

    /// Single generic upsert for any CacheUpsertable model.
    /// Fetches all existing rows, builds a dictionary by UUID, then inserts or updates.
    private func upsert<C: CacheUpsertable>(_ items: [C.DTO], into _: C.Type) throws {
        let context = container.mainContext
        let existing = try context.fetch(FetchDescriptor<C>())
        let existingById = Dictionary(uniqueKeysWithValues: existing.map { ($0.id, $0) })

        for item in items {
            if let cached = existingById[item.id] {
                cached.update(from: item)
            } else {
                context.insert(C(from: item))
            }
        }
        try context.save()
    }

    // MARK: - Availability Upsert (composite key)

    private func upsertAvailability(_ items: [AvailabilityRow]) throws {
        let context = container.mainContext
        let existing = try context.fetch(FetchDescriptor<CachedAvailability>())
        let existingByKey = Dictionary(uniqueKeysWithValues: existing.map { ($0.compositeKey, $0) })

        for item in items {
            let key = "\(item.employeeId)_\(item.dayIndex)"
            if let cached = existingByKey[key] {
                cached.update(from: item)
            } else {
                context.insert(CachedAvailability(from: item))
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

        // Employee breaks older than retention
        let oldBreaks = try context.fetch(FetchDescriptor<CachedEmployeeBreak>(
            predicate: #Predicate { $0.breakStart < cutoff }
        ))
        oldBreaks.forEach { context.delete($0) }

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
