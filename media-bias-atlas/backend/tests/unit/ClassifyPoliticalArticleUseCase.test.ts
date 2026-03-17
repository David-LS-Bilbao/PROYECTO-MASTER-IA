import { describe, it, expect, vi } from 'vitest';
import { ClassifyPoliticalArticleUseCase } from '../../src/application/use-cases/classification/ClassifyPoliticalArticleUseCase';
import { IArticleRepository } from '../../src/domain/repositories/IArticleRepository';
import { ClassificationStatus } from '../../src/domain/entities/Article';

describe('ClassifyPoliticalArticleUseCase - Unit Tests', () => {
  const mockRepo = {
    findById: vi.fn(),
    updateClassification: vi.fn(),
    saveManySkipDuplicates: vi.fn(),
    findByFeedId: vi.fn(),
  } as unknown as IArticleRepository;

  const useCase = new ClassifyPoliticalArticleUseCase(mockRepo);

  describe('analyzeText (Heuristics)', () => {
    it('1. Detecta texto claramente político', () => {
      const text = 'El presidente del gobierno anunció elecciones anticipadas en el congreso';
      const result = useCase.analyzeText(text);
      expect(result.isPolitical).toBe(true);
      expect(result.classificationStatus).toBe(ClassificationStatus.COMPLETED);
      expect(result.classificationReason).toContain('Político');
    });

    it('2. Detecta texto claramente no político', () => {
      const text = 'El partido de fútbol terminó con victoria en la liga de campeones';
      const result = useCase.analyzeText(text);
      expect(result.isPolitical).toBe(false);
      expect(result.classificationStatus).toBe(ClassificationStatus.COMPLETED);
      expect(result.classificationReason).toContain('No político');
    });

    it('3. Marca como ambiguo o irrelevante textos sin matches', () => {
      const text = 'Aprende a programar en TypeScript desde cero';
      const result = useCase.analyzeText(text);
      expect(result.isPolitical).toBe(false);
      expect(result.classificationStatus).toBe(ClassificationStatus.COMPLETED);
      expect(result.classificationReason).toContain('Ambiguo');
    });

    it('4. Clasifica como no político cuando dominan las keywords de descarte', () => {
      const text = 'El gobierno invierte en la liga de fútbol para el próximo torneo';
      const result = useCase.analyzeText(text);
      expect(result.isPolitical).toBe(false);
      expect(result.classificationStatus).toBe(ClassificationStatus.COMPLETED);
      expect(result.classificationReason).toContain('No político');
    });
  });

  describe('execute (Integration mock)', () => {
    it('1. Falla suavemente ante texto vacío o nulo', async () => {
      vi.mocked(mockRepo.findById).mockResolvedValueOnce({
        id: '123', title: '   ', url: 'http://t.co', 
        feedId: 'x', publishedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
        isPolitical: null, classificationStatus: ClassificationStatus.PENDING, classificationReason: null, classifiedAt: null
      });

      vi.mocked(mockRepo.updateClassification).mockImplementationOnce(async (_, data) => {
        return { id: '123', ...data } as any;
      });

      const updated = await useCase.execute('123');
      expect(updated.classificationStatus).toBe(ClassificationStatus.FAILED);
      expect(updated.classificationReason).toBe('Texto vacío o nulo');
      expect(mockRepo.updateClassification).toHaveBeenCalled();
    });
  });
});
