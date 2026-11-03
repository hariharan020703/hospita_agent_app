import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home } from 'lucide-react';
import { useHospital } from '@/hooks/queries/directory';
import { useLocale } from '@/hooks/useLocale';
import { EmergencyScreen } from '@/features/triage/EmergencyScreen';

/** Always-available emergency information (header button), without a symptom conversation. */
export default function EmergencyPage() {
  const { t } = useTranslation();
  const { lang } = useLocale();
  const hospital = useHospital();
  return (
    <EmergencyScreen
      hospital={hospital.data}
      lang={lang}
      footer={
        <Link
          to="/app"
          className="inline-flex min-h-12 items-center gap-2 rounded-xl px-4 font-semibold text-white underline-offset-4 hover:underline"
        >
          <Home aria-hidden className="h-5 w-5" />
          {t('actions.goHome')}
        </Link>
      }
    />
  );
}
