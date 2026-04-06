import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const Profile = () => {
  const navigate = useNavigate();
  const { user, signout } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(232,255,243,0.9),_transparent_34%),_linear-gradient(180deg,#f2fbf5_0%,#e8f7ef_100%)] pb-24">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pt-10 md:px-8 lg:px-12">
        <div className="mb-8 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-full bg-white/90 p-3 shadow-lg backdrop-blur-sm hover:bg-white transition">
            Back
          </button>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">Your Profile</h1>
            <p className="text-sm text-slate-600">Manage your Yaara account details.</p>
          </div>
        </div>

        <div className="rounded-[40px] bg-white/95 p-8 shadow-2xl backdrop-blur-sm md:p-12">
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Name</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{user.name}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Mobile Number</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{user.mobile}</p>
            </div>
            <div className="space-y-4">
              <Button onClick={() => navigate("/dashboard")} className="w-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 text-white">
                Open Dashboard
              </Button>
              <Button onClick={() => navigate("/talk")} className="w-full rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white">
                Talk to Yaara
              </Button>
              <Button variant="secondary" onClick={() => signout()} className="w-full rounded-full border border-slate-300 bg-white text-slate-900">
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
