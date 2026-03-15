import EmergencyList from './EmergencyList';
import type { Ambulance, Emergency } from '../services/api';

interface Props {
  ambulances: Ambulance[];
  emergencies: Emergency[];
  onCreateEmergency: () => void;
  isCreating: boolean;
  lastUpdated: Date | null;
  isConnected: boolean;
}

function StatCard({
  label,
  value,
  color,
  emoji,
}: {
  label: string;
  value: number;
  color: string;
  emoji: string;
}) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = color)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div style={{ fontSize: 18 }}>{emoji}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
        {label}
      </div>
    </div>
  );
}

export default function Sidebar({
  ambulances,
  emergencies,
  onCreateEmergency,
  isCreating,
  lastUpdated,
  isConnected,
}: Props) {
  const waiting = emergencies.filter((e) => e.status === 'WAITING').length;
  const assigned = emergencies.filter((e) => e.status === 'ASSIGNED').length;
  const completed = emergencies.filter((e) => e.status === 'COMPLETED').length;
  const freeAmbs = ambulances.filter((a) => a.status === 'FREE').length;

  return (
    <aside
      style={{
        width: 280,
        minWidth: 280,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 12px',
        gap: 12,
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>
          Dispatch Overview
        </h2>
        <div className="flex items-center gap-1.5">
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: isConnected ? '#22c55e' : '#ef4444',
              boxShadow: `0 0 6px ${isConnected ? '#22c55e' : '#ef4444'}`,
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {isConnected ? 'Live' : 'Disconnected'}
            {lastUpdated && ` · ${lastUpdated.toLocaleTimeString()}`}
          </span>
        </div>
      </div>

      {/* Stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <StatCard label="Free" value={freeAmbs} color="#3b82f6" emoji="🚑" />
        <StatCard label="Waiting" value={waiting} color="#ef4444" emoji="🚨" />
        <StatCard label="Assigned" value={assigned} color="#f97316" emoji="⚡" />
        <StatCard label="Done" value={completed} color="#22c55e" emoji="✅" />
      </div>

      {/* Create Emergency Button */}
      <button
        id="btn-create-emergency"
        onClick={onCreateEmergency}
        disabled={isCreating}
        style={{
          width: '100%',
          padding: '11px 0',
          borderRadius: 'var(--radius)',
          border: 'none',
          cursor: isCreating ? 'not-allowed' : 'pointer',
          background: isCreating
            ? 'rgba(239,68,68,0.3)'
            : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: 'white',
          fontWeight: 700,
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          boxShadow: isCreating ? 'none' : '0 4px 16px rgba(239,68,68,0.35)',
          transition: 'all 0.2s',
          fontFamily: 'inherit',
          letterSpacing: '0.02em',
        }}
        onMouseEnter={(e) => {
          if (!isCreating) (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
        }}
      >
        {isCreating ? (
          <>
            <span className="animate-spin" style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }} />
            Dispatching…
          </>
        ) : (
          <>🚨 Create Emergency</>
        )}
      </button>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)' }} />

      {/* Emergency Queue */}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Emergency Queue
      </div>
      <EmergencyList emergencies={emergencies} />
    </aside>
  );
}
