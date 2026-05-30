import { API_BASE_URL, ENDPOINTS } from '@/constants/config';
import { api, apiErrorMessage } from '@/services/apiClient';

function fullApiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

export async function checkUploadBackendHealth() {
  const healthUrl = fullApiUrl(ENDPOINTS.uploads.health);
  console.log('[upload:test] health request start:', healthUrl);
  console.log('[upload:test] axios baseURL:', api.defaults.baseURL);

  try {
    const response = await api.get(ENDPOINTS.uploads.health);
    console.log('[upload:test] health response status:', response.status);
    console.log('[upload:test] health response data:', response.data);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.log('[upload:test] health error response:', {
        status: error.response.status,
        data: error.response.data,
      });
    } else if (error.request) {
      console.log('[upload:test] health network error:', error.message);
    } else {
      console.log('[upload:test] health request setup error:', error.message);
    }

    throw new Error(apiErrorMessage(error, 'Backend health check failed'));
  }
}

export async function uploadTestImage(asset) {
  const uploadUrl = fullApiUrl(ENDPOINTS.uploads.testImage);
  console.log('[upload:test] upload request start:', uploadUrl);
  console.log('[upload:test] axios baseURL:', api.defaults.baseURL);

  try {
    const formData = new FormData();
    formData.append('image', {
      uri: asset.uri,
      name: 'test.jpg',
      type: 'image/jpeg',
    });

    const response = await api.post(ENDPOINTS.uploads.testImage, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    console.log('[upload:test] upload response status:', response.status);
    console.log('[upload:test] upload response data:', response.data);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.log('[upload:test] upload error response:', {
        status: error.response.status,
        data: error.response.data,
      });
    } else if (error.request) {
      console.log('[upload:test] network error:', error.message);
    } else {
      console.log('[upload:test] request setup error:', error.message);
    }

    throw new Error(apiErrorMessage(error, 'Image upload failed'));
  }
}
