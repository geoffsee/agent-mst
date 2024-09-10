import Anthropic from "@anthropic-ai/sdk";

export default new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });