import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Heart } from "lucide-react";

const SignUp = () => {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      await signup(name, mobile);
      toast({ title: "Signup successful", description: "Welcome to Yaara. Aap ab sign in ho gaye hain." });
      navigate("/profile");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Signup failed.";
      toast({ variant: "destructive", title: "Signup Error", description: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[10%] w-[40%] h-[40%] bg-amber-500/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-[20%] left-[5%] w-[35%] h-[35%] bg-orange-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 pt-10 md:px-8 lg:px-12">
        <div className="mb-8 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-slate-400 hover:text-amber-50 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-amber-50">Sign Up</h1>
            <p className="text-base text-slate-400 font-medium">Simple signup with mobile number and name.</p>
          </div>
        </div>

        <div className="rounded-[32px] glass-card p-8 md:p-12">
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
              className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-5 text-lg font-black text-white shadow-xl shadow-amber-500/20 transition hover:shadow-amber-500/30 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? "Signing up..." : "Create Account"}
            </button>
          </form>

          <p className="mt-6 text-center text-base text-slate-400">
            Already registered?{' '}
            <Link to="/signin" className="font-bold text-amber-400 hover:text-amber-300 transition-colors">Sign in here</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
