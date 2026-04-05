import { useState, useEffect, useCallback, useRef } from 'react';
import MapView from '../components/MapView';
import Sidebar from '../components/Sidebar';
import EmergencyList from '../components/EmergencyList';
import { getAmbulances, getEmergencies, getAssignments, createEmergency } from '../services/api';
import type { Ambulance, Emergency, Assignment } from '../services/api';

const POLL_INTERVAL = 2500; // 2.5 seconds

export default function Dashboard() {
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotification = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    if (notifTimer.current) clearTimeout(notifTimer.current);
    notifTimer.current = setTimeout(() => setNotification(null), 3000);
  };

  const fetchData = useCallback(async () => {
    try {
      const [ambs, ems, asns] = await Promise.all([
        getAmbulances(),
        getEmergencies(),
        getAssignments(),
      ]);
      setAmbulances(ambs);
      setEmergencies(ems);
      setAssignments(asns);
      setLastUpdated(new Date());
      setIsConnected(true);
    } catch {
      setIsConnected(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchData]);

  const handleCreateEmergency = async (description: string, location?: {latitude: number, longitude: number}) => {
    setIsCreating(true);
    try {
      await createEmergency(description, location);
      await fetchData();
      showNotification('Emergency created and dispatched!', 'success');
    } catch (err: any) {
      showNotification(err.message || 'Failed to create emergency. Is the server running?', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="dashboard-layout">
      {/* ── Left Command Panel ── */}
      <aside className="dashboard-sidebar glass animate-fade-in-up" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
        {/* Brand & Connection */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '20px' }}>
            <div style={{ 
              width: 32, height: 32, borderRadius: '8px', 
              background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              color: '#000', flexShrink: 0
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <div>
              <h1 style={{ fontSize: 15, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>EmergencySync</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: isConnected ? 'var(--success)' : 'var(--danger)' }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>{isConnected ? 'Live' : 'Offline'}</span>
              </div>
            </div>
        </div>

        <Sidebar
          ambulances={ambulances}
          emergencies={emergencies}
          onCreateEmergency={handleCreateEmergency}
          isCreating={isCreating}
          lastUpdated={lastUpdated}
          isConnected={isConnected}
        />
      </aside>

      {/* ── Main Operations Center ── */}
      <main className="dashboard-main">
        
        {/* Top KPI Header */}
        <header className="dashboard-header glass animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          {[
            { label: 'Medics', value: ambulances.filter(a => a.status === 'FREE' && a.type === 'AMBULANCE').length, color: '#10b981' },
            { label: 'Police', value: ambulances.filter(a => a.status === 'FREE' && a.type === 'POLICE').length, color: '#3b82f6' },
            { label: 'Fire', value: ambulances.filter(a => a.status === 'FREE' && a.type === 'FIRE').length, color: '#ef4444' },
            { label: 'Active', value: emergencies.filter((e) => e.status !== 'COMPLETED').length, color: '#f59e0b' },
            { label: 'Resolved', value: emergencies.filter((e) => e.status === 'COMPLETED').length, color: '#555' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 600, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
              <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 500, marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </header>

        {/* Split UI: Map & Feed */}
        <div className="dashboard-content-split">
          
          <div className="dashboard-map-container glass animate-fade-in-up" style={{ animationDelay: '0.2s', padding: '4px' }}>
            <MapView
              ambulances={ambulances}
              emergencies={emergencies}
              assignments={assignments}
            />
          </div>

          <div className="dashboard-queue-container glass animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <div className="mobile-drag" />
            <div style={{ padding: '0 24px', marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
                Live Incident Queue
              </h2>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px', WebkitOverflowScrolling: 'touch' }}>
               <EmergencyList emergencies={emergencies} />
            </div>
          </div>

        </div>
      </main>

      {/* ── Notification Toast ── */}
      {notification && (
        <div
          className="animate-fade-in-up glass"
          style={{
            position: 'fixed',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            borderRadius: '999px',
            padding: '12px 24px',
            color: notification.type === 'success' ? 'var(--success)' : 'var(--danger)',
            fontWeight: 700,
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: `0 12px 32px ${notification.type === 'success' ? 'var(--success-soft)' : 'var(--danger-soft)'}`,
          }}
        >
          {notification.type === 'success' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          )}
          {notification.msg}
        </div>
      )}
    </div>
  );
}
