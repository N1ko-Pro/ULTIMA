import React, { forwardRef } from 'react';
import { ExpandedProfileContent } from '@Core/Profile/ExpandedProfileContent';
import { ExpandedProfileEditor } from '@Core/Profile/ExpandedProfileEditor';
import CopyChip from '@Frontend/Core/Profile/CopyChip';

// ─── Auth page profile panel ─────────────────────────────────────────────────
// Animated overlay that reveals profile content on the Auth (welcome) page
// when the user clicks their status card. Positioned absolutely over the
// feature grid; the parent controls visibility via `isExpanded`.

const AuthProfilePanel = forwardRef(function AuthProfilePanel({ isExpanded, profileView, onSetProfileView }, ref) {
  return (
    <div
      ref={ref}
      className="absolute top-0 left-0 right-0 z-10 flex justify-center isolate"
      style={{
        opacity:    isExpanded ? 1 : 0,
        transform:  isExpanded ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 400ms cubic-bezier(0.4,0,0.2,1), transform 400ms cubic-bezier(0.4,0,0.2,1)',
        pointerEvents: isExpanded ? 'auto' : 'none',
        willChange: 'opacity, transform',
      }}
    >
      <div className="w-full max-w-[340px] rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.4)] overflow-hidden">
        {/* Body — animated slide between main ↔ settings */}
        <div className="relative overflow-hidden">
          {/* Main view */}
          <div className={`p-5 transition-all duration-300 ease-in-out ${
            profileView === 'main'
              ? 'translate-x-0 opacity-100'
              : '-translate-x-full opacity-0 pointer-events-none absolute inset-0'
          }`}>
            <ExpandedProfileContent isVisible={isExpanded && profileView === 'main'} />
          </div>

          {/* Settings view — local name editor */}
          <div className={`p-5 transition-all duration-300 ease-in-out ${
            profileView === 'settings'
              ? 'translate-x-0 opacity-100'
              : 'translate-x-full opacity-0 pointer-events-none absolute inset-0'
          }`}>
            <ExpandedProfileEditor isVisible={profileView === 'settings'} onClose={() => onSetProfileView('main')} />
          </div>
        </div>
      </div>
    </div>
  );
});

export default AuthProfilePanel;
