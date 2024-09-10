/**
 * @file ClaudeStateMachine.ts
 * @description Implements a state machine utilizing Anthropic's Claude API for state transitions.
 * @module ClaudeStateMachine
 */

import { makeAutoObservable } from "mobx";
import Anthropic from "@anthropic-ai/sdk";

const projectName = 'agent-mst';

/**
 * Instantiate the Anthropic client for Claude API interactions.
 */
const claude = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
console.log(`agent-mst::${projectName}::client::instantiate`);

/** Represents a state in the state machine. */
type State = string;

/**
 * Configuration interface for the ClaudeStateMachine.
 * @interface
 */
interface StateMachineConfig {
    /** The initial state of the machine. */
    initialState: State;
    /** An array of all possible states. */
    possibleStates: State[];
    /** A predicate function to determine if the goal state has been reached. */
    goalPredicate: (visitedStates: Set<State>) => boolean;
    /** Contextual prompt for the Claude API. */
    contextPrompt: string;
}

/**
 * Represents a state machine that uses the Claude API for state transitions.
 * @class
 */
class ClaudeStateMachine {
    /** Current state of the machine. */
    state: State;
    /** Set of states that have been visited. */
    visitedStates: Set<State>;
    /** Array of all possible states. */
    possibleStates: State[];
    /** Predicate function to determine if the goal has been reached. */
    goalPredicate: (visitedStates: Set<State>) => boolean;
    /** Contextual prompt for the Claude API. */
    contextPrompt: string;

    /**
     * Constructs a new ClaudeStateMachine.
     * @param {StateMachineConfig} config - The configuration object for the state machine.
     */
    constructor(config: StateMachineConfig) {
        this.state = config.initialState;
        this.visitedStates = new Set([config.initialState]);
        this.possibleStates = config.possibleStates;
        this.goalPredicate = config.goalPredicate;
        this.contextPrompt = config.contextPrompt;
        makeAutoObservable(this);
    }

    /**
     * Transitions the state machine to a new state.
     * @param {State} newState - The state to transition to.
     * @throws {Error} If the transition to the new state is invalid.
     */
    transition(newState: State) {
        if (this.possibleStates.includes(newState)) {
            this.state = newState;
            this.visitedStates.add(newState);
        } else {
            throw new Error(`Invalid state transition to ${newState}`);
        }
    }

    /**
     * Checks if the goal state has been reached.
     * @returns {boolean} True if the goal has been reached, false otherwise.
     */
    goalReached(): boolean {
        return this.goalPredicate(this.visitedStates);
    }
}

/**
 * Determines the next state using the Claude API.
 * @async
 * @param {ClaudeStateMachine} machine - The current state machine.
 * @returns {Promise<State>} The next state as determined by Claude or a default state.
 */
async function getNextState(machine: ClaudeStateMachine): Promise<State> {
    const currentState = machine.state;
    const visitedStates = Array.from(machine.visitedStates).join(", ");
    const possibleStates = machine.possibleStates.join(", ");

    const prompt = `
${machine.contextPrompt}

Current state: ${currentState}
Visited states: ${visitedStates}
Possible states: ${possibleStates}

Choose the next state from the possible states.
Rules:
1. The next state MUST be different from the current state.
2. Choose a state that hasn't been visited yet, if possible.
3. The goal is to reach a state where the goal predicate is satisfied.
4. Consider the context and make a realistic decision.

Reply with just the chosen state.`;

    const message = await claude.messages.create({
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
        model: 'claude-3-opus-20240229',
        stream: false
    });

    const nextState = message.content.toString().trim();
    console.log(`Claude's choice: ${nextState}`);

    return machine.possibleStates.includes(nextState) && nextState !== currentState
        ? nextState
        : getDefaultNextState(machine);
}

/**
 * Determines a default next state if Claude's choice is invalid.
 * @param {ClaudeStateMachine} machine - The current state machine.
 * @returns {State} A valid next state.
 */
function getDefaultNextState(machine: ClaudeStateMachine): State {
    const unvisitedStates = machine.possibleStates.filter(state => !machine.visitedStates.has(state));
    return unvisitedStates.length > 0 ? unvisitedStates[0] : machine.possibleStates[0];
}

/**
 * Factory function to create different types of state machines.
 * @param {string} type - The type of state machine to create.
 * @returns {ClaudeStateMachine} A new state machine instance.
 * @throws {Error} If an unknown state machine type is specified.
 */
function createStateMachine(type: string): ClaudeStateMachine {
    switch (type) {
        case "customerSupport":
            return new ClaudeStateMachine({
                initialState: "Initial Contact",
                possibleStates: ["Initial Contact", "Troubleshooting", "Escalation", "Resolution", "Follow-up"],
                goalPredicate: (visitedStates) => visitedStates.has("Resolution"),
                contextPrompt: "You are a customer support agent handling a technical issue. Guide the conversation through appropriate stages to resolve the customer's problem."
            });

        case "softwareDevelopment":
            return new ClaudeStateMachine({
                initialState: "Requirements Gathering",
                possibleStates: ["Requirements Gathering", "Design", "Implementation", "Testing", "Deployment", "Maintenance"],
                goalPredicate: (visitedStates) => visitedStates.has("Deployment"),
                contextPrompt: "You are a project manager overseeing a software development project. Guide the project through its lifecycle stages."
            });

        case "ecommercePurchase":
            return new ClaudeStateMachine({
                initialState: "Browsing",
                possibleStates: ["Browsing", "Add to Cart", "Checkout", "Payment", "Order Confirmation"],
                goalPredicate: (visitedStates) => visitedStates.has("Order Confirmation"),
                contextPrompt: "You are guiding a customer through an e-commerce purchase. Lead them through the typical stages of an online shopping experience."
            });

        case "medicalDiagnosis":
            return new ClaudeStateMachine({
                initialState: "Patient Intake",
                possibleStates: ["Patient Intake", "Examination", "Lab Tests", "Diagnosis", "Treatment Plan", "Follow-up"],
                goalPredicate: (visitedStates) => visitedStates.has("Treatment Plan"),
                contextPrompt: "You are a doctor diagnosing a patient. Guide the medical process through appropriate stages to reach a diagnosis and treatment plan."
            });

        default:
            throw new Error(`Unknown state machine type: ${type}`);
    }
}

/**
 * Executes the state machine until the goal state is reached.
 * @async
 * @param {ClaudeStateMachine} machine - The state machine to run.
 */
async function runStateMachine(machine: ClaudeStateMachine) {
    console.log("Starting state machine...");
    console.log(`Initial state: ${machine.state}`);

    while (!machine.goalReached()) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const nextState = await getNextState(machine);
        machine.transition(nextState);
        console.log(`Transitioned to state ${machine.state}`);
    }

    console.log("Goal reached. Exiting state machine...");
    console.log("Final state:", machine.state);
    console.log("Visited states:", Array.from(machine.visitedStates).join(", "));
}

/**
 * Main function to demonstrate the execution of various state machine types.
 * @async
 */
async function main() {
    const types = ["customerSupport", "softwareDevelopment", "ecommercePurchase", "medicalDiagnosis"];
    for (const type of types) {
        console.log(`\nRunning ${type} state machine:`);
        const machine = createStateMachine(type);
        await runStateMachine(machine);
    }
}

// Execute the main function
main().catch(console.error);