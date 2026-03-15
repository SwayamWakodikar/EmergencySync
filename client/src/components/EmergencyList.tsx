import type { Emergency } from '../services/api';

interface Props {
  emergencies: Emergency[];
}

const STATUS_CONFIG = {
  WAITING: {
    label: 'Waiting',
    dotColor: '#ef4444',
    badgeClass: 'badge-waiting',
    emoji: '🔴',
  },
  ASSIGNED: {
    label: 'Assigned',
    dotColor: '#f97316',
    badgeClass: 'badge-assigned',
    emoji: '🟠',
  },
  COMPLETED: {
    label: 'Completed',
    dotColor: '#22c55e',
    badgeClass: 'badge-completed',
    emoji: '🟢',
  },
};

const SEVERITY_LABELS = ['', 'Minor', 'Moderate', 'Serious', 'Severe', 'Critical'];

function SeverityBar({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5 items-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 2,
            background: i <= level
              ? level >= 4 ? '#ef4444' : level === 3 ? '#f97316' : '#3b82f6'
              : 'rgba(255,255,255,0.1)',
            transition: 'background 0.3s',
          }}
        />
      ))}
    </div>
  );
}

function EmergencyItem({ emergency }: { emergency: Emergency }) {
  const cfg = STATUS_CONFIG[emergency.status];
  return (
    <div
      className="animate-fade-in-up"
      style={{
        padding: '10px 12px',
        background: 'var(--bg-hover)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        marginBottom: 6,
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = cfg.dotColor)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
          #{emergency.id}
        </span>
        <span className={`badge ${cfg.badgeClass}`}>
          {cfg.label}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {SEVERITY_LABELS[emergency.severity]}
        </span>
        <SeverityBar level={emergency.severity} />
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  status,
  accentColor,
}: {
  title: string;
  items: Emergency[];
  status: Emergency['status'];
  accentColor: string;
}) {
  const filtered = items.filter((e) => e.status === status);
  return (
    <div className="mb-4">
      <div
        className="flex items-center gap-2 mb-2"
        style={{ paddingBottom: 6, borderBottom: `1px solid var(--border)` }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: accentColor,
            boxShadow: `0 0 8px ${accentColor}`,
          }}
        />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {title}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            fontWeight: 700,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 999,
            padding: '1px 7px',
            color: accentColor,
          }}
        >
          {filtered.length}
        </span>
      </div>
      {filtered.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
          None
        </p>
      ) : (
        filtered.map((e) => <EmergencyItem key={e.id} emergency={e} />)
      )}
    </div>
  );
}

export default function EmergencyList({ emergencies }: Props) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 2px' }}>
      <Section title="Waiting" items={emergencies} status="WAITING" accentColor="#ef4444" />
      <Section title="Assigned" items={emergencies} status="ASSIGNED" accentColor="#f97316" />
      <Section title="Completed" items={emergencies} status="COMPLETED" accentColor="#22c55e" />
    </div>
  );
}
