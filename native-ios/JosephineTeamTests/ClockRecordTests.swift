import XCTest
@testable import JosephineTeam

final class ClockRecordTests: XCTestCase {

    // MARK: - Helpers

    private func makeRecord(
        clockIn: Date = Date(),
        clockOut: Date? = nil
    ) -> ClockRecord {
        ClockRecord(
            id: UUID(),
            employeeId: UUID(),
            locationId: UUID(),
            clockIn: clockIn,
            clockOut: clockOut,
            clockInLat: nil,
            clockInLng: nil,
            clockOutLat: nil,
            clockOutLng: nil,
            source: "ios",
            notes: nil
        )
    }

    // MARK: - isActive

    func testIsActive_whenClockOutNil_returnsTrue() {
        let record = makeRecord(clockOut: nil)
        XCTAssertTrue(record.isActive)
    }

    func testIsActive_whenClockOutSet_returnsFalse() {
        let record = makeRecord(
            clockIn: Date(),
            clockOut: Date().addingTimeInterval(3600)
        )
        XCTAssertFalse(record.isActive)
    }

    // MARK: - durationMinutes

    func testDurationMinutes_whenActive_returnsNil() {
        let record = makeRecord(clockOut: nil)
        XCTAssertNil(record.durationMinutes)
    }

    func testDurationMinutes_oneHourShift_returns60() {
        let start = Date()
        let record = makeRecord(
            clockIn: start,
            clockOut: start.addingTimeInterval(3600)
        )
        XCTAssertEqual(record.durationMinutes, 60)
    }

    func testDurationMinutes_thirtyMinuteShift_returns30() {
        let start = Date()
        let record = makeRecord(
            clockIn: start,
            clockOut: start.addingTimeInterval(1800)
        )
        XCTAssertEqual(record.durationMinutes, 30)
    }

    func testDurationMinutes_eightHourShift_returns480() {
        let start = Date()
        let record = makeRecord(
            clockIn: start,
            clockOut: start.addingTimeInterval(8 * 3600)
        )
        XCTAssertEqual(record.durationMinutes, 480)
    }

    // MARK: - durationString

    func testDurationString_whenActive_returnsEnCurso() {
        let record = makeRecord(clockOut: nil)
        XCTAssertEqual(record.durationString, "En curso")
    }

    func testDurationString_lessThanOneHour_showsMinutesOnly() {
        let start = Date()
        let record = makeRecord(
            clockIn: start,
            clockOut: start.addingTimeInterval(45 * 60) // 45 minutes
        )
        XCTAssertEqual(record.durationString, "45m")
    }

    func testDurationString_exactlyOneHour_showsHoursAndMinutes() {
        let start = Date()
        let record = makeRecord(
            clockIn: start,
            clockOut: start.addingTimeInterval(3600)
        )
        XCTAssertEqual(record.durationString, "1h 0m")
    }

    func testDurationString_mixedHoursAndMinutes() {
        let start = Date()
        let record = makeRecord(
            clockIn: start,
            clockOut: start.addingTimeInterval(2 * 3600 + 15 * 60) // 2h 15m
        )
        XCTAssertEqual(record.durationString, "2h 15m")
    }

    func testDurationString_zeroMinutes_showsZero() {
        let start = Date()
        let record = makeRecord(
            clockIn: start,
            clockOut: start // same time
        )
        XCTAssertEqual(record.durationString, "0m")
    }
}
