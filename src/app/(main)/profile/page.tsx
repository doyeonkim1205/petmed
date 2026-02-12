'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Pet } from '@/lib/supabase';
import {
  User, Settings, Bell, LogOut, ChevronRight, Edit2,
  X, Plus, Trash2, Dog, Cat, Moon, Sun, Type, Smartphone,
  Globe, Trash, Info,
} from 'lucide-react';

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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">닉네임 변경</h3>
          <button onClick={onClose} className="p-1 text-gray-400"><X size={20} /></button>
        </div>
        <input
          type="text"
          value={nickname}
          onChange={e => setNickname(e.target.value)}
          placeholder="새 닉네임 (2자 이상)"
          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none mb-2"
        />
        {errorMsg && (
          <p className="text-red-500 text-xs mb-2">{errorMsg}</p>
        )}
        <div className="flex gap-3 mt-2">
          <button onClick={onClose} className="flex-1 h-11 border border-gray-300 rounded-lg font-medium">취소</button>
          <button
            onClick={handleSave}
            disabled={saving || nickname.trim().length < 2}
            className="flex-1 h-11 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4">
          <h3 className="text-lg font-bold">나의 반려동물</h3>
          <button onClick={onClose} className="p-1 text-gray-400"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6">
          {loading ? (
            <p className="text-gray-400 text-center py-8">로딩 중...</p>
          ) : pets.length === 0 && !showAddForm ? (
            <p className="text-gray-400 text-center py-8">등록된 반려동물이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {pets.map(pet => (
                <div key={pet.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    {pet.type === 'dog' ? <Dog size={20} /> : <Cat size={20} />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{pet.name}</p>
                    <p className="text-xs text-gray-500">
                      {pet.type === 'dog' ? '강아지' : '고양이'}
                      {pet.breed ? ` / ${pet.breed}` : ''}
                      {pet.birth_date ? ` / ${pet.birth_date}` : ''}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(pet.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showAddForm && (
            <div className="mt-4 space-y-3 border-t pt-4">
              <input
                type="text"
                placeholder="이름"
                value={newPet.name}
                onChange={e => setNewPet(p => ({ ...p, name: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setNewPet(p => ({ ...p, type: 'dog' }))}
                  className={`flex-1 h-10 rounded-lg border font-medium text-sm flex items-center justify-center gap-1.5 ${
                    newPet.type === 'dog' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500'
                  }`}
                >
                  <Dog size={16} /> 강아지
                </button>
                <button
                  onClick={() => setNewPet(p => ({ ...p, type: 'cat' }))}
                  className={`flex-1 h-10 rounded-lg border font-medium text-sm flex items-center justify-center gap-1.5 ${
                    newPet.type === 'cat' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500'
                  }`}
                >
                  <Cat size={16} /> 고양이
                </button>
              </div>
              <input
                type="text"
                placeholder="품종 (선택)"
                value={newPet.breed}
                onChange={e => setNewPet(p => ({ ...p, breed: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                value={newPet.birth_date}
                onChange={e => setNewPet(p => ({ ...p, birth_date: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowAddForm(false); setNewPet({ name: '', type: 'dog', breed: '', birth_date: '' }); }}
                  className="flex-1 h-10 border border-gray-300 rounded-lg font-medium text-sm"
                >취소</button>
                <button
                  onClick={handleAdd}
                  disabled={saving || !newPet.name.trim()}
                  className="flex-1 h-10 bg-blue-600 text-white rounded-lg font-medium text-sm disabled:opacity-50"
                >
                  {saving ? '등록 중...' : '등록'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 pt-4">
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full h-11 flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
            >
              <Plus size={18} /> 반려동물 추가
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
  const [eventEnabled, setEventEnabled] = useState(false);

  useEffect(() => {
    if (open) {
      setPushEnabled(localStorage.getItem('notify_push') !== 'false');
      setRecordEnabled(localStorage.getItem('notify_community') !== 'false');
      setEventEnabled(localStorage.getItem('notify_event') === 'true');
    }
  }, [open]);

  if (!open) return null;

  const toggle = (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    localStorage.setItem(key, String(value));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold">알림 설정</h3>
          <button onClick={onClose} className="p-1 text-gray-400"><X size={20} /></button>
        </div>
        <div className="space-y-4">
          <ToggleRow label="푸시 알림" desc="앱 알림을 받습니다" checked={pushEnabled}
            onChange={v => toggle('notify_push', v, setPushEnabled)} />
          <ToggleRow label="기록장 알림" desc="투약 일정, 기록 알림" checked={recordEnabled}
            onChange={v => toggle('notify_community', v, setRecordEnabled)} />
          <ToggleRow label="이벤트 알림" desc="이벤트, 프로모션 알림" checked={eventEnabled}
            onChange={v => toggle('notify_event', v, setEventEnabled)} />
        </div>
        <button onClick={onClose} className="w-full h-11 mt-6 bg-blue-600 text-white rounded-lg font-medium">확인</button>
      </div>
    </div>
  );
}

// ─── App Settings Modal (Dark Mode + Settings) ─────────────
function AppSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [darkMode, setDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState('16');
  const [language, setLanguage] = useState('ko');
  const [cacheCleared, setCacheCleared] = useState(false);

  useEffect(() => {
    if (open) {
      setDarkMode(document.documentElement.classList.contains('dark'));
      setFontSize(localStorage.getItem('fontSize') || '16');
      setLanguage(localStorage.getItem('language') || 'ko');
      setCacheCleared(false);
    }
  }, [open]);

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

  const handleFontSize = (size: string) => {
    setFontSize(size);
    localStorage.setItem('fontSize', size);
    document.documentElement.style.fontSize = `${size}px`;
  };

  const handleClearCache = () => {
    // Clear app-specific cache (not auth)
    const keysToKeep = ['sb-ylbxtzwbwbnlmfxqgmoz-auth-token', 'theme', 'fontSize', 'language'];
    const allKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) allKeys.push(key);
    }
    allKeys.forEach(key => {
      if (!keysToKeep.some(k => key.includes(k))) {
        localStorage.removeItem(key);
      }
    });
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2000);
  };

  const fontSizes = [
    { value: '14', label: '작게' },
    { value: '16', label: '보통' },
    { value: '18', label: '크게' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4">
          <h3 className="text-lg font-bold">앱 설정</h3>
          <button onClick={onClose} className="p-1 text-gray-400"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">
          {/* Dark Mode */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              {darkMode ? <Moon size={16} className="text-blue-500" /> : <Sun size={16} className="text-orange-500" />}
              <span className="text-sm font-bold text-gray-700">화면 모드</span>
            </div>
            <ToggleRow
              label="다크 모드"
              desc="어두운 배경으로 눈의 피로를 줄입니다"
              checked={darkMode}
              onChange={handleDarkToggle}
            />
          </div>

          {/* Font Size */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Type size={16} className="text-gray-500" />
              <span className="text-sm font-bold text-gray-700">글자 크기</span>
            </div>
            <div className="flex gap-2">
              {fontSizes.map((fs) => (
                <button
                  key={fs.value}
                  onClick={() => handleFontSize(fs.value)}
                  className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors ${
                    fontSize === fs.value
                      ? 'border-blue-500 bg-blue-50 text-blue-600'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {fs.label}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Globe size={16} className="text-gray-500" />
              <span className="text-sm font-bold text-gray-700">언어</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setLanguage('ko'); localStorage.setItem('language', 'ko'); }}
                className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors ${
                  language === 'ko'
                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                    : 'border-gray-200 text-gray-500'
                }`}
              >
                한국어
              </button>
              <button
                onClick={() => { setLanguage('en'); localStorage.setItem('language', 'en'); }}
                className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors ${
                  language === 'en'
                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                    : 'border-gray-200 text-gray-500'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Cache Clear */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Trash size={16} className="text-gray-500" />
              <span className="text-sm font-bold text-gray-700">캐시 관리</span>
            </div>
            <button
              onClick={handleClearCache}
              className="w-full h-10 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {cacheCleared ? '캐시 삭제 완료!' : '캐시 데이터 삭제'}
            </button>
          </div>

          {/* App Info */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Info size={16} className="text-gray-500" />
              <span className="text-sm font-bold text-gray-700">앱 정보</span>
            </div>
            <div className="space-y-2 text-sm text-gray-500">
              <div className="flex justify-between">
                <span>버전</span>
                <span className="text-gray-700">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span>개발</span>
                <span className="text-gray-700">PetMed Team</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 pt-4 border-t border-gray-100">
          <button onClick={onClose} className="w-full h-11 bg-blue-600 text-white rounded-lg font-medium">확인</button>
        </div>
      </div>
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
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-colors relative ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`} />
      </button>
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

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  const handleSaveNickname = async (nickname: string) => {
    return await updateProfile({ nickname });
  };

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-[calc(100vh-8rem)] animate-pulse p-6">
        <div className="bg-white p-6 rounded-xl mb-2">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-gray-200 rounded w-24" />
              <div className="h-4 bg-gray-100 rounded w-40" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-gray-50 min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-4">
          <User size={40} className="text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">로그인이 필요합니다</h2>
        <p className="text-gray-500 text-center mb-6">
          PetMed의 모든 기능을 이용하려면<br />로그인해주세요.
        </p>
        <div className="flex gap-3 w-full max-w-xs">
          <button
            onClick={() => router.push('/register')}
            className="flex-1 h-12 border border-gray-300 rounded-lg font-medium"
          >
            회원가입
          </button>
          <button
            onClick={() => router.push('/login')}
            className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            로그인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-[calc(100vh-8rem)]">
      {/* Profile Header */}
      <div className="bg-white p-6 mb-2 border-b border-gray-100">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="프로필"
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <User size={32} />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">
              {profile?.nickname || '사용자'} 님
            </h2>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
          <button
            onClick={() => setShowNicknameModal(true)}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <Edit2 size={20} />
          </button>
        </div>

        {/* Pet Section */}
        <div className="bg-blue-50 rounded-xl p-4 flex justify-between items-center">
          <div>
            <p className="text-xs text-blue-600 font-bold mb-1">나의 반려동물</p>
            <p className="text-sm text-gray-500">반려동물을 등록하고 관리하세요.</p>
          </div>
          <button
            onClick={() => setShowPetModal(true)}
            className="text-xs bg-white border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-50"
          >
            관리하기
          </button>
        </div>
      </div>

      {/* Menu Items */}
      <div className="bg-white border-t border-b border-gray-100 mb-2">
        <button
          onClick={() => setShowNotificationModal(true)}
          className="w-full p-4 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50"
        >
          <div className="flex items-center gap-3 text-gray-700">
            <Bell size={20} />
            <span>알림 설정</span>
          </div>
          <ChevronRight size={16} className="text-gray-400" />
        </button>
        <button
          onClick={() => setShowSettingsModal(true)}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
        >
          <div className="flex items-center gap-3 text-gray-700">
            <Settings size={20} />
            <span>앱 설정</span>
          </div>
          <ChevronRight size={16} className="text-gray-400" />
        </button>
      </div>

      <div className="bg-white border-t border-b border-gray-100">
        <button
          onClick={handleLogout}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 text-red-500"
        >
          <div className="flex items-center gap-3">
            <LogOut size={20} />
            <span>로그아웃</span>
          </div>
        </button>
      </div>

      <div className="p-6 text-center text-xs text-gray-400">
        <p>PetMed v1.0.0</p>
        <p className="mt-1">문의: help@petmed.com</p>
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
      />
    </div>
  );
}
