import SwiftUI
import Supabase

// MARK: - Swap Request Sheet

/// Bottom sheet to request a shift swap.
/// Employee selects a shift, writes an optional reason, and submits.
struct SwapRequestSheet: View {
    let shift: PlannedShift
    let employeeId: UUID
    let locationId: UUID
    let onDismiss: () -> Void

    @State private var reason = ""
    @State private var isSending = false
    @State private var showSuccess = false
    @State private var showError = false
    @State private var errorMessage = ""

    private let supabase = SupabaseManager.shared.client
    private let cache = CacheManager.shared

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: JSpacing.lg) {
                    // MARK: - Shift Summary
                    shiftSummary

                    // MARK: - Reason Input
                    reasonInput

                    // MARK: - Submit Button
                    submitButton
                }
                .padding(.horizontal, JSpacing.lg)
                .padding(.top, JSpacing.lg)
                .padding(.bottom, JSpacing.xxl)
            }
            .background(JColor.background)
            .navigationTitle("Solicitar Intercambio")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { onDismiss() }
                }
            }
            .errorBanner(errorMessage, isPresented: $showError)
        }
    }

    // MARK: - Shift Summary

    private var shiftSummary: some View {
        VStack(alignment: .leading, spacing: JSpacing.sm) {
            Text("Turno a intercambiar")
                .font(.jSectionHeader)
                .foregroundStyle(JColor.textPrimary)

            JCard {
                ShiftRow(shift: shift)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Turno a intercambiar")
    }

    // MARK: - Reason Input

    private var reasonInput: some View {
        VStack(alignment: .leading, spacing: JSpacing.sm) {
            Text("Motivo (opcional)")
                .font(.jSectionHeader)
                .foregroundStyle(JColor.textPrimary)

            JCard {
                TextEditor(text: $reason)
                    .font(.jBody)
                    .foregroundStyle(JColor.textPrimary)
                    .frame(minHeight: 100)
                    .scrollContentBackground(.hidden)
                    .accessibilityLabel("Motivo del intercambio")
                    .accessibilityHint("Escribe por qué necesitas intercambiar este turno")
            }

            Text("Escribe por qué necesitas intercambiar este turno.")
                .font(.jCaption)
                .foregroundStyle(JColor.textMuted)
        }
    }

    // MARK: - Submit Button

    private var submitButton: some View {
        VStack(spacing: JSpacing.md) {
            if showSuccess {
                HStack(spacing: JSpacing.sm) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(JColor.success)
                        .accessibilityHidden(true)
                    Text("Solicitud enviada correctamente")
                        .font(.jCallout)
                        .foregroundStyle(JColor.success)
                }
                .transition(.opacity.combined(with: .scale))
                .accessibilityLabel("Solicitud enviada correctamente")
            }

            Button {
                Task { await submitSwapRequest() }
            } label: {
                HStack(spacing: JSpacing.sm) {
                    if isSending {
                        ProgressView()
                            .tint(.white)
                    }
                    Text(isSending ? "Enviando…" : "Solicitar Intercambio")
                        .font(.jBodyBold)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, JSpacing.md)
                .background(showSuccess ? JColor.success : JColor.accent)
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: JRadius.md))
            }
            .disabled(isSending || showSuccess)
            .accessibilityLabel(isSending ? "Enviando solicitud" : (showSuccess ? "Solicitud enviada" : "Solicitar intercambio"))
            .accessibilityHint(showSuccess ? "" : "Pulsa para enviar la solicitud de intercambio de turno")
        }
    }

    // MARK: - Submit Action

    private func submitSwapRequest() async {
        isSending = true
        defer { isSending = false }

        let dto = ShiftSwapInsert(
            locationId: locationId,
            requesterId: employeeId,
            targetId: nil,
            requesterShiftId: shift.id,
            targetShiftId: nil,
            reason: reason.isEmpty ? nil : reason
        )

        do {
            try await supabase
                .from("shift_swap_requests")
                .insert(dto)
                .execute()

            // Sync cache with fresh data
            try? await cache.sync(.swapRequests, force: true)

            HapticManager.play(.success)

            withAnimation(.spring(response: 0.4)) {
                showSuccess = true
            }

            // Auto-dismiss after brief confirmation
            try? await Task.sleep(for: .seconds(1.2))
            onDismiss()

        } catch {
            errorMessage = "No se pudo enviar la solicitud. Inténtalo de nuevo."
            showError = true
            HapticManager.play(.error)
        }
    }
}
