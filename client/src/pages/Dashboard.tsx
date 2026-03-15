import { useState, useEffect, useCallback, useRef } from 'react';
import MapView from '../components/MapView';
import Sidebar from '../components/Sidebar';
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

  const handleCreateEmergency = async () => {
    setIsCreating(true);
    try {
      await createEmergency();
      await fetchData();
      showNotification('Emergency created and dispatched!', 'success');
    } catch {
      showNotification('Failed to create emergency. Is the server running?', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* ── Top Navbar ── */}
      <nav
        style={{
          height: 56,
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: 12,
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        {/* Logo + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              boxShadow: '0 0 14px rgba(239,68,68,0.4)',
            }}
          >
            🚨
          </div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              EmergencySync
            </h1>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Real-Time Dispatch
            </p>
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Live stats in navbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {[
            { label: 'Ambulances', value: ambulances.length, color: '#3b82f6' },
            { label: 'Active', value: emergencies.filter((e) => e.status !== 'COMPLETED').length, color: '#f97316' },
            { label: 'Completed', value: emergencies.filter((e) => e.status === 'COMPLETED').length, color: '#22c55e' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>
                {value}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {label}
              </div>
            </div>
          ))}

          {/* Connection badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              background: isConnected ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              border: `1px solid ${isConnected ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              borderRadius: 999,
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: isConnected ? '#22c55e' : '#ef4444',
                boxShadow: `0 0 6px ${isConnected ? '#22c55e' : '#ef4444'}`,
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 600, color: isConnected ? '#22c55e' : '#ef4444' }}>
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </nav>

      {/* ── Body (Sidebar + Map) ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          ambulances={ambulances}
          emergencies={emergencies}
          onCreateEmergency={handleCreateEmergency}
          isCreating={isCreating}
          lastUpdated={lastUpdated}
          isConnected={isConnected}
        />

        {/* Map area with padding */}
        <main style={{ flex: 1, padding: 12, overflow: 'hidden', display: 'flex' }}>
          <MapView
            ambulances={ambulances}
            emergencies={emergencies}
            assignments={assignments}
          />
        </main>
      </div>

      {/* ── Notification Toast ── */}
      {notification && (
        <div
          className="animate-fade-in-up"
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: notification.type === 'success'
              ? 'rgba(22,40,30,0.95)'
              : 'rgba(40,14,14,0.95)',
            border: `1px solid ${notification.type === 'success' ? '#22c55e' : '#ef4444'}`,
            borderRadius: 'var(--radius)',
            padding: '12px 20px',
            color: notification.type === 'success' ? '#22c55e' : '#ef4444',
            fontWeight: 600,
            fontSize: 13,
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: `0 8px 32px ${notification.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}
        >
          <span>{notification.type === 'success' ? '✅' : '❌'}</span>
          {notification.msg}
        </div>
      )}
    </div>
  );
}
