import { useState, useEffect, useCallback, useRef } from 'react';

interface UseKDSKioskOptions {
  hideCursorAfterMs?: number;
  preventClose?: boolean;
}

export function useKDSKiosk({
  hideCursorAfterMs = 3000,
  preventClose = true,
}: UseKDSKioskOptions = {}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCursorHidden, setIsCursorHidden] = useState(false);
  const cursorTimeoutRef = useRef<number | null>(null);

  // Check fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Hide cursor after inactivity
  useEffect(() => {
    if (!isFullscreen) {
      setIsCursorHidden(false);
      return;
    }

    const resetCursorTimeout = () => {
      setIsCursorHidden(false);
      
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
      
      cursorTimeoutRef.current = window.setTimeout(() => {
        setIsCursorHidden(true);
      }, hideCursorAfterMs);
    };

    // Initial timeout
    resetCursorTimeout();

    // Reset on mouse movement
    const handleMouseMove = () => resetCursorTimeout();
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
    };
  }, [isFullscreen, hideCursorAfterMs]);

  // Prevent accidental close
  useEffect(() => {
    if (!preventClose || !isFullscreen) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '¿Seguro que quieres salir del modo KDS?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [preventClose, isFullscreen]);

  // Apply cursor hidden style
  useEffect(() => {
    if (isCursorHidden) {
      document.body.style.cursor = 'none';
    } else {
      document.body.style.cursor = '';
    }

    return () => {
      document.body.style.cursor = '';
    };
  }, [isCursorHidden]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  }, []);

  // Enter fullscreen
  const enterFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  }, []);

  // Exit fullscreen
  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Exit fullscreen error:', error);
    }
  }, []);

  return {
    isFullscreen,
    isCursorHidden,
    toggleFullscreen,
    enterFullscreen,
    exitFullscreen,
  };
}
