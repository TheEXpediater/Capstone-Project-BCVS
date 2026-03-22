// src/pages/LoginPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { login, reset } from "../features/auth/authSlice";
import { FaUser, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import bgImg from ".././assets/images/bg_login.jpg";
import sideImg from ".././assets/images/login_image.png";

export default function LoginPage() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const { email, password } = formData;

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const loadingToastId = useRef(null);  
  const greeted = useRef(false); // prevents double “Welcome back!”

  const { user, isLoading, isError, isSuccess, message } = useSelector(
    (state) => state.auth
  );

  // Clear any stale flags each time this page mounts
  useEffect(() => {
    dispatch(reset());
    return () => dispatch(reset());
  }, [dispatch]);

  // Loading toast while validating
  useEffect(() => {
    if (isLoading) {
      if (!loadingToastId.current) {
        loadingToastId.current = toast.loading("Validating your credentials…", {
          position: "top-center",
        });
      }
    } else if (loadingToastId.current) {
      toast.dismiss(loadingToastId.current);
      loadingToastId.current = null;
    }
  }, [isLoading]);

    useEffect(() => {
    if (isSuccess && user && !greeted.current) {
      greeted.current = true;
      toast.success("Welcome back!");

      const role = String(user.role || "").toLowerCase();

      // 🔹 cashier goes to cashier shell
      if (role === "cashier") {
        navigate("/cashier/drafts");
      } else {
        // existing behaviour for admin/superadmin/developer
        navigate("/loading");
      }
    }
  }, [isSuccess, user, navigate]);
  // Error toast (only for errors)
  useEffect(() => {
    if (isError) toast.error(message || "Login failed");
  }, [isError, message]);

  // Success: only greet when this login just succeeded (not merely because user exists)
  useEffect(() => {
    if (isSuccess && user && !greeted.current) {
      greeted.current = true;
      toast.success("Welcome back!");
      navigate("/loading");
    }
  }, [isSuccess, user, navigate]);

  const onChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const onSubmit = (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    dispatch(login({ email: cleanEmail, password }));
  };

  return (
    <div className="login-page" style={{ backgroundImage: `url(${bgImg})` }}>
      <div className="bg-overlay" />
      <main className="login-shell">
        <section className="login-card">
          <div className="login-left">
            <div className="illustration-wrap">
              <img src={sideImg} alt="Secure sign-in illustration" className="illustration" />
            </div>
          </div>
          <div className="login-right">
            <header className="login-header">
              <div className="accent-bar" />
              <h1>Login Admin User</h1>
            </header>

            <form onSubmit={onSubmit} className="form">
              <label className="field">
                <span className="icon" aria-hidden="true"><FaUser /></span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                  required
                  aria-label="Email address"
                />
              </label>

              <label className="field">
                <span className="icon" aria-hidden="true"><FaLock /></span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))}
                  required
                  aria-label="Password"
                />
                <button
                  type="button"
                  className="toggle"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </label>

              <button
                type="submit"
                className="submit"
                disabled={isLoading || !email.trim() || !password}
              >
                {isLoading ? "VALIDATING…" : "LOGIN"}
              </button>

              <p className="helper">
                <Link to="/reset-password">Forgot password?</Link>
              </p>

            </form>
          </div>
        </section>
      </main>

      <style>{`
        /* Page background */
        .login-page {
          min-height: 100vh;
          width: 100%;
          background-size: cover;
          background-position: center;
          position: relative;
          display: grid;
          place-items: center;
          padding: 24px;
          overflow: hidden;
        }
        .bg-overlay {
          position: absolute;
          inset: 0;
          /* green-tinted overlay */
          background: radial-gradient(80% 80% at 10% 10%, rgba(255,255,255,.1), transparent),
                      radial-gradient(60% 60% at 90% 20%, rgba(255,255,255,.07), transparent),
                      rgba(3, 30, 15, .45);
          backdrop-filter: blur(1.5px);
        }

        /* Shell centers the card and limits width */
        .login-shell {
          position: relative;
          width: 100%;
          max-width: 1120px;
          z-index: 1;
        }

        /* Card split layout */
        .login-card {
          position: relative; /* needed for the center divider */
          display: grid;
          grid-template-columns: 1.05fr 1fr;
          background: #ffffff; /* pure white container */
          border-radius: 24px;
          box-shadow: 0 20px 60px rgba(4, 20, 10, 0.35);
          overflow: hidden;
        }
        /* center divider with 10px gaps top & bottom */
        .login-card::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 40px;
          bottom: 40px; /* 10px gap on both ends */
          width: 1px;
          background: #e5e7eb; /* light gray line */
          transform: translateX(-0.5px); /* keep line crisp */
          pointer-events: none;
        }

        .login-left {
          background: #ffffff; /* white, not gradient */
          padding: 40px 28px;
          display: grid;
          place-items: center;
        }
        .illustration-wrap {
          width: 100%;
          max-width: 520px;
          aspect-ratio: 4 / 3;
          display: grid;
          place-items: center;
        }
        .illustration { width: 88%; height: auto; object-fit: contain; }

        .login-right {
          background: #ffffff; /* white */
          padding: 48px 48px 40px 48px;
        }
        .login-header { margin-bottom: 28px; }
        .login-header h1 {
          font-size: 28px;
          line-height: 1.25;
          margin: 12px 0 0 0;
          color: #052e16; /* deep green text */
          font-weight: 700;
        }
        .accent-bar { width: 38px; height: 6px; border-radius: 999px; background: #16a34a; }

        /* Fields */
        .form { display: grid; gap: 18px; }
        .field { position: relative; display: block; }
        .field input {
          width: 100%;
          padding: 14px 48px 14px 48px;
          border-radius: 999px;
          border: 1px solid #e2e8f0; /* slate-200 */
          background: #ffffff; /* white inputs */
          color: #0f172a;
          outline: none;
          transition: border .2s, box-shadow .2s, background .2s;
          font-size: 15px;
        }
        .field input::placeholder { color: #94a3b8; }
        .field input:focus { border-color: #156f36; box-shadow: 0 0 0 4px rgba(34,197,94,0.16); background: #ffffff; }
        .field .icon {
          position: absolute; left: 16px; top: 50%; transform: translateY(-50%);
          font-size: 18px; opacity: .65; display: inline-flex; align-items: center;
        }
        .toggle {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: transparent; border: 0; font-size: 18px; cursor: pointer; opacity: .7;
          display: inline-flex; align-items: center;
        }
        .toggle:hover { opacity: 1; }

        .submit {
          display: inline-block;
          width: 100%;
          padding: 14px 16px;
          border-radius: 999px;
          background: #146f35; /* green */
          color: #fff;
          font-weight: 700;
          letter-spacing: 1.4px;
          border: none;
          cursor: pointer;
          transition: transform .05s ease, box-shadow .2s ease, background .2s ease;
          box-shadow: 0 4px 10px rgba(22,163,74,.35);
        }
        .submit:hover { background: #15803d; box-shadow: 0 2px 5px rgba(21,128,61,.45);} 
        .submit:active { transform: translateY(1px); }

        .helper { margin-top: 12px; text-align: center; }
        .helper a { color: #166534; text-decoration: none; }
        .helper a:hover { text-decoration: underline; }

        /* Responsive */
        @media (max-width: 980px) {
          .login-card { grid-template-columns: 1fr; }
          .login-card::after { display: none; } /* hide divider on stacked layout */
          .login-right { padding: 36px 28px 28px 28px; }
          .illustration-wrap { aspect-ratio: auto; }
          .illustration { width: 70%; }
        }
      `}</style>
    </div>
  );
}
