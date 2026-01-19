import { motion } from "framer-motion";
import { User, Award, Target, Bike, ChevronRight } from "lucide-react";
import BottomNav from "@/components/BottomNav";

const achievements = [
  { name: "First Ride", description: "Complete your first ride", completed: true },
  { name: "Century Club", description: "Ride 100 km total", completed: true },
  { name: "Speed Demon", description: "Reach 30 km/h", completed: false },
  { name: "Marathon", description: "Complete a 42 km ride", completed: false },
];

const Profile = () => {
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="pt-12 pb-6 px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow">
            <User className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl">Cyclist</h1>
            <p className="text-sm text-muted-foreground">Member since 2024</p>
          </div>
        </motion.div>
      </header>

      {/* Stats */}
      <div className="px-6 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-card rounded-2xl p-5 shadow-card border border-border"
        >
          <h2 className="text-sm text-muted-foreground uppercase tracking-wider mb-4">Your Stats</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <Bike className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-2xl font-display font-bold">62.9</p>
              <p className="text-xs text-muted-foreground">Total km</p>
            </div>
            <div className="text-center">
              <Target className="w-5 h-5 text-accent mx-auto mb-1" />
              <p className="text-2xl font-display font-bold">5</p>
              <p className="text-xs text-muted-foreground">Rides</p>
            </div>
            <div className="text-center">
              <Award className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-2xl font-display font-bold">2</p>
              <p className="text-xs text-muted-foreground">Badges</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Achievements */}
      <div className="px-6">
        <h2 className="text-sm text-muted-foreground uppercase tracking-wider mb-4">Achievements</h2>
        <div className="space-y-3">
          {achievements.map((achievement, index) => (
            <motion.div
              key={achievement.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`bg-gradient-card rounded-2xl p-4 shadow-card border border-border flex items-center justify-between ${
                !achievement.completed && "opacity-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  achievement.completed ? "bg-gradient-primary" : "bg-muted"
                }`}>
                  <Award className={`w-5 h-5 ${
                    achievement.completed ? "text-primary-foreground" : "text-muted-foreground"
                  }`} />
                </div>
                <div>
                  <p className="font-medium">{achievement.name}</p>
                  <p className="text-xs text-muted-foreground">{achievement.description}</p>
                </div>
              </div>
              {achievement.completed && (
                <span className="text-xs text-primary font-medium">EARNED</span>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Profile;
