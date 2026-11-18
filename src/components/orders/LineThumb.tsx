import * as React from 'react'
import { ImageOffIcon } from 'lucide-react'

import type { OrderLine } from '@/api/orders'

/**
 * The product picture on an order line: the catalog's image as it stands now (a picture, not part
 * of what was sold), small. A line whose product has none, or whose image will not load, draws a
 * quiet placeholder so the rows keep their rhythm.
 */
function LineThumb({ image, alt }: { image: OrderLine['primaryImage']; alt: string }) {
  const [errored, setErrored] = React.useState(false)
  const src = image?.thumbUrl ?? image?.url
  return (
    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
      {src && !errored ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="size-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <ImageOffIcon className="size-4 text-muted-foreground" aria-label="No image" />
      )}
    </div>
  )
}

export { LineThumb }
