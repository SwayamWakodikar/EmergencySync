import type { Emergency } from '../services/api';

interface Props {
  emergencies: Emergency[];
}

const STATUS_CONFIG = {
  WAITING: {
    label: 'Waiting',
    dotColor: 'var(--danger)',
    badgeClass: 'badge-waiting',
  },
  ASSIGNED: {
    label: 'Assigned',
    dotColor: 'var(--warning)',
    badgeClass: 'badge-assigned',
  },
  COMPLETED: {
    label: 'Resolved',
    dotColor: 'var(--success)',
    badgeClass: 'badge-completed',
  },
};

const SEVERITY_LABELS = ['', 'Minor', 'Moderate', 'Serious', 'Severe', 'Critical'];

function SeverityBar({ level }: { level: number }) {
  return (
    <div className="flex gap-1 items-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            width: 8,
            height: 4,
            borderRadius: 2,
            background: i <= level
              ? level >= 4 ? 'var(--danger)' : level === 3 ? 'var(--warning)' : 'var(--accent)'
              : 'var(--border)',
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
        padding: '14px',
        background: '#111',
        borderRadius: 'var(--radius)',
        border: '1px solid #222',
        marginBottom: 8,
        transition: 'border-color 0.2s ease',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
         e.currentTarget.style.borderColor = cfg.dotColor;
      }}
      onMouseLeave={(e) => {
         e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dotColor }} />
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
            Incident #{emergency.id}
          </span>
        </div>
        <span className={`badge ${cfg.badgeClass}`}>
          {cfg.label}
        </span>
      </div>
      
      <div className="flex items-center justify-between mb-1">
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Type
        </span>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)' }}>
          {emergency.type}
        </span>
      </div>
      
      <div className="flex items-center justify-between mb-1">
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Severity
        </span>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)' }}>
          {SEVERITY_LABELS[emergency.severity]}
        </span>
      </div>
      <SeverityBar level={emergency.severity} />
      
      {emergency.description && (
        <div style={{ 
          marginTop: 12, 
          paddingTop: 12,
          borderTop: '1px solid var(--border)',
          fontSize: 12, 
          color: 'var(--text-muted)',
          wordBreak: 'break-word',
          lineHeight: 1.5,
          fontWeight: 500
        }}>
          {emergency.description}
        </div>
      )}
      
      {emergency.action_plan && (
        <div style={{ 
          marginTop: 8, 
          padding: '10px',
          background: 'var(--bg-hover)',
          borderRadius: 6,
          borderLeft: '3px solid var(--accent)',
          fontSize: 11, 
          color: 'var(--text-primary)',
          lineHeight: 1.5,
          fontWeight: 600
        }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>AI Plan:</span> {emergency.action_plan}
        </div>
      )}
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
  if (filtered.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {title}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            fontWeight: 800,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 999,
            padding: '2px 8px',
            color: accentColor,
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          {filtered.length}
        </span>
      </div>
      <div>
        {filtered.map((e) => <EmergencyItem key={e.id} emergency={e} />)}
      </div>
    </div>
  );
}

export default function EmergencyList({ emergencies }: Props) {
  return (
    <div style={{ flex: 1, padding: '0 4px', paddingBottom: 20 }}>
      <Section title="Waiting for Dispatch" items={emergencies} status="WAITING" accentColor="var(--danger)" />
      <Section title="Currently Assigned" items={emergencies} status="ASSIGNED" accentColor="var(--warning)" />
      <Section title="Resolved" items={emergencies} status="COMPLETED" accentColor="var(--success)" />
      
      {emergencies.length === 0 && (
         <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
            <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--success)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
            </div>
            <div style={{ marginTop: 12 }}>No active incidents at the moment.</div>
            <div style={{ fontSize: 11, fontWeight: 500, marginTop: 4 }}>The city is safe.</div>
         </div>
      )}
    </div>
  );
}
