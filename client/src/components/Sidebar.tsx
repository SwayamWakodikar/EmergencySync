import { useState } from 'react';
import type { Ambulance, Emergency } from '../services/api';

interface Props {
  ambulances: Ambulance[];
  emergencies: Emergency[];
  onCreateEmergency: (description: string, location?: {latitude: number, longitude: number}) => void;
  isCreating: boolean;
  lastUpdated: Date | null;
  isConnected: boolean;
}

export default function Sidebar({
  onCreateEmergency,
  isCreating,
}: Props) {
  const [description, setDescription] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [gpsCoords, setGpsCoords] = useState<{lat: number, lng: number} | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const handleGPSClick = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        setGpsCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setLocationQuery('📍 Current GPS Location');
      },
      (error) => {
        setIsLocating(false);
        alert("Unable to retrieve your location. Please check browser permissions.");
        console.error(error);
      },
      { timeout: 10000, maximumAge: 0, enableHighAccuracy: true }
    );
  };

  const handleDispatch = async () => {
    if (!description.trim() || isCreating || isLocating) return;

    // 1. Use cached GPS coords if the user specifically used the GPS button
    if (gpsCoords && locationQuery === '📍 Current GPS Location') {
      onCreateEmergency(description, { latitude: gpsCoords.lat, longitude: gpsCoords.lng });
      setDescription('');
      setLocationQuery('');
      setGpsCoords(null);
      return;
    }

    // 2. Use manual query (Geocoding)
    if (locationQuery.trim()) {
      setIsLocating(true);
      try {
        const query = encodeURIComponent(locationQuery + ', Pune, Maharashtra, India');
        // Simple Nominatim search (requires a polite usage, sufficient for tests)
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
        const data = await res.json();
        
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          onCreateEmergency(description, { latitude: lat, longitude: lon });
          setDescription('');
          setLocationQuery('');
          setGpsCoords(null);
        } else {
          alert('Could not find that location in Pune. Please try a different landmark or pincode.');
        }
      } catch (err) {
        console.error("Geocoding failed:", err);
        alert('Failed to geocode location. Please check your connection.');
      } finally {
        setIsLocating(false);
      }
      return;
    }

    // 3. Fallback to random if no location provided
    onCreateEmergency(description);
    setDescription('');
  };

  return (
    <>
      {/* Create Emergency Form */}
      <div 
        className="glass"
        style={{ 
          borderRadius: 'var(--radius)',
          padding: 14,
          display: 'flex', 
          flexDirection: 'column', 
          gap: 12, 
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--danger)' }}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
           Dispatch New Emergency
        </div>
        
        {/* Description Input */}
        <div style={{ position: 'relative' }}>
          <textarea
            placeholder="Describe the emergency... (e.g., Car accident at Main St.)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isCreating || isLocating}
            maxLength={150}
            style={{
              width: '100%',
              height: 76,
              padding: '10px 12px',
              paddingBottom: '24px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: 13,
              lineHeight: 1.4,
              resize: 'none',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onFocus={(e) => {
               e.currentTarget.style.borderColor = '#ef4444';
               e.currentTarget.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.15)';
               e.currentTarget.style.background = 'var(--bg-card)';
            }}
            onBlur={(e) => {
               e.currentTarget.style.borderColor = 'var(--border)';
               e.currentTarget.style.boxShadow = 'none';
               e.currentTarget.style.background = 'var(--bg-surface)';
            }}
          />
          <div style={{
            position: 'absolute',
            bottom: 6,
            right: 8,
            fontSize: 10,
            fontWeight: 600,
            color: description.length >= 150 ? '#ef4444' : 'var(--text-muted)',
            pointerEvents: 'none',
          }}>
            {description.length}/150
          </div>
        </div>

        {/* Location Input */}
        <div style={{ position: 'relative', display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Location/Pincode (Leave blank for random)"
            value={locationQuery}
            onChange={(e) => {
              setLocationQuery(e.target.value);
              setGpsCoords(null); // Clear GPS cache if they type manually
            }}
            disabled={isCreating || isLocating}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
              transition: 'all 0.2s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-soft)';
              e.currentTarget.style.background = 'var(--bg-card)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.background = 'var(--bg-surface)';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleDispatch();
              }
            }}
          />
          <button
            onClick={handleGPSClick}
            disabled={isCreating || isLocating}
            title="Use Current Device GPS"
            style={{
              width: 40,
              flexShrink: 0,
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: (isCreating || isLocating) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!isCreating && !isLocating) {
                e.currentTarget.style.background = 'var(--bg-hover)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-surface)';
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0-10 10"/><path d="m12 12 4.5-4.5"/></svg>
          </button>
        </div>

        <button
          id="btn-create-emergency"
          onClick={handleDispatch}
          disabled={isCreating || isLocating || !description.trim()}
          style={{
            width: '100%',
            padding: '11px 0',
            borderRadius: 'var(--radius)',
            border: 'none',
            cursor: (isCreating || isLocating || !description.trim()) ? 'not-allowed' : 'pointer',
            background: (isCreating || isLocating || !description.trim())
              ? 'rgba(239,68,68,0.15)'
              : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: (isCreating || isLocating || !description.trim()) ? 'var(--text-muted)' : 'white',
            fontWeight: 700,
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: (isCreating || isLocating || !description.trim()) ? 'none' : '0 4px 16px rgba(239,68,68,0.35)',
            transition: 'all 0.2s ease',
            fontFamily: 'inherit',
            letterSpacing: '0.02em',
          }}
          onMouseEnter={(e) => {
            if (!isCreating && !isLocating && description.trim()) {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(239,68,68,0.4)';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            if (!isCreating && !isLocating && description.trim()) {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(239,68,68,0.35)';
            }
          }}
        >
          {isCreating || isLocating ? (
            <>
              <span className="animate-spin" style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} />
              {isLocating ? 'Locating/Geocoding…' : 'Dispatching…'}
            </>
          ) : (
            <>Dispatch Now</>
          )}
        </button>
        {!isCreating && !isLocating && (
          <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', marginTop: -6 }}>
            Geocoding powered by OpenStreetMap
          </div>
        )}
      </div>
    </>
  );
}
