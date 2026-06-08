import rawConfig from './clubs.layout.json';
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

export type ClubsViewport = LayoutViewport;
export type ClubsViewMode = 'members' | 'current_members' | 'events';
export type ClubsElementType = LayoutElementType;
export type ClubsInteractionAction = LayoutInteractionAction;
export type ClubsInteractionNavMode = LayoutInteractionNavMode;
export type ClubsInteractionConfig = LayoutInteractionConfig;
export type ClubsElementStyleConfig = LayoutElementStyleConfig;
export type ClubsPositionSpec = LayoutPositionSpec;
export type ClubsLayoutElement = LayoutElement;
export type ClubsTableColumn = LayoutTableColumn;
export type ClubsLayoutConfig = LayoutConfig<'Clubs', ClubsViewMode>;

const config = rawConfig as ClubsLayoutConfig;
const helpers = createLayoutHelpers<'Clubs', ClubsViewMode>(config);

export const getClubsLayoutConfig = (): ClubsLayoutConfig => helpers.getLayoutConfig();
export const getClubsViewportForWidth = (width: number): ClubsViewport => helpers.getViewportForWidth(width);
export const getClubsElementById = (id: string): ClubsLayoutElement | undefined => helpers.getElementById(id);
export const getClubsElementPlacement = (id: string, viewport: ClubsViewport): ClubsPositionSpec | undefined =>
  helpers.getElementPlacement(id, viewport);
export const getClubsTableColumns = (): ClubsTableColumn[] => helpers.getTableColumns();
export const getClubsTableColumnByKey = (key: string): ClubsTableColumn | undefined => helpers.getTableColumnByKey(key);
export const getClubsColumnsForView = (viewMode: ClubsViewMode): ClubsTableColumn[] => helpers.getColumnsForView(viewMode);
export const listKnownClubsIds = (): string[] => helpers.listKnownElementIds();
