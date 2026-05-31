import { Badge } from "@/components/ui/badge";
import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { BridgeEdge } from "./BridgeEdge";
import { ProfessionNode } from "./ProfessionNode";
import type { SkillBridgeProfession } from "./types";

const nodeTypes = {
  profession: ProfessionNode,
};

const edgeTypes = {
  bridge: BridgeEdge,
};

const CENTER_X = 460;
const CENTER_Y = 320;
const RADIUS_BY_RING: Record<SkillBridgeProfession["ring"], number> = {
  1: 135,
  2: 230,
  3: 320,
};

export function BridgeMapCanvas({
  userSkills,
  professions,
  selectedId,
  onSelect,
}: {
  userSkills: string[];
  professions: SkillBridgeProfession[];
  selectedId: number | undefined;
  onSelect: (profession: SkillBridgeProfession) => void;
}) {
  const { nodes, edges } = buildGraph({ userSkills, professions, selectedId });

  return (
    <div className="h-[620px] min-h-[520px] w-full bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.45}
        maxZoom={1.4}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={(_, node) => {
          if (node.type !== "profession") return;
          onSelect(node.data as SkillBridgeProfession);
        }}
      >
        <Background gap={28} size={1} color="hsl(var(--border))" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

function buildGraph({
  userSkills,
  professions,
  selectedId,
}: {
  userSkills: string[];
  professions: SkillBridgeProfession[];
  selectedId: number | undefined;
}): { nodes: Node[]; edges: Edge[] } {
  const grouped = new Map<SkillBridgeProfession["ring"], SkillBridgeProfession[]>();
  for (const profession of professions) {
    const current = grouped.get(profession.ring) ?? [];
    current.push(profession);
    grouped.set(profession.ring, current);
  }

  const nodes: Node[] = [
    {
      id: "center",
      type: "default",
      selectable: false,
      draggable: false,
      position: { x: CENTER_X - 90, y: CENTER_Y - 58 },
      data: {
        label: (
          <div className="w-44 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-center shadow-sm">
            <p className="text-sm font-semibold text-foreground">Le tue skill</p>
            <p className="mt-1 text-xs text-muted-foreground">{userSkills.length} skill core</p>
            <div className="mt-2 flex flex-wrap justify-center gap-1">
              {userSkills.slice(0, 3).map((skill) => (
                <Badge key={skill} variant="secondary" className="max-w-20 truncate text-[10px]">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        ),
      },
    },
  ];

  const edges: Edge[] = [];
  for (const ring of [1, 2, 3] as const) {
    const ringItems = grouped.get(ring) ?? [];
    const radius = RADIUS_BY_RING[ring];
    ringItems.forEach((profession, index) => {
      const angle = ringItems.length === 1
        ? -Math.PI / 2
        : (index / ringItems.length) * Math.PI * 2 - Math.PI / 2;
      const x = CENTER_X + Math.cos(angle) * radius - 80;
      const y = CENTER_Y + Math.sin(angle) * radius - 38;
      nodes.push({
        id: `profession-${profession.id}`,
        type: "profession",
        position: { x, y },
        data: profession,
        selected: selectedId === profession.id,
      });
      edges.push({
        id: `edge-${profession.id}`,
        source: "center",
        target: `profession-${profession.id}`,
        type: "bridge",
        data: {
          overlapPercent: profession.overlapPercent,
          ring: profession.ring,
        },
      });
    });
  }

  return { nodes, edges };
}
