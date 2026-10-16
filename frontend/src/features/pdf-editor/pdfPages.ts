export type EditorPage = {
  id: string;
  sourceIndex: number;
  rotation: number;
};

export function createPages(count: number, nextId: () => string): EditorPage[] {
  return Array.from({ length: count }, (_, sourceIndex) => ({
    id: nextId(),
    sourceIndex,
    rotation: 0,
  }));
}

export function rotatePage(pages: EditorPage[], id: string): EditorPage[] {
  return pages.map((page) => (page.id === id ? { ...page, rotation: (page.rotation + 90) % 360 } : page));
}

export function deletePage(pages: EditorPage[], id: string): EditorPage[] {
  if (pages.length <= 1) return pages;
  return pages.filter((page) => page.id !== id);
}

export function movePage(pages: EditorPage[], index: number, direction: -1 | 1): EditorPage[] {
  const target = index + direction;
  if (target < 0 || target >= pages.length) return pages;
  const next = pages.slice();
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}
