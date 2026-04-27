import { useState, useEffect, useCallback, useRef } from 'react';
import MapView from '../components/MapView';
import api, { getAmbulances, getEmergencies, getAssignments } from '../services/api';
import type { Ambulance, Emergency, Assignment } from '../services/api';

const POLL_INTERVAL = 1500;

export default function Dashboard() {
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form state
  const [description, setDescription] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // After-dispatch tracking
  const [myEmergency, setMyEmergency] = useState<Emergency | null>(null);
  const [myEmergencyId, setMyEmergencyId] = useState<number | null>(null);

  // Prank/easter egg reply
  const [prankReply, setPrankReply] = useState<{ msg: string; emoji: string } | null>(null);

  const showNotification = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    if (notifTimer.current) clearTimeout(notifTimer.current);
    notifTimer.current = setTimeout(() => setNotification(null), 4000);
  };

  const fetchData = useCallback(async () => {
    try {
      const [ambs, ems, asns] = await Promise.all([getAmbulances(), getEmergencies(), getAssignments()]);
      setAmbulances(ambs);
      setEmergencies(ems);
      setAssignments(asns);
      setIsConnected(true);

      // Track user's own emergency
      if (myEmergencyId) {
        const mine = ems.find(e => e.id === myEmergencyId);
        setMyEmergency(mine || null);
        if (mine?.status === 'COMPLETED') {
          // Auto-clear after 8 seconds
          setTimeout(() => { setMyEmergency(null); setMyEmergencyId(null); }, 8000);
        }
      }
    } catch {
      setIsConnected(false);
    }
  }, [myEmergencyId]);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchData]);

  // GPS handler
  const handleGPS = () => {
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setGpsCoords({ lat, lng });
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const data = await res.json();
          setLocationQuery(data?.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        } catch {
          setLocationQuery(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        } finally { setIsLocating(false); }
      },
      () => { setIsLocating(false); alert('Unable to get location. Check permissions.'); },
      { timeout: 10000, maximumAge: 0, enableHighAccuracy: true }
    );
  };

  // Dispatch handler
  const handleDispatch = async () => {
    if (!description.trim() || isCreating || isLocating) return;
    setIsCreating(true);
    try {
      let location: { latitude: number; longitude: number } | undefined;

      if (gpsCoords && locationQuery) {
        location = { latitude: gpsCoords.lat, longitude: gpsCoords.lng };
      } else if (locationQuery.trim()) {
        setIsLocating(true);
        const query = encodeURIComponent(locationQuery + ', Pune, Maharashtra, India');
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
        const data = await res.json();
        setIsLocating(false);
        if (data?.length > 0) {
          location = { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
        } else {
          showNotification('Could not find that location. Try a landmark or pincode.', 'error');
          setIsCreating(false);
          return;
        }
      }

      const { data: result } = await api.post('/emergency', { description, ...location });

      if (result.success && result.id) {
        setMyEmergencyId(result.id);
        showNotification('Emergency reported! Help is on the way.', 'success');
        setDescription('');
        setLocationQuery('');
        setGpsCoords(null);
        await fetchData();
      } else {
        showNotification(result.error || 'Failed to report emergency.', 'error');
      }
    } catch (err: any) {
      if (err?.response?.data?.is_prank) {
        // Show funny AI reply as a card, not an error
        setPrankReply({ msg: err.response.data.error, emoji: err.response.data.emoji || '🤨' });
      } else {
        const msg = err?.response?.data?.error || err.message || 'Failed to connect. Is the server running?';
        showNotification(msg, 'error');
      }
    } finally {
      setIsCreating(false);
      setIsLocating(false);
    }
  };

  // Find vehicles assigned to user's emergency
  const myAssignedVehicles = myEmergency
    ? assignments
        .filter(a => a.emergency_id === myEmergency.id)
        .map(a => ambulances.find(amb => amb.id === a.ambulance_id))
        .filter(Boolean) as Ambulance[]
    : [];

  const isTracking = myEmergency && myEmergency.status !== 'COMPLETED';
  const isResolved = myEmergency?.status === 'COMPLETED';

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#000' }}>
      {/* ── Full-screen Map ── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <MapView ambulances={ambulances} emergencies={emergencies} assignments={assignments} />
      </div>

      {/* ── Top Bar ── */}
      <div className="user-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>EmergencySync</div>
            <div style={{ fontSize: 10, color: '#888', fontWeight: 500 }}>Pune City Emergency Response</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: isConnected ? '#10b981' : '#ef4444' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: isConnected ? '#10b981' : '#ef4444' }}>{isConnected ? 'Connected' : 'Offline'}</span>
        </div>
      </div>

      {/* ── Bottom Card ── */}
      <div className="user-bottom-card">
        {prankReply ? (
          /* ── Funny AI Reply (Easter Egg) ── */
          <>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>{prankReply.emoji}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f59e0b', marginBottom: 8 }}>Nice try!</div>
              <div style={{ fontSize: 13, color: '#ccc', lineHeight: 1.6, padding: '0 8px' }}>
                {prankReply.msg}
              </div>
            </div>
            <button
              onClick={() => { setPrankReply(null); setDescription(''); }}
              className="user-sos-btn"
              style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)', boxShadow: '0 4px 20px rgba(245,158,11,0.3)' }}
            >
              Try Again with a Real Emergency
            </button>
          </>
        ) : !isTracking && !isResolved ? (
          /* ── Report Form ── */
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Report Emergency</div>
                <div style={{ fontSize: 11, color: '#666' }}>Describe what's happening and we'll send help</div>
              </div>
            </div>

            <textarea
              placeholder="What's the emergency? (e.g., Fire in building, someone injured...)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isCreating || isLocating}
              maxLength={150}
              className="user-input"
              style={{ height: 72, resize: 'none' }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleDispatch(); } }}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="Your location (or leave blank for auto)"
                value={locationQuery}
                onChange={(e) => { setLocationQuery(e.target.value); setGpsCoords(null); }}
                disabled={isCreating || isLocating}
                className="user-input"
                style={{ flex: 1 }}
              />
              <button onClick={handleGPS} disabled={isCreating || isLocating} className="user-gps-btn" title="Use GPS">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M2 12h4"/><path d="M18 12h4"/></svg>
              </button>
            </div>

            <button
              onClick={handleDispatch}
              disabled={isCreating || isLocating || !description.trim()}
              className="user-sos-btn"
            >
              {isCreating || isLocating ? (
                <>
                  <span className="animate-spin" style={{ display: 'inline-block', width: 16, height: 16, border: '2.5px solid white', borderTopColor: 'transparent', borderRadius: '50%' }} />
                  {isLocating ? 'Finding your location…' : 'Sending emergency…'}
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                  Call for Help
                </>
              )}
            </button>

            <div style={{ textAlign: 'center', fontSize: 10, color: '#555', marginTop: -4 }}>
              Powered by OpenStreetMap • AI-assisted triage
            </div>
          </>
        ) : isResolved ? (
          /* ── Resolved State ── */
          <>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>Emergency Resolved</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>All units have completed their response.</div>
            </div>
            <button onClick={() => { setMyEmergency(null); setMyEmergencyId(null); }} className="user-sos-btn" style={{ background: '#222', color: '#fff' }}>
              Report New Emergency
            </button>
          </>
        ) : (
          /* ── Tracking State ── */
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div className="user-pulse-ring">
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: myEmergency?.status === 'WAITING' ? '#ef4444' : '#f59e0b' }} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                  {myEmergency?.status === 'WAITING' ? 'Finding available units…' : 'Help is on the way!'}
                </div>
                <div style={{ fontSize: 11, color: '#888' }}>
                  Incident #{myEmergency?.id} • {myEmergency?.type}
                </div>
              </div>
            </div>

            {/* AI Action Plan */}
            {myEmergency?.action_plan && (
              <div style={{ padding: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 8, borderLeft: '3px solid #f59e0b', marginBottom: 12, fontSize: 12, color: '#ccc', lineHeight: 1.5 }}>
                {myEmergency.action_plan}
              </div>
            )}

            {/* Dispatched Vehicles */}
            {myAssignedVehicles.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Dispatched Units</div>
                {myAssignedVehicles.map(v => (
                  <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#111', borderRadius: 8, border: '1px solid #222' }}>
                    <span style={{ fontSize: 20 }}>
                      {v.type === 'FIRE' ? '🚒' : v.type === 'POLICE' ? '🚓' : '🚑'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{v.type === 'FIRE' ? 'Fire Truck' : v.type === 'POLICE' ? 'Police Unit' : 'Ambulance'} #{v.id}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: v.status === 'ASSIGNED' ? '#f59e0b' : '#10b981' }}>
                        {v.status === 'ASSIGNED' ? '● En Route' : '● Available'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Types needed badge */}
            {myEmergency?.types_needed && myEmergency.types_needed.length > 1 && (
              <div style={{ fontSize: 11, color: '#888', textAlign: 'center', marginBottom: 8 }}>
                Multi-unit response: {myEmergency.types_needed.map(t => t === 'FIRE' ? '🚒' : t === 'POLICE' ? '🚓' : '🚑').join(' ')}
              </div>
            )}

            <button onClick={() => { setMyEmergency(null); setMyEmergencyId(null); }} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #333', background: 'transparent', color: '#888', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Dismiss Tracking
            </button>
          </>
        )}
      </div>

      {/* ── Notification Toast ── */}
      {notification && (
        <div className="user-toast animate-fade-in-up" style={{ color: notification.type === 'success' ? '#10b981' : '#ef4444', borderColor: notification.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)' }}>
          {notification.type === 'success' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
          )}
          {notification.msg}
        </div>
      )}
    </div>
  );
}
