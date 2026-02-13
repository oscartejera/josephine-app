import { useState, useEffect } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Step {
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    title: 'Analyzing orders forecast',
    description: 'Our AI looks at past data (like OPLH) to forecast hourly orders, so you always know what to expect.',
  },
  {
    title: 'Checking optimal staffing levels',
    description: 'It assigns the right people at the right time, keeping things smooth and efficient.',
  },
  {
    title: 'Comparing with previous schedules',
    description: 'No stress! It follows your labor rules, availability constraints, and regulations automatically.',
  },
];

interface CreateScheduleModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function CreateScheduleModal({ isOpen, onComplete }: CreateScheduleModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      setCompletedSteps([]);
      return;
    }
    
    const stepDurations = [1400, 1600, 1500];
    const timeouts: NodeJS.Timeout[] = [];
    
    let totalDelay = 0;
    stepDurations.forEach((duration, index) => {
      totalDelay += duration;
      
      const timeout = setTimeout(() => {
        setCompletedSteps(prev => [...prev, index]);
        if (index < STEPS.length - 1) {
          setCurrentStep(index + 1);
        }
      }, totalDelay);
      
      timeouts.push(timeout);
    });
    
    // Complete after all steps
    const completeTimeout = setTimeout(() => {
      onComplete();
    }, totalDelay + 500);
    timeouts.push(completeTimeout);
    
    return () => {
      timeouts.forEach(t => clearTimeout(t));
    };
  }, [isOpen, onComplete]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
      />
      
      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-card border border-border rounded-2xl shadow-elevated p-8 w-full max-w-lg mx-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-semibold">Creating schedule</h2>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Powered by Josephine AI</span>
          </div>
        </div>
        
        {/* Logo animation */}
        <div className="flex justify-center mb-8">
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0],
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center"
          >
            <Sparkles className="h-8 w-8 text-primary-foreground" />
          </motion.div>
        </div>
        
        {/* Steps */}
        <div className="space-y-4">
          {STEPS.map((step, index) => {
            const isCompleted = completedSteps.includes(index);
            const isCurrent = currentStep === index && !isCompleted;
            
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0.5 }}
                animate={{ 
                  opacity: isCurrent || isCompleted ? 1 : 0.5,
                }}
                className={`flex gap-4 p-4 rounded-xl transition-colors ${
                  isCurrent ? 'bg-primary/5 border border-primary/20' : 
                  isCompleted ? 'bg-muted/50' : ''
                }`}
              >
                {/* Step indicator */}
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  isCompleted ? 'bg-[hsl(var(--success))]' :
                  isCurrent ? 'bg-primary' : 'bg-muted'
                }`}>
                  {isCompleted ? (
                    <Check className="h-4 w-4 text-white" />
                  ) : isCurrent ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-3 h-3 border-2 border-white border-t-transparent rounded-full"
                    />
                  ) : (
                    <div className="w-2 h-2 bg-muted-foreground/30 rounded-full" />
                  )}
                </div>
                
                {/* Step content */}
                <div className="flex-1">
                  <h3 className={`font-medium text-sm ${
                    isCompleted || isCurrent ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
