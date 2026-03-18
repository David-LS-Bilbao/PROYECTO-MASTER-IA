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

    it('5. Evita falso positivo por siglas embebidas en palabras como Apple o WhatsApp', () => {
      const entertainmentText = "Crítica de 'Mujeres imperfectas': si quieres ver 'Big Little Lies' y tienes Apple en vez de HBO";
      const techText = 'WhatsApp trabaja en una nueva función para cerrar sesión sin borrar tus datos: así funciona';

      const entertainmentResult = useCase.analyzeText(entertainmentText);
      const techResult = useCase.analyzeText(techText);

      expect(entertainmentResult.isPolitical).toBe(false);
      expect(entertainmentResult.classificationReason).toContain('No político');
      expect(techResult.isPolitical).toBe(false);
      expect(techResult.classificationReason).toContain('No político');
    });

    it('6. No marca como político una noticia local o de infraestructuras solo por palabras ambiguas', () => {
      const text =
        'Tres Cantos reformará la Avenida de España para crear un bulevar, tendrán el tercer carril a la M-607 y un nuevo colegio';
      const result = useCase.analyzeText(text);

      expect(result.isPolitical).toBe(false);
      expect(result.classificationStatus).toBe(ClassificationStatus.COMPLETED);
      expect(result.classificationReason).toContain('Ambiguo');
    });

    it('7. Mantiene como político un titular con señal institucional fuerte', () => {
      const text =
        'Delcy Rodríguez destituye a Padrino López tras más de una década como ministro de Defensa de Venezuela';
      const result = useCase.analyzeText(text);

      expect(result.isPolitical).toBe(true);
      expect(result.classificationStatus).toBe(ClassificationStatus.COMPLETED);
      expect(result.classificationReason).toContain('Político');
    });

    it('8. Mantiene como político un titular sobre líderes, cargos o procesos electorales', () => {
      const trumpText =
        'Trump nombra al vicepresidente Pence a cargo de la crisis del coronavirus';
      const ciudadanosText =
        'Ciudadanos pagaba un sueldo a un vocal de la Junta Electoral Central que resolvió recursos del partido';

      const trumpResult = useCase.analyzeText(trumpText);
      const ciudadanosResult = useCase.analyzeText(ciudadanosText);

      expect(trumpResult.isPolitical).toBe(true);
      expect(trumpResult.classificationReason).toContain('Político');
      expect(ciudadanosResult.isPolitical).toBe(true);
      expect(ciudadanosResult.classificationReason).toContain('Político');
    });

    it('9. Mantiene como político un titular geopolítico con ministros o dirigentes', () => {
      const text =
        '50 antiguos ministros y dirigentes europeos se pronuncian contra el plan de Trump para Palestina';
      const result = useCase.analyzeText(text);

      expect(result.isPolitical).toBe(true);
      expect(result.classificationStatus).toBe(ClassificationStatus.COMPLETED);
      expect(result.classificationReason).toContain('Político');
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
