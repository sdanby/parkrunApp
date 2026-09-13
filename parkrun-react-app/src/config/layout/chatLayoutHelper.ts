import rawConfig from './chat.layout.json';
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

export type ChatViewport = LayoutViewport;
export type ChatViewMode = never;
export type ChatElementType = LayoutElementType;
export type ChatInteractionAction = LayoutInteractionAction;
export type ChatInteractionNavMode = LayoutInteractionNavMode;

export type ChatInteractionConfig = LayoutInteractionConfig;
export type ChatElementStyleConfig = LayoutElementStyleConfig;
export type ChatPositionSpec = LayoutPositionSpec;
export type ChatLayoutElement = LayoutElement;
export type ChatTableColumn = LayoutTableColumn;
export type ChatLayoutConfig = LayoutConfig<'Chat', ChatViewMode>;

const config = rawConfig as unknown as ChatLayoutConfig;
const helpers = createLayoutHelpers<'Chat', ChatViewMode>(config);

export const getChatLayoutConfig = (): ChatLayoutConfig => helpers.getLayoutConfig();
export const getChatViewportForWidth = (width: number): ChatViewport => helpers.getViewportForWidth(width);
export const getChatElements = (): ChatLayoutElement[] => helpers.getElements();
export const getChatElementById = (id: string): ChatLayoutElement | undefined => helpers.getElementById(id);
export const getChatElementsByType = (type: ChatElementType): ChatLayoutElement[] => helpers.getElementsByType(type);
export const getChatElementPlacement = (id: string, viewport: ChatViewport): ChatPositionSpec | undefined =>
  helpers.getElementPlacement(id, viewport);
export const getChatElementInteraction = (id: string): ChatInteractionConfig | undefined =>
  helpers.getElementInteraction(id);
export const getChatTableColumns = (): ChatTableColumn[] => helpers.getTableColumns();
export const getChatTableColumnByKey = (key: string): ChatTableColumn | undefined => helpers.getTableColumnByKey(key);
export const getChatColumnsForView = (viewMode: ChatViewMode): ChatTableColumn[] =>
  helpers.getColumnsForView(viewMode);
export const isChatStickyColumn = (key: string): boolean => helpers.isStickyColumn(key);
export const getChatColumnWidth = (key: string, viewport: ChatViewport): string | undefined =>
  helpers.getColumnWidth(key, viewport);
export const listKnownChatIds = (): string[] => helpers.listKnownElementIds();
export const listKnownChatColumnKeys = (): string[] => helpers.listKnownColumnKeys();