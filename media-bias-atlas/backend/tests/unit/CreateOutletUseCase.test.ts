import { describe, it, expect, vi } from 'vitest';
import { CreateOutletUseCase } from '../../src/application/useCases/CreateOutletUseCase';
import { IOutletRepository } from '../../src/domain/repositories/IOutletRepository';
import { ICountryRepository } from '../../src/domain/repositories/ICountryRepository';

describe('CreateOutletUseCase Unit Tests', () => {
  it('should throw an error if the payload is invalid based on Zod schema', async () => {
    // Arrange: countryCode in valid payload is intentionally misspelled
    const mockOutletRepo = { save: vi.fn(), findById: vi.fn(), findByCountryId: vi.fn() };
    const mockCountryRepo = { findAll: vi.fn(), findByCode: vi.fn() };
    const useCase = new CreateOutletUseCase(mockOutletRepo, mockCountryRepo);

    const invalidPayload = {
      countryCode: 'E', // To short! Must be 2 chars
      name: 'E', // Too short!
    };

    // Act & Assert
    await expect(useCase.execute(invalidPayload as any)).rejects.toThrow(); // Because of Zod
  });

  it('should throw an error if country does not exist in the database', async () => {
    // Arrange
    const mockOutletRepo = { save: vi.fn(), findById: vi.fn(), findByCountryId: vi.fn() };
    const mockCountryRepo = { 
      findAll: vi.fn(), 
      findByCode: vi.fn().mockResolvedValue(null) // Not found
    };
    
    const useCase = new CreateOutletUseCase(mockOutletRepo, mockCountryRepo);
    const validPayload = {
      countryCode: 'XX',
      name: 'Fake Outlet',
    };

    // Act & Assert
    await expect(useCase.execute(validPayload)).rejects.toThrow('Country with code XX not found');
  });

  it('should create an outlet successfully if everything is valid', async () => {
     // Arrange
     const validCountry = { id: 'country-id-123', code: 'ES', name: 'Spain', createdAt: new Date(), updatedAt: new Date() };
     const validOutletReturned = { id: 'outlet-new-123', countryId: 'country-id-123', name: 'Fake Outlet', description: null, websiteUrl: null, createdAt: new Date(), updatedAt: new Date() };

     const mockOutletRepo = { 
       save: vi.fn().mockResolvedValue(validOutletReturned), 
       findById: vi.fn(), 
       findByCountryId: vi.fn() 
     };
     const mockCountryRepo = { 
       findAll: vi.fn(), 
       findByCode: vi.fn().mockResolvedValue(validCountry) 
     };
     
     const useCase = new CreateOutletUseCase(mockOutletRepo, mockCountryRepo);
     const validPayload = {
       countryCode: 'ES',
       name: 'Fake Outlet',
     };
 
     // Act
     const result = await useCase.execute(validPayload);

     // Assert
     expect(mockCountryRepo.findByCode).toHaveBeenCalledWith('ES');
     expect(mockOutletRepo.save).toHaveBeenCalledWith({
        countryId: validCountry.id,
        name: 'Fake Outlet',
        description: null,
        websiteUrl: null
     });
     expect(result.id).toEqual('outlet-new-123');
  });
});
