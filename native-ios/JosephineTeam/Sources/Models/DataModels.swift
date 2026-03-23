import Foundation

// MARK: - Employee (pivot for all queries)
struct Employee: Codable, Identifiable, Sendable {
    let id: UUID
    let userId: UUID?
    let fullName: String
    let locationId: UUID
    let hourlyCost: Double?
    let active: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case fullName = "full_name"
        case locationId = "location_id"
        case hourlyCost = "hourly_cost"
        case active
    }
}

// MARK: - Location
struct Location: Codable, Identifiable, Sendable {
    let id: UUID
    let name: String
}

// MARK: - User Profile (auth.users mirror)
struct UserProfile: Codable, Identifiable, Sendable {
    let id: UUID
    let firstName: String?
    let lastName: String?
    let avatarUrl: String?

    enum CodingKeys: String, CodingKey {
        case id
        case firstName = "first_name"
        case lastName = "last_name"
        case avatarUrl = "avatar_url"
    }
}

// MARK: - Clock Record
struct ClockRecord: Codable, Identifiable, Sendable {
    let id: UUID
    let employeeId: UUID
    let locationId: UUID
    let clockIn: Date
    var clockOut: Date?
    let clockInLat: Double?
    let clockInLng: Double?
    var clockOutLat: Double?
    var clockOutLng: Double?
    let source: String
    let notes: String?

    var isActive: Bool { clockOut == nil }

    var durationMinutes: Int? {
        guard let end = clockOut else { return nil }
        return Calendar.current.dateComponents([.minute], from: clockIn, to: end).minute
    }

    var durationString: String {
        guard let mins = durationMinutes else { return "En curso" }
        let h = mins / 60
        let m = mins % 60
        return h > 0 ? "\(h)h \(m)m" : "\(m)m"
    }

    enum CodingKeys: String, CodingKey {
        case id
        case employeeId = "employee_id"
        case locationId = "location_id"
        case clockIn = "clock_in"
        case clockOut = "clock_out"
        case clockInLat = "clock_in_lat"
        case clockInLng = "clock_in_lng"
        case clockOutLat = "clock_out_lat"
        case clockOutLng = "clock_out_lng"
        case source, notes
    }
}

// MARK: - Clock In Insert DTO
struct ClockInInsert: Codable, Sendable {
    let employeeId: UUID
    let locationId: UUID
    let clockIn: Date
    let clockInLat: Double?
    let clockInLng: Double?
    let source: String

    enum CodingKeys: String, CodingKey {
        case employeeId = "employee_id"
        case locationId = "location_id"
        case clockIn = "clock_in"
        case clockInLat = "clock_in_lat"
        case clockInLng = "clock_in_lng"
        case source
    }
}

// MARK: - Clock Out Update DTO
struct ClockOutUpdate: Codable, Sendable {
    let clockOut: Date
    let clockOutLat: Double?
    let clockOutLng: Double?

    enum CodingKeys: String, CodingKey {
        case clockOut = "clock_out"
        case clockOutLat = "clock_out_lat"
        case clockOutLng = "clock_out_lng"
    }
}

// MARK: - Employee Break
struct EmployeeBreak: Codable, Identifiable, Sendable {
    let id: UUID
    let clockRecordId: UUID
    let breakStart: Date
    var breakEnd: Date?
    let breakType: String
    let durationMinutes: Int?

    var isActive: Bool { breakEnd == nil }

    enum CodingKeys: String, CodingKey {
        case id
        case clockRecordId = "clock_record_id"
        case breakStart = "break_start"
        case breakEnd = "break_end"
        case breakType = "break_type"
        case durationMinutes = "duration_minutes"
    }
}

// MARK: - Planned Shift
struct PlannedShift: Codable, Identifiable, Sendable {
    let id: UUID
    let employeeId: UUID
    let shiftDate: String       // yyyy-MM-dd
    let startTime: String       // HH:mm
    let endTime: String         // HH:mm
    let plannedHours: Double
    let plannedCost: Double?
    let role: String
    let status: String          // draft | published

    /// Parse shift_date to a Date
    var date: Date? {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.date(from: shiftDate)
    }

    enum CodingKeys: String, CodingKey {
        case id
        case employeeId = "employee_id"
        case shiftDate = "shift_date"
        case startTime = "start_time"
        case endTime = "end_time"
        case plannedHours = "planned_hours"
        case plannedCost = "planned_cost"
        case role, status
    }
}

// MARK: - Announcement
struct Announcement: Codable, Identifiable, Sendable {
    let id: UUID
    let title: String
    let body: String?
    let type: String            // info | important | celebration | schedule
    let pinned: Bool
    let createdAt: Date
    let authorName: String?

    var announcementType: AnnouncementType {
        AnnouncementType(rawValue: type) ?? .info
    }

    enum CodingKeys: String, CodingKey {
        case id, title, body, type, pinned
        case createdAt = "created_at"
        case authorName = "author_name"
    }
}

enum AnnouncementType: String, CaseIterable, Sendable {
    case info, important, celebration, schedule

    var label: String {
        switch self {
        case .info:        return "Información"
        case .important:   return "Importante"
        case .celebration: return "Celebración"
        case .schedule:    return "Horario"
        }
    }

    var icon: String {
        switch self {
        case .info:        return "info.circle.fill"
        case .important:   return "exclamationmark.triangle.fill"
        case .celebration: return "party.popper.fill"
        case .schedule:    return "calendar.badge.clock"
        }
    }
}

// MARK: - Tip Distribution
struct TipDistribution: Codable, Identifiable, Sendable {
    let id: UUID
    let tipEntryId: UUID
    let employeeId: UUID
    let shareAmount: Double

    enum CodingKeys: String, CodingKey {
        case id
        case tipEntryId = "tip_entry_id"
        case employeeId = "employee_id"
        case shareAmount = "share_amount"
    }
}
