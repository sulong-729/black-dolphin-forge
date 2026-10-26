// Qualification-only fixture control. Not shipped as a toolkit capability.
const fs = require('fs'), path = require('path');
let timer, running = false, opened = false;
exports.load = () => {
    timer = setInterval(async () => {
        if (running)
            return;
        running = true;
        const root = Editor.Project.path;
        try {
            if (!opened) {
                await Editor.Message.request('scene', 'execute-scene-script', { name: 'p5-probe', method: 'createFixture', args: [root] });
                await Editor.Message.request('asset-db', 'refresh-asset', 'db://assets/Qualification.scene');
                const id = await Editor.Message.request('asset-db', 'query-uuid', 'db://assets/Qualification.scene');
                if (!id || !await Editor.Message.request('scene', 'query-is-ready'))
                    return;
                await Editor.Message.request('scene', 'open-scene', id);
                opened = true;
                fs.writeFileSync(path.join(root, 'p5-ready.json'), '{}');
            }
            const file = path.join(root, 'p5-command.json');
            if (!fs.existsSync(file))
                return;
            const { id, command } = JSON.parse(fs.readFileSync(file));
            fs.unlinkSync(file);
            let result;
            if (command === 'inspect') {
                const tree = await Editor.Message.request('scene', 'query-node-tree'), panel = tree.children.find(n => n.name === 'Panel' || n.name === 'RenamedPanel');
                result = { tree, panel: await Editor.Message.request('scene', 'query-node', panel.uuid), dirty: await Editor.Message.request('scene', 'query-dirty') };
            }
            else if (['undo', 'redo', 'save-scene'].includes(command)) {
                await Editor.Message.request('scene', command);
                result = { dirty: await Editor.Message.request('scene', 'query-dirty') };
            }
            else if (command === 'reload') {
                const scene = (method) => Editor.Message.request('scene', 'execute-scene-script', { name: 'p5-probe', method, args: [] });
                const before = await scene('fixtureIdentity');
                await scene('reloadFixture');
                let after;
                const start = Date.now();
                while (Date.now() - start < 20000) {
                    try {
                        after = await scene('fixtureIdentity');
                        if (after && after !== before)
                            break;
                    }
                    catch { }
                    await new Promise(r => setTimeout(r, 200));
                }
                if (!after || after === before)
                    throw Error('Reload identity did not change');
                result = { before, after };
            }
            else
                throw Error('Qualification command not allowed');
            fs.writeFileSync(path.join(root, 'p5-result-' + id + '.json'), JSON.stringify({ status: 'PASS', result }));
        }
        catch (e) {
            console.warn('[p5-probe] ' + String(e.stack || e));
        }
        finally {
            running = false;
        }
    }, 1000);
};
exports.unload = () => clearInterval(timer);
