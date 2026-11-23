/** Full-page message when the console's runtime settings are missing or unusable (W4.0). */
export default function ConfigErrorPage({ message }: { message: string }) {
  return (
    <main
      role="alert"
      className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-3 p-8"
    >
      <h1 className="text-xl font-semibold">The console is not configured</h1>
      <p className="text-sm leading-relaxed">{message}</p>
    </main>
  )
}
