'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Pet } from '@/lib/supabase';
import {
  User, Settings, Bell, LogOut, ChevronRight, Edit2,
  X, Plus, Trash2, Dog, Cat, Moon, Sun, Type, Heart, Bookmark, Crown,
  Globe, Trash, Info, Clock, Shield, Eye, FileText, UserX, AlertTriangle,
  CreditCard, MapPin, Building2,
} from 'lucide-react';
import Link from 'next/link';

// ─── Nickname Edit Modal ───────────────────────────────────
function NicknameModal({
  open, currentNickname, onClose, onSave,
}: {
  open: boolean;
  currentNickname: string;
  onClose: () => void;
  onSave: (nickname: string) => Promise<{ error: Error | null }>;
}) {
  const [nickname, setNickname] = useState(currentNickname);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => { setNickname(currentNickname); setErrorMsg(''); }, [currentNickname]);

  if (!open) return null;

  const handleSave = async () => {
    if (nickname.trim().length < 2) return;
    setSaving(true);
    setErrorMsg('');
    const result = await onSave(nickname.trim());
    setSaving(false);
    if (result.error) {
      setErrorMsg(result.error.message || '저장에 실패했습니다');
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xs p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-700">닉네임 변경</h3>
          <button onClick={onClose} className="p-1 text-gray-300 hover:text-gray-500"><X size={16} /></button>
        </div>
        <input
          type="text"
          value={nickname}
          onChange={e => setNickname(e.target.value)}
          placeholder="새 닉네임 (2자 이상)"
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm mb-2"
        />
        {errorMsg && (
          <p className="text-red-500 text-xs mb-2">{errorMsg}</p>
        )}
        <div className="flex gap-2 mt-3">
          <button onClick={onClose} className="flex-1 h-10 border border-gray-200 rounded-full text-sm text-gray-500 hover:bg-gray-50 transition-colors">취소</button>
          <button
            onClick={handleSave}
            disabled={saving || nickname.trim().length < 2}
            className="flex-1 h-10 bg-blue-600 text-[#fff] rounded-full text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pet Management Modal ──────────────────────────────────
function PetModal({
  open, userId, onClose,
}: {
  open: boolean;
  userId: string;
  onClose: () => void;
}) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPet, setNewPet] = useState({ name: '', type: 'dog' as 'dog' | 'cat', breed: '', birth_date: '' });
  const [saving, setSaving] = useState(false);

  const fetchPets = useCallback(async () => {
    setLoading(true);
    const timeout = setTimeout(() => {
      setLoading(false);
      console.warn('PetModal: fetch timed out after 5s');
    }, 5000);
    try {
      const { data, error } = await supabase
        .from('pets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setPets(data ?? []);
    } catch (err) {
      console.error('Error fetching pets:', err);
      setPets([]);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { if (open) fetchPets(); }, [open, fetchPets]);

  if (!open) return null;

  const handleAdd = async () => {
    if (!newPet.name.trim()) return;
    setSaving(true);
    await supabase.from('pets').insert({
      user_id: userId,
      name: newPet.name.trim(),
      type: newPet.type,
      breed: newPet.breed.trim() || null,
      birth_date: newPet.birth_date || null,
    });
    setNewPet({ name: '', type: 'dog', breed: '', birth_date: '' });
    setShowAddForm(false);
    setSaving(false);
    fetchPets();
  };

  const handleDelete = async (petId: string) => {
    await supabase.from('pets').delete().eq('id', petId);
    fetchPets();
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xs max-h-[80vh] flex flex-col shadow-lg">
        <div className="flex items-center justify-between p-5 pb-3">
          <h3 className="text-sm font-bold text-gray-700">나의 반려동물</h3>
          <button onClick={onClose} className="p-1 text-gray-300 hover:text-gray-500"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {loading ? (
            <p className="text-gray-400 text-center py-8 text-sm">로딩 중...</p>
          ) : pets.length === 0 && !showAddForm ? (
            <p className="text-gray-400 text-center py-8 text-sm">등록된 반려동물이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {pets.map(pet => (
                <div key={pet.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                    {pet.type === 'dog' ? <Dog size={16} /> : <Cat size={16} />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-700">{pet.name}</p>
                    <p className="text-[11px] text-gray-400">
                      {pet.type === 'dog' ? '강아지' : '고양이'}
                      {pet.breed ? ` / ${pet.breed}` : ''}
                      {pet.birth_date ? ` / ${pet.birth_date}` : ''}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(pet.id)} className="p-1 text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showAddForm && (
            <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
              <input
                type="text"
                placeholder="이름"
                value={newPet.name}
                onChange={e => setNewPet(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setNewPet(p => ({ ...p, type: 'dog' }))}
                  className={`flex-1 h-9 rounded-xl border text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                    newPet.type === 'dog' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400'
                  }`}
                >
                  <Dog size={14} /> 강아지
                </button>
                <button
                  onClick={() => setNewPet(p => ({ ...p, type: 'cat' }))}
                  className={`flex-1 h-9 rounded-xl border text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                    newPet.type === 'cat' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400'
                  }`}
                >
                  <Cat size={14} /> 고양이
                </button>
              </div>
              <input
                type="text"
                placeholder="품종 (선택)"
                value={newPet.breed}
                onChange={e => setNewPet(p => ({ ...p, breed: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <div>
                <label className="text-[11px] text-gray-400 mb-1 block">생년월일 (선택)</label>
                <input
                  type="date"
                  value={newPet.birth_date}
                  onChange={e => setNewPet(p => ({ ...p, birth_date: e.target.value }))}
                  className={`w-full px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 ${!newPet.birth_date ? 'date-empty' : ''}`}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowAddForm(false); setNewPet({ name: '', type: 'dog', breed: '', birth_date: '' }); }}
                  className="flex-1 h-9 border border-gray-200 rounded-full text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                >취소</button>
                <button
                  onClick={handleAdd}
                  disabled={saving || !newPet.name.trim()}
                  className="flex-1 h-9 bg-blue-600 text-[#fff] rounded-full text-xs font-medium disabled:opacity-50 transition-colors"
                >
                  {saving ? '등록 중...' : '등록'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 pt-3">
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full h-9 flex items-center justify-center gap-1.5 border border-dashed border-gray-200 rounded-full text-xs text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
            >
              <Plus size={14} /> 반려동물 추가
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Notification Settings Modal ───────────────────────────
function NotificationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [recordEnabled, setRecordEnabled] = useState(true);

  useEffect(() => {
    if (open) {
      setPushEnabled(localStorage.getItem('notify_push') !== 'false');
      setRecordEnabled(localStorage.getItem('notify_record') !== 'false');
    }
  }, [open]);

  if (!open) return null;

  const toggle = (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    localStorage.setItem(key, String(value));
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xs p-5 shadow-lg">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-gray-700">알림 설정</h3>
          <button onClick={onClose} className="p-1 text-gray-300 hover:text-gray-500"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          <ToggleRow label="푸시 알림" desc="앱 알림을 받습니다" checked={pushEnabled}
            onChange={v => toggle('notify_push', v, setPushEnabled)} />
          <ToggleRow label="기록장 알림" desc="투약 일정, 기록 알림" checked={recordEnabled}
            onChange={v => toggle('notify_record', v, setRecordEnabled)} />
        </div>
        <button onClick={onClose} className="w-full h-10 mt-5 bg-blue-600 text-[#fff] rounded-full text-sm font-medium transition-colors">확인</button>
      </div>
    </div>
  );
}

// ─── App Settings Modal (Full Featured) ─────────────────────
function AppSettingsModal({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
  const [darkMode, setDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState('16');
  const [language, setLanguage] = useState('ko');
  const [autoLogin, setAutoLogin] = useState(true);
  const [highContrast, setHighContrast] = useState(true);
  const [defaultPetId, setDefaultPetId] = useState<string>('');
  const [pets, setPets] = useState<Pet[]>([]);

  useEffect(() => {
    if (open) {
      setDarkMode(document.documentElement.classList.contains('dark'));
      setFontSize(localStorage.getItem('fontSize') || '16');
      setLanguage(localStorage.getItem('language') || 'ko');
      setAutoLogin(localStorage.getItem('autoLogin') !== 'false');
      setHighContrast(localStorage.getItem('highContrast') !== 'false');
      setDefaultPetId(localStorage.getItem('defaultPetId') || '');
      // Fetch pets for default pet selector
      supabase
        .from('pets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .then(({ data }) => setPets(data || []));
    }
  }, [open, userId]);

  if (!open) return null;

  const handleDarkToggle = (enabled: boolean) => {
    setDarkMode(enabled);
    if (enabled) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleHighContrastToggle = (enabled: boolean) => {
    setHighContrast(enabled);
    if (enabled) {
      document.documentElement.classList.add('high-contrast');
      localStorage.setItem('highContrast', 'true');
    } else {
      document.documentElement.classList.remove('high-contrast');
      localStorage.setItem('highContrast', 'false');
    }
  };

  const handleFontSize = (size: string) => {
    setFontSize(size);
    localStorage.setItem('fontSize', size);
    document.documentElement.style.fontSize = `${size}px`;
  };

  const handleAutoLogin = (enabled: boolean) => {
    setAutoLogin(enabled);
    localStorage.setItem('autoLogin', String(enabled));
  };

  const handleDefaultPet = (petId: string) => {
    setDefaultPetId(petId);
    if (petId) {
      localStorage.setItem('defaultPetId', petId);
    } else {
      localStorage.removeItem('defaultPetId');
    }
  };

  const fontSizes = [
    { value: '14', label: '작게' },
    { value: '16', label: '보통' },
    { value: '18', label: '크게' },
  ];

  return (
    <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xs max-h-[85vh] flex flex-col shadow-lg">
        <div className="flex items-center justify-between p-5 pb-3">
          <h3 className="text-sm font-bold text-gray-700">앱 설정</h3>
          <button onClick={onClose} className="p-1 text-gray-300 hover:text-gray-500"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-5">
          {/* Dark Mode */}
          <div>
            <SectionHeader icon={darkMode ? Moon : Sun} iconColor={darkMode ? 'text-blue-500' : 'text-orange-400'} label="화면 모드" />
            <ToggleRow label="다크 모드" desc="어두운 배경으로 눈의 피로를 줄입니다" checked={darkMode} onChange={handleDarkToggle} />
          </div>

          {/* Font Size */}
          <div>
            <SectionHeader icon={Type} iconColor="text-gray-400" label="글자 크기" />
            <div className="flex gap-2">
              {fontSizes.map((fs) => (
                <button
                  key={fs.value}
                  onClick={() => handleFontSize(fs.value)}
                  className={`flex-1 h-9 rounded-full border text-xs font-medium transition-colors ${
                    fontSize === fs.value
                      ? 'border-blue-500 bg-blue-50 text-blue-600'
                      : 'border-gray-200 text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {fs.label}
                </button>
              ))}
            </div>
          </div>

          {/* Default Pet */}
          {pets.length > 0 && (
            <div>
              <SectionHeader icon={Dog} iconColor="text-gray-400" label="기본 반려동물" />
              <p className="text-[11px] text-gray-400 mb-2">기록장 진입 시 자동 선택됩니다</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => handleDefaultPet('')}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                    defaultPetId === '' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400'
                  }`}
                >
                  전체
                </button>
                {pets.map((pet) => {
                  const Icon = pet.type === 'cat' ? Cat : Dog;
                  return (
                    <button
                      key={pet.id}
                      onClick={() => handleDefaultPet(pet.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                        defaultPetId === pet.id ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400'
                      }`}
                    >
                      <Icon size={12} />
                      {pet.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Auto Login */}
          <div>
            <SectionHeader icon={Shield} iconColor="text-gray-400" label="보안" />
            <ToggleRow label="자동 로그인" desc="앱 재시작 시 자동으로 로그인합니다" checked={autoLogin} onChange={handleAutoLogin} />
          </div>

          {/* Accessibility */}
          <div>
            <SectionHeader icon={Eye} iconColor="text-gray-400" label="접근성" />
            <ToggleRow label="고대비 모드" desc="텍스트와 버튼의 대비를 높입니다" checked={highContrast} onChange={handleHighContrastToggle} />
          </div>

          {/* Language */}
          <div>
            <SectionHeader icon={Globe} iconColor="text-gray-400" label="언어" />
            <div className="flex gap-2">
              <button
                onClick={() => { setLanguage('ko'); localStorage.setItem('language', 'ko'); }}
                className={`flex-1 h-9 rounded-full border text-xs font-medium transition-colors ${
                  language === 'ko' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400'
                }`}
              >
                한국어
              </button>
              <button
                onClick={() => { setLanguage('en'); localStorage.setItem('language', 'en'); }}
                className={`flex-1 h-9 rounded-full border text-xs font-medium transition-colors ${
                  language === 'en' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400'
                }`}
              >
                English
              </button>
            </div>
            {language === 'en' && (
              <p className="text-[11px] text-orange-500 mt-2">영어 지원은 준비 중입니다.</p>
            )}
          </div>

          {/* Cache Info */}
          <div>
            <SectionHeader icon={Trash} iconColor="text-gray-400" label="캐시 관리" />
            <p className="text-[11px] text-gray-400">6개월 이상 된 캐시 데이터는 자동으로 정리됩니다.</p>
          </div>

          {/* App Info */}
          <div>
            <SectionHeader icon={Info} iconColor="text-gray-400" label="앱 정보" />
            <div className="space-y-1.5 text-xs text-gray-400">
              <div className="flex justify-between"><span>버전</span><span className="text-gray-600">1.0.0</span></div>
              <div className="flex justify-between"><span>개발</span><span className="text-gray-600">PawDex Team</span></div>
            </div>
          </div>
        </div>

        <div className="p-5 pt-3 border-t border-gray-100">
          <button onClick={onClose} className="w-full h-10 bg-blue-600 text-[#fff] rounded-full text-sm font-medium transition-colors">확인</button>
        </div>
      </div>
    </div>
  );
}

// ─── Section Header ────────────────────────────────────────
function SectionHeader({ icon: Icon, iconColor, label }: { icon: React.ComponentType<{ size?: number; className?: string }>; iconColor: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <Icon size={14} className={iconColor} />
      <span className="text-xs font-semibold text-gray-600">{label}</span>
    </div>
  );
}

// ─── Toggle Row Component ──────────────────────────────────
function ToggleRow({ label, desc, checked, onChange }: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium text-gray-700">{label}</p>
        <p className="text-[11px] text-gray-400">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-10 h-5.5 rounded-full transition-colors relative ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}
        style={{ width: 40, height: 22 }}
      >
        <span className={`absolute top-0.5 w-[18px] h-[18px] bg-[#fff] rounded-full shadow transition-transform ${
          checked ? 'left-[20px]' : 'left-0.5'
        }`} />
      </button>
    </div>
  );
}

// ─── Delete Account Modal ─────────────────────────────────
function DeleteAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => { if (open) { setConfirmText(''); setErrorMsg(''); } }, [open]);

  if (!open) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setErrorMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('세션이 만료되었습니다.');

      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || '삭제 실패');

      // Clear all local state and redirect
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-') || key.startsWith('pawdex_')) localStorage.removeItem(key);
        });
      } catch {}
      window.location.href = '/';
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '오류가 발생했습니다.');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xs p-5 shadow-lg">
        <div className="flex flex-col items-center mb-4">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
            <AlertTriangle size={22} className="text-red-400" />
          </div>
          <h3 className="text-sm font-bold text-gray-800 mb-1">정말 탈퇴하시겠어요?</h3>
          <p className="text-xs text-gray-400 text-center leading-relaxed">
            모든 데이터가 <span className="text-red-400 font-medium">영구 삭제</span>되며<br />복구할 수 없습니다.
          </p>
        </div>

        <div className="mb-4">
          <p className="text-[11px] text-gray-400 mb-1.5">확인을 위해 <span className="font-bold text-gray-600">&quot;탈퇴합니다&quot;</span>를 입력해주세요.</p>
          <input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="탈퇴합니다"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm"
          />
        </div>

        {errorMsg && <p className="text-red-500 text-xs mb-3">{errorMsg}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 border border-gray-200 rounded-full text-sm text-gray-500 hover:bg-gray-50 transition-colors">
            취소
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting || confirmText !== '탈퇴합니다'}
            className="flex-1 h-10 bg-red-500 text-[#fff] rounded-full text-sm font-medium disabled:opacity-40 transition-colors"
          >
            {deleting ? '처리 중...' : '탈퇴하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Profile Page ─────────────────────────────────────
export default function ProfilePage() {
  const { user, profile, loading, signOut, updateProfile } = useAuth();
  const router = useRouter();

  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [showPetModal, setShowPetModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleLogout = () => {
    // Clear auth data from localStorage (검색 기록은 사용자별로 유지)
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') && key.includes('auth')) {
          localStorage.removeItem(key);
        }
      });
      localStorage.removeItem('pawdex_translation_cache');
    } catch {}
    // Clear session storage (검색 결과 캐시)
    try { sessionStorage.clear(); } catch {}
    // Full page reload — AuthContext.init() will find no session → show login
    window.location.href = '/';
  };

  const handleSaveNickname = async (nickname: string) => {
    return await updateProfile({ nickname });
  };

  if (loading) {
    return (
      <div className="bg-white min-h-[calc(100vh-8rem)] animate-pulse p-6 max-w-sm mx-auto">
        <div className="flex flex-col items-center pt-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full" />
          <div className="h-5 bg-gray-100 rounded w-24 mt-4" />
          <div className="h-4 bg-gray-50 rounded w-40 mt-2" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-white min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <User size={28} className="text-gray-400" />
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-1">로그인이 필요합니다</h2>
        <p className="text-sm text-gray-400 text-center mb-8">
          PawDex의 모든 기능을 이용하려면<br />로그인해주세요.
        </p>
        <div className="flex gap-3 w-full max-w-xs">
          <button
            onClick={() => router.push('/register')}
            className="flex-1 h-11 border border-gray-200 rounded-full font-medium text-sm text-gray-600 hover:border-gray-300 transition-colors"
          >
            회원가입
          </button>
          <button
            onClick={() => router.push('/login')}
            className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-[#fff] rounded-full font-medium text-sm transition-colors"
          >
            로그인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-[calc(100vh-8rem)]">
      {/* Profile Header */}
      <div className="max-w-sm mx-auto px-4 pt-8 pb-6">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-3 overflow-hidden">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="프로필"
                className="w-full h-full rounded-full object-cover"
                referrerPolicy="no-referrer"

              />
            ) : (
              <User size={28} />
            )}
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-800">
              {profile?.nickname || '사용자'}
            </h2>
            <button
              onClick={() => setShowNicknameModal(true)}
              className="p-1 text-gray-300 hover:text-blue-500 transition-colors"
            >
              <Edit2 size={14} />
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
          {profile?.plan === 'premium' ? (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full font-medium">
              <Crown size={10} /> Premium
            </span>
          ) : profile?.plan === 'basic' ? (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">
              <Heart size={10} /> Basic
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] px-2 py-0.5 bg-gray-50 text-gray-400 rounded-full">
              Free
            </span>
          )}
        </div>
      </div>

      {/* Menu List */}
      <div className="max-w-sm mx-auto px-4 space-y-1">
        {/* Pet Management */}
        <button
          onClick={() => setShowPetModal(true)}
          className="w-full px-4 py-3.5 flex items-center justify-between rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-gray-600">
            <Heart size={18} className="text-pink-400" />
            <span className="text-sm">나의 반려동물</span>
          </div>
          <ChevronRight size={14} className="text-gray-300" />
        </button>

        {/* Saved Analyses */}
        <Link
          href="/profile/saved"
          className="w-full px-4 py-3.5 flex items-center justify-between rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-gray-600">
            <Bookmark size={18} className="text-blue-400" />
            <span className="text-sm">내 보관함</span>
          </div>
          <ChevronRight size={14} className="text-gray-300" />
        </Link>

        {/* 알림 설정 - 웹앱에서는 숨김 (향후 네이티브 앱용으로 유지) */}
        {false && (
        <button
          onClick={() => setShowNotificationModal(true)}
          className="w-full px-4 py-3.5 flex items-center justify-between rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-gray-600">
            <Bell size={18} className="text-gray-400" />
            <span className="text-sm">알림 설정</span>
          </div>
          <ChevronRight size={14} className="text-gray-300" />
        </button>
        )}

        <button
          onClick={() => setShowSettingsModal(true)}
          className="w-full px-4 py-3.5 flex items-center justify-between rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-gray-600">
            <Settings size={18} className="text-gray-400" />
            <span className="text-sm">앱 설정</span>
          </div>
          <ChevronRight size={14} className="text-gray-300" />
        </button>

        {/* Divider */}
        <div className="border-t border-gray-100 my-2" />

        <Link
          href="/pricing"
          className="w-full px-4 py-3.5 flex items-center justify-between rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-gray-600">
            <CreditCard size={18} className="text-blue-400" />
            <span className="text-sm">요금제 관리</span>
          </div>
          <ChevronRight size={14} className="text-gray-300" />
        </Link>

        {/* Divider */}
        <div className="border-t border-gray-100 my-2" />

        <Link
          href="/terms"
          className="w-full px-4 py-3.5 flex items-center justify-between rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-gray-600">
            <FileText size={18} className="text-gray-400" />
            <span className="text-sm">이용약관</span>
          </div>
          <ChevronRight size={14} className="text-gray-300" />
        </Link>

        <Link
          href="/privacy"
          className="w-full px-4 py-3.5 flex items-center justify-between rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-gray-600">
            <Shield size={18} className="text-gray-400" />
            <span className="text-sm">개인정보처리방침</span>
          </div>
          <ChevronRight size={14} className="text-gray-300" />
        </Link>

        <Link
          href="/refund"
          className="w-full px-4 py-3.5 flex items-center justify-between rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-gray-600">
            <CreditCard size={18} className="text-gray-400" />
            <span className="text-sm">환불 정책</span>
          </div>
          <ChevronRight size={14} className="text-gray-300" />
        </Link>

        <Link
          href="/location-terms"
          className="w-full px-4 py-3.5 flex items-center justify-between rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-gray-600">
            <MapPin size={18} className="text-gray-400" />
            <span className="text-sm">위치기반서비스 이용약관</span>
          </div>
          <ChevronRight size={14} className="text-gray-300" />
        </Link>

        <Link
          href="/business"
          className="w-full px-4 py-3.5 flex items-center justify-between rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-gray-600">
            <Building2 size={18} className="text-gray-400" />
            <span className="text-sm">사업자 정보</span>
          </div>
          <ChevronRight size={14} className="text-gray-300" />
        </Link>

        {/* Divider */}
        <div className="border-t border-gray-100 my-2" />

        <button
          onClick={handleLogout}
          className="w-full px-4 py-3.5 flex items-center rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-red-400">
            <LogOut size={18} />
            <span className="text-sm">로그아웃</span>
          </div>
        </button>

        <button
          onClick={() => setShowDeleteModal(true)}
          className="w-full px-4 py-3.5 flex items-center rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-gray-300">
            <UserX size={18} />
            <span className="text-sm">회원 탈퇴</span>
          </div>
        </button>
      </div>

      <div className="py-8 px-6 text-center space-y-1">
        <p className="text-xs text-gray-300">PawDex v1.0.0</p>
        <div className="text-[10px] text-gray-300 leading-relaxed">
          <p>디와이랩스(DYLabs) | 대표: 김도연</p>
          <p>사업자등록번호: 769-77-00552</p>
          <p>통신판매업신고번호: 2026-화성동탄-1654</p>
          <p>경기도 화성시 동탄순환대로 26길 81</p>
          <p>010-8306-9687 | dylabs.pawdex@gmail.com</p>
        </div>
      </div>

      {/* Modals */}
      <NicknameModal
        open={showNicknameModal}
        currentNickname={profile?.nickname || ''}
        onClose={() => setShowNicknameModal(false)}
        onSave={handleSaveNickname}
      />
      <PetModal
        open={showPetModal}
        userId={user.id}
        onClose={() => setShowPetModal(false)}
      />
      <NotificationModal
        open={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
      />
      <AppSettingsModal
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        userId={user.id}
      />
      <DeleteAccountModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
