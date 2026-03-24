import SwiftUI
import SwiftData

@main
struct JosephineTeamApp: App {
    @StateObject private var authVM = AuthViewModel()
    @State private var showSplash = true
    @State private var minimumTimeElapsed = false
    @State private var onboardingStep: OnboardingStep = .faceID
    @State private var needsOnboarding = false

    enum OnboardingStep {
        case faceID, notifications, done
    }

    var body: some Scene {
        WindowGroup {
            ZStack {
                Group {
                    if authVM.isAuthenticated {
                        if needsOnboarding {
                            onboardingFlow
                                .environmentObject(authVM)
                        } else {
                            ContentView()
                                .environmentObject(authVM)
                        }
                    } else {
                        LoginView()
                            .environmentObject(authVM)
                    }
                }
                .opacity(showSplash ? 0 : 1)

                if showSplash {
                    SplashView()
                        .transition(.opacity)
                        .zIndex(1)
                }
            }
            .tint(JColor.accent)
            .preferredColorScheme(.dark)
            .task {
                await CacheManager.shared.syncAll()
            }
            .task {
                // Minimum 2.5s so both splash animation phases play fully
                try? await Task.sleep(for: .seconds(2.5))
                minimumTimeElapsed = true
                if !authVM.isLoading {
                    withAnimation(.easeOut(duration: 0.5)) {
                        showSplash = false
                    }
                }
            }
            .onChange(of: authVM.isLoading) { _, isLoading in
                guard !isLoading, minimumTimeElapsed else { return }
                withAnimation(.easeOut(duration: 0.5)) {
                    showSplash = false
                }
            }
            .onChange(of: authVM.isAuthenticated) { _, isAuthenticated in
                if isAuthenticated {
                    let hasCompletedOnboarding = UserDefaults.standard.bool(forKey: UserDefaultsKey.hasCompletedOnboarding)
                    needsOnboarding = !hasCompletedOnboarding
                    onboardingStep = .faceID
                } else {
                    needsOnboarding = false
                }
            }
        }
        .modelContainer(CacheManager.shared.container)
    }

    // MARK: - Post-Login Onboarding Flow
    @ViewBuilder
    private var onboardingFlow: some View {
        switch onboardingStep {
        case .faceID:
            FaceIDSetupView(onboardingComplete: Binding(
                get: { onboardingStep != .faceID },
                set: { if $0 {
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                        onboardingStep = .notifications
                    }
                }}
            ))
            .transition(.asymmetric(
                insertion: .move(edge: .trailing).combined(with: .opacity),
                removal: .move(edge: .leading).combined(with: .opacity)
            ))

        case .notifications:
            NotificationPermissionView {
                UserDefaults.standard.set(true, forKey: UserDefaultsKey.hasCompletedOnboarding)
                withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                    onboardingStep = .done
                    needsOnboarding = false
                }
            }
            .transition(.asymmetric(
                insertion: .move(edge: .trailing).combined(with: .opacity),
                removal: .move(edge: .leading).combined(with: .opacity)
            ))

        case .done:
            ContentView()
                .environmentObject(authVM)
        }
    }
}


// MARK: - Splash Screen (animated, TheFork-style 2-phase)
struct SplashView: View {
    // Phase 1: Logo + Text entrance
    @State private var logoScale: CGFloat = 0.6
    @State private var logoOpacity: Double = 0
    @State private var textOpacity: Double = 0
    @State private var textOffset: CGFloat = 12

    // Phase 2: Text exits, logo scales up
    @State private var phase2Active = false
    @State private var logoScalePhase2: CGFloat = 1.0

    // Josephine brand purple
    private let gradientTop = JColor.brandPurple
    private let gradientBottom = JColor.brandPurpleDark

    var body: some View {
        ZStack {
            // Full-screen purple gradient
            LinearGradient(
                colors: [gradientTop, gradientBottom],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 20) {
                // Chef hat icon — custom Lucide ChefHat shape
                ZStack {
                    // Outer circle container (like TheFork's circular logo)
                    Circle()
                        .fill(.white.opacity(0.12))
                        .frame(width: 100, height: 100)

                    // Chef hat SVG path (Lucide, correctly converted)
                    ChefHatShape()
                        .stroke(.white, style: StrokeStyle(
                            lineWidth: 2.8,
                            lineCap: .round,
                            lineJoin: .round
                        ))
                        .frame(width: 52, height: 52)
                }
                .scaleEffect(logoScale * logoScalePhase2)
                .opacity(logoOpacity)

                // Brand name "josephine"
                Text("josephine")
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .opacity(phase2Active ? 0 : textOpacity)
                    .offset(y: phase2Active ? -8 : textOffset)
            }
            // Shift logo up slightly when text disappears (phase 2)
            .offset(y: phase2Active ? -10 : 0)
        }
        .onAppear {
            // ── Phase 1: Logo springs in ──
            withAnimation(.spring(response: 0.5, dampingFraction: 0.65)) {
                logoScale = 1.0
                logoOpacity = 1.0
            }

            // Text slides up and fades in (after logo)
            withAnimation(.easeOut(duration: 0.4).delay(0.3)) {
                textOpacity = 1.0
                textOffset = 0
            }

            // ── Phase 2: Text exits, logo grows (after 1.2s) ──
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                withAnimation(.easeInOut(duration: 0.5)) {
                    phase2Active = true
                    logoScalePhase2 = 1.25
                }
            }
        }
    }
}

// MARK: - Custom Chef Hat Shape (Lucide ChefHat, viewBox 0 0 24 24)
// SVG: M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041
//      a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588
//      c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z  |  M6 17h12
struct ChefHatShape: Shape {
    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 24
        let sy = rect.height / 24
        var p = Path()

