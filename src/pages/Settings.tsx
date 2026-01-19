import { motion } from "framer-motion";
import { Bell, Shield, HelpCircle, Info, ChevronRight, Moon, Smartphone } from "lucide-react";
import BottomNav from "@/components/BottomNav";

const settingsItems = [
  { icon: Bell, label: "Notifications", description: "Manage push notifications" },
  { icon: Shield, label: "Privacy", description: "Data and permissions" },
  { icon: Moon, label: "Appearance", description: "Theme and display" },
  { icon: Smartphone, label: "Units", description: "Distance and speed units" },
  { icon: HelpCircle, label: "Help", description: "FAQs and support" },
  { icon: Info, label: "About", description: "App version and info" },
];

const Settings = () => {
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="pt-12 pb-6 px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="font-display font-bold text-2xl mb-1">Settings</h1>
          <p className="text-sm text-muted-foreground">Customize your experience</p>
        </motion.div>
      </header>

      {/* Settings list */}
      <div className="px-6">
        <div className="space-y-3">
          {settingsItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={item.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="w-full bg-gradient-card rounded-2xl p-4 shadow-card border border-border flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </motion.button>
            );
          })}
        </div>

        {/* App info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-8"
        >
          <p className="text-sm text-muted-foreground">Bicycle Run v1.0.0</p>
          <p className="text-xs text-muted-foreground mt-1">Made with ❤️ for cyclists</p>
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Settings;
