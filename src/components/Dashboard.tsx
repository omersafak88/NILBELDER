import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, MessageCircle, User, Users, LogOut, Menu, X,
  ChevronDown, Wallet, List, Settings, Mail, FileText, PieChart
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// Bileşen Importları
import MemberManagement from './MemberManagement';
import MemberLedger from './MemberLedger';
import DuesManagement from './DuesManagement';
import TransactionsLedger from './TransactionsLedger';
import Announcements from './Announcements';
import FreeForum from './FreeForum';
import Messages from './Messages';
import CategoriesManagement from './CategoriesManagement';
import EmailManagement from './EmailManagement';
import Profile from './Profile';
import NewDashboard from './NewDashboard'; 
import MemberFinancials from './MemberFinancials';
import RequestsActivities from './RequestsActivities';

interface DashboardProps {
  session: any;
  onLogout: () => void;
}

export default function Dashboard({ session, onLogout }: DashboardProps) {
  // Başlangıçta ekran genişliğine göre sidebar durumunu belirle
  const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [activeView, setActiveView] = useState<string>('overview');
  const [openMenus, setOpenMenus] = useState({ account: true, admin: true });
  const [isAdmin, setIsAdmin] = useState(false);

  const user = session?.user || session;
  const currentMemberId = user?.id;
  const currentMemberName = (user?.full_name || 'Kullanıcı').toUpperCase();

  useEffect(() => {
    // Ekran boyutu değiştiğinde otomatik ayarlama (Opsiyonel)
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    window.addEventListener('resize', handleResize);
    if (!currentMemberId) return; 

    const initializeDashboard = async () => {
      await checkAdminStatus();
    };
    initializeDashboard();

    return () => window.removeEventListener('resize', handleResize);
  }, [currentMemberId]);

  async function checkAdminStatus() {
    try {
      const { data } = await supabase
        .from('admin_users')
        .select('role')
        .eq('member_id', currentMemberId)
        .maybeSingle();
      
      setIsAdmin(!!data);
    } catch (err) {
      console.error("Yetki kontrolü hatası:", err);
    }
  }

  // Mobil cihazda bir menüye tıklandığında sidebar'ı otomatik kapat
  const handleNavClick = (view: string) => {
    setActiveView(view);
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const renderContent = () => {
    if (!currentMemberId) return <div className="p-8 text-center">Yükleniyor...</div>;

    switch (activeView) {
      case 'overview': return <NewDashboard session={session} onLogout={onLogout} />;
      case 'forum': return <FreeForum currentMemberId={currentMemberId} currentMemberName={currentMemberName} isAdmin={isAdmin} />;
      case 'profile': return <Profile member={user} onUpdate={() => {}} />;
      case 'my-debts': return <MemberFinancials memberId={currentMemberId} />;
      case 'messages': return <Messages currentMemberId={currentMemberId} />;
      case 'members': return isAdmin ? <MemberManagement isAdmin={isAdmin} /> : null;
      case 'ledger': return isAdmin ? <MemberLedger isAdmin={isAdmin} /> : null;
      case 'categories': return isAdmin ? <CategoriesManagement isAdmin={isAdmin} /> : null;
      case 'dues': return isAdmin ? <DuesManagement isAdmin={isAdmin} currentMemberId={currentMemberId} /> : null;
      case 'transactions': return isAdmin ? <TransactionsLedger isAdmin={isAdmin} currentMemberId={currentMemberId} /> : null;
      case 'emails': return isAdmin ? <EmailManagement /> : null;
      case 'requests-activities': return isAdmin ? <RequestsActivities isAdmin={isAdmin} currentMemberId={currentMemberId} /> : null;
      default: return <NewDashboard session={session} onLogout={onLogout} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Üst Navigasyon */}
      <nav className="bg-white border-b h-[70px] flex items-center px-6 justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSidebarOpen(!isSidebarOpen)} 
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
              <Users size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight hidden sm:block">NİL-BEL-DER</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-bold text-slate-800 leading-none">{currentMemberName}</p>
            <p className="text-xs text-slate-500 mt-1">{isAdmin ? 'Yönetici' : 'Üye'}</p>
          </div>
          <button onClick={onLogout} className="p-2.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      <div className="flex flex-1 relative">
        {/* Mobil Overlay - Sidebar açıkken arka planı karartır */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Yan Menü (Sidebar) */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          ${isSidebarOpen ? 'shadow-2xl lg:shadow-none' : ''}
          flex flex-col h-full pt-[70px] lg:pt-0
        `}>
          <nav className="py-6 flex flex-col h-full overflow-y-auto">
            <div className="px-4 space-y-1">
              <SidebarBtn 
                active={activeView === 'overview'} 
                icon={LayoutDashboard} 
                label="Genel Bakış" 
                onClick={() => handleNavClick('overview')} 
              />
              <SidebarBtn 
                active={activeView === 'forum'} 
                icon={MessageCircle} 
                label="Serbest Kürsü" 
                onClick={() => handleNavClick('forum')} 
              />
            </div>

            <div className="mt-6">
              <SidebarGroup 
                label="Hesabım" 
                icon={User} 
                isOpen={openMenus.account} 
                onToggle={() => setOpenMenus({...openMenus, account: !openMenus.account})}
              >
                <SubMenuBtn label="Profilim" active={activeView === 'profile'} onClick={() => handleNavClick('profile')} />
                <SubMenuBtn label="Borç Bilgilerim" active={activeView === 'my-debts'} onClick={() => handleNavClick('my-debts')} />
                <SubMenuBtn label="Mesajlarım" active={activeView === 'messages'} onClick={() => handleNavClick('messages')} />
              </SidebarGroup>
            </div>

            {isAdmin && (
              <div className="mt-2">
                <SidebarGroup 
                  label="Yönetim Paneli" 
                  icon={Settings} 
                  isOpen={openMenus.admin} 
                  onToggle={() => setOpenMenus({...openMenus, admin: !openMenus.admin})}
                >
                  <SubMenuBtn label="Üye Listesi" active={activeView === 'members'} onClick={() => handleNavClick('members')} />
                  <SubMenuBtn label="Üye Kütüğü" active={activeView === 'ledger'} onClick={() => handleNavClick('ledger')} />
                  <SubMenuBtn label="Kategori Yönetimi" active={activeView === 'categories'} onClick={() => handleNavClick('categories')} />
                  <SubMenuBtn label="Aidat Tahakkuk" active={activeView === 'dues'} onClick={() => handleNavClick('dues')} />
                  <SubMenuBtn label="Gelir/Gider Girişi" active={activeView === 'transactions'} onClick={() => handleNavClick('transactions')} />
                  <SubMenuBtn label="E-posta İşlemleri" active={activeView === 'emails'} onClick={() => handleNavClick('emails')} />
                  <SubMenuBtn label="Talepler/Faaliyetler" active={activeView === 'requests-activities'} onClick={() => handleNavClick('requests-activities')} />
                </SidebarGroup>
              </div>
            )}
          </nav>
        </aside>

        {/* Ana İçerik */}
        <main className="flex-1 overflow-x-hidden bg-slate-50 p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}

// Stil Yardımcı Bileşenleri
function SidebarBtn({ active, icon: Icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        active 
          ? 'bg-blue-600 text-white shadow-md shadow-blue-100' 
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );
}

function SidebarGroup({ label, icon: Icon, isOpen, onToggle, children }: any) {
  return (
    <div className="px-4">
      <button 
        onClick={onToggle} 
        className="w-full flex items-center justify-between px-4 py-3 text-slate-400 font-semibold text-xs uppercase tracking-wider hover:text-slate-600 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon size={16} />
          <span>{label}</span>
        </div>
        <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && <div className="space-y-1 mt-1">{children}</div>}
    </div>
  );
}

function SubMenuBtn({ label, onClick, active }: any) {
  return (
    <button 
      onClick={onClick} 
      className={`w-full text-left pl-11 py-2.5 rounded-lg text-sm transition-all ${
        active 
          ? 'text-blue-600 bg-blue-50 font-semibold' 
          : 'text-slate-500 hover:text-blue-600 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}