import { useEffect, useRef, useState, type FormEvent } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";
import { ApiError } from "../../services/apiClient";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [usernameActive, setUsernameActive] = useState(false);
  const [passwordActive, setPasswordActive] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    function clearLogin() {
      form.current?.reset();
      setUsername("");
      setPassword("");
      setShowPassword(false);
      setRemember(false);
      setUsernameActive(false);
      setPasswordActive(false);
    }
    clearLogin();
    window.addEventListener("pageshow", clearLogin);
    return () => window.removeEventListener("pageshow", clearLogin);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const user = await login(username.trim(), password, remember);

      navigate(
        user.platform_role === "super_admin"
          ? "/superadmin"
          : "/dashboard",
        { replace: true },
      );
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to connect to FieldSight.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "mt-1.5 block h-10 w-full rounded-lg border border-[#d7e0ea] bg-[#fbfcfe] px-3 text-sm text-ink outline-none transition-colors hover:border-[#b9c8db] focus:border-[#0b51b7] focus:bg-white focus:ring-2 focus:ring-blue-100";

  return (
    <div className="fs-login-page grid min-h-screen grid-cols-2 bg-white max-[700px]:grid-cols-1">
      <form
        ref={form}
        className="m-auto w-[min(360px,calc(100%_-_40px))] py-8"
        onSubmit={handleSubmit}
        autoComplete="off"
      >
        <NavLink
          to="/"
          className="inline-block max-w-full pb-9 text-lg font-bold tracking-[-.25px] text-[#102a43] no-underline max-[700px]:pb-7"
        >
          FieldSight
        </NavLink>

        <p className="mb-1.5 text-[12px] font-bold uppercase leading-[1.4] tracking-[.08em] text-brand">
          WELCOME BACK
        </p>

        <h1 className="m-0 text-2xl font-semibold leading-tight tracking-tight">
          Sign in to your project
        </h1>

        <p className="mb-5 mt-2 text-[13px] leading-5 text-[#64748b]">
          Manage trusted data from collection through reporting.
        </p>

        <label className="mt-4 block text-xs font-medium text-[#485767]">
          Email or username
          <input
            className={inputClass}
            type="text"
            readOnly={!usernameActive}
            onFocus={() => setUsernameActive(true)}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="off"
          />
        </label>

        <div className="mt-4">
          <label htmlFor="login-password" className="block text-xs font-medium text-[#485767]">Password</label>
          <div className="relative">
            <input
              id="login-password"
              className={`${inputClass} pr-11`}
              type={showPassword ? "text" : "password"}
              readOnly={!passwordActive}
              onFocus={() => setPasswordActive(true)}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
            <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} aria-controls="login-password" onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-[#64748b] hover:text-[#0b51b7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0b51b7]">
              {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {error && (
          <p
            className="mt-[14px] text-[14px] font-medium text-[#b42318]"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="my-3 flex min-h-8 items-center justify-between gap-3">
          <label className="m-0 inline-flex min-h-8 items-center gap-2 text-xs text-[#64748b]">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />{" "}
            Remember me
          </label>

          <NavLink
            className="text-xs font-bold no-underline text-brand"
            to="/account-help"
          >
            Forgot password?
          </NavLink>
        </div>

        <Button
          className="w-full justify-center !min-h-10 !rounded-lg !py-2 !text-[13px]"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Signing in..." : "Sign in"}
        </Button>

        <p className="mb-0 mt-4 text-center text-xs text-[#64748b]">
          Need access?{" "}
          <NavLink
            className="font-bold no-underline text-brand"
            to="/accept-invitation"
          >
            Accept an invitation
          </NavLink>
        </p>
      </form>

      <div className="flex flex-col justify-between bg-[linear-gradient(145deg,#071f47,#0b51b7)] px-[88px] py-[74px] text-white max-[700px]:hidden">
        <div className="m-auto max-w-[480px]">
          <span className="font-serif text-[70px] text-[#8db6f5]">“</span>

          <h2 className="m-0 text-[34px] font-bold leading-[1.25] tracking-[-1px] text-white">
            Bring every collection workflow into one trustworthy data project.
          </h2>

          <p className="max-w-[410px] leading-[1.7] text-[#dfeaf4]">
            Monitor progress, resolve quality issues, and turn field data into
            decisions.
          </p>
        </div>

        <small className="text-[12px] tracking-[1.1px] text-[#8aa9ba]">
          FIELDSIGHT · DATA OPERATIONS
        </small>
      </div>
    </div>
  );
}
