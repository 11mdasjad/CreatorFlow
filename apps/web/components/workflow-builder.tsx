'use client';
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Connection,
  type Edge,
  type NodeProps,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Plus,
  Save,
  Play,
  Pause,
  GitBranch,
  Users,
  Tag,
  Bell,
  Flag,
  Check,
  Trash2,
  FileText,
} from 'lucide-react';
import { api, send } from '@/lib/api';
import { useWorkspace } from './shell';
import { PageHeading, Badge, Loading, ErrorState } from './shared';
import { Button } from './ui/button';
import { Modal } from './ui/dialog';
import { useToast } from './providers';
const nodeKinds = [
  { type: 'leadCreated', name: 'Lead created', icon: Users, group: 'Trigger' },
  { type: 'formSubmitted', name: 'Form submitted', icon: FileText, group: 'Trigger' },
  { type: 'hasTag', name: 'Has lead tag', icon: Tag, group: 'Condition' },
  { type: 'hasConsent', name: 'Marketing consent', icon: Check, group: 'Condition' },
  { type: 'addTag', name: 'Add lead tag', icon: Tag, group: 'Action' },
  { type: 'updateStatus', name: 'Update lead status', icon: Flag, group: 'Action' },
  { type: 'notification', name: 'Internal notification', icon: Bell, group: 'Action' },
  { type: 'end', name: 'End workflow', icon: Check, group: 'Control' },
];
type FlowNode = Node<{ label: string; value?: string; kind: string }>;
function FlowCard({ data, selected }: NodeProps<FlowNode>) {
  const kind = nodeKinds.find((n) => n.type === data.kind)!;
  const conditional = kind.group === 'Condition';
  return (
    <div className={`flow-card ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div>
        <span
          className={`icon-tile ${kind.group === 'Trigger' ? 'violet' : conditional ? 'amber' : 'blue'}`}
        >
          <kind.icon size={18} />
        </span>
        <div>
          <small>{kind.group}</small>
          <strong>{data.label}</strong>
        </div>
      </div>
      {data.value && <p>{data.value}</p>}
      {conditional ? (
        <>
          <span className="handle-label left">Yes</span>
          <span className="handle-label right">No</span>
          <Handle type="source" position={Position.Bottom} id="yes" style={{ left: '30%' }} />
          <Handle type="source" position={Position.Bottom} id="no" style={{ left: '70%' }} />
        </>
      ) : (
        kind.type !== 'end' && <Handle type="source" position={Position.Bottom} />
      )}
    </div>
  );
}
const nodeTypes = { flow: FlowCard };
const initial: FlowNode[] = [
  {
    id: 'trigger',
    type: 'flow',
    position: { x: 250, y: 40 },
    data: { label: 'Lead created', kind: 'leadCreated' },
  },
  {
    id: 'end',
    type: 'flow',
    position: { x: 250, y: 250 },
    data: { label: 'End workflow', kind: 'end' },
  },
];
export function WorkflowBuilder() {
  const { workspaceId, role } = useWorkspace(),
    toast = useToast();
  const [nodes, setNodes, onNodesChange] = useNodesState(initial),
    [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([
      { id: 'start-end', source: 'trigger', target: 'end' },
    ]);
  const [id, setId] = useState(''),
    [name, setName] = useState('My first workflow'),
    [selected, setSelected] = useState<FlowNode | null>(null),
    [saving, setSaving] = useState(false);
  const flows = useQuery({
    queryKey: ['workflows', workspaceId],
    queryFn: () => api(`/workspaces/${workspaceId}/workflows`),
  });
  const active = flows.data?.find((f: any) => f.id === id);
  const editable = role !== 'VIEWER';
  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, id: crypto.randomUUID() }, eds)),
    [setEdges],
  );
  async function save(publish = false) {
    setSaving(true);
    try {
      const graph = {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.data.kind,
          position: n.position,
          data: { label: n.data.label, ...(n.data.value ? { value: n.data.value } : {}) },
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle || null,
        })),
      };
      const flow = await send(`/workspaces/${workspaceId}/workflows`, {
        ...(id ? { id } : {}),
        name,
        graph,
      });
      setId(flow.id);
      if (publish) await send(`/workspaces/${workspaceId}/workflows/${flow.id}/publish`, {});
      await flows.refetch();
      toast(publish ? 'Workflow published with an immutable version' : 'Workflow draft saved');
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setSaving(false);
    }
  }
  function choose(value: string) {
    setId(value);
    const flow = flows.data?.find((f: any) => f.id === value);
    if (flow) {
      setName(flow.name);
      setNodes(
        flow.draft.nodes.map((n: any) => ({
          ...n,
          type: 'flow',
          data: { ...n.data, kind: n.type },
        })),
      );
      setEdges(flow.draft.edges);
    } else {
      setName('Untitled workflow');
      setNodes(initial);
      setEdges([{ id: 'start-end', source: 'trigger', target: 'end' }]);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="LESS BUSYWORK. MORE POSSIBILITY."
        title="Connect the dots."
        description="Build a flow that takes care of the next step, automatically."
        action={
          <div className="heading-actions">
            <Button variant="secondary" disabled={!editable || saving} onClick={() => save()}>
              <Save size={16} />
              Save draft
            </Button>
            <Button disabled={!editable || saving} onClick={() => save(true)}>
              <Play size={15} />
              Publish workflow
            </Button>
          </div>
        }
      />
      <div className="workflow-toolbar">
        <select aria-label="Choose workflow" value={id} onChange={(e) => choose(e.target.value)}>
          <option value="">New workflow</option>
          {flows.data?.map((f: any) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <input aria-label="Workflow name" value={name} onChange={(e) => setName(e.target.value)} />
        <Badge tone={active?.status === 'ACTIVE' ? 'green' : 'neutral'}>
          {active?.status || 'Unsaved draft'}
          {active?.publishedVersion ? ` · v${active.publishedVersion}` : ''}
        </Badge>
        {active?.status === 'ACTIVE' && editable && (
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                await send(`/workspaces/${workspaceId}/workflows/${id}/pause`, {});
                flows.refetch();
                toast('Workflow paused');
              } catch (e) {
                toast((e as Error).message, true);
              }
            }}
          >
            <Pause size={14} />
            Pause
          </Button>
        )}
      </div>
      {flows.error && <ErrorState error={flows.error} />}
      <div className="workflow-layout">
        <aside className="node-palette">
          <h3>Your building blocks</h3>
          <p>Click to add. Connect the handles.</p>
          {['Trigger', 'Condition', 'Action', 'Control'].map((group) => (
            <div key={group}>
              <span className="nav-label">{group.toUpperCase()}S</span>
              {nodeKinds
                .filter((n) => n.group === group)
                .map((n) => (
                  <button
                    disabled={!editable}
                    key={n.type}
                    onClick={() =>
                      setNodes((ns) => [
                        ...ns,
                        {
                          id: crypto.randomUUID(),
                          type: 'flow',
                          position: { x: 250 + Math.random() * 80, y: 80 + ns.length * 90 },
                          data: { label: n.name, kind: n.type },
                        },
                      ])
                    }
                  >
                    <n.icon size={16} />
                    {n.name}
                    <Plus size={13} />
                  </button>
                ))}
            </div>
          ))}
          <div className="palette-note">
            Only implemented actions are available. Instagram replies have a separate,
            policy-checked engine.
          </div>
        </aside>
        <div className="flow-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            nodesDraggable={editable}
            nodesConnectable={editable}
            deleteKeyCode={editable ? ['Backspace', 'Delete'] : null}
            onNodeDoubleClick={(_, node) => setSelected(node)}
            fitView
            minZoom={0.2}
            maxZoom={1.5}
          >
            <Background color="#c7c3d5" gap={22} size={1} />
            <Controls />
            <MiniMap pannable zoomable nodeColor="#9d8df1" />
          </ReactFlow>
          <div className="canvas-hint">
            Double-click a node to configure · Select + Delete to remove
          </div>
        </div>
      </div>
      <Modal open={!!selected} onOpenChange={() => setSelected(null)} title="Configure node">
        <form
          className="stack-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (selected) setNodes((ns) => ns.map((n) => (n.id === selected.id ? selected : n)));
            setSelected(null);
          }}
        >
          <label>
            Label
            <input
              value={selected?.data.label || ''}
              onChange={(e) =>
                selected &&
                setSelected({ ...selected, data: { ...selected.data, label: e.target.value } })
              }
            />
          </label>
          {selected &&
            ['addTag', 'hasTag', 'notification', 'updateStatus'].includes(selected.data.kind) && (
              <label>
                {selected.data.kind === 'updateStatus' ? 'Lead status' : 'Value'}
                {selected.data.kind === 'updateStatus' ? (
                  <select
                    value={selected.data.value || ''}
                    onChange={(e) =>
                      setSelected({
                        ...selected,
                        data: { ...selected.data, value: e.target.value },
                      })
                    }
                  >
                    <option value="">Choose status</option>
                    {['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    required
                    value={selected.data.value || ''}
                    onChange={(e) =>
                      setSelected({
                        ...selected,
                        data: { ...selected.data, value: e.target.value },
                      })
                    }
                  />
                )}
              </label>
            )}
          <Button disabled={!editable}>Apply configuration</Button>
        </form>
      </Modal>
    </>
  );
}
