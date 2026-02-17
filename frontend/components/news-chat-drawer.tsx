'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Loader2, Bot, User, Sparkles, Lock, Crown } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { chatWithArticle, ChatMessage } from '@/lib/api';
import { useCanAccessChat } from '@/hooks/useCanAccessChat';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface NewsChatDrawerProps {
  articleId: string;
  articleTitle: string;
  /**
   * Sprint 29 (Graceful Degradation): Callback to open General Chat with pre-filled question
   */
  onOpenGeneralChat?: (initialQuestion: string) => void;
}

/**
 * Extended ChatMessage type for fallback UI (Sprint 29)
 */
interface ExtendedChatMessage extends ChatMessage {
  isFallback?: boolean; // Flag for special fallback message
}

export function NewsChatDrawer({ articleId, articleTitle, onOpenGeneralChat }: NewsChatDrawerProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ExtendedChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUserQuestion, setLastUserQuestion] = useState<string>(''); // Track last question for fallback
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Sprint 30: Check if user can access Chat (PREMIUM or trial)
  const chatAccess = useCanAccessChat();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    // Usar un pequeño delay para asegurar que el DOM se ha actualizado
    const timer = setTimeout(() => {
      if (viewportRef.current) {
        viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ExtendedChatMessage = {
      role: 'user',
      content: inputValue.trim(),
    };

    // Add user message to chat
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setLastUserQuestion(inputValue.trim()); // Save for fallback
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

      const response = await chatWithArticle(articleId, newMessages, token);

      // =========================================================================
      // GRACEFUL DEGRADATION (Sprint 29): Detect low_context flag
      // =========================================================================
      if (response.meta?.low_context) {
        // Out-of-domain question → Show fallback message with CTA button
        const fallbackMessage: ExtendedChatMessage = {
          role: 'assistant',
          content: response.data.response,
          isFallback: true, // Special flag for custom rendering
        };
        setMessages([...newMessages, fallbackMessage]);
      } else {
        // Normal RAG response
        const assistantMessage: ExtendedChatMessage = {
          role: 'assistant',
          content: response.data.response,
        };
        setMessages([...newMessages, assistantMessage]);
      }
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

  /**
   * Handle fallback button click - Open General Chat with pre-filled question
   */
  const handleFallbackClick = () => {
    if (onOpenGeneralChat && lastUserQuestion) {
      setIsOpen(false); // Close news chat drawer
      setTimeout(() => {
        onOpenGeneralChat(lastUserQuestion); // Open general chat with question
      }, 300); // Small delay for smooth transition
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="default"
          size="lg"
          className="fixed bottom-6 right-6 z-50 shadow-lg gap-2"
        >
          <MessageCircle className="size-5" />
          Preguntar a la IA
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="flex items-center gap-2">
            <img src="/boticon.png" alt="Bot" className="w-8 h-8 text-primary" />
            Chat con la Noticia
          </SheetTitle>
          <SheetDescription className="line-clamp-2 text-xs">
            {articleTitle}
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
                <p>Haz una pregunta sobre esta noticia.</p>
                <p className="text-xs mt-2">
                  Ejemplos: &quot;Resume los puntos clave&quot;, &quot;Explica el sesgo detectado&quot;
                </p>
              </div>
            )}

            {messages.map((message, index) => (
              <div key={index}>
                {/* Normal message rendering */}
                {!message.isFallback && (
                  <div
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
                        <img src="/boticon.png" alt="Bot" className="w-6 h-6" />
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
                )}

                {/* Sprint 29: Special fallback message with CTA button */}
                {message.isFallback && (
                  <div className="flex gap-3">
                    <div className="shrink-0 size-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                      <Bot className="size-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 rounded-lg px-4 py-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                      <p className="text-sm text-amber-900 dark:text-amber-100 mb-3">
                        {message.content}
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                        Pero puedo ayudarte con el <strong>Chat General</strong>, donde tengo acceso a conocimiento completo sobre cualquier tema.
                      </p>
                      <Button
                        onClick={handleFallbackClick}
                        size="sm"
                        className="w-full bg-linear-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white gap-2"
                      >
                        <Sparkles className="size-4" />
                        Preguntar a la IA General
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="shrink-0 size-8 rounded-full bg-muted flex items-center justify-center">
                  <Bot className="size-4" />
                </div>
                <div className="flex-1 rounded-lg px-4 py-3 bg-muted">
                  <Loader2 className="size-4 animate-spin" />
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
              placeholder="Escribe tu pregunta..."
              disabled={isLoading}
              className="flex-1"
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
