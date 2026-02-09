/**
 * Prisma Topic Repository Implementation (Infrastructure Layer)
 * Sprint 20: Topics/Categories Management
 */

import { PrismaClient } from '@prisma/client';
import { ITopicRepository, Topic } from '../../domain/repositories/topic.repository';
import { DatabaseError } from '../../domain/errors/infrastructure.error';

export class PrismaTopicRepository implements ITopicRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<Topic[]> {
    try {
      const topics = await this.prisma.topic.findMany({
        orderBy: [
          { order: 'asc' }, // Primary sort: by order field
          { name: 'asc' },  // Secondary sort: alphabetically
        ],
      });

      return topics.map(topic => ({
        id: topic.id,
        name: topic.name,
        slug: topic.slug,
        description: topic.description,
        order: topic.order,
        createdAt: topic.createdAt,
      }));
    } catch (error) {
      throw new DatabaseError(
        `Failed to find topics: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async findBySlug(slug: string): Promise<Topic | null> {
    try {
      const topic = await this.prisma.topic.findUnique({
        where: { slug },
      });

      if (!topic) return null;

      return {
        id: topic.id,
        name: topic.name,
        slug: topic.slug,
        description: topic.description,
        order: topic.order,
        createdAt: topic.createdAt,
      };
    } catch (error) {
      throw new DatabaseError(
        `Failed to find topic by slug: ${(error as Error).message}`,
        error as Error
      );
    }
  }
}
