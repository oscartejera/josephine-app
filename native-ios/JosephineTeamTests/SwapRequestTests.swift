import XCTest
@testable import JosephineTeam

final class SwapRequestTests: XCTestCase {

    // MARK: - Helpers

    private func makeRequest(
        status: String = "pending",
        targetId: UUID? = nil,
        targetShiftId: UUID? = nil,
        reason: String? = nil,
        reviewedBy: UUID? = nil,
        reviewedAt: Date? = nil
    ) -> ShiftSwapRequest {
        ShiftSwapRequest(
            id: UUID(),
            locationId: UUID(),
            requesterId: UUID(),
            targetId: targetId,
            requesterShiftId: UUID(),
            targetShiftId: targetShiftId,
            status: status,
            reason: reason,
            reviewedBy: reviewedBy,
            reviewedAt: reviewedAt,
            createdAt: Date(),
            updatedAt: Date()
        )
    }

    // MARK: - swapStatus computed

    func testSwapStatus_pending() {
        let req = makeRequest(status: "pending")
        XCTAssertEqual(req.swapStatus, .pending)
    }

    func testSwapStatus_approved() {
        let req = makeRequest(status: "approved")
        XCTAssertEqual(req.swapStatus, .approved)
    }

    func testSwapStatus_rejected() {
        let req = makeRequest(status: "rejected")
        XCTAssertEqual(req.swapStatus, .rejected)
    }

    func testSwapStatus_cancelled() {
        let req = makeRequest(status: "cancelled")
        XCTAssertEqual(req.swapStatus, .cancelled)
    }

    func testSwapStatus_unknownValue_defaultsToPending() {
        let req = makeRequest(status: "unknown_value")
        XCTAssertEqual(req.swapStatus, .pending)
    }

    // MARK: - SwapStatus enum

    func testSwapStatus_allCases_containsFour() {
        XCTAssertEqual(SwapStatus.allCases.count, 4)
    }

    func testSwapStatus_labels() {
        XCTAssertEqual(SwapStatus.pending.label, "Pendiente")
        XCTAssertEqual(SwapStatus.approved.label, "Aprobado")
        XCTAssertEqual(SwapStatus.rejected.label, "Rechazado")
        XCTAssertEqual(SwapStatus.cancelled.label, "Cancelado")
    }

    func testSwapStatus_icons() {
        XCTAssertEqual(SwapStatus.pending.icon, "clock.badge.questionmark")
        XCTAssertEqual(SwapStatus.approved.icon, "checkmark.circle.fill")
        XCTAssertEqual(SwapStatus.rejected.icon, "xmark.circle.fill")
        XCTAssertEqual(SwapStatus.cancelled.icon, "minus.circle.fill")
    }

    // MARK: - Optional fields

    func testRequest_withNilOptionals_preservesNils() {
        let req = makeRequest(
            targetId: nil,
            targetShiftId: nil,
            reason: nil,
            reviewedBy: nil,
            reviewedAt: nil
        )
        XCTAssertNil(req.targetId)
        XCTAssertNil(req.targetShiftId)
        XCTAssertNil(req.reason)
        XCTAssertNil(req.reviewedBy)
        XCTAssertNil(req.reviewedAt)
    }

    func testRequest_withValues_preservesValues() {
        let target = UUID()
        let reviewer = UUID()
        let reviewDate = Date()
        let req = makeRequest(
            targetId: target,
            targetShiftId: UUID(),
            reason: "Necesito ese día libre",
            reviewedBy: reviewer,
            reviewedAt: reviewDate
        )
        XCTAssertEqual(req.targetId, target)
        XCTAssertNotNil(req.targetShiftId)
        XCTAssertEqual(req.reason, "Necesito ese día libre")
        XCTAssertEqual(req.reviewedBy, reviewer)
        XCTAssertEqual(req.reviewedAt, reviewDate)
    }
}
