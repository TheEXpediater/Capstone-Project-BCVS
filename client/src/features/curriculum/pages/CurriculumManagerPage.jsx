import { useEffect, useMemo, useState } from 'react';
import {
  deleteCurriculum,
  getCurriculumById,
  listCurricula,
  saveCurriculum,
} from '../curriculumAPI';

function createEmptySubject() {
  return {
    code: '',
    title: '',
    units: 0,
    prerequisite: '',
  };
}

function createStarterStructure() {
  return {
    '1St Year': {
      '1St Semester': [createEmptySubject()],
    },
  };
}

function cloneStructure(structure) {
  return JSON.parse(JSON.stringify(structure || {}));
}

function prettyJson(value) {
  return JSON.stringify(value || {}, null, 2);
}

function getFormSnapshot(form) {
  return JSON.stringify({
    program: form?.program || '',
    programName: form?.programName || '',
    curriculumYear: form?.curriculumYear || '',
    structure: form?.structure || {},
  });
}

function summarizeStructure(structure) {
  let years = 0;
  let semesters = 0;
  let subjects = 0;
  let units = 0;

  Object.values(structure || {}).forEach((semesterMap) => {
    years += 1;

    Object.values(semesterMap || {}).forEach((subjectList) => {
      semesters += 1;

      (subjectList || []).forEach((subject) => {
        subjects += 1;
        units += Number(subject?.units || 0);
      });
    });
  });

  return { years, semesters, subjects, units };
}
function extractCurriculumFromJson(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON must be an object.');
  }

  const hasStructuredEnvelope =
    parsed.structure &&
    typeof parsed.structure === 'object' &&
    !Array.isArray(parsed.structure);

  if (hasStructuredEnvelope) {
    return {
      program: typeof parsed.program === 'string' ? parsed.program : '',
      programName:
        typeof parsed.programName === 'string' ? parsed.programName : '',
      curriculumYear:
        parsed.curriculumYear === undefined || parsed.curriculumYear === null
          ? ''
          : String(parsed.curriculumYear),
      structure: parsed.structure,
      hasMetadata: true,
    };
  }

  return {
    program: '',
    programName: '',
    curriculumYear: '',
    structure: parsed,
    hasMetadata: false,
  };
}
const EMPTY_FORM = {
  _id: '',
  program: '',
  programName: '',
  curriculumYear: '2024',
  structure: createStarterStructure(),
};

function createEmptyForm() {
  return {
    _id: '',
    program: '',
    programName: '',
    curriculumYear: '2024',
    structure: createStarterStructure(),
  };
}

function EmptyWorkspace({ onCreate }) {
  return (
    <div className="text-center py-5">
      <div className="mx-auto" style={{ maxWidth: 560 }}>
        <h2 className="h5 mb-2">No curriculum selected</h2>
        <p className="text-muted mb-4">
          Choose a curriculum from the table to view it, or create a new one to start building.
        </p>
        <button className="btn btn-primary" onClick={onCreate}>
          Create New Curriculum
        </button>
      </div>
    </div>
  );
}

function CurriculumSummaryCards({ stats }) {
  return (
    <div className="row g-3">
      <div className="col-md-3">
        <div className="border rounded-3 p-3 h-100 bg-light">
          <div className="small text-muted">Years</div>
          <div className="fw-semibold">{stats.years}</div>
        </div>
      </div>

      <div className="col-md-3">
        <div className="border rounded-3 p-3 h-100 bg-light">
          <div className="small text-muted">Semesters / Terms</div>
          <div className="fw-semibold">{stats.semesters}</div>
        </div>
      </div>

      <div className="col-md-3">
        <div className="border rounded-3 p-3 h-100 bg-light">
          <div className="small text-muted">Subjects</div>
          <div className="fw-semibold">{stats.subjects}</div>
        </div>
      </div>

      <div className="col-md-3">
        <div className="border rounded-3 p-3 h-100 bg-light">
          <div className="small text-muted">Total Units</div>
          <div className="fw-semibold">{stats.units}</div>
        </div>
      </div>
    </div>
  );
}

