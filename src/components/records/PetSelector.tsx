'use client';

import { useState, useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { supabase, Pet } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { sortPetsWithDefault, readDefaultPetId } from '@/lib/petSort';


interface PetSelectorProps {
  selectedPetId: string | null;
  onSelect: (petId: string | null) => void;
  onPetsLoaded?: (count: number) => void;
}

export function PetSelector({ selectedPetId, onSelect, onPetsLoaded }: PetSelectorProps) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      setLoaded(true);
      return;
    }
    const fetchPets = async () => {
      try {
        const { data, error } = await supabase
          .from('pets')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });
        if (error) console.error('PetSelector fetch error:', error);
        const petList = sortPetsWithDefault(data || [], readDefaultPetId());
        setPets(petList);
        onPetsLoaded?.(petList.length);
        if (selectedPetId && petList.length > 0 && !petList.find(p => p.id === selectedPetId)) {
          onSelect(null);
        }
      } catch (err) {
        Sentry.captureException(err, {
          tags: { feature: 'pets', action: 'selector-fetch' },
        });
        console.error('PetSelector query failed:', err);
        setPets([]);
      } finally {
        setLoaded(true);
      }
    };
    fetchPets();
  }, [userId]);

  // Don't render until loaded; if loaded and no pets, hide
  if (!loaded || pets.length === 0) return null;

  // 펫 ≤ 4마리: 가운데 정렬 (미관). 5마리+ : 왼쪽 정렬 (justify-center 면 양쪽 잘림).
  const alignClass = pets.length <= 4 ? 'justify-center' : '';
  return (
    <div className={`flex gap-2 overflow-x-auto px-4 py-3 ${alignClass}`}>
      <button
        onClick={() => onSelect(null)}
        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
          selectedPetId === null
            ? 'bg-gray-800 text-white'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
        }`}
      >
        전체
      </button>
      {pets.map((pet) => (
          <button
            key={pet.id}
            onClick={() => onSelect(pet.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedPetId === pet.id
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {pet.name}
          </button>
      ))}
    </div>
  );
}
