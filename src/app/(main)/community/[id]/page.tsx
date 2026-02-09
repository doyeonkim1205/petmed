'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Heart, MoreVertical, Send, Trash2, Edit2 } from 'lucide-react';
import { supabase, Post, Comment } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const getCategoryStyle = (category: string) => {
  switch (category) {
    case 'boast': return 'bg-pink-100 text-pink-600';
    case 'info': return 'bg-blue-100 text-blue-600';
    case 'lost': return 'bg-red-100 text-red-600';
    case 'found': return 'bg-green-100 text-green-600';
    default: return 'bg-gray-100 text-gray-600';
  }
};

const getCategoryLabel = (category: string) => {
  const labels: Record<string, string> = { boast: '자랑', info: '정보', lost: '실종', found: '발견' };
  return labels[category] || category;
};

export default function CommunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPost();
      fetchComments();
    }
  }, [id]);

  const fetchPost = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`*, profiles:user_id (id, nickname, avatar_url)`)
        .eq('id', id)
        .single();

      if (error) throw error;
      setPost(data);
    } catch (error) {
      console.error('Error fetching post:', error);
      router.push('/community');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`*, profiles:user_id (id, nickname, avatar_url)`)
        .eq('post_id', id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { router.push('/login'); return; }
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('comments').insert({
        post_id: id,
        user_id: user.id,
        content: newComment.trim(),
      });
      if (error) throw error;
      setNewComment('');
      fetchComments();
    } catch (error) {
      console.error('Error creating comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePost = async () => {
    if (!post || !confirm('정말 이 게시글을 삭제하시겠습니까?')) return;
    try {
      await supabase.from('posts').delete().eq('id', post.id);
      router.push('/community');
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('정말 이 댓글을 삭제하시겠습니까?')) return;
    try {
      await supabase.from('comments').delete().eq('id', commentId);
      fetchComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-gray-500">로딩 중...</p></div>;
  }

  if (!post) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-gray-500">게시글을 찾을 수 없습니다.</p></div>;
  }

  const isAuthor = user?.id === post.user_id;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b bg-white sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 -ml-2"><ArrowLeft className="w-6 h-6" /></button>
        <h1 className="text-lg font-semibold">게시글</h1>
        {isAuthor ? (
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="p-2 -mr-2"><MoreVertical className="w-6 h-6" /></button>
            {showMenu && (
              <div className="absolute right-0 top-10 bg-white border rounded-lg shadow-lg py-1 min-w-32">
                <button onClick={() => router.push(`/community/${post.id}/edit`)} className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2">
                  <Edit2 size={16} /> 수정하기
                </button>
                <button onClick={handleDeletePost} className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-red-600">
                  <Trash2 size={16} /> 삭제하기
                </button>
              </div>
            )}
          </div>
        ) : <div className="w-10" />}
      </header>

      <div className="bg-white p-4 mb-2">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-[#7C3AED]/10 rounded-full flex items-center justify-center text-[#7C3AED] font-semibold">
            {post.profiles?.nickname?.[0] || '?'}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">{post.profiles?.nickname || '익명'}</p>
            <p className="text-xs text-gray-400">{formatDate(post.created_at)}</p>
          </div>
          <span className={`px-2 py-1 rounded text-xs font-bold ${getCategoryStyle(post.category)}`}>
            {getCategoryLabel(post.category)}
          </span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-3">{post.title}</h2>
        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{post.content}</p>
        {post.image_url && (
          <div className="mt-4 rounded-lg overflow-hidden">
            <img src={post.image_url} alt="게시글 이미지" className="w-full object-cover" />
          </div>
        )}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t">
          <button className="flex items-center gap-1 text-gray-500 hover:text-red-500">
            <Heart size={20} /> <span>{post.likes}</span>
          </button>
        </div>
      </div>

      <div className="bg-white flex-1">
        <div className="px-4 py-3 border-b"><h3 className="font-semibold text-gray-900">댓글 {comments.length}개</h3></div>
        <div className="divide-y">
          {comments.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">첫 번째 댓글을 남겨보세요!</div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 text-sm font-semibold">
                    {comment.profiles?.nickname?.[0] || '?'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm text-gray-900">{comment.profiles?.nickname || '익명'}</p>
                      {user?.id === comment.user_id && (
                        <button onClick={() => handleDeleteComment(comment.id)} className="text-gray-400 hover:text-red-500 p-1">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{comment.content}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(comment.created_at)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="sticky bottom-0 bg-white border-t p-4">
        <form onSubmit={handleSubmitComment} className="flex gap-2">
          <input
            type="text"
            placeholder={user ? '댓글을 입력하세요' : '로그인 후 댓글을 작성할 수 있습니다'}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={!user || submitting}
            className="flex-1 px-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!user || !newComment.trim() || submitting}
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-full w-10 h-10 flex items-center justify-center disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
