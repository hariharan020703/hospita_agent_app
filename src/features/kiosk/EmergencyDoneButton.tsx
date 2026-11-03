// "Done" for the footer of the full-screen emergency guidance (white on the emergency red); resets the kiosk.
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';

export function EmergencyDoneButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-12 items-center gap-3 rounded-2xl border-2 border-white px-6 text-lg font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline-white"
    >
      <Check aria-hidden className="h-7 w-7" />
      {t('actions.done')}
    </button>
  );
}
