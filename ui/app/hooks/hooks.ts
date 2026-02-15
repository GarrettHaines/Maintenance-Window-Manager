import { useState, useEffect } from 'react';
import type { EntityReference } from '../types/types';
import { searchEntities } from '../api/api';

export function useAnimatedRemove(duration = 200) {
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());

  const triggerRemove = (id: string, onComplete: () => void) => {
    setExitingIds(prev => new Set(prev).add(id));
    setTimeout(() => {
      setExitingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      onComplete();
    }, duration);
  };

  return { exitingIds, triggerRemove };
}

export function useEntitySearch(entityType: string, searchTerm: string) {
  const [results, setResults] = useState<EntityReference[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!entityType || !searchTerm || searchTerm.length < 1) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        setResults(await searchEntities(entityType, searchTerm));
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [entityType, searchTerm]);

  return { results, isSearching, setResults };
}