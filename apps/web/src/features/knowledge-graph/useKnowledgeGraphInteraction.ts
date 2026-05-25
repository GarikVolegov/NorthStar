import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import type { KEdge, KNode } from "./knowledgeGraphTypes";

interface UseKnowledgeGraphInteractionProps {
  svgRef: React.RefObject<SVGSVGElement | null>;
  viewRef: React.MutableRefObject<{ x: number; y: number; k: number }>;
  setView: React.Dispatch<React.SetStateAction<{ x: number; y: number; k: number }>>;
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
  linkMode: { sourceId: number } | null;
  setLinkMode: (value: { sourceId: number } | null) => void;
  chatOpen: boolean;
  setChatOpen: (value: boolean) => void;
  contextMenu: { nodeId: number; x: number; y: number } | null;
  setContextMenu: (value: { nodeId: number; x: number; y: number } | null) => void;
  edgeLabelEdit: { edgeId: number; draft: string; screenX: number; screenY: number } | null;
  setEdgeLabelEdit: (value: { edgeId: number; draft: string; screenX: number; screenY: number } | null) => void;
  setPendingEdge: (value: { sourceId: number; targetId: number } | null) => void;
  setEdgeLabelDraft: (value: string) => void;
  setData: React.Dispatch<React.SetStateAction<{ nodes: KNode[]; edges: KEdge[] }>>;
  queuePosition: (id: number, x: number, y: number) => void;
  handleDeleteNode: (id: number) => Promise<void>;
  onSaveRef: React.MutableRefObject<(() => void) | null>;
}

