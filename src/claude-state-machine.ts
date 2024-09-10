import {makeAutoObservable} from "mobx";
import type {Instruction, State, StateMachineConfig} from "./types";

export class ClaudeStateMachine {
    state: State;
    visitedStates: Set<State>;
    possibleStates: State[];
    goalPredicate: (visitedStates: Set<State>) => boolean;
    contextPrompt: string;
    instructions: Instruction[];
    data: Record<string, any> = {};

    constructor(config: StateMachineConfig) {
        this.state = config.initialState;
        this.visitedStates = new Set([config.initialState]);
        this.possibleStates = config.possibleStates;
        this.goalPredicate = config.goalPredicate;
        this.contextPrompt = config.contextPrompt;
        this.instructions = config.instructions;
        makeAutoObservable(this);
    }

    transition(newState: State) {
        if (this.possibleStates.includes(newState)) {
            this.state = newState;
            this.visitedStates.add(newState);
            this.executeInstructions();
        } else {
            throw new Error(`Invalid state transition to ${newState}`);
        }
    }

    async executeInstructions() {
        for (const instruction of this.instructions) {
            if (instruction.condition(this)) {
                await instruction.action(this);
            }
        }
    }

    goalReached(): boolean {
        return this.goalPredicate(this.visitedStates);
    }

    setData(key: string, value: any) {
        this.data[key] = value;
    }

    getData(key: string): any {
        return this.data[key];
    }
}

