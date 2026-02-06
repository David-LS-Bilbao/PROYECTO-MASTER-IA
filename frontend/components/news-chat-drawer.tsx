'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Loader2, Bot, User } from 'lucide-react';
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

interface NewsChatDrawerProps {
  articleId: string;
  articleTitle: string;
}

export function NewsChatDrawer({ articleId, articleTitle }: NewsChatDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

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
      const response = await chatWithArticle(articleId, newMessages);

      // Add assistant response
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.data.response,
      };
      setMessages([...newMessages, assistantMessage]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al enviar mensaje';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
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
            <Bot className="size-5 text-primary" />
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
                <Bot className="size-12 mx-auto mb-3 opacity-50" />
                <p>Haz una pregunta sobre esta noticia.</p>
                <p className="text-xs mt-2">
                  Ejemplos: &quot;Resume los puntos clave&quot;, &quot;Explica el sesgo detectado&quot;
                </p>
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
                    <Bot className="size-4" />
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
      </SheetContent>
    </Sheet>
  );
}
