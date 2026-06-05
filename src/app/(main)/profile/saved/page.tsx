'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, Trash2, FileText, Clock, Loader2, AlertTriangle, Pill, ChevronDown, ChevronUp, Camera } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { SavedAnalysis } from '@/lib/supabase';
import { getPubMedUrl } from '@/services/pubmed';
import { ConfirmModal } from '@/components/ConfirmModal';
import { getThumbnailsBulk, deleteThumbnail } from '@/lib/photoThumbnailStore';

type FilterKind = 'all' | 'paper' | 'symptom_photo';

export default function SavedAnalysesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKind>('all');
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
          const data: SavedAnalysis[] = await res.json();
          setAnalyses(data);
          // 사진 분석 항목들의 썸네일 일괄 로드 (IndexedDB)
          const photoIds = data.filter(a => a.kind === 'symptom_photo').map(a => a.id);
          if (photoIds.length > 0) {
            const thumbs = await getThumbnailsBulk(photoIds);
            setThumbnails(thumbs);
          }
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
        deleteThumbnail(id); // IndexedDB 정리 (silent)
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
    return (
      <div className="min-h-[calc(100vh-8rem)] bg-white flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-blue-400 motion-reduce:animate-none" aria-label="로딩 중" />
      </div>
    );
  }

  const hasPaper = analyses.some(a => a.kind !== 'symptom_photo');
  const hasPhoto = analyses.some(a => a.kind === 'symptom_photo');
  const showFilter = hasPaper && hasPhoto;

  const filtered = analyses.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'symptom_photo') return a.kind === 'symptom_photo';
    return a.kind !== 'symptom_photo'; // 'paper' (legacy null kind 도 포함)
  });

  return (
    <div className="min-h-screen bg-white">
      <header className="relative flex items-center justify-center px-4 h-[60px] sticky top-0 bg-white z-10">
        <button onClick={() => router.back()} className="absolute left-2 p-2 text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-semibold text-gray-700">내 보관함</h1>
      </header>

      {showFilter && (
        <div className="px-4 pt-3 flex gap-1.5">
          {[
            { key: 'all' as FilterKind, label: '전체' },
            { key: 'paper' as FilterKind, label: '논문' },
            { key: 'symptom_photo' as FilterKind, label: '사진' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                filter === key ? 'bg-purple-600 text-white' : 'bg-gray-50 text-gray-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="p-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <FileText size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-400">보관함이 비어있습니다.</p>
            <p className="text-xs text-gray-300 mt-1">검색 결과에서 보관하기를 눌러보세요.</p>
          </div>
        ) : (
          filtered.map((item) => {
            const isExpanded = expandedId === item.id;
            if (item.kind === 'symptom_photo') {
              return (
                <PhotoAnalysisCard
                  key={item.id}
                  item={item}
                  isExpanded={isExpanded}
                  onToggle={() => setExpandedId(isExpanded ? null : item.id)}
                  onDelete={() => setConfirmTarget({ kind: 'analysis', id: item.id })}
                  thumbnail={thumbnails[item.id] || null}
                  formatDate={formatDate}
                />
              );
            }
            return (
              <PaperAnalysisCard
                key={item.id}
                item={item}
                isExpanded={isExpanded}
                onToggle={() => setExpandedId(isExpanded ? null : item.id)}
                onDeleteAnalysis={() => setConfirmTarget({ kind: 'analysis', id: item.id })}
                onDeletePaper={(paperId) => setConfirmTarget({ kind: 'paper', paperId, analysisId: item.id })}
                formatDate={formatDate}
              />
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

/* ─── 사진 분석 카드 ────────────────────────────────────────────── */
function PhotoAnalysisCard({
  item, isExpanded, onToggle, onDelete, thumbnail, formatDate,
}: {
  item: SavedAnalysis;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  thumbnail: string | null;
  formatDate: (d: string) => string;
}) {
  const analysis = item.analysis || {};
  const diseases: any[] = Array.isArray(analysis.diseases) ? analysis.diseases : [];
  const observations: string[] = Array.isArray(analysis.observations) ? analysis.observations : [];
  const concern: 'low' | 'medium' | 'high' | undefined = analysis.concern_level;
  const concernLabel = concern === 'high' ? '주의 필요' : concern === 'medium' ? '관찰 필요' : '경미';

  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden">
      <button onClick={onToggle} className="w-full p-3 text-left">
        <div className="flex items-start gap-3">
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnail} alt="" className="w-14 h-14 rounded-md object-cover border border-gray-200 flex-shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-md bg-gray-50 flex items-center justify-center flex-shrink-0">
              <Camera size={20} className="text-gray-300" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 line-clamp-1">{item.query}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <Clock size={10} /> {formatDate(item.created_at)}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-500 rounded-full flex items-center gap-1">
                <Camera size={10} /> 사진 분석
              </span>
              {concern && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  concern === 'high' ? 'bg-red-50 text-red-600' :
                  concern === 'medium' ? 'bg-amber-50 text-amber-600' :
                  'bg-emerald-50 text-emerald-600'
                }`}>
                  {concernLabel}
                </span>
              )}
              {diseases.length > 0 && (
                <span className="text-[10px] text-gray-300">의심 {diseases.length}개</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 text-gray-300 hover:text-red-400"
            >
              <Trash2 size={14} />
            </button>
            {isExpanded ? <ChevronUp size={14} className="text-gray-300" /> : <ChevronDown size={14} className="text-gray-300" />}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-50 px-4 pb-4 space-y-3 pt-3">
          {observations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">관찰된 내용</p>
              <ul className="text-xs text-gray-600 space-y-0.5 list-disc pl-4">
                {observations.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
          )}
          {diseases.map((d, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-baseline gap-1.5">
                <p className="text-sm font-semibold text-gray-800">{d.name_ko}</p>
                {d.name_en && <span className="text-[10px] text-gray-400">{d.name_en}</span>}
              </div>
              {d.description && (
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">{d.description}</p>
              )}
              {d.action && (
                <p className="text-xs bg-white text-purple-800 rounded p-1.5 mt-2">💡 {d.action}</p>
              )}
            </div>
          ))}
          {analysis.reassurance && diseases.length === 0 && (
            <p className="text-xs text-gray-600 leading-relaxed">{analysis.reassurance}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── 논문 분석 카드 (기존 로직 유지) ────────────────────────────── */
function PaperAnalysisCard({
  item, isExpanded, onToggle, onDeleteAnalysis, onDeletePaper, formatDate,
}: {
  item: SavedAnalysis;
  isExpanded: boolean;
  onToggle: () => void;
  onDeleteAnalysis: () => void;
  onDeletePaper: (paperId: string) => void;
  formatDate: (d: string) => string;
}) {
  const papers = item.saved_papers || [];
  const legacyArticles = item.articles?.length > 0 ? item.articles : [];
  const hasPapers = papers.length > 0 || legacyArticles.length > 0;

  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden">
      <button onClick={onToggle} className="w-full p-4 text-left">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800">{item.query}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <Clock size={10} /> {formatDate(item.created_at)}
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
              onClick={(e) => { e.stopPropagation(); onDeleteAnalysis(); }}
              className="p-1.5 text-gray-300 hover:text-red-400"
            >
              <Trash2 size={14} />
            </button>
            {isExpanded ? <ChevronUp size={14} className="text-gray-300" /> : <ChevronDown size={14} className="text-gray-300" />}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-50 px-4 pb-4">
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
                        onClick={() => onDeletePaper(paper.id)}
                        className="p-1 text-gray-300 hover:text-red-400 flex-shrink-0"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
}
