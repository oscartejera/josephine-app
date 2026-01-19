import { motion } from "framer-motion";
import { MapPin, Clock, Zap, ChevronRight } from "lucide-react";

interface RideHistoryCardProps {
  date: string;
  distance: number;
  duration: string;
  avgSpeed: number;
  index: number;
}

const RideHistoryCard = ({ date, distance, duration, avgSpeed, index }: RideHistoryCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-gradient-card rounded-2xl p-4 shadow-card border border-border flex items-center justify-between"
    >
      <div className="flex-1">
        <p className="text-sm text-muted-foreground mb-1">{date}</p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="font-display font-semibold">{distance.toFixed(1)} km</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4 text-accent" />
            <span className="text-sm text-muted-foreground">{duration}</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">{avgSpeed} km/h</span>
          </div>
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground" />
    </motion.div>
  );
};

export default RideHistoryCard;
