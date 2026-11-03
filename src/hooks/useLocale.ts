import { useTranslation } from 'react-i18next';
import type { Doctor, Lang, Localized } from '@/types';

/** Active language plus helpers to show bilingual data (department names, doctor names in Tamil script). */
export function useLocale() {
  const { i18n, t } = useTranslation();
  const lang: Lang = i18n.language === 'ta' ? 'ta' : 'en';
  const l = (text: Localized | undefined): string => (text ? text[lang] : '');
  const doctorName = (
    doctor: Pick<Doctor, 'name' | 'nameTa'> | { doctorName: string; doctorNameTa?: string | undefined },
  ) => {
    const en = 'name' in doctor ? doctor.name : doctor.doctorName;
    const ta = 'name' in doctor ? doctor.nameTa : doctor.doctorNameTa;
    return t('doctorName', { name: lang === 'ta' && ta ? ta : en });
  };
  return { lang, l, doctorName };
}
