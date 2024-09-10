import {createStateMachine, runStateMachine} from "./src";

async function main() {
    const types = ["customerSupport"];
    for (const type of types) {
        console.log(`\nRunning ${type} state machine:`);
        const machine = createStateMachine(type);
        await runStateMachine(machine);
    }
}

main().catch(console.error);