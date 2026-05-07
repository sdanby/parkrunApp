import rawConfig from './events.layout.json';
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

export type EventViewport = LayoutViewport;
export type EventViewMode = 'basic' | 'detailed' | 'allTimeAdjustments';
export type EventElementType = LayoutElementType;
export type EventInteractionAction = LayoutInteractionAction;
export type EventInteractionNavMode = LayoutInteractionNavMode;

export type EventInteractionConfig = LayoutInteractionConfig;

export type EventElementStyleConfig = LayoutElementStyleConfig;

export type PositionSpec = LayoutPositionSpec;

export type EventLayoutElement = LayoutElement;

export type EventTableColumn = LayoutTableColumn;

export type EventLayoutConfig = LayoutConfig<'Event', EventViewMode>;

const config = rawConfig as EventLayoutConfig;
const helpers = createLayoutHelpers<'Event', EventViewMode>(config);

export const getEventLayoutConfig = (): EventLayoutConfig => helpers.getLayoutConfig();

export const getEventViewportForWidth = (width: number): EventViewport => helpers.getViewportForWidth(width);

export const getEventElements = (): EventLayoutElement[] => helpers.getElements();

export const getEventElementById = (id: string): EventLayoutElement | undefined => helpers.getElementById(id);

export const getEventElementsByType = (type: EventElementType): EventLayoutElement[] => helpers.getElementsByType(type);

export const getEventElementPlacement = (id: string, viewport: EventViewport): PositionSpec | undefined =>
  helpers.getElementPlacement(id, viewport);

export const getEventElementInteraction = (id: string): EventInteractionConfig | undefined =>
  helpers.getElementInteraction(id);

export const getEventTableColumns = (): EventTableColumn[] => helpers.getTableColumns();

export const getEventTableColumnByKey = (key: string): EventTableColumn | undefined =>
  helpers.getTableColumnByKey(key);

export const getEventColumnsForView = (viewMode: EventViewMode): EventTableColumn[] =>
  helpers.getColumnsForView(viewMode);

export const isStickyColumn = (key: string): boolean =>
  helpers.isStickyColumn(key);

export const getColumnWidth = (key: string, viewport: EventViewport): string | undefined =>
  helpers.getColumnWidth(key, viewport);

export const listKnownEventIds = (): string[] => helpers.listKnownElementIds();

export const listKnownColumnKeys = (): string[] => helpers.listKnownColumnKeys();
