import Foundation

// MARK: - App Environment

/// Centralized configuration per build environment.
/// Debug builds → development, Release → production.
/// Add a "staging" xcconfig if needed later.
enum AppEnvironment {
    case development
    case staging
    case production

    // MARK: - Current Environment (auto-detect)
    static var current: AppEnvironment {
        #if DEBUG
        return .development
        #else
        return .production
        #endif
    }

    // MARK: - Supabase

    var supabaseURL: URL {
        switch self {
        case .development, .staging:
            return URL(string: "https://qixipveebfhurbarksib.supabase.co")!
        case .production:
            return URL(string: "https://qixipveebfhurbarksib.supabase.co")!
        }
    }

    var supabaseAnonKey: String {
        guard let key = Bundle.main.infoDictionary?["SUPABASE_ANON_KEY"] as? String,
              !key.isEmpty,
              !key.contains("PLACEHOLDER") else {
            fatalError(
                "SUPABASE_ANON_KEY not configured. "
                + "Set it in Codemagic env group 'supabase_keys'."
            )
        }
        return key
    }

    // MARK: - Feature Flags

    var isLoggingEnabled: Bool {
        switch self {
        case .development, .staging: return true
        case .production: return false
        }
    }

    var cacheTTLSeconds: TimeInterval {
        switch self {
        case .development: return 60          // 1 min in dev (fast iteration)
        case .staging:     return 180         // 3 min
        case .production:  return 300         // 5 min
        }
    }

    var displayName: String {
        switch self {
        case .development: return "DEV"
        case .staging:     return "STG"
        case .production:  return "PROD"
        }
    }
}