function CurriculumViewer({ curriculum }) {
  if (!curriculum) {
    return (
      <div className="alert alert-light border mb-0">
        Select a curriculum from the table to view the full structure.
      </div>
    );
  }

  const structure = curriculum.structure || {};
  const stats = summarizeStructure(structure);

  return (
    <div className="d-flex flex-column gap-4">
      <div className="border rounded-3 p-3 bg-light">
        <div className="row g-3 mb-3">
          <div className="col-md-3">
            <div className="small text-muted">Program</div>
            <div className="fw-semibold">{curriculum.program || '—'}</div>
          </div>

          <div className="col-md-5">
            <div className="small text-muted">Program Name</div>
            <div className="fw-semibold">{curriculum.programName || '—'}</div>
          </div>

          <div className="col-md-4">
            <div className="small text-muted">Curriculum Year</div>
            <div className="fw-semibold">{curriculum.curriculumYear || '—'}</div>
          </div>
        </div>

        <CurriculumSummaryCards stats={stats} />
      </div>

      {Object.keys(structure).length === 0 ? (
        <div className="alert alert-light border mb-0">
          This curriculum has no structure yet.
        </div>
      ) : (
        Object.entries(structure).map(([yearLabel, semesterMap]) => (
          <div className="border rounded-3 p-3" key={yearLabel}>
            <div className="mb-3">
              <h3 className="h6 mb-1">{yearLabel}</h3>
              <div className="text-muted small">
                {Object.keys(semesterMap || {}).length} semester(s) / term(s)
              </div>
            </div>

            <div className="d-flex flex-column gap-3">
              {Object.entries(semesterMap || {}).map(([semesterLabel, subjects]) => (
                <div className="border rounded-3 p-3 bg-light" key={`${yearLabel}-${semesterLabel}`}>
                  <div className="fw-semibold mb-2">{semesterLabel}</div>

                  {!subjects || subjects.length === 0 ? (
                    <div className="alert alert-light border mb-0">
                      No subjects in this semester.
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm align-middle mb-0">
                        <thead>
                          <tr>
                            <th style={{ minWidth: 140 }}>Code</th>
                            <th style={{ minWidth: 320 }}>Title</th>
                            <th style={{ minWidth: 100 }}>Units</th>
                            <th style={{ minWidth: 220 }}>Prerequisite</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subjects.map((subject, index) => (
                            <tr key={`${yearLabel}-${semesterLabel}-${index}`}>
                              <td className="fw-semibold">{subject.code || '—'}</td>
                              <td>{subject.title || '—'}</td>
                              <td>{subject.units ?? 0}</td>
                              <td>{subject.prerequisite || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function JsonToolsModal({
  open,
  jsonInput,
  onClose,
  onChange,
  onUpload,
  onCopy,
  onLoad,
}) {
  if (!open) return null;

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 className="h5 mb-1">JSON Tools</h2>
                <p className="text-muted mb-0 small">
                  Optional helper tools only. Keep them hidden unless needed.
                </p>
              </div>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>

            <div className="modal-body">
              <div className="d-flex flex-wrap gap-2 mb-3">
                <label className="btn btn-outline-secondary btn-sm mb-0">
                  Upload JSON File
                  <input
                    type="file"
                    accept=".json,application/json"
                    hidden
                    onChange={onUpload}
                  />
                </label>

                <button className="btn btn-outline-dark btn-sm" onClick={onCopy}>
                  Copy Current JSON
                </button>

                <button className="btn btn-primary btn-sm" onClick={onLoad}>
                  Load JSON Into Builder
                </button>
              </div>

              <textarea
                className="form-control font-monospace"
                rows="16"
                value={jsonInput}
                onChange={(event) => onChange(event.target.value)}
                placeholder="Optional JSON helper area"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="modal-backdrop show" onClick={onClose} />
    </>
  );
}

function CurriculumEditor({
  form,
  stats,
  saving,
  onUpdateMeta,
  onSave,
  onAddYear,
  onResetTemplate,
  onRenameYear,
  onRemoveYear,
  onAddSemester,
  onRenameSemester,
  onRemoveSemester,
  onAddSubject,
  onUpdateSubject,
  onRemoveSubject,
}) {
  return (
    <div className="d-flex flex-column gap-4">
      <div className="border rounded-3 p-3">
        <div className="row g-3 mb-3">
          <div className="col-md-3">
            <label className="form-label fw-semibold">Program Code</label>
            <input
              className="form-control"
              value={form.program}
              onChange={(event) => onUpdateMeta('program', event.target.value.toUpperCase())}
              placeholder="BSABE"
            />
          </div>

          <div className="col-md-5">
            <label className="form-label fw-semibold">Program Name</label>
            <input
              className="form-control"
              value={form.programName}
              onChange={(event) => onUpdateMeta('programName', event.target.value)}
              placeholder="Program name"
            />
          </div>

          <div className="col-md-4">
            <label className="form-label fw-semibold">Curriculum Year</label>
            <input
              className="form-control"
              value={form.curriculumYear}
              onChange={(event) => onUpdateMeta('curriculumYear', event.target.value)}
              placeholder="2024"
            />
          </div>
        </div>

        <CurriculumSummaryCards stats={stats} />

        <div className="mt-4 d-flex flex-wrap justify-content-between gap-2">
          <div className="d-flex gap-2 flex-wrap">
            <button className="btn btn-outline-primary btn-sm" onClick={onAddYear}>
              Add Year
            </button>

            <button className="btn btn-outline-secondary btn-sm" onClick={onResetTemplate}>
              Start Blank Template
            </button>
          </div>

          <button className="btn btn-primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Curriculum'}
          </button>
        </div>
      </div>

      {Object.keys(form.structure || {}).length === 0 ? (
        <div className="alert alert-light border mb-0">No year created yet.</div>
      ) : (
        <div className="d-flex flex-column gap-4">
          {Object.entries(form.structure).map(([yearLabel, semesterMap]) => (
            <div className="border rounded-3 p-3" key={yearLabel}>
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                <div>
                  <h3 className="h6 mb-1">{yearLabel}</h3>
                  <div className="text-muted small">
                    {Object.keys(semesterMap || {}).length} semester(s) / term(s)
                  </div>
                </div>

                <div className="d-flex gap-2 flex-wrap">
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => onRenameYear(yearLabel)}
                  >
                    Rename Year
                  </button>

                  <button
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => onAddSemester(yearLabel)}
                  >
                    Add Semester
                  </button>

                  <button
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => onRemoveYear(yearLabel)}
                  >
                    Remove Year
                  </button>
                </div>
              </div>

              <div className="d-flex flex-column gap-3">
                {Object.entries(semesterMap || {}).map(([semesterLabel, subjects]) => (
                  <div className="border rounded-3 p-3 bg-light" key={`${yearLabel}-${semesterLabel}`}>
                    <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                      <div>
                        <div className="fw-semibold">{semesterLabel}</div>
                        <div className="text-muted small">
                          {(subjects || []).length} subject(s)
                        </div>
                      </div>

                      <div className="d-flex gap-2 flex-wrap">
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => onRenameSemester(yearLabel, semesterLabel)}
                        >
                          Rename Semester
                        </button>

                        <button
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => onAddSubject(yearLabel, semesterLabel)}
                        >
                          Add Subject
                        </button>

                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => onRemoveSemester(yearLabel, semesterLabel)}
                        >
                          Remove Semester
                        </button>
                      </div>
                    </div>

                    {(subjects || []).length === 0 ? (
                      <div className="alert alert-light border mb-0">
                        No subjects yet for this semester.
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-sm align-middle mb-0">
                          <thead>
                            <tr>
                              <th style={{ minWidth: 140 }}>Code</th>
                              <th style={{ minWidth: 280 }}>Title</th>
                              <th style={{ minWidth: 100 }}>Units</th>
                              <th style={{ minWidth: 220 }}>Prerequisite</th>
                              <th style={{ width: 110 }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {subjects.map((subject, index) => (
                              <tr key={`${yearLabel}-${semesterLabel}-${index}`}>
                                <td>
                                  <input
                                    className="form-control form-control-sm"
                                    value={subject.code || ''}
                                    onChange={(event) =>
                                      onUpdateSubject(
                                        yearLabel,
                                        semesterLabel,
                                        index,
                                        'code',
                                        event.target.value
                                      )
                                    }
                                    placeholder="Subject code"
                                  />
                                </td>

                                <td>
                                  <input
                                    className="form-control form-control-sm"
                                    value={subject.title || ''}
                                    onChange={(event) =>
                                      onUpdateSubject(
                                        yearLabel,
                                        semesterLabel,
                                        index,
                                        'title',
                                        event.target.value
                                      )
                                    }
                                    placeholder="Subject title"
                                  />
                                </td>

                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={subject.units ?? 0}
                                    onChange={(event) =>
                                      onUpdateSubject(
                                        yearLabel,
                                        semesterLabel,
                                        index,
                                        'units',
                                        event.target.value
                                      )
                                    }
                                  />
                                </td>

                                <td>
                                  <input
                                    className="form-control form-control-sm"
                                    value={subject.prerequisite || ''}
                                    onChange={(event) =>
                                      onUpdateSubject(
                                        yearLabel,
                                        semesterLabel,
                                        index,
                                        'prerequisite',
                                        event.target.value
                                      )
                                    }
                                    placeholder="Optional prerequisite"
                                  />
                                </td>

                                <td>
                                  <button
                                    className="btn btn-outline-danger btn-sm"
                                    onClick={() => onRemoveSubject(yearLabel, semesterLabel, index)}
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CurriculumManagerPage() {
  const [curricula, setCurricula] = useState([]);
  const [selectedCurriculumId, setSelectedCurriculumId] = useState('');
  const [workspaceMode, setWorkspaceMode] = useState('idle');
  const [form, setForm] = useState(EMPTY_FORM);
  const [jsonInput, setJsonInput] = useState(prettyJson(createStarterStructure()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [loadingId, setLoadingId] = useState('');
  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [baselineSnapshot, setBaselineSnapshot] = useState(getFormSnapshot(EMPTY_FORM));

  const stats = useMemo(() => summarizeStructure(form.structure), [form.structure]);
  const currentSnapshot = useMemo(() => getFormSnapshot(form), [form]);
  const hasUnsavedChanges = currentSnapshot !== baselineSnapshot;
  const hasActiveCurriculum = Boolean(form._id || form.program || form.programName);

  useEffect(() => {
    loadCurricula();
  }, []);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;

    function handleBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;

    function handleDocumentNavigation(event) {
      const anchor = event.target.closest('a[href]');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;

      const targetPath = `${anchor.pathname}${anchor.search}${anchor.hash}`;
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

      if (targetPath === currentPath) return;

      const approved = window.confirm(
        'You have unsaved changes. Leave this page without saving?'
      );

      if (!approved) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    document.addEventListener('click', handleDocumentNavigation, true);
    return () => document.removeEventListener('click', handleDocumentNavigation, true);
  }, [hasUnsavedChanges]);

  function syncJson(structure) {
    setJsonInput(prettyJson(structure));
  }

  function syncBaseline(nextForm) {
    setBaselineSnapshot(getFormSnapshot(nextForm));
  }

  function confirmDiscardUnsavedChanges(message = 'You have unsaved changes. Leave without saving?') {
    if (!hasUnsavedChanges) return true;
    return window.confirm(message);
  }

  function resetForm(nextMode = 'edit') {
    const next = createEmptyForm();
    setForm(next);
    setSelectedCurriculumId('');
    setWorkspaceMode(nextMode);
    syncJson(next.structure);
    syncBaseline(next);
    setFeedback({ type: '', text: '' });
  }

  function updateMeta(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function replaceStructure(nextStructure) {
    setForm((prev) => ({
      ...prev,
      structure: nextStructure,
    }));
    syncJson(nextStructure);
  }

  async function loadCurricula() {
    try {
      setLoading(true);
      const data = await listCurricula();
      setCurricula(data || []);
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error.response?.data?.message || error.message || 'Failed to load curricula.',
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadCurriculumIntoWorkspace(id, nextMode) {
    const approved = confirmDiscardUnsavedChanges(
      'You have unsaved changes. Open another curriculum without saving?'
    );
    if (!approved) return;

    try {
      setLoadingId(id);
      const data = await getCurriculumById(id);

      const next = {
        _id: data._id,
        program: data.program || '',
        programName: data.programName || '',
        curriculumYear: data.curriculumYear || '2024',
        structure: data.structure || createStarterStructure(),
      };

      setForm(next);
      setSelectedCurriculumId(data._id);
      setWorkspaceMode(nextMode);
      syncJson(next.structure);
      syncBaseline(next);
      setFeedback({
        type: 'success',
        text: `${nextMode === 'edit' ? 'Editing' : 'Viewing'} ${data.program} ${data.curriculumYear}.`,
      });
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error.response?.data?.message || error.message || 'Failed to open curriculum.',
      });
    } finally {
      setLoadingId('');
    }
  }

 async function handleSaveCurriculum() {
  const program = form.program.trim().toUpperCase();
  const programName = form.programName.trim();
  const curriculumYear = form.curriculumYear.trim();

  if (!program) {
    setFeedback({
      type: 'danger',
      text: 'Program code is required before saving.',
    });
    return;
  }

  try {
    setSaving(true);

    const payload = {
      program,
      programName,
      curriculumYear,
      structure: form.structure,
    };

    const saved = await saveCurriculum(payload);

    const next = {
      _id: saved._id,
      program: saved.program,
      programName: saved.programName || '',
      curriculumYear: saved.curriculumYear,
      structure: saved.structure || {},
    };

    setForm(next);
    setSelectedCurriculumId(saved._id);
    syncJson(saved.structure || {});
    setFeedback({ type: 'success', text: 'Curriculum saved successfully.' });
    await loadCurricula();
  } catch (error) {
    setFeedback({
      type: 'danger',
      text:
        error.response?.data?.message ||
        error.message ||
        'Failed to save curriculum.',
    });
  } finally {
    setSaving(false);
  }
}

  async function handleDeleteCurriculum(id) {
    if (form._id === id) {
      const approvedDiscard = confirmDiscardUnsavedChanges(
        'You have unsaved changes on this curriculum. Continue deleting it?'
      );
      if (!approvedDiscard) return;
    }

    const approved = window.confirm('Delete this curriculum? This action cannot be undone.');
    if (!approved) return;

    try {
      setDeletingId(id);
      await deleteCurriculum(id);

      if (form._id === id) {
        const next = createEmptyForm();
        setForm(next);
        setSelectedCurriculumId('');
        setWorkspaceMode('idle');
        syncJson(next.structure);
        syncBaseline(next);
      }

      setFeedback({ type: 'success', text: 'Curriculum deleted successfully.' });
      await loadCurricula();
    } catch (error) {
      setFeedback({
        type: 'danger',
        text:
          error.response?.data?.message || error.message || 'Failed to delete curriculum.',
      });
    } finally {
      setDeletingId('');
    }
  }

 function handleLoadJsonToEditor() {
  try {
    const parsed = JSON.parse(jsonInput);
    const next = extractCurriculumFromJson(parsed);

    setForm((prev) => ({
      ...prev,
      program: next.program || prev.program,
      programName: next.programName || prev.programName,
      curriculumYear: next.curriculumYear || prev.curriculumYear || '2024',
      structure: next.structure,
    }));

    syncJson(next.structure);

    setFeedback({
      type: 'success',
      text: next.hasMetadata
        ? 'JSON loaded into the builder and curriculum header fields were applied.'
        : 'JSON structure loaded into the builder. Fill in Program Code, Program Name, and Curriculum Year before saving.',
    });
  } catch (error) {
    setFeedback({
      type: 'danger',
      text: error.message || 'Invalid JSON.',
    });
  }
}

  async function handleJsonFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setJsonInput(text);
      setFeedback({
        type: 'success',
        text: `Loaded JSON file: ${file.name}.`,
      });
    } catch {
      setFeedback({
        type: 'danger',
        text: 'Failed to read the selected JSON file.',
      });
    } finally {
      event.target.value = '';
    }
  }

  async function handleCopyJson() {
    try {
      await navigator.clipboard.writeText(prettyJson(form.structure));
      setFeedback({ type: 'success', text: 'Current curriculum JSON copied.' });
    } catch {
      setFeedback({ type: 'danger', text: 'Failed to copy JSON.' });
    }
  }

  function addYear() {
    const label = window.prompt('Enter year label', '1St Year');
    if (!label) return;

    const approved = window.confirm(`Add year "${label.trim()}"?`);
    if (!approved) return;

    const next = cloneStructure(form.structure);
    const key = label.trim();

    if (!key) return;
    if (next[key]) {
      setFeedback({ type: 'danger', text: 'Year label already exists.' });
      return;
    }

    next[key] = {
      '1St Semester': [createEmptySubject()],
    };

    replaceStructure(next);
  }

  function renameYear(oldLabel) {
    const label = window.prompt('Rename year', oldLabel);
    if (!label) return;

    const approved = window.confirm(`Rename "${oldLabel}" to "${label.trim()}"?`);
    if (!approved) return;

    const next = cloneStructure(form.structure);
    const key = label.trim();

    if (!key || key === oldLabel) return;
    if (next[key]) {
      setFeedback({ type: 'danger', text: 'Year label already exists.' });
      return;
    }

    next[key] = next[oldLabel];
    delete next[oldLabel];
    replaceStructure(next);
  }

  function removeYear(yearLabel) {
    const approved = window.confirm(`Remove ${yearLabel}?`);
    if (!approved) return;

    const next = cloneStructure(form.structure);
    delete next[yearLabel];
    replaceStructure(next);
  }

  function addSemester(yearLabel) {
    const label = window.prompt('Enter semester / term label', '1St Semester');
    if (!label) return;

    const approved = window.confirm(`Add "${label.trim()}" to ${yearLabel}?`);
    if (!approved) return;

    const next = cloneStructure(form.structure);
    const key = label.trim();

    if (!key) return;
    if (next[yearLabel][key]) {
      setFeedback({
        type: 'danger',
        text: 'Semester label already exists in this year.',
      });
      return;
    }

    next[yearLabel][key] = [createEmptySubject()];
    replaceStructure(next);
  }

  function renameSemester(yearLabel, oldLabel) {
    const label = window.prompt('Rename semester / term', oldLabel);
    if (!label) return;

    const approved = window.confirm(`Rename "${oldLabel}" to "${label.trim()}" in ${yearLabel}?`);
    if (!approved) return;

    const next = cloneStructure(form.structure);
    const key = label.trim();

    if (!key || key === oldLabel) return;
    if (next[yearLabel][key]) {
      setFeedback({
        type: 'danger',
        text: 'Semester label already exists in this year.',
      });
      return;
    }

    next[yearLabel][key] = next[yearLabel][oldLabel];
    delete next[yearLabel][oldLabel];
    replaceStructure(next);
  }

  function removeSemester(yearLabel, semesterLabel) {
    const approved = window.confirm(`Remove ${semesterLabel} from ${yearLabel}?`);
    if (!approved) return;

    const next = cloneStructure(form.structure);
    delete next[yearLabel][semesterLabel];
    replaceStructure(next);
  }

  function addSubject(yearLabel, semesterLabel) {
    const approved = window.confirm(`Add a new subject to ${semesterLabel}, ${yearLabel}?`);
    if (!approved) return;

    const next = cloneStructure(form.structure);
    next[yearLabel][semesterLabel].push(createEmptySubject());
    replaceStructure(next);
  }

  function updateSubject(yearLabel, semesterLabel, index, field, value) {
    const next = cloneStructure(form.structure);
    next[yearLabel][semesterLabel][index][field] = value;
    replaceStructure(next);
  }

  function removeSubject(yearLabel, semesterLabel, index) {
    const approved = window.confirm(
      `Remove subject #${index + 1} from ${semesterLabel}, ${yearLabel}?`
    );
    if (!approved) return;

    const next = cloneStructure(form.structure);
    next[yearLabel][semesterLabel].splice(index, 1);
    replaceStructure(next);
  }

  function handleCreateNewCurriculum() {
    const approved = confirmDiscardUnsavedChanges(
      'You have unsaved changes. Start a new curriculum without saving?'
    );
    if (!approved) return;
    resetForm('edit');
  }

  function handleSwitchWorkspaceMode(nextMode) {
    setWorkspaceMode(nextMode);
  }

  function handleStartBlankTemplate() {
    const approved = window.confirm(
      'Replace the current structure with a blank starter template?'
    );
    if (!approved) return;
    replaceStructure(createStarterStructure());
  }

  return (
    <>
      <div className="d-flex flex-column gap-4">
        <div>
          <h1 className="h3 mb-1">Curriculum Manager</h1>
          <p className="text-muted mb-0">
            Clean registrar workflow: browse the list, open a curriculum, then switch between view and edit when needed.
          </p>
        </div>

        {feedback.text ? (
          <div className={`alert alert-${feedback.type} mb-0`}>{feedback.text}</div>
        ) : null}

        {hasUnsavedChanges ? (
          <div className="alert alert-warning mb-0">
            You have unsaved changes. Save before leaving this curriculum.
          </div>
        ) : null}

        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
              <div>
                <h2 className="h5 mb-1">Saved Curricula</h2>
                <p className="text-muted mb-0">
                  The page starts with the curriculum list. Open one row to view it or edit it.
                </p>
              </div>

              <div className="d-flex gap-2 flex-wrap">
                <button className="btn btn-outline-secondary" onClick={loadCurricula} disabled={loading}>
                  {loading ? 'Refreshing...' : 'Refresh'}
                </button>
                <button className="btn btn-primary" onClick={handleCreateNewCurriculum}>
                  New Curriculum
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-muted">Loading curricula...</div>
            ) : curricula.length === 0 ? (
              <div className="alert alert-light border mb-0">No curricula saved yet.</div>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Program</th>
                      <th>Program Name</th>
                      <th>Year</th>
                      <th>Subjects</th>
                      <th>Units</th>
                      <th style={{ minWidth: 220 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {curricula.map((item) => {
                      const isSelected = selectedCurriculumId === item._id;

                      return (
                        <tr key={item._id} className={isSelected ? 'table-primary' : ''}>
                          <td className="fw-semibold">{item.program}</td>
                          <td>{item.programName || '—'}</td>
                          <td>{item.curriculumYear || '—'}</td>
                          <td>{item.subjectCount || 0}</td>
                          <td>{item.totalUnits || 0}</td>
                          <td>
                            <div className="d-flex flex-wrap gap-2">
                              <button
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => loadCurriculumIntoWorkspace(item._id, 'view')}
                                disabled={loadingId === item._id}
                              >
                                {loadingId === item._id && !isSelected ? 'Opening...' : 'View'}
                              </button>

                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => loadCurriculumIntoWorkspace(item._id, 'edit')}
                                disabled={loadingId === item._id}
                              >
                                {loadingId === item._id && !isSelected ? 'Opening...' : 'Edit'}
                              </button>

                              <button
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => handleDeleteCurriculum(item._id)}
                                disabled={deletingId === item._id}
                              >
                                {deletingId === item._id ? 'Deleting...' : 'Delete'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
              <div>
                <h2 className="h5 mb-1">Workspace</h2>
                <p className="text-muted mb-0">
                  One workspace only. Switch between viewer and builder instead of showing both at the same time.
                </p>
                {hasUnsavedChanges ? (
                  <div className="small text-warning fw-semibold mt-2">Unsaved changes</div>
                ) : null}
              </div>

              {hasActiveCurriculum || workspaceMode === 'edit' ? (
                <div className="d-flex flex-wrap gap-2">
                  <button
                    className={`btn btn-sm ${workspaceMode === 'view' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => handleSwitchWorkspaceMode('view')}
                    disabled={!hasActiveCurriculum}
                  >
                    View
                  </button>

                  <button
                    className={`btn btn-sm ${workspaceMode === 'edit' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => handleSwitchWorkspaceMode('edit')}
                  >
                    Edit
                  </button>

                  {workspaceMode === 'edit' ? (
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => setJsonModalOpen(true)}>
                      JSON Tools
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {workspaceMode === 'idle' ? (
              <EmptyWorkspace onCreate={handleCreateNewCurriculum} />
            ) : workspaceMode === 'view' ? (
              <CurriculumViewer
                curriculum={{
                  _id: form._id,
                  program: form.program,
                  programName: form.programName,
                  curriculumYear: form.curriculumYear,
                  structure: form.structure,
                }}
              />
            ) : (
              <CurriculumEditor
                form={form}
                stats={stats}
                saving={saving}
                onUpdateMeta={updateMeta}
                onSave={handleSaveCurriculum}
                onAddYear={addYear}
                onResetTemplate={handleStartBlankTemplate}
                onRenameYear={renameYear}
                onRemoveYear={removeYear}
                onAddSemester={addSemester}
                onRenameSemester={renameSemester}
                onRemoveSemester={removeSemester}
                onAddSubject={addSubject}
                onUpdateSubject={updateSubject}
                onRemoveSubject={removeSubject}
              />
            )}
          </div>
        </div>
      </div>

      <JsonToolsModal
        open={jsonModalOpen}
        jsonInput={jsonInput}
        onClose={() => setJsonModalOpen(false)}
        onChange={setJsonInput}
        onUpload={handleJsonFileUpload}
        onCopy={handleCopyJson}
        onLoad={handleLoadJsonToEditor}
      />
    </>
  );
}
