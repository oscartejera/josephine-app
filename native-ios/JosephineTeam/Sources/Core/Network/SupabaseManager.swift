import Foundation
import Supabase

// MARK: - Supabase Singleton
@MainActor
final class SupabaseManager: Sendable {
    static let shared = SupabaseManager()

    let client: SupabaseClient

    private init() {
        // These values should match your .env / Supabase dashboard
        // In production, inject via Info.plist or xcconfig per environment
        let url = URL(string: ProcessInfo.processInfo.environment["SUPABASE_URL"]
            ?? Bundle.main.infoDictionary?["SUPABASE_URL"] as? String
            ?? "https://YOUR_PROJECT.supabase.co")!

        let anonKey = ProcessInfo.processInfo.environment["SUPABASE_ANON_KEY"]
            ?? Bundle.main.infoDictionary?["SUPABASE_ANON_KEY"] as? String
            ?? "YOUR_ANON_KEY"

        client = SupabaseClient(supabaseURL: url, supabaseKey: anonKey)
    }

    // MARK: - Convenience Accessors
    var auth: AuthClient { client.auth }

    /// Direct access to the Postgrest client for raw queries.
    /// Feature views should prefer `client.from("table_name")` instead.
    var db: PostgrestClient { client.rest }
}


