import { CSSProperties } from 'react';
import {
  EventViewport,
  EventViewMode,
  EventLayoutElement,
  EventElementStyleConfig,
  EventTableColumn,
  PositionSpec,
  getEventElements,
  getEventColumnsForView,
  getEventElementById,
  getEventElementPlacement,
  isStickyColumn
} from './eventsLayoutHelper';

export type EventElementRenderModel = Omit<EventLayoutElement, 'style'> & {
  configStyle?: EventElementStyleConfig;
  placement: PositionSpec;
  style: CSSProperties;
};

export type EventColumnRenderModel = EventTableColumn & {
  placement: PositionSpec;
  headerStyle: CSSProperties;
  cellStyle: CSSProperties;
};

const toPlacementStyle = (placement?: PositionSpec): CSSProperties => {
  if (!placement) {
    return {};
  }

  const style: CSSProperties = {
    position: 'absolute'
  };

  if (placement.x) {
    style.left = placement.x;
  }
  if (placement.y) {
    style.top = placement.y;
  }
  if (placement.width) {
    style.width = placement.width;
  }
  if (placement.minWidth) {
    style.minWidth = placement.minWidth;
  }
  if (placement.maxWidth) {
    style.maxWidth = placement.maxWidth;
  }

  return style;
};

export const getEventElementRenderModel = (
  id: string,
  viewport: EventViewport
): EventElementRenderModel | undefined => {
  const element = getEventElementById(id);
  if (!element) {
    return undefined;
  }

  const placement = getEventElementPlacement(id, viewport) ?? {};
  const { style: configStyle, ...elementWithoutConfigStyle } = element;
  return {
    ...elementWithoutConfigStyle,
    configStyle,
    placement,
    style: toPlacementStyle(placement)
  };
};

export const getAllEventElementRenderModels = (
  viewport: EventViewport
): EventElementRenderModel[] => {
  return getEventElements().map((element) => {
    const placement = element[viewport] ?? {};
    const { style: configStyle, ...elementWithoutConfigStyle } = element;
    return {
      ...elementWithoutConfigStyle,
      configStyle,
      placement,
      style: toPlacementStyle(placement)
    };
  });
};

export const getEventColumnRenderModels = (
  viewMode: EventViewMode,
  viewport: EventViewport
): EventColumnRenderModel[] => {
  return getEventColumnsForView(viewMode).map((column) => {
    const placement = column[viewport] ?? {};
    const width = placement.width;

    const widthStyle: CSSProperties = width
      ? {
          width,
          minWidth: width,
          maxWidth: width
        }
      : {};

    return {
      ...column,
      placement,
      headerStyle: {
        ...widthStyle,
        position: 'relative',
        fontWeight: 700
      },
      cellStyle: {
        ...widthStyle,
        whiteSpace: 'nowrap'
      }
    };
  });
};

export const getStickyColumnKeysForView = (
  viewMode: EventViewMode
): string[] => getEventColumnsForView(viewMode).filter((column) => isStickyColumn(column.key)).map((column) => column.key);

export const getEventContainerStyle = (): CSSProperties => ({
  position: 'relative'
});
