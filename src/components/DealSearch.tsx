import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Building2, User, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { PipedriveDeal } from '@/types/call';

interface DealSearchProps {
  onSelect: (deal: PipedriveDeal) => void;
  selectedDeal: PipedriveDeal | null;
  className?: string;
}

export const DealSearch = ({ onSelect, selectedDeal, className }: DealSearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PipedriveDeal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const searchDeals = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pipedrive-search`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ query: searchQuery }),
        }
      );

      if (!response.ok) {
        throw new Error('Erreur lors de la recherche');
      }

      const data = await response.json();
      setResults(data.deals || []);
      setIsOpen(true);
    } catch (err) {
      console.error('Search error:', err);
      setError('Erreur de connexion à Pipedrive');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      searchDeals(value);
    }, 300);
  };

  const handleSelect = (deal: PipedriveDeal) => {
    onSelect(deal);
    setQuery(deal.title);
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    onSelect(null as any);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={handleInputChange}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Rechercher une affaire Pipedrive..."
          className="pl-10 pr-10"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {selectedDeal && !isLoading && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      )}

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-2 w-full rounded-lg border bg-popover p-1 shadow-strong animate-slide-up">
          {results.map((deal) => (
            <button
              key={deal.id}
              onClick={() => handleSelect(deal)}
              className={cn(
                'w-full flex flex-col items-start gap-1 rounded-md px-3 py-2.5 text-left transition-colors',
                'hover:bg-accent focus:bg-accent focus:outline-none',
                selectedDeal?.id === deal.id && 'bg-accent'
              )}
            >
              <span className="font-medium text-foreground">{deal.title}</span>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {deal.organization && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {deal.organization}
                  </span>
                )}
                {deal.person && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {deal.person}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && query.length >= 2 && results.length === 0 && !isLoading && !error && (
        <div className="absolute z-50 mt-2 w-full rounded-lg border bg-popover p-4 shadow-strong text-center text-muted-foreground">
          Aucune affaire trouvée
        </div>
      )}
    </div>
  );
};
