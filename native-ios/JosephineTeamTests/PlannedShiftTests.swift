import XCTest
@testable import JosephineTeam

final class PlannedShiftTests: XCTestCase {

    // MARK: - Helpers

    private func makeShift(
        shiftDate: String = "2025-03-25",
        startTime: String? = "09:00",
        endTime: String? = "17:00",
        plannedHours: Double = 8.0,
        plannedCost: Double? = nil,
        role: String? = "waiter",
        status: String? = "published"
    ) -> PlannedShift {
        PlannedShift(
            id: UUID(),
            employeeId: UUID(),
            shiftDate: shiftDate,
            startTime: startTime,
            endTime: endTime,
            plannedHours: plannedHours,
            plannedCost: plannedCost,
            role: role,
            status: status
        )
    }

    // MARK: - date computed

    func testDate_validFormat_returnsDate() {
        let shift = makeShift(shiftDate: "2025-03-25")
        let date = shift.date
        XCTAssertNotNil(date)

        let cal = Calendar.current
        XCTAssertEqual(cal.component(.year, from: date!), 2025)
        XCTAssertEqual(cal.component(.month, from: date!), 3)
        XCTAssertEqual(cal.component(.day, from: date!), 25)
    }

    func testDate_invalidFormat_returnsNil() {
        let shift = makeShift(shiftDate: "invalid")
        XCTAssertNil(shift.date)
    }

    func testDate_emptyString_returnsNil() {
        let shift = makeShift(shiftDate: "")
        XCTAssertNil(shift.date)
    }

    func testDate_wrongSeparator_returnsNil() {
        let shift = makeShift(shiftDate: "2025/03/25")
        XCTAssertNil(shift.date)
    }

    // MARK: - Status

    func testStatus_published() {
        let shift = makeShift(status: "published")
        XCTAssertEqual(shift.status, "published")
        XCTAssertEqual(shift.safeStatus, "published")
    }

    func testStatus_draft() {
        let shift = makeShift(status: "draft")
        XCTAssertEqual(shift.status, "draft")
        XCTAssertEqual(shift.safeStatus, "draft")
    }

    // MARK: - Safe defaults when nil

    func testSafeStatus_nil_returnsPublished() {
        let shift = makeShift(status: nil)
        XCTAssertNil(shift.status)
        XCTAssertEqual(shift.safeStatus, "published")
    }

    func testSafeStartTime_nil_returnsDefault() {
        let shift = makeShift(startTime: nil)
        XCTAssertNil(shift.startTime)
        XCTAssertEqual(shift.safeStartTime, "09:00")
    }

    func testSafeEndTime_nil_returnsDefault() {
        let shift = makeShift(endTime: nil)
        XCTAssertNil(shift.endTime)
        XCTAssertEqual(shift.safeEndTime, "17:00")
    }

    func testSafeRole_nil_returnsStaff() {
        let shift = makeShift(role: nil)
        XCTAssertNil(shift.role)
        XCTAssertEqual(shift.safeRole, "staff")
    }

    // MARK: - Fields

    func testPlannedCost_nil_whenNotSet() {
        let shift = makeShift(plannedCost: nil)
        XCTAssertNil(shift.plannedCost)
    }

    func testPlannedCost_preserved_whenSet() {
        let shift = makeShift(plannedCost: 120.50)
        XCTAssertEqual(shift.plannedCost, 120.50, accuracy: 0.01)
    }

    func testPlannedHours_preserved() {
        let shift = makeShift(plannedHours: 4.5)
        XCTAssertEqual(shift.plannedHours, 4.5, accuracy: 0.01)
    }

    func testRole_preserved() {
        let shift = makeShift(role: "kitchen")
        XCTAssertEqual(shift.role, "kitchen")
    }

    func testTimeStrings_preserved() {
        let shift = makeShift(startTime: "06:30", endTime: "14:30")
        XCTAssertEqual(shift.startTime, "06:30")
        XCTAssertEqual(shift.endTime, "14:30")
    }
}
