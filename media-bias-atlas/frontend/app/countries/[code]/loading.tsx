import { Loader } from '@/components/ui/Loader';

export default function Loading() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <Loader message="Cargando medios registrados..." />
    </div>
  );
}
