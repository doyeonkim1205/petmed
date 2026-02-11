'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Pet } from '@/lib/supabase';
import {
  User, Settings, Bell, LogOut, ChevronRight, Gift, Edit2,
  X, Plus, Trash2, Dog, Cat,
} from 'lucide-react';

// ─── Nickname Edit Modal ───────────────────────────────────
function NicknameModal({
  open, currentNickname, onClose, onSave,
}: {
  open: boolean;
  currentNickname: string;
  onClose: () => void;
  onSave: (nickname: string) => Promise<void>;
}) {
  const [nickname, setNickname] = useState(currentNickname);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setNickname(currentNickname); }, [currentNickname]);

  if (!open) return null;

  const handleSave = async () => {
    if (nickname.trim().length < 2) return;
    setSaving(true);
    await onSave(nickname.trim());
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
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
          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none mb-4"
        />
        <div className="flex gap-3">
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
    const { data } = await supabase
      .from('pets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    setPets(data ?? []);
    setLoading(false);
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
  const [communityEnabled, setCommunityEnabled] = useState(true);
  const [eventEnabled, setEventEnabled] = useState(false);

  useEffect(() => {
    if (open) {
      setPushEnabled(localStorage.getItem('notify_push') !== 'false');
      setCommunityEnabled(localStorage.getItem('notify_community') !== 'false');
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
      <div className="bg-white rounded-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold">알림 설정</h3>
          <button onClick={onClose} className="p-1 text-gray-400"><X size={20} /></button>
        </div>
        <div className="space-y-4">
          <ToggleRow label="푸시 알림" desc="앱 알림을 받습니다" checked={pushEnabled}
            onChange={v => toggle('notify_push', v, setPushEnabled)} />
          <ToggleRow label="기록장 알림" desc="투약 일정, 기록 알림" checked={communityEnabled}
            onChange={v => toggle('notify_community', v, setCommunityEnabled)} />
          <ToggleRow label="이벤트 알림" desc="이벤트, 프로모션 알림" checked={eventEnabled}
            onChange={v => toggle('notify_event', v, setEventEnabled)} />
        </div>
        <button onClick={onClose} className="w-full h-11 mt-6 bg-blue-600 text-white rounded-lg font-medium">확인</button>
      </div>
    </div>
  );
}

// ─── Events / Coupons Modal ────────────────────────────────
function EventCouponModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  const mockEvents = [
    { id: '1', title: '신규 가입 축하 쿠폰', desc: '첫 진료 10% 할인', expires: '2026-03-31', type: 'coupon' as const },
    { id: '2', title: '봄맞이 건강검진 이벤트', desc: '종합 건강검진 20% 할인', expires: '2026-04-30', type: 'event' as const },
    { id: '3', title: '친구 초대 리워드', desc: '친구 1명 초대 시 5,000원 쿠폰', expires: '2026-12-31', type: 'coupon' as const },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4">
          <h3 className="text-lg font-bold">이벤트 / 쿠폰함</h3>
          <button onClick={onClose} className="p-1 text-gray-400"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
          {mockEvents.map(evt => (
            <div key={evt.id} className="p-4 border border-gray-100 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  evt.type === 'coupon' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
                }`}>
                  {evt.type === 'coupon' ? '쿠폰' : '이벤트'}
                </span>
                <span className="text-xs text-gray-400">~{evt.expires}</span>
              </div>
              <p className="font-medium text-gray-900">{evt.title}</p>
              <p className="text-sm text-gray-500">{evt.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── App Settings Modal ────────────────────────────────────
function AppSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [darkMode, setDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');

  useEffect(() => {
    if (open) {
      setDarkMode(localStorage.getItem('app_darkmode') === 'true');
      setFontSize((localStorage.getItem('app_fontsize') as 'small' | 'medium' | 'large') || 'medium');
    }
  }, [open]);

  if (!open) return null;

  const handleDarkMode = (value: boolean) => {
    setDarkMode(value);
    localStorage.setItem('app_darkmode', String(value));
  };

  const handleFontSize = (size: 'small' | 'medium' | 'large') => {
    setFontSize(size);
    localStorage.setItem('app_fontsize', size);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold">앱 설정</h3>
          <button onClick={onClose} className="p-1 text-gray-400"><X size={20} /></button>
        </div>
        <div className="space-y-5">
          <ToggleRow label="다크 모드" desc="어두운 테마를 사용합니다" checked={darkMode} onChange={handleDarkMode} />
          <div>
            <p className="text-sm font-medium text-gray-900 mb-2">글꼴 크기</p>
            <div className="flex gap-2">
              {([['small', '작게'], ['medium', '보통'], ['large', '크게']] as const).map(([size, label]) => (
                <button
                  key={size}
                  onClick={() => handleFontSize(size)}
                  className={`flex-1 h-10 rounded-lg border text-sm font-medium ${
                    fontSize === size ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="w-full h-11 mt-6 bg-blue-600 text-white rounded-lg font-medium">확인</button>
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
  const [showEventModal, setShowEventModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  const handleSaveNickname = async (nickname: string) => {
    await updateProfile({ nickname });
  };

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-gray-500">로딩 중...</div>
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
          onClick={() => setShowEventModal(true)}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
        >
          <div className="flex items-center gap-3 text-gray-700">
            <Gift size={20} />
            <span>이벤트 / 쿠폰함</span>
          </div>
          <ChevronRight size={16} className="text-gray-400" />
        </button>
      </div>

      <div className="bg-white border-t border-b border-gray-100">
        <button
          onClick={() => setShowSettingsModal(true)}
          className="w-full p-4 border-b border-gray-50 flex items-center justify-between hover:bg-gray-50"
        >
          <div className="flex items-center gap-3 text-gray-700">
            <Settings size={20} />
            <span>앱 설정</span>
          </div>
          <ChevronRight size={16} className="text-gray-400" />
        </button>
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
      <EventCouponModal
        open={showEventModal}
        onClose={() => setShowEventModal(false)}
      />
      <AppSettingsModal
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </div>
  );
}
