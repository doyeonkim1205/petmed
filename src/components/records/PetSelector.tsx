'use client';

import { useState, useEffect } from 'react';
import { supabase, Pet } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Dog, Cat } from 'lucide-react';

interface PetSelectorProps {
  selectedPetId: string | null;
  onSelect: (petId: string | null) => void;
}

export function PetSelector({ selectedPetId, onSelect }: PetSelectorProps) {
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
        const petList = data || [];
        setPets(petList);
        if (selectedPetId && petList.length > 0 && !petList.find(p => p.id === selectedPetId)) {
          onSelect(null);
        }
      } catch (err) {
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

  return (
    <div className="flex gap-2 overflow-x-auto hide-scrollbar px-4 py-3">
      <button
        onClick={() => onSelect(null)}
        className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
          selectedPetId === null
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        전체
      </button>
      {pets.map((pet) => {
        const Icon = pet.type === 'cat' ? Cat : Dog;
        return (
          <button
            key={pet.id}
            onClick={() => onSelect(pet.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedPetId === pet.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Icon size={16} />
            {pet.name}
          </button>
        );
      })}
    </div>
  );
}
