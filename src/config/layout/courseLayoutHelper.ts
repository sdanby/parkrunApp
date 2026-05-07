import rawConfig from './course.layout.json';
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

export type CourseViewport = LayoutViewport;
export type CourseViewMode = 'basic' | 'detailed';
export type CourseElementType = LayoutElementType;
export type CourseInteractionAction = LayoutInteractionAction;
export type CourseInteractionNavMode = LayoutInteractionNavMode;
export type CourseInteractionConfig = LayoutInteractionConfig;
export type CourseElementStyleConfig = LayoutElementStyleConfig;
export type CoursePositionSpec = LayoutPositionSpec;
export type CourseLayoutElement = LayoutElement;
export type CourseTableColumn = LayoutTableColumn;
export type CourseLayoutConfig = LayoutConfig<'Course', CourseViewMode>;

const config = rawConfig as CourseLayoutConfig;
const helpers = createLayoutHelpers<'Course', CourseViewMode>(config);

export const getCourseLayoutConfig = (): CourseLayoutConfig => helpers.getLayoutConfig();
export const getCourseViewportForWidth = (width: number): CourseViewport => helpers.getViewportForWidth(width);
export const getCourseElements = (): CourseLayoutElement[] => helpers.getElements();
export const getCourseElementById = (id: string): CourseLayoutElement | undefined => helpers.getElementById(id);
export const getCourseElementsByType = (type: CourseElementType): CourseLayoutElement[] => helpers.getElementsByType(type);
export const getCourseElementPlacement = (id: string, viewport: CourseViewport): CoursePositionSpec | undefined =>
  helpers.getElementPlacement(id, viewport);
export const getCourseElementInteraction = (id: string): CourseInteractionConfig | undefined =>
  helpers.getElementInteraction(id);
export const getCourseTableColumns = (): CourseTableColumn[] => helpers.getTableColumns();
export const getCourseTableColumnByKey = (key: string): CourseTableColumn | undefined => helpers.getTableColumnByKey(key);
export const getCourseColumnsForView = (viewMode: CourseViewMode): CourseTableColumn[] =>
  helpers.getColumnsForView(viewMode);
export const isCourseStickyColumn = (key: string): boolean => helpers.isStickyColumn(key);
export const getCourseColumnWidth = (key: string, viewport: CourseViewport): string | undefined =>
  helpers.getColumnWidth(key, viewport);
export const listKnownCourseIds = (): string[] => helpers.listKnownElementIds();
export const listKnownCourseColumnKeys = (): string[] => helpers.listKnownColumnKeys();
