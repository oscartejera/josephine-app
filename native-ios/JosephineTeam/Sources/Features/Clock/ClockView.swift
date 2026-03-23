import SwiftUI
import CoreLocation
import Combine
import Supabase

struct ClockView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @StateObject private var locationManager = LocationManager()

    @State private var activeRecord: ClockRecord?
    @State private var todayRecords: [ClockRecord] = []
    @State private var isProcessing = false
    @State private var elapsedSeconds: Int = 0
    @State private var timerCancellable: AnyCancellable?

    private let supabase = SupabaseManager.shared

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: JSpacing.xl) {

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
            .toolbarColorScheme(.dark, for: .navigationBar)
            .task { await loadClockData() }
        }
    }

    // MARK: - Clock Display
    private var clockDisplay: some View {
        VStack(spacing: JSpacing.md) {
            if activeRecord != nil {
                // Active timer
                Text(formatElapsed(elapsedSeconds))
                    .font(.jTimer)
                    .foregroundStyle(JColor.success)
                    .monospacedDigit()

                Text("Tiempo trabajado")
                    .font(.jCallout)
                    .foregroundStyle(JColor.textSecondary)
            } else {
                // Current time
                Text(Date().formatted(date: .omitted, time: .shortened))
                    .font(.jClock)
                    .foregroundStyle(.white)

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

        return Button {
            Task {
                if isClockedIn {
                    await clockOut()
                } else {
                    await clockIn()
                }
            }
        } label: {
            VStack(spacing: JSpacing.sm) {
                if isProcessing {
                    ProgressView()
                        .tint(.white)
                        .frame(width: 120, height: 120)
                } else {
                    Image(systemName: isClockedIn ? "stop.circle.fill" : "play.circle.fill")
                        .font(.system(size: 72))
                        .foregroundStyle(isClockedIn ? JColor.error : JColor.success)
                        .frame(width: 120, height: 120)
                }

                Text(isClockedIn ? "Fichar Salida" : "Fichar Entrada")
                    .font(.jTitle3)
                    .foregroundStyle(.white)
            }
        }
        .disabled(isProcessing)
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

    // MARK: - Today's Records
    private var todayRecordsList: some View {
        VStack(alignment: .leading, spacing: JSpacing.md) {
            Text("Fichajes de hoy")
                .font(.jTitle3)
                .foregroundStyle(.white)

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
                ForEach(todayRecords) { record in
                    JCard {
                        HStack {
                            VStack(alignment: .leading, spacing: JSpacing.xs) {
                                Text(record.clockIn.formatted(date: .omitted, time: .shortened))
                                    .font(.jBodyBold)
                                    .foregroundStyle(.white)
                                Text(record.isActive ? "En curso" : record.durationString)
                                    .font(.jCaption)
                                    .foregroundStyle(record.isActive ? JColor.success : JColor.textSecondary)
                            }

                            Spacer()

                            if let clockOut = record.clockOut {
                                Text(clockOut.formatted(date: .omitted, time: .shortened))
                                    .font(.jBody)
                                    .foregroundStyle(JColor.textSecondary)
                            } else {
                                JBadge(text: "Activo", color: JColor.success)
                            }
                        }
                    }
                }
            }
        }
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
            await loadClockData()
        } catch {
            // TODO: Show error toast
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
            stopTimer()
            await loadClockData()
        } catch {
            // TODO: Show error toast
        }
    }

    // MARK: - Data Loading
    private func loadClockData() async {
        guard let emp = authVM.employee else { return }

        let today = DateFormatter.yyyyMMdd.string(from: Date())
        let todayStart = "\(today)T00:00:00"
        let todayEnd = "\(today)T23:59:59"

        do {
            todayRecords = try await supabase.client
                .from("employee_clock_records")
                .select()
                .eq("employee_id", value: emp.id.uuidString)
                .gte("clock_in", value: todayStart)
                .lte("clock_in", value: todayEnd)
                .order("clock_in", ascending: false)
                .execute()
                .value

            activeRecord = todayRecords.first(where: { $0.isActive })

            if activeRecord != nil {
                startTimer()
            } else {
                stopTimer()
            }
        } catch {
            todayRecords = []
            activeRecord = nil
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
