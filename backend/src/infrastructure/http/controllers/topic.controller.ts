/**
 * Topic Controller
 * Handles topic/category endpoints for the frontend navigation
 *
 * Sprint 20: Topics/Categories Management
 */

import { Request, Response } from 'express';
import { ITopicRepository } from '../../../domain/repositories/topic.repository';

export class TopicController {
  constructor(private readonly repository: ITopicRepository) {}

  /**
   * GET /api/topics
   * Get all topics/categories for frontend navigation
   * No authentication required (public endpoint)
   */
  async getAllTopics(_req: Request, res: Response): Promise<void> {
    try {
      const topics = await this.repository.findAll();

      res.json({
        success: true,
        data: topics,
      });
    } catch (error) {
      console.error('Error fetching topics:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener los temas',
      });
    }
  }

  /**
   * GET /api/topics/:slug
   * Get a single topic by slug
   * No authentication required (public endpoint)
   */
  async getTopicBySlug(req: Request, res: Response): Promise<void> {
    try {
      const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;

      if (!slug) {
        res.status(400).json({
          success: false,
          error: 'Slug parameter is required',
        });
        return;
      }

      const topic = await this.repository.findBySlug(slug);

      if (!topic) {
        res.status(404).json({
          success: false,
          error: 'Topic not found',
        });
        return;
      }

      res.json({
        success: true,
        data: topic,
      });
    } catch (error) {
      console.error('Error fetching topic by slug:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener el tema',
      });
    }
  }
}
