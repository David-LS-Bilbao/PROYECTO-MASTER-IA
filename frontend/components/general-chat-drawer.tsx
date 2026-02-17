/**
 * General Chat Drawer Component
 * Sprint 19.6 - Tarea 3: Chat General
 * Sprint 27.4 - Refactorización: Usa conocimiento general completo (NO RAG)
 *
 * Permite a los usuarios hacer preguntas generales sobre cualquier tema
 * usando el conocimiento completo de Gemini (sin restricciones de RAG).
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Loader2, Bot, User, X, Crown } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { chatGeneral, ChatMessage } from '@/lib/api';
import { useCanAccessChat } from '@/hooks/useCanAccessChat';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface GeneralChatDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Sprint 29 (Graceful Degradation): Pre-fill input with question from News Chat fallback
   */
  initialQuestion?: string;
}

export function GeneralChatDrawer({ isOpen, onOpenChange, initialQuestion }: GeneralChatDrawerProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Sprint 30: Check if user can access Chat (PREMIUM or trial)
  const chatAccess = useCanAccessChat();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const timer = setTimeout(() => {
      if (viewportRef.current) {
        viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [messages, isLoading]);

  // Reset state when drawer closes
  useEffect(() => {
    if (!isOpen) {
      // Small delay to avoid visual glitch
      const timer = setTimeout(() => {
        setMessages([]);
        setInputValue('');
        setError(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Sprint 29: Pre-fill input when opened with initialQuestion (fallback from News Chat)
  useEffect(() => {
    if (isOpen && initialQuestion) {
      setInputValue(initialQuestion);
    }
  }, [isOpen, initialQuestion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputValue.trim(),
    };

    // Add user message to chat
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setError(null);
    setIsLoading(true);

    try {
      // Sprint 30: Get auth token for Premium verification
      const token = await getToken();
      if (!token) {
        setError('Debes iniciar sesión para usar el Chat');
        setIsLoading(false);
        return;
      }

      const response = await chatGeneral(newMessages, token);

      // Add assistant response
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.data.response,
      };
      setMessages([...newMessages, assistantMessage]);
    } catch (err: any) {
      // =========================================================================
      // PREMIUM GATE (Sprint 30): Detect CHAT_FEATURE_LOCKED error
      // =========================================================================
      if (err.errorCode === 'CHAT_FEATURE_LOCKED') {
        setError('Tu periodo de prueba ha expirado. Actualiza a Premium para continuar usando el Chat.');
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Error al enviar mensaje';
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/boticon.png" alt="Bot" className="w-8 h-8 text-primary" />
              <SheetTitle>Chat General</SheetTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <SheetDescription className="text-xs">
            Pregunta sobre cualquier tema usando conocimiento general
          </SheetDescription>
        </SheetHeader>

        {/* Messages area */}
        <div className="flex-1 relative overflow-hidden">
          <div
            ref={viewportRef}
            className="absolute inset-0 overflow-y-auto px-1"
            style={{ scrollBehavior: 'smooth' }}
          >
            <div className="flex flex-col gap-4 py-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-8">
                  <img src="/boticon.png" alt="Bot" className="w-32 h-32 mx-auto mb-3 opacity-80" />
                  <p className="font-medium">Pregunta sobre cualquier tema</p>
                  <div className="text-xs mt-3 space-y-1">
                    <p className="font-semibold">Ejemplos:</p>
                    <p>&quot;¿Qué es la inteligencia artificial?&quot;</p>
                    <p>&quot;Explícame cómo funciona el cambio climático&quot;</p>
                    <p>&quot;Dame consejos sobre alimentación saludable&quot;</p>
                  </div>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'flex-row-reverse' : ''
                  }`}
                >
                  <div
                    className={`shrink-0 size-8 rounded-full flex items-center justify-center ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <User className="size-4" />
                    ) : (
                      <img src="/boticon.png" alt="Bot" className="size-4" />
                    )}
                  </div>
                  <div
                    className={`flex-1 rounded-lg px-4 py-3 text-sm ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="shrink-0 size-8 rounded-full bg-muted flex items-center justify-center">
                    <Bot className="size-4" />
                  </div>
                  <div className="flex-1 rounded-lg px-4 py-3 bg-muted">
                    <div className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      <span className="text-xs text-muted-foreground">
                        Pensando...
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg px-4 py-3 bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}

              {/* Auto-scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Input area */}
        {chatAccess.canAccess ? (
          <form onSubmit={handleSubmit} className="border-t pt-4 pb-6 px-2 flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Pregunta sobre cualquier tema..."
              disabled={isLoading}
              className="flex-1"
              autoFocus
            />
            <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim()}>
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </form>
        ) : (
          // Sprint 30: Locked state - show upgrade CTA
          <div className="border-t pt-4 pb-6 px-4">
            <div className="bg-linear-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="size-5 text-purple-600 dark:text-purple-400" />
                <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                  {chatAccess.reason === 'TRIAL_EXPIRED' ? 'Periodo de prueba finalizado' : 'Funcionalidad Premium'}
                </h3>
              </div>
              <p className="text-sm text-purple-700 dark:text-purple-300 mb-3">
                {chatAccess.reason === 'TRIAL_EXPIRED'
                  ? 'Tu periodo de prueba de 7 días ha expirado. Actualiza a Premium para seguir usando el Chat con IA.'
                  : 'El acceso al Chat con IA es exclusivo para usuarios Premium.'}
              </p>
              <Button
                onClick={() => router.push('/pricing')}
                className="w-full bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white gap-2"
              >
                <Crown className="size-4" />
                Actualizar a Premium
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
