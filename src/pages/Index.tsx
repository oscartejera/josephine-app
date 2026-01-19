import { motion } from "framer-motion";
import { Bike, MapPin, Timer, Zap, Route, Flame } from "lucide-react";
import { useRideTracker } from "@/hooks/useRideTracker";
import StartRideButton from "@/components/StartRideButton";
import StatCard from "@/components/StatCard";
import BottomNav from "@/components/BottomNav";

const Index = () => {
  const { isActive, duration, distance, speed, avgSpeed, toggleRide, formatDuration } = useRideTracker();

  const calories = Math.round(distance * 30); // Approximate calories burned

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Glow effect */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none" 
           style={{ background: "var(--gradient-glow)" }} />
      
      {/* Header */}
      <header className="relative pt-12 pb-6 px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
              <Bike className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-xl">Bicycle Run</h1>
              <p className="text-xs text-muted-foreground">Track your ride</p>
            </div>
          </div>
          <motion.div 
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              isActive 
                ? "bg-primary/20 text-primary" 
                : "bg-muted text-muted-foreground"
            }`}
            animate={isActive ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
          >
            {isActive ? "● LIVE" : "READY"}
          </motion.div>
        </motion.div>
      </header>

      {/* Main content */}
      <main className="px-6">
        {/* Speed display */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-8"
        >
          <p className="text-sm text-muted-foreground mb-2 uppercase tracking-wider">Current Speed</p>
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-7xl font-display font-bold text-gradient">
              {speed.toFixed(1)}
            </span>
            <span className="text-2xl text-muted-foreground">km/h</span>
          </div>
        </motion.div>

        {/* Start/Stop button */}
        <div className="flex justify-center mb-10">
          <StartRideButton isActive={isActive} onClick={toggleRide} />
        </div>

        {/* Duration display */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border">
            <Timer className="w-4 h-4 text-primary" />
            <span className="font-display font-semibold text-xl">
              {formatDuration(duration)}
            </span>
          </div>
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard icon={Route} label="Distance" value={distance.toFixed(2)} unit="km" delay={0.3} />
          <StatCard icon={Zap} label="Avg Speed" value={avgSpeed.toFixed(1)} unit="km/h" delay={0.4} />
          <StatCard icon={Flame} label="Calories" value={calories.toString()} unit="kcal" delay={0.5} />
          <StatCard icon={MapPin} label="Elevation" value="0" unit="m" delay={0.6} />
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default Index;
