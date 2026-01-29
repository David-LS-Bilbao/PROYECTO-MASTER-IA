'use server';

import { revalidatePath } from 'next/cache';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface AnalyzeResult {
  success: boolean;
  message: string;
  data?: {
    articleId: string;
    summary: string;
    biasScore: number;
  };
  error?: string;
}

/**
 * Server Action to analyze an article with AI
 */
export async function analyzeArticleAction(articleId: string): Promise<AnalyzeResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/analyze/article`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ articleId }),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        message: data.message || 'Error al analizar el artículo',
        error: data.error,
      };
    }

    // Revalidate the home page to show updated data
    revalidatePath('/');

    return {
      success: true,
      message: data.message || 'Artículo analizado correctamente',
      data: {
        articleId: data.data.articleId,
        summary: data.data.summary,
        biasScore: data.data.biasScore,
      },
    };
  } catch (error) {
    console.error('Error analyzing article:', error);
    return {
      success: false,
      message: 'Error de conexión con el servidor',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
