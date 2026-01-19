import { motion } from "framer-motion";
import { Play, Pause } from "lucide-react";

interface StartRideButtonProps {
  isActive: boolean;
  onClick: () => void;
}

const StartRideButton = ({ isActive, onClick }: StartRideButtonProps) => {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="relative w-32 h-32 rounded-full bg-gradient-primary shadow-glow flex items-center justify-center"
    >
      {/* Animated ring */}
      <motion.div
        className="absolute inset-0 rounded-full border-4 border-primary/30"
        animate={isActive ? { scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      />
      
      {/* Inner glow */}
      <div className="absolute inset-2 rounded-full bg-gradient-primary opacity-50 blur-md" />
      
      {/* Icon */}
      <motion.div
        key={isActive ? "pause" : "play"}
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        exit={{ scale: 0, rotate: 180 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="relative z-10"
      >
        {isActive ? (
          <Pause className="w-12 h-12 text-primary-foreground" />
        ) : (
          <Play className="w-12 h-12 text-primary-foreground ml-1" />
        )}
      </motion.div>
    </motion.button>
  );
};

export default StartRideButton;
