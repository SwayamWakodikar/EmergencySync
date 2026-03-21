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
          const isRateLimited = err.response && err.response.status === 429;
          
          if (isRateLimited) {
            // Render explicitly suspended the server (status 429). Stop and show error.
            setIsSuspended(true);
            console.warn("Server is suspended by host. Stopping automatic retries.");
            return;
          }

          // Otherwise, it might be restarting (503, 504, or network error).
          // Keep retrying quietly and don't trigger the "Service not available" state.
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

  return (
    <>
      <div 
        className={`h-full w-full transition-all duration-1000 ease-in-out ${
          !isServerReady && !isFadingOut ? 'blur-md scale-[1.02] pointer-events-none' : 
          !isServerReady && isFadingOut ? 'blur-0 scale-100 pointer-events-none' : ''
        }`}
      >
        <Dashboard />
      </div>

      {!isServerReady && (
        <div 
          className={`fixed inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-lg z-50 transition-opacity duration-1000 ease-in-out ${
            isFadingOut ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="relative flex flex-col items-center">
            {/* Elegant spinner & logo */}
            <div className="w-16 h-16 mb-6 relative flex items-center justify-center">
              {/* Outer spinning ring */}
              <div className="absolute inset-0 border-[3px] border-red-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-[3px] border-red-500 rounded-full border-t-transparent animate-spin"></div>
              
              {/* Center icon */}
              <div className="text-red-500 relative z-10 animate-pulse">
                <svg 
                  className="w-7 h-7" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2.5} 
                    d="M13 10V3L4 14h7v7l9-11h-7z" 
                  />
                </svg>
              </div>
            </div>
            
            <h1 className="text-2xl font-semibold text-white mb-2 tracking-wide drop-shadow-md">
              EmergencySync
            </h1>
            <p className={`text-sm mb-8 text-center font-light tracking-wide max-w-xs transition-colors duration-500 ${isSuspended ? 'text-red-400 font-medium' : 'text-gray-300 animate-pulse'}`}>
              {isSuspended 
                ? "Service not available, try again later" 
                : "Establishing secure connection..."}
            </p>

            {/* Minimalist loading line */}
            <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full w-1/3 transition-colors duration-500 ${isSuspended ? 'bg-red-600' : 'bg-red-500'}`}
                style={{ animation: isSuspended ? 'none' : 'slideRight 1.5s ease-in-out infinite' }}
              ></div>
            </div>
          </div>
          
          <style>
            {`
              @keyframes slideRight {
                0% { transform: translateX(-100%); }
                50% { transform: translateX(200%); }
                100% { transform: translateX(-100%); }
              }
            `}
          </style>
        </div>
      )}
    </>
  );
}


