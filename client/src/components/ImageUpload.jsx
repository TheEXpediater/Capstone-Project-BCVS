import { useEffect, useRef, useState } from 'react';
import { FaCamera, FaImage, FaUpload } from 'react-icons/fa';

const MAX_IMAGE_SIZE = 3 * 1024 * 1024;
const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const OUTPUT_SIZE = 512;

function createImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.9);
  });
}

export default function ImageUpload({
  open,
  busy = false,
  error = '',
  onClose,
  onSave,
}) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [zoom, setZoom] = useState(1);
  const [localError, setLocalError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!open) return null;

  function resetSelection() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(null);
    setPreviewUrl('');
    setZoom(1);
    setLocalError('');
  }

  function handleClose() {
    resetSelection();
    onClose?.();
  }

  function selectFile(nextFile) {
    setLocalError('');

    if (!nextFile) return;

    if (!SUPPORTED_TYPES.includes(nextFile.type)) {
      setLocalError('Use a JPG, PNG, or WEBP image.');
      return;
    }

    if (nextFile.size > MAX_IMAGE_SIZE) {
      setLocalError('Image must be 3 MB or smaller.');
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
    setZoom(1);
  }

  async function buildCroppedFile() {
    const image = await createImage(previewUrl);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;

    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
    const sourceX = (image.naturalWidth - sourceSize) / 2;
    const sourceY = (image.naturalHeight - sourceSize) / 2;

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE
    );

    const blob = await canvasToBlob(canvas);
    if (!blob) {
      throw new Error('Could not process the selected image.');
    }

    const originalBase = file?.name?.replace(/\.[^.]+$/, '') || 'profile-image';
    return new File([blob], `${originalBase}.webp`, { type: 'image/webp' });
  }

  async function handleSave() {
    if (!file || !previewUrl) {
      setLocalError('Select an image before saving.');
      return;
    }

    try {
      setLocalError('');
      const croppedFile = await buildCroppedFile();
      await onSave?.(croppedFile);
      resetSelection();
    } catch (uploadError) {
      setLocalError(uploadError.message || 'Failed to process image.');
    }
  }

  return (
    <>
      <div className="modal d-block enterprise-modal" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div className="d-flex align-items-center gap-3">
                <div className="modal-icon">
                  <FaCamera />
                </div>
                <div>
                  <h2 className="h5 mb-1">Profile Image</h2>
                  <p className="text-muted small mb-0">Upload, crop, and save a square account image.</p>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={handleClose} disabled={busy} aria-label="Close" />
            </div>
            <div className="modal-body">
              {error || localError ? (
                <div className="alert alert-danger">{error || localError}</div>
              ) : null}

              <button
                className="image-upload-dropzone"
                type="button"
                onClick={() => inputRef.current?.click()}
              >
                <FaUpload />
                <span>{file ? file.name : 'Choose JPG, PNG, or WEBP image'}</span>
                <small>Maximum file size: 3 MB</small>
              </button>
              <input
                ref={inputRef}
                className="visually-hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => selectFile(event.target.files?.[0])}
              />

              <div className="image-crop-area mt-4">
                {previewUrl ? (
                  <div className="image-crop-preview">
                    <img src={previewUrl} alt="Profile preview" style={{ transform: `scale(${zoom})` }} />
                  </div>
                ) : (
                  <div className="image-crop-empty">
                    <FaImage />
                    <span>Image preview</span>
                  </div>
                )}
              </div>

              <div className="mt-3">
                <label className="form-label" htmlFor="profileImageZoom">Crop Zoom</label>
                <input
                  id="profileImageZoom"
                  className="form-range"
                  type="range"
                  min="1"
                  max="2.2"
                  step="0.05"
                  value={zoom}
                  disabled={!previewUrl}
                  onChange={(event) => setZoom(Number(event.target.value))}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" type="button" onClick={handleClose} disabled={busy}>
                Cancel
              </button>
              <button className="btn btn-primary" type="button" onClick={handleSave} disabled={busy || !file}>
                {busy ? 'Saving...' : 'Save Image'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
