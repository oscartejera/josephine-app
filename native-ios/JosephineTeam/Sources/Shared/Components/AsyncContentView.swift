import SwiftUI

// MARK: - Async Content View

/// Reusable wrapper that handles loading / error / empty / content states.
///
/// Usage:
/// ```swift
/// AsyncContentView(loadingStyle: .skeleton) {
///     try await viewModel.fetchShifts()
/// } content: { shifts in
///     ForEach(shifts) { shift in ShiftRow(shift) }
/// }
/// ```
struct AsyncContentView<Value, Content: View>: View {

    enum LoadingStyle {
        case spinner
        case skeleton
    }

    enum Phase {
        case idle
        case loading
        case loaded(Value)
        case empty
        case error(Error)
    }

    let loadingStyle: LoadingStyle
    let emptyMessage: String
    let emptyIcon: String
    let fetch: () async throws -> Value
    let isEmpty: (Value) -> Bool
    let content: (Value) -> Content

    @State private var phase: Phase = .idle

    init(
        loadingStyle: LoadingStyle = .spinner,
        emptyMessage: String = "No hay datos disponibles",
        emptyIcon: String = "tray",
        fetch: @escaping () async throws -> Value,
        isEmpty: @escaping (Value) -> Bool = { _ in false },
        @ViewBuilder content: @escaping (Value) -> Content
    ) {
        self.loadingStyle = loadingStyle
        self.emptyMessage = emptyMessage
        self.emptyIcon = emptyIcon
        self.fetch = fetch
        self.isEmpty = isEmpty
        self.content = content
    }

    var body: some View {
        Group {
            switch phase {
            case .idle, .loading:
                loadingView

            case .loaded(let value):
                content(value)
                    .refreshable { await load() }

            case .empty:
                emptyView
                    .refreshable { await load() }

            case .error(let error):
                errorView(error)
            }
        }
        .task { await load() }
    }

    // MARK: - Load

    private func load() async {
        phase = .loading
        do {
            let value = try await fetch()
            if isEmpty(value) {
                phase = .empty
            } else {
                withAnimation(.easeInOut(duration: 0.25)) {
                    phase = .loaded(value)
                }
            }
        } catch {
            phase = .error(error)
        }
    }

    // MARK: - Loading View

    @ViewBuilder
    private var loadingView: some View {
        switch loadingStyle {
        case .spinner:
            VStack(spacing: 12) {
                ProgressView()
                    .tint(JColor.accent)
                    .scaleEffect(1.2)
                Text("Cargando...")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

        case .skeleton:
            VStack(spacing: 12) {
                ForEach(0..<4, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: 12)
                        .fill(JColor.card.opacity(0.5))
                        .frame(height: 72)
                        .shimmer()
                }
            }
            .padding()
        }
    }

    // MARK: - Empty View

    private var emptyView: some View {
        VStack(spacing: 16) {
            Image(systemName: emptyIcon)
                .font(.system(size: 48))
                .foregroundStyle(JColor.accent.opacity(0.6))

            Text(emptyMessage)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }

    // MARK: - Error View

    private func errorView(_ error: Error) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 48))
                .foregroundStyle(.red.opacity(0.8))

            Text("Algo ha ido mal")
                .font(.headline)
                .foregroundStyle(.primary)

            Text(error.localizedDescription)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .lineLimit(3)

            Button {
                Task { await load() }
            } label: {
                Label("Reintentar", systemImage: "arrow.clockwise")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 24)
                    .padding(.vertical, 10)
                    .background(JColor.accent)
                    .foregroundStyle(.white)
                    .clipShape(Capsule())
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
}

// MARK: - Shimmer Modifier

extension View {
    func shimmer() -> some View {
        modifier(ShimmerModifier())
    }
}

private struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { geo in
                    LinearGradient(
                        colors: [
                            .clear,
                            .white.opacity(0.08),
                            .clear
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: geo.size.width * 0.6)
                    .offset(x: phase * geo.size.width * 1.6 - geo.size.width * 0.3)
                }
                .clipped()
            )
            .onAppear {
                withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
    }
}
