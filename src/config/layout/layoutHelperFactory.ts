export type LayoutViewport = 'laptop' | 'mobile';

export type LayoutInteractionAction = 'navigate';
export type LayoutInteractionNavMode = 'direct' | 'stack';

export type LayoutInteractionConfig = {
  enabled?: boolean;
  action?: LayoutInteractionAction;
  target?: string;
  navMode?: LayoutInteractionNavMode;
  params?: Record<string, string>;
  state?: Record<string, unknown>;
};

export type LayoutElementType = 'button' | 'label' | 'field' | 'select' | 'table' | 'plot';

export type LayoutElementStyleConfig = {
  fontSize?: string;
  subFontSize?: string;
  fontWeight?: string | number;
  fontStyle?: string;
  color?: string;
  backgroundColor?: string;
  border?: string;
  borderColor?: string;
  borderRadius?: string;
  textAlign?: 'left' | 'center' | 'right';
  timeDisplayFormat?: 'raw' | 'mm:ss';
  lineHeight?: string | number;
  width?: string;
  height?: string;
  padding?: string;
};

export type LayoutPositionSpec = {
  x?: string;
  y?: string;
  width?: string;
  height?: string;
  minHeight?: string;
  maxHeight?: string;
  minWidth?: string;
  maxWidth?: string;
};

export type LayoutElement = {
  id: string;
  type: LayoutElementType;
  name: string;
  headerName?: string;
  sticky?: boolean;
  helpLabel?: boolean;
  helpTarget?: string;
  options?: string[];
  interaction?: LayoutInteractionConfig;
  style?: LayoutElementStyleConfig;
  laptop: LayoutPositionSpec;
  mobile: LayoutPositionSpec;
  laptopExpanded?: LayoutPositionSpec;
  mobileExpanded?: LayoutPositionSpec;
};

export type LayoutTableColumn = {
  key: string;
  type: 'table';
  name: string;
  headerName: string;
  sticky?: boolean;
  interaction?: LayoutInteractionConfig;
  style?: LayoutElementStyleConfig;
  laptop: LayoutPositionSpec;
  mobile: LayoutPositionSpec;
};

export type LayoutExpressionCellConfig = {
  role?: string;
  valueExpr?: string;
  transformExpr?: string;
  timeAdjustExpr?: string;
  displayExpr?: string;
  nullDisplay?: string;
  dependsOn?: string[];
};

export type LayoutExpressionAxisConfig = {
  id?: string;
  role?: string;
  sticky?: boolean;
  sortable?: boolean;
  style?: LayoutElementStyleConfig;
  laptop?: LayoutPositionSpec;
  mobile?: LayoutPositionSpec;
  dependsOn?: string[];
  columnsExpr?: string;
  labelExpr?: string;
  keyExpr?: string;
  valueExpr?: string;
  headerExpr?: string;
  formatExpr?: string;
  sortExpr?: string;
  align?: 'left' | 'center' | 'right';
  label?: string;
  link?: {
    enabled?: boolean;
    target?: string;
    paramsExpr?: string;
    navMode?: LayoutInteractionNavMode;
    style?: {
      color?: string;
      textDecoration?: string;
    };
  };
  sort?: 'asc' | 'desc';
};

export type LayoutTableModelConfig = {
  mode?: 'pivot' | 'flat';
  header?: {
    textAlign?: 'left' | 'center' | 'right';
  };
  sort?: {
    enabled?: boolean;
    showInactiveArrows?: boolean;
    activeColor?: string;
    inactiveColor?: string;
  };
  sticky?: {
    headerRows?: string[];
    leadingColumns?: string[];
  };
  viewport?: {
    maxVisibleWidth?: string;
    laptop?: {
      maxVisibleWidth?: string;
    };
    mobile?: {
      maxVisibleWidth?: string;
    };
    slider?: {
      enabled?: boolean;
    };
  };
  periodColumns?: LayoutExpressionAxisConfig;
  row1?: LayoutExpressionAxisConfig;
  row2?: LayoutExpressionAxisConfig;
  col1?: LayoutExpressionAxisConfig;
  col2?: LayoutExpressionAxisConfig;
  cells?: LayoutExpressionCellConfig;
};

export type LayoutConfig<TPage extends string, TViewMode extends string> = {
  version: string;
  page: TPage;
  units: 'cm';
  anchor: string;
  notes?: string;
  viewports?: {
    laptop?: { breakpointMin?: number };
    mobile?: { breakpointMax?: number };
  };
  elements: LayoutElement[];
  tableModel?: LayoutTableModelConfig;
  tableViews?: Record<TViewMode, string[]>;
  tableColumns?: LayoutTableColumn[];
};

export const createLayoutHelpers = <TPage extends string, TViewMode extends string>(
  rawConfig: LayoutConfig<TPage, TViewMode>
) => {
  const config = rawConfig;

  const getLayoutConfig = (): LayoutConfig<TPage, TViewMode> => config;

  const getViewportForWidth = (width: number): LayoutViewport => {
    const mobileMax = config.viewports?.mobile?.breakpointMax ?? 640;
    return width <= mobileMax ? 'mobile' : 'laptop';
  };

  const getElements = (): LayoutElement[] => config.elements;

  const getElementById = (id: string): LayoutElement | undefined =>
    config.elements.find((element) => element.id === id);

  const getElementsByType = (type: LayoutElementType): LayoutElement[] =>
    config.elements.filter((element) => element.type === type);

  const getElementPlacement = (id: string, viewport: LayoutViewport): LayoutPositionSpec | undefined => {
    const element = getElementById(id);
    if (!element) {
      return undefined;
    }
    return element[viewport];
  };

  const getElementInteraction = (id: string): LayoutInteractionConfig | undefined =>
    getElementById(id)?.interaction;

  const getTableColumns = (): LayoutTableColumn[] => config.tableColumns ?? [];

  const getTableColumnByKey = (key: string): LayoutTableColumn | undefined =>
    getTableColumns().find((column) => column.key === key);

  const getColumnsForView = (viewMode: TViewMode): LayoutTableColumn[] => {
    const keys = config.tableViews?.[viewMode] ?? [];
    return keys
      .map((key) => getTableColumnByKey(key))
      .filter((column): column is LayoutTableColumn => Boolean(column));
  };

  const isStickyColumn = (key: string): boolean =>
    Boolean(getTableColumnByKey(key)?.sticky);

  const getColumnWidth = (key: string, viewport: LayoutViewport): string | undefined =>
    getTableColumnByKey(key)?.[viewport]?.width;

  const listKnownElementIds = (): string[] => config.elements.map((element) => element.id);

  const listKnownColumnKeys = (): string[] => getTableColumns().map((column) => column.key);

  return {
    getLayoutConfig,
    getViewportForWidth,
    getElements,
    getElementById,
    getElementsByType,
    getElementPlacement,
    getElementInteraction,
    getTableColumns,
    getTableColumnByKey,
    getColumnsForView,
    isStickyColumn,
    getColumnWidth,
    listKnownElementIds,
    listKnownColumnKeys
  };
};
