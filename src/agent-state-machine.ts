import { makeAutoObservable } from "mobx";
import { Logger } from "tslog";
import {ClaudeStateMachine} from "./claude-state-machine.ts";
import {queryAI} from "./index.ts";

// Types
type State = string;

interface ProblemState {
    problemDescription: string;
    currentPlan: string[];
    executionResults: string[];
    learnings: string[];
}

interface Instruction {
    condition: (machine: ClaudeStateMachine) => boolean;
    action: (machine: ClaudeStateMachine) => Promise<void>;
    description: string;
}

interface StateMachineConfig {
    initialState: State;
    possibleStates: State[];
    goalPredicate: (visitedStates: Set<State>, machine: ClaudeStateMachine) => boolean;
    contextPrompt: string;
    instructions: Instruction[];
}


// Create the problem-solving state machine
export function createProblemSolvingStateMachine(): ClaudeStateMachine {
    const instructions: Instruction[] = [
        {
            condition: (machine) => machine.state === "ProblemAnalysis",
            action: async (machine) => {
                console.log("Executing ProblemAnalysis action");
                const problemDescription = machine.getData("initialProblem") as string;
                if (!problemDescription) {
                    console.error('initialProblem is undefined in ProblemAnalysis');
                    return;
                }
                const analysis = await queryAI(`Analyze the following problem and break it down into key components: ${problemDescription}`);

                console.log('Problem Analysis:', analysis);

                const problemState: ProblemState = {
                    problemDescription,
                    currentPlan: [],
                    executionResults: [],
                    learnings: []
                };
                machine.setData("problemState", problemState);
                machine.setData("problemAnalysis", analysis);

                console.log('ProblemState initialized:', problemState);
            },
            description: "Analyze the given problem and initialize problem state"
        },
        {
            condition: (machine) => machine.state === "PlanFormulation",
            action: async (machine) => {
                console.log("Executing PlanFormulation action");
                const problemState = machine.getData("problemState") as ProblemState;
                if (!problemState) {
                    console.error('problemState is undefined in PlanFormulation');
                    return;
                }
                const analysis = machine.getData("problemAnalysis") as string;
                if (!analysis) {
                    console.error('problemAnalysis is undefined in PlanFormulation');
                    return;
                }
                const plan = await queryAI(`Based on this analysis: ${analysis}, formulate a step-by-step plan to solve the problem: ${problemState.problemDescription}`);
                console.log('Generated plan:', plan);

                if (typeof plan === 'string' && plan.trim() !== '') {
                    // Split the plan into lines
                    const lines = plan.split('\n').map(line => line.trim()).filter(line => line !== '');

                    // Find the index of the header (if it exists)
                    const headerIndex = lines.findIndex(line => line.startsWith("Step-by-step plan"));

                    // Separate header and body
                    let header = '';
                    let bodyLines = lines;
                    if (headerIndex !== -1) {
                        header = lines[headerIndex];
                        bodyLines = lines.slice(headerIndex + 1);
                    }

                    // Regular expression to match numbered items, alphabetic subitems, and bulleted items
                    const stepPattern = /(?:^\s*(?:(\d+)\.|\(([a-z])\)|\-|\*)\s*(.+))/;

                    const parsedSteps = bodyLines.map(line => {
                        const match = line.match(stepPattern);
                        if (match) {
                            const [, number, letter, content] = match;
                            if (number) {
                                return { type: 'main', number: parseInt(number), content: content.trim() };
                            } else if (letter) {
                                return { type: 'sub', letter, content: content.trim() };
                            } else {
                                return { type: 'bullet', content: content.trim() };
                            }
                        } else {
                            return { type: 'unknown', content: line.trim() };
                        }
                    });

                    problemState.currentPlan = {
                        header: header,
                        steps: parsedSteps
                    };

                    machine.setData("problemState", problemState);
                    console.log('Parsed plan:', problemState.currentPlan);
                } else {
                    console.error('Plan is empty or invalid');
                }
            },
            description: "Formulate a plan to solve the problem"
        },
        {
            condition: (machine) => machine.state === "PlanExecution",
            action: async (machine) => {
                const problemState = machine.getData("problemState") as ProblemState;
                if (problemState?.currentPlan.length > 0) {
                    const currentStep = problemState.currentPlan.shift();
                    const executionResult = await queryAI(`Execute this step and describe the outcome: ${currentStep}`);
                    problemState.executionResults.push(executionResult);
                    machine.setData("problemState", problemState);
                }
            },
            description: "Execute the current step of the plan"
        },
        {
            condition: (machine) => machine.state === "ResultEvaluation",
            action: async (machine) => {
                const problemState = machine.getData("problemState") as ProblemState;
                const latestResult = problemState?.executionResults[problemState.executionResults.length - 1];
                const evaluation = await queryAI(`Evaluate this execution result: ${latestResult}. Has the problem been solved? What progress has been made?`);
                machine.setData("resultEvaluation", evaluation);
            },
            description: "Evaluate the results of the last execution step"
        },
        {
            condition: (machine) => machine.state === "KnowledgeIntegration",
            action: async (machine) => {
                const problemState = machine.getData("problemState") as ProblemState;
                const evaluation = machine.getData("resultEvaluation") as string;
                const learning = await queryAI(`Based on this evaluation: ${evaluation}, what can be learned about solving the problem: ${problemState?.problemDescription}`);
                problemState?.learnings.push(learning);
                machine.setData("problemState", problemState);
            },
            description: "Integrate new knowledge from the latest execution and evaluation"
        },
        {
            condition: (machine) => machine.state === "ProblemReformulation",
            action: async (machine) => {
                const problemState = machine.getData("problemState") as ProblemState;
                const reformulation = await queryAI(`Given these learnings: ${problemState?.learnings.join(', ')}, reformulate the problem if necessary: ${problemState?.problemDescription}`);
                if (reformulation !== problemState?.problemDescription) {
                    problemState.problemDescription = reformulation;
                    machine.setData("problemState", problemState);
                    machine.transition("ProblemAnalysis"); // Restart the process with the new problem formulation
                }
            },
            description: "Reformulate the problem based on accumulated learnings if necessary"
        }
    ];

    const config: StateMachineConfig = {
        initialState: "ProblemAnalysis",
        possibleStates: [
            "ProblemAnalysis", "PlanFormulation", "PlanExecution",
            "ResultEvaluation", "KnowledgeIntegration", "ProblemReformulation"
        ],
        goalPredicate: (visitedStates, machine) => {
            const problemState = machine?.getData("problemState") as ProblemState;
            return problemState?.learnings.some(learning =>
                learning.toLowerCase().includes("problem solved") ||
                learning.toLowerCase().includes("goal achieved")
            );
        },
        contextPrompt: "You are an intelligent agent capable of solving complex problems through analysis, planning, execution, and learning.",
        instructions: instructions
    };

    return new ClaudeStateMachine(config);
}

// Function to create different types of state machines
export function createStateMachine(type: string): ClaudeStateMachine {
    if (type === "problemSolving") {
        return createProblemSolvingStateMachine();
    }
    // Add other types here if needed
    throw new Error(`Unsupported state machine type: ${type}`);
}

// Function to run the state machine
export async function runStateMachine(machine: ClaudeStateMachine, initialProblem?: string) {
    if (initialProblem) {
        machine.setData("initialProblem", initialProblem);
    }

    const stateTransitions: { [key: string]: string } = {
        "ProblemAnalysis": "PlanFormulation",
        "PlanFormulation": "PlanExecution",
        "PlanExecution": "ResultEvaluation",
        "ResultEvaluation": "KnowledgeIntegration",
        "KnowledgeIntegration": "ProblemReformulation",
        "ProblemReformulation": "ProblemAnalysis"
    };

    while (!machine.goalReached()) {
        await machine.executeInstructions();

        const nextState = stateTransitions[machine.state];
        if (nextState) {
            machine.transition(nextState);
        } else {
            console.error(`No transition defined for state: ${machine.state}`);
            break;
        }
    }
    console.log("Goal reached. Final state:", machine.state);
}