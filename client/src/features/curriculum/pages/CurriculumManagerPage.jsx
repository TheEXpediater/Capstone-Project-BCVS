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

function CurriculumViewer({ curriculum }) {
  if (!curriculum) {
    return (
      <div className="alert alert-light border mb-0">
        Select a curriculum from the list to view the full structure.
      </div>
    );
  }

  const structure = curriculum.structure || {};
  const stats = summarizeStructure(structure);

  return (
    <div className="d-flex flex-column gap-4">
      <div className="border rounded-3 p-3 bg-light">
        <div className="row g-3">
          <div className="col-md-3">
            <div className="small text-muted">Program</div>
            <div className="fw-semibold">{curriculum.program || '—'}</div>
          </div>

          <div className="col-md-5">
            <div className="small text-muted">Program Name</div>
            <div className="fw-semibold">{curriculum.programName || '—'}</div>
          </div>

          <div className="col-md-2">
            <div className="small text-muted">Curriculum Year</div>
            <div className="fw-semibold">{curriculum.curriculumYear || '—'}</div>
          </div>

          <div className="col-md-2">
            <div className="small text-muted">Subjects</div>
            <div className="fw-semibold">{stats.subjects}</div>
          </div>
        </div>

        <div className="row g-3 mt-1">
          <div className="col-md-4">
            <div className="small text-muted">Years</div>
            <div className="fw-semibold">{stats.years}</div>
          </div>

          <div className="col-md-4">
            <div className="small text-muted">Semesters / Terms</div>
            <div className="fw-semibold">{stats.semesters}</div>
          </div>

          <div className="col-md-4">
            <div className="small text-muted">Total Units</div>
            <div className="fw-semibold">{stats.units}</div>
          </div>
        </div>
      </div>

      {Object.keys(structure).length === 0 ? (
        <div className="alert alert-light border mb-0">
          This curriculum has no structure yet.
        </div>
      ) : (
        Object.entries(structure).map(([yearLabel, semesterMap]) => (
          <div className="border rounded-3 p-3" key={yearLabel}>
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div>
                <h3 className="h6 mb-1">{yearLabel}</h3>
                <div className="text-muted small">
                  {Object.keys(semesterMap || {}).length} semester(s) / term(s)
                </div>
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

const EMPTY_FORM = {
  _id: '',
  program: '',
  programName: '',
  curriculumYear: '2024',
  structure: createStarterStructure(),
};

export default function CurriculumManagerPage() {
  const [curricula, setCurricula] = useState([]);
  const [selectedCurriculumId, setSelectedCurriculumId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [jsonInput, setJsonInput] = useState(prettyJson(createStarterStructure()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [loadingId, setLoadingId] = useState('');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const stats = useMemo(() => summarizeStructure(form.structure), [form.structure]);

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

  useEffect(() => {
    loadCurricula();
  }, []);

  function syncJson(structure) {
    setJsonInput(prettyJson(structure));
  }

  function resetForm() {
    const next = {
      _id: '',
      program: '',
      programName: '',
      curriculumYear: '2024',
      structure: createStarterStructure(),
    };

    setForm(next);
    setSelectedCurriculumId('');
    syncJson(next.structure);
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

  async function handleOpenCurriculum(id) {
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
      syncJson(next.structure);
      setFeedback({
        type: 'success',
        text: `Loaded ${data.program} ${data.curriculumYear}.`,
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
    try {
      setSaving(true);

      const payload = {
        program: form.program.trim().toUpperCase(),
        programName: form.programName.trim(),
        curriculumYear: form.curriculumYear.trim(),
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
          error.response?.data?.message || error.message || 'Failed to save curriculum.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCurriculum(id) {
    const approved = window.confirm(
      'Delete this curriculum? This action cannot be undone.'
    );

    if (!approved) return;

    try {
      setDeletingId(id);
      await deleteCurriculum(id);

      if (form._id === id) {
        resetForm();
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

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('JSON must be an object with years and semesters.');
      }

      replaceStructure(parsed);
      setFeedback({ type: 'success', text: 'Optional JSON loaded into the builder.' });
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
        text: `Loaded JSON file: ${file.name}. Click "Load JSON Into Builder".`,
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
    const next = cloneStructure(form.structure);
    next[yearLabel][semesterLabel].splice(index, 1);
    replaceStructure(next);
  }

  return (
    <div className="d-flex flex-column gap-4">
      <div>
        <h1 className="h3 mb-1">Curriculum Manager</h1>
        <p className="text-muted mb-0">
          Manual curriculum builder for registrar use, with full saved-curriculum viewer.
        </p>
      </div>

      {feedback.text ? (
        <div className={`alert alert-${feedback.type} mb-0`}>{feedback.text}</div>
      ) : null}

      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
            <div>
              <h2 className="h5 mb-1">Saved Curricula</h2>
              <p className="text-muted mb-0">
                Select one curriculum to view the full structure and continue editing it.
              </p>
            </div>

            <button className="btn btn-outline-secondary" onClick={resetForm}>
              New Curriculum
            </button>
          </div>

          {loading ? (
            <div className="text-muted">Loading curricula...</div>
          ) : curricula.length === 0 ? (
            <div className="alert alert-light border mb-0">
              No curricula saved yet.
            </div>
          ) : (
            <div className="row g-3">
              {curricula.map((item) => {
                const isSelected = selectedCurriculumId === item._id;

                return (
                  <div className="col-xl-4 col-md-6" key={item._id}>
                    <div
                      className={`border rounded-3 p-3 h-100 ${
                        isSelected ? 'border-primary bg-light' : ''
                      }`}
                    >
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div>
                          <div className="fw-semibold">{item.program}</div>
                          <div className="text-muted small">
                            {item.programName || 'No program name'}
                          </div>
                        </div>

                        {isSelected ? (
                          <span className="badge text-bg-primary">Selected</span>
                        ) : null}
                      </div>

                      <div className="small mt-2">
                        Curriculum Year: <strong>{item.curriculumYear}</strong>
                      </div>
                      <div className="small">
                        Subjects: <strong>{item.subjectCount || 0}</strong>
                      </div>
                      <div className="small">
                        Units: <strong>{item.totalUnits || 0}</strong>
                      </div>

                      <div className="d-flex gap-2 mt-3">
                        <button
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => handleOpenCurriculum(item._id)}
                          disabled={loadingId === item._id}
                        >
                          {loadingId === item._id ? 'Opening...' : 'Open & View'}
                        </button>

                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => handleDeleteCurriculum(item._id)}
                          disabled={deletingId === item._id}
                        >
                          {deletingId === item._id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <h2 className="h5 mb-1">Selected Curriculum Viewer</h2>
              <p className="text-muted mb-0">
                Full curriculum preview for the currently selected record.
              </p>
            </div>
          </div>

          <CurriculumViewer
            curriculum={{
              _id: form._id,
              program: form.program,
              programName: form.programName,
              curriculumYear: form.curriculumYear,
              structure: form.structure,
            }}
          />
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <h2 className="h5 mb-3">Curriculum Header</h2>

          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label fw-semibold">Program Code</label>
              <input
                className="form-control"
                value={form.program}
                onChange={(event) =>
                  updateMeta('program', event.target.value.toUpperCase())
                }
                placeholder="BSABE"
              />
            </div>

            <div className="col-md-5">
              <label className="form-label fw-semibold">Program Name</label>
              <input
                className="form-control"
                value={form.programName}
                onChange={(event) => updateMeta('programName', event.target.value)}
                placeholder="Program name"
              />
            </div>

            <div className="col-md-4">
              <label className="form-label fw-semibold">Curriculum Year</label>
              <input
                className="form-control"
                value={form.curriculumYear}
                onChange={(event) => updateMeta('curriculumYear', event.target.value)}
                placeholder="2024"
              />
            </div>
          </div>

          <div className="row g-3 mt-1">
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

          <div className="mt-4 d-flex justify-content-end">
            <button
              className="btn btn-primary"
              onClick={handleSaveCurriculum}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Curriculum'}
            </button>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
            <div>
              <h2 className="h5 mb-1">Manual Curriculum Builder</h2>
              <p className="text-muted mb-0">
                Main registrar workflow for creating and editing curriculum records.
              </p>
            </div>

            <div className="d-flex gap-2 flex-wrap">
              <button className="btn btn-outline-primary btn-sm" onClick={addYear}>
                Add Year
              </button>

              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => replaceStructure(createStarterStructure())}
              >
                Start Blank Template
              </button>
            </div>
          </div>

          {Object.keys(form.structure || {}).length === 0 ? (
            <div className="alert alert-light border mb-0">
              No year created yet.
            </div>
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
                        onClick={() => renameYear(yearLabel)}
                      >
                        Rename Year
                      </button>

                      <button
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => addSemester(yearLabel)}
                      >
                        Add Semester
                      </button>

                      <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => removeYear(yearLabel)}
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
                              onClick={() => renameSemester(yearLabel, semesterLabel)}
                            >
                              Rename Semester
                            </button>

                            <button
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => addSubject(yearLabel, semesterLabel)}
                            >
                              Add Subject
                            </button>

                            <button
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => removeSemester(yearLabel, semesterLabel)}
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
                                          updateSubject(
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
                                          updateSubject(
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
                                          updateSubject(
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
                                          updateSubject(
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
                                        onClick={() =>
                                          removeSubject(yearLabel, semesterLabel, index)
                                        }
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

          <div className="mt-4 d-flex justify-content-end">
            <button
              className="btn btn-primary"
              onClick={handleSaveCurriculum}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Curriculum'}
            </button>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
            <div>
              <h2 className="h5 mb-1">Optional JSON Tools</h2>
              <p className="text-muted mb-0">
                Optional helper only. You can ignore this if you want fully manual input.
              </p>
            </div>

            <div className="d-flex gap-2 flex-wrap">
              <label className="btn btn-outline-secondary btn-sm mb-0">
                Upload JSON File
                <input
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={handleJsonFileUpload}
                />
              </label>

              <button className="btn btn-outline-dark btn-sm" onClick={handleCopyJson}>
                Copy Current JSON
              </button>

              <button className="btn btn-primary btn-sm" onClick={handleLoadJsonToEditor}>
                Load JSON Into Builder
              </button>
            </div>
          </div>

          <textarea
            className="form-control font-monospace"
            rows="14"
            value={jsonInput}
            onChange={(event) => setJsonInput(event.target.value)}
            placeholder="Optional JSON helper area"
          />
        </div>
      </div>
    </div>
  );
}