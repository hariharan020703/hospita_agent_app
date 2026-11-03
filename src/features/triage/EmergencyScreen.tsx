// Full-screen emergency guidance. Shown for red-flag symptoms; it offers calling 108 or the hospital's Emergency
// department and directions, and never offers booking.
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { HeartHandshake, MapPin, Phone, Siren } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Hospital, Lang, RedFlag } from '@/types';
import { SAFETY_SCREEN_FLAG } from './engine';

const dial = (number: string) => `tel:${number.replace(/\s+/g, '')}`;

export function EmergencyScreen({
  hospital,
  redFlag,
  redFlagId,
  lang,
  footer,
  size = 'md',
}: {
  hospital: Hospital | undefined;
  redFlag?: RedFlag | undefined;
  redFlagId?: string | null;
  lang: Lang;
  /** Closing action, e.g. "Go to home" or the kiosk's "Done". */
  footer: ReactNode;
  size?: 'md' | 'lg';
}) {
  const { t } = useTranslation('triage');
  const titleRef = useRef<HTMLHeadingElement>(null);
  const big = size === 'lg';

  useEffect(() => {
    titleRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const callButton = (href: string, label: string, sub: string, primary: boolean) => (
    <a
      href={href}
      className={cn(
        'flex items-center gap-4 rounded-2xl px-5 font-bold shadow-md transition-transform active:scale-[0.99]',
        big ? 'min-h-20 text-2xl' : 'min-h-16 text-xl',
        primary ? 'bg-white text-danger-hover' : 'border-2 border-white/80 text-white hover:bg-white/10',
      )}
    >
      <Phone aria-hidden className={big ? 'h-8 w-8' : 'h-7 w-7'} />
      <span className="flex flex-col leading-tight">
        {label}
        <span className={cn('font-semibold opacity-80', big ? 'text-base' : 'text-sm')}>{sub}</span>
      </span>
    </a>
  );

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="emergency-title"
      aria-describedby="emergency-body"
      className="fixed inset-0 z-[70] overflow-y-auto bg-danger text-white"
    >
      <div className={cn('mx-auto flex min-h-full flex-col gap-6 px-5 py-8', big ? 'max-w-4xl' : 'max-w-xl')}>
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/15">
            <Siren aria-hidden className="h-8 w-8" />
          </span>
          <h1
            id="emergency-title"
            ref={titleRef}
            tabIndex={-1}
            className={cn('font-extrabold leading-tight focus:outline-none', big ? 'text-4xl' : 'text-3xl')}
          >
            {t('emergency.title')}
          </h1>
        </div>
        <p id="emergency-body" className={cn('leading-relaxed', big ? 'text-xl' : 'text-lg')}>
          {t('emergency.body')}
        </p>
        {(redFlag || redFlagId === SAFETY_SCREEN_FLAG) && (
          <p className={cn('rounded-xl bg-white/10 px-4 py-3', big ? 'text-lg' : 'text-base')}>
            <span className="font-semibold">{t('emergency.reasonLabel')}: </span>
            {redFlag ? redFlag.label[lang] : t('emergency.safetyAnswer')}
          </p>
        )}
        <div className="grid gap-3">
          {callButton(
            dial(hospital?.phones.ambulance ?? '108'),
            t('emergency.call108'),
            hospital?.phones.ambulance ?? '108',
            true,
          )}
          {hospital &&
            callButton(dial(hospital.phones.emergency), t('emergency.callHospital'), hospital.phones.emergency, false)}
          {redFlag?.helpline &&
            callButton(dial(redFlag.helpline.number), redFlag.helpline.label[lang], redFlag.helpline.number, false)}
        </div>
        {hospital && (
          <section
            aria-labelledby="emergency-where"
            className={cn('space-y-2 rounded-2xl bg-white/10 p-4', big ? 'text-lg' : 'text-base')}
          >
            <h2 id="emergency-where" className="flex items-center gap-2 font-bold">
              <MapPin aria-hidden className="h-5 w-5" />
              {t('emergency.where')}
            </h2>
            <p className="font-semibold">{hospital.emergency.location[lang]}</p>
            <p>{hospital.emergency.directions[lang]}</p>
            <p className="opacity-90">{t('emergency.open')}</p>
          </section>
        )}
        <p className={cn('flex items-start gap-2', big ? 'text-lg' : 'text-base')}>
          <HeartHandshake aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
          {t('emergency.stayWithSomeone')}
        </p>
        <div className="mt-auto pt-2">{footer}</div>
      </div>
    </div>,
    document.body,
  );
}

export function EscalatedNotice({
  reason,
  hospitalPhone,
  action,
  size = 'md',
}: {
  reason: 'unclear_routing' | 'asked_for_human' | 'safety_unclear';
  hospitalPhone?: string | undefined;
  action?: ReactNode;
  size?: 'md' | 'lg';
}) {
  const { t } = useTranslation('triage');
  const big = size === 'lg';
  return (
    <section
      aria-labelledby="escalated-title"
      className={cn('space-y-3 rounded-2xl border bg-surface p-5 shadow-sm', big && 'text-lg')}
    >
      <h2 id="escalated-title" className={cn('font-bold text-fg', big ? 'text-2xl' : 'text-xl')}>
        {t('escalated.title')}
      </h2>
      <p className="text-fg">{t(`escalated.${reason}`)}</p>
      <p className="text-fg-muted">{t('escalated.nextSteps')}</p>
      <div className="flex flex-wrap gap-2">
        {hospitalPhone && (
          <a
            href={dial(hospitalPhone)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-strong px-4 font-semibold text-fg hover:bg-surface-sunken"
          >
            <Phone aria-hidden className="h-4 w-4" />
            {t('escalated.callHospital')}
          </a>
        )}
        {action}
      </div>
    </section>
  );
}
