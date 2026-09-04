import React from 'react';
import { Student, UserSession, AppViewRoute } from '../types';
import { soundEffects } from '../services/soundEffects';
import { authService } from '../services/authService';
import { PathanaShakthiLogo } from './PathanaShakthiLogo';
import {
  Home,
  BookOpen,
  GraduationCap,
  School,
  Star,
  Flame,
  Wifi,
  Volume2,
  VolumeX,
  User,
  LogOut,
  LogIn,
  Mic,
} from 'lucide-react';

interface NavbarProps {
  currentRoute: AppViewRoute;
  onNavigate: (route: AppViewRoute) => void;
  session: UserSession | null;
  student: Student;
  onOpenOfflineModal: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRoute,
  onNavigate,
  session,
  student,
  onOpenOfflineModal,
  onOpenProfile,
  onLogout,
}) => {
  const [isMuted, setIsMuted] = React.useState(soundEffects.getMuted());

  const handleToggleMute = () => {
    const muted = soundEffects.toggleMute();
    setIsMuted(muted);
    if (!muted) soundEffects.playWordPop();
  };

  const navLinks: { id: AppViewRoute; label: string; icon: any }[] = [
    { id: 'landing', label: 'Home', icon: Home },
    { id: 'student_library', label: 'Student Portal', icon: BookOpen },
    { id: 'voice_setup', label: 'Voice Setup', icon: Mic },
    { id: 'faculty_dashboard', label: 'Faculty Room', icon: GraduationCap },
    { id: 'school_admin', label: 'School Admin', icon: School },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#fdfcf6]/95 backdrop-blur-md border-b border-[#e8e4d8] px-3 sm:px-6 py-2.5 select-none font-sans" id="app-navbar">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              soundEffects.playPageTurn();
              onNavigate('landing');
            }}
            className="cursor-pointer group flex items-center bg-transparent border-0 text-left p-0"
          >
            <PathanaShakthiLogo size="md" showSubtitle={false} />
          </button>

          {/* Desktop Full-Page Navigation Links */}
          <nav className="hidden lg:flex items-center bg-[#f4f1e8] p-1 rounded-2xl border border-[#e5e1d5] ml-3 space-x-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = currentRoute === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    soundEffects.playPageTurn();
                    onNavigate(item.id);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-stone-950 shadow-2xs font-black'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                  }`}
                  id={`nav-link-${item.id}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Gamification Badges, Offline Status, Audio & Session / Login */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Offline Sync Status Button */}
          <button
            type="button"
            onClick={onOpenOfflineModal}
            id="btn-navbar-offline-status"
            className="flex items-center gap-1.5 bg-[#edf9f2] hover:bg-[#e1f5e9] border border-[#c4ebd1] text-emerald-950 px-2.5 py-1 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
            title="Rural Offline Status & Sync"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Offline Ready</span>
            <Wifi className="w-3.5 h-3.5 text-emerald-700" />
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={handleToggleMute}
            className="p-2 bg-[#f4f1e8] hover:bg-[#eae5d8] border border-[#e5e1d5] text-stone-700 rounded-xl transition-all cursor-pointer"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-stone-400" /> : <Volume2 className="w-4 h-4 text-amber-700" />}
          </button>

          {/* Student Stars & Streak (if on student page or logged in as student) */}
          {currentRoute === 'student_library' && (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 bg-[#fff8e6] text-[#6b4e05] font-black text-xs px-2.5 py-1 rounded-xl border border-[#fae2a0] shadow-2xs">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                <span>{student.stars}</span>
              </div>

              <div className="flex items-center gap-1 bg-[#fff1ec] text-[#852a12] font-black text-xs px-2 py-1 rounded-xl border border-[#ffd2c4] shadow-2xs">
                <Flame className="w-3.5 h-3.5 fill-orange-400 text-orange-500" />
                <span>{student.streakDays}d</span>
              </div>
            </div>
          )}

          {/* User Session Profile & Role Indicator */}
          {session ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenProfile}
                id="btn-navbar-student-profile"
                className="flex items-center gap-1.5 bg-[#f4f1e8] hover:bg-[#eae5d8] p-1 sm:pr-2.5 rounded-2xl transition-all border border-[#e5e1d5] cursor-pointer"
                title="View Profile & Reading Progress"
              >
                <div className="text-xl p-0.5">{session.avatar || student.avatar}</div>
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-black text-[#2d2d2d] leading-none truncate max-w-[100px]">
                    {session.name.split(' ')[0]}
                  </p>
                  <span className="text-[9px] font-bold text-amber-800 uppercase leading-none">
                    {session.role}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="p-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl transition-all cursor-pointer"
                title="Sign Out of Session"
                id="btn-navbar-logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                soundEffects.playWordPop();
                onNavigate('login');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs shadow-2xs transition-all cursor-pointer"
              id="btn-navbar-login"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="lg:hidden mt-2 pt-2 border-t border-[#e8e4d8] flex items-center justify-around gap-1 overflow-x-auto">
        {navLinks.map((item) => {
          const Icon = item.icon;
          const isActive = currentRoute === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                soundEffects.playPageTurn();
                onNavigate(item.id);
              }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-amber-500 text-stone-950 font-black'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
