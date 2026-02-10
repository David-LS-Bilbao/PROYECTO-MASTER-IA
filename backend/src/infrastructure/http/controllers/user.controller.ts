/**
 * User Controller
 * Handles user profile management endpoints
 */

import { Request, Response } from 'express';
import { getPrismaClient } from '../../persistence/prisma.client';
import { GeminiClient } from '../../external/gemini.client';
import type { Prisma } from '@prisma/client';

type UserWithCounts = Prisma.UserGetPayload<{
  include: {
    _count: {
      select: {
        favorites: true;
        searchHistory: true;
        chats: true;
      };
    };
  };
}>;

export class UserController {
  constructor(private geminiClient: GeminiClient) {}

  private formatUserProfile(user: UserWithCounts) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      plan: user.subscriptionPlan,
      location: user.location || null, // Sprint 20: Geolocalización
      preferences: user.preferences || {},
      usageStats: user.usageStats || {
        articlesAnalyzed: 0,
        searchesPerformed: 0,
        chatMessages: 0,
      },
      counts: {
        favorites: user._count.favorites,
        searchHistory: user._count.searchHistory,
        chats: user._count.chats,
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
  /**
   * GET /api/user/me
   * Get complete user profile including usage stats and favorites count
   */
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.uid;

      if (!userId) {
        res.status(401).json({ 
          success: false, 
          error: 'Usuario no autenticado' 
        });
        return;
      }

      const prisma = getPrismaClient();

      // Obtener usuario con conteo de favoritos
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          _count: {
            select: { 
              favorites: true,
              searchHistory: true,
              chats: true
            }
          }
        }
      });

      if (!user) {
        res.status(404).json({ 
          success: false, 
          error: 'Usuario no encontrado' 
        });
        return;
      }

      // Formatear respuesta
      res.json({
        success: true,
        data: this.formatUserProfile(user),
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener el perfil del usuario' 
      });
    }
  }

  /**
   * PATCH /api/user/me
   * Update user profile (name, location, and preferences)
   * Sprint 20: Added location support for geolocation features
   */
  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.uid;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado'
        });
        return;
      }

      const { name, location, preferences } = req.body;

      // Validar que al menos uno de los campos esté presente
      if (name === undefined && location === undefined && preferences === undefined) {
        res.status(400).json({
          success: false,
          error: 'Debes proporcionar al menos un campo para actualizar (name, location o preferences)'
        });
        return;
      }

      const prisma = getPrismaClient();

      // Preparar datos a actualizar
      const updateData: Prisma.UserUpdateInput = {};
      if (name !== undefined) {
        updateData.name = name;
      }
      if (location !== undefined) {
        updateData.location = location; // Sprint 20: Geolocalización
      }
      if (preferences !== undefined) {
        updateData.preferences = preferences;
      }

      // Actualizar usuario
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        include: {
          _count: {
            select: { 
              favorites: true,
              searchHistory: true,
              chats: true
            }
          }
        }
      });

      // Formatear respuesta
      res.json({
        success: true,
        data: this.formatUserProfile(updatedUser),
      });
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al actualizar el perfil del usuario' 
      });
    }
  }

  /**
   * GET /api/user/token-usage
   * Get Gemini API token usage statistics for the current session
   */
  async getTokenUsage(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.uid;

      if (!userId) {
        res.status(401).json({ 
          success: false, 
          error: 'Usuario no autenticado' 
        });
        return;
      }

      // Obtener estadísticas de la sesión actual
      const sessionReport = this.geminiClient.getSessionCostReport();

      res.json({
        success: true,
        data: {
          session: sessionReport,
          note: 'Estas estadísticas corresponden a la sesión actual del servidor. Para estadísticas históricas por usuario, consulta usageStats en el perfil.'
        }
      });
    } catch (error) {
      console.error('Error fetching token usage:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener estadísticas de tokens' 
      });
    }
  }
}
