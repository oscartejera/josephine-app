import Foundation
import SwiftData

// MARK: - Cached Employee
@Model
final class CachedEmployee {
    @Attribute(.unique) var id: UUID
    var userId: UUID?
    var fullName: String
    var locationId: UUID
    var hourlyCost: Double?
    var active: Bool
    var lastSyncedAt: Date

    init(from model: Employee) {
        self.id = model.id
        self.userId = model.userId
        self.fullName = model.fullName
        self.locationId = model.locationId
        self.hourlyCost = model.hourlyCost
        self.active = model.active
        self.lastSyncedAt = Date()
    }

    func update(from model: Employee) {
        self.userId = model.userId
        self.fullName = model.fullName
        self.locationId = model.locationId
        self.hourlyCost = model.hourlyCost
        self.active = model.active
        self.lastSyncedAt = Date()
    }

    func toModel() -> Employee {
        Employee(
            id: id,
            userId: userId,
            fullName: fullName,
            locationId: locationId,
            hourlyCost: hourlyCost,
            active: active
        )
    }
}

// MARK: - Cached Location
@Model
final class CachedLocation {
    @Attribute(.unique) var id: UUID
    var name: String
    var lastSyncedAt: Date

    init(from model: Location) {
        self.id = model.id
        self.name = model.name
        self.lastSyncedAt = Date()
    }

    func update(from model: Location) {
        self.name = model.name
        self.lastSyncedAt = Date()
    }

    func toModel() -> Location {
        Location(id: id, name: name)
    }
}

// MARK: - Cached Clock Record
@Model
final class CachedClockRecord {
    @Attribute(.unique) var id: UUID
    var employeeId: UUID
    var locationId: UUID
    var clockIn: Date
    var clockOut: Date?
    var clockInLat: Double?
    var clockInLng: Double?
    var clockOutLat: Double?
    var clockOutLng: Double?
    var source: String
    var notes: String?
    var lastSyncedAt: Date

    init(from model: ClockRecord) {
        self.id = model.id
        self.employeeId = model.employeeId
        self.locationId = model.locationId
        self.clockIn = model.clockIn
        self.clockOut = model.clockOut
        self.clockInLat = model.clockInLat
        self.clockInLng = model.clockInLng
        self.clockOutLat = model.clockOutLat
        self.clockOutLng = model.clockOutLng
        self.source = model.source
        self.notes = model.notes
        self.lastSyncedAt = Date()
    }

    func update(from model: ClockRecord) {
        self.employeeId = model.employeeId
        self.locationId = model.locationId
        self.clockIn = model.clockIn
        self.clockOut = model.clockOut
        self.clockInLat = model.clockInLat
        self.clockInLng = model.clockInLng
        self.clockOutLat = model.clockOutLat
        self.clockOutLng = model.clockOutLng
        self.source = model.source
        self.notes = model.notes
        self.lastSyncedAt = Date()
    }

    func toModel() -> ClockRecord {
        ClockRecord(
            id: id,
            employeeId: employeeId,
            locationId: locationId,
            clockIn: clockIn,
            clockOut: clockOut,
            clockInLat: clockInLat,
            clockInLng: clockInLng,
            clockOutLat: clockOutLat,
            clockOutLng: clockOutLng,
            source: source,
            notes: notes
        )
    }
}

// MARK: - Cached Employee Break
@Model
final class CachedEmployeeBreak {
    @Attribute(.unique) var id: UUID
    var clockRecordId: UUID
    var breakStart: Date
    var breakEnd: Date?
    var breakType: String
    var durationMinutes: Int?
    var lastSyncedAt: Date

    init(from model: EmployeeBreak) {
        self.id = model.id
        self.clockRecordId = model.clockRecordId
        self.breakStart = model.breakStart
        self.breakEnd = model.breakEnd
        self.breakType = model.breakType
        self.durationMinutes = model.durationMinutes
        self.lastSyncedAt = Date()
    }

    func update(from model: EmployeeBreak) {
        self.clockRecordId = model.clockRecordId
        self.breakStart = model.breakStart
        self.breakEnd = model.breakEnd
        self.breakType = model.breakType
        self.durationMinutes = model.durationMinutes
        self.lastSyncedAt = Date()
    }

