'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, Trash2, FileText, Clock, Loader2, AlertTriangle, Pill, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { SavedAnalysis, SavedPaper } from '@/lib/supabase';
import { getPubMedUrl } from '@/services/pubmed';
import { ConfirmModal } from '@/components/ConfirmModal';

export default function SavedAnalysesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<
    | { kind: 'analysis'; id: string }
    | { kind: 'paper'; paperId: string; analysisId: string }
    | null
  >(null);

  useEffect(() => {
    if (authLoading || !user) return;
    const fetchSaved = async () => {
      try {
        const { authFetch } = await import('@/lib/authFetch');
        const res = await authFetch('/api/saved-analyses');
        if (res.ok) {
          const data = await res.json();
          setAnalyses(data);
        }
      } catch {} finally {
        setLoading(false);
      }
    };
    fetchSaved();
  }, [user, authLoading]);

  const handleDeleteAnalysis = async (id: string) => {
    try {
      const { authFetch } = await import('@/lib/authFetch');
      const res = await authFetch('/api/saved-analyses', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setAnalyses(prev => prev.filter(a => a.id !== id));
      }
    } catch {}
  };

  const handleDeletePaper = async (paperId: string, analysisId: string) => {
    try {
      const { authFetch } = await import('@/lib/authFetch');
      const res = await authFetch('/api/saved-papers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: paperId }),
      });
      if (res.ok) {
        setAnalyses(prev => prev.map(a => {
          if (a.id !== analysisId) return a;
          return {
            ...a,
            saved_papers: (a.saved_papers || []).filter(p => p.id !== paperId),
          };
        }));
      }
    } catch {}
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  if (loading) {
    // min-h-[calc(100vh-8rem)]: Header(56px) + Footer 영역 제외해서
    // 실제 보이는 영역의 정확한 중앙에 스피너 위치. min-h-screen 쓰면
    // 컨테이너가 100vh 로 overflow 되어 스피너가 헤더 높이만큼 아래 치우침.
    return (
      <div className="min-h-[calc(100vh-8rem)] bg-white flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-blue-400 motion-reduce:animate-none" aria-label="로딩 중" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center gap-3 px-4 py-3 sticky top-0 bg-white z-10 border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-sm font-semibold text-gray-700">내 보관함</h1>
      </header>

      <div className="p-4 space-y-3">
        {analyses.length === 0 ? (
          <div className="text-center py-20">
            <FileText size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-400">보관함이 비어있습니다.</p>
            <p className="text-xs text-gray-300 mt-1">검색 결과에서 보관하기를 눌러보세요.</p>
          </div>
        ) : (
          analyses.map((item) => {
            const isExpanded = expandedId === item.id;
            const papers = item.saved_papers || [];
            // Fallback: legacy data may have articles in the old format
            const legacyArticles = item.articles?.length > 0 ? item.articles : [];
            const hasPapers = papers.length > 0 || legacyArticles.length > 0;

            return (
              <div key={item.id} className="rounded-xl border border-gray-100 overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{item.query}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Clock size={10} />
                          {formatDate(item.created_at)}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded-full">
                          {item.pet_type === 'dog' ? '강아지' : '고양이'}
                        </span>
                        {hasPapers && (
                          <span className="text-[10px] text-gray-300">
                            논문 {papers.length || legacyArticles.length}편
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmTarget({ kind: 'analysis', id: item.id }); }}
                        className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                      {isExpanded ? <ChevronUp size={14} className="text-gray-300" /> : <ChevronDown size={14} className="text-gray-300" />}
                    </div>
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-gray-50 px-4 pb-4">
                    {/* Precautions */}
                    {item.analysis?.precautions?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-gray-400 mb-1.5 flex items-center gap-1">
                          <AlertTriangle size={12} className="text-orange-400" />
                          주의사항 & 대처방법
                        </p>
                        <ul className="space-y-1">
                          {item.analysis.precautions.map((p: string, i: number) => (
                            <li key={i} className="flex gap-1.5 text-xs text-gray-600">
                              <span className="text-orange-300 mt-0.5">●</span>
                              {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Ingredients */}
                    {item.analysis?.ingredients?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-gray-400 mb-1.5 flex items-center gap-1">
                          <Pill size={12} className="text-purple-400" />
                          도움되는 성분
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {item.analysis.ingredients.map((ing: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full text-[10px] font-medium">
                              {ing}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Saved Papers (new format) */}
                    {papers.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1">
                          <FileText size={12} className="text-blue-400" />
                          저장된 논문 ({papers.length}편)
                        </p>
                        <div className="space-y-2">
                          {papers.map((paper) => (
                            <div key={paper.id} className="p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-700">
                                    {paper.title_ko || paper.title}
                                  </p>
                                  {paper.title_ko && (
                                    <p className="text-xs text-gray-300 mt-0.5 line-clamp-1">{paper.title}</p>
                                  )}
                                  {paper.summary && (
                                    <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{paper.summary}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    <p className="text-[10px] text-gray-400 truncate">
                                      {paper.journal} · {paper.pub_date}
                                    </p>
                                    <a
                                      href={getPubMedUrl(paper.pmid)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-blue-500 flex-shrink-0"
                                    >
                                      <ExternalLink size={10} />
                                      원문
                                    </a>
                                  </div>
                                </div>
                                <button
                                  onClick={() => setConfirmTarget({ kind: 'paper', paperId: paper.id, analysisId: item.id })}
                                  className="p-1 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Legacy articles (old format — backward compat) */}
                    {papers.length === 0 && legacyArticles.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1">
                          <FileText size={12} className="text-blue-400" />
                          논문 ({legacyArticles.length}편)
                        </p>
                        {legacyArticles.map((article: any, idx: number) => (
                          <div key={article.pmid || idx} className="py-3 border-b border-gray-50 last:border-b-0">
                            <p className="text-sm font-medium text-gray-700">
                              {item.analysis?.titles?.[idx] || article.title}
                            </p>
                            {item.analysis?.titles?.[idx] && (
                              <p className="text-xs text-gray-300 mt-0.5 line-clamp-1">{article.title}</p>
                            )}
                            {item.analysis?.summaries?.[idx] && (
                              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                                {item.analysis.summaries[idx]}
                              </p>
                            )}
                            <p className="text-[10px] text-gray-400 mt-1">
                              {article.journal} · {article.pubDate}
                            </p>
                            <a
                              href={getPubMedUrl(article.pmid)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-1.5 text-xs text-blue-500"
                            >
                              <ExternalLink size={10} />
                              원문 보기
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <ConfirmModal
        open={confirmTarget !== null}
        title={confirmTarget?.kind === 'paper' ? '논문을 삭제할까요?' : '보관함에서 삭제할까요?'}
        message={<>선택한 항목을 완전히 삭제합니다.<br />되돌릴 수 없어요.</>}
        variant="danger"
        confirmLabel="삭제"
        onConfirm={() => {
          if (!confirmTarget) return;
          if (confirmTarget.kind === 'analysis') handleDeleteAnalysis(confirmTarget.id);
          else handleDeletePaper(confirmTarget.paperId, confirmTarget.analysisId);
          setConfirmTarget(null);
        }}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
