'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type Category = 'boast' | 'info' | 'lost' | 'found';

const categories: { id: Category; label: string; color: string }[] = [
  { id: 'boast', label: '자랑', color: 'bg-pink-100 text-pink-600 border-pink-200' },
  { id: 'info', label: '정보', color: 'bg-blue-100 text-blue-600 border-blue-200' },
  { id: 'lost', label: '실종', color: 'bg-red-100 text-red-600 border-red-200' },
  { id: 'found', label: '발견', color: 'bg-green-100 text-green-600 border-green-200' },
];

export default function CommunityEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [category, setCategory] = useState<Category>('boast');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) fetchPost();
  }, [id]);

  const fetchPost = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data.user_id !== user?.id) {
        router.push('/community');
        return;
      }

      setCategory(data.category);
      setTitle(data.title);
      setContent(data.content);
      setImageUrl(data.image_url || '');
    } catch (error) {
      console.error('Error fetching post:', error);
      router.push('/community');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) { router.push('/login'); return; }
    if (!title.trim()) { setError('제목을 입력해주세요.'); return; }
    if (!content.trim()) { setError('내용을 입력해주세요.'); return; }

    setSaving(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('posts')
        .update({
          category,
          title: title.trim(),
          content: content.trim(),
          image_url: imageUrl.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      router.push(`/community/${id}`);
    } catch (err) {
      console.error('Error updating post:', err);
      setError('게시글 수정에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-gray-500">로딩 중...</p></div>;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white z-10">
        <button onClick={() => router.back()} className="p-2 -ml-2"><ArrowLeft className="w-6 h-6" /></button>
        <h1 className="text-lg font-semibold">글 수정</h1>
        <button
          onClick={handleSubmit}
          disabled={saving || !title.trim() || !content.trim()}
          className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 p-4 space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">카테고리</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                  category === cat.id ? cat.color + ' border-current' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="title" className="text-sm font-medium">제목</label>
          <input
            id="title"
            placeholder="제목을 입력하세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent outline-none"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="content" className="text-sm font-medium">내용</label>
          <textarea
            id="content"
            placeholder="내용을 입력하세요"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent outline-none min-h-[200px] resize-none"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="imageUrl" className="text-sm font-medium">이미지 URL (선택)</label>
          <div className="flex gap-2">
            <input
              id="imageUrl"
              placeholder="https://example.com/image.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent outline-none"
            />
            {imageUrl && (
              <button type="button" onClick={() => setImageUrl('')} className="p-3 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            )}
          </div>
          {imageUrl && (
            <div className="mt-2 rounded-lg overflow-hidden border border-gray-200">
              <img src={imageUrl} alt="미리보기" className="w-full h-48 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
