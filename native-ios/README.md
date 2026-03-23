# Josephine Team – Native iOS App

Employee-facing iOS app for the **Josephine** restaurant management platform.

## Requirements

| Tool | Minimum Version |
|------|----------------|
| macOS | 14+ (Sonoma) |
| Xcode | 15.4+ |
| XcodeGen | 2.38+ |
| iOS Target | 17.0+ |

## Quick Start

```bash
# 1. Install XcodeGen (if not already)
brew install xcodegen

# 2. Generate the Xcode project
cd native-ios
xcodegen generate

# 3. Open in Xcode
open JosephineTeam.xcodeproj

# 4. Resolve Swift packages (Xcode does this automatically)
#    Then select a simulator and press Cmd+R
```

## Configuration

The app connects to Supabase. Update credentials in:

```
Sources/Core/Services/SupabaseManager.swift
```

Replace the placeholder URL and anon key with your project values.

## Project Structure

```
Sources/
├── App/
│   ├── JosephineTeamApp.swift    # Entry point
│   └── ContentView.swift          # Root tab bar
├── Core/
│   ├── Services/
│   │   └── SupabaseManager.swift  # Supabase client
│   └── ViewModels/
│       └── AuthViewModel.swift    # Auth state
├── Features/
│   ├── Home/        # Dashboard
│   ├── Schedule/    # Week view
│   ├── Clock/       # Clock in/out + geolocation
│   ├── Pay/         # Monthly salary breakdown
│   ├── News/        # Announcements feed
│   ├── Profile/     # Employee info + settings
│   └── Auth/        # Login flow
├── Models/
│   └── DataModels.swift           # All Codable structs
└── Shared/
    ├── Components/  # Reusable UI (JCard, JBadge, etc.)
    └── Design/      # Colors & Typography tokens
```

## Tech Stack

- **SwiftUI** – Declarative UI
- **Supabase Swift SDK** – Auth + Realtime + Database
- **CoreLocation** – Geo-verified clock in/out
- **XcodeGen** – Declarative project configuration
