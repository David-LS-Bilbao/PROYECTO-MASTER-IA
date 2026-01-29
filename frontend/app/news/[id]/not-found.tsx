import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
      <Card className="max-w-md mx-4">
        <CardContent className="pt-6 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold mb-2">Noticia no encontrada</h1>
          <p className="text-muted-foreground mb-6">
            El artículo que buscas no existe o ha sido eliminado.
          </p>
          <Button asChild>
            <Link href="/">Volver al Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
