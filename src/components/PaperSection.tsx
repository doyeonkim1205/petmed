'use client';

import React from 'react';
import { FileText, ExternalLink, RefreshCw, AlertCircle, ChevronDown } from 'lucide-react';
import { getPubMedUrl } from '@/services/pubmed';
import { UsePubMedSearchResult } from '@/hooks/usePubMedSearch';

interface PaperSectionProps {
  pubmed: UsePubMedSearchResult;
  diseaseName: string;
  diseaseSummary: string;
}

function SkeletonLoader() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

function AccordionItem({ article, index, analysis, analysisLoading }: {
  article: { pmid: string; title: string; authors: string[]; journal: string; pubDate: string };
  index: number;
  analysis: UsePubMedSearchResult['analysis'];
  analysisLoading: boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(index === 0);

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-start gap-2 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 pr-2">
          <p className="text-sm font-semibold text-gray-800 leading-snug">
            {article.title}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {article.authors.slice(0, 3).join(', ')}
            {article.authors.length > 3 && ' et al.'}
            {' · '}
            {article.journal}
            {' · '}
            {article.pubDate}
          </p>
        </div>
        <ChevronDown size={16} className={`mt-1 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="pb-3 pl-1">
          {analysis?.summaries?.[index] ? (
            <p className="text-sm text-gray-700 leading-relaxed mt-1">
              {analysis.summaries[index]}
            </p>
          ) : analysisLoading ? (
            <div className="animate-pulse space-y-2 mt-1">
              <div className="h-3 bg-gray-100 rounded w-full" />
              <div className="h-3 bg-gray-100 rounded w-4/5" />
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-1 italic">
              AI 요약을 불러올 수 없습니다.
            </p>
          )}
          <a
            href={getPubMedUrl(article.pmid)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-3 text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded hover:bg-blue-100 transition-colors"
          >
            <ExternalLink size={12} />
            원본 논문 보기
          </a>
        </div>
      )}
    </div>
  );
}

export function PaperSection({
  pubmed,
  diseaseName,
  diseaseSummary,
}: PaperSectionProps) {
  const { articles, loading, error, retry, analysis, analysisLoading } = pubmed;

  const showFallback = !loading && (error !== null || articles.length === 0);

  return (
    <section className="bg-white p-5 rounded-2xl shadow-sm border border-blue-100 relative overflow-hidden">
      <div className="flex justify-between items-start mb-3">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="text-blue-500" size={20} />
          논문 요약
        </h2>
      </div>

      {loading && <SkeletonLoader />}

      {error && (
        <div className="flex items-center gap-2 mb-3 p-3 bg-red-50 rounded-lg text-sm text-red-600">
          <AlertCircle size={16} />
          <span className="flex-1">
            PubMed 연결에 실패했습니다. mock 데이터를 표시합니다.
          </span>
          <button
            onClick={retry}
            className="flex items-center gap-1 text-xs bg-red-100 hover:bg-red-200 px-2 py-1 rounded transition-colors"
          >
            <RefreshCw size={12} />
            재시도
          </button>
        </div>
      )}

      {!loading && articles.length > 0 && (
        <div>
          {articles.map((article, idx) => (
            <AccordionItem
              key={article.pmid}
              article={article}
              index={idx}
              analysis={analysis}
              analysisLoading={analysisLoading}
            />
          ))}
        </div>
      )}

      {showFallback && (
        <div className="space-y-2">
          <h3 className="font-bold text-lg text-gray-800">{diseaseName}</h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            {diseaseSummary}
          </p>
          <div className="mt-3 flex gap-2">
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">
              오프라인 데이터
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
