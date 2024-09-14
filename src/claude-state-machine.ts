import { makeAutoObservable } from "mobx";
import type { Instruction, State, StateMachineConfig } from "./types";
import { Logger } from "tslog";

export class ClaudeStateMachine {
    state: State;
    visitedStates: Set<State>;
    possibleStates: State[];
    goalPredicate: (visitedStates: Set<State>, machine: ClaudeStateMachine) => boolean;
    contextPrompt: string;
    instructions: Instruction[];
    data: Record<string, any> = {};
    private logger: Logger<"">;

    constructor(config: StateMachineConfig) {
        this.state = config.initialState;
        this.visitedStates = new Set([config.initialState]);
        this.possibleStates = config.possibleStates;
        this.goalPredicate = config.goalPredicate;
        this.contextPrompt = config.contextPrompt;
        this.instructions = config.instructions;
        this.logger = new Logger();
        makeAutoObservable(this);

        this.logger.info("ClaudeStateMachine initialized", { initialState: this.state });
    }

    transition(newState: State) {
        if (this.possibleStates.includes(newState)) {
            this.logger.info(`Transitioning from ${this.state} to ${newState}`);
            this.state = newState;
            this.visitedStates.add(newState);
        } else {
            this.logger.error(`Invalid state transition attempted`, { from: this.state, to: newState });
            throw new Error(`Invalid state transition to ${newState}`);
        }
    }

    async executeInstructions() {
        this.logger.debug("Executing instructions");
        for (const instruction of this.instructions) {
            if (instruction.condition(this)) {
                this.logger.debug(`Executing instruction`, { instruction: instruction });
                await instruction.action(this);
            }
        }
    }

    goalReached(): boolean {
        const reached = this.goalPredicate(this.visitedStates, this);
        this.logger.info(`Goal reached status`, { reached });
        return reached;
    }

    setData(key: string, value: any) {
        this.logger.debug(`Setting data`, { key, value });
        this.data[key] = value;
    }

    getData(key: string): any {
        const value = this.data[key];
        this.logger.debug(`Getting data`, { key, value });
        return value;
    }
}