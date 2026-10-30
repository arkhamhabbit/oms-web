import { Link } from 'react-router-dom'

/**
 * Who placed an order: the name and mobile OMS reads at request time, linking to the user page.
 * Both are null once the account is gone; the id is then all that is left, so it is shown as such
 * rather than as a person.
 */
function ConsumerLink({
  consumerId,
  name,
  mobile,
  stopPropagation,
}: {
  consumerId: string | undefined
  name?: string | null
  mobile?: string | null
  /** Inside a clickable table row: following the link must not also open the row. */
  stopPropagation?: boolean
}) {
  if (!consumerId) {
    return null
  }
  const known = !!(name || mobile)
  return (
    <Link
      to={`/users/${consumerId}`}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
      className="inline-flex flex-col leading-tight underline-offset-2 hover:underline"
    >
      {known ? (
        <>
          {name && <span className="font-medium">{name}</span>}
          {mobile && <span className="font-mono text-xs text-muted-foreground">{mobile}</span>}
        </>
      ) : (
        <span className="text-xs text-muted-foreground" title={consumerId}>
          Account removed ({consumerId.slice(0, 8)}…)
        </span>
      )}
    </Link>
  )
}

export { ConsumerLink }
