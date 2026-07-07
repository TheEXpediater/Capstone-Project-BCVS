import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaCamera, FaEnvelope, FaIdBadge, FaPhone, FaShieldAlt, FaUser } from 'react-icons/fa';
import ImageUpload from '../../../components/ImageUpload';
import PasswordResetModal from '../../../components/PasswordResetModal';
import ProfileCard from '../../../components/ProfileCard';
import UserAvatar from '../../../components/UserAvatar';
import { setAuthUser } from '../../auth/authSlice';
import {
  getMyProfile,
  updateWebPassword,
  updateWebProfile,
  uploadWebProfileImage,
} from '../profileAPI';
import {
  WEB_ROLE_OPTIONS,
  canEditProfileRole,
  formatRole,
} from '../roleLabels';

const initialForm = {
  fullName: '',
  email: '',
  contactNo: '',
  address: '',
  role: '',
};

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function FieldIcon({ icon }) {
  const Icon = icon;
  return (
    <span className="profile-field-icon">
      <Icon />
    </span>
  );
}

export default function ProfilePage() {
  const dispatch = useDispatch();
  const authUser = useSelector((state) => state.auth.user);
  const [profile, setProfile] = useState(authUser);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const canEditRole = useMemo(() => canEditProfileRole(authUser), [authUser]);

  const syncProfile = useCallback((nextProfile) => {
    setProfile(nextProfile);
    setForm({
      fullName: nextProfile?.fullName || '',
      email: nextProfile?.email || '',
      contactNo: nextProfile?.contactNo || '',
      address: nextProfile?.address || '',
      role: nextProfile?.role || '',
    });
    dispatch(setAuthUser(nextProfile));
  }, [dispatch]);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        setLoading(true);
        const nextProfile = await getMyProfile();

        if (mounted) {
          syncProfile(nextProfile);
          setFeedback({ type: '', message: '' });
        }
      } catch (error) {
        if (mounted) {
          setFeedback({
            type: 'danger',
            message: getErrorMessage(error, 'Failed to load profile.'),
          });
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [syncProfile]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setFeedback({ type: '', message: '' });
      const payload = {
        fullName: form.fullName,
        email: form.email,
        contactNo: form.contactNo,
        address: form.address,
      };

      if (canEditRole) {
        payload.role = form.role;
      }

      const nextProfile = await updateWebProfile(payload);
      syncProfile(nextProfile);
      setFeedback({ type: 'success', message: 'Profile updated successfully.' });
    } catch (error) {
      setFeedback({
        type: 'danger',
        message: getErrorMessage(error, 'Failed to update profile.'),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleImageSave(file) {
    try {
      setImageBusy(true);
      setImageError('');
      const nextProfile = await uploadWebProfileImage(file);
      syncProfile(nextProfile);
      setImageModalOpen(false);
      setFeedback({ type: 'success', message: 'Profile image updated successfully.' });
    } catch (error) {
      setImageError(getErrorMessage(error, 'Failed to upload profile image.'));
    } finally {
      setImageBusy(false);
    }
  }

  async function handlePasswordSubmit(payload) {
    try {
      setPasswordBusy(true);
      setPasswordError('');
      setPasswordSuccess('');
      await updateWebPassword(payload);
      setPasswordSuccess('Password updated successfully.');
    } catch (error) {
      setPasswordError(getErrorMessage(error, 'Failed to update password.'));
    } finally {
      setPasswordBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="content-card">
          <div className="content-card-body">Loading profile...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <section className="profile-hero">
        <div className="profile-hero-avatar">
          <UserAvatar
            user={profile}
            size="xl"
            button
            onClick={() => setImageModalOpen(true)}
            title="Upload profile image"
          />
          <button className="profile-image-action" type="button" onClick={() => setImageModalOpen(true)}>
            <FaCamera />
          </button>
        </div>

        <div className="profile-hero-copy">
          <div className="profile-kicker">Profile Header</div>
          <h2>{profile?.fullName || profile?.username || 'User'}</h2>
          <div className="profile-hero-meta">
            <span><FaEnvelope /> {profile?.email || '-'}</span>
            <span><FaIdBadge /> {formatRole(profile?.role)}</span>
          </div>
        </div>
      </section>

      {feedback.message ? (
        <div className={`alert alert-${feedback.type || 'info'} mb-0`}>{feedback.message}</div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <div className="profile-grid">
          <ProfileCard
            title="Account Information"
            description="Manage your visible account details and contact information."
          >
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label" htmlFor="fullName">Full Name</label>
                <div className="profile-input-group">
                  <FieldIcon icon={FaUser} />
                  <input
                    id="fullName"
                    name="fullName"
                    className="form-control"
                    value={form.fullName}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="col-md-6">
                <label className="form-label" htmlFor="email">Email Address</label>
                <div className="profile-input-group">
                  <FieldIcon icon={FaEnvelope} />
                  <input
                    id="email"
                    name="email"
                    className="form-control"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="col-md-6">
                <label className="form-label" htmlFor="contactNo">Contact Number</label>
                <div className="profile-input-group">
                  <FieldIcon icon={FaPhone} />
                  <input
                    id="contactNo"
                    name="contactNo"
                    className="form-control"
                    value={form.contactNo}
                    onChange={handleChange}
                    placeholder="Add contact number"
                  />
                </div>
              </div>

              <div className="col-md-6">
                <label className="form-label" htmlFor="role">Role</label>
                <div className="profile-input-group">
                  <FieldIcon icon={FaShieldAlt} />
                  {canEditRole ? (
                    <select
                      id="role"
                      name="role"
                      className="form-select"
                      value={form.role}
                      onChange={handleChange}
                    >
                      {WEB_ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="role"
                      className="form-control"
                      value={formatRole(form.role)}
                      readOnly
                    />
                  )}
                </div>
              </div>

              <div className="col-12">
                <label className="form-label" htmlFor="address">Address</label>
                <textarea
                  id="address"
                  name="address"
                  className="form-control"
                  rows="3"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Add address"
                />
              </div>
            </div>

            <div className="d-flex justify-content-end mt-4">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </ProfileCard>

          <ProfileCard
            title="Security"
            description="Protect your administrator account with a strong password."
            className="profile-security-card"
          >
            <div className="security-panel">
              <div>
                <h3>Password</h3>
                <p className="text-muted mb-0">Use a unique password with uppercase, lowercase, and numeric characters.</p>
              </div>
              <button className="btn btn-outline-primary" type="button" onClick={() => setPasswordModalOpen(true)}>
                Reset Password
              </button>
            </div>
          </ProfileCard>
        </div>
      </form>

      <ImageUpload
        open={imageModalOpen}
        busy={imageBusy}
        error={imageError}
        onClose={() => {
          setImageModalOpen(false);
          setImageError('');
        }}
        onSave={handleImageSave}
      />

      <PasswordResetModal
        open={passwordModalOpen}
        busy={passwordBusy}
        error={passwordError}
        success={passwordSuccess}
        onClose={() => {
          setPasswordModalOpen(false);
          setPasswordError('');
          setPasswordSuccess('');
        }}
        onSubmit={handlePasswordSubmit}
      />
    </div>
  );
}
