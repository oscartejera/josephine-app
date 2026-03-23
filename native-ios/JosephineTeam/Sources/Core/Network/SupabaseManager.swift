import Foundation
import Supabase

// MARK: - Supabase Singleton

/// Single source of truth for the Supabase client.
/// Configuration is driven by `AppEnvironment.current`.
@MainActor
final class SupabaseManager: Sendable {
    static let shared = SupabaseManager()

    let client: SupabaseClient
    let environment: AppEnvironment

    private init() {
        let env = AppEnvironment.current
        self.environment = env

        client = SupabaseClient(
            supabaseURL: env.supabaseURL,
            supabaseKey: env.supabaseAnonKey
        )

        #if DEBUG
        print("🔌 Supabase [\(env.displayName)] → \(env.supabaseURL.absoluteString)")
        #endif
    }

    // MARK: - Convenience Accessors
    var auth: AuthClient { client.auth }

    /// Direct access to the Postgrest client for raw queries.
    /// Feature views should prefer `client.from("table_name")` instead.
    var db: PostgrestClient { client.rest }
}


