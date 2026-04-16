import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Heart, Sparkles } from "lucide-react";

const SignIn = () => {
  const navigate = useNavigate();
  const { signin } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      await signin(name, mobile);
      toast({ title: "Sign in successful", description: "Aap ab Yaara ke saath jud gaye hain." });
      navigate("/");  // Redirect to homepage
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sign in failed.";
      toast({ variant: "destructive", title: "Sign In Error", description: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Premium Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[20%] w-[50%] h-[50%] bg-blue-500/8 rounded-full blur-[140px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[45%] h-[45%] bg-amber-500/6 rounded-full blur-[140px]" />
        <div className="absolute top-[30%] right-[30%] w-[25%] h-[25%] bg-indigo-500/4 rounded-full blur-[100px]" />
      </div>
      
      <div className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 pt-10 md:px-8 lg:px-12">
        <div className="mb-8 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-slate-400 hover:text-amber-50 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 border border-blue-500/20 px-3 py-1 text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">
               <Sparkles className="h-3 w-3" /> Welcome Back
            </div>
            <h1 className="text-3xl font-black text-amber-50">Sign In</h1>
            <p className="text-base text-slate-400 font-medium">Login with your name and mobile number.</p>
          </div>
        </div>

        <div className="rounded-[32px] glass-card-premium p-8 md:p-12">
          {/* Logo area */}
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20">
              <Heart className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-black text-amber-50">Hey Yaara</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-400 uppercase tracking-widest">Name</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Aapka naam"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-lg font-bold text-amber-50 placeholder:text-slate-600 outline-none transition focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/20 focus:bg-white/8"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-400 uppercase tracking-widest">Mobile Number</label>
              <input
                value={mobile}
                onChange={(event) => setMobile(event.target.value)}
                placeholder="1234567890"
                inputMode="numeric"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-lg font-bold text-amber-50 placeholder:text-slate-600 outline-none transition focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/20 focus:bg-white/8"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-5 text-lg font-black text-white shadow-xl shadow-blue-500/20 transition hover:shadow-blue-500/30 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-base text-slate-400">
            Naya user?{' '}
            <Link to="/signup" className="font-bold text-amber-400 hover:text-amber-300 transition-colors">Create account</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
