import SwiftUI

// MARK: - Typography (SF Pro native)
extension Font {
    // Headlines
    static let jLargeTitle = Font.system(size: 34, weight: .bold, design: .rounded)
    static let jTitle1 = Font.system(size: 28, weight: .bold)
    static let jTitle2 = Font.system(size: 22, weight: .bold)
    static let jTitle3 = Font.system(size: 20, weight: .semibold)

    // Body
    static let jBody = Font.system(size: 17)
    static let jBodyBold = Font.system(size: 17, weight: .semibold)
    static let jCallout = Font.system(size: 16)

    // Detail
    static let jSubheadline = Font.system(size: 15, weight: .medium)
    static let jFootnote = Font.system(size: 13)
    static let jCaption = Font.system(size: 12, weight: .medium)
    static let jCaption2 = Font.system(size: 11)

    // Special
    static let jClock = Font.system(size: 64, weight: .thin, design: .rounded)
    static let jTimer = Font.system(size: 48, weight: .light, design: .monospaced)
    static let jStatNumber = Font.system(size: 32, weight: .bold, design: .rounded)
}

// MARK: - Spacing
enum JSpacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 24
    static let xxl: CGFloat = 32
    static let xxxl: CGFloat = 48
}

// MARK: - Corner Radius
enum JRadius {
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 24
    static let full: CGFloat = 999
}
