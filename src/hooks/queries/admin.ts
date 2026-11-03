// Admin-only mutations that have no shared hook elsewhere.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/ui';
import { systemService } from '@/services';

/** Mock data source only: restore the sample data, then refetch everything. Errors toast automatically. */
export function useResetSampleData() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => systemService.resetData(),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success(t('mockData.resetDone'));
    },
  });
}
