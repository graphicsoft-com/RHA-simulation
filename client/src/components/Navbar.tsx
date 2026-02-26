import { NavLink } from 'react-router-dom';
import { useRoomStatus } from '../hooks/useRoomStatus';

export default function Navbar() {
  const { activeCount } = useRoomStatus();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-surface/90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-cyan shadow-[0_0_8px_#00e5ff]" />
          <span className="font-display text-base font-700 tracking-widest text-white uppercase">
            RHA <span className="text-cyan">SIM</span>
          </span>
        </div>

        {/* Nav Links */}
        <div className="flex items-center gap-1">
          {[
            { to: '/',            label: 'Dashboard' },
            { to: '/transcripts', label: 'Transcripts' },
          ].map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `px-4 py-1.5 rounded text-xs tracking-widest uppercase transition-all duration-150 ${
                  isActive
                    ? 'bg-cyan/10 text-cyan border border-cyan/30'
                    : 'text-muted hover:text-text hover:bg-border'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>

        {/* Live room counter */}
        <div className="flex items-center gap-2 text-xs">
          {activeCount > 0 ? (
            <>
              <span className="pulse-dot" />
              <span className="text-green font-600">
                {activeCount}/6 LIVE
              </span>
            </>
          ) : (
            <>
              <span className="pulse-dot idle" />
              <span className="text-muted">0/6 LIVE</span>
            </>
          )}
        </div>

      </div>
    </nav>
  );
}
