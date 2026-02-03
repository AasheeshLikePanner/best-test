import { StateGraph, START, END } from '@langchain/langgraph';
import { SchedulerState } from '../types';
import { stateChannels } from './state';
import {
    loadCalendarNode, extractIntentNode, resolveIntentNode, findSlotsNode, proposeSlotsNode,
    handleSelectionNode, confirmMeetingNode, handleRejectionNode, handleErrorNode
} from './nodes';
import { postgresCheckpointer } from '../db/checkpoint';

const graph = new StateGraph<SchedulerState>({
    channels: stateChannels as any,
});

graph.addNode('loadCalendar', loadCalendarNode);
graph.addNode('extractIntent', extractIntentNode);
graph.addNode('resolveIntent', resolveIntentNode);
graph.addNode('findSlots', findSlotsNode);
graph.addNode('proposeSlots', proposeSlotsNode);
graph.addNode('handleSelection', handleSelectionNode);
graph.addNode('confirmMeeting', confirmMeetingNode);
graph.addNode('handleRejection', handleRejectionNode);
graph.addNode('handleError', handleErrorNode);

graph.addEdge(START, 'loadCalendar' as any);

graph.addConditionalEdges('loadCalendar' as any, (state: SchedulerState) => {
    if (state.proposals && !state.confirmed && state.phase === 'proposed') {
        return 'handleSelection';
    }
    return 'extractIntent';
});

graph.addConditionalEdges('extractIntent' as any, (state: SchedulerState) => {
    if (state.error) return 'handleError';
    return 'resolveIntent';
});

graph.addConditionalEdges('resolveIntent' as any, (state: SchedulerState) => {
    if (state.error) return 'handleError';
    return 'findSlots';
});

graph.addConditionalEdges('findSlots' as any, (state: SchedulerState) => {
    if (state.error) return 'handleError';
    return 'proposeSlots';
});

graph.addEdge('proposeSlots' as any, END);

graph.addConditionalEdges('handleSelection' as any, (state: SchedulerState) => {
    if (state.error) return 'handleError';
    if (state.confirmed) return 'confirmMeeting';
    // If we're in 'rejected' phase, we might want to restart intent extraction
    if (state.phase === 'rejected') return 'extractIntent';
    return 'handleRejection';
});

graph.addEdge('confirmMeeting' as any, END);
graph.addEdge('handleRejection' as any, END);
graph.addEdge('handleError' as any, END);

export const compiledGraph = graph.compile({
    checkpointer: postgresCheckpointer,
});
