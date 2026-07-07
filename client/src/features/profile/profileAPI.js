import {
  getWebMe,
  updateWebPassword,
  updateWebProfile,
  uploadWebProfileImage,
} from '../auth/authAPI';

export async function getMyProfile() {
  const auth = await getWebMe();
  return auth.user;
}

export {
  updateWebPassword,
  updateWebProfile,
  uploadWebProfileImage,
};
