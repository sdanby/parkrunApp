import React from 'react';

export type NextEventProjectionColumn = {
    key: string;
    label: string;
    width?: string;
    isCurrent?: boolean;
    helpTarget?: string;
};

export type NextEventProjectionCell = {
    value: string;
    tone?: 'default' | 'best' | 'last' | 'improve';
};

export type NextEventProjectionRow = {
    key: string;
    label: React.ReactNode;
    sortValue: number;
    cells: Record<string, NextEventProjectionCell>;
};

type Props = {
    columns: NextEventProjectionColumn[];
    rows: NextEventProjectionRow[];
    sortKey: string;
    sortDir: 'asc' | 'desc';
    onHeaderActivate: (event: React.MouseEvent<HTMLTableCellElement> | React.KeyboardEvent<HTMLTableCellElement>, column: NextEventProjectionColumn) => void;
};

const getCellStyle = (tone?: 'default' | 'best' | 'last' | 'improve'): React.CSSProperties => {
    if (tone === 'best') {
        return {
            background: '#d1fae5',
            color: '#065f46',
            fontWeight: 700
        };
    }
    if (tone === 'last') {
        return {
            background: '#e5e7eb',
            color: '#111827',
            fontWeight: 600
        };
    }
    if (tone === 'improve') {
        return {
            background: '#dbeafe',
            color: '#1d4ed8',
            fontWeight: 700
        };
    }
    return {};
};

const NextEventProjectionTable: React.FC<Props> = ({ columns, rows, sortKey, sortDir, onHeaderActivate }) => {
    return (
        <div className="athlete-runs-table-wrapper">
            <table className="athlete-runs-table">
                <thead>
                    <tr>
                        {columns.map((column, index) => {
                            const isSorted = sortKey === column.key;
                            const style: React.CSSProperties = {
                                width: column.width,
                                minWidth: column.width,
                                maxWidth: column.width,
                                textAlign: 'center',
                                fontWeight: column.isCurrent ? 800 : 600
                            };

                            const classes = ['athlete-table-header'];
                            if (index === 0) {
                                classes.push('athlete-date-header');
                                style.textAlign = 'left';
                            }

                            return (
                                <th
                                    key={column.key}
                                    className={classes.join(' ')}
                                    scope="col"
                                    tabIndex={0}
                                    aria-sort={isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                                    style={style}
                                    onClick={(event) => onHeaderActivate(event, column)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            onHeaderActivate(event, column);
                                        }
                                    }}
                                >
                                    <span
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: index === 0 ? 'space-between' : 'center',
                                            width: '100%',
                                            gap: '0.25rem'
                                        }}
                                    >
                                        <span>{column.label}</span>
                                        {isSorted ? <span className="athlete-sort-indicator">{sortDir === 'asc' ? '▲' : '▼'}</span> : null}
                                    </span>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.key}>
                            {columns.map((column, index) => {
                                const cell = row.cells[column.key] || { value: '' };
                                if (index === 0) {
                                    return (
                                        <th
                                            key={column.key}
                                            scope="row"
                                            className="athlete-date-cell"
                                            style={{
                                                width: column.width,
                                                minWidth: column.width,
                                                maxWidth: column.width,
                                                textAlign: 'left'
                                            }}
                                        >
                                            {row.label}
                                        </th>
                                    );
                                }

                                return (
                                    <td key={column.key} style={{ textAlign: 'center', ...getCellStyle(cell.tone) }}>
                                        {cell.value}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default NextEventProjectionTable;