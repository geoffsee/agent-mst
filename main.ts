import {createStateMachine, runStateMachine} from "./src/agent-state-machine.ts";

// Main function
async function main() {
    const problemSolvingAgent = createStateMachine("problemSolving");
    await runStateMachine(problemSolvingAgent, "Develop a strategy to reduce carbon emissions in a major city");
}

main().catch(console.error);