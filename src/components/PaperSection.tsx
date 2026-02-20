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
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-3.5 bg-gray-100 rounded-full w-3/4" />
          <div className="h-3 bg-gray-50 rounded-full w-1/2" />
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
    <div className="border-b border-gray-50 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-start gap-2 py-3 text-left"
      >
        <div className="flex-1 pr-2">
          <p className="text-sm font-medium text-gray-800 leading-snug">
            {analysis?.titles?.[index] || article.title}
          </p>
          {analysis?.titles?.[index] && (
            <p className="text-xs text-gray-300 mt-0.5 line-clamp-1">
              {article.title}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {article.authors.slice(0, 3).join(', ')}
            {article.authors.length > 3 && ' et al.'}
            {' · '}
            {article.journal}
            {' · '}
            {article.pubDate}
          </p>
        </div>
        <ChevronDown size={14} className={`mt-1 text-gray-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="pb-3 pl-1">
          {analysis?.summaries?.[index] ? (
            <p className="text-sm text-gray-600 leading-relaxed mt-1">
              {analysis.summaries[index]}
            </p>
          ) : analysisLoading ? (
            <div className="animate-pulse space-y-2 mt-1">
              <div className="h-3 bg-gray-50 rounded-full w-full" />
              <div className="h-3 bg-gray-50 rounded-full w-4/5" />
            </div>
          ) : (
            <p className="text-xs text-gray-300 mt-1 italic">
              AI 요약을 불러올 수 없습니다.
            </p>
          )}
          <a
            href={getPubMedUrl(article.pmid)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2.5 text-xs text-blue-500 hover:text-blue-600 transition-colors"
          >
            <ExternalLink size={11} />
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
    <section>
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 mb-2">
        <FileText size={14} className="text-blue-500" />
        논문 요약
      </h3>

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        {loading && !error && articles.length === 0 && <SkeletonLoader />}

        {error && (
          <div className="flex items-center gap-2 mb-3 p-2.5 bg-red-50 rounded-lg text-xs text-red-500">
            <AlertCircle size={14} />
            <span className="flex-1">PubMed 연결에 실패했습니다.</span>
            <button
              onClick={retry}
              className="flex items-center gap-1 text-xs hover:text-red-700 transition-colors"
            >
              <RefreshCw size={11} />
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
            <p className="font-medium text-sm text-gray-700">{diseaseName}</p>
            <p className="text-gray-500 text-sm leading-relaxed">
              {diseaseSummary}
            </p>
            <span className="inline-block text-xs bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full mt-1">
              오프라인 데이터
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
