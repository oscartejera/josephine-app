import SwiftUI

// MARK: - Error Banner (Toast)
/// A slide-down toast that auto-dismisses after `duration` seconds.
/// Supports `.error` and `.warning` severity levels.
struct ErrorBanner: View {
    enum Severity {
        case error, warning

        var icon: String {
            switch self {
            case .error:   return "exclamationmark.triangle.fill"
            case .warning: return "exclamationmark.circle.fill"
            }
        }

        var color: Color {
            switch self {
            case .error:   return JColor.error
            case .warning: return JColor.warning
            }
        }
    }

    let message: String
    var severity: Severity = .error
    var duration: TimeInterval = 4.0
    @Binding var isPresented: Bool

    var body: some View {
        if isPresented {
            HStack(spacing: JSpacing.sm) {
                Image(systemName: severity.icon)
                    .font(.jBody)
                    .foregroundStyle(severity.color)

                Text(message)
                    .font(.jCallout)
                    .foregroundStyle(.white)
                    .lineLimit(2)

                Spacer()

                Button {
                    withAnimation(.easeInOut(duration: 0.25)) {
                        isPresented = false
                    }
                } label: {
                    Image(systemName: "xmark")
                        .font(.jCaption)
                        .foregroundStyle(JColor.textMuted)
                }
            }
            .padding(JSpacing.md)
            .background(JColor.surfaceElevated)
            .clipShape(RoundedRectangle(cornerRadius: JRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: JRadius.md)
                    .stroke(severity.color.opacity(0.3), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.3), radius: 8, y: 4)
            .padding(.horizontal, JSpacing.lg)
            .transition(.move(edge: .top).combined(with: .opacity))
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(severity == .error ? "Error" : "Aviso"): \(message)")
            .accessibilityAddTraits(.isStatusElement)
            .accessibilityAction(.escape) {
                withAnimation(.easeInOut(duration: 0.25)) { isPresented = false }
            }
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + duration) {
                    withAnimation(.easeInOut(duration: 0.25)) {
                        isPresented = false
                    }
                }
            }
        }
    }
}

// MARK: - View Modifier for easy overlay usage
struct ErrorBannerModifier: ViewModifier {
    let message: String
    let severity: ErrorBanner.Severity
    @Binding var isPresented: Bool

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .top) {
                ErrorBanner(
                    message: message,
                    severity: severity,
                    isPresented: $isPresented
                )
                .animation(.spring(response: 0.4, dampingFraction: 0.8), value: isPresented)
            }
    }
}

extension View {
    func errorBanner(
        _ message: String,
        severity: ErrorBanner.Severity = .error,
        isPresented: Binding<Bool>
    ) -> some View {
        modifier(ErrorBannerModifier(
            message: message,
            severity: severity,
            isPresented: isPresented
        ))
    }
}
