/**
 * Profile.tsx  –  Yaara User Profile
 * 
 * Allows users to manage their personal details.
 * Fields: Name, Age, Gender, Mobile, Email
 */

import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { 
  User, Phone, Mail, Calendar, Users, 
  Save, ArrowLeft, LogOut, ShieldCheck 
} from "lucide-react";
import { cn } from "@/lib/utils";

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, updateUser, signout } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    age: "",
    gender: "",
    mobile: "",
    email: ""
  });

  const [isSaving, setIsSaving] = useState(false);

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "Save karne mein dikkat aayi.";

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        age: user.age || "",
        gender: user.gender || "",
        mobile: user.mobile || "",
        email: user.email || ""
      });
    }
  }, [user]);

  if (!user) return null;

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateUser({
        name: formData.name.trim(),
        age: formData.age.trim(),
        gender: formData.gender,
        email: formData.email.trim()
      });
      toast({
        title: "Profile Updated",
        description: "Aapki jaankari safe save ho gayi hai.",
      });
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(err),
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-orange-100 selection:text-orange-900 pb-32">
      
      {/* ── Background Glow ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-blue-400/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[20%] right-[-10%] w-[35%] h-[40%] bg-orange-400/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-2xl px-4 pt-8 md:px-8">
        
        {/* ── Header ── */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Profile Setup</h1>
            <p className="text-lg font-medium text-slate-500">Apni jaankari yahan bharein</p>
          </div>
          <button
             type="button"
             aria-label="Go back"
             onClick={() => navigate("/")}
             className="h-12 w-12 flex items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors"
          >
             <ArrowLeft className="h-6 w-6" />
          </button>
        </header>

        {/* ── Profile Form ── */}
        <form onSubmit={handleSave} className="space-y-6">
          <div className="rounded-[40px] bg-white p-8 md:p-10 shadow-2xl shadow-slate-200/60 border border-slate-100">
            
            <div className="mb-10 flex items-center gap-4">
               <div className="h-16 w-16 rounded-3xl bg-orange-50 flex items-center justify-center text-orange-500">
                  <User className="h-8 w-8" />
               </div>
               <div>
                  <h2 className="text-2xl font-black text-slate-900">{formData.name || "Your Name"}</h2>
                  <p className="font-bold text-orange-600 flex items-center gap-2">
                     <ShieldCheck className="h-4 w-4" /> Personal Account
                  </p>
               </div>
            </div>

            <div className="grid gap-6">
              
              {/* Name */}
              <div className="space-y-2">
                <label className="text-sm font-black uppercase tracking-widest text-slate-400 ml-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Apna pura naam likhein"
                    required
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 py-4 pl-14 pr-6 font-bold text-slate-900 focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100 transition-all"
                  />
                </div>
              </div>

              {/* Age & Gender Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-black uppercase tracking-widest text-slate-400 ml-1">Age</label>
                  <div className="relative">
                    <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      type="number"
                      value={formData.age}
                      onChange={e => setFormData({ ...formData, age: e.target.value })}
                      placeholder="Age"
                      className="w-full rounded-2xl border border-slate-100 bg-slate-50 py-4 pl-14 pr-6 font-bold text-slate-900 focus:bg-white focus:border-orange-300 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black uppercase tracking-widest text-slate-400 ml-1">Gender</label>
                  <div className="relative">
                    <Users className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <select
                      value={formData.gender}
                      onChange={e => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full rounded-2xl border border-slate-100 bg-slate-50 py-4 pl-14 pr-6 font-bold text-slate-900 focus:bg-white focus:border-orange-300 transition-all appearance-none"
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Mobile (Read Only) */}
              <div className="space-y-2">
                <label className="text-sm font-black uppercase tracking-widest text-slate-400 ml-1">Mobile Number</label>
                <div className="relative opacity-60">
                  <Phone className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="tel"
                    value={formData.mobile}
                    readOnly
                    className="w-full rounded-2xl border border-slate-100 bg-slate-100 py-4 pl-14 pr-6 font-bold text-slate-900 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="text-sm font-black uppercase tracking-widest text-slate-400 ml-1">Email ID</label>
                <div className="relative">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Apna email ID likhein"
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 py-4 pl-14 pr-6 font-bold text-slate-900 focus:bg-white focus:border-orange-300 transition-all"
                  />
                </div>
              </div>

            </div>

            <div className="mt-10 pt-6 border-t border-slate-100">
               <button
                 type="submit"
                 disabled={isSaving}
                 className={cn(
                    "w-full flex items-center justify-center gap-3 rounded-[32px] py-6 text-xl font-black text-white shadow-xl shadow-orange-200 transition-all active:scale-95",
                    isSaving ? "bg-orange-300" : "bg-orange-600 hover:bg-orange-700 hover:-translate-y-1"
                 )}
               >
                 <Save className="h-6 w-6" />
                 {isSaving ? "Saving..." : "Save Profile Details"}
               </button>
            </div>
          </div>
        </form>

        {/* ── Sign Out ── */}
        <div className="mt-8 px-4">
           <button
             onClick={() => signout()}
             className="flex items-center gap-3 text-slate-400 font-bold hover:text-red-500 transition-colors"
           >
             <LogOut className="h-5 w-5" />
             Sign Out from Yaara
           </button>
        </div>

      </div>
    </div>
  );
};

export default Profile;
