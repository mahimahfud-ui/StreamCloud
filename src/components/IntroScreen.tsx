import React, { useEffect, useState } from 'react';

interface IntroScreenProps {
  onFinish: () => void;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({ onFinish }) => {
  const [leaving, setLeaving] = useState(false);
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    // Fast progress count-up
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => handleDismiss(), 400);
          return 100;
        }
        const step = Math.floor(Math.random() * 15) + 12;
        return Math.min(100, prev + step);
      });
    }, 120);

    const failsafe = setTimeout(() => {
      handleDismiss();
    }, 3800);

    return () => {
      clearInterval(interval);
      clearTimeout(failsafe);
    };
  }, []);

  const handleDismiss = () => {
    if (leaving) return;
    setLeaving(true);
    try {
      sessionStorage.setItem('nf-intro', '1');
    } catch {
      // ignore
    }
    setTimeout(() => {
      onFinish();
    }, 650);
  };

  return (
    <div
      onClick={handleDismiss}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black cursor-pointer transition-opacity duration-700 select-none ${
        leaving ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        backgroundImage: 'radial-gradient(ellipse at center, rgba(229,9,20,0.35), transparent 65%)'
      }}
    >
      <div className="relative flex flex-col items-center justify-center">
        <div className="w-36 h-36 md:w-56 md:h-56 relative animate-pulse flex items-center justify-center">
          <img
            src="/s-logo-v1.svg"
            alt="StreamCloud"
            className="w-full h-full object-contain filter drop-shadow-[0_0_35px_rgba(229,9,20,0.6)]"
          />
        </div>
        <div className="mt-8 text-center">
          <h2 className="font-['Bebas_Neue'] text-3xl md:text-5xl tracking-widest text-white/90">
            STREAMCLOUD
          </h2>
          <p className="text-xs uppercase tracking-[0.25em] text-neutral-400 mt-1">
            Cinematic Directory
          </p>
        </div>
      </div>

      <div className="absolute bottom-14 flex items-baseline gap-1 text-white font-mono">
        <span className="text-4xl md:text-5xl font-extralight tracking-tight tabular-nums">
          {progress}
        </span>
        <span className="text-sm text-neutral-400 font-sans">%</span>
      </div>

      <div className="absolute bottom-6 text-neutral-600 text-xs tracking-widest uppercase hover:text-neutral-400 transition-colors">
        Click anywhere to skip
      </div>
    </div>
  );
};
