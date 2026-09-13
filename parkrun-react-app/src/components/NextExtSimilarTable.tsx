import React from 'react';

export type NextExtSimilarColumn = {
    key: string;
    label: string;
    width?: string;
    sticky?: boolean;
    textAlign?: 'left' | 'center' | 'right';
};

export type NextExtSimilarTableRow = {
    athleteCode: string;
    athleteName: string;
    rank: string;
    eventDate: string;
    eventCode?: string;
    eventName?: string;
    time: string;
    ageGroup: string;
    ageGrade: string;
    course: string;
    club: string;
    adjTime: string;
    runsIn1Y: string;
    freqCourse: string;
    isSelected: boolean;
};

type Props = {
    columns: NextExtSimilarColumn[];
    rows: NextExtSimilarTableRow[];
    onSelectAthlete: (athleteCode: string) => void;
    onSelectEventDate?: (row: NextExtSimilarTableRow) => void;
    tableMinWidth?: string;
};

const getCellValue = (row: NextExtSimilarTableRow, key: string): string => {
    switch (key) {
        case 'participant_name':
            return row.athleteName;
        case 'rank_display':
            return row.rank;
        case 'event_date':
            return row.eventDate;
        case 'time':
            return row.time;
        case 'best_time':
            return row.adjTime;
        case 'best_course':
            return row.course;
        case 'runs_in_1y':
            return row.runsIn1Y;
        case 'freq_course':
            return row.freqCourse;
        case 'age_group':
            return row.ageGroup;
        case 'age_grade':
            return row.ageGrade;
        case 'club':
            return row.club;
        default:
            return '';
    }
};

const NextExtSimilarTable: React.FC<Props> = ({ columns, rows, onSelectAthlete, onSelectEventDate, tableMinWidth }) => {
    return (
        <div className="athlete-runs-table-wrapper next-ext-similar-table-wrapper" style={{ width: '100%', height: '100%', marginTop: 0, display: 'block', maxHeight: '100%' }}>
            <table className="athlete-runs-table next-ext-similar-table" style={{ borderCollapse: 'collapse', borderSpacing: 0, minWidth: tableMinWidth || '100%', width: 'max-content' }}>
                <thead>
                    <tr>
                        {columns.map((column, index) => {
                            const sticky = index === 0 || column.sticky;
                            const textAlign = index === 0 ? 'left' : (column.textAlign ?? 'center');
                            return (
                                <th
                                    key={column.key}
                                    scope="col"
                                    className={index === 0 ? 'athlete-date-header' : undefined}
                                    style={{
                                        position: 'sticky',
                                        top: 0,
                                        left: sticky ? 0 : undefined,
                                        zIndex: sticky ? 4 : 3,
                                        textAlign,
                                        width: column.width,
                                        minWidth: column.width,
                                        maxWidth: column.width,
                                        boxSizing: 'border-box',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {column.label}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, rowIndex) => {
                        const stripedRowBackground = rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc';
                        const selectedRowBackground = '#dbeafe';
                        const selectedStickyBackground = '#c7ddfb';

                        return (
                        <tr key={row.athleteCode} style={{ background: row.isSelected ? selectedRowBackground : stripedRowBackground }}>
                            {columns.map((column, index) => {
                                const sticky = index === 0 || column.sticky;
                                const textAlign = index === 0 ? 'left' : (column.textAlign ?? 'center');
                                const sharedStyle: React.CSSProperties = {
                                    width: column.width,
                                    minWidth: column.width,
                                    maxWidth: column.width,
                                    boxSizing: 'border-box',
                                    background: row.isSelected
                                        ? (sticky ? selectedStickyBackground : selectedRowBackground)
                                        : stripedRowBackground,
                                    position: sticky ? 'sticky' : 'static',
                                    left: sticky ? 0 : undefined,
                                    zIndex: sticky ? 2 : 1,
                                    textAlign,
                                    whiteSpace: 'nowrap'
                                };

                                if (index === 0) {
                                    return (
                                        <th key={column.key} scope="row" className="athlete-date-cell" style={sharedStyle}>
                                            <button
                                                type="button"
                                                className="races-athlete-button"
                                                onClick={() => onSelectAthlete(row.athleteCode)}
                                                style={{
                                                    fontWeight: row.isSelected ? 700 : 600,
                                                    fontSize: 'inherit',
                                                    display: 'block',
                                                    width: '100%',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}
                                                title={`Select ${row.athleteName}`}
                                            >
                                                {row.athleteName}
                                            </button>
                                        </th>
                                    );
                                }

                                if (column.key === 'event_date') {
                                    const eventDateValue = getCellValue(row, column.key);
                                    const canNavigateToEvent = Boolean(
                                        onSelectEventDate
                                        && row.athleteCode
                                        && row.eventCode
                                        && row.eventDate
                                        && row.eventDate !== '—'
                                    );

                                    if (canNavigateToEvent) {
                                        const handleSelectEventDate = onSelectEventDate as (row: NextExtSimilarTableRow) => void;

                                        return (
                                            <td key={column.key} style={sharedStyle}>
                                                <button
                                                    type="button"
                                                    className="races-athlete-button"
                                                    onClick={() => handleSelectEventDate(row)}
                                                    style={{
                                                        fontSize: 'inherit',
                                                        display: 'block',
                                                        width: '100%',
                                                        textAlign: textAlign as React.CSSProperties['textAlign'],
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                    title={`Open ${row.athleteName} on ${eventDateValue}`}
                                                >
                                                    {eventDateValue}
                                                </button>
                                            </td>
                                        );
                                    }

                                    return (
                                        <td key={column.key} style={sharedStyle}>
                                            {eventDateValue}
                                        </td>
                                    );
                                }

                                return (
                                    <td key={column.key} style={sharedStyle}>
                                        {getCellValue(row, column.key)}
                                    </td>
                                );
                            })}
                        </tr>
                    );})}
                </tbody>
            </table>
        </div>
    );
};

export default NextExtSimilarTable;