    func toModel() -> EmployeeBreak {
        EmployeeBreak(
            id: id,
            clockRecordId: clockRecordId,
            breakStart: breakStart,
            breakEnd: breakEnd,
            breakType: breakType,
            durationMinutes: durationMinutes
        )
    }
}

// MARK: - Cached Planned Shift
@Model
final class CachedPlannedShift {
    @Attribute(.unique) var id: UUID
    var employeeId: UUID
    var shiftDate: String
    var startTime: String
    var endTime: String
    var plannedHours: Double
    var plannedCost: Double?
    var role: String
    var status: String
    var lastSyncedAt: Date

    init(from model: PlannedShift) {
        self.id = model.id
        self.employeeId = model.employeeId
        self.shiftDate = model.shiftDate
        self.startTime = model.startTime
        self.endTime = model.endTime
        self.plannedHours = model.plannedHours
        self.plannedCost = model.plannedCost
        self.role = model.role
        self.status = model.status
        self.lastSyncedAt = Date()
    }

    func update(from model: PlannedShift) {
        self.employeeId = model.employeeId
        self.shiftDate = model.shiftDate
        self.startTime = model.startTime
        self.endTime = model.endTime
        self.plannedHours = model.plannedHours
        self.plannedCost = model.plannedCost
        self.role = model.role
        self.status = model.status
        self.lastSyncedAt = Date()
    }

    func toModel() -> PlannedShift {
        PlannedShift(
            id: id,
            employeeId: employeeId,
            shiftDate: shiftDate,
            startTime: startTime,
            endTime: endTime,
            plannedHours: plannedHours,
            plannedCost: plannedCost,
            role: role,
            status: status
        )
    }
}

// MARK: - Cached Announcement
@Model
final class CachedAnnouncement {
    @Attribute(.unique) var id: UUID
    var title: String
    var body: String?
    var type: String
    var pinned: Bool
    var createdAt: Date
    var authorName: String?
    var lastSyncedAt: Date

    init(from model: Announcement) {
        self.id = model.id
        self.title = model.title
        self.body = model.body
        self.type = model.type
        self.pinned = model.pinned
        self.createdAt = model.createdAt
        self.authorName = model.authorName
        self.lastSyncedAt = Date()
    }

    func update(from model: Announcement) {
        self.title = model.title
        self.body = model.body
        self.type = model.type
        self.pinned = model.pinned
        self.createdAt = model.createdAt
        self.authorName = model.authorName
        self.lastSyncedAt = Date()
    }

    func toModel() -> Announcement {
        Announcement(
            id: id,
            title: title,
            body: body,
            type: type,
            pinned: pinned,
            createdAt: createdAt,
            authorName: authorName
        )
    }
}

// MARK: - Cached Tip Distribution
@Model
final class CachedTipDistribution {
    @Attribute(.unique) var id: UUID
    var tipEntryId: UUID
    var employeeId: UUID
    var shareAmount: Double
    var lastSyncedAt: Date

    init(from model: TipDistribution) {
        self.id = model.id
        self.tipEntryId = model.tipEntryId
        self.employeeId = model.employeeId
        self.shareAmount = model.shareAmount
        self.lastSyncedAt = Date()
    }

    func update(from model: TipDistribution) {
        self.tipEntryId = model.tipEntryId
        self.employeeId = model.employeeId
        self.shareAmount = model.shareAmount
        self.lastSyncedAt = Date()
    }

    func toModel() -> TipDistribution {
        TipDistribution(
            id: id,
            tipEntryId: tipEntryId,
            employeeId: employeeId,
            shareAmount: shareAmount
        )
    }
}

// MARK: - Cached User Profile
@Model
final class CachedUserProfile {
    @Attribute(.unique) var id: UUID
    var firstName: String?
    var lastName: String?
    var avatarUrl: String?
    var lastSyncedAt: Date

    init(from model: UserProfile) {
        self.id = model.id
        self.firstName = model.firstName
        self.lastName = model.lastName
        self.avatarUrl = model.avatarUrl
        self.lastSyncedAt = Date()
    }

