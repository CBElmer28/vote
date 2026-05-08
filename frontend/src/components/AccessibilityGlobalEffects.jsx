import { useState, useEffect } from 'react';
import { useAccessibility } from '../context/AccessibilityContext';

export default function AccessibilityGlobalEffects() {
  const { settings } = useAccessibility();
  const [maskTop, setMaskTop] = useState(0);

  // Mouse move listener for ADHD mask
  useEffect(() => {
    if (!settings.adhdMode) return;

    const handleMouseMove = (e) => {
      // Use requestAnimationFrame for smoother updates if needed, 
      // but simple state update is usually fine for this simple transform
      setMaskTop(e.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [settings.adhdMode]);

  return (
    <>
      {/* ADHD Mask Element - Optimized for performance with transforms */}
      {settings.adhdMode && (
        <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
          {/* Top Panel - Fixed height, translated */}
          <div 
            className="absolute top-0 left-0 w-full bg-black/60 will-change-transform"
            style={{ 
              height: '100vh',
              transform: `translateY(${maskTop - 60 - window.innerHeight}px)`
            }}
          />
          {/* Bottom Panel - Fixed height, translated */}
          <div 
            className="absolute top-0 left-0 w-full bg-black/60 will-change-transform"
            style={{ 
              height: '100vh',
              transform: `translateY(${maskTop + 60}px)`
            }}
          />
          {/* Highlight Border */}
          <div 
            className="absolute left-0 w-full h-[120px] border-y-2 border-primary-blue/30 will-change-transform pointer-events-none"
            style={{ 
              top: 0,
              transform: `translateY(${maskTop - 60}px)`
            }}
          />
        </div>
      )}

      {/* SVG Filters for Daltonismo - Must always be in DOM */}
      <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
        <defs>
          <filter id="protanopia-filter">
            <feColorMatrix type="matrix" values="0.567, 0.433, 0, 0, 0, 0.558, 0.442, 0, 0, 0, 0, 0.242, 0.758, 0, 0, 0, 0, 0, 1, 0" />
          </filter>
          <filter id="deuteranopia-filter">
            <feColorMatrix type="matrix" values="0.625, 0.375, 0, 0, 0, 0.7, 0.3, 0, 0, 0, 0, 0.3, 0.7, 0, 0, 0, 0, 0, 1, 0" />
          </filter>
          <filter id="tritanopia-filter">
            <feColorMatrix type="matrix" values="0.95, 0.05, 0, 0, 0, 0, 0.433, 0.567, 0, 0, 0, 0.475, 0.525, 0, 0, 0, 0, 0, 1, 0" />
          </filter>
        </defs>
      </svg>
    </>
  );
}
