import rawConfig from './eventAnalysis.layout.json';
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

export type EventAnalysisViewport = LayoutViewport;
export type EventAnalysisViewMode = 'basic' | 'detailed';
export type EventAnalysisElementType = LayoutElementType;
export type EventAnalysisInteractionAction = LayoutInteractionAction;
export type EventAnalysisInteractionNavMode = LayoutInteractionNavMode;
export type EventAnalysisInteractionConfig = LayoutInteractionConfig;
export type EventAnalysisElementStyleConfig = LayoutElementStyleConfig;
export type EventAnalysisPositionSpec = LayoutPositionSpec;
export type EventAnalysisLayoutElement = LayoutElement;
export type EventAnalysisTableColumn = LayoutTableColumn;
export type EventAnalysisLayoutConfig = LayoutConfig<'EventAnalysis', EventAnalysisViewMode>;

const config = rawConfig as EventAnalysisLayoutConfig;
const helpers = createLayoutHelpers<'EventAnalysis', EventAnalysisViewMode>(config);

export const getEventAnalysisLayoutConfig = (): EventAnalysisLayoutConfig => helpers.getLayoutConfig();
export const getEventAnalysisViewportForWidth = (width: number): EventAnalysisViewport => helpers.getViewportForWidth(width);
export const getEventAnalysisElements = (): EventAnalysisLayoutElement[] => helpers.getElements();
export const getEventAnalysisElementById = (id: string): EventAnalysisLayoutElement | undefined => helpers.getElementById(id);
export const getEventAnalysisElementsByType = (type: EventAnalysisElementType): EventAnalysisLayoutElement[] => helpers.getElementsByType(type);
export const getEventAnalysisElementPlacement = (id: string, viewport: EventAnalysisViewport): EventAnalysisPositionSpec | undefined =>
  helpers.getElementPlacement(id, viewport);
export const getEventAnalysisElementInteraction = (id: string): EventAnalysisInteractionConfig | undefined =>
  helpers.getElementInteraction(id);
export const getEventAnalysisTableColumns = (): EventAnalysisTableColumn[] => helpers.getTableColumns();
export const getEventAnalysisTableColumnByKey = (key: string): EventAnalysisTableColumn | undefined => helpers.getTableColumnByKey(key);
export const getEventAnalysisColumnsForView = (viewMode: EventAnalysisViewMode): EventAnalysisTableColumn[] =>
  helpers.getColumnsForView(viewMode);
export const isEventAnalysisStickyColumn = (key: string): boolean => helpers.isStickyColumn(key);
export const getEventAnalysisColumnWidth = (key: string, viewport: EventAnalysisViewport): string | undefined =>
  helpers.getColumnWidth(key, viewport);
export const listKnownEventAnalysisIds = (): string[] => helpers.listKnownElementIds();
export const listKnownEventAnalysisColumnKeys = (): string[] => helpers.listKnownColumnKeys();
