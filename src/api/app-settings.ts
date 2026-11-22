import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { AppSettings, UpdateAppSettingsRequest } from '@/lib/app-settings'

const KEY = ['app-settings']

export function useAppSettingsQuery(enabled = true) {
  return useQuery({
    enabled,
    queryKey: KEY,
    // a stale copy would carry a stale version into the next save
    staleTime: 0,
    queryFn: () => unwrap<AppSettings>(api.GET('/api/admin/app-settings')),
  })
}

/** PUT replaces the whole record; the caller always sends every field (see `toRequest`). */
export function useUpdateAppSettingsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateAppSettingsRequest) =>
      unwrap<AppSettings>(api.PUT('/api/admin/app-settings', { body })),
    onSuccess: (saved) => {
      queryClient.setQueryData(KEY, saved)
      return queryClient.invalidateQueries({ queryKey: ['audit-entries'] })
    },
  })
}
