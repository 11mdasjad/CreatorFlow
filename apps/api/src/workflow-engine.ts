import { Db, workspaceLock, notify } from './core';
import { Graph } from './schemas';
export async function runWorkflows(db: Db) {
  const jobs = await db.workflowExecution.findMany({
    where: { status: 'QUEUED' },
    include: { version: { include: { workflow: true } } },
    take: 50,
  });
  for (const job of jobs) {
    try {
      await db.$transaction(async (tx) => {
        const wid = job.version.workspaceId;
        await workspaceLock(tx, wid);
        const current = await tx.workflowExecution.findUnique({ where: { id: job.id } });
        if (current?.status !== 'QUEUED') return;
        if (job.version.workflow.status !== 'ACTIVE') {
          await tx.workflowExecution.update({ where: { id: job.id }, data: { status: 'SKIPPED' } });
          return;
        }
        const lead = await tx.lead.findFirst({ where: { id: job.leadId, workspaceId: wid } });
        if (!lead) throw new Error('Lead unavailable');
        const graph = job.version.graph as Graph;
        let node = graph.nodes.find((n) => ['leadCreated', 'formSubmitted'].includes(n.type));
        let steps = 0;
        while (node && steps++ < 40) {
          let branch: string | undefined;
          const value = node.data.value || '';
          if (node.type === 'addTag') {
            if (!lead.tags.includes(value)) {
              lead.tags.push(value);
              await tx.lead.update({
                where: { id: lead.id, workspaceId: wid },
                data: { tags: lead.tags },
              });
            }
          }
          if (node.type === 'updateStatus')
            await tx.lead.update({
              where: { id: lead.id, workspaceId: wid },
              data: { status: value as any },
            });
          if (node.type === 'notification') await notify(tx, wid, node.data.label, value);
          if (node.type === 'hasTag') branch = lead.tags.includes(value) ? 'yes' : 'no';
          if (node.type === 'hasConsent') {
            const consent = await tx.leadConsent.findFirst({
              where: { workspaceId: wid, leadId: lead.id, purpose: 'marketing' },
              orderBy: { createdAt: 'desc' },
            });
            branch = consent?.granted ? 'yes' : 'no';
          }
          if (node.type === 'end') break;
          const edge = graph.edges.find(
            (e) => e.source === node!.id && (!branch || e.sourceHandle === branch),
          );
          node = graph.nodes.find((n) => n.id === edge?.target);
        }
        await tx.workflowExecution.update({ where: { id: job.id }, data: { status: 'COMPLETED' } });
      });
    } catch {
      await db.workflowExecution.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          error: 'Workflow could not complete. Check node configuration and lead availability.',
        },
      });
    }
  }
}
