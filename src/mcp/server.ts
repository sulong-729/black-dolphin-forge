import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { facadeTools } from '../contracts/facade.js';
import { createRequest } from '../contracts/envelopes.js';
import { call } from '../daemon/client.js';
export async function runMcp() {
    const server = new McpServer({ name: 'cocos-ai-toolkit', version: '0.9.2' });
    for (const tool of facadeTools) {
        server.registerTool(tool.name, { description: tool.description, inputSchema: z.object({ request: z.unknown().optional(), operation: z.string().optional() }).strict() }, async (input) => {
            const request: any = Object.hasOwn(input,'request') ? input.request : createRequest('capabilities.describe', input.operation ? { operation: input.operation } : {});
            const result = await call(request, undefined, tool.name);
            return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], isError: result.status === 'error' };
        });
    }
    await server.connect(new StdioServerTransport());
    return server;
}
