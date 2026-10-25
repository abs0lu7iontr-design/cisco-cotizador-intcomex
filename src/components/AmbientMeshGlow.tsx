// ============================================================================
// CISCO AUTOMATED v2.1 - AMBIENT MESH GLOW (AESTHETIC DECORATIVE BACKGROUND)
// ============================================================================

import React from 'react';
import { useUiExperience } from '../core/themeEngine';

export const AmbientMeshGlow: React.FC = () => {
  const { isAesthetic, config } = useUiExperience();

  if (!isAesthetic || !config.meshGradient) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden z-0 transition-opacity duration-700 ease-in-out"
      style={{ opacity: config.ambientGlow ? 0.9 : 0.3 }}
    >
      {/* Top Left Glowing Orb */}
      <div
        className="absolute -top-32 -left-32 w-[32rem] h-[32rem] rounded-full blur-[100px] animate-pulse"
        style={{
          background: `radial-gradient(circle, ${config.accentPrimary}33 0%, transparent 70%)`,
          animationDuration: '8s',
        }}
      />

      {/* Top Right Floating Orb */}
      <div
        className="absolute top-1/4 -right-40 w-[28rem] h-[28rem] rounded-full blur-[110px]"
        style={{
          background: `radial-gradient(circle, ${config.accentSecondary}26 0%, transparent 70%)`,
        }}
      />

      {/* Bottom Center Subtle Pool */}
      <div
        className="absolute -bottom-40 left-1/3 w-[36rem] h-[36rem] rounded-full blur-[130px] animate-pulse"
        style={{
          background: `radial-gradient(circle, ${config.accentGlow} 0%, transparent 70%)`,
          animationDuration: '12s',
        }}
      />
    </div>
  );
};
