import XCTest
@testable import JosephineTeam

final class AnnouncementTypeTests: XCTestCase {

    // MARK: - Raw Value Mapping

    func testRawValues() {
        XCTAssertEqual(AnnouncementType.info.rawValue, "info")
        XCTAssertEqual(AnnouncementType.important.rawValue, "important")
        XCTAssertEqual(AnnouncementType.celebration.rawValue, "celebration")
        XCTAssertEqual(AnnouncementType.schedule.rawValue, "schedule")
    }

    func testAllCases_containsFourTypes() {
        XCTAssertEqual(AnnouncementType.allCases.count, 4)
    }

    // MARK: - Labels

    func testLabels() {
        XCTAssertEqual(AnnouncementType.info.label, "Información")
        XCTAssertEqual(AnnouncementType.important.label, "Importante")
        XCTAssertEqual(AnnouncementType.celebration.label, "Celebración")
        XCTAssertEqual(AnnouncementType.schedule.label, "Horario")
    }

    // MARK: - Icons

    func testIcons() {
        XCTAssertEqual(AnnouncementType.info.icon, "info.circle.fill")
        XCTAssertEqual(AnnouncementType.important.icon, "exclamationmark.triangle.fill")
        XCTAssertEqual(AnnouncementType.celebration.icon, "party.popper.fill")
        XCTAssertEqual(AnnouncementType.schedule.icon, "calendar.badge.clock")
    }

    // MARK: - Announcement → announcementType

    func testAnnouncement_announcementType_mapsCorrectly() {
        let announcement = Announcement(
            id: UUID(),
            title: "Test",
            body: nil,
            type: "important",
            pinned: false,
            createdAt: Date(),
            authorName: nil
        )
        XCTAssertEqual(announcement.announcementType, .important)
    }

    func testAnnouncement_unknownType_defaultsToInfo() {
        let announcement = Announcement(
            id: UUID(),
            title: "Test",
            body: nil,
            type: "unknown_value",
            pinned: false,
            createdAt: Date(),
            authorName: nil
        )
        XCTAssertEqual(announcement.announcementType, .info)
    }
}
