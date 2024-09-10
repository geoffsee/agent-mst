import { ClaudeStateMachine } from './claude-state-machine';
import { getNextState } from './state-handlers';
import { StateMachineConfig } from './types';

export function createStateMachine(type: string): ClaudeStateMachine {
    switch (type) {
        case "customerSupport":
            return new ClaudeStateMachine({
                initialState: "Initial Contact",
                possibleStates: ["Initial Contact", "Troubleshooting", "Escalation", "Resolution", "Follow-up"],
                goalPredicate: (visitedStates) => visitedStates.has("Resolution"),
                contextPrompt: "You are a customer support agent handling a technical issue. Guide the conversation through appropriate stages to resolve the customer's problem.",
                instructions: [
                    {
                        condition: (machine) => machine.state === "Troubleshooting" && !machine.getData("issueIdentified"),
                        action: (machine) => {
                            machine.setData("issueIdentified", true);
                        },
                        description: "Identify the specific issue during troubleshooting"
                    },
                    {
                        condition: (machine) => machine.state === "Escalation" && !machine.getData("escalationReason"),
                        action: (machine) => {
                            machine.setData("escalationReason", "Complex technical issue beyond initial support scope");
                        },
                        description: "Document the reason for escalation"
                    }
                ]
            });
        // Add more cases as needed
        default:
            throw new Error(`Unknown state machine type: ${type}`);
    }
}

export async function runStateMachine(machine: ClaudeStateMachine) {
    while (!machine.goalReached()) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const nextState = await getNextState(machine);
        machine.transition(nextState);
    }
}

export { ClaudeStateMachine, StateMachineConfig, getNextState };
