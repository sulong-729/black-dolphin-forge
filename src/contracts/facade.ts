export const facadeTools = [
    { name: 'cocos_describe', description: 'Discover capabilities, availability or the schema for one operation.' },
    { name: 'cocos_query', description: 'Run an available read-only operation with compact paged results.' },
    { name: 'cocos_propose', description: 'Create an edit proposal when that capability is available; never grants approval.' },
    { name: 'cocos_apply', description: 'Apply an authorized proposal when available; Phase 1 does not enable writes.' },
    { name: 'cocos_job', description: 'Control a qualified job when available; does not bypass write authorization.' },
    { name: 'cocos_artifact', description: 'Read a bounded chunk of a captured snapshot artifact.' },
] as const;
