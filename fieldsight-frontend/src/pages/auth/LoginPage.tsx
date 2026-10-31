import { useEffect, useRef, useState, type FormEvent } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";
import { ApiError, apiClient } from "../../services/apiClient";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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

      const profile =
        user.platform_role === "super_admin"
          ? null
          : await apiClient.profile().catch(() => null);
      const allowed = [
        "/",
        "/projects",
        "/indicators",
        "/dashboards",
        "/guide",
      ];
      navigate(
        user.platform_role === "super_admin"
          ? "/superadmin"
          : profile && allowed.includes(profile.landing_page)
            ? profile.landing_page
            : "/projects",
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
    "mt-2 block w-full rounded-[7px] border border-[#dfe4e8] p-3 text-sm text-ink outline-none transition-colors focus:border-[#aeb8c4] focus:ring-0 focus:shadow-none";

  return (
    <div className="fs-login-page grid min-h-screen grid-cols-2 bg-white max-[700px]:grid-cols-1">
      <form
        ref={form}
        className="m-auto w-[min(420px,calc(100%_-_48px))]"
        onSubmit={handleSubmit}
        autoComplete="off"
      >
        <NavLink
          to="/"
          className="inline-block max-w-full pb-[62px] text-[19px] font-bold tracking-[-.25px] text-[#102a43] no-underline max-[700px]:pb-[42px]"
        >
          FieldSight
        </NavLink>

        <p className="mb-1.5 text-[12px] font-bold uppercase leading-[1.4] tracking-[.08em] text-brand">
          WELCOME BACK
        </p>

        <h1 className="m-0 text-[2rem] font-bold tracking-[-0.05em]">
          Sign in to your project
        </h1>

        <p className="mt-[7px] max-w-[680px] text-[0.875rem] leading-[1.55] text-[#758092]">
          Manage trusted data from collection through reporting.
        </p>

        <label className="mt-[22px] block text-xs text-[#485767]">
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

        <label className="mt-[22px] block text-xs text-[#050606]">
          Password
          <input
            className={inputClass}
            type="password"
            readOnly={!passwordActive}
            onFocus={() => setPasswordActive(true)}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
        </label>

        {error && (
          <p
            className="mt-[14px] text-[14px] font-medium text-[#b42318]"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="my-[17px] flex items-center justify-between">
          <label className="m-0 text-xs text-[#758092]">
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
          className="justify-center w-full"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Signing in..." : "Sign in"}
        </Button>

        <p className="text-center text-xs text-[#758092]">
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
