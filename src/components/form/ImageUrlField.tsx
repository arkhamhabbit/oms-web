import * as React from 'react'
import { ImageOff } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface ImageUrlFieldProps extends React.ComponentProps<'input'> {
  className?: string
}

/** A URL text field with a live thumbnail preview. Renders no request itself — the <img> load is browser-native, not app code making an API call. */
function ImageUrlField({ className, value, ...props }: ImageUrlFieldProps) {
  const [errored, setErrored] = React.useState(false)
  const url = typeof value === 'string' ? value : ''

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
        {url && !errored ? (
          <img
            src={url}
            alt=""
            className="size-full object-cover"
            onError={() => setErrored(true)}
            onLoad={() => setErrored(false)}
          />
        ) : (
          <ImageOff className="size-4 text-muted-foreground" />
        )}
      </div>
      <Input
        type="url"
        placeholder="https://…"
        value={value}
        onChange={(event) => {
          setErrored(false)
          props.onChange?.(event)
        }}
        {...props}
      />
    </div>
  )
}

export { ImageUrlField }
