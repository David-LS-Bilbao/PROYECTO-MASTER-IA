export class OutletNotFoundError extends Error {
  constructor(outletId: string) {
    super(`Medio con ID ${outletId} no encontrado.`);
    this.name = 'OutletNotFoundError';
  }
}