export function useKnowledgeGraphInteraction({
  svgRef,
  viewRef,
  setView,
  selectedId,
  setSelectedId,
  linkMode,
  setLinkMode,
  chatOpen,
  setChatOpen,
  contextMenu,
  setContextMenu,
  edgeLabelEdit,
  setEdgeLabelEdit,
  setPendingEdge,
  setEdgeLabelDraft,
  setData,
  queuePosition,
  handleDeleteNode,
  onSaveRef,
}: UseKnowledgeGraphInteractionProps) {
  const dragState = useRef<{
    id: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
    x: number;
    y: number;
    el: SVGGElement | null;
  } | null>(null);
  const rafId = useRef<number | null>(null);
  const panState = useRef<{ startX: number; startY: number; vx: number; vy: number } | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (event: WheelEvent) => {
      event.preventDefault();
      const delta = -event.deltaY * 0.001;
      const v = viewRef.current;
      const newK = Math.max(0.3, Math.min(2.5, v.k * (1 + delta)));
      const rect = svg.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      const ratio = newK / v.k;
      const next = {
        x: mx - (mx - v.x) * ratio,
        y: my - (my - v.y) * ratio,
        k: newK,
      };
      viewRef.current = next;
      setView(next);
    };
    svg.addEventListener("wheel", handler, { passive: false });
    return () => svg.removeEventListener("wheel", handler);
  }, [setView, svgRef, viewRef]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditing = tag === "input" || tag === "textarea" || target?.isContentEditable;
      if (event.key === "Escape") {
        if (edgeLabelEdit) return setEdgeLabelEdit(null);
        if (contextMenu) return setContextMenu(null);
        if (linkMode) return setLinkMode(null);
        if (chatOpen) return setChatOpen(false);
        if (selectedId !== null) return setSelectedId(null);
      }
      if ((event.key === "Delete" || event.key === "Backspace") && !isEditing && selectedId !== null) {
        event.preventDefault();
        void handleDeleteNode(selectedId);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "s" && selectedId !== null) {
        event.preventDefault();
        onSaveRef.current?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    chatOpen,
    contextMenu,
    edgeLabelEdit,
    handleDeleteNode,
    linkMode,
    onSaveRef,
    selectedId,
    setChatOpen,
    setContextMenu,
    setEdgeLabelEdit,
    setLinkMode,
    setSelectedId,
  ]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("pointerdown", close, { capture: true });
    window.addEventListener("scroll", close, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", close, { capture: true });
      window.removeEventListener("scroll", close, { capture: true });
    };
  }, [contextMenu, setContextMenu]);

  const onNodePointerDown = useCallback(
    (event: React.PointerEvent, node: KNode) => {
      event.stopPropagation();
      if (linkMode) {
        if (linkMode.sourceId === node.id) {
          setLinkMode(null);
          return;
        }
        setPendingEdge({ sourceId: linkMode.sourceId, targetId: node.id });
        setLinkMode(null);
        setEdgeLabelDraft("");
        return;
      }
      (event.target as Element).setPointerCapture?.(event.pointerId);
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;
      const v = viewRef.current;
      const px = (event.clientX - svgRect.left - v.x) / v.k;
      const py = (event.clientY - svgRect.top - v.y) / v.k;
      dragState.current = {
        id: node.id,
        offsetX: px - node.x,
        offsetY: py - node.y,
        moved: false,
        x: node.x,
        y: node.y,
        el: event.currentTarget as SVGGElement,
      };
    },
    [linkMode, setEdgeLabelDraft, setLinkMode, setPendingEdge, svgRef, viewRef],
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: KNode) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
    },
    [setContextMenu],
  );

  const onEdgeLabelClick = useCallback(
    (event: React.MouseEvent, edge: KEdge, mx: number, my: number) => {
      event.stopPropagation();
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const v = viewRef.current;
      setEdgeLabelEdit({
        edgeId: edge.id,
        draft: edge.label ?? "",
        screenX: mx * v.k + v.x + rect.left,
        screenY: my * v.k + v.y + rect.top,
      });
    },
    [setEdgeLabelEdit, svgRef, viewRef],
  );

  const onSvgPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const drag = dragState.current;
      const pan = panState.current;
      if (drag) {
        if (rafId.current !== null) cancelAnimationFrame(rafId.current);
        const cx = event.clientX;
        const cy = event.clientY;
        rafId.current = requestAnimationFrame(() => {
          if (!drag || !svgRef.current) return;
          const svgRect = svgRef.current.getBoundingClientRect();
          const v = viewRef.current;
          const newX = (cx - svgRect.left - v.x) / v.k - drag.offsetX;
          const newY = (cy - svgRect.top - v.y) / v.k - drag.offsetY;
          drag.moved = true;
          drag.x = newX;
          drag.y = newY;
          updateDraggedNodeDom(svgRef.current, drag, newX, newY);
        });
      } else if (pan) {
        const next = {
          x: pan.vx + (event.clientX - pan.startX),
          y: pan.vy + (event.clientY - pan.startY),
          k: viewRef.current.k,
        };
        viewRef.current = next;
        setView(next);
      }
    },
    [setView, svgRef, viewRef],
  );

  const onNodePointerUp = useCallback(
    (event: React.PointerEvent, node: KNode) => {
      const drag = dragState.current;
      dragState.current = null;
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      if (!drag) return;
      if (!drag.moved) {
        setSelectedId(node.id);
      } else {
        setData((data) => ({
          ...data,
          nodes: data.nodes.map((item) =>
            item.id === drag.id ? { ...item, x: drag.x, y: drag.y } : item,
          ),
        }));
        queuePosition(drag.id, drag.x, drag.y);
      }
      event.stopPropagation();
    },
    [queuePosition, setData, setSelectedId],
  );

  const onSvgPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.target !== event.currentTarget) return;
      panState.current = {
        startX: event.clientX,
        startY: event.clientY,
        vx: viewRef.current.x,
        vy: viewRef.current.y,
      };
      setSelectedId(null);
      setLinkMode(null);
    },
    [setLinkMode, setSelectedId, viewRef],
  );

  const onSvgPointerUp = useCallback(() => {
    panState.current = null;
  }, []);

  return {
    onNodePointerDown,
    onNodePointerUp,
    onNodeContextMenu,
    onEdgeLabelClick,
    onSvgPointerDown,
    onSvgPointerMove,
    onSvgPointerUp,
  };
}

function updateDraggedNodeDom(
  svg: SVGSVGElement,
  drag: { id: number; el: SVGGElement | null },
  newX: number,
  newY: number,
) {
  if (drag.el) {
    drag.el.setAttribute("transform", `translate(${newX},${newY})`);
    drag.el.setAttribute("data-x", String(newX));
    drag.el.setAttribute("data-y", String(newY));
  }
  svg.querySelectorAll<SVGLineElement>(`line[data-source="${drag.id}"]`).forEach((line) => {
    line.setAttribute("x1", String(newX));
    line.setAttribute("y1", String(newY));
  });
  svg.querySelectorAll<SVGLineElement>(`line[data-target="${drag.id}"]`).forEach((line) => {
    line.setAttribute("x2", String(newX));
    line.setAttribute("y2", String(newY));
  });
  svg
    .querySelectorAll<SVGTextElement>(
      `text[data-edge-mid-source="${drag.id}"], text[data-edge-mid-target="${drag.id}"]`,
    )
    .forEach((text) => {
      const otherX = parseFloat(text.getAttribute("data-other-x") ?? "0");
      const otherY = parseFloat(text.getAttribute("data-other-y") ?? "0");
      text.setAttribute("x", String((newX + otherX) / 2));
      text.setAttribute("y", String((newY + otherY) / 2 - 4));
    });
}
