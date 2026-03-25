import SwiftUI

struct NewsView: View {
    @EnvironmentObject var authVM: AuthViewModel

    private let cache = CacheManager.shared

    /// Read cached announcements (returns empty array on miss).
    private var cachedAnnouncements: [Announcement] {
        (try? cache.announcements()) ?? []
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: JSpacing.lg) {
                    OfflineBanner()

                    AsyncContentView(
                        initialValue: cachedAnnouncements.isEmpty ? nil : cachedAnnouncements,
                        emptyMessage: "No hay anuncios publicados todavía",
                        emptyIcon: "megaphone",
                        fetch: fetchAnnouncements,
                        isEmpty: { $0.isEmpty }
                    ) { announcements in
                        ForEach(sortedAnnouncements(announcements)) { item in
                            announcementCard(item)
                        }
                    }
                }
                .padding(.horizontal, JSpacing.lg)
                .padding(.bottom, JSpacing.xxl)
            }
            .background(JColor.background)
            .navigationTitle("Noticias")
        }
    }

    // MARK: - Data Fetch (used by AsyncContentView)

    private func fetchAnnouncements() async throws -> [Announcement] {
        try await cache.sync(.announcements, force: true)
        return try cache.announcements()
    }

    // MARK: - Sorting

    private func sortedAnnouncements(_ list: [Announcement]) -> [Announcement] {
        list.sorted { a, b in
            if a.pinned != b.pinned { return a.pinned }
            return a.createdAt > b.createdAt
        }
    }

    // MARK: - Card

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
                    .foregroundStyle(JColor.textPrimary)

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
}
