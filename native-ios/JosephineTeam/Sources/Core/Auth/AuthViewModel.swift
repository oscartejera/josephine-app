import Foundation
import Supabase
import Combine

@MainActor
final class AuthViewModel: ObservableObject {
    // MARK: - Published State
    @Published var isAuthenticated = false
    @Published var isLoading = true

    @Published var errorMessage: String?
    @Published var currentUser: User?

    // MARK: - Employee Context (loaded after auth)
    @Published var employee: Employee?
    @Published var locationName: String?

    private let supabase = SupabaseManager.shared

    init() {
        Task { await checkSession() }
    }

    // MARK: - Check Existing Session
    func checkSession() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let session = try await supabase.auth.session
            currentUser = session.user
            isAuthenticated = true
            await loadEmployeeContext()
        } catch {
            isAuthenticated = false
        }
    }

    // MARK: - Sign In

    /// Overload used by the new multi-step LoginView
    func signIn(email: String, password: String) async {
        guard !email.isEmpty, !password.isEmpty else {
            errorMessage = "Introduce tu email y contraseña"
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            let session = try await supabase.auth.signIn(
                email: email,
                password: password
            )
            currentUser = session.user
            isAuthenticated = true
            await loadEmployeeContext()
        } catch {
            errorMessage = mapAuthError(error)
        }

        isLoading = false
    }

    // MARK: - Sign Out
    func signOut() async {
        // Deactivate push token before sign-out
        await AppDelegate.removeDeviceToken()

        do {
            try await supabase.auth.signOut()
        } catch {
            // Ignore sign-out errors
        }
        currentUser = nil
        employee = nil
        locationName = nil
        isAuthenticated = false
    }

    // MARK: - Reset Password
    func resetPassword(email: String) async throws {
        try await supabase.auth.resetPasswordForEmail(email)
    }

    // MARK: - Load Employee Context
    /// After auth, load the employee record and location name
    func loadEmployeeContext() async {
        guard let userId = currentUser?.id else { return }

        do {
            // 1. Get employee
            let emp: Employee = try await supabase.client
                .from("employees")
                .select("id, full_name, location_id, hourly_cost, active, user_id")
                .eq("user_id", value: userId.uuidString)
                .eq("active", value: true)
                .limit(1)
                .single()
                .execute()
                .value

            employee = emp

            // 2. Get location name
            let loc: Location = try await supabase.client
                .from("locations")
                .select("id, name")
                .eq("id", value: emp.locationId.uuidString)
                .single()
                .execute()
                .value

            locationName = loc.name
        } catch {
            // Employee not found — user might not be a staff member
            employee = nil
            locationName = nil
        }
    }

    // MARK: - Error Mapping
    private func mapAuthError(_ error: Error) -> String {
        let msg = error.localizedDescription.lowercased()
        if msg.contains("invalid login") || msg.contains("invalid_credentials") {
            return "Email o contraseña incorrectos"
        }
        if msg.contains("email not confirmed") {
            return "Confirma tu email antes de iniciar sesión"
        }
        if msg.contains("network") || msg.contains("offline") {
            return "Sin conexión a internet"
        }
        return "Error al iniciar sesión. Inténtalo de nuevo."
    }
}
