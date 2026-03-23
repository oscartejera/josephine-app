import Foundation

// MARK: - Date Utilities used by ClockView and other features.

extension Date {
    /// Beginning of the current day.
    var startOfDay: Date {
        Calendar.current.startOfDay(for: self)
    }

    /// End of the current day (23:59:59).
    var endOfDay: Date {
        var comps = DateComponents()
        comps.day = 1
        comps.second = -1
        return Calendar.current.date(byAdding: comps, to: startOfDay)!
    }
}
