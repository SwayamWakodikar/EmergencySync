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

  // Sidebar toggle
  const [showSidebar, setShowSidebar] = useState(false);
  const [cardCollapsed, setCardCollapsed] = useState(false);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: isConnected ? '#10b981' : '#ef4444' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: isConnected ? '#10b981' : '#ef4444' }}>{isConnected ? 'Connected' : 'Offline'}</span>
          </div>
          <button
            onClick={() => setShowSidebar(s => !s)}
            style={{
              width: 34, height: 34, borderRadius: 8,
              border: `1px solid ${showSidebar ? '#f59e0b' : '#333'}`,
              background: showSidebar ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.05)',
              color: showSidebar ? '#f59e0b' : '#888',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.2s ease',
              position: 'relative',
            }}
            title="Toggle Incident Feed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
            {emergencies.filter(e => e.status !== 'COMPLETED').length > 0 && (
              <div style={{ position: 'absolute', top: -3, right: -3, width: 14, height: 14, borderRadius: '50%', background: '#ef4444', fontSize: 8, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {emergencies.filter(e => e.status !== 'COMPLETED').length}
              </div>
            )}
          </button>
        </div>
      </div>

      {/* ── Bottom Card ── */}
      <div className="user-bottom-card" style={cardCollapsed ? { padding: 0 } : undefined}>
        {/* Collapse/Expand handle */}
        <div
          onClick={() => setCardCollapsed(c => !c)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: cardCollapsed ? '12px 20px' : '4px 0 0',
            cursor: 'pointer', userSelect: 'none',
          }}
        >
          {cardCollapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#888', flex: 1 }}>Report Emergency</span>
              <div style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #333', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 16 }}>
                ▴
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 36, height: 4, borderRadius: 99, background: '#444' }} />
              <div style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 14 }}>
                ▾
              </div>
            </div>
          )}
        </div>
        <div style={{
          maxHeight: cardCollapsed ? 0 : 800,
          opacity: cardCollapsed ? 0 : 1,
          overflow: 'hidden',
          transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
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
            {/* Header + available responders */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Report Emergency</div>
                  <div style={{ fontSize: 11, color: '#666' }}>We'll dispatch help immediately</div>
                </div>
              </div>
              {/* Available responders badge */}
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { type: 'AMBULANCE', color: '#4f46e5', label: '🚑' },
                  { type: 'FIRE', color: '#ef4444', label: '🚒' },
                  { type: 'POLICE', color: '#3b82f6', label: '🚓' },
                ].map(({ type, color, label }) => {
                  const count = ambulances.filter(a => a.status === 'FREE' && a.type === type).length;
                  return (
                    <div key={type} title={`${count} ${type.toLowerCase()} available`} style={{
                      display: 'flex', alignItems: 'center', gap: 3,
                      padding: '3px 6px', borderRadius: 6,
                      background: count > 0 ? `${color}15` : 'rgba(255,255,255,0.03)',
                      fontSize: 11, fontWeight: 700,
                      color: count > 0 ? color : '#444',
                      border: `1px solid ${count > 0 ? `${color}30` : '#1a1a1a'}`,
                    }}>
                      <span style={{ fontSize: 12 }}>{label}</span>
                      <span>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick emergency type buttons */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              {[
                { label: '🔥 Fire', desc: 'There is a fire in my building, smoke is spreading fast and people need help evacuating' },
                { label: '🏥 Medical', desc: 'Someone has collapsed and is not responding, they need an ambulance immediately' },
                { label: '🚨 Crime', desc: 'There is a robbery happening right now, armed men are threatening people, send police immediately' },
                { label: '🚗 Accident', desc: 'Major road accident just happened, vehicles have collided and people are injured and bleeding' },
              ].map(({ label, desc }) => (
                <button
                  key={label}
                  onClick={() => setDescription(desc)}
                  disabled={isCreating || isLocating}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 8,
                    border: '1px solid #222', background: '#111',
                    color: '#ccc', fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s ease',
                    fontFamily: 'inherit', textAlign: 'center',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.borderColor = '#333'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#111'; e.currentTarget.style.borderColor = '#222'; }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Description input with counter */}
            <div style={{ position: 'relative' }}>
              <textarea
                placeholder="Describe what's happening…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isCreating || isLocating}
                maxLength={200}
                className="user-input"
                style={{ height: 68, resize: 'none', paddingBottom: 22 }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleDispatch(); } }}
              />
              <div style={{
                position: 'absolute', bottom: 6, right: 10,
                fontSize: 9, fontWeight: 600,
                color: description.length >= 180 ? '#ef4444' : '#444',
              }}>
                {description.length}/200
              </div>
            </div>

            {/* Location row */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="📍 Location (leave blank for auto)"
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

            {/* SOS button */}
            <button
              onClick={handleDispatch}
              disabled={isCreating || isLocating || !description.trim()}
              className="user-sos-btn"
            >
              {isCreating || isLocating ? (
                <>
                  <span className="animate-spin" style={{ display: 'inline-block', width: 16, height: 16, border: '2.5px solid white', borderTopColor: 'transparent', borderRadius: '50%' }} />
                  {isLocating ? 'Finding your location…' : 'Contacting dispatch…'}
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                  Call for Help
                </>
              )}
            </button>

            {/* ── Quick Dial Emergency Services ── */}
            <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: 10, marginTop: 2 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                Call Emergency Services
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  { number: '112', label: 'All Emergency', color: '#ef4444', icon: '🆘' },
                  { number: '108', label: 'Ambulance', color: '#4f46e5', icon: '🚑' },
                  { number: '101', label: 'Fire Brigade', color: '#f59e0b', icon: '🚒' },
                  { number: '100', label: 'Police', color: '#3b82f6', icon: '🚓' },
                ].map(({ number, label, color, icon }) => (
                  <a
                    key={number}
                    href={`tel:${number}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 10px', borderRadius: 8,
                      border: '1px solid #222', background: '#0d0d0d',
                      textDecoration: 'none', transition: 'all 0.15s ease',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = `${color}08`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.background = '#0d0d0d'; }}
                  >
                    <span style={{ fontSize: 16 }}>{icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{number}</div>
                      <div style={{ fontSize: 9, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, flexShrink: 0 }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </a>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
              <div style={{ fontSize: 10, color: '#444' }}>
                AI-assisted triage • OpenStreetMap
              </div>
              <div style={{ fontSize: 10, color: '#444', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: emergencies.filter(e => e.status !== 'COMPLETED').length > 0 ? '#f59e0b' : '#10b981' }} />
                {emergencies.filter(e => e.status !== 'COMPLETED').length} active incidents
              </div>
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
      </div>

      {/* ── Incident Sidebar ── */}
      <div
        style={{
          position: 'absolute',
          top: 0, right: 0, bottom: 0,
          width: 360,
          zIndex: 900,
          background: 'rgba(8,8,8,0.95)',
          backdropFilter: 'blur(20px)',
          borderLeft: '1px solid #1a1a1a',
          transform: showSidebar ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Sidebar header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, marginTop: 48 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
              Incident Feed
            </div>
            <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{emergencies.length} total • {emergencies.filter(e => e.status !== 'COMPLETED').length} active • {emergencies.filter(e => e.status === 'COMPLETED').length} resolved</div>
          </div>
          <button onClick={() => setShowSidebar(false)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #222', background: '#111', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>

        {/* Incident list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {['WAITING', 'ASSIGNED', 'COMPLETED'].map(status => {
            const items = emergencies.filter(e => e.status === status);
            if (items.length === 0) return null;
            const cfg = status === 'WAITING' ? { label: 'Waiting for Dispatch', color: '#ef4444' } : status === 'ASSIGNED' ? { label: 'Units Responding', color: '#f59e0b' } : { label: 'Resolved', color: '#10b981' };
            return (
              <div key={status} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '0 2px' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{cfg.label}</span>
                  <span style={{ fontSize: 9, fontWeight: 800, color: cfg.color, background: `${cfg.color}15`, padding: '2px 8px', borderRadius: 99 }}>{items.length}</span>
                </div>
                {items.map(em => {
                  const sevLabels = ['', 'Minor', 'Moderate', 'Serious', 'Severe', 'Critical'];
                  return (
                    <div key={em.id} style={{ padding: 12, background: '#111', borderRadius: 8, border: '1px solid #1a1a1a', marginBottom: 6, transition: 'border-color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = cfg.color}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#1a1a1a'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color }} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Incident #{em.id}</span>
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 700, color: cfg.color, background: `${cfg.color}15`, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>{em.type}</span>
                      </div>
                      {/* Severity bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#666', width: 50 }}>Severity</span>
                        <div style={{ display: 'flex', gap: 2 }}>
                          {[1,2,3,4,5].map(i => (
                            <div key={i} style={{ width: 10, height: 4, borderRadius: 2, background: i <= em.severity ? (em.severity >= 4 ? '#ef4444' : em.severity === 3 ? '#f59e0b' : '#4f46e5') : '#222' }} />
                          ))}
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: em.severity >= 4 ? '#ef4444' : '#aaa' }}>{sevLabels[em.severity]}</span>
                      </div>
                      {em.description && <div style={{ fontSize: 11, color: '#888', lineHeight: 1.4, marginTop: 4, wordBreak: 'break-word' }}>{em.description}</div>}
                      {em.action_plan && <div style={{ fontSize: 10, color: '#aaa', marginTop: 6, padding: '6px 8px', background: '#0d0d0d', borderRadius: 6, borderLeft: '2px solid #f59e0b', lineHeight: 1.4 }}>{em.action_plan}</div>}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {emergencies.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#444' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>No active incidents</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>The city is safe.</div>
            </div>
          )}
        </div>
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
