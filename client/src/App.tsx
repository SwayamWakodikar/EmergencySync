import { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import { pingServer } from './services/api';

export default function App() {
  const [isServerReady, setIsServerReady] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

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
      } catch (err) {
        console.error("Failed to wake up server:", err);
        // Retry until online
        setTimeout(wakeUpServer, 3000);
      }
    };
    wakeUpServer();

    return () => {
      isMounted = false;
    };
  }, []);

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
            <p className="text-gray-300 text-sm mb-8 animate-pulse text-center font-light tracking-wide max-w-xs">
              Establishing secure connection...
            </p>

            {/* Minimalist loading line */}
            <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-red-500 rounded-full w-1/3"
                style={{ animation: 'slideRight 1.5s ease-in-out infinite' }}
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

