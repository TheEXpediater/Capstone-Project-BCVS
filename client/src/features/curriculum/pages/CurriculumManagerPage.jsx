import { useEffect, useMemo, useState } from 'react';
import {
  FaArrowLeft,
  FaEdit,
  FaEllipsisV,
  FaEye,
  FaFileImport,
  FaPlus,
  FaSave,
  FaTrash,
} from 'react-icons/fa';
import FloatingActionMenu from '../../../components/FloatingActionMenu';
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
    '1st Year': {
      '1st Sem': [createEmptySubject()],
      '2nd Sem': [createEmptySubject()],
    },
  };
}

function createEmptyForm() {
  return {
    _id: '',
    program: '',
    programName: '',
    curriculumYear: '2024',
    structure: createStarterStructure(),
  };
}

function cloneStructure(structure) {
  return JSON.parse(JSON.stringify(structure || {}));
}

function getFirstKey(value) {
  return Object.keys(value || {})[0] || '';
}

function getFirstTerm(structure) {
  const firstYear = getFirstKey(structure);
  return {
    yearLabel: firstYear,
    semesterLabel: getFirstKey(structure?.[firstYear]),
  };
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

function normalizeStructureForSave(structure) {
  const next = {};

  Object.entries(structure || {}).forEach(([yearLabel, semesterMap]) => {
    next[yearLabel] = {};

    Object.entries(semesterMap || {}).forEach(([semesterLabel, subjects]) => {
      next[yearLabel][semesterLabel] = (subjects || []).map((subject) => ({
        code: String(subject?.code || '').trim(),
        title: String(subject?.title || '').trim(),
        units: Number(subject?.units || 0),
        prerequisite: String(subject?.prerequisite || '').trim(),
      }));
    });
  });

  return next;
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

function getDefaultSemesterLabel(existingLabels) {
  const preferred = ['1st Sem', '2nd Sem', 'Mid Year'];
  const match = preferred.find((label) => !existingLabels.includes(label));
  return match || `Term ${existingLabels.length + 1}`;
}

function getYearOptions(structure) {
  const defaults = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];
  const existing = Object.keys(structure || {});
  return Array.from(new Set([...existing, ...defaults]));
}

function getTermTabs(structure) {
  return Object.entries(structure || {}).flatMap(([yearLabel, semesterMap]) =>
    Object.keys(semesterMap || {}).map((semesterLabel) => ({
      key: `${yearLabel}::${semesterLabel}`,
      yearLabel,
      semesterLabel,
    }))
  );
}

function isSameTerm(aYear, aSemester, bYear, bSemester) {
  return aYear === bYear && aSemester === bSemester;
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
          <div className="small text-muted">Terms</div>
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

function AddCurriculumModal({ open, busy, onClose, onManual, onImportFile }) {
  if (!open) return null;

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 className="h5 mb-1">Add Curriculum</h2>
                <p className="text-muted mb-0 small">
                  Choose how to start the curriculum workspace.
                </p>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
                disabled={busy}
                aria-label="Close"
              />
            </div>

            <div className="modal-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="border rounded-4 p-4 h-100 bg-light">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <FaFileImport className="text-primary" />
                      <h3 className="h6 mb-0">Import JSON File</h3>
                    </div>
                    <p className="text-muted small mb-3">
                      Upload a curriculum JSON file. If the file includes program,
                      programName, curriculumYear, and structure, the fields will be filled automatically.
                    </p>
                    <label className="btn btn-outline-primary w-100 mb-0">
                      Select JSON File
                      <input
                        type="file"
                        accept=".json,application/json"
                        hidden
                        onChange={onImportFile}
                        disabled={busy}
                      />
                    </label>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="border rounded-4 p-4 h-100 bg-light">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <FaEdit className="text-primary" />
                      <h3 className="h6 mb-0">Create Manually</h3>
                    </div>
                    <p className="text-muted small mb-3">
                      Start with a clean starter template, then add terms and subjects using the workspace.
                    </p>
                    <button className="btn btn-primary w-100" onClick={onManual} disabled={busy}>
                      Create Manually
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

function ConfirmModal({ open, title, message, confirmText, confirmClassName, busy, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <h2 className="h5 mb-0">{title}</h2>
              <button
                type="button"
                className="btn-close"
                onClick={onCancel}
                disabled={busy}
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              <p className="mb-0">{message}</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onCancel} disabled={busy}>
                Cancel
              </button>
              <button className={confirmClassName || 'btn btn-primary'} onClick={onConfirm} disabled={busy}>
                {busy ? 'Working...' : confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

function TermModal({ open, mode, form, yearOptions, busy, onClose, onChange, onSave }) {
  if (!open) return null;

  const isEdit = mode === 'edit';

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 className="h5 mb-1">{isEdit ? 'Edit Term' : 'Add Term'}</h2>
                <p className="text-muted mb-0 small">
                  Choose the term name and year level. The year is selected manually.
                </p>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
                disabled={busy}
                aria-label="Close"
              />
            </div>

            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label fw-semibold">Term Name</label>
                <input
                  className="form-control"
                  value={form.semesterLabel}
                  onChange={(event) => onChange({ semesterLabel: event.target.value })}
                  placeholder="1st Sem, 2nd Sem, Mid Year"
                  autoFocus
                />
                <div className="form-text">
                  Suggested names are only a guide. You can still type a custom term name.
                </div>
              </div>

              <div>
                <label className="form-label fw-semibold">Year Level</label>
                <select
                  className="form-select"
                  value={form.yearLabel}
                  onChange={(event) => onChange({ yearLabel: event.target.value })}
                >
                  {yearOptions.map((yearLabel) => (
                    <option key={yearLabel} value={yearLabel}>
                      {yearLabel}
                    </option>
                  ))}
                </select>
                <div className="form-text">
                  Use this dropdown to avoid inconsistent year labels.
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={onSave} disabled={busy}>
                {isEdit ? 'Save Term' : 'Add Term'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

function CurriculumViewer({ curriculum }) {
  if (!curriculum) return null;

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
        <div className="alert alert-light border mb-0">This curriculum has no structure yet.</div>
      ) : (
        Object.entries(structure).map(([yearLabel, semesterMap]) => (
          <div className="border rounded-3 p-3" key={yearLabel}>
            <div className="mb-3">
              <h3 className="h6 mb-1">{yearLabel}</h3>
              <div className="text-muted small">
                {Object.keys(semesterMap || {}).length} term(s)
              </div>
            </div>

            <div className="d-flex flex-column gap-3">
              {Object.entries(semesterMap || {}).map(([semesterLabel, subjects]) => (
                <div className="border rounded-3 p-3 bg-light" key={`${yearLabel}-${semesterLabel}`}>
                  <div className="fw-semibold mb-2">{semesterLabel}</div>

                  {!subjects || subjects.length === 0 ? (
                    <div className="alert alert-light border mb-0">No subjects in this term.</div>
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

function ReadOnlyCurriculumModal({ curriculum, onClose, onEdit }) {
  if (!curriculum) return null;

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 className="h5 mb-1">
                  {curriculum.program} {curriculum.curriculumYear}
                </h2>
                <p className="text-muted mb-0 small">
                  {curriculum.programName || 'Read-only curriculum view'}
                </p>
              </div>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>
            <div className="modal-body">
              <CurriculumViewer curriculum={curriculum} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose}>
                Close
              </button>
              <button className="btn btn-primary" onClick={() => onEdit(curriculum)}>
                Edit Curriculum
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

function CurriculumLibrary({
  curricula,
  loading,
  loadingId,
  deletingId,
  selectedCurriculumId,
  openMenuId,
  onRefresh,
  onAdd,
  onView,
  onRequestEdit,
  onRequestDelete,
  onMenuToggle,
  onMenuClose,
}) {
  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
          <div>
            <h2 className="h5 mb-1">Curriculum Library</h2>
            <p className="text-muted mb-0 small">
              Manage saved program curricula from one table. Open a row to view it, or use settings to edit and delete.
            </p>
          </div>

          <div className="d-flex gap-2 flex-wrap">
            <button className="btn btn-outline-secondary" onClick={onRefresh} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button className="btn btn-primary" onClick={onAdd}>
              <FaPlus className="me-2" />
              Add Curriculum
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-muted">Loading curricula...</div>
        ) : curricula.length === 0 ? (
          <div className="alert alert-light border mb-0">
            No curricula saved yet. Use Add Curriculum to create one manually or import JSON.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ minWidth: 130 }}>Program</th>
                  <th style={{ minWidth: 260 }}>Program Name</th>
                  <th style={{ minWidth: 140 }}>Year</th>
                  <th style={{ minWidth: 110 }}>Subjects</th>
                  <th style={{ minWidth: 100 }}>Units</th>
                  <th style={{ width: 150 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {curricula.map((item) => {
                  const isSelected = selectedCurriculumId === item._id;
                  const isBusy = loadingId === item._id || deletingId === item._id;

                  return (
                    <tr key={item._id} className={isSelected ? 'table-primary' : ''}>
                      <td className="fw-semibold">{item.program || '—'}</td>
                      <td>{item.programName || '—'}</td>
                      <td>{item.curriculumYear || '—'}</td>
                      <td>{item.subjectCount || 0}</td>
                      <td>{item.totalUnits || 0}</td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <button
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => onView(item._id)}
                            disabled={isBusy}
                          >
                            <FaEye className="me-1" />
                            {loadingId === item._id ? 'Opening...' : 'View'}
                          </button>

                          <FloatingActionMenu
                            isOpen={openMenuId === item._id}
                            onToggle={() => onMenuToggle(item._id)}
                            onClose={onMenuClose}
                            buttonClassName="btn btn-outline-secondary btn-sm"
                            buttonContent={<FaEllipsisV />}
                            ariaLabel={`Open actions for ${item.program || 'curriculum'}`}
                            menuWidth={190}
                          >
                            <div className="list-group list-group-flush">
                              <button
                                type="button"
                                className="list-group-item list-group-item-action"
                                onClick={() => onRequestEdit(item)}
                                disabled={isBusy}
                              >
                                <FaEdit className="me-2" />
                                Edit
                              </button>
                              <button
                                type="button"
                                className="list-group-item list-group-item-action text-danger"
                                onClick={() => onRequestDelete(item)}
                                disabled={isBusy}
                              >
                                <FaTrash className="me-2" />
                                Delete
                              </button>
                            </div>
                          </FloatingActionMenu>
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
  );
}

function TermTabs({ terms, activeYear, activeSemester, onSelect }) {
  if (!terms.length) {
    return <div className="alert alert-light border mb-0">No term created yet.</div>;
  }

  return (
    <div className="d-flex flex-wrap gap-2">
      {terms.map((term) => {
        const isActive = isSameTerm(
          activeYear,
          activeSemester,
          term.yearLabel,
          term.semesterLabel
        );

        return (
          <button
            key={term.key}
            className={`btn btn-sm text-start ${isActive ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => onSelect(term.yearLabel, term.semesterLabel)}
            type="button"
            style={{ minWidth: 118 }}
          >
            <span className="d-block fw-semibold">{term.semesterLabel}</span>
            <span className={`d-block small ${isActive ? 'text-white-50' : 'text-muted'}`}>
              {term.yearLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SubjectTable({
  subjects,
  activeYear,
  activeSemester,
  openSubjectMenuKey,
  onAddSubject,
  onUpdateSubject,
  onDuplicateSubject,
  onRemoveSubject,
  onSubjectMenuToggle,
  onSubjectMenuClose,
}) {
  if (!activeYear || !activeSemester) {
    return <div className="alert alert-light border mb-0">Create a term before adding subjects.</div>;
  }

  return (
    <div className="border rounded-3 bg-white overflow-hidden">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 p-3 border-bottom bg-light">
        <div>
          <div className="fw-semibold">{activeSemester}</div>
          <div className="small text-muted">{activeYear}</div>
        </div>
        <button className="btn btn-outline-primary btn-sm" onClick={onAddSubject} type="button">
          <FaPlus className="me-1" />
          Add Subject
        </button>
      </div>

      {!subjects.length ? (
        <div className="p-3">
          <div className="alert alert-light border mb-0">No subjects yet for this term.</div>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th style={{ minWidth: 140 }}>Code</th>
                <th style={{ minWidth: 300 }}>Title</th>
                <th style={{ minWidth: 100 }}>Units</th>
                <th style={{ minWidth: 230 }}>Prerequisite</th>
                <th style={{ width: 90 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject, index) => {
                const rowKey = `${activeYear}-${activeSemester}-${index}`;

                return (
                  <tr key={rowKey}>
                    <td>
                      <input
                        className="form-control form-control-sm"
                        value={subject.code || ''}
                        onChange={(event) => onUpdateSubject(index, 'code', event.target.value)}
                        placeholder="Code"
                      />
                    </td>
                    <td>
                      <input
                        className="form-control form-control-sm"
                        value={subject.title || ''}
                        onChange={(event) => onUpdateSubject(index, 'title', event.target.value)}
                        placeholder="Subject title"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        className="form-control form-control-sm"
                        value={subject.units ?? 0}
                        onChange={(event) => onUpdateSubject(index, 'units', event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="form-control form-control-sm"
                        value={subject.prerequisite || ''}
                        onChange={(event) => onUpdateSubject(index, 'prerequisite', event.target.value)}
                        placeholder="Optional"
                      />
                    </td>
                    <td>
                      <FloatingActionMenu
                        isOpen={openSubjectMenuKey === rowKey}
                        onToggle={() => onSubjectMenuToggle(rowKey)}
                        onClose={onSubjectMenuClose}
                        buttonClassName="btn btn-outline-secondary btn-sm"
                        buttonContent={<FaEllipsisV />}
                        ariaLabel="Open subject actions"
                        menuWidth={180}
                      >
                        <div className="list-group list-group-flush">
                          <button
                            type="button"
                            className="list-group-item list-group-item-action"
                            onClick={() => onDuplicateSubject(index)}
                          >
                            Duplicate
                          </button>
                          <button
                            type="button"
                            className="list-group-item list-group-item-action text-danger"
                            onClick={() => onRemoveSubject(index)}
                          >
                            Delete
                          </button>
                        </div>
                      </FloatingActionMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CurriculumWorkspace({
  form,
  stats,
  saving,
  hasUnsavedChanges,
  activeYear,
  activeSemester,
  openBuilderMenu,
  openSubjectMenuKey,
  onBack,
  onSave,
  onUpdateMeta,
  onSelectTerm,
  onOpenAddTerm,
  onOpenEditTerm,
  onRemoveSemester,
  onAddSubject,
  onUpdateSubject,
  onDuplicateSubject,
  onRemoveSubject,
  onBuilderMenuToggle,
  onBuilderMenuClose,
  onSubjectMenuToggle,
  onSubjectMenuClose,
}) {
  const structure = form.structure || {};
  const terms = getTermTabs(structure);
  const subjects = structure[activeYear]?.[activeSemester] || [];

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
          <div>
            <button className="btn btn-outline-secondary btn-sm mb-3" onClick={onBack} type="button">
              <FaArrowLeft className="me-1" />
              Back to Library
            </button>
            <h2 className="h5 mb-1">Curriculum Workspace</h2>
            <p className="text-muted mb-0 small">
              Add terms by choosing both the term name and year level. No automatic year shifting is applied.
            </p>
            {hasUnsavedChanges ? (
              <div className="small text-warning fw-semibold mt-2">Unsaved changes</div>
            ) : null}
          </div>

          <button className="btn btn-primary" onClick={onSave} disabled={saving} type="button">
            <FaSave className="me-2" />
            {saving ? 'Saving...' : 'Save Curriculum'}
          </button>
        </div>

        <div className="border rounded-3 p-3 mb-4 bg-light">
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label fw-semibold">Program Code</label>
              <input
                className="form-control"
                value={form.program}
                onChange={(event) => onUpdateMeta('program', event.target.value.toUpperCase())}
                placeholder="BSIT"
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
        </div>

        <div className="mb-4">
          <CurriculumSummaryCards stats={stats} />
        </div>

        <div className="border rounded-3 p-3 mb-3">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <div>
              <h3 className="h6 mb-1">Terms</h3>
              <div className="text-muted small">
                Each term has a selected year level. The year dropdown prevents inconsistent labels.
              </div>
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-primary btn-sm" onClick={onOpenAddTerm} type="button">
                <FaPlus className="me-1" />
                Add Term
              </button>
              <FloatingActionMenu
                isOpen={openBuilderMenu === 'semester'}
                onToggle={() => onBuilderMenuToggle('semester')}
                onClose={onBuilderMenuClose}
                buttonClassName="btn btn-outline-secondary btn-sm"
                buttonContent={<FaEllipsisV />}
                ariaLabel="Open term actions"
                menuWidth={200}
              >
                <div className="list-group list-group-flush">
                  <button
                    type="button"
                    className="list-group-item list-group-item-action"
                    onClick={onOpenEditTerm}
                    disabled={!activeSemester}
                  >
                    Edit Active Term
                  </button>
                  <button
                    type="button"
                    className="list-group-item list-group-item-action text-danger"
                    onClick={onRemoveSemester}
                    disabled={!activeSemester}
                  >
                    Delete Active Term
                  </button>
                </div>
              </FloatingActionMenu>
            </div>
          </div>
          <TermTabs
            terms={terms}
            activeYear={activeYear}
            activeSemester={activeSemester}
            onSelect={onSelectTerm}
          />
        </div>

        <SubjectTable
          subjects={subjects}
          activeYear={activeYear}
          activeSemester={activeSemester}
          openSubjectMenuKey={openSubjectMenuKey}
          onAddSubject={onAddSubject}
          onUpdateSubject={onUpdateSubject}
          onDuplicateSubject={onDuplicateSubject}
          onRemoveSubject={onRemoveSubject}
          onSubjectMenuToggle={onSubjectMenuToggle}
          onSubjectMenuClose={onSubjectMenuClose}
        />
      </div>
    </div>
  );
}

export default function CurriculumManagerPage() {
  const [curricula, setCurricula] = useState([]);
  const [selectedCurriculumId, setSelectedCurriculumId] = useState('');
  const [pageMode, setPageMode] = useState('library');
  const [form, setForm] = useState(() => createEmptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [loadingId, setLoadingId] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [viewingCurriculum, setViewingCurriculum] = useState(null);
  const [editConfirmItem, setEditConfirmItem] = useState(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);
  const [termModal, setTermModal] = useState({
    open: false,
    mode: 'add',
    yearLabel: '1st Year',
    semesterLabel: '1st Sem',
    originalYearLabel: '',
    originalSemesterLabel: '',
  });
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [baselineSnapshot, setBaselineSnapshot] = useState(() => getFormSnapshot(createEmptyForm()));
  const [activeYear, setActiveYear] = useState('1st Year');
  const [activeSemester, setActiveSemester] = useState('1st Sem');
  const [openLibraryMenuId, setOpenLibraryMenuId] = useState('');
  const [openBuilderMenu, setOpenBuilderMenu] = useState('');
  const [openSubjectMenuKey, setOpenSubjectMenuKey] = useState('');

  const stats = useMemo(() => summarizeStructure(form.structure), [form.structure]);
  const currentSnapshot = useMemo(() => getFormSnapshot(form), [form]);
  const hasUnsavedChanges = currentSnapshot !== baselineSnapshot;
  const yearOptions = useMemo(() => getYearOptions(form.structure), [form.structure]);

  useEffect(() => {
    loadCurricula();
  }, []);

  useEffect(() => {
    const structure = form.structure || {};
    const firstTerm = getFirstTerm(structure);

    if (!firstTerm.yearLabel) {
      if (activeYear) setActiveYear('');
      if (activeSemester) setActiveSemester('');
      return;
    }

    if (!activeYear || !structure[activeYear]) {
      setActiveYear(firstTerm.yearLabel);
      setActiveSemester(firstTerm.semesterLabel);
      return;
    }

    const semesters = Object.keys(structure[activeYear] || {});
    if (!semesters.length) {
      setActiveYear(firstTerm.yearLabel);
      setActiveSemester(firstTerm.semesterLabel);
      return;
    }

    if (!activeSemester || !structure[activeYear][activeSemester]) {
      setActiveSemester(semesters[0]);
    }
  }, [form.structure, activeYear, activeSemester]);

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

  function syncBaseline(nextForm) {
    setBaselineSnapshot(getFormSnapshot(nextForm));
  }

  function confirmDiscardUnsavedChanges(message = 'You have unsaved changes. Continue without saving?') {
    if (!hasUnsavedChanges) return true;
    return window.confirm(message);
  }

  function openWorkspace(nextForm, message = '', options = {}) {
    const firstTerm = getFirstTerm(nextForm.structure);

    setForm(nextForm);
    setSelectedCurriculumId(nextForm._id || '');
    setActiveYear(firstTerm.yearLabel);
    setActiveSemester(firstTerm.semesterLabel);
    setPageMode('workspace');
    setViewingCurriculum(null);
    setAddModalOpen(false);
    setOpenLibraryMenuId('');
    setOpenBuilderMenu('');
    setOpenSubjectMenuKey('');
    syncBaseline(options.baselineForm || nextForm);

    if (message) {
      setFeedback({ type: 'success', text: message });
    }
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

  async function openCurriculumReadOnly(id) {
    try {
      setLoadingId(id);
      const data = await getCurriculumById(id);
      setViewingCurriculum(data);
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

  async function loadCurriculumIntoWorkspace(id) {
    if (!confirmDiscardUnsavedChanges('You have unsaved changes. Open another curriculum without saving?')) {
      return;
    }

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

      openWorkspace(next, `Editing ${next.program || 'curriculum'} ${next.curriculumYear || ''}.`);
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

  function handleAddCurriculum() {
    if (!confirmDiscardUnsavedChanges('You have unsaved changes. Start a new curriculum without saving?')) {
      return;
    }

    setFeedback({ type: '', text: '' });
    setAddModalOpen(true);
  }

  function handleManualCreate() {
    const next = createEmptyForm();
    openWorkspace(next, 'New manual curriculum workspace created.');
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const imported = extractCurriculumFromJson(parsed);
      const next = {
        _id: '',
        program: imported.program || '',
        programName: imported.programName || '',
        curriculumYear: imported.curriculumYear || '2024',
        structure: imported.structure || createStarterStructure(),
      };

      openWorkspace(
        next,
        imported.hasMetadata
          ? `Imported ${file.name}. Curriculum header fields were applied.`
          : `Imported ${file.name}. Fill in Program Code, Program Name, and Curriculum Year before saving.`,
        { baselineForm: createEmptyForm() }
      );
    } catch (error) {
      setFeedback({
        type: 'danger',
        text: error.message || 'Failed to import JSON file.',
      });
    } finally {
      event.target.value = '';
    }
  }

  async function handleSaveCurriculum() {
    const program = form.program.trim().toUpperCase();
    const programName = form.programName.trim();
    const curriculumYear = form.curriculumYear.trim();

    if (!program) {
      setFeedback({ type: 'danger', text: 'Program code is required before saving.' });
      return;
    }

    if (!curriculumYear) {
      setFeedback({ type: 'danger', text: 'Curriculum year is required before saving.' });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        program,
        programName,
        curriculumYear,
        structure: normalizeStructureForSave(form.structure),
      };

      const saved = await saveCurriculum(payload);
      const next = {
        _id: saved._id,
        program: saved.program || program,
        programName: saved.programName || programName,
        curriculumYear: saved.curriculumYear || curriculumYear,
        structure: saved.structure || payload.structure,
      };

      setForm(next);
      setSelectedCurriculumId(saved._id || '');
      syncBaseline(next);
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

  async function handleDeleteCurriculum() {
    if (!deleteConfirmItem?._id) return;

    try {
      setDeletingId(deleteConfirmItem._id);
      await deleteCurriculum(deleteConfirmItem._id);

      if (form._id === deleteConfirmItem._id) {
        const next = createEmptyForm();
        setForm(next);
        syncBaseline(next);
        setSelectedCurriculumId('');
        setPageMode('library');
      }

      setDeleteConfirmItem(null);
      setOpenLibraryMenuId('');
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

  function handleBackToLibrary() {
    if (!confirmDiscardUnsavedChanges('You have unsaved changes. Return to the library without saving?')) {
      return;
    }

    setPageMode('library');
    setOpenBuilderMenu('');
    setOpenSubjectMenuKey('');
    syncBaseline(form);
  }

  function requestEdit(item) {
    setOpenLibraryMenuId('');
    setEditConfirmItem(item);
  }

  function requestDelete(item) {
    setOpenLibraryMenuId('');
    setDeleteConfirmItem(item);
  }

  function openAddTermModal() {
    const defaultYear = activeYear || yearOptions[0] || '1st Year';
    const suggestedTerm = getDefaultSemesterLabel(Object.keys(form.structure?.[defaultYear] || {}));

    setOpenBuilderMenu('');
    setTermModal({
      open: true,
      mode: 'add',
      yearLabel: defaultYear,
      semesterLabel: suggestedTerm,
      originalYearLabel: '',
      originalSemesterLabel: '',
    });
  }

  function openEditTermModal() {
    if (!activeYear || !activeSemester) return;

    setOpenBuilderMenu('');
    setTermModal({
      open: true,
      mode: 'edit',
      yearLabel: activeYear,
      semesterLabel: activeSemester,
      originalYearLabel: activeYear,
      originalSemesterLabel: activeSemester,
    });
  }

  function closeTermModal() {
    setTermModal((prev) => ({
      ...prev,
      open: false,
    }));
  }

  function updateTermModal(partial) {
    setTermModal((prev) => {
      const next = { ...prev, ...partial };

      if (prev.mode === 'add' && partial.yearLabel && partial.yearLabel !== prev.yearLabel) {
        next.semesterLabel = getDefaultSemesterLabel(
          Object.keys(form.structure?.[partial.yearLabel] || {})
        );
      }

      return next;
    });
  }

  function saveTermModal() {
    const yearLabel = termModal.yearLabel;
    const semesterLabel = termModal.semesterLabel.trim();

    if (!yearLabel) {
      setFeedback({ type: 'danger', text: 'Choose a year level for the term.' });
      return;
    }

    if (!semesterLabel) {
      setFeedback({ type: 'danger', text: 'Term name is required.' });
      return;
    }

    const next = cloneStructure(form.structure);
    if (!next[yearLabel]) next[yearLabel] = {};

    if (termModal.mode === 'add') {
      if (next[yearLabel][semesterLabel]) {
        setFeedback({ type: 'danger', text: 'That term already exists in the selected year.' });
        return;
      }

      next[yearLabel][semesterLabel] = [createEmptySubject()];
      replaceStructure(next);
      setActiveYear(yearLabel);
      setActiveSemester(semesterLabel);
      closeTermModal();
      setFeedback({ type: 'success', text: `${semesterLabel} added to ${yearLabel}.` });
      return;
    }

    const originalYear = termModal.originalYearLabel;
    const originalSemester = termModal.originalSemesterLabel;

    if (!next[originalYear]?.[originalSemester]) {
      setFeedback({ type: 'danger', text: 'The selected term no longer exists.' });
      return;
    }

    const targetChanged = !isSameTerm(originalYear, originalSemester, yearLabel, semesterLabel);
    if (targetChanged && next[yearLabel][semesterLabel]) {
      setFeedback({ type: 'danger', text: 'That term already exists in the selected year.' });
      return;
    }

    const subjects = next[originalYear][originalSemester];
    delete next[originalYear][originalSemester];

    if (Object.keys(next[originalYear] || {}).length === 0) {
      delete next[originalYear];
    }

    if (!next[yearLabel]) next[yearLabel] = {};
    next[yearLabel][semesterLabel] = subjects;

    replaceStructure(next);
    setActiveYear(yearLabel);
    setActiveSemester(semesterLabel);
    closeTermModal();
    setFeedback({ type: 'success', text: 'Term updated successfully.' });
  }

  function removeSemester() {
    if (!activeYear || !activeSemester) return;

    const approved = window.confirm(`Delete ${activeSemester} from ${activeYear}?`);
    if (!approved) return;

    const next = cloneStructure(form.structure);
    delete next[activeYear][activeSemester];

    if (Object.keys(next[activeYear] || {}).length === 0) {
      delete next[activeYear];
    }

    const firstTerm = getFirstTerm(next);
    replaceStructure(next);
    setActiveYear(firstTerm.yearLabel);
    setActiveSemester(firstTerm.semesterLabel);
    setOpenBuilderMenu('');
  }

  function addSubject() {
    if (!activeYear || !activeSemester) return;

    const next = cloneStructure(form.structure);
    next[activeYear][activeSemester].push(createEmptySubject());
    replaceStructure(next);
  }

  function updateSubject(index, field, value) {
    if (!activeYear || !activeSemester) return;

    const next = cloneStructure(form.structure);
    next[activeYear][activeSemester][index][field] = value;
    replaceStructure(next);
  }

  function duplicateSubject(index) {
    if (!activeYear || !activeSemester) return;

    const next = cloneStructure(form.structure);
    const current = next[activeYear][activeSemester][index] || createEmptySubject();
    next[activeYear][activeSemester].splice(index + 1, 0, { ...current });
    replaceStructure(next);
    setOpenSubjectMenuKey('');
  }

  function removeSubject(index) {
    if (!activeYear || !activeSemester) return;

    const approved = window.confirm(`Delete subject row #${index + 1}?`);
    if (!approved) return;

    const next = cloneStructure(form.structure);
    next[activeYear][activeSemester].splice(index, 1);
    replaceStructure(next);
    setOpenSubjectMenuKey('');
  }

  return (
    <>
      <div className="d-flex flex-column gap-4">
        {feedback.text ? (
          <div className={`alert alert-${feedback.type} mb-0`}>{feedback.text}</div>
        ) : null}

        {pageMode === 'workspace' && hasUnsavedChanges ? (
          <div className="alert alert-warning mb-0">
            You have unsaved changes. Save before leaving this curriculum.
          </div>
        ) : null}

        {pageMode === 'library' ? (
          <CurriculumLibrary
            curricula={curricula}
            loading={loading}
            loadingId={loadingId}
            deletingId={deletingId}
            selectedCurriculumId={selectedCurriculumId}
            openMenuId={openLibraryMenuId}
            onRefresh={loadCurricula}
            onAdd={handleAddCurriculum}
            onView={openCurriculumReadOnly}
            onRequestEdit={requestEdit}
            onRequestDelete={requestDelete}
            onMenuToggle={(id) => setOpenLibraryMenuId((current) => (current === id ? '' : id))}
            onMenuClose={() => setOpenLibraryMenuId('')}
          />
        ) : (
          <CurriculumWorkspace
            form={form}
            stats={stats}
            saving={saving}
            hasUnsavedChanges={hasUnsavedChanges}
            activeYear={activeYear}
            activeSemester={activeSemester}
            openBuilderMenu={openBuilderMenu}
            openSubjectMenuKey={openSubjectMenuKey}
            onBack={handleBackToLibrary}
            onSave={handleSaveCurriculum}
            onUpdateMeta={updateMeta}
            onSelectTerm={(year, semester) => {
              setActiveYear(year);
              setActiveSemester(semester);
            }}
            onOpenAddTerm={openAddTermModal}
            onOpenEditTerm={openEditTermModal}
            onRemoveSemester={removeSemester}
            onAddSubject={addSubject}
            onUpdateSubject={updateSubject}
            onDuplicateSubject={duplicateSubject}
            onRemoveSubject={removeSubject}
            onBuilderMenuToggle={(menu) => setOpenBuilderMenu((current) => (current === menu ? '' : menu))}
            onBuilderMenuClose={() => setOpenBuilderMenu('')}
            onSubjectMenuToggle={(key) => setOpenSubjectMenuKey((current) => (current === key ? '' : key))}
            onSubjectMenuClose={() => setOpenSubjectMenuKey('')}
          />
        )}
      </div>

      <AddCurriculumModal
        open={addModalOpen}
        busy={loading}
        onClose={() => setAddModalOpen(false)}
        onManual={handleManualCreate}
        onImportFile={handleImportFile}
      />

      <TermModal
        open={termModal.open}
        mode={termModal.mode}
        form={termModal}
        yearOptions={yearOptions}
        busy={saving}
        onClose={closeTermModal}
        onChange={updateTermModal}
        onSave={saveTermModal}
      />

      <ReadOnlyCurriculumModal
        curriculum={viewingCurriculum}
        onClose={() => setViewingCurriculum(null)}
        onEdit={(curriculum) => {
          setViewingCurriculum(null);
          setEditConfirmItem(curriculum);
        }}
      />

      <ConfirmModal
        open={Boolean(editConfirmItem)}
        title="Edit Curriculum"
        message={`Edit this ${editConfirmItem?.program || ''} ${editConfirmItem?.curriculumYear || ''} curriculum? It will load into the workspace.`}
        confirmText="Edit in Workspace"
        busy={loadingId === editConfirmItem?._id}
        onCancel={() => setEditConfirmItem(null)}
        onConfirm={async () => {
          const id = editConfirmItem?._id;
          setEditConfirmItem(null);
          if (id) await loadCurriculumIntoWorkspace(id);
        }}
      />

      <ConfirmModal
        open={Boolean(deleteConfirmItem)}
        title="Delete Curriculum"
        message={`Delete ${deleteConfirmItem?.program || 'this curriculum'} ${deleteConfirmItem?.curriculumYear || ''}? This action cannot be undone.`}
        confirmText="Delete Curriculum"
        confirmClassName="btn btn-danger"
        busy={deletingId === deleteConfirmItem?._id}
        onCancel={() => setDeleteConfirmItem(null)}
        onConfirm={handleDeleteCurriculum}
      />
    </>
  );
}
