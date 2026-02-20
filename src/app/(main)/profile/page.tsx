'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Pet } from '@/lib/supabase';
import {
  User, Settings, Bell, LogOut, ChevronRight, Edit2,
  X, Plus, Trash2, Dog, Cat, Moon, Sun, Type,
  Globe, Trash, Info, Clock, Shield, Eye, FileText, UserX, AlertTriangle,
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
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6">
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
            className="flex-1 h-11 bg-blue-600 text-[#fff] rounded-lg font-medium disabled:opacity-50"
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
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col">
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
              <div>
                <label className="text-xs text-gray-500 mb-1 block">생년월일 (선택)</label>
                <input
                  type="date"
                  value={newPet.birth_date}
                  onChange={e => setNewPet(p => ({ ...p, birth_date: e.target.value }))}
                  className={`w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 ${!newPet.birth_date ? 'date-empty' : ''}`}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowAddForm(false); setNewPet({ name: '', type: 'dog', breed: '', birth_date: '' }); }}
                  className="flex-1 h-10 border border-gray-300 rounded-lg font-medium text-sm"
                >취소</button>
                <button
                  onClick={handleAdd}
                  disabled={saving || !newPet.name.trim()}
                  className="flex-1 h-10 bg-blue-600 text-[#fff] rounded-lg font-medium text-sm disabled:opacity-50"
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
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold">알림 설정</h3>
          <button onClick={onClose} className="p-1 text-gray-400"><X size={20} /></button>
        </div>
        <div className="space-y-4">
          <ToggleRow label="푸시 알림" desc="앱 알림을 받습니다" checked={pushEnabled}
            onChange={v => toggle('notify_push', v, setPushEnabled)} />
          <ToggleRow label="기록장 알림" desc="투약 일정, 기록 알림" checked={recordEnabled}
            onChange={v => toggle('notify_record', v, setRecordEnabled)} />
        </div>
        <button onClick={onClose} className="w-full h-11 mt-6 bg-blue-600 text-[#fff] rounded-lg font-medium">확인</button>
      </div>
    </div>
  );
}

