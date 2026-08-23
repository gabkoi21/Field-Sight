import { useState, type FormEvent } from "react";
import { BarChart3 } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui";

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (username === "Admin" && password === "12345") {
      navigate("/superadmin");
      return;
    }
    if (username === "Manager" && password === "12345") {
      navigate("/");
      return;
    }
    setError("Invalid username or password");
  }

  const inputClass =
    "mt-2 block w-full rounded-[7px] border border-[#dfe4e8] p-3 text-sm text-ink outline-none focus:border-[#aeb8c4] focus:shadow-[0_0_0_3px_rgba(115,128,145,.10)]";

  return (
    <div className="grid min-h-screen grid-cols-2 bg-white max-[700px]:grid-cols-1">
      <form className="m-auto w-[min(420px,calc(100%_-_48px))]" onSubmit={handleSubmit}>
        <NavLink
          to="/"
          className="inline-block pb-[62px] text-[19px] font-bold tracking-[-.25px] text-[#102a43] no-underline max-[700px]:pb-[42px]"
        >
          <b className="mr-[9px] inline-grid size-[30px] place-items-center rounded-[7px] bg-brand text-white shadow-[inset_0_0_0_1px_#ffffff20]">
            <BarChart3 className="stroke-2" size={16} />
          </b>
          <span className="leading-none">FieldSight</span>
        </NavLink>
        <p className="mb-1.5 text-[11px] font-bold uppercase leading-[1.4] tracking-[.08em] text-brand">WELCOME BACK</p>
        <h1 className="m-0 text-[30px] font-bold tracking-[-1px]">Sign in to your workspace</h1>
        <p className="mt-[7px] max-w-[680px] text-sm leading-[1.55] text-[#758092]">
          Manage trusted data from collection through reporting.
        </p>
        <label className="mt-[22px] block text-xs font-bold text-[#485767]">
          Username
          <input
            className={inputClass}
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Admin or Manager"
            autoComplete="username"
            autoFocus
          />
        </label>
        <label className="mt-[22px] block text-xs font-bold text-[#485767]">
          Password
          <input
            className={inputClass}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </label>
        {error && (
          <p className="mt-[14px] text-[13px] font-medium text-[#b42318]" role="alert">
            {error}
          </p>
        )}
        <div className="my-[17px] flex items-center justify-between">
          <label className="m-0 text-xs text-[#758092]">
            <input type="checkbox" /> Remember me
          </label>
          <a className="text-xs font-bold no-underline text-brand" href="#">
            Forgot password?
          </a>
        </div>
        <Button className="justify-center w-full" type="submit">
          Sign in
        </Button>
        <p className="text-center text-xs text-[#758092]">
          Need access?{" "}
          <a className="font-bold no-underline text-brand" href="#">
            Accept an invitation
          </a>
        </p>
      </form>
      <div className="flex flex-col justify-between bg-[linear-gradient(145deg,#071f47,#0b51b7)] px-[88px] py-[74px] text-white max-[700px]:hidden">
        <div className="m-auto max-w-[480px]">
          <span className="font-serif text-[70px] text-[#8db6f5]">“</span>
          <h2 className="m-0 text-[34px] font-bold leading-[1.25] tracking-[-1px]">
            Bring every collection workflow into one trustworthy data workspace.
          </h2>
          <p className="max-w-[410px] leading-[1.7] text-[#b8cedb]">
            Monitor progress, resolve quality issues, and turn field data into decisions.
          </p>
        </div>
        <small className="text-[10px] tracking-[1.1px] text-[#8aa9ba]">FIELDSIGHT · DATA OPERATIONS</small>
      </div>
    </div>
  );
}
