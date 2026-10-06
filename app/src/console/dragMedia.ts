// Dragging a picture from the Media panel onto a slide.
export const MEDIA_DRAG_TYPE = "application/x-cellpresenter-media";

export function isMediaDrag(e: { dataTransfer: DataTransfer | null }): boolean {
  return Boolean(e.dataTransfer?.types.includes(MEDIA_DRAG_TYPE));
}
