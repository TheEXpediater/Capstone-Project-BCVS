// src/components/layouts/Header.jsx
import React, { useState } from "react";
import { FaUser, FaBell, FaCog, FaUserCircle, FaLock } from "react-icons/fa";
import { useSelector, useDispatch } from "react-redux";
import { Modal } from "react-bootstrap";
import { useNavigate, useLocation} from "react-router-dom";
import { logout, reset } from "../../features/auth/authSlice";
import { persistor } from "../../app/store";
import "./css/header.css";
import useAuthHydrator from "../../hooks/useAuthHydrator";
const Header = () => {
  useAuthHydrator(); 
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
   const location = useLocation(); 

  const [showLogout, setShowLogout] = useState(false);

  const onConfirmLogout = async () => {
    setShowLogout(false);
    try {
      await dispatch(logout());
    } finally {
      dispatch(reset());
      persistor.purge();
      navigate("/login");
    }
  };

  // Your backend field name is profilePicture ✅
  const profileImage = user?.profilePicture || null;

  return (
    <nav className="navbar bg-light sticky-top px-4 py-2 topbar">
      {/* Left: Search */}
      <form className="d-flex align-items-center" role="search" style={{ maxWidth: 360 }}>
        <input
          className="form-control form-control-sm me-2"
          type="search"
          placeholder="Search"
          aria-label="Search"
        />
        <button className="btn btn-outline-secondary btn-sm" type="submit">
          Search
        </button>
      </form>

      {/* Right: user avatar / dropdown */}
      <div className="ms-auto dropdown">
        <button
          className="icon-btn dropdown-toggle d-flex align-items-center me-5 pe-4"
          id="userMenu"
          data-bs-toggle="dropdown"
          aria-expanded="false"
          aria-label="Open user menu"
          type="button"
        >
          {profileImage ? (
            <img
              src={profileImage}
              alt="Profile"
              style={{
                width: 34,
                height: 34,
                objectFit: "cover",
                borderRadius: "50%",
                border: "1px solid #ccc",
              }}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <FaUser size={18} />
          )}
        </button>

        <ul className="dropdown-menu dropdown-menu-end shadow" aria-labelledby="userMenu">
          <li className="dropdown-item-text text-muted small px-3 d-flex align-items-center">
            {profileImage ? (
              <img
                src={profileImage}
                alt="Profile"
                style={{
                  width: 28,
                  height: 28,
                  objectFit: "cover",
                  borderRadius: "50%",
                  border: "1px solid #ccc",
                  marginRight: 8,
                }}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <FaUserCircle className="me-2" />
            )}
            {user
              ? `${user.role || "staff"} | ${user.fullName || user.username || user.email || "User"}`
              : "Staff | Guest"}
          </li>

          <li><hr className="dropdown-divider" /></li>

          <li>
            <button className="dropdown-item d-flex align-items-center" type="button">
              <FaBell className="me-2" /> Notifications
            </button>
          </li>

          <li>
             <button
               className="dropdown-item d-flex align-items-center"
               type="button"
              onClick={() => {
                            const inCashierShell = location.pathname.startsWith('/cashier');
                            navigate(inCashierShell ? '/cashier/profile' : '/accounts/profile');
                          }}
                        >
              <FaCog className="me-2" /> Profile Settings
            </button>
          </li>

          <li>
            <button
              className="dropdown-item d-flex align-items-center"
              type="button"
              onClick={() => setShowLogout(true)}
            >
              <FaLock className="me-2" /> Logout
            </button>
          </li>
        </ul>
      </div>

      {/* === Confirm Logout Modal === */}
      <Modal
        show={showLogout}
        onHide={() => setShowLogout(false)}
        centered
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>Confirm Logout</Modal.Title>
        </Modal.Header>
        <Modal.Body>Do you want to logout?</Modal.Body>
        <Modal.Footer>
          <button className="btn btn-outline-secondary" onClick={() => setShowLogout(false)}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirmLogout}>
            Logout
          </button>
        </Modal.Footer>
      </Modal>
    </nav>
  );
};

export default Header;
