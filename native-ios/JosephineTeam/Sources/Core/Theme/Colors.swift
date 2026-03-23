import SwiftUI

// MARK: - Color Palette
enum JColor {
    /// Josephine accent: orange #F97316
    static let accent = Color(hex: 0xF97316)

    /// Dark background
    static let background = Color(hex: 0x0F0F0F)

    /// Card surface
    static let surface = Color(hex: 0x1A1A1A)

    /// Elevated surface (cards, sheets)
    static let surfaceElevated = Color(hex: 0x242424)

    /// Subtle border
    static let border = Color.white.opacity(0.08)

    /// Primary text
    static let textPrimary = Color.white

    /// Secondary text
    static let textSecondary = Color.white.opacity(0.6)

    /// Muted text
    static let textMuted = Color.white.opacity(0.35)

    // MARK: - Semantic Colors
    static let success = Color(hex: 0x22C55E)
    static let warning = Color(hex: 0xEAB308)
    static let error = Color(hex: 0xEF4444)
    static let info = Color(hex: 0x3B82F6)

    // MARK: - Role Colors (shift calendar)
    static let roleCamarero = Color(hex: 0x8B5CF6)  // purple
    static let roleCocinero = Color(hex: 0xF97316)   // orange
    static let roleBarra = Color(hex: 0x06B6D4)      // cyan
    static let roleLimpieza = Color(hex: 0x84CC16)    // lime
    static let roleEncargado = Color(hex: 0xEC4899)   // pink

    static func forRole(_ role: String) -> Color {
        switch role.lowercased() {
        case "camarero", "waiter":      return roleCamarero
        case "cocinero", "cook", "chef": return roleCocinero
        case "barra", "bartender":      return roleBarra
        case "limpieza", "cleaning":    return roleLimpieza
        case "encargado", "manager":    return roleEncargado
        default:                        return accent
        }
    }
}

// MARK: - Color Extension
extension Color {
    init(hex: UInt, alpha: Double = 1.0) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255.0,
            green: Double((hex >> 8) & 0xFF) / 255.0,
            blue: Double(hex & 0xFF) / 255.0,
            opacity: alpha
        )
    }
}
