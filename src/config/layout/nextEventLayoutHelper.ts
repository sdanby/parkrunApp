import rawConfig from './nextEvent.layout.json';
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

export type NextEventViewport = LayoutViewport;
export type NextEventViewMode = 'next_pr' | 'next_ext';
export type NextEventElementType = LayoutElementType;
export type NextEventInteractionAction = LayoutInteractionAction;
export type NextEventInteractionNavMode = LayoutInteractionNavMode;

export type NextEventInteractionConfig = LayoutInteractionConfig;
export type NextEventElementStyleConfig = LayoutElementStyleConfig;
export type NextEventPositionSpec = LayoutPositionSpec;
export type NextEventLayoutElement = LayoutElement;
export type NextEventTableColumn = LayoutTableColumn;
export type NextEventLayoutConfig = LayoutConfig<'Next Event', NextEventViewMode>;

const config = rawConfig as unknown as NextEventLayoutConfig;
const helpers = createLayoutHelpers<'Next Event', NextEventViewMode>(config);

export const getNextEventLayoutConfig = (): NextEventLayoutConfig => helpers.getLayoutConfig();
export const getNextEventViewportForWidth = (width: number): NextEventViewport => helpers.getViewportForWidth(width);
export const getNextEventElements = (): NextEventLayoutElement[] => helpers.getElements();
export const getNextEventElementById = (id: string): NextEventLayoutElement | undefined => helpers.getElementById(id);
export const getNextEventElementsByType = (type: NextEventElementType): NextEventLayoutElement[] => helpers.getElementsByType(type);
export const getNextEventElementPlacement = (id: string, viewport: NextEventViewport): NextEventPositionSpec | undefined =>
  helpers.getElementPlacement(id, viewport);
export const getNextEventElementInteraction = (id: string): NextEventInteractionConfig | undefined =>
  helpers.getElementInteraction(id);
export const getNextEventTableColumns = (): NextEventTableColumn[] => helpers.getTableColumns();
export const getNextEventTableColumnByKey = (key: string): NextEventTableColumn | undefined => helpers.getTableColumnByKey(key);
export const getNextEventColumnsForView = (viewMode: NextEventViewMode): NextEventTableColumn[] =>
  helpers.getColumnsForView(viewMode);
export const isNextEventStickyColumn = (key: string): boolean => helpers.isStickyColumn(key);
export const getNextEventColumnWidth = (key: string, viewport: NextEventViewport): string | undefined =>
  helpers.getColumnWidth(key, viewport);
export const listKnownNextEventIds = (): string[] => helpers.listKnownElementIds();
export const listKnownNextEventColumnKeys = (): string[] => helpers.listKnownColumnKeys();