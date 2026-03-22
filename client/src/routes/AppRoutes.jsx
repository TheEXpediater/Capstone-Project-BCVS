//routes.jsx
import { Routes, Route } from 'react-router-dom';

// Shell
import Layout from './components/layouts/Layout';
import CashierLayout from './components/layouts/CashierLayout';   
import NotFound from './pages/NotFound';

// Auth / Public
import Login from './pages/Login';
import Loading from './Loading';
import Index from './pages/landing_portal';
import VerificationPortal from './pages/verification_portal';
import Services from './pages/landing_portal/sub/services';
import ResetPassword from './pages/ResetPassword';

// App pages 
import Dashboard from './pages/Dashboard';
import AccountsAdminStaff from './pages/accounts/ManageAccounts';
import VerifyUsers from './pages/accounts/VerifyUsers';
import MobileUsers from './pages/accounts/mobileUsers';

import AuditLogs from './pages/accounts/AuditLogs';

import Students from './pages/students/Profiles';
import CreateStudent from './pages/students/ManageStudent';

import Issue from './pages/vc/testing/issue';
import Draft from './pages/vc/draft';
import Request from './pages/vc/request';
import Template from './pages/vc/sub/template';
import CreateDrafts from './pages/vc/sub/createDrafts';
import DraftConfirmation from './pages/vc/sub/draftConfirmation';
import Transactions from './pages/vc/sub/transactions';
import PaymentConfirmation from './pages/vc/sub/confirmPayments';

import IssuerProfile from './pages/IssuerProfile';
import Blockchain from './pages/Blockchain';
import About from './pages/About';
import IssuedVc from './pages/registry/issuedVc';
import Profile from './pages/accounts/Profile';
import Anchor  from './pages/registry/anchor';
import Anchored from './pages/registry/anchored';

//  cashier 
import CashierIssued from './pages/cashier/issued';
import CashierDrafts from './pages/cashier/cashierDrafts';


import TorDesigner from './pages/pdf/torDesigner'
import DiplomaDesigner from "./pages/pdf/diplomaDesigner"

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/landing-page" element={<Index />} />
      <Route path="/landing-page/services" element={<Services />} />

      <Route path="/verification-portal" element={<VerificationPortal />} />
      <Route path="/verification-portal/:sessionId" element={<VerificationPortal />} />
      <Route path="/verify/:sessionId" element={<VerificationPortal />} />

      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/loading" element={<Loading />} />
      <Route path="/design/tor" element={<TorDesigner />} />
      <Route path="/design/diploma" element={<DiplomaDesigner />} />



      {/* Admin / staff */}
      <Route element={<Layout />}>
        {/* Home */}
        <Route index element={<Dashboard />} />

        {/* Accounts */}
        <Route path="accounts/manage-accounts" element={<AccountsAdminStaff />} />
        <Route path="accounts/audit-logs/:id" element={<AuditLogs />} />
        <Route path="accounts/audit-logs" element={<AuditLogs />} />
        <Route path="accounts/verify-users" element={<VerifyUsers />} />
        <Route path="accounts/profile" element={<Profile />} />
        <Route path="accounts/mobile-users" element={<MobileUsers />} />


        {/* Students */}
        <Route path="students/student-profiles" element={<Students />} />
        <Route path="students/create-student" element={<CreateStudent />} />

        {/* VC */}
        <Route path="vc/draft" element={<Draft />} />
        <Route path="vc/issue" element={<Issue />} />
        <Route path="vc/request" element={<Request />} />
        <Route path="vc/sub/createDrafts" element={<CreateDrafts />} />
        <Route path="vc/sub/template" element={<Template />} />
        <Route path="vc/sub/draftConfirmation" element={<DraftConfirmation />} />
        <Route path="vc/sub/transactions" element={<Transactions />} />
        <Route path="issuance/payments" element={<PaymentConfirmation />} />

        {/* Registry*/}
        <Route path="registry/issuedVc" element={<IssuedVc />} />
        <Route path="registry/anchor" element={<Anchor />} />
        <Route path="registry/anchored" element={<Anchored />} />

        <Route path="IssuerProfile" element={<IssuerProfile />} />
        <Route path="blockchain-explorer" element={<Blockchain />} />
        <Route path="about" element={<About />} />
      </Route>

      {/*  Cashier */}
      <Route element={<CashierLayout />}>
        <Route path="cashier/drafts" element={<CashierDrafts />} />
        <Route path="cashier/issued" element={<CashierIssued />} />
         <Route path="cashier/profile" element={<Profile />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
