interface Props {
  message?: string;
}

export default function FullPageLoader({ message = 'Cargando…' }: Props) {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-vizme-bg overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-mesh-vizme opacity-50" />
      <div className="relative flex flex-col items-center gap-5">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-2 border-vizme-coral/20" />
          <div className="absolute inset-0 rounded-full border-2 border-vizme-coral border-t-transparent animate-spin" />
        </div>
        <p className="font-display text-lg text-vizme-navy/80">{message}</p>
      </div>
    </div>
  );
}
