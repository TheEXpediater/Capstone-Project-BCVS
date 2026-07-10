import { useEffect, useMemo, useState } from 'react';
import { FaChevronLeft, FaChevronRight, FaSearch, FaTimes } from 'react-icons/fa';
import { listStudents } from '../../students/studentsAPI';

const PAGE_SIZE = 10;

function cleanText(value) {
  return String(value || '').trim();
}

function getStudentId(student) {
  return String(student?._id || student?.id || student?.studentId || '');
}

function getStudentProgram(student) {
  return (
    student?.programCode ||
    student?.programName ||
    student?.program ||
    student?.curriculum?.program ||
    student?.curriculum?.programName ||
    ''
  );
}

function normalizeStudentResponse(data) {
  if (Array.isArray(data)) {
    return {
      rows: data,
      pagination: {
        page: 1,
        totalPages: 1,
        total: data.length,
      },
    };
  }

  const rows = data?.rows || data?.students || data?.data || [];
  const pagination = data?.pagination || data?.meta || {};

  return {
    rows: Array.isArray(rows) ? rows : [],
    pagination: {
      page: Number(pagination.page || 1),
      totalPages: Number(pagination.totalPages || pagination.pages || 1),
      total: Number(pagination.total || rows.length || 0),
    },
  };
}

export default function SelectStudentsForVcModal({
  open,
  onClose,
  onContinue,
  maxSelection = 50,
}) {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [selected, setSelected] = useState(() => new Map());
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [program, setProgram] = useState('');
  const [graduationStatus, setGraduationStatus] = useState('graduated');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedRows = useMemo(() => Array.from(selected.values()), [selected]);
  const selectedCount = selectedRows.length;

  useEffect(() => {
    if (!open) return;
    setRows([]);
    setPagination({ page: 1, totalPages: 1, total: 0 });
    setSelected(new Map());
    setSearchInput('');
    setSearch('');
    setProgram('');
    setGraduationStatus('graduated');
    setPage(1);
    setError('');
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;

    async function loadRows() {
      try {
        setLoading(true);
        setError('');
        const params = {
          page,
          limit: PAGE_SIZE,
          search,
          program,
        };

        if (graduationStatus === 'graduated') {
          params.graduated = true;
        } else if (graduationStatus === 'active') {
          params.graduated = false;
        }

        const data = await listStudents(params);
        if (cancelled) return;
        const normalized = normalizeStudentResponse(data);
        setRows(normalized.rows);
        setPagination(normalized.pagination);
      } catch (caughtError) {
        if (cancelled) return;
        setRows([]);
        setPagination({ page, totalPages: 1, total: 0 });
        setError(
          caughtError?.response?.data?.message ||
            caughtError?.message ||
            'Failed to load students.'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRows();

    return () => {
      cancelled = true;
    };
  }, [open, page, search, program, graduationStatus]);

  if (!open) return null;

  function toggleStudent(student) {
    const id = getStudentId(student);
    if (!id) return;

    setSelected((current) => {
      const next = new Map(current);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < maxSelection) {
        next.set(id, student);
      }
      return next;
    });
  }

  function applyFilters(event) {
    event.preventDefault();
    setPage(1);
    setSearch(cleanText(searchInput));
  }

  function clearSelection() {
    setSelected(new Map());
  }

  function continueWithSelection() {
    if (!selectedRows.length) return;
    onContinue?.(selectedRows);
  }

  const currentPage = Math.max(1, Number(pagination.page || page || 1));
  const totalPages = Math.max(1, Number(pagination.totalPages || 1));

  return (
    <>
      <div className="modal d-block enterprise-modal" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 className="h5 mb-1">Select Students</h2>
                <p className="text-muted mb-0 small">
                  Search records, choose one or more students, then continue to VC options.
                </p>
              </div>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>

            <div className="modal-body">
              <form className="row g-2 align-items-end mb-3" onSubmit={applyFilters}>
                <div className="col-lg-5">
                  <label className="form-label small fw-semibold" htmlFor="vc-student-search">
                    Search
                  </label>
                  <div className="input-group">
                    <span className="input-group-text">
                      <FaSearch />
                    </span>
                    <input
                      id="vc-student-search"
                      className="form-control"
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      placeholder="Student no. or name"
                    />
                  </div>
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-semibold" htmlFor="vc-student-program">
                    Program
                  </label>
                  <input
                    id="vc-student-program"
                    className="form-control"
                    value={program}
                    onChange={(event) => {
                      setProgram(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Program code"
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label small fw-semibold" htmlFor="vc-student-status">
                    Status
                  </label>
                  <select
                    id="vc-student-status"
                    className="form-select"
                    value={graduationStatus}
                    onChange={(event) => {
                      setGraduationStatus(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="graduated">Graduated</option>
                    <option value="active">Active</option>
                    <option value="">All</option>
                  </select>
                </div>
                <div className="col-md-2 d-grid">
                  <button className="btn btn-primary" type="submit" disabled={loading}>
                    Search
                  </button>
                </div>
              </form>

              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <div className="small text-muted">
                  {selectedCount} selected
                  {selectedCount >= maxSelection ? ` - maximum ${maxSelection} reached` : ''}
                </div>
                {selectedCount ? (
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={clearSelection}>
                    <FaTimes className="me-2" />
                    Clear selection
                  </button>
                ) : null}
              </div>

              {error ? <div className="alert alert-danger">{error}</div> : null}

              <div className="table-responsive border rounded">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 48 }} aria-label="Select" />
                      <th>Student No.</th>
                      <th>Student Name</th>
                      <th>Program</th>
                      <th>Status</th>
                      <th>Graduation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="6" className="text-center text-muted py-4">
                          Loading students...
                        </td>
                      </tr>
                    ) : rows.length ? (
                      rows.map((student) => {
                        const id = getStudentId(student);
                        const checked = selected.has(id);
                        return (
                          <tr
                            key={id || `${student.studentNo}-${student.studentName}`}
                            onClick={() => toggleStudent(student)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td onClick={(event) => event.stopPropagation()}>
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleStudent(student)}
                                disabled={!checked && selectedCount >= maxSelection}
                                aria-label={`Select ${student.studentName || student.studentNo || 'student'}`}
                              />
                            </td>
                            <td className="fw-semibold">{student.studentNo || '-'}</td>
                            <td>{student.studentName || '-'}</td>
                            <td>{getStudentProgram(student) || '-'}</td>
                            <td>{student.studentStatus || (student.graduated ? 'graduated' : 'active')}</td>
                            <td>{student.dateGraduation || student.dateGraduated || '-'}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="6" className="text-center text-muted py-4">
                          No matching students found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
                <div className="small text-muted">
                  Page {currentPage} of {totalPages}
                  {pagination.total ? ` - ${pagination.total} records` : ''}
                </div>
                <div className="btn-group">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={loading || currentPage <= 1}
                  >
                    <FaChevronLeft className="me-1" />
                    Previous
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={loading || currentPage >= totalPages}
                  >
                    Next
                    <FaChevronRight className="ms-1" />
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={continueWithSelection}
                disabled={!selectedCount}
              >
                Continue with {selectedCount || 0}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
