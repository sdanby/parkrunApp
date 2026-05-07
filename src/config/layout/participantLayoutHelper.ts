import rawConfig from './participant.layout.json';
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

export type ParticipantViewport = LayoutViewport;
export type ParticipantViewMode = 'basic' | 'detailed' | 'all_time_adjustments';
export type ParticipantElementType = LayoutElementType;
export type ParticipantInteractionAction = LayoutInteractionAction;
export type ParticipantInteractionNavMode = LayoutInteractionNavMode;

export type ParticipantInteractionConfig = LayoutInteractionConfig;
export type ParticipantElementStyleConfig = LayoutElementStyleConfig;
export type ParticipantPositionSpec = LayoutPositionSpec;
export type ParticipantLayoutElement = LayoutElement;
export type ParticipantTableColumn = LayoutTableColumn;
export type ParticipantLayoutConfig = LayoutConfig<'Participant', ParticipantViewMode>;

const config = rawConfig as ParticipantLayoutConfig;
const helpers = createLayoutHelpers<'Participant', ParticipantViewMode>(config);

export const getParticipantLayoutConfig = (): ParticipantLayoutConfig => helpers.getLayoutConfig();
export const getParticipantViewportForWidth = (width: number): ParticipantViewport => helpers.getViewportForWidth(width);
export const getParticipantElements = (): ParticipantLayoutElement[] => helpers.getElements();
export const getParticipantElementById = (id: string): ParticipantLayoutElement | undefined => helpers.getElementById(id);
export const getParticipantElementsByType = (type: ParticipantElementType): ParticipantLayoutElement[] => helpers.getElementsByType(type);
export const getParticipantElementPlacement = (id: string, viewport: ParticipantViewport): ParticipantPositionSpec | undefined =>
  helpers.getElementPlacement(id, viewport);
export const getParticipantElementInteraction = (id: string): ParticipantInteractionConfig | undefined =>
  helpers.getElementInteraction(id);
export const getParticipantTableColumns = (): ParticipantTableColumn[] => helpers.getTableColumns();
export const getParticipantTableColumnByKey = (key: string): ParticipantTableColumn | undefined => helpers.getTableColumnByKey(key);
export const getParticipantColumnsForView = (viewMode: ParticipantViewMode): ParticipantTableColumn[] =>
  helpers.getColumnsForView(viewMode);
export const isParticipantStickyColumn = (key: string): boolean => helpers.isStickyColumn(key);
export const getParticipantColumnWidth = (key: string, viewport: ParticipantViewport): string | undefined =>
  helpers.getColumnWidth(key, viewport);
export const listKnownParticipantIds = (): string[] => helpers.listKnownElementIds();
export const listKnownParticipantColumnKeys = (): string[] => helpers.listKnownColumnKeys();
