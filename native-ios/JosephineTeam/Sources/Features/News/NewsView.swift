import SwiftUI
import Supabase

struct NewsView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @State private var announcements: [Announcement] = []
    @State private var isLoading = false

    private let supabase = SupabaseManager.shared

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: JSpacing.lg) {
                    if isLoading {
                        ProgressView()
                            .tint(JColor.accent)
                            .padding(.top, JSpacing.xxxl)
                    } else if announcements.isEmpty {
                        JEmptyState(
                            icon: "megaphone",
                            title: "Sin noticias",
                            message: "No hay anuncios publicados todavía"
                        )
                    } else {
                        // Pinned first, then by date
                        ForEach(sortedAnnouncements) { item in
                            announcementCard(item)
                        }
                    }
                }
                .padding(.horizontal, JSpacing.lg)
                .padding(.bottom, JSpacing.xxl)
            }
            .background(JColor.background)
            .navigationTitle("Noticias")
            .toolbarColorScheme(.dark, for: .navigationBar)
            .refreshable { await loadAnnouncements() }
            .task { await loadAnnouncements() }
        }
    }

    private var sortedAnnouncements: [Announcement] {
        announcements.sorted { a, b in
            if a.pinned != b.pinned { return a.pinned }
            return a.createdAt > b.createdAt
        }
    }

    private func announcementCard(_ item: Announcement) -> some View {
        JCard {
            VStack(alignment: .leading, spacing: JSpacing.md) {
                // Header
                HStack {
                    Image(systemName: item.announcementType.icon)
                        .foregroundStyle(iconColor(for: item.announcementType))

                    JBadge(
                        text: item.announcementType.label,
                        color: iconColor(for: item.announcementType)
                    )

                    if item.pinned {
                        Image(systemName: "pin.fill")
                            .font(.jCaption)
                            .foregroundStyle(JColor.warning)
                    }

                    Spacer()

                    Text(relativeDate(item.createdAt))
                        .font(.jCaption2)
                        .foregroundStyle(JColor.textMuted)
                }

                // Title
                Text(item.title)
                    .font(.jBodyBold)
                    .foregroundStyle(.white)

                // Body
                if let body = item.body, !body.isEmpty {
                    Text(body)
                        .font(.jCallout)
                        .foregroundStyle(JColor.textSecondary)
                        .lineLimit(4)
                }

                // Author
                if let author = item.authorName {
                    HStack(spacing: JSpacing.xs) {
                        Image(systemName: "person.circle.fill")
                            .font(.jCaption)
                        Text(author)
                            .font(.jCaption)
                    }
                    .foregroundStyle(JColor.textMuted)
                }
            }
        }
    }

    private func iconColor(for type: AnnouncementType) -> Color {
        switch type {
        case .info:        return JColor.info
        case .important:   return JColor.error
        case .celebration: return JColor.warning
        case .schedule:    return JColor.accent
        }
    }

    private func relativeDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = Locale(identifier: "es_ES")
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    // MARK: - Data Loading
    private func loadAnnouncements() async {
        guard let emp = authVM.employee else { return }
        isLoading = announcements.isEmpty
        defer { isLoading = false }

        do {
            announcements = try await supabase.client
                .from("announcements")
                .select()
                .eq("location_id", value: emp.locationId.uuidString)
                .order("pinned", ascending: false)
                .order("created_at", ascending: false)
                .limit(20)
                .execute()
                .value
        } catch {
            announcements = []
        }
    }
}
