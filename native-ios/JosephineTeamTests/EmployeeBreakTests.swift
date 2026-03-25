import XCTest
@testable import JosephineTeam

final class EmployeeBreakTests: XCTestCase {

    // MARK: - Helpers

    private func makeBreak(
        breakEnd: Date? = nil,
        breakType: String = "rest",
        durationMinutes: Int? = nil
    ) -> EmployeeBreak {
        EmployeeBreak(
            id: UUID(),
            clockRecordId: UUID(),
            breakStart: Date(),
            breakEnd: breakEnd,
            breakType: breakType,
            durationMinutes: durationMinutes
        )
    }

    // MARK: - isActive

    func testIsActive_whenBreakEndNil_returnsTrue() {
        let brk = makeBreak(breakEnd: nil)
        XCTAssertTrue(brk.isActive)
    }

    func testIsActive_whenBreakEndSet_returnsFalse() {
        let brk = makeBreak(breakEnd: Date().addingTimeInterval(900))
        XCTAssertFalse(brk.isActive)
    }

    // MARK: - Break Types

    func testBreakType_rest() {
        let brk = makeBreak(breakType: "rest")
        XCTAssertEqual(brk.breakType, "rest")
    }

    func testBreakType_meal() {
        let brk = makeBreak(breakType: "meal")
        XCTAssertEqual(brk.breakType, "meal")
    }

    func testBreakType_smoke() {
        let brk = makeBreak(breakType: "smoke")
        XCTAssertEqual(brk.breakType, "smoke")
    }

    func testBreakType_other() {
        let brk = makeBreak(breakType: "other")
        XCTAssertEqual(brk.breakType, "other")
    }

    // MARK: - Duration

    func testDurationMinutes_nil_whenActive() {
        let brk = makeBreak(breakEnd: nil, durationMinutes: nil)
        XCTAssertNil(brk.durationMinutes)
    }

    func testDurationMinutes_preserved_whenSet() {
        let brk = makeBreak(
            breakEnd: Date().addingTimeInterval(900),
            durationMinutes: 15
        )
        XCTAssertEqual(brk.durationMinutes, 15)
    }

    func testDurationMinutes_zeroIsValid() {
        let brk = makeBreak(
            breakEnd: Date(),
            durationMinutes: 0
        )
        XCTAssertEqual(brk.durationMinutes, 0)
    }

    // MARK: - Identity

    func testId_isUnique() {
        let brk1 = makeBreak()
        let brk2 = makeBreak()
        XCTAssertNotEqual(brk1.id, brk2.id)
    }
}