    func update(from model: UserProfile) {
        self.firstName = model.firstName
        self.lastName = model.lastName
        self.avatarUrl = model.avatarUrl
        self.lastSyncedAt = Date()
    }

    func toModel() -> UserProfile {
        UserProfile(
            id: id,
            firstName: firstName,
            lastName: lastName,
            avatarUrl: avatarUrl
        )
    }
}

// MARK: - Cached Swap Request
@Model
final class CachedSwapRequest {
    @Attribute(.unique) var id: UUID
    var locationId: UUID
    var requesterId: UUID
    var targetId: UUID?
    var requesterShiftId: UUID
    var targetShiftId: UUID?
    var status: String
    var reason: String?
    var reviewedBy: UUID?
    var reviewedAt: Date?
    var createdAt: Date
    var updatedAt: Date
    var lastSyncedAt: Date

    init(from model: ShiftSwapRequest) {
        self.id = model.id
        self.locationId = model.locationId
        self.requesterId = model.requesterId
        self.targetId = model.targetId
        self.requesterShiftId = model.requesterShiftId
        self.targetShiftId = model.targetShiftId
        self.status = model.status
        self.reason = model.reason
        self.reviewedBy = model.reviewedBy
        self.reviewedAt = model.reviewedAt
        self.createdAt = model.createdAt
        self.updatedAt = model.updatedAt
        self.lastSyncedAt = Date()
    }

    func update(from model: ShiftSwapRequest) {
        self.locationId = model.locationId
        self.requesterId = model.requesterId
        self.targetId = model.targetId
        self.requesterShiftId = model.requesterShiftId
        self.targetShiftId = model.targetShiftId
        self.status = model.status
        self.reason = model.reason
        self.reviewedBy = model.reviewedBy
        self.reviewedAt = model.reviewedAt
        self.createdAt = model.createdAt
        self.updatedAt = model.updatedAt
        self.lastSyncedAt = Date()
    }

    func toModel() -> ShiftSwapRequest {
        ShiftSwapRequest(
            id: id,
            locationId: locationId,
            requesterId: requesterId,
            targetId: targetId,
            requesterShiftId: requesterShiftId,
            targetShiftId: targetShiftId,
            status: status,
            reason: reason,
            reviewedBy: reviewedBy,
            reviewedAt: reviewedAt,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }
}

// MARK: - Cached Availability
@Model
final class CachedAvailability {
    var employeeId: UUID
    var dayIndex: Int
    var status: String
    var startTime: String?
    var endTime: String?
    var note: String?
    var lastSyncedAt: Date

    /// Composite key for uniqueness (employee + day)
    @Attribute(.unique) var compositeKey: String

    init(from model: AvailabilityRow) {
        self.employeeId = model.employeeId
        self.dayIndex = model.dayIndex
        self.status = model.status
        self.startTime = model.startTime
        self.endTime = model.endTime
        self.note = model.note
        self.compositeKey = "\(model.employeeId)_\(model.dayIndex)"
        self.lastSyncedAt = Date()
    }

    func update(from model: AvailabilityRow) {
        self.status = model.status
        self.startTime = model.startTime
        self.endTime = model.endTime
        self.note = model.note
        self.lastSyncedAt = Date()
    }

    func toModel() -> AvailabilityRow {
        AvailabilityRow(
            employeeId: employeeId,
            dayIndex: dayIndex,
            status: status,
            startTime: startTime,
            endTime: endTime,
            note: note
        )
    }
}

// MARK: - CacheUpsertable Conformances

extension CachedEmployee: CacheUpsertable { typealias DTO = Employee }
extension CachedLocation: CacheUpsertable { typealias DTO = Location }
extension CachedClockRecord: CacheUpsertable { typealias DTO = ClockRecord }
extension CachedEmployeeBreak: CacheUpsertable { typealias DTO = EmployeeBreak }
extension CachedPlannedShift: CacheUpsertable { typealias DTO = PlannedShift }
extension CachedAnnouncement: CacheUpsertable { typealias DTO = Announcement }
extension CachedTipDistribution: CacheUpsertable { typealias DTO = TipDistribution }
extension CachedSwapRequest: CacheUpsertable { typealias DTO = ShiftSwapRequest }
