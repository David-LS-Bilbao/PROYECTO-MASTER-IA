/**
 * Accessible Toggle Component
 * Sprint 19.8 (Accessibility) - Componente de ejemplo WCAG-compliant
 *
 * Características WCAG 2.1 AA:
 * - ✅ 2.1.1 Keyboard: Accesible por teclado (button nativo)
 * - ✅ 2.4.7 Focus Visible: Outline visible con ring-offset
 * - ✅ 4.1.2 Name, Role, Value: aria-pressed, aria-label
 * - ✅ 1.4.3 Contrast: Contraste mínimo 4.5:1
 *
 * UNE-EN 301549: Requisito 9.2.1.1 (Funcionalidad de teclado)
 */

'use client';

import React from 'react';

export interface AccessibleToggleProps {
  /**
   * Estado actual del toggle (on/off)
   */
  pressed: boolean;

  /**
   * Callback cuando cambia el estado
   */
  onPressedChange: (pressed: boolean) => void;

  /**
   * Label accesible (requerido para screen readers)
   */
  ariaLabel: string;

  /**
   * Label visual opcional (texto junto al toggle)
   */
  label?: string;

  /**
   * Descripción adicional opcional
   */
  description?: string;

  /**
   * Icono opcional (debe tener aria-hidden="true")
   */
  icon?: React.ReactNode;

  /**
   * Tamaño del toggle
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Deshabilitar el toggle
   */
  disabled?: boolean;
}

/**
 * Toggle accesible con ARIA completo
 *
 * @example
 * <AccessibleToggle
 *   pressed={reduceMotion}
 *   onPressedChange={setReduceMotion}
 *   ariaLabel="Reducir animaciones"
 *   label="Reducir Animaciones"
 *   description="Desactiva transiciones y animaciones superfluas"
 * />
 */
export function AccessibleToggle({
  pressed,
  onPressedChange,
  ariaLabel,
  label,
  description,
  icon,
  size = 'md',
  disabled = false,
}: AccessibleToggleProps) {
  // Size mappings
  const sizes = {
    sm: { container: 'h-5 w-9', thumb: 'h-3 w-3', translateOn: 'translate-x-5', translateOff: 'translate-x-1' },
    md: { container: 'h-6 w-11', thumb: 'h-4 w-4', translateOn: 'translate-x-6', translateOff: 'translate-x-1' },
    lg: { container: 'h-7 w-14', thumb: 'h-5 w-5', translateOn: 'translate-x-7', translateOff: 'translate-x-1' },
  };

  const sizeClasses = sizes[size];

  return (
    <div className="flex items-center justify-between gap-4">
      {/* Label and description */}
      {(label || description) && (
        <div className="flex-1 min-w-0">
          {label && (
            <label
              htmlFor={`toggle-${ariaLabel}`}
              className="text-sm font-medium text-zinc-900 dark:text-white block cursor-pointer"
            >
              {icon && (
                <span className="inline-flex items-center gap-2">
                  {icon}
                  {label}
                </span>
              )}
              {!icon && label}
            </label>
          )}
          {description && (
            <p className="text-xs text-muted-foreground mt-1">
              {description}
            </p>
          )}
        </div>
      )}

      {/* Toggle Button */}
      <button
        id={`toggle-${ariaLabel}`}
        type="button"
        role="switch"
        aria-pressed={pressed}
        aria-label={ariaLabel}
        aria-checked={pressed}
        disabled={disabled}
        onClick={() => onPressedChange(!pressed)}
        className={`
          relative inline-flex items-center rounded-full transition-colors
          ${sizeClasses.container}
          ${
            pressed
              ? 'bg-blue-600 dark:bg-blue-500'
              : 'bg-zinc-300 dark:bg-zinc-700'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
          dark:focus-visible:ring-offset-zinc-900
        `}
      >
        {/* Thumb (bolita interna) */}
        <span
          className={`
            inline-block transform rounded-full bg-white transition-transform
            ${sizeClasses.thumb}
            ${pressed ? sizeClasses.translateOn : sizeClasses.translateOff}
          `}
        />
      </button>
    </div>
  );
}
