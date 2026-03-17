import React from 'react';

interface AlertProps {
  title?: string;
  message: string;
  type?: 'error' | 'warning' | 'info' | 'success';
}

export function Alert({ title, message, type = 'error' }: AlertProps) {
  const bgColors = {
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-green-50 border-green-200 text-green-800',
  };
  
  return (
    <div className={`p-4 border rounded-md ${bgColors[type]}`}>
      {title && <h4 className="font-semibold mb-1">{title}</h4>}
      <p className="text-sm">{message}</p>
    </div>
  );
}
