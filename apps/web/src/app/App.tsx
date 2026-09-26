/** Placeholder until the app shell and router land (FE-02). */
export function App() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-content flex-col justify-center gap-3 px-4">
      <p className="text-h3 font-bold">codeyoung</p>
      <h1 className="text-h1">Book a free coding class for your child</h1>
      {import.meta.env.DEV && (
        <a href="/dev/gallery" className="text-small text-accent underline underline-offset-[3px]">
          Component gallery
        </a>
      )}
    </main>
  );
}
