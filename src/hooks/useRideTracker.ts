import { useState, useEffect, useCallback } from "react";

export interface RideData {
  isActive: boolean;
  duration: number;
  distance: number;
  speed: number;
  avgSpeed: number;
}

export const useRideTracker = () => {
  const [isActive, setIsActive] = useState(false);
  const [duration, setDuration] = useState(0);
  const [distance, setDistance] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [speeds, setSpeeds] = useState<number[]>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isActive) {
      interval = setInterval(() => {
        setDuration((prev) => prev + 1);
        
        // Simulate speed between 15-35 km/h with some variation
        const newSpeed = Math.random() * 20 + 15;
        setSpeed(Math.round(newSpeed * 10) / 10);
        setSpeeds((prev) => [...prev, newSpeed]);
        
        // Calculate distance based on speed (speed in km/h, interval is 1 second)
        setDistance((prev) => prev + newSpeed / 3600);
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isActive]);

  const toggleRide = useCallback(() => {
    setIsActive((prev) => !prev);
  }, []);

  const resetRide = useCallback(() => {
    setIsActive(false);
    setDuration(0);
    setDistance(0);
    setSpeed(0);
    setSpeeds([]);
  }, []);

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const avgSpeed = speeds.length > 0 
    ? Math.round((speeds.reduce((a, b) => a + b, 0) / speeds.length) * 10) / 10 
    : 0;

  return {
    isActive,
    duration,
    distance: Math.round(distance * 100) / 100,
    speed,
    avgSpeed,
    toggleRide,
    resetRide,
    formatDuration,
  };
};
