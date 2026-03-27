import { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import { pingServer } from './services/api';

export default function App() {
  const [isServerReady, setIsServerReady] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isSuspended, setIsSuspended] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const wakeUpServer = async () => {
      try {
        await pingServer();
        if (isMounted) {
          setIsFadingOut(true);
          // Wait for fade out animation to complete before unmounting
          setTimeout(() => {
            if (isMounted) setIsServerReady(true);
          }, 1000); // 1s matches the duration of the transition
        }
      } catch (err: any) {
        console.error("Failed to wake up server:", err);
        if (isMounted) {
          // Detect 429 Too Many Requests (Suspension) or 503 Service Unavailable
          const errorStr = (err.message || "") + (err.toString() || "");
          const status = err.response ? err.response.status : null;
          
          const isSuspendedError = status === 429 || errorStr.includes('429');
          const isServiceUnavailable = status === 503 || errorStr.includes('503');
          
          if (isSuspendedError) {
            // Render explicitly suspended the server (429). Stop and show error.
            setIsSuspended(true);
            console.warn("Server is suspended by host. Stopping automatic retries.");
            return;
          }

          if (isServiceUnavailable || (errorStr.toLowerCase().includes('network error') && retryCount >= 2)) {
            // Server is waking up, restarting, or having high latency issue.
            // Show the error message but KEEP retrying because it starts eventually.
            setIsSuspended(true);
          }

          // Trigger next attempt via retryCount after 3 seconds
          setTimeout(() => {
            if (isMounted) setRetryCount(prev => prev + 1);
          }, 3000);
        }
      }
    };
    wakeUpServer();

    return () => {
      isMounted = false;
    };
  }, [retryCount]);

  const handleRetry = () => {
    setIsSuspended(false);
    setRetryCount(prev => prev + 1);
  };

  return (
    <>
      <div 
        className={`h-full w-full transition-all duration-1000 ease-in-out ${
          !isServerReady && !isFadingOut ? 'blur-md scale-[1.02] pointer-events-none' : 
          !isServerReady && isFadingOut ? 'blur-0 scale-100 pointer-events-none' : ''
        }`}
      >
        {isServerReady && <Dashboard />}
      </div>

      {!isServerReady && (
        <div 
          className={`fixed inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[24px] z-50 transition-opacity duration-1000 ease-out ${
            isFadingOut ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="relative flex flex-col items-center px-8 text-center">

            {/* ── Icon Area ── */}
            <div className={`relative w-32 h-32 mb-10 flex items-center justify-center`}>
              {/* Ambient glow behind icon */}
              <div className={`absolute inset-0 rounded-full blur-3xl transition-all duration-1000 ${isSuspended ? 'bg-red-500/30 scale-110' : 'bg-red-500/15 scale-90'}`} />

              {/* Spinning rings (loading only) */}
              {!isSuspended && <>
                <div className="absolute inset-0 border-[2px] border-red-500/15 rounded-full scale-110" />
                <div className="absolute inset-0 border-[2px] border-red-400 rounded-full border-t-transparent animate-spin opacity-50" />
                <div className="absolute inset-0 border-[2px] border-red-500 rounded-full border-r-transparent animate-spin-slow opacity-20 scale-125" />
              </>}

              {/* Icon */}
              <div className={`relative z-10 transition-all duration-700 ${isSuspended ? 'text-red-500' : 'text-red-400 animate-pulse'}`}>
                {isSuspended ? (
                  // Cloud-off icon
                  <svg className="w-14 h-14 drop-shadow-[0_0_16px_rgba(239,68,68,0.6)]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 7.5A5.5 5.5 0 0 1 13 5.07M19 12.5a4 4 0 0 0-5-3.87M3 3l18 18M8.5 8.5A5.5 5.5 0 0 0 8 19h11a4 4 0 0 0 .73-7.93" />
                  </svg>
                ) : (
                  // Lightning bolt icon
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
              </div>
            </div>

            {/* ── Branding ── */}
            <h1 className="text-5xl font-black tracking-tight text-white uppercase mb-3 drop-shadow-lg">
              Emergency<span className="text-red-500">Sync</span>
            </h1>

            {/* ── Status Message ── */}
            <p className={`text-sm font-semibold tracking-[0.18em] uppercase mb-10 transition-colors duration-500 ${
              isSuspended ? 'text-red-400' : 'text-slate-400 animate-pulse'
            }`}>
              {isSuspended ? 'Server Unavailable • Connection Refused' : 'Establishing Secure Connection...'}
            </p>

            {/* ── Action Area ── */}
            {isSuspended ? (
              <div className="flex flex-col items-center gap-5">
                {/* Primary CTA button */}
                <button
  onClick={handleRetry}
  className="flex items-center gap-2.5 bg-red-600 hover:bg-red-700 active:scale-[0.97] text-white font-medium text-sm tracking-wide px-7 py-3.5 rounded-full transition-all duration-150"
>
  <svg
    className="w-4 h-4 transition-transform duration-500 group-hover:rotate-180"
    fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
  Retry connection
</button>

                {/* Status badge */}
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-red-900/60 bg-red-950/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-red-400">System Offline</span>
                </div>
              </div>
            ) : (
              /* Loading bar */
              <div className="w-56 h-[2px] bg-white/8 rounded-full overflow-hidden">
                <div
                  className="h-full w-1/3 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                  style={{ animation: 'slideRight 2s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}
                />
              </div>
            )}
          </div>

          <style>{`
            @keyframes slideRight {
              0%   { transform: translateX(-150%); }
              50%  { transform: translateX(100%); }
              100% { transform: translateX(400%); }
            }
            .animate-spin-slow { animation: spin 3s linear infinite; }
          `}</style>
        </div>
      )}
    </>
  );
}


