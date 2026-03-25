import XCTest
@testable import JosephineTeam

final class AvailabilityTests: XCTestCase {

    // MARK: - Helpers

    private let fixedEmployeeId = UUID()

    private func makeRow(
        employeeId: UUID? = nil,
        dayIndex: Int = 0,
        status: String = "available",
        startTime: String? = "09:00",
        endTime: String? = "17:00",
        note: String? = nil
    ) -> AvailabilityRow {
        AvailabilityRow(
            employeeId: employeeId ?? fixedEmployeeId,
            dayIndex: dayIndex,
            status: status,
            startTime: startTime,
            endTime: endTime,
            note: note
        )
    }

    // MARK: - Synthetic ID

    func testId_compositeFormat() {
        let row = makeRow(dayIndex: 3)
        XCTAssertEqual(row.id, "\(fixedEmployeeId)_3")
    }

    func testId_dayIndexZero() {
        let row = makeRow(dayIndex: 0)
        XCTAssertTrue(row.id.hasSuffix("_0"))
    }

    func testId_dayIndexSix() {
        let row = makeRow(dayIndex: 6)
        XCTAssertTrue(row.id.hasSuffix("_6"))
    }

    func testId_differentDays_differentIds() {
        let row0 = makeRow(dayIndex: 0)
        let row6 = makeRow(dayIndex: 6)
        XCTAssertNotEqual(row0.id, row6.id)
    }

    func testId_differentEmployees_differentIds() {
        let row1 = makeRow(employeeId: UUID(), dayIndex: 0)
        let row2 = makeRow(employeeId: UUID(), dayIndex: 0)
        XCTAssertNotEqual(row1.id, row2.id)
    }

    // MARK: - Status values

    func testStatus_available() {
        let row = makeRow(status: "available")
        XCTAssertEqual(row.status, "available")
    }

    func testStatus_unavailable() {
        let row = makeRow(status: "unavailable")
        XCTAssertEqual(row.status, "unavailable")
    }

    func testStatus_preferredOff() {
        let row = makeRow(status: "preferred_off")
        XCTAssertEqual(row.status, "preferred_off")
    }

    // MARK: - Optional fields

    func testOptionals_nilWhenNotSet() {
        let row = makeRow(startTime: nil, endTime: nil, note: nil)
        XCTAssertNil(row.startTime)
        XCTAssertNil(row.endTime)
        XCTAssertNil(row.note)
    }

    func testOptionals_preservedWhenSet() {
        let row = makeRow(
            startTime: "08:00",
            endTime: "16:00",
            note: "Prefiero mañanas"
        )
        XCTAssertEqual(row.startTime, "08:00")
        XCTAssertEqual(row.endTime, "16:00")
        XCTAssertEqual(row.note, "Prefiero mañanas")
    }

    // MARK: - DayIndex range

    func testDayIndex_allValidDays() {
        for day in 0...6 {
            let row = makeRow(dayIndex: day)
            XCTAssertEqual(row.dayIndex, day)
        }
    }
}
