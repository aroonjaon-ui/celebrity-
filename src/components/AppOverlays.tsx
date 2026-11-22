import React from 'react';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import { SupportChat } from './SupportChat.tsx';

export const AppOverlays: React.FC = () => {
  const { approvalPopup, dismissApprovalPopup, toasts, dismissToast, navigate } = usePlatform();
  const { t } = useLanguage();
  return (
    <>
      {approvalPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 px-4">
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded-3xl p-7 shadow-2xl">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${approvalPopup.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              {approvalPopup.status === 'approved' ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
            </div>
            <h2 className="font-display text-xl font-bold text-zinc-950">{t(approvalPopup.title)}</h2>
            <p className="mt-2 text-sm text-zinc-600 leading-relaxed">{approvalPopup.message}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => { dismissApprovalPopup(); navigate(approvalPopup.type === 'booking' ? '/bookings' : '/client-profile'); }} className="px-4 py-2 text-xs font-semibold text-white bg-zinc-950 rounded-xl hover:bg-blue-600 cursor-pointer">
                {approvalPopup.type === 'booking' ? t('View Booking') : t('View Fan Card')}
              </button>
              <button type="button" onClick={dismissApprovalPopup} className="px-4 py-2 text-xs font-semibold text-zinc-600 border border-zinc-200 rounded-xl hover:border-zinc-950 cursor-pointer">
                {t('Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      {toasts.length > 0 && (
        <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none lg:bottom-4">
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto bg-zinc-950 text-white border border-zinc-800 rounded-2xl shadow-xl p-4 flex items-start justify-between gap-3" role="status">
              <div>
                <p className="text-xs font-semibold text-white">{toast.title}</p>
                <p className="mt-0.5 text-xs text-zinc-300 leading-relaxed">{toast.message}</p>
              </div>
              <button type="button" onClick={() => dismissToast(toast.id)} className="text-zinc-400 hover:text-white p-1 cursor-pointer" aria-label="Dismiss notification">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <SupportChat />
    </>
  );
};
