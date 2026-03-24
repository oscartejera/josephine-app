import Foundation

// MARK: - Email Validation

extension String {
    /// Validates email format using a standard RFC‑style regex.
    /// Shared across LoginView and ForgotPasswordView.
    var isValidEmail: Bool {
        let pattern = #"^[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"#
        return range(of: pattern, options: .regularExpression) != nil
    }
}
