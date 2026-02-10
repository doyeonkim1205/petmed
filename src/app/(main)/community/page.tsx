'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Heart, MessageCircle, Search } from 'lucide-react';
import { supabase, Post } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type CategoryFilter = 'all' | 'boast' | 'info' | 'adoption' | 'lost';

const tabs = [
  { id: 'all', label: '전체' },
  { id: 'boast', label: '자랑' },
  { id: 'info', label: '정보' },
  { id: 'adoption', label: '입양/임보' },
  { id: 'lost', label: '실종/발견' },
];

const getCategoryStyle = (category: string) => {
  switch (category) {
    case 'boast':
      return 'bg-pink-100 text-pink-600';
    case 'info':
      return 'bg-blue-100 text-blue-600';
    case 'lost':
      return 'bg-red-100 text-red-600';
    case 'adoption':
      return 'bg-green-100 text-green-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

const getCategoryLabel = (category: string) => {
  return tabs.find((t) => t.id === category)?.label || category;
};

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<CategoryFilter>('all');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetchPosts();
  }, [activeTab]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (id, nickname, avatar_url),
          comment_count:comments(count)
        `)
        .order('created_at', { ascending: false });

      if (activeTab !== 'all') {
        query = query.eq('category', activeTab);
      }

      const { data, error } = await query;

      if (error) throw error;

      const transformedData = data?.map((post) => ({
        ...post,
        comment_count: post.comment_count?.[0]?.count || 0,
      })) || [];

      setPosts(transformedData);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWriteClick = () => {
    if (!user) {
      router.push('/login');
      return;
    }
    router.push('/community/write');
  };

  const handlePostClick = (postId: string) => {
    router.push(`/community/${postId}`);
  };

  const filteredPosts = posts.filter((post) =>
    post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString('ko-KR');
  };

  return (
    <div className="bg-gray-50 min-h-full pb-20 relative">
      <div className="bg-white sticky top-14 z-30 shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <input
              type="text"
              placeholder="관심있는 내용을 검색해보세요"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-sm border-none focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          </div>
        </div>
        <div className="flex overflow-x-auto hide-scrollbar px-4 pb-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as CategoryFilter)}
              className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 p-4">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">
            로딩 중...
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">
            게시글이 없습니다.
          </div>
        ) : (
          filteredPosts.map((post) => (
            <div
              key={post.id}
              onClick={() => handlePostClick(post.id)}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mb-1 ${getCategoryStyle(
                      post.category
                    )}`}
                  >
                    {getCategoryLabel(post.category)}
                  </span>
                  <h3 className="font-bold text-gray-900 line-clamp-1">{post.title}</h3>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                  {formatDate(post.created_at)}
                </span>
              </div>

              <p className="text-sm text-gray-600 line-clamp-2 mb-3">{post.content}</p>

              {post.image_url && (
                <div className="w-full h-48 bg-gray-100 rounded-lg overflow-hidden mb-3">
                  <img
                    src={post.image_url}
                    alt="Post"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-gray-50 text-gray-400 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-600">
                    {post.profiles?.nickname || '익명'}
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="flex items-center gap-1">
                    <Heart size={16} /> {post.likes}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle size={16} /> {post.comment_count || 0}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <button
        onClick={handleWriteClick}
        className="fixed bottom-20 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all z-40"
      >
        <Plus size={28} />
      </button>
    </div>
  );
}
