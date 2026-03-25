import SwiftUI

// MARK: - Color Palette (Light Theme)
enum JColor {
    /// Josephine brand purple (pwa-icon gradient)
    static let brandPurple = Color(hex: 0x7C3AED)
    static let brandPurpleDark = Color(hex: 0x6D28D9)

    /// Josephine accent — aligned with web --primary: 245 58% 51%
    static let accent      = Color(hex: 0x5B3FD9)
    static let accentLight = Color(hex: 0x7C5CE7)
    static let accentViolet = Color(hex: 0x9333EA)

    /// Light background
    static let background = Color(hex: 0xF5F4F9)

    /// Card surface
    static let surface = Color.white

    /// Card background (same as surface, semantic alias)
    static let card = Color.white

    /// Elevated surface (cards, sheets)
    static let surfaceElevated = Color.white

    /// Subtle border
    static let border = Color(hex: 0xE4E5EB)

    /// Primary text
    static let textPrimary = Color(hex: 0x1A1A1A)

    /// Secondary text
    static let textSecondary = Color(hex: 0x6B7280)

    /// Muted text (WCAG AA against white / #F5F5F5)
    static let textMuted = Color(hex: 0x9CA3AF)

    // MARK: - Semantic Colors
    static let success = Color(hex: 0x16A34A)
    static let warning = Color(hex: 0xCA8A04)
    static let error = Color(hex: 0xDC2626)
    static let info = Color(hex: 0x2563EB)

    // MARK: - Role Colors (shift calendar)
    static let roleCamarero = Color(hex: 0x7C3AED)  // purple
    static let roleCocinero = Color(hex: 0xEA580C)   // orange
    static let roleBarra = Color(hex: 0x0891B2)      // cyan
    static let roleLimpieza = Color(hex: 0x65A30D)    // lime
    static let roleEncargado = Color(hex: 0xDB2777)   // pink

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

    // MARK: - Login (light mode — unchanged)
    static let loginBackground = Color.white
    static let loginText = Color(hex: 0x111827)
    static let loginTextSecondary = Color(hex: 0x6B7280)
    static let loginInputBorder = Color(hex: 0xD1D5DB)
    static let loginInputFocusBorder = Color(hex: 0x7C3AED)
    static let loginPlaceholder = Color(hex: 0x9CA3AF)
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
