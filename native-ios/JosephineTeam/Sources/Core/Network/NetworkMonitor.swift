import Foundation
import Network

// MARK: - Network Monitor

/// Observable wrapper around `NWPathMonitor`.
/// Tracks connectivity state for offline banner + cache decisions.
@MainActor
@Observable
final class NetworkMonitor {
    static let shared = NetworkMonitor()

    private(set) var isConnected = true
    private(set) var connectionType: ConnectionType = .unknown

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.josephine.networkMonitor", qos: .utility)

    enum ConnectionType: String, Sendable {
        case wifi
        case cellular
        case wiredEthernet
        case unknown

        var label: String {
            switch self {
            case .wifi:          return "Wi-Fi"
            case .cellular:      return "Datos móviles"
            case .wiredEthernet: return "Ethernet"
            case .unknown:       return "Desconocido"
            }
        }
    }

    private init() {
        startMonitoring()
    }

    private func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            let connected = path.status == .satisfied
            let type: ConnectionType = {
                if path.usesInterfaceType(.wifi) { return .wifi }
                if path.usesInterfaceType(.cellular) { return .cellular }
                if path.usesInterfaceType(.wiredEthernet) { return .wiredEthernet }
                return .unknown
            }()

            Task { @MainActor [weak self] in
                self?.isConnected = connected
                self?.connectionType = type
            }
        }
        monitor.start(queue: queue)
    }

    deinit {
        monitor.cancel()
    }
}
