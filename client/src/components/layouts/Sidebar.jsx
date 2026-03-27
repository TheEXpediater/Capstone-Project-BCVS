// src/components/layouts/Sidebar.jsx
import React, { useState, useEffect, useMemo } from "react";
import { Nav, Button } from "react-bootstrap";
import "./css/sidebar.css";
import { NavLink, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  FaChevronLeft,
  FaChevronRight,
  FaHome,
  FaKey,
  FaUserCheck,
  FaUsers,
  FaCogs,
  FaFolderOpen,
  FaCodeBranch,
  FaClipboardList,
  FaRegFileAlt,
  FaUserGraduate,
} from "react-icons/fa";

function Sidebar() {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  const [collapsed, setCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({
    vcIssue: false,
    accounts: false,
  });

  const [submenuClickCount, setSubmenuClickCount] = useState({
    vcIssue: 0,
    accounts: 0,
  });
  const toggleSidebar = () => setCollapsed((c) => !c);
  const isDevOrSuper =
    user?.role === "developer" || user?.role === "super_admin";

  const routeLabel = useMemo(
    () => ({
      "/": "Dashboard",
      "/students/student-profiles": "Students",
      "/vc/draft": "Draft",
      "/vc/issue": "Issue",
      "/vc/request": "Request",
      "/registry/issuedVc": "Registry",
      "/accounts/verify-users": "Verify Users",
      "/accounts/staff-admin": "Staff/Admins",
      "/key-vaults": "Key Vaults",
      "/blockchain-explorer": "Blockchain Explorer",
      // dynamic entries
      ...(user?._id
        ? {
            [`/accounts/profile/${user._id}`]: "My Profile",
            [`/accounts/audit-logs/${user._id}`]: "Audit Logs",
          }
        : {}),
    }),
    [user?._id]
  );

 
  const submenuRoutes = useMemo(
    () => ({
      vcIssue: ["/vc/issue", "/vc/request", "/vc/draft"],
      accounts: isDevOrSuper
        ? [
            "/accounts/verify-users",
            "/accounts/staff-admin",
            user?._id ? `/accounts/audit-logs/${user._id}` : "/accounts/verify-users",
          ]
        : [
            "/accounts/verify-users",
            user?._id ? `/accounts/profile/${user._id}` : "/accounts/verify-users",
          ],
    }),
    [isDevOrSuper, user]
  );

  // Collapsed rail-hint for VC/Accounts group buttons
  const vcHint =
    routeLabel[submenuRoutes.vcIssue[submenuClickCount.vcIssue]] || "VC";
  const accountsHint =
    routeLabel[submenuRoutes.accounts[submenuClickCount.accounts]] ||
    "Accounts";

  const toggleMenu = (menu) => {
    if (collapsed) {
      // collapsed → cycle through submenu pages
      setSubmenuClickCount((prev) => {
        const newCount = (prev[menu] + 1) % submenuRoutes[menu].length;
        navigate(submenuRoutes[menu][newCount]);
        return { ...prev, [menu]: newCount };
      });
    } else {
      // expanded → accordion
      setExpandedMenus((prev) => {
        if (prev[menu]) return { ...prev, [menu]: false };
        const allClosed = Object.keys(prev).reduce((acc, k) => {
          acc[k] = false;
          return acc;
        }, {});
        return { ...allClosed, [menu]: true };
      });
    }
  };

  return (
    <nav
      className={`sidebar d-flex flex-column flex-shrink-0 ${
        collapsed ? "collapsed" : ""
      }`}
      aria-expanded={!collapsed}
    >
      <Button
        variant="light"
        className="toggle-btn"
        onClick={toggleSidebar}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <FaChevronRight /> : <FaChevronLeft />}
      </Button>

      <div className="p-4">
        <h4 className="logo-text fw-bold mb-0">Credential Issuance</h4>
        <p className="sidebar-sub hide-on-collapse">Dashboard</p>
      </div>

      <Nav className="flex-column flex-grow-1">
        {/* Dashboard */}
        <Nav.Link
          as={NavLink}
          to="/"
          end
          className="sidebar-link p-3"
          data-label="Dashboard"
          aria-label="Dashboard"
        >
          <FaHome className="me-3 icon" />
          <span className="hide-on-collapse">Dashboard</span>
        </Nav.Link>

        {/* Students */}
        <Nav.Link
          as={NavLink}
          to="/students/student-profiles"
          end
          className="sidebar-link p-3"
          data-label="Students"
          aria-label="Students"
        >
          <FaUserGraduate className="me-3 icon" />
          <span className="hide-on-collapse">Students</span>
        </Nav.Link>

        {/* VC Group */}
        <div
          className="sidebar-link p-3 text-decoration-none clickable"
          onClick={() => toggleMenu("vcIssue")}
          data-label={collapsed ? vcHint : "VC"}
          aria-label="VC"
          role="button"
        >
          <FaFolderOpen className="me-3 icon" />
          <span className="hide-on-collapse">VC</span>
        </div>

        {expandedMenus.vcIssue && !collapsed && (
          <>
            <Nav.Link
              as={NavLink}
              to="/vc/draft"
              className="sidebar-link ps-5"
              data-label="Draft"
              aria-label="Draft"
            >
              <FaClipboardList className="me-2 icon" />
              <span>Draft</span>
            </Nav.Link>
            <Nav.Link
              as={NavLink}
              to="/vc/issue"
              className="sidebar-link ps-5"
              data-label="Issue"
              aria-label="Issue"
            >
              <FaClipboardList className="me-2 icon" />
              <span>Issue</span>
            </Nav.Link>
            <Nav.Link
              as={NavLink}
              to="/vc/request"
              className="sidebar-link ps-5"
              data-label="Request"
              aria-label="Request"
            >
              <FaRegFileAlt className="me-2 icon" />
              <span>Request</span>
            </Nav.Link>
          </>
        )}

        {/* Registry */}
        <Nav.Link
          as={NavLink}
          to="/registry/issuedVc"
          className="sidebar-link p-3"
          data-label="Registry"
          aria-label="Registry"
        >
          <FaKey className="me-3 icon" />
          <span className="hide-on-collapse">Registry</span>
        </Nav.Link>

        {/* Accounts Group */}
        <div
          className="sidebar-link p-3 text-decoration-none clickable"
          onClick={() => toggleMenu("accounts")}
          data-label={collapsed ? accountsHint : "Accounts"}
          aria-label="Accounts"
          role="button"
        >
          <FaUsers className="me-3 icon" />
          <span className="hide-on-collapse">Accounts</span>
        </div>

        {expandedMenus.accounts && !collapsed && (
          <>
            <Nav.Link
              as={NavLink}
              to="/accounts/verify-users"
              className="sidebar-link ps-5"
              data-label="Verify Users"
              aria-label="Verify Users"
            >
              <FaUserCheck className="me-2 icon" />
              <span>Verify Users</span>
            </Nav.Link>

            {isDevOrSuper && (
              <Nav.Link
                as={NavLink}
                to="accounts/manage-accounts"
                className="sidebar-link ps-5"
                data-label="Staff/Admins"
                aria-label="Staff/Admins"
              >
                <FaCogs className="me-2 icon" />
                <span>Manage Admins</span>
              </Nav.Link>
            )}

            {isDevOrSuper && user?._id && (
              <Nav.Link
                as={NavLink}
                to={`/accounts/audit-logs/${user._id}`}
                className="sidebar-link ps-5"
                data-label="Audit logs"
                aria-label="Audit Logs"
              >
                <FaClipboardList className="me-2 icon" />
                <span>Audit Logs</span>
              </Nav.Link>
            )}

            {!isDevOrSuper && user?._id && (
              <Nav.Link
                as={NavLink}
                to={`/accounts/profile/${user._id}`}
                className="sidebar-link ps-5"
                data-label="My Profile"
                aria-label="My Profile"
              >
                <FaUsers className="me-2 icon" />
                <span>My Profile</span>
              </Nav.Link>
            )}
          </>
        )}

        {/* Key Vaults */}
        <Nav.Link
          as={NavLink}
          to="/IssuerProfile"
          className="sidebar-link p-3"
          data-label="Key Vaults"
          aria-label="Key Vaults"
        >
          <FaKey className="me-3 icon" />
          <span className="hide-on-collapse">Issuer Profile</span>
        </Nav.Link>

        {/* Blockchain Explorer */}
        <Nav.Link
          as={NavLink}
          to="/blockchain-explorer"
          className="sidebar-link p-3"
          data-label="Blockchain Explorer"
          aria-label="Blockchain Explorer"
        >
          <FaCodeBranch className="me-3 icon" />
          <span className="hide-on-collapse">Blockchain Explorer</span>
        </Nav.Link>
      </Nav>
    </nav>
  );
}

export default Sidebar;