        func pt(_ x: Double, _ y: Double) -> CGPoint {
            CGPoint(x: x * sx, y: y * sy)
        }

        // M17 21
        p.move(to: pt(17, 21))
        // a1 1 0 0 0 1-1  →  (17,21)→(18,20)
        svgArc(&p, from: (17, 21), to: (18, 20), r: 1, large: false, sweep: false, sx: sx, sy: sy)
        // v-5.35  →  (18,14.65)
        p.addLine(to: pt(18, 14.65))
        // c0-.457 .316-.844 .727-1.041  →  relative cubic, end (18.727,13.609)
        p.addCurve(to: pt(18.727, 13.609),
                   control1: pt(18, 14.193), control2: pt(18.316, 13.806))
        // a4 4 0 0 0-2.134-7.589  →  right puff (18.727,13.609)→(16.593,6.02)
        svgArc(&p, from: (18.727, 13.609), to: (16.593, 6.02), r: 4, large: false, sweep: false, sx: sx, sy: sy)
        // a5 5 0 0 0-9.186 0  →  top dome (16.593,6.02)→(7.407,6.02) r=5
        svgArc(&p, from: (16.593, 6.02), to: (7.407, 6.02), r: 5, large: false, sweep: false, sx: sx, sy: sy)
        // a4 4 0 0 0-2.134 7.588  →  left puff (7.407,6.02)→(5.273,13.608) r=4
        svgArc(&p, from: (7.407, 6.02), to: (5.273, 13.608), r: 4, large: false, sweep: false, sx: sx, sy: sy)
        // c.411.198 .727.585 .727 1.041  →  relative cubic, end (6.0,14.649)
        p.addCurve(to: pt(6.0, 14.649),
                   control1: pt(5.684, 13.806), control2: pt(6.0, 14.193))
        // V20  →  absolute vertical to y=20
        p.addLine(to: pt(6, 20))
        // a1 1 0 0 0 1 1  →  (6,20)→(7,21)
        svgArc(&p, from: (6, 20), to: (7, 21), r: 1, large: false, sweep: false, sx: sx, sy: sy)
        // Z
        p.closeSubpath()

        // Band line: M6 17 h12  →  (6,17)→(18,17)
        p.move(to: pt(6, 17))
        p.addLine(to: pt(18, 17))

        return p
    }

    /// Converts an SVG arc command to cubic Bézier curves.
    /// Uses W3C SVG F.6.5 / F.6.6 endpoint-to-center parameterization.
    private func svgArc(
        _ path: inout Path,
        from: (Double, Double), to: (Double, Double),
        r: Double, large: Bool, sweep: Bool,
        sx: Double, sy: Double
    ) {
        let (x1, y1) = from
        let (x2, y2) = to
        var rx = abs(r), ry = abs(r)
        guard !(x1 == x2 && y1 == y2), rx > 0 else {
            path.addLine(to: CGPoint(x: x2 * sx, y: y2 * sy)); return
        }

        let dx = (x1 - x2) / 2, dy = (y1 - y2) / 2
        // Ensure radii are large enough
        let lambda = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)
        if lambda > 1 { let s = sqrt(lambda); rx *= s; ry *= s }

        // Center parameterization
        let rx2 = rx * rx, ry2 = ry * ry
        let dx2 = dx * dx, dy2 = dy * dy
        var num = rx2 * ry2 - rx2 * dy2 - ry2 * dx2
        let den = rx2 * dy2 + ry2 * dx2
        if num < 0 { num = 0 }
        var sq = sqrt(num / den)
        if large == sweep { sq = -sq }
        let cxp = sq * rx * dy / ry
        let cyp = -sq * ry * dx / rx
        let cx = cxp + (x1 + x2) / 2
        let cy = cyp + (y1 + y2) / 2

        // Compute angles
        func vecAngle(_ ux: Double, _ uy: Double, _ vx: Double, _ vy: Double) -> Double {
            let d = ux * vx + uy * vy
            let l = sqrt(ux * ux + uy * uy) * sqrt(vx * vx + vy * vy)
            var a = acos(max(-1, min(1, d / l)))
            if ux * vy - uy * vx < 0 { a = -a }
            return a
        }
        let t1 = vecAngle(1, 0, (dx - cxp) / rx, (dy - cyp) / ry)
        var dt = vecAngle((dx - cxp) / rx, (dy - cyp) / ry,
                          (-dx - cxp) / rx, (-dy - cyp) / ry)
        if !sweep && dt > 0 { dt -= 2 * .pi }
        if sweep && dt < 0 { dt += 2 * .pi }

        // Split into ≤90° segments, each → one cubic Bézier
        let segs = max(1, Int(ceil(abs(dt) / (.pi / 2))))
        let seg = dt / Double(segs)
        let alpha = sin(seg) * (sqrt(4 + 3 * pow(tan(seg / 2), 2)) - 1) / 3

        var a = t1
        for _ in 0..<segs {
            let a2 = a + seg
            let x_e = cos(a2) * rx + cx, y_e = sin(a2) * ry + cy
            let c1x = (cos(a) * rx + cx) - alpha * sin(a) * rx
            let c1y = (sin(a) * ry + cy) + alpha * cos(a) * ry
            let c2x = x_e + alpha * sin(a2) * rx
            let c2y = y_e - alpha * cos(a2) * ry
            path.addCurve(to: CGPoint(x: x_e * sx, y: y_e * sy),
                          control1: CGPoint(x: c1x * sx, y: c1y * sy),
                          control2: CGPoint(x: c2x * sx, y: c2y * sy))
            a = a2
        }
    }
}
