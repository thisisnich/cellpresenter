// Tells open panels that songs were created, edited or deleted, so lists
// refresh without polling.
const target = new EventTarget();

export function notifyLibraryChanged(): void {
  target.dispatchEvent(new Event("changed"));
}

export function onLibraryChanged(listener: () => void): () => void {
  target.addEventListener("changed", listener);
  return () => target.removeEventListener("changed", listener);
}
