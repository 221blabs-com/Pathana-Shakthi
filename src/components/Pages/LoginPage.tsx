import React, { useEffect, useState } from 'react';
import { UserRole, UserSession } from '../../types';
import { authService, DEMO_USERS } from '../../services/authService';
import { REAL_STUDENTS } from '../../data/studentsData';
import { REAL_FACULTY_MEMBERS } from '../../data/facultyData';
import { soundEffects } from '../../services/soundEffects';
import { PathanaShakthiLogo } from '../PathanaShakthiLogo';
import {
  User,
  GraduationCap,
  School,
  Lock,
  ArrowRight,
  Sparkles,
  Check,
  AlertCircle,
  BookOpen,
} from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (session: UserSession) => void;
  onNavigate: (route: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onNavigate }) => {
  // The landing-page role cards store the requested login role here.
  // If /login is opened directly, student remains the default.
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(REAL_STUDENTS[0].id);

  useEffect(() => {
    const pendingRole = sessionStorage.getItem('pathanaShakthiLoginRole');

    if (
      pendingRole === 'student' ||
      pendingRole === 'faculty' ||
      pendingRole === 'admin'
    ) {
      setSelectedRole(pendingRole as UserRole);

      // Consume it so refreshing /login does not keep forcing the role.
      sessionStorage.removeItem('pathanaShakthiLoginRole');
    }
  }, []);
  const [emailOrRoll, setEmailOrRoll] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleStudentQuickSelect = (studentId: string) => {
    soundEffects.playWordPop();
    setSelectedStudentId(studentId);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    soundEffects.playWordPop();

    if (selectedRole === 'student') {
      const session = authService.loginAsStudent(selectedStudentId);
      soundEffects.playStarChime();
      onLoginSuccess(session);
      onNavigate('student_library');
      return;
    }

    if (selectedRole === 'faculty') {
      const faculty = REAL_FACULTY_MEMBERS.find((f) => f.id === emailOrRoll) || REAL_FACULTY_MEMBERS[0];
      const res = authService.loginWithCredentials(faculty.email, password || 'password', 'faculty');
      if (res.success && res.session) {
        soundEffects.playStarChime();
        onLoginSuccess(res.session);
        onNavigate('faculty_dashboard');
      } else {
        setErrorMsg(res.error || 'Failed to login.');
      }
      return;
    }

    if (selectedRole === 'admin') {
      const res = authService.loginWithCredentials(emailOrRoll || 'admin@school.gov.in', password || 'admin123', 'admin');
      if (res.success && res.session) {
        soundEffects.playStarChime();
        onLoginSuccess(res.session);
        onNavigate('school_admin');
      } else {
        setErrorMsg(res.error || 'Failed to login as Administrator.');
      }
      return;
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
        <div className="flex justify-center">
          <PathanaShakthiLogo size="lg" />
        </div>
        <h2 className="text-2xl font-black text-stone-900">
          Sign In to Your Workspace
        </h2>
        <p className="text-xs sm:text-sm text-stone-600">
          Select your school role to access reading, classroom analytics, or school administration.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-6 shadow-xl rounded-3xl sm:px-10 border border-stone-200">
          {/* Role Selection Tabs */}
          <div className="flex rounded-2xl bg-stone-100 p-1.5 mb-6 border border-stone-200">
            <button
              type="button"
              onClick={() => {
                soundEffects.playWordPop();
                setSelectedRole('student');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                selectedRole === 'student'
                  ? 'bg-amber-500 text-stone-950 shadow-xs font-black'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              id="tab-login-student"
            >
              <User className="w-3.5 h-3.5" />
              <span>Student (విద్యార్థి)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEffects.playWordPop();
                setSelectedRole('faculty');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                selectedRole === 'faculty'
                  ? 'bg-amber-500 text-stone-950 shadow-xs font-black'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              id="tab-login-faculty"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Faculty (ఉపాధ్యాయులు)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEffects.playWordPop();
                setSelectedRole('admin');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                selectedRole === 'admin'
                  ? 'bg-amber-500 text-stone-950 shadow-xs font-black'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              id="tab-login-admin"
            >
              <School className="w-3.5 h-3.5" />
              <span>Admin (ప్రధానోపాధ్యాయులు)</span>
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-5">
            {/* Student Mode: Quick Profile Picker */}
            {selectedRole === 'student' && (
              <div className="space-y-3">
                <label className="block text-xs font-black uppercase text-stone-600">
                  Select Enrolled Student Profile:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                  {REAL_STUDENTS.map((student) => {
                    const isSelected = selectedStudentId === student.id;
                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => handleStudentQuickSelect(student.id)}
                        className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-50 border-amber-500 shadow-2xs ring-2 ring-amber-400'
                            : 'bg-white border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-xl shrink-0">
                          {student.avatar}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-stone-900 truncate">
                            {student.name}
                          </p>
                          <p className="text-[10px] text-stone-500">
                            {student.grade} • {student.rollNumber}
                          </p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Faculty Mode: Faculty Member Selector */}
            {selectedRole === 'faculty' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase text-stone-600 mb-1">
                    Select Faculty Teacher:
                  </label>
                  <select
                    value={emailOrRoll || REAL_FACULTY_MEMBERS[0].id}
                    onChange={(e) => setEmailOrRoll(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs font-semibold text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  >
                    {REAL_FACULTY_MEMBERS.map((fac) => (
                      <option key={fac.id} value={fac.id}>
                        {fac.name} — {fac.designation}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-stone-600 mb-1">
                    Faculty Access PIN / Password:
                  </label>
                  <input
                    type="password"
                    placeholder="Enter teacher PIN (e.g. 1234)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            )}

            {/* School Admin Mode */}
            {selectedRole === 'admin' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs">
                  <p className="font-bold">ZPHS Kothur School Administration</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Managing 148 primary students, reading classrooms, and multilingual story libraries.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-stone-600 mb-1">
                    Headmaster / Admin Email:
                  </label>
                  <input
                    type="email"
                    value={emailOrRoll || 'headmaster.kothur@tg.gov.in'}
                    onChange={(e) => setEmailOrRoll(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-stone-600 mb-1">
                    Admin Password:
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            )}

            {/* Submit Action */}
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-sm shadow-md transition-all cursor-pointer mt-6"
              id="btn-login-submit"
            >
              <span>
                Enter {selectedRole === 'student' ? 'Student Library' : selectedRole === 'faculty' ? 'Faculty Room' : 'Admin Portal'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Back to Landing */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => onNavigate('landing')}
              className="text-xs text-stone-500 hover:text-stone-800 font-semibold cursor-pointer underline"
            >
              ← Back to Main Home Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};