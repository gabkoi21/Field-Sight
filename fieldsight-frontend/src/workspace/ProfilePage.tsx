import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BarChart3, LockKeyhole, Save } from "lucide-react";
import { Button, LoadingState } from "../components/ui";
import { apiClient } from "../services/apiClient";
import { useAuth } from "../auth/AuthContext";
import { Field, Notice, Page, Panel, fieldClass } from "./WorkspaceUI";

export function ProfilePage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: apiClient.profile,
  });
  const [name, setName] = useState("");
  const [landing, setLanding] = useState("/projects");
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (profile.data) {
      setName(profile.data.full_name ?? "");
      setLanding(profile.data.landing_page);
    }
  }, [profile.data]);
  const save = useMutation({
    mutationFn: () =>
      apiClient.saveProfile({
        email: profile.data!.email,
        full_name: name || null,
        landing_page: landing,
      }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["profile"] });
      setMessage("Profile and landing page saved.");
    },
  });
  const change = useMutation({
    mutationFn: () => apiClient.changePassword(current, password),
    onSuccess: async () => {
      try {
        await logout();
      } finally {
        navigate("/login", { replace: true });
      }
    },
  });
  return (
    <Page
      title="Profile & security"
      description="Manage your personal details and account preferences."
    >
      {message && <Notice>{message}</Notice>}
      {[profile.error, save.error, change.error]
        .filter(Boolean)
        .map((error, i) => (
          <Notice error key={i}>
            {error?.message}
          </Notice>
        ))}
      {profile.isFetching && profile.data && <LoadingState variant="inline" label="Updating profile…" />}
      {profile.error && <Button variant="secondary" onClick={() => void profile.refetch()}>Retry profile</Button>}
      {profile.isLoading ? (
        <LoadingState variant="panel" label="Loading profile…" />
      ) : profile.error && !profile.data ? null : (
        <div className="grid grid-cols-2 items-start gap-5 max-lg:grid-cols-1">
          <Panel className="p-6">
            <h2 className="mb-5 mt-0 text-base font-semibold">
              Profile & landing page
            </h2>
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <Field label="Email">
                <input
                  className={fieldClass}
                  value={profile.data?.email ?? ""}
                  readOnly
                />
              </Field>
              <Field label="Full name">
                <input
                  className={fieldClass}
                  value={name}
                  maxLength={200}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="Open after sign-in">
                <select
                  className={fieldClass}
                  value={landing}
                  onChange={(e) => setLanding(e.target.value)}
                >
                  {[
                    ["/projects", "Projects"],
                    ["/", "Collection overview"],
                    ["/indicators", "Indicators"],
                    ["/dashboards", "Dashboards"],
                    ["/guide", "Quick-start guide"],
                  ].map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Button type="submit" disabled={save.isPending}>
                <Save size={14} />
                {save.isPending ? "Saving…" : "Save profile"}
              </Button>
            </form>
          </Panel>
          <Panel className="p-6">
            <h2 className="mb-5 mt-0 flex items-center gap-2 text-base font-semibold">
              <LockKeyhole size={18} />
              Change password
            </h2>
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                change.mutate();
              }}
            >
              <Field label="Current password">
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  className={fieldClass}
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                />
              </Field>
              <Field label="New password">
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  className={fieldClass}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <p className="m-0 text-xs leading-5 text-[#87969d]">
                Use at least eight characters. Changing your password signs out
                your existing sessions.
              </p>
              <Button type="submit" disabled={change.isPending}>
                {change.isPending
                  ? "Updating…"
                  : "Update password and sign out"}
              </Button>
            </form>
            <p className="mb-0 mt-6 border-t border-[#e4ebed] pt-4 text-xs leading-5 text-[#87969d]">
              Authenticator and organization SSO policies are not configured in
              this local application.
            </p>
          </Panel>
        </div>
      )}
    </Page>
  );
}

export function AcceptInvitationPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const accept = useMutation({
    mutationFn: () =>
      apiClient.acceptInvitation({ token, full_name: name, password }),
  });
  return (
    <div className="grid min-h-screen place-items-center bg-[#f5f7f8] p-5">
      <Panel className="w-full max-w-md p-7">
        <Link
          to="/login"
          className="mb-6 flex items-center gap-2 text-lg font-bold text-[#17374d] no-underline"
        >
          <BarChart3 className="text-[#168596]" />
          FieldSight
        </Link>
        <h1 className="text-2xl font-semibold">
          {accept.isSuccess
            ? "Your account is ready"
            : "Join your organization"}
        </h1>
        {accept.isSuccess ? (
          <>
            <Notice>
              {accept.data.role === "organization_admin"
                ? `Account created for ${accept.data.email}. Sign in to continue.`
                : `Team membership created for ${accept.data.email}. Field staff collect through KoboToolbox; this FieldSight portal is for administrators. A Kobo account is managed separately.`}
            </Notice>
            <Link
              className="mt-5 inline-block text-sm text-[#168596]"
              to="/login"
            >
              Return to sign in →
            </Link>
          </>
        ) : token ? (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              accept.mutate();
            }}
          >
            <p className="text-sm leading-6 text-[#87969d]">
              Set your own password to accept this invitation. Setup links
              expire after seven days.
            </p>
            {accept.error && <Notice error>{accept.error.message}</Notice>}
            <Field label="Full name">
              <input
                required
                minLength={2}
                maxLength={200}
                className={fieldClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Create password">
              <input
                required
                minLength={8}
                maxLength={128}
                type="password"
                autoComplete="new-password"
                className={fieldClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Button type="submit" disabled={accept.isPending}>
              {accept.isPending ? "Creating account…" : "Accept invitation"}
            </Button>
          </form>
        ) : (
          <p className="text-sm leading-7 text-[#73868d]">
            Ask your organization administrator for a new invitation link. Open
            that complete link to choose your password and create an account.
          </p>
        )}
      </Panel>
    </div>
  );
}

export function AccountHelpPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f5f7f8] p-5">
      <Panel className="max-w-lg p-7">
        <h1 className="text-2xl font-semibold">Help signing in</h1>
        <p className="text-sm leading-7 text-[#73868d]">
          Use your invited email address or username. If your invitation
          expired, ask your organization administrator to create a new setup
          link. For an existing account with a forgotten password, contact your
          administrator; automated recovery email is not configured in this
          local application.
        </p>
        <Link to="/login" className="text-sm text-[#168596]">
          Return to sign in →
        </Link>
      </Panel>
    </div>
  );
}
