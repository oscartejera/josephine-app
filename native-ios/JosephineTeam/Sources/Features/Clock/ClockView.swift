import SwiftUI
import CoreLocation
import Combine
@preconcurrency import Supabase

struct ClockView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @StateObject private var locationManager = LocationManager()

    @State private var activeRecord: ClockRecord?
    @State private var todayRecords: [ClockRecord] = []
    @State private var isProcessing = false
    @State private var elapsedSeconds: Int = 0
    @State private var timerCancellable: AnyCancellable?
    @State private var showError = false
    @State private var errorMessage = ""
    @State private var realtimeTask: Task<Void, Never>?

    // Animation states
    @State private var showClockResult = false
    @State private var clockResultIcon = "checkmark.circle.fill"
    @State private var clockResultColor: Color = .green
    @State private var buttonScale: CGFloat = 1.0
    @State private var glowPulse = false

    private let supabase = SupabaseManager.shared
    private let cache = CacheManager.shared

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: JSpacing.xl) {
                    OfflineBanner()

                    // MARK: - Clock Display
                    clockDisplay

                    // MARK: - Action Button
                    clockButton

                    // MARK: - Location Status
                    locationStatus

                    // MARK: - Today's Records
                    todayRecordsList
                }
                .padding(.horizontal, JSpacing.lg)
                .padding(.bottom, JSpacing.xxl)
            }
            .background(JColor.background)
            .navigationTitle("Fichaje")
            .refreshable {
                await loadClockData()
                HapticManager.play(.success)
            }
            .task { await loadClockData() }
            .task { await startRealtimeSync() }
            .onDisappear {
                realtimeTask?.cancel()
                realtimeTask = nil
            }
            .errorBanner(errorMessage, isPresented: $showError)
        }
    }

    // MARK: - Clock Display
    private var clockDisplay: some View {
        VStack(spacing: JSpacing.md) {
            if activeRecord != nil {
                // Active timer
                Text(formatElapsed(elapsedSeconds))
                    .font(.jTimer)
                    .foregroundStyle(JColor.accent)
                    .monospacedDigit()

                Text("Tiempo trabajado")
                    .font(.jCallout)
                    .foregroundStyle(JColor.textSecondary)
            } else {
                // Current time
                Text(Date().formatted(date: .omitted, time: .shortened))
                    .font(.jClock)
                    .foregroundStyle(JColor.textPrimary)

                Text(Date().formatted(date: .complete, time: .omitted).capitalized)
                    .font(.jCallout)
                    .foregroundStyle(JColor.textSecondary)
            }
        }
        .padding(.top, JSpacing.xxxl)
    }

    // MARK: - Clock In / Out Button
    private var clockButton: some View {
        let isClockedIn = activeRecord != nil
        let ringColor = isClockedIn ? JColor.success : JColor.accent

        return Button {
            Task {
                withAnimation(.easeIn(duration: 0.1)) { buttonScale = 0.9 }
                if isClockedIn {
                    await clockOut()
                } else {
                    await clockIn()
                }
                withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) { buttonScale = 1.0 }
            }
        } label: {
            ZStack {
                // Outer glow rings
                Circle()
                    .stroke(ringColor.opacity(0.08), lineWidth: 32)
                    .frame(width: 200, height: 200)
                    .scaleEffect(glowPulse ? 1.1 : 1.0)

                Circle()
                    .stroke(ringColor.opacity(0.15), lineWidth: 16)
                    .frame(width: 170, height: 170)
                    .scaleEffect(glowPulse ? 1.05 : 1.0)

                Circle()
                    .stroke(ringColor.opacity(0.25), lineWidth: 6)
                    .frame(width: 146, height: 146)

                // Main button circle
                Circle()
                    .fill(ringColor)
                    .frame(width: 140, height: 140)
                    .shadow(color: ringColor.opacity(0.4), radius: 20, x: 0, y: 8)

                // Content inside the circle
                VStack(spacing: JSpacing.xs) {
                    if isProcessing {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Image(systemName: isClockedIn ? "stop.fill" : "play.fill")
                            .font(.system(size: 32, weight: .medium))
                            .foregroundStyle(.white)
                    }

                    Text(isClockedIn ? "SALIDA" : "ENTRADA")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white.opacity(0.9))
                        .tracking(1.5)
                }
                .opacity(showClockResult ? 0.3 : 1.0)

                // Success / Error result overlay
                if showClockResult {
                    Image(systemName: clockResultIcon)
                        .font(.system(size: 48))
                        .foregroundStyle(.white)
                        .transition(.scale.combined(with: .opacity))
                }
            }
        }
        .scaleEffect(buttonScale)
        .disabled(isProcessing)
        .onAppear {
            withAnimation(.easeInOut(duration: 2.0).repeatForever(autoreverses: true)) {
                glowPulse = true
            }
        }
        .accessibilityLabel(isClockedIn ? "Fichar salida" : "Fichar entrada")
        .accessibilityIdentifier("clock_button")
        .accessibilityHint(isProcessing ? "Procesando" : "")
    }

    // MARK: - Location Status
    private var locationStatus: some View {
        HStack(spacing: JSpacing.sm) {
            Image(systemName: locationManager.hasLocation ? "location.fill" : "location.slash.fill")
                .font(.jCaption)
                .foregroundStyle(locationManager.hasLocation ? JColor.success : JColor.warning)

            Text(locationManager.hasLocation
                 ? "Ubicación disponible"
                 : "Ubicación no disponible")
                .font(.jCaption)
                .foregroundStyle(JColor.textSecondary)
        }
    }

    // MARK: - Today's Records (horizontal scroll)
    private var todayRecordsList: some View {
        VStack(alignment: .leading, spacing: JSpacing.md) {
            Text("Fichajes de hoy")
                .font(.jTitle3)
                .foregroundStyle(JColor.textPrimary)
                .padding(.horizontal, JSpacing.lg)

            if todayRecords.isEmpty {
                JCard {
                    HStack {
                        Image(systemName: "clock.badge.questionmark")
                            .foregroundStyle(JColor.textMuted)
                        Text("Sin fichajes hoy")
                            .font(.jCallout)
                            .foregroundStyle(JColor.textSecondary)
                        Spacer()
                    }
                }
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: JSpacing.md) {
                        ForEach(todayRecords) { record in
                            VStack(alignment: .leading, spacing: JSpacing.sm) {
                                // Time range
                                HStack(spacing: JSpacing.xs) {
                                    RoundedRectangle(cornerRadius: 2)
                                        .fill(record.isActive ? JColor.success : JColor.accent)
                                        .frame(width: 3, height: 32)

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(record.clockIn.formatted(date: .omitted, time: .shortened))
                                            .font(.jBodyBold)
                                            .foregroundStyle(JColor.textPrimary)
                                        if let clockOut = record.clockOut {
                                            Text(clockOut.formatted(date: .omitted, time: .shortened))
                                                .font(.jCaption)
                                                .foregroundStyle(JColor.textSecondary)
                                        } else {
                                            Text("En curso")
                                                .font(.jCaption)
                                                .foregroundStyle(JColor.success)
                                        }
                                    }
                                }

                                // Duration or active badge
                                if record.isActive {
                                    JBadge(text: "Activo", color: JColor.success)
                                } else {
                                    Text(record.durationString)
                                        .font(.jCaption)
                                        .foregroundStyle(JColor.accent)
                                        .padding(.horizontal, JSpacing.sm)
                                        .padding(.vertical, JSpacing.xs)
                                        .background(JColor.accent.opacity(0.1))
                                        .clipShape(Capsule())
                                }
                            }
                            .padding(JSpacing.lg)
                            .frame(width: 140)
                            .background(JColor.card)
                            .clipShape(RoundedRectangle(cornerRadius: JRadius.lg))
                            .shadow(color: .black.opacity(0.06), radius: 8, x: 0, y: 2)
                        }
                    }
                    .padding(.horizontal, JSpacing.lg)
                }
            }
        }
        .padding(.horizontal, -JSpacing.lg) // compensate parent padding for full-bleed scroll
    }

    // MARK: - Actions
    private func clockIn() async {
        guard let emp = authVM.employee else { return }
        isProcessing = true
        defer { isProcessing = false }

        let loc = locationManager.lastLocation

        let insert = ClockInInsert(
            employeeId: emp.id,
            locationId: emp.locationId,
            clockIn: Date(),
            clockInLat: loc?.coordinate.latitude,
            clockInLng: loc?.coordinate.longitude,
            source: "geo"
        )

        do {
            try await supabase.client
                .from("employee_clock_records")
                .insert(insert)
                .execute()
            HapticManager.play(.clockIn)
            await showResultAnimation(success: true)
            await loadClockData()
        } catch {
            errorMessage = "Error al fichar entrada. Inténtalo de nuevo."
            showError = true
            HapticManager.play(.error)
            await showResultAnimation(success: false)
        }
    }

    private func clockOut() async {
        guard let record = activeRecord else { return }
        isProcessing = true
        defer { isProcessing = false }

        let loc = locationManager.lastLocation

        let update = ClockOutUpdate(
            clockOut: Date(),
            clockOutLat: loc?.coordinate.latitude,
            clockOutLng: loc?.coordinate.longitude
        )

        do {
            try await supabase.client
                .from("employee_clock_records")
                .update(update)
                .eq("id", value: record.id.uuidString)
                .execute()
            HapticManager.play(.clockOut)
            await showResultAnimation(success: true)
            stopTimer()
            await loadClockData()
        } catch {
            errorMessage = "Error al fichar salida. Inténtalo de nuevo."
            showError = true
            HapticManager.play(.error)
            await showResultAnimation(success: false)
        }
    }

    // MARK: - Data Loading
    private func loadClockData() async {
        guard let emp = authVM.employee else { return }

        let today = DateFormatter.yyyyMMdd.string(from: Date())

        // 1. Read from cache instantly
        do {
            let cached = try cache.clockRecords(for: emp.id)
            let todayCached = cached.filter { DateFormatter.yyyyMMdd.string(from: $0.clockIn) == today }
                .sorted { $0.clockIn > $1.clockIn }
            if !todayCached.isEmpty {
                todayRecords = todayCached
                activeRecord = todayCached.first(where: { $0.isActive })
                if activeRecord != nil { startTimer() } else { stopTimer() }
            }
        } catch { /* Cache miss */ }

        // 2. Sync from network in background
        do {
            try await cache.sync(.clockRecords, force: true)
            // 3. Re-read from cache after sync
            let fresh = try cache.clockRecords(for: emp.id)
            todayRecords = fresh.filter { DateFormatter.yyyyMMdd.string(from: $0.clockIn) == today }
                .sorted { $0.clockIn > $1.clockIn }
            activeRecord = todayRecords.first(where: { $0.isActive })
            if activeRecord != nil { startTimer() } else { stopTimer() }
        } catch {
            if todayRecords.isEmpty {
                errorMessage = "No se pudieron cargar los fichajes. Tira hacia abajo para reintentar."
                showError = true
                HapticManager.play(.error)
            }
        }
    }

    // MARK: - Timer
    private func startTimer() {
        guard let record = activeRecord else { return }
        updateElapsed(from: record.clockIn)
        timerCancellable = Timer.publish(every: 1, on: .main, in: .common)
            .autoconnect()
            .sink { _ in
                updateElapsed(from: record.clockIn)
            }
    }

    private func stopTimer() {
        timerCancellable?.cancel()
        timerCancellable = nil
        elapsedSeconds = 0
    }

    private func updateElapsed(from start: Date) {
        elapsedSeconds = Int(Date().timeIntervalSince(start))
    }

    private func formatElapsed(_ totalSeconds: Int) -> String {
        let hours = totalSeconds / 3600
        let minutes = (totalSeconds % 3600) / 60
        let seconds = totalSeconds % 60
        return String(format: "%02d:%02d:%02d", hours, minutes, seconds)
    }

    // MARK: - Realtime Sync
    private func startRealtimeSync() async {
        guard let emp = authVM.employee else { return }

        let channel = supabase.client.realtimeV2.channel("clock-ios-\(emp.id)")

        let changes = channel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "employee_clock_records",
            filter: "employee_id=eq.\(emp.id)"
        )

        await channel.subscribe()

        realtimeTask = Task {
            for await _ in changes {
                guard !Task.isCancelled else { break }
                await loadClockData()
            }
        }
    }

    // MARK: - Result Animation
    private func showResultAnimation(success: Bool) async {
        clockResultIcon = success ? "checkmark.circle.fill" : "xmark.circle.fill"
        clockResultColor = success ? JColor.success : JColor.error
        withAnimation(.spring(response: 0.4, dampingFraction: 0.6)) {
            showClockResult = true
        }
        try? await Task.sleep(for: .seconds(1.2))
        withAnimation(.easeOut(duration: 0.3)) {
            showClockResult = false
        }
    }
}

// MARK: - Location Manager
@MainActor
class LocationManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()

    @Published var lastLocation: CLLocation?
    @Published var hasLocation = false

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.requestWhenInUseAuthorization()
        manager.startUpdatingLocation()
    }

    // CLLocationManagerDelegate callbacks are dispatched on the main thread
    // by CoreLocation, but the protocol is not annotated as @MainActor.
    // With SWIFT_STRICT_CONCURRENCY=complete these must be nonisolated.
    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        MainActor.assumeIsolated {
            lastLocation = locations.last
            hasLocation = lastLocation != nil
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        MainActor.assumeIsolated {
            hasLocation = false
        }
    }
}
