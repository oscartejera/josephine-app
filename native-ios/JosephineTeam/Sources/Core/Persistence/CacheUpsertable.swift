import Foundation
import SwiftData

// MARK: - CacheUpsertable Protocol

/// Contract for SwiftData cached models that can be upserted from a network DTO.
///
/// Conforming types must:
/// - Be a SwiftData `@Model` (PersistentModel)
/// - Have a UUID `id` property used as the identity key
/// - Implement `init(from:)` and `update(from:)` for their DTO type
///
/// Usage:
/// ```swift
/// try CacheManager.shared.genericUpsert(items, existing: existingCached)
/// ```
protocol CacheUpsertable: PersistentModel {
    associatedtype DTO: Identifiable where DTO.ID == UUID

    var id: UUID { get }

    init(from model: DTO)
    func update(from model: DTO)
}
