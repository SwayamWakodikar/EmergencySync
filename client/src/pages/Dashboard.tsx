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

  const handleCreateEmergency = async (description: string) => {
    setIsCreating(true);
    try {
      await createEmergency(description);
      await fetchData();
      showNotification('Emergency created and dispatched!', 'success');
    } catch {
      showNotification('Failed to create emergency. Is the server running?', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* ── Background Map ── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <MapView
          ambulances={ambulances}
          emergencies={emergencies}
          assignments={assignments}
        />
      </div>

      {/* ── Floating Top Layout ── */}
      <div className="floating-layout">
        
        {/* Left Side: Brand & Dispatch Card */}
        <div className="animate-fade-in-up left-sidebar">
          {/* Brand & Connection Glass Card */}
          <div className="glass" style={{ padding: '16px 20px', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 4px 12px var(--accent-glow)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                </div>
                <div>
                  <h1 style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>EmergencySync</h1>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: isConnected ? 'var(--success)' : 'var(--danger)', boxShadow: `0 0 6px ${isConnected ? 'var(--success)' : 'var(--danger)'}` }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: isConnected ? 'var(--success)' : 'var(--danger)' }}>{isConnected ? 'LIVE SYSTEM' : 'OFFLINE'}</span>
                  </div>
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
        </div>

        {/* Floating Center Stats */}
        <div className="glass animate-fade-in-up center-stats" style={{ animationDelay: '0.1s' }}>
           {[
            { label: 'Free Responders', value: ambulances.length, color: 'var(--accent)' },
            { label: 'Active Incidents', value: emergencies.filter((e) => e.status !== 'COMPLETED').length, color: 'var(--warning)' },
            { label: 'Resolved Operations', value: emergencies.filter((e) => e.status === 'COMPLETED').length, color: 'var(--success)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Right Side: Emergency Queue Card */}
        <div className="animate-fade-in-up right-sidebar" style={{ animationDelay: '0.2s' }}>
           <div className="glass right-sidebar-inner">
             {/* Mobile Drag Pill */}
             <div className="mobile-drag" />
             <div style={{ padding: '0 24px', marginBottom: 20 }}>
               <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
                 Live Incident Queue
               </h2>
             </div>
             <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px', WebkitOverflowScrolling: 'touch' }}>
                <EmergencyList emergencies={emergencies} />
             </div>
           </div>
        </div>
      </div>

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
