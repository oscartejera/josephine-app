import { motion } from "framer-motion";
import { Calendar, TrendingUp } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import RideHistoryCard from "@/components/RideHistoryCard";

const mockRides = [
  { date: "Today, 9:30 AM", distance: 12.5, duration: "45:20", avgSpeed: 16.5 },
  { date: "Yesterday, 6:15 PM", distance: 8.3, duration: "28:45", avgSpeed: 17.3 },
  { date: "Jan 17, 7:00 AM", distance: 15.2, duration: "52:10", avgSpeed: 17.5 },
  { date: "Jan 15, 5:45 PM", distance: 6.8, duration: "22:30", avgSpeed: 18.1 },
  { date: "Jan 14, 8:00 AM", distance: 20.1, duration: "1:12:45", avgSpeed: 16.6 },
];

const History = () => {
  const totalDistance = mockRides.reduce((acc, ride) => acc + ride.distance, 0);
  const totalRides = mockRides.length;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="pt-12 pb-6 px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="font-display font-bold text-2xl mb-1">Ride History</h1>
          <p className="text-sm text-muted-foreground">Your cycling journey</p>
        </motion.div>
      </header>

      {/* Summary cards */}
      <div className="px-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-card rounded-2xl p-4 shadow-card border border-border"
          >
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Rides</span>
            </div>
            <span className="text-3xl font-display font-bold">{totalRides}</span>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-card rounded-2xl p-4 shadow-card border border-border"
          >
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-accent" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Total KM</span>
            </div>
            <span className="text-3xl font-display font-bold">{totalDistance.toFixed(1)}</span>
          </motion.div>
        </div>
      </div>

      {/* Ride list */}
      <div className="px-6">
        <h2 className="text-sm text-muted-foreground uppercase tracking-wider mb-4">Recent Activities</h2>
        <div className="space-y-3">
          {mockRides.map((ride, index) => (
            <RideHistoryCard key={index} {...ride} index={index} />
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default History;