// ─── App Settings Modal (Full Featured) ─────────────────────
function AppSettingsModal({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
  const [darkMode, setDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState('16');
  const [language, setLanguage] = useState('ko');
  const [medAlarmTime, setMedAlarmTime] = useState('09:00');
  const [autoLogin, setAutoLogin] = useState(true);
  const [highContrast, setHighContrast] = useState(false);
  const [defaultPetId, setDefaultPetId] = useState<string>('');
  const [pets, setPets] = useState<Pet[]>([]);

  useEffect(() => {
    if (open) {
      setDarkMode(document.documentElement.classList.contains('dark'));
      setFontSize(localStorage.getItem('fontSize') || '16');
      setLanguage(localStorage.getItem('language') || 'ko');
      setMedAlarmTime(localStorage.getItem('medAlarmTime') || '09:00');
      setAutoLogin(localStorage.getItem('autoLogin') !== 'false');
      setHighContrast(document.documentElement.classList.contains('high-contrast'));
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

  const handleMedAlarmTime = (time: string) => {
    setMedAlarmTime(time);
    localStorage.setItem('medAlarmTime', time);
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

  const alarmTimes = [
    { value: '07:00', label: '오전 7시' },
    { value: '08:00', label: '오전 8시' },
    { value: '09:00', label: '오전 9시' },
    { value: '10:00', label: '오전 10시' },
    { value: '12:00', label: '낮 12시' },
    { value: '18:00', label: '오후 6시' },
    { value: '21:00', label: '오후 9시' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4">
          <h3 className="text-lg font-bold">앱 설정</h3>
          <button onClick={onClose} className="p-1 text-gray-400"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">
          {/* Dark Mode */}
          <div>
            <SectionHeader icon={darkMode ? Moon : Sun} iconColor={darkMode ? 'text-blue-500' : 'text-orange-500'} label="화면 모드" />
            <ToggleRow label="다크 모드" desc="어두운 배경으로 눈의 피로를 줄입니다" checked={darkMode} onChange={handleDarkToggle} />
          </div>

          {/* Font Size */}
          <div>
            <SectionHeader icon={Type} iconColor="text-gray-500" label="글자 크기" />
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

          {/* Default Pet */}
          {pets.length > 0 && (
            <div>
              <SectionHeader icon={Dog} iconColor="text-gray-500" label="기본 반려동물" />
              <p className="text-xs text-gray-400 mb-2">기록장 진입 시 자동 선택됩니다</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleDefaultPet('')}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    defaultPetId === '' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500'
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
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        defaultPetId === pet.id ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500'
                      }`}
                    >
                      <Icon size={14} />
                      {pet.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Medication Alarm Time */}
          <div>
            <SectionHeader icon={Clock} iconColor="text-gray-500" label="투약 알림 시간" />
            <p className="text-xs text-gray-400 mb-2">매일 투약 확인 알림을 보낼 시간</p>
            <select
              value={medAlarmTime}
              onChange={(e) => handleMedAlarmTime(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {alarmTimes.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Auto Login */}
          <div>
            <SectionHeader icon={Shield} iconColor="text-gray-500" label="보안" />
            <ToggleRow label="자동 로그인" desc="앱 재시작 시 자동으로 로그인합니다" checked={autoLogin} onChange={handleAutoLogin} />
          </div>

          {/* Accessibility */}
          <div>
            <SectionHeader icon={Eye} iconColor="text-gray-500" label="접근성" />
            <ToggleRow label="고대비 모드" desc="텍스트와 버튼의 대비를 높입니다" checked={highContrast} onChange={handleHighContrastToggle} />
          </div>

          {/* Language */}
          <div>
            <SectionHeader icon={Globe} iconColor="text-gray-500" label="언어" />
            <div className="flex gap-2">
              <button
                onClick={() => { setLanguage('ko'); localStorage.setItem('language', 'ko'); }}
                className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors ${
                  language === 'ko' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500'
                }`}
              >
                한국어
              </button>
              <button
                onClick={() => { setLanguage('en'); localStorage.setItem('language', 'en'); }}
                className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors ${
                  language === 'en' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500'
                }`}
              >
                English
              </button>
            </div>
            {language === 'en' && (
              <p className="text-xs text-orange-500 mt-2">영어 지원은 준비 중입니다. 빠른 시일 내에 제공될 예정입니다.</p>
            )}
          </div>

          {/* Cache Info */}
          <div>
            <SectionHeader icon={Trash} iconColor="text-gray-500" label="캐시 관리" />
            <p className="text-xs text-gray-400">6개월 이상 된 캐시 데이터는 자동으로 정리됩니다.</p>
          </div>

          {/* App Info */}
          <div>
            <SectionHeader icon={Info} iconColor="text-gray-500" label="앱 정보" />
            <div className="space-y-2 text-sm text-gray-500">
              <div className="flex justify-between"><span>버전</span><span className="text-gray-700">1.0.0</span></div>
              <div className="flex justify-between"><span>개발</span><span className="text-gray-700">PawDex Team</span></div>
            </div>
          </div>
        </div>

        <div className="p-6 pt-4 border-t border-gray-100">
          <button onClick={onClose} className="w-full h-11 bg-blue-600 text-[#fff] rounded-lg font-medium">확인</button>
        </div>
      </div>
    </div>
  );
}

// ─── Section Header ────────────────────────────────────────
function SectionHeader({ icon: Icon, iconColor, label }: { icon: React.ComponentType<{ size?: number; className?: string }>; iconColor: string; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={16} className={iconColor} />
      <span className="text-sm font-bold text-gray-700">{label}</span>
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
        <span className={`absolute top-0.5 w-5 h-5 bg-[#fff] rounded-full shadow transition-transform ${
          checked ? 'left-[22px]' : 'left-0.5'
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
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6">
        <div className="flex flex-col items-center mb-5">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">정말 탈퇴하시겠어요?</h3>
          <p className="text-sm text-gray-500 text-center leading-relaxed">
            탈퇴 시 모든 데이터(반려동물 정보, 건강 기록 등)가<br />
            <span className="text-red-500 font-medium">영구적으로 삭제</span>되며 복구할 수 없습니다.
          </p>
        </div>

        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2">확인을 위해 <span className="font-bold text-gray-700">&quot;탈퇴합니다&quot;</span>를 입력해주세요.</p>
          <input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="탈퇴합니다"
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
          />
        </div>

        {errorMsg && <p className="text-red-500 text-xs mb-3">{errorMsg}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 h-11 border border-gray-300 rounded-lg font-medium text-sm">
            취소
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting || confirmText !== '탈퇴합니다'}
            className="flex-1 h-11 bg-red-500 text-[#fff] rounded-lg font-medium text-sm disabled:opacity-40"
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
    // Clear auth localStorage FIRST (synchronous, guaranteed)
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') && key.includes('auth')) {
          localStorage.removeItem(key);
        }
      });
    } catch {}
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
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-3">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="프로필"
                className="w-full h-full rounded-full object-cover"
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
            <Dog size={18} className="text-gray-400" />
            <span className="text-sm">나의 반려동물</span>
          </div>
          <ChevronRight size={14} className="text-gray-300" />
        </button>

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

      <div className="py-8 text-center text-xs text-gray-300">
        PawDex v1.0.0
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
