import {ClaudeStateMachine} from "./claude-state-machine.ts";
import type {State} from "./types";
import claude from "./claude.ts";

export async function getNextState(machine: ClaudeStateMachine): Promise<State> {
    const currentState = machine.state;
    const visitedStates = Array.from(machine.visitedStates).join(", ");
    const possibleStates = machine.possibleStates.join(", ");
    const activeInstructions = machine.instructions
        .filter(instr => instr.condition(machine))
        .map(instr => instr.description)
        .join("\n");

    const prompt = `
${machine.contextPrompt}

Current state: ${currentState}
Visited states: ${visitedStates}
Possible states: ${possibleStates}

Active instructions:
${activeInstructions}

Additional context:
${Object.entries(machine.data).map(([key, value]) => `${key}: ${value}`).join("\n")}

Choose the next state from the possible states.
Rules:
1. The next state MUST be different from the current state.
2. Choose a state that hasn't been visited yet, if possible.
3. The goal is to reach a state where the goal predicate is satisfied.
4. Consider the context, active instructions, and additional data to make a realistic decision.

Reply with just the chosen state.`;

    const message = await claude.messages.create({
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
        model: 'claude-3-opus-20240229',
        stream: false
    });

    const nextState = message.content.at(0)!['text'];

    console.log(`Claude's choice: ${nextState}`);

    return machine.possibleStates.includes(nextState) && nextState !== currentState
        ? nextState
        : getDefaultNextState(machine);
}

function getDefaultNextState(machine: ClaudeStateMachine): State {
    const unvisitedStates = machine.possibleStates.filter(state => !machine.visitedStates.has(state));
    return unvisitedStates.length > 0 ? unvisitedStates[0] : machine.possibleStates[0];
}