import React from 'react';
import { Article } from '@/types';

export function ClassificationLabel({ article }: { article: Article }) {
  if (article.classificationStatus === 'FAILED') {
    return <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-full font-medium" title={article.classificationReason || 'Error al procesar'}>Fallido</span>;
  }
  
  if (article.classificationStatus !== 'COMPLETED') {
    return <span className="text-xs bg-gray-100 text-gray-600 border border-gray-200 px-2.5 py-0.5 rounded-full font-medium">Pendiente</span>;
  }

  if (article.isPolitical) {
    return <span className="text-xs bg-orange-100 text-orange-800 border border-orange-200 px-2.5 py-0.5 rounded-full font-medium cursor-help" title={article.classificationReason || 'Contenido Político'}>Político</span>;
  }

  return <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-0.5 rounded-full font-medium cursor-help" title={article.classificationReason || 'Sin contenido político'}>No Político</span>;
}
