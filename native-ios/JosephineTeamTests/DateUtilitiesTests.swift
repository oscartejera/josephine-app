import XCTest
@testable import JosephineTeam

final class DateUtilitiesTests: XCTestCase {

    // MARK: - startOfDay

    func testStartOfDay_stripsTimeComponents() {
        var comps = DateComponents()
        comps.year = 2025
        comps.month = 7
        comps.day = 14
        comps.hour = 15
        comps.minute = 30
        comps.second = 45

        let date = Calendar.current.date(from: comps)!
        let sod = date.startOfDay

        let sodComps = Calendar.current.dateComponents([.hour, .minute, .second], from: sod)
        XCTAssertEqual(sodComps.hour, 0)
        XCTAssertEqual(sodComps.minute, 0)
        XCTAssertEqual(sodComps.second, 0)
    }

    func testStartOfDay_preservesDayMonthYear() {
        var comps = DateComponents()
        comps.year = 2025
        comps.month = 3
        comps.day = 22
        comps.hour = 23
        comps.minute = 59

        let date = Calendar.current.date(from: comps)!
        let sod = date.startOfDay

        let sodComps = Calendar.current.dateComponents([.year, .month, .day], from: sod)
        XCTAssertEqual(sodComps.year, 2025)
        XCTAssertEqual(sodComps.month, 3)
        XCTAssertEqual(sodComps.day, 22)
    }

    // MARK: - endOfDay

    func testEndOfDay_isLastSecondOfDay() {
        var comps = DateComponents()
        comps.year = 2025
        comps.month = 7
        comps.day = 14
        comps.hour = 10

        let date = Calendar.current.date(from: comps)!
        let eod = date.endOfDay

        let eodComps = Calendar.current.dateComponents([.hour, .minute, .second], from: eod)
        XCTAssertEqual(eodComps.hour, 23)
        XCTAssertEqual(eodComps.minute, 59)
        XCTAssertEqual(eodComps.second, 59)
    }

    func testEndOfDay_sameDayAsInput() {
        var comps = DateComponents()
        comps.year = 2025
        comps.month = 12
        comps.day = 31
        comps.hour = 0

        let date = Calendar.current.date(from: comps)!
        let eod = date.endOfDay

        let eodComps = Calendar.current.dateComponents([.year, .month, .day], from: eod)
        XCTAssertEqual(eodComps.year, 2025)
        XCTAssertEqual(eodComps.month, 12)
        XCTAssertEqual(eodComps.day, 31)
    }

    // MARK: - Date.currentWeekBounds()

    func testCurrentWeekBounds_returnsValidDateStrings() {
        let (monday, sunday) = Date.currentWeekBounds()

        // Format: yyyy-MM-dd
        let regex = /^\d{4}-\d{2}-\d{2}$/
        XCTAssertNotNil(monday.firstMatch(of: regex), "Monday should match yyyy-MM-dd format")
        XCTAssertNotNil(sunday.firstMatch(of: regex), "Sunday should match yyyy-MM-dd format")
    }

    func testCurrentWeekBounds_sundayIsAfterMonday() {
        let (mondayStr, sundayStr) = Date.currentWeekBounds()
        let fmt = DateFormatter.yyyyMMdd
        let monday = fmt.date(from: mondayStr)!
        let sunday = fmt.date(from: sundayStr)!

        XCTAssertTrue(sunday > monday, "Sunday should be after Monday")
    }

    func testCurrentWeekBounds_spansSixDays() {
        let (mondayStr, sundayStr) = Date.currentWeekBounds()
        let fmt = DateFormatter.yyyyMMdd
        let monday = fmt.date(from: mondayStr)!
        let sunday = fmt.date(from: sundayStr)!

        let daysBetween = Calendar.current.dateComponents([.day], from: monday, to: sunday).day!
        XCTAssertEqual(daysBetween, 6, "Monday to Sunday should be exactly 6 days")
    }

    // MARK: - yyyyMMdd formatter

    func testYyyymmddFormatter_outputFormat() {
        var comps = DateComponents()
        comps.year = 2025
        comps.month = 1
        comps.day = 5

        let date = Calendar.current.date(from: comps)!
        let result = DateFormatter.yyyyMMdd.string(from: date)
        XCTAssertEqual(result, "2025-01-05")
    }

    func testYyyymmddFormatter_roundTrip() {
        let input = "2025-07-14"
        let date = DateFormatter.yyyyMMdd.date(from: input)!
        let output = DateFormatter.yyyyMMdd.string(from: date)
        XCTAssertEqual(input, output)
    }
}
