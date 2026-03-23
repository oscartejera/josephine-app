import SwiftUI

// MARK: - Offline Banner

/// Slim banner shown at the top of the screen when the device is offline.
/// Auto-hides with animation when network connectivity is restored.
///
/// Usage: Place at the top of your main content:
/// ```swift
/// VStack(spacing: 0) {
///     OfflineBanner()
///     // ... rest of content
/// }
/// ```
struct OfflineBanner: View {
    @State private var networkMonitor = NetworkMonitor.shared

    var body: some View {
        if !networkMonitor.isConnected {
            HStack(spacing: 8) {
                Image(systemName: "wifi.slash")
                    .font(.caption.weight(.bold))

                Text("Sin conexión — mostrando datos guardados")
                    .font(.caption2.weight(.medium))

                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(.orange.gradient)
            .foregroundStyle(.white)
            .transition(.move(edge: .top).combined(with: .opacity))
            .animation(.spring(duration: 0.4), value: networkMonitor.isConnected)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Sin conexión a internet. Mostrando datos guardados.")
            .accessibilityAddTraits(.updatesFrequently)
        }
    }
}
