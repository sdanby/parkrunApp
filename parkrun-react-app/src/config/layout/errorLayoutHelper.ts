import rawConfig from './errorLayout.json';
import {
  createLayoutHelpers,
  LayoutConfig,
  LayoutElement,
  LayoutElementStyleConfig,
  LayoutElementType,
  LayoutInteractionAction,
  LayoutInteractionConfig,
  LayoutInteractionNavMode,
  LayoutPositionSpec,
  LayoutTableColumn,
  LayoutViewport
} from './layoutHelperFactory';

export type ErrorViewport = LayoutViewport;
export type ErrorViewMode = never;
export type ErrorElementType = LayoutElementType;
export type ErrorInteractionAction = LayoutInteractionAction;
export type ErrorInteractionNavMode = LayoutInteractionNavMode;

export type ErrorInteractionConfig = LayoutInteractionConfig;
export type ErrorElementStyleConfig = LayoutElementStyleConfig;
export type ErrorPositionSpec = LayoutPositionSpec;
export type ErrorLayoutElement = LayoutElement;
export type ErrorTableColumn = LayoutTableColumn;
export type ErrorLayoutConfig = LayoutConfig<'Error', ErrorViewMode>;

const config = rawConfig as unknown as ErrorLayoutConfig;
const helpers = createLayoutHelpers<'Error', ErrorViewMode>(config);

export const getErrorLayoutConfig = (): ErrorLayoutConfig => helpers.getLayoutConfig();
export const getErrorViewportForWidth = (width: number): ErrorViewport => helpers.getViewportForWidth(width);
export const getErrorElements = (): ErrorLayoutElement[] => helpers.getElements();
export const getErrorElementById = (id: string): ErrorLayoutElement | undefined => helpers.getElementById(id);
export const getErrorElementsByType = (type: ErrorElementType): ErrorLayoutElement[] => helpers.getElementsByType(type);
export const getErrorElementPlacement = (id: string, viewport: ErrorViewport): ErrorPositionSpec | undefined =>
  helpers.getElementPlacement(id, viewport);
export const getErrorElementInteraction = (id: string): ErrorInteractionConfig | undefined =>
  helpers.getElementInteraction(id);
export const getErrorTableColumns = (): ErrorTableColumn[] => helpers.getTableColumns();
export const getErrorTableColumnByKey = (key: string): ErrorTableColumn | undefined => helpers.getTableColumnByKey(key);
export const getErrorColumnsForView = (viewMode: ErrorViewMode): ErrorTableColumn[] => helpers.getColumnsForView(viewMode);
export const isErrorStickyColumn = (key: string): boolean => helpers.isStickyColumn(key);
export const getErrorColumnWidth = (key: string, viewport: ErrorViewport): string | undefined =>
  helpers.getColumnWidth(key, viewport);
export const listKnownErrorIds = (): string[] => helpers.listKnownElementIds();
export const listKnownErrorColumnKeys = (): string[] => helpers.listKnownColumnKeys();
