/**
 * GSAP — Centralized Registration
 * 
 * Import GSAP from here instead of directly from 'gsap' to ensure
 * all plugins are registered once. This prevents duplicate registration
 * warnings and ensures consistent behavior across the app.
 * 
 * Usage:
 *   import { gsap, useGSAP, Flip, ScrollTrigger } from '@/lib/gsap';
 */
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { useGSAP } from "@gsap/react";

// Register all plugins once
gsap.registerPlugin(Flip, ScrollTrigger, SplitText, DrawSVGPlugin, useGSAP);

// Project-wide defaults — premium feel
gsap.defaults({
  duration: 0.5,
  ease: "power2.out",
});

export { gsap, Flip, ScrollTrigger, SplitText, DrawSVGPlugin, useGSAP };
