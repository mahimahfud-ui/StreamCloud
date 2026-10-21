import React from 'react';
import { CheckCircle2, Info } from 'lucide-react';

interface ToastProps {
  message: string | null;
}

export const Toast: React.FC<ToastProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[150] animate-bounce-in flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-neutral-900 border border-neutral-700 text-white text-xs font-semibold shadow-2xl backdrop-blur-xl pointer-events-none">
      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      <span>{message}</span>
    </div>
  );
};
