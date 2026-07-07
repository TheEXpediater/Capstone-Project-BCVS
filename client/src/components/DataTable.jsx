import { useMemo } from 'react';
import { FaEye } from 'react-icons/fa';

function rowId(row, rowKey) {
  if (typeof rowKey === 'function') return rowKey(row);
  return row?.[rowKey] || row?._id || row?.id;
}

function selectedSet(selectedRows) {
  if (selectedRows instanceof Set) return selectedRows;
  return new Set(Array.isArray(selectedRows) ? selectedRows : []);
}

export default function DataTable({
  rows = [],
  columns = [],
  rowKey = '_id',
  selectable = true,
  clickable = false,
  showDetailsButton = true,
  selectedRows = [],
  activeRecord = null,
  loading = false,
  loadingText = 'Loading...',
  emptyText = 'No records found.',
  actionsHeader = 'Actions',
  getRowDisabled = () => false,
  onToggleRow,
  onToggleAll,
  onViewDetails,
  renderActions,
}) {
  const selected = useMemo(() => selectedSet(selectedRows), [selectedRows]);
  const selectableRows = rows.filter((row) => !getRowDisabled(row));
  const selectableIds = selectableRows.map((row) => rowId(row, rowKey)).filter(Boolean);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const activeId = activeRecord ? rowId(activeRecord, rowKey) : '';

  function toggleRow(row) {
    if (!selectable || getRowDisabled(row)) return;
    const id = rowId(row, rowKey);
    if (!id) return;
    onToggleRow?.(id, !selected.has(id), row);
  }

  const actionColumnVisible = showDetailsButton || Boolean(renderActions);

  return (
    <div className="table-responsive">
      <table className="table align-middle mb-0 mis-table">
        <thead>
          <tr>
            {selectable ? (
              <th className="mis-table-checkbox">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={allSelected}
                  onChange={(event) => onToggleAll?.(selectableIds, event.target.checked)}
                  disabled={!selectableIds.length}
                  aria-label="Select all visible rows"
                />
              </th>
            ) : null}
            {columns.map((column) => (
              <th key={column.key || column.header} className={column.headerClassName} style={column.headerStyle}>
                {column.header}
              </th>
            ))}
            {actionColumnVisible ? (
              <th className="text-end mis-table-actions">{actionsHeader}</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0) + (actionColumnVisible ? 1 : 0)}>
                <div className="mis-empty-state">{loadingText}</div>
              </td>
            </tr>
          ) : rows.length ? (
            rows.map((row) => {
              const id = rowId(row, rowKey);
              const isSelected = selected.has(id) || activeId === id;
              const disabled = getRowDisabled(row);

              return (
                <tr
                  key={id}
                  className={`${selectable || clickable ? 'mis-row-selectable' : ''} ${isSelected ? 'mis-row-selected' : ''}`}
                  onClick={() => {
                    if (selectable) toggleRow(row);
                  }}
                >
                  {selectable ? (
                    <td className="mis-table-checkbox" onClick={(event) => event.stopPropagation()}>
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={selected.has(id)}
                        onChange={(event) => onToggleRow?.(id, event.target.checked, row)}
                        disabled={disabled}
                        aria-label={`Select ${id}`}
                      />
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td key={`${id}-${column.key || column.header}`} className={column.className} style={column.style}>
                      {column.render ? column.render(row) : row?.[column.key]}
                    </td>
                  ))}
                  {actionColumnVisible ? (
                    <td className="text-end mis-table-actions" onClick={(event) => event.stopPropagation()}>
                      <div className="d-inline-flex align-items-center justify-content-end gap-2">
                        {showDetailsButton ? (
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => onViewDetails?.(row)}
                            disabled={disabled}
                          >
                            <FaEye className="me-1" />
                            View
                          </button>
                        ) : null}
                        {renderActions?.(row)}
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0) + (actionColumnVisible ? 1 : 0)}>
                <div className="mis-empty-state">{emptyText}</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
