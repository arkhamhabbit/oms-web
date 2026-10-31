import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema.gen'
import { ApiClientError } from '@/lib/api-error'

export type Media = components['schemas']['MediaResponse']
export type MediaRef = components['schemas']['MediaRefResponse']
export type MediaKind = NonNullable<Media['kind']>
export type MediaStatus = NonNullable<Media['status']>
export type MediaReference = components['schemas']['MediaReferenceResponse']
type IssuedUpload = components['schemas']['IssuedUploadResponse']

export interface MediaListParams {
  page: number
  size: number
  kind?: MediaKind
  status?: MediaStatus
  /** Part of the filename, or of the alt text on an image that uses the item. */
  q?: string
}

const MEDIA_KEY = 'media'

export const mediaQueryKey = (params: MediaListParams) => [MEDIA_KEY, 'list', params] as const

export function useMediaQuery(params: MediaListParams) {
  return useQuery({
    queryKey: mediaQueryKey(params),
    queryFn: () =>
      unwrap(
        api.GET('/api/admin/media', {
          params: {
            query: {
              pageable: { page: params.page, size: params.size },
              kind: params.kind,
              status: params.status,
              q: params.q || undefined,
            },
          },
        })
      ),
    placeholderData: (previous) => previous,
  })
}

export function useMediaReferencesQuery(id: string | undefined) {
  return useQuery({
    queryKey: [MEDIA_KEY, 'references', id],
    queryFn: () =>
      unwrap<MediaReference[]>(
        api.GET('/api/admin/media/{id}/references', { params: { path: { id: id! } } })
      ),
    enabled: !!id,
  })
}

export function useDeleteMediaMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      unwrap<void>(api.DELETE('/api/admin/media/{id}', { params: { path: { id } } })),
    // Refresh the lists, but never the queries about the id that was just removed: refetching
    // its references or detail only earns a 404 while the dialog that asked is still closing.
    onSuccess: (_data, id) =>
      queryClient.invalidateQueries({
        queryKey: [MEDIA_KEY],
        predicate: (query) => !query.queryKey.includes(id),
      }),
  })
}

/** The kind OMS files a browser `File` under, or undefined for anything that is neither. */
export function mediaKindOf(contentType: string): MediaKind | undefined {
  if (contentType.startsWith('image/')) {
    return 'IMAGE'
  }
  if (contentType.startsWith('video/')) {
    return 'VIDEO'
  }
  return undefined
}

/**
 * PUTs the file's bytes straight to the signed URL (D4.19 — files never pass through OMS).
 *
 * This is not an OMS call, so it cannot go through the generated client: it must carry no
 * session cookie and no `X-OMS-Csrf` header (the signature covers exactly the headers OMS
 * issued — anything extra can fail it), and it is a cross-origin request to the bucket, which
 * therefore needs a CORS rule allowing PUT with `Content-Type` from this app's origin. XHR
 * rather than fetch because only XHR reports upload progress.
 */
export function putToSignedUrl(
  upload: { url: string; method?: string; headers?: Record<string, string> },
  file: Blob,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(upload.method ?? 'PUT', upload.url)
    for (const [name, value] of Object.entries(upload.headers ?? {})) {
      xhr.setRequestHeader(name, value)
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(event.loaded / event.total)
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1)
        resolve()
      } else {
        reject(
          uploadError(
            `The storage service refused the upload (HTTP ${xhr.status}). ` +
              'The upload link may have expired — try again.'
          )
        )
      }
    }
    // A status of 0 with no response is how a browser reports a blocked cross-origin request.
    xhr.onerror = () =>
      reject(
        new ApiClientError(
          {
            code: 'UPLOAD_BLOCKED',
            message:
              'The browser could not send the file to the storage bucket. If this happens on every ' +
              "upload, the bucket's CORS rule does not allow this origin to PUT with Content-Type.",
            traceId: 'client',
            fieldErrors: [],
          },
          0
        )
      )
    xhr.onabort = () => reject(uploadError('Upload cancelled.'))
    signal?.addEventListener('abort', () => xhr.abort())
    xhr.send(file)
  })
}

function uploadError(message: string): ApiClientError {
  return new ApiClientError(
    { code: 'UPLOAD_FAILED', message, traceId: 'client', fieldErrors: [] },
    0
  )
}

export interface UploadProgress {
  stage: 'issuing' | 'uploading' | 'confirming'
  fraction: number
}

/**
 * The whole flow for one file: issue → PUT → confirm. Resolves with the confirmed item. A
 * server refusal (size, type, unreadable file) arrives as an `ApiClientError` carrying the
 * server's own sentence; a confirm that comes back `FAILED` is thrown with its `failureReason`.
 * A confirm that is still `PENDING` is returned as it is — the caller shows it as processing.
 */
export async function uploadMedia(
  file: File,
  onProgress?: (progress: UploadProgress) => void,
  signal?: AbortSignal
): Promise<Media> {
  const contentType = file.type
  const kind = mediaKindOf(contentType)
  if (!kind) {
    throw uploadError(
      `"${file.name}" is not an image or a video${contentType ? ` (${contentType})` : ''}.`
    )
  }

  onProgress?.({ stage: 'issuing', fraction: 0 })
  const issued = await unwrap<IssuedUpload>(
    api.POST('/api/admin/media/uploads', {
      body: { kind, contentType, bytes: file.size, filename: file.name },
    })
  )
  const upload = issued.upload
  const mediaId = issued.media?.id
  if (!upload?.url || !mediaId) {
    throw uploadError('OMS did not return an upload URL.')
  }

  await putToSignedUrl(
    { url: upload.url, method: upload.method, headers: upload.headers },
    file,
    (fraction) => onProgress?.({ stage: 'uploading', fraction }),
    signal
  )

  onProgress?.({ stage: 'confirming', fraction: 1 })
  const confirmed = await unwrap<Media>(
    api.POST('/api/admin/media/{id}/confirm', { params: { path: { id: mediaId } } })
  )
  if (confirmed.status === 'FAILED') {
    throw uploadError(confirmed.failureReason ?? 'The file could not be processed.')
  }
  return confirmed
}

/** Re-reads one item — used to wait out a PENDING confirm. */
export function useMediaItemQuery(id: string | undefined, poll: boolean) {
  return useQuery({
    queryKey: [MEDIA_KEY, 'item', id],
    queryFn: () =>
      unwrap<Media>(api.GET('/api/admin/media/{id}', { params: { path: { id: id! } } })),
    enabled: !!id,
    refetchInterval: poll ? 2000 : false,
  })
}

export function useInvalidateMedia() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: [MEDIA_KEY] })
}
