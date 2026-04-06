import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(238,242,255,0.9),_transparent_34%),_linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] pb-24">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pt-10 md:px-8 lg:px-12">
        <div className="mb-8 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-full bg-white/90 p-3 shadow-lg backdrop-blur-sm hover:bg-white transition">
            Back
          </button>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">Sign Up</h1>
            <p className="text-sm text-slate-600">Simple signup with mobile number and name.</p>
          </div>
        </div>

        <div className="rounded-[40px] bg-white/95 p-8 shadow-2xl backdrop-blur-sm md:p-12">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Name</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Aapka naam"
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Mobile Number</label>
              <input
                value={mobile}
                onChange={(event) => setMobile(event.target.value)}
                placeholder="1234567890"
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 text-lg font-semibold text-white shadow-xl transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Signing up..." : "Create Account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Already registered?{' '}
            <Link to="/signin" className="font-semibold text-orange-600 hover:underline">Sign in here</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
