import {ClaudeStateMachine} from "./claude-state-machine.ts";

export interface Instruction {
    condition: (machine: ClaudeStateMachine) => boolean;
    action: (machine: ClaudeStateMachine) => void | Promise<void>;
    description: string;
}

export interface StateMachineConfig {
    initialState: State;
    possibleStates: State[];
    goalPredicate: (visitedStates: Set<State>) => boolean;
    contextPrompt: string;
    instructions: Instruction[];
}

export type State = string;
