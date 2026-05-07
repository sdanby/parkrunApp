import rawConfig from './list.layout.json';
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

export type ListsViewport = LayoutViewport;
export type ListsViewMode = 'basic' | 'detailed';
export type ListsElementType = LayoutElementType;
export type ListsInteractionAction = LayoutInteractionAction;
export type ListsInteractionNavMode = LayoutInteractionNavMode;
export type ListsInteractionConfig = LayoutInteractionConfig;
export type ListsElementStyleConfig = LayoutElementStyleConfig;
export type ListsPositionSpec = LayoutPositionSpec;
export type ListsLayoutElement = LayoutElement;
export type ListsTableColumn = LayoutTableColumn;
export type ListsLayoutConfig = LayoutConfig<'Lists', ListsViewMode>;

const config = rawConfig as ListsLayoutConfig;
const helpers = createLayoutHelpers<'Lists', ListsViewMode>(config);

export const getListsLayoutConfig = (): ListsLayoutConfig => helpers.getLayoutConfig();
export const getListsViewportForWidth = (width: number): ListsViewport => helpers.getViewportForWidth(width);
export const getListsElements = (): ListsLayoutElement[] => helpers.getElements();
export const getListsElementById = (id: string): ListsLayoutElement | undefined => helpers.getElementById(id);
export const getListsElementsByType = (type: ListsElementType): ListsLayoutElement[] => helpers.getElementsByType(type);
export const getListsElementPlacement = (id: string, viewport: ListsViewport): ListsPositionSpec | undefined =>
  helpers.getElementPlacement(id, viewport);
export const getListsElementInteraction = (id: string): ListsInteractionConfig | undefined =>
  helpers.getElementInteraction(id);
export const getListsTableColumns = (): ListsTableColumn[] => helpers.getTableColumns();
export const getListsTableColumnByKey = (key: string): ListsTableColumn | undefined => helpers.getTableColumnByKey(key);
export const getListsColumnsForView = (viewMode: ListsViewMode): ListsTableColumn[] =>
  helpers.getColumnsForView(viewMode);
export const isListsStickyColumn = (key: string): boolean => helpers.isStickyColumn(key);
export const getListsColumnWidth = (key: string, viewport: ListsViewport): string | undefined =>
  helpers.getColumnWidth(key, viewport);
export const listKnownListsIds = (): string[] => helpers.listKnownElementIds();
export const listKnownListsColumnKeys = (): string[] => helpers.listKnownColumnKeys();
