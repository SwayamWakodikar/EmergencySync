import { useState } from 'react';
import type { Ambulance, Emergency } from '../services/api';

interface Props {
  ambulances: Ambulance[];
  emergencies: Emergency[];
  onCreateEmergency: (description: string) => void;
  isCreating: boolean;
  lastUpdated: Date | null;
  isConnected: boolean;
}

export default function Sidebar({
  onCreateEmergency,
  isCreating,
}: Props) {
  const [description, setDescription] = useState('');

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
        <div style={{ position: 'relative' }}>
          <textarea
            placeholder="Describe the emergency... (e.g., Car accident at Main St.)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                if (!isCreating && description.trim()) {
                  onCreateEmergency(description);
                  setDescription('');
                }
              }
            }}
            disabled={isCreating}
            maxLength={150}
            style={{
              width: '100%',
              height: 76,
              padding: '10px 12px',
              paddingBottom: '24px', // Make room for char count
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
        <button
          id="btn-create-emergency"
          onClick={() => {
            if (description.trim()) {
              onCreateEmergency(description);
              setDescription('');
            }
          }}
          disabled={isCreating || !description.trim()}
          style={{
            width: '100%',
            padding: '11px 0',
            borderRadius: 'var(--radius)',
            border: 'none',
            cursor: (isCreating || !description.trim()) ? 'not-allowed' : 'pointer',
            background: (isCreating || !description.trim())
              ? 'rgba(239,68,68,0.15)'
              : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: (isCreating || !description.trim()) ? 'var(--text-muted)' : 'white',
            fontWeight: 700,
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: (isCreating || !description.trim()) ? 'none' : '0 4px 16px rgba(239,68,68,0.35)',
            transition: 'all 0.2s ease',
            fontFamily: 'inherit',
            letterSpacing: '0.02em',
          }}
          onMouseEnter={(e) => {
            if (!isCreating && description.trim()) {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(239,68,68,0.4)';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            if (!isCreating && description.trim()) {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(239,68,68,0.35)';
            }
          }}
        >
          {isCreating ? (
            <>
              <span className="animate-spin" style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} />
              Dispatching…
            </>
          ) : (
            <>Dispatch Now</>
          )}
        </button>
        {!isCreating && (
          <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', marginTop: -6 }}>
            Press <kbd style={{ fontFamily: 'inherit', background: 'var(--bg-card)', padding: '2px 4px', borderRadius: 4, border: '1px solid var(--border)' }}>Ctrl</kbd> + <kbd style={{ fontFamily: 'inherit', background: 'var(--bg-card)', padding: '2px 4px', borderRadius: 4, border: '1px solid var(--border)' }}>Enter</kbd> to dispatch
          </div>
        )}
      </div>
    </>
  );
}
